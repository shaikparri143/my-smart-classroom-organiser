from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from dependencies import CurrentStudent, CurrentTeacher
from schemas import (
    AssessmentComponentCreate,
    AssessmentComponentResponse,
    AssessmentComponentUpdate,
    ComponentMarkStudent,
    ComponentMarksBatch,
    TeacherCourseMarks,
    StudentCourseMarks,
)
from services import marks_service


router = APIRouter(prefix="/api/marks", tags=["Marks"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get(
    "/courses/{course_id}",
    response_model=TeacherCourseMarks,
)
def get_course_marks(
    course_id: int,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        return marks_service.get_course_marks(db, teacher.id, course_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get(
    "/courses/{course_id}/components",
    response_model=list[AssessmentComponentResponse],
)
def list_course_components(
    course_id: int,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        return marks_service.list_course_components(db, teacher.id, course_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post(
    "/courses/{course_id}/components",
    response_model=AssessmentComponentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_component(
    course_id: int,
    payload: AssessmentComponentCreate,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        return marks_service.create_component(db, teacher.id, course_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc


@router.patch(
    "/components/{component_id}",
    response_model=AssessmentComponentResponse,
)
def update_component(
    component_id: int,
    payload: AssessmentComponentUpdate,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        return marks_service.update_component(
            db, teacher.id, component_id, payload
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc


@router.delete(
    "/components/{component_id}",
    response_model=AssessmentComponentResponse,
)
def archive_component(
    component_id: int,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        return marks_service.archive_component(db, teacher.id, component_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get(
    "/components/{component_id}/students",
    response_model=list[ComponentMarkStudent],
)
def get_component_students(
    component_id: int,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        return marks_service.get_component_students(
            db, teacher.id, component_id
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put(
    "/components/{component_id}/marks",
    response_model=list[ComponentMarkStudent],
)
def save_component_marks(
    component_id: int,
    payload: ComponentMarksBatch,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        return marks_service.save_component_marks(
            db, teacher.id, component_id, payload
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc


@router.get(
    "/student",
    response_model=list[StudentCourseMarks],
)
def get_student_marks(
    db: DbSession,
    student: CurrentStudent,
):
    return marks_service.get_student_marks(db, student.id)
