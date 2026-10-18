from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
from database import get_db
from dependencies import CurrentStudent, CurrentTeacher, CurrentUser
from schemas import DoubtCreate, DoubtResponse

router = APIRouter(prefix="/api/doubts", tags=["Student doubts"])
DbSession = Annotated[Session, Depends(get_db)]


def _course_access(db: Session, user: models.User, course_id: int) -> models.Course:
    course = db.get(models.Course, course_id)
    if course is None:
        raise LookupError("Course not found.")

    if user.role == "teacher":
        if course.teacher_id != user.id:
            raise PermissionError("You are not authorized to view this course.")
        return course

    if user.role == "student":
        enrollment = db.scalar(
            select(models.Enrollment.id).where(
                models.Enrollment.course_id == course_id,
                models.Enrollment.student_id == user.id,
            )
        )
        if enrollment is None:
            raise PermissionError("You are not enrolled in this course.")
        return course

    raise PermissionError("You do not have access to this resource.")


@router.get("/courses/{course_id}", response_model=list[DoubtResponse])
def list_course_doubts(course_id: int, db: DbSession, user: CurrentUser):
    try:
        _course_access(db, user, course_id)
    except (LookupError, PermissionError) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if isinstance(exc, LookupError) else status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    statement = (
        select(models.Doubt)
        .where(models.Doubt.course_id == course_id)
        .order_by(models.Doubt.created_at.desc())
    )
    if user.role == "student":
        statement = statement.where(models.Doubt.student_id == user.id)
    return db.execute(statement).scalars().all()


@router.post("/courses/{course_id}", response_model=DoubtResponse, status_code=status.HTTP_201_CREATED)
def create_doubt(course_id: int, payload: DoubtCreate, db: DbSession, student: CurrentStudent):
    try:
        _course_access(db, student, course_id)
    except (LookupError, PermissionError) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if isinstance(exc, LookupError) else status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    doubt = models.Doubt(
        course_id=course_id,
        student_id=student.id,
        title=payload.title.strip(),
        question=payload.question.strip(),
        status="open",
    )
    db.add(doubt)
    db.commit()
    db.refresh(doubt)
    return doubt


@router.patch("/{doubt_id}/answer", response_model=DoubtResponse)
def answer_doubt(doubt_id: int, payload: dict, db: DbSession, teacher: CurrentTeacher):
    doubt = db.get(models.Doubt, doubt_id)
    if doubt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doubt not found.")

    course = db.get(models.Course, doubt.course_id)
    if course is None or course.teacher_id != teacher.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not teach this course.")

    answer = str(payload.get("answer", "")).strip()
    if not answer:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="An answer is required.")

    doubt.answer = answer
    doubt.answered_by_id = teacher.id
    doubt.status = "answered"
    doubt.answered_at = __import__("datetime").datetime.utcnow()
    db.commit()
    db.refresh(doubt)
    return doubt
