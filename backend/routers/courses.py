
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from dependencies import CurrentStudent, CurrentTeacher
from schemas import (
    CourseCreate,
    EnrolledStudentResponse,
    JoinCourseRequest,
    StudentCourseResponse,
    TeacherCourseResponse,
    EnrollmentResponse,
)
from services import course_service


router = APIRouter(prefix="/api/courses", tags=["Courses"])
DbSession = Annotated[Session, Depends(get_db)]


@router.post(
    "",
    response_model=TeacherCourseResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_course(
    payload: CourseCreate,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        return course_service.create_course(db, teacher, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.get("/teacher", response_model=list[TeacherCourseResponse])
def list_teacher_courses(
    db: DbSession,
    teacher: CurrentTeacher,
):
    return course_service.get_teacher_courses(db, teacher.id)


@router.get("/student", response_model=list[StudentCourseResponse])
def list_student_courses(
    db: DbSession,
    student: CurrentStudent,
):
    return course_service.get_student_courses(db, student.id)


@router.post(
    "/join",
    response_model=EnrollmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def join_course(
    payload: JoinCourseRequest,
    db: DbSession,
    student: CurrentStudent,
):
    try:
        return course_service.join_course(db, student, payload.join_code)
    except ValueError as exc:
        db.rollback()
        message = str(exc)
        code = status.HTTP_404_NOT_FOUND if message == "Invalid join code." else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail=message) from exc


@router.get(
    "/{course_id}/students",
    response_model=list[EnrolledStudentResponse],
)
def list_course_students(
    course_id: int,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        enrollments = course_service.get_course_students(
            db, teacher.id, course_id
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return [
        EnrolledStudentResponse(
            id=enrollment.student.id,
            full_name=enrollment.student.full_name,
            email=enrollment.student.email,
            enrolled_at=enrollment.enrolled_at,
        )
        for enrollment in enrollments
    ]
