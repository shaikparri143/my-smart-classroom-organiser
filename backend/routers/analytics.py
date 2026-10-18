from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import models
from database import get_db
from dependencies import CurrentTeacher

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/teacher")
def get_teacher_analytics(db: DbSession, teacher: CurrentTeacher):
    courses = db.scalars(
        select(models.Course)
        .where(models.Course.teacher_id == teacher.id)
        .order_by(models.Course.created_at.desc())
    ).all()

    if not courses:
        return {
            "summary": {
                "total_courses": 0,
                "total_students": 0,
                "total_assignments": 0,
                "submission_rate": 0,
                "pending_submissions": 0,
                "average_marks": 0,
                "low_attendance_count": 0,
                "upcoming_deadlines": [],
            },
            "course_breakdown": [],
            "assignment_trend": [],
            "attendance_summary": [],
        }

    course_ids = [course.id for course in courses]
    total_courses = len(courses)
    total_students = db.scalar(
        select(func.count(func.distinct(models.Enrollment.student_id))).where(
            models.Enrollment.course_id.in_(course_ids)
        )
    ) or 0

    total_assignments = db.scalar(
        select(func.count(models.Assignment.id)).where(
            models.Assignment.course_id.in_(course_ids)
        )
    ) or 0

    total_submissions = db.scalar(
        select(func.count(models.Submission.id))
        .join(models.Assignment, models.Assignment.id == models.Submission.assignment_id)
        .where(models.Assignment.course_id.in_(course_ids))
    ) or 0

    assignment_overview = db.execute(
        select(
            models.Assignment.course_id,
            models.Assignment.id,
            models.Assignment.title,
            models.Assignment.due_at,
            models.Submission.id.label("submission_id"),
            models.Submission.status,
            models.Grade.score,
        )
        .outerjoin(
            models.Submission,
            (models.Submission.assignment_id == models.Assignment.id)
            & (models.Submission.student_id != teacher.id),
        )
        .outerjoin(models.Grade, models.Grade.submission_id == models.Submission.id)
        .where(models.Assignment.course_id.in_(course_ids))
    ).all()

    pending_reviews = 0
    for _, _, _, _, submission_id, status, score in assignment_overview:
        if submission_id is not None and status in {"submitted", "late", "resubmitted"}:
            pending_reviews += 1

    average_marks = db.scalar(
        select(func.avg(models.Grade.score))
        .join(models.Submission, models.Submission.id == models.Grade.submission_id)
        .join(models.Assignment, models.Assignment.id == models.Submission.assignment_id)
        .where(models.Assignment.course_id.in_(course_ids))
    )
    if average_marks is None:
        average_marks = 0

    submission_rate = 0
    if total_assignments:
        submission_rate = round((total_submissions / (total_assignments * max(total_students, 1))) * 100, 2)

    attendance_rows = db.execute(
        select(
            models.AttendanceRecord.student_id,
            models.AttendanceRecord.course_id,
            models.AttendanceRecord.status,
        )
        .join(models.Course, models.Course.id == models.AttendanceRecord.course_id)
        .where(models.Course.teacher_id == teacher.id)
    ).all()

    attendance_by_student = {}
    for student_id, course_id, status in attendance_rows:
        attendance_by_student.setdefault(student_id, []).append((course_id, status))

    low_attendance_count = 0
    for student_id, records in attendance_by_student.items():
        course_count = len(records)
        if not course_count:
            continue
        present_count = sum(1 for _, status in records if status in {"present", "late", "excused"})
        if course_count and (present_count / course_count) * 100 < 75:
            low_attendance_count += 1

    deadline_window = datetime.utcnow() + timedelta(days=30)
    upcoming_deadlines = []
    for assignment in db.execute(
        select(models.Assignment)
        .where(
            models.Assignment.course_id.in_(course_ids),
            models.Assignment.due_at.is_not(None),
            models.Assignment.due_at >= datetime.utcnow(),
            models.Assignment.due_at <= deadline_window,
        )
        .order_by(models.Assignment.due_at.asc())
    ).scalars():
        course = db.get(models.Course, assignment.course_id)
        upcoming_deadlines.append({
            "assignment_id": assignment.id,
            "title": assignment.title,
            "course_title": course.title if course else "Course",
            "due_at": assignment.due_at.isoformat() if assignment.due_at else None,
        })

    course_breakdown = []
    for course in courses:
        course_students = db.scalar(
            select(func.count(models.Enrollment.id)).where(models.Enrollment.course_id == course.id)
        ) or 0
        course_assignments = db.scalar(
            select(func.count(models.Assignment.id)).where(models.Assignment.course_id == course.id)
        ) or 0
        course_submissions = db.scalar(
            select(func.count(models.Submission.id))
            .join(models.Assignment, models.Assignment.id == models.Submission.assignment_id)
            .where(models.Assignment.course_id == course.id)
        ) or 0
        course_average = db.scalar(
            select(func.avg(models.Grade.score))
            .join(models.Submission, models.Submission.id == models.Grade.submission_id)
            .join(models.Assignment, models.Assignment.id == models.Submission.assignment_id)
            .where(models.Assignment.course_id == course.id)
        )
        course_attendance = db.execute(
            select(models.AttendanceRecord.status)
            .where(models.AttendanceRecord.course_id == course.id)
        ).scalars().all()
        attended = sum(1 for status in course_attendance if status in {"present", "late", "excused"})
        attendance_rate = 0
        if course_attendance:
            attendance_rate = round((attended / len(course_attendance)) * 100, 2)

        course_breakdown.append({
            "course_id": course.id,
            "course_code": course.course_code,
            "title": course.title,
            "student_count": course_students,
            "assignment_count": course_assignments,
            "submission_rate": round((course_submissions / max(course_students, 1)) * 100, 2) if course_assignments else 0,
            "average_mark": float(course_average) if course_average else 0,
            "attendance_rate": attendance_rate,
        })

    return {
        "summary": {
            "total_courses": total_courses,
            "total_students": total_students,
            "total_assignments": total_assignments,
            "submission_rate": submission_rate,
            "pending_submissions": pending_reviews,
            "average_marks": float(average_marks),
            "low_attendance_count": low_attendance_count,
            "upcoming_deadlines": upcoming_deadlines,
        },
        "course_breakdown": course_breakdown,
        "assignment_trend": [
            {
                "name": course["title"],
                "assignments": course["assignment_count"],
                "submissions": course["submission_rate"],
            }
            for course in course_breakdown
        ],
        "attendance_summary": [
            {"name": course["course_code"], "value": course["attendance_rate"]}
            for course in course_breakdown
        ],
    }
