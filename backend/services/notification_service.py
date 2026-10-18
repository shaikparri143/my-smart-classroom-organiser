from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

import models


def queue_notification(
    db: Session,
    *,
    user_id: int,
    title: str,
    message: str,
    notification_type: str,
    link: str | None,
    dedupe_key: str,
) -> None:
    statement = insert(models.Notification).values(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
        dedupe_key=dedupe_key,
        is_read=False,
    )
    db.execute(
        statement.on_conflict_do_nothing(
            index_elements=[models.Notification.dedupe_key]
        )
    )


def notify_assignment_recipients(
    db: Session,
    assignment: models.Assignment,
    student_ids: list[int],
) -> None:
    for student_id in student_ids:
        queue_notification(
            db,
            user_id=student_id,
            title="New assignment",
            message=f"{assignment.title} has been assigned to you.",
            notification_type="assignment",
            link="/assignments",
            dedupe_key=f"assignment:{assignment.id}:user:{student_id}",
        )


def notify_submission(
    db: Session,
    *,
    teacher_id: int,
    student_name: str,
    assignment_title: str,
    submission_id: int,
    submitted_at: datetime,
    is_resubmission: bool,
) -> None:
    action = "resubmitted" if is_resubmission else "submitted"
    queue_notification(
        db,
        user_id=teacher_id,
        title="Assignment submission",
        message=f"{student_name} {action} {assignment_title}.",
        notification_type="submission",
        link="/assignments",
        dedupe_key=(
            f"submission:{submission_id}:{submitted_at.isoformat()}:user:{teacher_id}"
        ),
    )


def notify_grade(
    db: Session,
    *,
    student_id: int,
    assignment_title: str,
    submission_id: int,
    graded_at: datetime,
) -> None:
    queue_notification(
        db,
        user_id=student_id,
        title="Assignment graded",
        message=f"Your grade and feedback for {assignment_title} are available.",
        notification_type="grade",
        link="/assignments",
        dedupe_key=(
            f"grade:{submission_id}:{graded_at.isoformat()}:user:{student_id}"
        ),
    )


def notify_announcement_recipients(
    db: Session,
    *,
    announcement_id: int,
    title: str,
    student_ids: list[int],
) -> None:
    for student_id in student_ids:
        queue_notification(
            db,
            user_id=student_id,
            title="Course announcement",
            message=title,
            notification_type="announcement",
            link="/announcements",
            dedupe_key=f"announcement:{announcement_id}:user:{student_id}",
        )


def _queue_due_deadline_reminders(db: Session, user_id: int) -> None:
    now = datetime.now(timezone.utc)
    due_soon = db.execute(
        select(models.Assignment.id, models.Assignment.title, models.Assignment.due_at)
        .join(
            models.AssignmentRecipient,
            models.AssignmentRecipient.assignment_id == models.Assignment.id,
        )
        .join(
            models.Enrollment,
            (models.Enrollment.course_id == models.Assignment.course_id)
            & (models.Enrollment.student_id == user_id),
        )
        .where(
            models.AssignmentRecipient.student_id == user_id,
            models.Assignment.due_at > now,
            models.Assignment.due_at <= now + timedelta(hours=24),
        )
        .order_by(models.Assignment.due_at.asc())
    ).all()
    for assignment_id, title, due_at in due_soon:
        queue_notification(
            db,
            user_id=user_id,
            title="Assignment due soon",
            message=f"{title} is due within the next 24 hours.",
            notification_type="deadline",
            link="/assignments",
            dedupe_key=(
                f"deadline:{assignment_id}:{due_at.isoformat()}:user:{user_id}"
            ),
        )


def get_user_notifications(db: Session, user_id: int) -> list[models.Notification]:
    _queue_due_deadline_reminders(db, user_id)
    db.commit()
    return db.execute(
        select(models.Notification)
        .where(models.Notification.user_id == user_id)
        .order_by(
            models.Notification.created_at.desc(),
            models.Notification.id.desc(),
        )
        .limit(100)
    ).scalars().all()


def mark_notification_read(
    db: Session, user_id: int, notification_id: int
) -> models.Notification:
    notification = db.scalar(
        select(models.Notification).where(
            models.Notification.id == notification_id,
            models.Notification.user_id == user_id,
        )
    )
    if notification is None:
        raise LookupError("Notification not found.")
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)
    return notification


def mark_all_notifications_read(db: Session, user_id: int) -> None:
    db.execute(
        update(models.Notification)
        .where(
            models.Notification.user_id == user_id,
            models.Notification.is_read.is_(False),
        )
        .values(is_read=True, read_at=datetime.now(timezone.utc))
    )
    db.commit()