from datetime import date, datetime, time, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
from database import get_db
from dependencies import CurrentUser
from schemas import (
    CalendarEventCreate,
    TimetableEntryCreate,
    TimetableEntryResponse,
    TimetablePreferenceCreate,
    TimetablePreferenceResponse,
)

router = APIRouter(prefix="/api/calendar", tags=["Calendar"])
DbSession = Annotated[Session, Depends(get_db)]


def _serialize_timetable_entry(entry: models.TimetableEntry) -> dict:
    return {
        "id": entry.id,
        "user_id": entry.user_id,
        "course_id": entry.course_id,
        "title": entry.title,
        "weekday": entry.weekday,
        "day_order": entry.day_order,
        "start_time": entry.start_time,
        "end_time": entry.end_time,
        "location": entry.location,
        "notes": entry.notes,
        "is_active": entry.is_active,
        "created_at": entry.created_at.isoformat(),
        "updated_at": entry.updated_at.isoformat(),
    }


def _course_ids_for_user(db: Session, user: models.User) -> list[int]:
    if user.role == "teacher":
        courses = db.scalars(
            select(models.Course).where(models.Course.teacher_id == user.id)
        ).all()
        return [course.id for course in courses]
    if user.role == "student":
        enrollments = db.scalars(
            select(models.Enrollment).where(models.Enrollment.student_id == user.id)
        ).all()
        return [enrollment.course_id for enrollment in enrollments]
    return []


@router.get("/preferences")
def get_preferences(db: DbSession, user: CurrentUser):
    preference = db.scalar(
        select(models.TimetablePreference).where(
            models.TimetablePreference.user_id == user.id
        )
    )

    if preference is None:
        return {
            "configured": False,
            "timetable_mode": "weekly",
            "day_order_count": 1,
            "teaching_weekdays": [1, 2, 3, 4, 5],
            "first_teaching_date": None,
            "first_day_order": 1,
            "holiday_policy": "skip",
        }

    return {
        "configured": True,
        "id": preference.id,
        "user_id": preference.user_id,
        "timetable_mode": preference.timetable_mode,
        "day_order_count": preference.day_order_count,
        "teaching_weekdays": preference.teaching_weekdays or [1, 2, 3, 4, 5],
        "first_teaching_date": preference.first_teaching_date.isoformat() if preference.first_teaching_date else None,
        "first_day_order": preference.first_day_order,
        "holiday_policy": preference.holiday_policy,
    }


@router.post("/preferences")
def save_preferences(
    payload: TimetablePreferenceCreate,
    db: DbSession,
    user: CurrentUser,
):
    if payload.timetable_mode == "day_order" and payload.first_teaching_date is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The first teaching date is required for the day-order timetable.",
        )

    preference = db.scalar(
        select(models.TimetablePreference).where(
            models.TimetablePreference.user_id == user.id
        )
    )

    if preference is None:
        preference = models.TimetablePreference(user_id=user.id)
        db.add(preference)

    preference.timetable_mode = payload.timetable_mode
    preference.day_order_count = payload.day_order_count
    preference.teaching_weekdays = payload.teaching_weekdays
    preference.first_teaching_date = payload.first_teaching_date
    preference.first_day_order = payload.first_day_order
    preference.holiday_policy = payload.holiday_policy

    db.commit()
    db.refresh(preference)
    return {
        "configured": True,
        "id": preference.id,
        "user_id": preference.user_id,
        "timetable_mode": preference.timetable_mode,
        "day_order_count": preference.day_order_count,
        "teaching_weekdays": preference.teaching_weekdays,
        "first_teaching_date": preference.first_teaching_date.isoformat() if preference.first_teaching_date else None,
        "first_day_order": preference.first_day_order,
        "holiday_policy": preference.holiday_policy,
    }


@router.get("/timetable")
def list_timetable_entries(
    db: DbSession,
    user: CurrentUser,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
):
    entries = db.scalars(
        select(models.TimetableEntry)
        .where(models.TimetableEntry.user_id == user.id, models.TimetableEntry.is_active.is_(True))
        .order_by(models.TimetableEntry.weekday.asc(), models.TimetableEntry.start_time.asc(), models.TimetableEntry.day_order.asc())
    ).all()

    if start_date is None and end_date is None:
        return [_serialize_timetable_entry(entry) for entry in entries]

    start = start_date or date.today()
    end = end_date or start
    filtered = []
    for entry in entries:
        if entry.weekday is not None:
            current = start
            while current <= end:
                if current.weekday() == entry.weekday:
                    filtered.append(_serialize_timetable_entry(entry))
                    break
                current += timedelta(days=1)
        elif entry.day_order is not None:
            if entry.day_order >= 1:
                filtered.append(_serialize_timetable_entry(entry))
    return filtered


