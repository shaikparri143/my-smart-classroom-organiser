
import secrets
import string

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

import models
from schemas import CourseCreate


def _teacher_course_response(
    course: models.Course,
    enrollment_count: int,
) -> dict:
    return {
        "id": course.id,
        "course_code": course.course_code,
        "title": course.title,
        "description": course.description,
        "semester": course.semester,
        "section": course.section,
        "attendance_threshold": course.attendance_threshold,
        "teacher_id": course.teacher_id,
        "is_active": course.is_active,
        "created_at": course.created_at,
        "join_code": course.join_code,
        "enrollment_count": enrollment_count,
    }


def generate_join_code(db: Session) -> str:
    """Generate a unique 10-character course join code."""
    alphabet = string.ascii_uppercase + string.digits

    for _ in range(10):
        code = "".join(secrets.choice(alphabet) for _ in range(10))
        existing = db.scalar(
            select(models.Course.id).where(models.Course.join_code == code)
        )
        if existing is None:
            return code

    raise RuntimeError("Could not generate a unique course join code.")


def create_course(
    db: Session,
    teacher: models.User,
    payload: CourseCreate,
) -> dict:
    for _ in range(5):
        try:
            course = models.Course(
                course_code=payload.course_code.strip(),
                title=payload.title.strip(),
                description=payload.description,
                semester=payload.semester.strip(),
                section=payload.section.strip(),
                teacher_id=teacher.id,
                join_code=generate_join_code(db),
                is_active=True,
            )

            db.add(course)
            db.commit()
            db.refresh(course)
            return _teacher_course_response(course, 0)
        except IntegrityError as exc:
            db.rollback()
            constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
            duplicate_course = db.scalar(
                select(models.Course.id).where(
                    models.Course.course_code == payload.course_code.strip(),
                    models.Course.semester == payload.semester.strip(),
                    models.Course.section == payload.section.strip(),
                )
            )
            if duplicate_course is not None:
                raise ValueError(
                    "A course with this code, semester, and section already exists."
                ) from exc
            duplicate_join_code = db.scalar(
                select(models.Course.id).where(
                    models.Course.join_code == course.join_code
                )
            )
            if constraint == "ix_courses_join_code" or duplicate_join_code is not None:
                continue
            raise
        except Exception:
            db.rollback()
            raise

    raise RuntimeError("Could not generate a unique course join code.")


def get_teacher_courses(
    db: Session,
    teacher_id: int,
) -> list[dict]:
    statement = (
        select(models.Course, func.count(models.Enrollment.id).label("enrollment_count"))
        .outerjoin(
            models.Enrollment,
            models.Enrollment.course_id == models.Course.id,
        )
        .where(models.Course.teacher_id == teacher_id)
        .group_by(models.Course.id)
        .order_by(models.Course.created_at.desc())
    )
    return [
        _teacher_course_response(course, enrollment_count)
        for course, enrollment_count in db.execute(statement).all()
    ]


def get_student_courses(
    db: Session,
    student_id: int,
) -> list[dict]:
    statement = (
        select(models.Course, models.User.full_name, models.User.email)
        .join(models.Enrollment, models.Enrollment.course_id == models.Course.id)
        .join(models.User, models.User.id == models.Course.teacher_id)
        .where(models.Enrollment.student_id == student_id)
        .order_by(models.Course.created_at.desc())
    )
    return [
        {
            "id": course.id,
            "course_code": course.course_code,
            "title": course.title,
            "description": course.description,
            "semester": course.semester,
            "section": course.section,
            "attendance_threshold": course.attendance_threshold,
            "teacher_id": course.teacher_id,
            "is_active": course.is_active,
            "created_at": course.created_at,
            "teacher_name": teacher_name,
            "teacher_email": teacher_email,
        }
        for course, teacher_name, teacher_email in db.execute(statement).all()
    ]


def join_course(
    db: Session,
    student: models.User,
    join_code: str,
) -> models.Enrollment:
    normalized_code = join_code.strip().upper()

    course = db.scalar(
        select(models.Course).where(models.Course.join_code == normalized_code)
    )

    if course is None:
        raise ValueError("Invalid join code.")

    if not course.is_active:
        raise ValueError("This course is inactive and cannot be joined.")

    existing = db.scalar(
        select(models.Enrollment).where(
            models.Enrollment.student_id == student.id,
            models.Enrollment.course_id == course.id,
        )
    )

    if existing is not None:
        raise ValueError("You are already enrolled in this course.")

    enrollment = models.Enrollment(
        student_id=student.id,
        course_id=course.id,
    )
    try:
        db.add(enrollment)
        db.commit()
        db.refresh(enrollment)
    except IntegrityError as exc:
        db.rollback()
        existing = db.scalar(
            select(models.Enrollment).where(
                models.Enrollment.student_id == student.id,
                models.Enrollment.course_id == course.id,
            )
        )
        if existing is not None:
            raise ValueError("You are already enrolled in this course.") from exc
        raise
    except Exception:
        db.rollback()
        raise
    return enrollment


def get_course_students(
    db: Session,
    teacher_id: int,
    course_id: int,
) -> list[models.Enrollment]:
    course = db.scalar(
        select(models.Course).where(
            models.Course.id == course_id,
            models.Course.teacher_id == teacher_id,
        )
    )

    if course is None:
        raise LookupError("Course not found.")

    statement = (
        select(models.Enrollment)
        .options(joinedload(models.Enrollment.student))
        .where(models.Enrollment.course_id == course_id)
        .order_by(models.Enrollment.enrolled_at.desc())
    )
    return list(db.scalars(statement).all())
