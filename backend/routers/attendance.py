from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from dependencies import CurrentStudent, CurrentTeacher
from schemas import (
    AttendanceBatch,
    AttendanceThresholdUpdate,
    StudentAttendanceCourseSummary,
    TeacherAttendanceStudent,
)
from services import attendance_service


router = APIRouter(prefix="/api/attendance", tags=["Attendance"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get(
    "/courses/{course_id}",
    response_model=list[TeacherAttendanceStudent],
)
def get_course_attendance(
    course_id: int,
    db: DbSession,
    teacher: CurrentTeacher,
    attendance_date: Annotated[date, Query(alias="date")] = date.today(),
):
    try:
        return attendance_service.get_course_attendance(
            db, teacher.id, course_id, attendance_date
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.put(
    "/courses/{course_id}",
    response_model=list[TeacherAttendanceStudent],
)
def save_course_attendance(
    course_id: int,
    payload: AttendanceBatch,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        return attendance_service.save_course_attendance(
            db, teacher.id, course_id, payload
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.patch("/courses/{course_id}/threshold")
def update_attendance_threshold(
    course_id: int,
    payload: AttendanceThresholdUpdate,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        course = attendance_service.update_attendance_threshold(
            db, teacher.id, course_id, payload.attendance_threshold
        )
        return {"course_id": course.id, "attendance_threshold": course.attendance_threshold}
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/student",
    response_model=list[StudentAttendanceCourseSummary],
)
def get_student_attendance(db: DbSession, student: CurrentStudent):
    return attendance_service.get_student_attendance(db, student.id)