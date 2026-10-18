from decimal import Decimal
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
from schemas import (
    AssessmentComponentCreate,
    AssessmentComponentUpdate,
    ComponentMarksBatch,
)


def _teacher_course(db: Session, teacher_id: int, course_id: int) -> models.Course:
    course = db.scalar(
        select(models.Course).where(
            models.Course.id == course_id,
            models.Course.teacher_id == teacher_id,
        )
    )
    if course is None:
        raise LookupError("Course not found.")
    return course


def _teacher_component(
    db: Session, teacher_id: int, component_id: int
) -> models.AssessmentComponent:
    component = db.scalar(
        select(models.AssessmentComponent)
        .join(
            models.Course,
            models.Course.id == models.AssessmentComponent.course_id,
        )
        .where(
            models.AssessmentComponent.id == component_id,
            models.Course.teacher_id == teacher_id,
        )
    )
    if component is None:
        raise LookupError("Assessment component not found.")
    return component


def list_course_components(
    db: Session, teacher_id: int, course_id: int
) -> list[models.AssessmentComponent]:
    _teacher_course(db, teacher_id, course_id)
    return list(
        db.scalars(
            select(models.AssessmentComponent)
            .where(models.AssessmentComponent.course_id == course_id)
            .order_by(
                models.AssessmentComponent.display_order,
                models.AssessmentComponent.id,
            )
        ).all()
    )


def get_course_marks(db: Session, teacher_id: int, course_id: int) -> dict:
    course = _teacher_course(db, teacher_id, course_id)
    components = list_course_components(db, teacher_id, course_id)
    return {
        "course_id": course.id,
        "course_code": course.course_code,
        "course_title": course.title,
        "current_max_total": sum(
            (
                component.max_marks
                for component in components
                if not component.is_archived
            ),
            Decimal("0"),
        ),
        "components": [
            {
                "component": component,
                "students": get_component_students(db, teacher_id, component.id),
            }
            for component in components
        ],
    }


def create_component(
    db: Session,
    teacher_id: int,
    course_id: int,
    payload: AssessmentComponentCreate,
) -> models.AssessmentComponent:
    _teacher_course(db, teacher_id, course_id)
    component = models.AssessmentComponent(
        course_id=course_id,
        **payload.model_dump(),
    )
    db.add(component)
    try:
        db.commit()
        db.refresh(component)
    except IntegrityError as exc:
        db.rollback()
        constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
        if constraint == "uq_assessment_course_name":
            raise ValueError("A component with that name already exists in this course.") from exc
        raise
    return component


def update_component(
    db: Session,
    teacher_id: int,
    component_id: int,
    payload: AssessmentComponentUpdate,
) -> models.AssessmentComponent:
    component = _teacher_component(db, teacher_id, component_id)
    changes = payload.model_dump(exclude_unset=True)
    new_maximum = changes.get("max_marks")
    if new_maximum is not None and new_maximum != component.max_marks:
        highest_score = db.scalar(
            select(func.max(models.ComponentMark.score)).where(
                models.ComponentMark.component_id == component.id
            )
        )
        if highest_score is not None and highest_score > new_maximum:
            raise ValueError(
                f"Maximum marks cannot be lower than an existing score ({highest_score:g})."
            )
    if changes.get("is_archived") is True:
        changes["is_published"] = False
    will_be_archived = changes.get("is_archived", component.is_archived)
    will_be_published = changes.get("is_published", component.is_published)
    if will_be_archived and will_be_published:
        raise ValueError("Unarchive this component before publishing it.")
    for field, value in changes.items():
        setattr(component, field, value)
    try:
        db.commit()
        db.refresh(component)
    except IntegrityError as exc:
        db.rollback()
        constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
        if constraint == "uq_assessment_course_name":
            raise ValueError("A component with that name already exists in this course.") from exc
        raise
    return component


def archive_component(
    db: Session, teacher_id: int, component_id: int
) -> models.AssessmentComponent:
    return update_component(
        db,
        teacher_id,
        component_id,
        AssessmentComponentUpdate(is_archived=True, is_published=False),
    )


def get_component_students(
    db: Session, teacher_id: int, component_id: int
) -> list[dict]:
    component = _teacher_component(db, teacher_id, component_id)
    rows = db.execute(
        select(models.User, models.ComponentMark)
        .join(models.Enrollment, models.Enrollment.student_id == models.User.id)
        .outerjoin(
            models.ComponentMark,
            (models.ComponentMark.student_id == models.User.id)
            & (models.ComponentMark.component_id == component.id),
        )
        .where(models.Enrollment.course_id == component.course_id)
        .order_by(models.User.full_name.asc(), models.User.id.asc())
    ).all()
    return [
        {
            "student_id": student.id,
            "student_name": student.full_name,
            "student_email": student.email,
            "score": mark.score if mark is not None else None,
            "feedback": mark.feedback if mark is not None else None,
        }
        for student, mark in rows
    ]


