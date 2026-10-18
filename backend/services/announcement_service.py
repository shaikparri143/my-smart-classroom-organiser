from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

import models
from schemas import AnnouncementCreate, AnnouncementUpdate
from services import notification_service


def _announcement_response(
    db: Session, announcement: models.Announcement
) -> dict:
    return {
        "id": announcement.id,
        "course_id": announcement.course_id,
        "created_by_id": announcement.created_by_id,
        "title": announcement.title,
        "content": announcement.content,
        "published_at": announcement.published_at,
        "created_at": announcement.created_at,
        "course_title": announcement.course.title,
        "course_code": announcement.course.course_code,
        "author_name": announcement.created_by.full_name,
        "recipient_student_ids": db.execute(
            select(models.AnnouncementRecipient.student_id)
            .where(models.AnnouncementRecipient.announcement_id == announcement.id)
            .order_by(models.AnnouncementRecipient.student_id)
        ).scalars().all(),
    }


def _course_recipients(
    db: Session,
    course_id: int,
    requested_ids: list[int] | None,
) -> list[int]:
    enrolled_ids = set(
        db.execute(
            select(models.Enrollment.student_id).where(
                models.Enrollment.course_id == course_id
            )
        ).scalars()
    )
    selected_ids = enrolled_ids if requested_ids is None else set(requested_ids)
    if requested_ids is not None and len(selected_ids) != len(requested_ids):
        raise ValueError("Choose each recipient only once.")
    if not selected_ids or not selected_ids.issubset(enrolled_ids):
        raise ValueError("Choose one or more students enrolled in this course.")
    return sorted(selected_ids)


def create_announcement(
    db: Session,
    teacher_id: int,
    payload: AnnouncementCreate,
) -> dict:
    course = db.scalar(
        select(models.Course).where(
            models.Course.id == payload.course_id,
            models.Course.teacher_id == teacher_id,
        )
    )
    if course is None:
        raise LookupError("Course not found.")
    recipient_ids = _course_recipients(
        db, course.id, payload.recipient_student_ids
    )
    announcement = models.Announcement(
        course_id=course.id,
        created_by_id=teacher_id,
        title=payload.title,
        content=payload.content,
        published_at=payload.published_at,
    )
    db.add(announcement)
    db.flush()
    db.add_all(
        models.AnnouncementRecipient(
            announcement_id=announcement.id,
            student_id=student_id,
        )
        for student_id in recipient_ids
    )
    notification_service.notify_announcement_recipients(
        db,
        announcement_id=announcement.id,
        title=announcement.title,
        student_ids=recipient_ids,
    )
    db.commit()
    db.refresh(announcement)
    return _announcement_response(db, announcement)


def get_teacher_announcements(db: Session, teacher_id: int) -> list[dict]:
    announcements = db.execute(
        select(models.Announcement)
        .join(models.Course, models.Course.id == models.Announcement.course_id)
        .options(
            joinedload(models.Announcement.course),
            joinedload(models.Announcement.created_by),
        )
        .where(models.Course.teacher_id == teacher_id)
        .order_by(models.Announcement.created_at.desc())
    ).scalars().all()
    return [_announcement_response(db, item) for item in announcements]


def get_student_announcements(db: Session, student_id: int) -> list[dict]:
    announcements = db.execute(
        select(models.Announcement)
        .join(
            models.AnnouncementRecipient,
            models.AnnouncementRecipient.announcement_id
            == models.Announcement.id,
        )
        .join(models.Course, models.Course.id == models.Announcement.course_id)
        .join(
            models.Enrollment,
            (models.Enrollment.course_id == models.Course.id)
            & (models.Enrollment.student_id == student_id),
        )
        .options(
            joinedload(models.Announcement.course),
            joinedload(models.Announcement.created_by),
        )
        .where(models.AnnouncementRecipient.student_id == student_id)
        .order_by(models.Announcement.created_at.desc())
    ).scalars().unique().all()
    return [_announcement_response(db, item) for item in announcements]


def update_announcement(
    db: Session,
    teacher_id: int,
    announcement_id: int,
    payload: AnnouncementUpdate,
) -> dict:
    announcement = db.scalar(
        select(models.Announcement)
        .join(models.Course, models.Course.id == models.Announcement.course_id)
        .options(
            joinedload(models.Announcement.course),
            joinedload(models.Announcement.created_by),
        )
        .where(
            models.Announcement.id == announcement_id,
            models.Course.teacher_id == teacher_id,
        )
    )
    if announcement is None:
        raise LookupError("Announcement not found.")
    changes = payload.model_dump(exclude_unset=True)
    has_recipient_changes = "recipient_student_ids" in changes
    recipient_ids = changes.pop("recipient_student_ids", None)
    for field, value in changes.items():
        setattr(announcement, field, value)

    if has_recipient_changes:
        selected_ids = _course_recipients(
            db, announcement.course_id, recipient_ids
        )
        previous_ids = set(
            db.execute(
                select(models.AnnouncementRecipient.student_id).where(
                    models.AnnouncementRecipient.announcement_id == announcement.id
                )
            ).scalars()
        )
        db.execute(
            delete(models.AnnouncementRecipient).where(
                models.AnnouncementRecipient.announcement_id == announcement.id
            )
        )
        db.add_all(
            models.AnnouncementRecipient(
                announcement_id=announcement.id,
                student_id=student_id,
            )
            for student_id in selected_ids
        )
        notification_service.notify_announcement_recipients(
            db,
            announcement_id=announcement.id,
            title=announcement.title,
            student_ids=sorted(set(selected_ids) - previous_ids),
        )
    db.commit()
    db.refresh(announcement)
    return _announcement_response(db, announcement)


def delete_announcement(
    db: Session, teacher_id: int, announcement_id: int
) -> None:
    announcement = db.scalar(
        select(models.Announcement)
        .join(models.Course, models.Course.id == models.Announcement.course_id)
        .where(
            models.Announcement.id == announcement_id,
            models.Course.teacher_id == teacher_id,
        )
    )
    if announcement is None:
        raise LookupError("Announcement not found.")
    db.delete(announcement)
    db.commit()
