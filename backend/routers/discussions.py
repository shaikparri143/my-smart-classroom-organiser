from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from database import get_db
from dependencies import CurrentUser
from schemas import (
    DiscussionPostCreate,
    DiscussionPostResponse,
    DiscussionPostUpdate,
)
from services import discussion_service


router = APIRouter(prefix="/api/discussions", tags=["Classroom discussions"])
DbSession = Annotated[Session, Depends(get_db)]


def _raise_post_error(exc: Exception) -> None:
    if isinstance(exc, LookupError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    if isinstance(exc, PermissionError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    raise exc


@router.get(
    "/courses/{course_id}",
    response_model=list[DiscussionPostResponse],
)
def list_course_discussions(
    course_id: int,
    db: DbSession,
    user: CurrentUser,
):
    try:
        return discussion_service.get_course_discussions(db, course_id, user)
    except LookupError as exc:
        _raise_post_error(exc)


@router.post(
    "/courses/{course_id}/posts",
    response_model=DiscussionPostResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_discussion_post(
    course_id: int,
    payload: DiscussionPostCreate,
    db: DbSession,
    user: CurrentUser,
):
    try:
        return discussion_service.create_discussion_post(
            db, course_id, user, payload
        )
    except LookupError as exc:
        _raise_post_error(exc)


@router.post(
    "/courses/{course_id}/posts/{post_id}/replies",
    response_model=DiscussionPostResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_discussion_reply(
    course_id: int,
    post_id: int,
    payload: DiscussionPostCreate,
    db: DbSession,
    user: CurrentUser,
):
    try:
        return discussion_service.create_discussion_reply(
            db, course_id, post_id, user, payload
        )
    except LookupError as exc:
        _raise_post_error(exc)


@router.put(
    "/courses/{course_id}/posts/{post_id}",
    response_model=DiscussionPostResponse,
)
def update_discussion_post(
    course_id: int,
    post_id: int,
    payload: DiscussionPostUpdate,
    db: DbSession,
    user: CurrentUser,
):
    try:
        return discussion_service.update_discussion_post(
            db, course_id, post_id, user, payload
        )
    except (LookupError, PermissionError) as exc:
        _raise_post_error(exc)


@router.delete(
    "/courses/{course_id}/posts/{post_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_discussion_post(
    course_id: int,
    post_id: int,
    db: DbSession,
    user: CurrentUser,
):
    try:
        discussion_service.delete_discussion_post(db, course_id, post_id, user)
    except (LookupError, PermissionError) as exc:
        _raise_post_error(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