def save_component_marks(
    db: Session,
    teacher_id: int,
    component_id: int,
    payload: ComponentMarksBatch,
) -> list[dict]:
    component = _teacher_component(db, teacher_id, component_id)
    if component.is_archived:
        raise ValueError("Archived components cannot receive marks.")
    requested_ids = {record.student_id for record in payload.records}
    enrolled_ids = set(
        db.execute(
            select(models.Enrollment.student_id).where(
                models.Enrollment.course_id == component.course_id
            )
        ).scalars()
    )
    if not requested_ids.issubset(enrolled_ids):
        raise ValueError("Marks can only be recorded for enrolled students.")
    if any(record.score > component.max_marks for record in payload.records):
        raise ValueError(
            f"Obtained marks cannot exceed the component maximum of {component.max_marks:g}."
        )

    statement = insert(models.ComponentMark).values(
        [
            {
                "component_id": component.id,
                "student_id": record.student_id,
                "graded_by_id": teacher_id,
                "score": record.score,
                "feedback": record.feedback,
            }
            for record in payload.records
        ]
    )
    db.execute(
        statement.on_conflict_do_update(
            constraint="uq_component_mark_student",
            set_={
                "graded_by_id": statement.excluded.graded_by_id,
                "score": statement.excluded.score,
                "feedback": statement.excluded.feedback,
                "updated_at": func.now(),
            },
        )
    )
    db.commit()
    return get_component_students(db, teacher_id, component_id)


def get_student_marks(db: Session, student_id: int) -> list[dict]:
    courses = db.execute(
        select(models.Course)
        .join(models.Enrollment, models.Enrollment.course_id == models.Course.id)
        .where(models.Enrollment.student_id == student_id)
        .order_by(models.Course.title.asc(), models.Course.id.asc())
    ).scalars().all()
    assignment_grades = db.execute(
        select(
            models.Assignment,
            models.Grade,
            models.Submission,
        )
        .join(
            models.Submission,
            models.Submission.assignment_id == models.Assignment.id,
        )
        .join(
            models.Grade,
            models.Grade.submission_id == models.Submission.id,
        )
        .join(
            models.Enrollment,
            (models.Enrollment.course_id == models.Assignment.course_id)
            & (models.Enrollment.student_id == models.Submission.student_id),
        )
        .join(
            models.AssignmentRecipient,
            (models.AssignmentRecipient.assignment_id == models.Assignment.id)
            & (models.AssignmentRecipient.student_id == models.Submission.student_id),
        )
        .where(models.Submission.student_id == student_id)
        .order_by(models.Assignment.created_at, models.Assignment.id)
    ).all()
    assignment_rows_by_course: dict[int, list[tuple[models.Assignment, models.Grade]]] = {}
    for assignment, grade, _submission in assignment_grades:
        assignment_rows_by_course.setdefault(assignment.course_id, []).append(
            (assignment, grade)
        )
    results = []
    for course in courses:
        rows = db.execute(
            select(models.AssessmentComponent, models.ComponentMark)
            .outerjoin(
                models.ComponentMark,
                (models.ComponentMark.component_id == models.AssessmentComponent.id)
                & (models.ComponentMark.student_id == student_id),
            )
            .where(
                models.AssessmentComponent.course_id == course.id,
                models.AssessmentComponent.is_archived.is_(False),
                models.AssessmentComponent.is_published.is_(True),
            )
            .order_by(
                models.AssessmentComponent.display_order,
                models.AssessmentComponent.id,
            )
        ).all()
        component_items = []
        obtained = Decimal("0")
        maximum = Decimal("0")
        graded_count = 0
        for component, mark in rows:
            score = mark.score if mark is not None else None
            if score is not None:
                obtained += score
                maximum += component.max_marks
                graded_count += 1
            component_items.append(
                {
                    "source": "assessment",
                    "component_id": component.id,
                    "name": component.name,
                    "description": component.description,
                    "max_marks": component.max_marks,
                    "assessment_date": component.assessment_date,
                    "instructions": component.instructions,
                    "score": score,
                    "percentage": (
                        round(float(score / component.max_marks * 100), 2)
                        if score is not None
                        else None
                    ),
                    "feedback": mark.feedback if mark is not None else None,
                    "display_order": component.display_order,
                }
            )
        for assignment, grade in assignment_rows_by_course.get(course.id, []):
            score = Decimal(str(grade.score))
            assignment_maximum = Decimal(str(assignment.max_points))
            obtained += score
            maximum += assignment_maximum
            graded_count += 1
            component_items.append(
                {
                    "source": "assignment",
                    "component_id": assignment.id,
                    "name": assignment.title,
                    "description": assignment.description,
                    "max_marks": assignment_maximum,
                    "assessment_date": (
                        assignment.due_at.date()
                        if assignment.due_at is not None
                        else None
                    ),
                    "instructions": None,
                    "score": score,
                    "percentage": (
                        round(float(score / assignment_maximum * 100), 2)
                        if assignment_maximum
                        else None
                    ),
                    "feedback": grade.feedback,
                    "display_order": -1,
                }
            )
        component_items.sort(
            key=lambda item: (
                item["display_order"],
                item["assessment_date"] or date.max,
                item["component_id"],
            )
        )
        results.append(
            {
                "course_id": course.id,
                "course_code": course.course_code,
                "course_title": course.title,
                "components": component_items,
                "total_obtained": obtained,
                "total_maximum": maximum,
                "overall_percentage": (
                    round(float(obtained / maximum * 100), 2)
                    if maximum
                    else None
                ),
                "graded_components": graded_count,
                "available_components": len(rows)
                + len(assignment_rows_by_course.get(course.id, [])),
                "is_in_progress": graded_count
                < len(rows) + len(assignment_rows_by_course.get(course.id, [])),
            }
        )
    return results
