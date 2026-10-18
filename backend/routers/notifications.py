from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from database import get_db
from dependencies import CurrentUser
from schemas import NotificationResponse
from services import notification_service


router = APIRouter(prefix="/api/notifications", tags=["Notifications"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[NotificationResponse])
def list_notifications(db: DbSession, user: CurrentUser):
    return notification_service.get_user_notifications(db, user.id)


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    db: DbSession,
    user: CurrentUser,
):
    try:
        return notification_service.mark_notification_read(
            db, user.id, notification_id
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.patch("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_notifications_read(db: DbSession, user: CurrentUser):
    notification_service.mark_all_notifications_read(db, user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)