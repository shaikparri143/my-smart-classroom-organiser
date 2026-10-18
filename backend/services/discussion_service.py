from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

import models
from schemas import DiscussionPostCreate, DiscussionPostUpdate
from services.notification_service import queue_notification


def _course_for_user(
    db: Session, course_id: int, user: models.User
) -> models.Course:
    course = db.get(models.Course, course_id)
    if course is None:
        raise LookupError("Course not found.")
    if user.role == "teacher" and course.teacher_id == user.id:
        return course
    if user.role == "student":
        enrolled = db.scalar(
            select(models.Enrollment.id).where(
                models.Enrollment.course_id == course_id,
                models.Enrollment.student_id == user.id,
            )
        )
        if enrolled is not None:
            return course
    raise LookupError("Course not found.")


def _post_response(
    post: models.DiscussionPost,
    *,
    course_id: int | None = None,
    replies: list[dict] | None = None,
) -> dict:
    return {
        "id": post.id,
        "course_id": course_id or post.course_id,
        "author_id": post.author_id,
        "author_name": post.author.full_name,
        "author_role": post.author.role,
        "message": post.message,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "replies": replies or [],
    }


def get_course_discussions(
    db: Session, course_id: int, user: models.User
) -> list[dict]:
    _course_for_user(db, course_id, user)
    posts = db.execute(
        select(models.DiscussionPost)
        .options(joinedload(models.DiscussionPost.author))
        .where(
            models.DiscussionPost.course_id == course_id,
            models.DiscussionPost.parent_id.is_(None),
        )
        .order_by(models.DiscussionPost.created_at.desc())
    ).scalars().all()
    post_ids = [post.id for post in posts]
    replies = (
        db.execute(
            select(models.DiscussionPost)
            .options(joinedload(models.DiscussionPost.author))
            .where(models.DiscussionPost.parent_id.in_(post_ids))
            .order_by(models.DiscussionPost.created_at.asc())
        ).scalars().all()
        if post_ids
        else []
    )
    replies_by_parent: dict[int, list[dict]] = {}
    for reply in replies:
        replies_by_parent.setdefault(reply.parent_id, []).append(
            _post_response(reply, course_id=course_id)
        )
    return [
        _post_response(
            post,
            course_id=course_id,
            replies=replies_by_parent.get(post.id, []),
        )
        for post in posts
    ]


def create_discussion_post(
    db: Session,
    course_id: int,
    user: models.User,
    payload: DiscussionPostCreate,
) -> dict:
    course = _course_for_user(db, course_id, user)
    post = models.DiscussionPost(
        course_id=course.id,
        author_id=user.id,
        message=payload.message,
    )
    db.add(post)
    db.flush()
    if user.role == "student":
        queue_notification(
            db,
            user_id=course.teacher_id,
            title="New classroom discussion",
            message=f"{user.full_name} posted in {course.title}.",
            notification_type="discussion",
            link="/discussions",
            dedupe_key=f"discussion-post:{post.id}:user:{course.teacher_id}",
        )
    db.commit()
    db.refresh(post)
    return _post_response(post)


def create_discussion_reply(
    db: Session,
    course_id: int,
    post_id: int,
    user: models.User,
    payload: DiscussionPostCreate,
) -> dict:
    course = _course_for_user(db, course_id, user)
    parent = db.scalar(
        select(models.DiscussionPost)
        .options(joinedload(models.DiscussionPost.author))
        .where(
            models.DiscussionPost.id == post_id,
            models.DiscussionPost.course_id == course_id,
            models.DiscussionPost.parent_id.is_(None),
        )
    )
    if parent is None:
        raise LookupError("Discussion thread not found.")
    reply = models.DiscussionPost(
        course_id=course_id,
        author_id=user.id,
        parent_id=parent.id,
        message=payload.message,
    )
    db.add(reply)
    db.flush()
    participant_ids = set(
        db.execute(
            select(models.DiscussionPost.author_id).where(
                models.DiscussionPost.course_id == course_id,
                (models.DiscussionPost.id == parent.id)
                | (models.DiscussionPost.parent_id == parent.id),
            )
        ).scalars()
    )
    if user.role == "student":
        participant_ids.add(course.teacher_id)
    participant_ids.discard(user.id)
    for participant_id in participant_ids:
        queue_notification(
            db,
            user_id=participant_id,
            title="New discussion reply",
            message=f"{user.full_name} replied in {course.title}.",
            notification_type="discussion",
            link="/discussions",
            dedupe_key=f"discussion-reply:{reply.id}:user:{participant_id}",
        )
    db.commit()
    db.refresh(reply)
    return _post_response(reply, course_id=course_id)


def update_discussion_post(
    db: Session,
    course_id: int,
    post_id: int,
    user: models.User,
    payload: DiscussionPostUpdate,
) -> dict:
    _course_for_user(db, course_id, user)
    post = db.scalar(
        select(models.DiscussionPost)
        .options(joinedload(models.DiscussionPost.author))
        .where(
            models.DiscussionPost.id == post_id,
            models.DiscussionPost.course_id == course_id,
        )
    )
    if post is None:
        raise LookupError("Discussion post not found.")
    if user.role != "teacher" and post.author_id != user.id:
        raise PermissionError("You can only edit your own discussion posts.")
    post.message = payload.message
    post.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(post)
    return _post_response(post)


def delete_discussion_post(
    db: Session, course_id: int, post_id: int, user: models.User
) -> None:
    _course_for_user(db, course_id, user)
    post = db.scalar(
        select(models.DiscussionPost).where(
            models.DiscussionPost.id == post_id,
            models.DiscussionPost.course_id == course_id,
        )
    )
    if post is None:
        raise LookupError("Discussion post not found.")
    if user.role != "teacher" and post.author_id != user.id:
        raise PermissionError("You can only delete your own discussion posts.")
    db.delete(post)
    db.commit()