@router.post("/timetable", status_code=status.HTTP_201_CREATED)
def create_timetable_entry(
    payload: TimetableEntryCreate,
    db: DbSession,
    user: CurrentUser,
):
    if payload.weekday is None and payload.day_order is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either a weekday or a day order.",
        )
    if payload.weekday is not None and payload.day_order is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use either a weekday or a day order, not both.",
        )

    if payload.course_id is not None:
        allowed_course_ids = set(_course_ids_for_user(db, user))
        if payload.course_id not in allowed_course_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to that course.",
            )

    entry = models.TimetableEntry(
        user_id=user.id,
        course_id=payload.course_id,
        title=payload.title,
        weekday=payload.weekday,
        day_order=payload.day_order,
        start_time=payload.start_time,
        end_time=payload.end_time,
        location=payload.location,
        notes=payload.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _serialize_timetable_entry(entry)


@router.put("/timetable/{entry_id}")
def update_timetable_entry(
    entry_id: int,
    payload: TimetableEntryCreate,
    db: DbSession,
    user: CurrentUser,
):
    entry = db.get(models.TimetableEntry, entry_id)
    if entry is None or entry.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Timetable entry not found.",
        )

    if payload.course_id is not None:
        allowed_course_ids = set(_course_ids_for_user(db, user))
        if payload.course_id not in allowed_course_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to that course.",
            )

    entry.title = payload.title
    entry.weekday = payload.weekday
    entry.day_order = payload.day_order
    entry.start_time = payload.start_time
    entry.end_time = payload.end_time
    entry.location = payload.location
    entry.notes = payload.notes
    entry.course_id = payload.course_id
    db.commit()
    db.refresh(entry)
    return _serialize_timetable_entry(entry)


@router.delete("/timetable/{entry_id}")
def delete_timetable_entry(entry_id: int, db: DbSession, user: CurrentUser):
    entry = db.get(models.TimetableEntry, entry_id)
    if entry is None or entry.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Timetable entry not found.",
        )
    db.delete(entry)
    db.commit()
    return {"deleted": True, "entry_id": entry_id}


@router.get("/events")
def list_calendar_events(
    db: DbSession,
    user: CurrentUser,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
):
    start = start_date or date.today() - timedelta(days=30)
    end = end_date or date.today() + timedelta(days=180)
    course_ids = _course_ids_for_user(db, user)

    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(end, time.max, tzinfo=timezone.utc)

    custom_events = []
    if course_ids:
        custom_events = db.scalars(
            select(models.CalendarEvent)
            .where(
                (
                    (models.CalendarEvent.created_by_id == user.id)
                    | (models.CalendarEvent.course_id.in_(course_ids))
                ),
                models.CalendarEvent.start_at <= end_dt,
                models.CalendarEvent.end_at >= start_dt,
            )
            .order_by(models.CalendarEvent.start_at.asc())
        ).all()
    else:
        custom_events = db.scalars(
            select(models.CalendarEvent)
            .where(
                models.CalendarEvent.created_by_id == user.id,
                models.CalendarEvent.start_at <= end_dt,
                models.CalendarEvent.end_at >= start_dt,
            )
            .order_by(models.CalendarEvent.start_at.asc())
        ).all()

    results = []
    for event in custom_events:
        course = db.get(models.Course, event.course_id) if event.course_id else None
        results.append(
            {
                "id": f"event-{event.id}",
                "title": event.title,
                "description": event.description,
                "event_type": event.event_type,
                "start_at": event.start_at.isoformat(),
                "end_at": event.end_at.isoformat(),
                "course_id": event.course_id,
                "course_code": course.course_code if course else None,
                "created_by_id": event.created_by_id,
            }
        )

    assignments = []
    if course_ids:
        assignments = db.scalars(
            select(models.Assignment)
            .where(
                models.Assignment.course_id.in_(course_ids),
                models.Assignment.due_at.is_not(None),
                models.Assignment.due_at >= start_dt,
                models.Assignment.due_at <= end_dt,
            )
            .order_by(models.Assignment.due_at.asc())
        ).all()

    for assignment in assignments:
        course = db.get(models.Course, assignment.course_id)
        results.append(
            {
                "id": f"assignment-{assignment.id}",
                "title": assignment.title,
                "description": assignment.description or (course.title if course else "Assignment deadline"),
                "event_type": "assignment",
                "start_at": assignment.due_at.isoformat() if assignment.due_at else None,
                "end_at": assignment.due_at.isoformat() if assignment.due_at else None,
                "course_id": assignment.course_id,
                "course_code": course.course_code if course else None,
                "created_by_id": assignment.created_by_id,
            }
        )

    return sorted(results, key=lambda item: item["start_at"] or "")


@router.post("/events", status_code=status.HTTP_201_CREATED)
def create_calendar_event(
    payload: CalendarEventCreate,
    db: DbSession,
    user: CurrentUser,
):
    if payload.course_id is not None:
        allowed_course_ids = set(_course_ids_for_user(db, user))
        if payload.course_id not in allowed_course_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to that course.",
            )

    event = models.CalendarEvent(
        course_id=payload.course_id,
        created_by_id=user.id,
        title=payload.title,
        description=payload.description,
        event_type=payload.event_type,
        start_at=payload.start_at,
        end_at=payload.end_at,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    course = db.get(models.Course, event.course_id) if event.course_id else None
    return {
        "id": f"event-{event.id}",
        "course_id": event.course_id,
        "created_by_id": event.created_by_id,
        "title": event.title,
        "description": event.description,
        "event_type": event.event_type,
        "start_at": event.start_at.isoformat(),
        "end_at": event.end_at.isoformat(),
        "course_code": course.course_code if course else None,
    }


@router.delete("/events/{event_id}")
def delete_calendar_event(event_id: int, db: DbSession, user: CurrentUser):
    event = db.get(models.CalendarEvent, event_id)
    if event is None or (event.created_by_id != user.id and event.course_id not in _course_ids_for_user(db, user)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar event not found.",
        )
    db.delete(event)
    db.commit()
    return {"deleted": True, "event_id": event_id}
