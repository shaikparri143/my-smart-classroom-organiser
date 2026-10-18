from datetime import date
from math import ceil

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

import models
from schemas import AttendanceBatch


def _teacher_course(
    db: Session, teacher_id: int, course_id: int
) -> models.Course:
    course = db.scalar(
        select(models.Course).where(
            models.Course.id == course_id,
            models.Course.teacher_id == teacher_id,
        )
    )
    if course is None:
        raise LookupError("Course not found.")
    return course


def _attendance_metrics(records: list[models.AttendanceRecord], threshold: float) -> dict:
    present = sum(record.status == "present" for record in records)
    absent = sum(record.status == "absent" for record in records)
    late = sum(record.status == "late" for record in records)
    excused = sum(record.status == "excused" for record in records)
    eligible = present + absent + late
    attended = present + late
    raw_percentage = attended * 100 / eligible if eligible else None
    percentage = round(raw_percentage, 1) if raw_percentage is not None else None
    requirement_met = raw_percentage >= threshold if raw_percentage is not None else None
    margin = round(raw_percentage - threshold, 2) if raw_percentage is not None else None
    additional_classes = None
    if eligible and raw_percentage is not None and raw_percentage < threshold:
        if threshold < 100:
            additional_classes = ceil(
                max(0, (threshold / 100) * eligible - attended)
                / (1 - threshold / 100)
            )
    return {
        "total_records": len(records),
        "eligible_records": eligible,
        "attended_records": attended,
        "present_count": present,
        "absent_count": absent,
        "late_count": late,
        "excused_count": excused,
        "attendance_percentage": percentage,
        "required_attendance_percentage": threshold,
        "requirement_met": requirement_met,
        "margin_percentage_points": margin,
        "additional_classes_needed": additional_classes,
    }


def get_course_attendance(
    db: Session, teacher_id: int, course_id: int, attendance_date: date
) -> list[dict]:
    course = _teacher_course(db, teacher_id, course_id)
    students = db.execute(
        select(models.User)
        .join(models.Enrollment, models.Enrollment.student_id == models.User.id)
        .where(models.Enrollment.course_id == course_id)
        .order_by(models.User.full_name.asc(), models.User.id.asc())
    ).scalars().all()
    history_rows = db.execute(
        select(models.AttendanceRecord)
        .where(models.AttendanceRecord.course_id == course_id)
        .order_by(
            models.AttendanceRecord.attendance_date.desc(),
            models.AttendanceRecord.id.desc(),
        )
    ).scalars().all()
    history_by_student: dict[int, list[models.AttendanceRecord]] = {}
    for record in history_rows:
        history_by_student.setdefault(record.student_id, []).append(record)

    response = []
    for student in students:
        history = history_by_student.get(student.id, [])
        daily_record = next(
            (record for record in history if record.attendance_date == attendance_date),
            None,
        )
        response.append(
            {
                "student_id": student.id,
                "student_name": student.full_name,
                "student_email": student.email,
                "status": daily_record.status if daily_record else None,
                "notes": daily_record.notes if daily_record else None,
                **_attendance_metrics(history, course.attendance_threshold),
                "history": [
                    {
                        "attendance_date": record.attendance_date,
                        "status": record.status,
                        "notes": record.notes,
                    }
                    for record in history
                ],
            }
        )
    return response


def update_attendance_threshold(
    db: Session, teacher_id: int, course_id: int, threshold: float
) -> models.Course:
    course = _teacher_course(db, teacher_id, course_id)
    course.attendance_threshold = threshold
    db.commit()
    db.refresh(course)
    return course


def save_course_attendance(
    db: Session,
    teacher_id: int,
    course_id: int,
    payload: AttendanceBatch,
) -> list[dict]:
    _teacher_course(db, teacher_id, course_id)
    enrolled_ids = set(
        db.execute(
            select(models.Enrollment.student_id).where(
                models.Enrollment.course_id == course_id
            )
        ).scalars()
    )
    requested_ids = {record.student_id for record in payload.records}
    if not requested_ids.issubset(enrolled_ids):
        raise ValueError("Attendance can only be recorded for enrolled students.")

    values = [
        {
            "course_id": course_id,
            "student_id": record.student_id,
            "marked_by_id": teacher_id,
            "attendance_date": payload.attendance_date,
            "status": record.status,
            "notes": record.notes,
        }
        for record in payload.records
    ]
    statement = insert(models.AttendanceRecord).values(values)
    statement = statement.on_conflict_do_update(
        constraint="uq_attendance_course_student_date",
        set_={
            "marked_by_id": statement.excluded.marked_by_id,
            "status": statement.excluded.status,
            "notes": statement.excluded.notes,
        },
    )
    db.execute(statement)
    db.commit()
    return get_course_attendance(
        db, teacher_id, course_id, payload.attendance_date
    )


def get_student_attendance(
    db: Session, student_id: int
) -> list[dict]:
    courses = db.execute(
        select(models.Course)
        .join(models.Enrollment, models.Enrollment.course_id == models.Course.id)
        .where(models.Enrollment.student_id == student_id)
        .order_by(models.Course.title.asc(), models.Course.id.asc())
    ).scalars().all()
    records = db.execute(
        select(models.AttendanceRecord)
        .where(models.AttendanceRecord.student_id == student_id)
        .order_by(
            models.AttendanceRecord.attendance_date.desc(),
            models.AttendanceRecord.id.desc(),
        )
    ).scalars().all()
    records_by_course: dict[int, list[models.AttendanceRecord]] = {}
    for record in records:
        records_by_course.setdefault(record.course_id, []).append(record)

    summaries = []
    for course in courses:
        course_records = records_by_course.get(course.id, [])
        metrics = _attendance_metrics(course_records, course.attendance_threshold)
        summaries.append(
            {
                "course_id": course.id,
                "course_code": course.course_code,
                "course_title": course.title,
                "required_attendance_percentage": course.attendance_threshold,
                "total_sessions": metrics["eligible_records"],
                "present_count": metrics["present_count"],
                "absent_count": metrics["absent_count"],
                "late_count": metrics["late_count"],
                "excused_count": metrics["excused_count"],
                "attendance_percentage": metrics["attendance_percentage"],
                "requirement_met": metrics["requirement_met"],
                "margin_percentage_points": metrics["margin_percentage_points"],
                "additional_classes_needed": metrics["additional_classes_needed"],
                "history": [
                    {
                        "attendance_date": record.attendance_date,
                        "status": record.status,
                        "notes": record.notes,
                    }
                    for record in course_records
                ],
            }
        )
    return summaries
