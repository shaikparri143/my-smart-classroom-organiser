from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from database import get_db
from dependencies import CurrentStudent, CurrentTeacher
from schemas import AnnouncementCreate, AnnouncementResponse, AnnouncementUpdate
from services import announcement_service


router = APIRouter(prefix="/api/announcements", tags=["Announcements"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/teacher", response_model=list[AnnouncementResponse])
def list_teacher_announcements(db: DbSession, teacher: CurrentTeacher):
    return announcement_service.get_teacher_announcements(db, teacher.id)


@router.get("/student", response_model=list[AnnouncementResponse])
def list_student_announcements(db: DbSession, student: CurrentStudent):
    return announcement_service.get_student_announcements(db, student.id)


@router.post(
    "",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_announcement(
    payload: AnnouncementCreate,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        return announcement_service.create_announcement(db, teacher.id, payload)
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


@router.put("/{announcement_id}", response_model=AnnouncementResponse)
def update_announcement(
    announcement_id: int,
    payload: AnnouncementUpdate,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        return announcement_service.update_announcement(
            db, teacher.id, announcement_id, payload
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


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(
    announcement_id: int,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        announcement_service.delete_announcement(db, teacher.id, announcement_id)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)