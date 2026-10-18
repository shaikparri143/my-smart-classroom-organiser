import mimetypes
import shutil
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
from config import settings
from services import notification_service
from schemas import AssignmentCreate, GradeCreate, SubmissionCreate


MAX_UPLOAD_SIZE = 10 * 1024 * 1024
MAX_UPLOADS_PER_SUBMISSION = 5
MAX_LINKS_PER_SUBMISSION = 10
ALLOWED_UPLOAD_TYPES = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".pdf", ".doc", ".docx",
    ".odt", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf", ".csv",
}


def _assignment_list_query():
    return (
        select(
            models.Assignment,
            models.Course.title,
            models.Course.course_code,
        )
        .join(models.Course, models.Course.id == models.Assignment.course_id)
    )


def _assignment_list_response(rows) -> list[dict]:
    return [
        {
            "id": assignment.id,
            "course_id": assignment.course_id,
            "created_by_id": assignment.created_by_id,
            "title": assignment.title,
            "description": assignment.description,
            "due_at": assignment.due_at,
            "max_points": assignment.max_points,
            "attachment_url": assignment.attachment_url,
            "created_at": assignment.created_at,
            "updated_at": assignment.updated_at,
            "course_title": course_title,
            "course_code": course_code,
        }
        for assignment, course_title, course_code in rows
    ]


def create_assignment(
    db: Session,
    teacher: models.User,
    payload: AssignmentCreate,
) -> models.Assignment:
    course = db.scalar(
        select(models.Course).where(
            models.Course.id == payload.course_id,
            models.Course.teacher_id == teacher.id,
        )
    )
    if course is None:
        raise LookupError("Course not found.")

    students = list(
        db.scalars(
            select(models.Enrollment.student_id).where(
                models.Enrollment.course_id == course.id
            )
        ).all()
    )
    selected_ids = set(payload.recipient_student_ids)
    if len(selected_ids) != len(payload.recipient_student_ids):
        raise ValueError("Choose each student only once.")
    if not selected_ids.issubset(set(students)):
        raise ValueError("All assignment recipients must be enrolled in this course.")

    assignment = models.Assignment(
        course_id=course.id,
        created_by_id=teacher.id,
        title=payload.title,
        description=payload.description,
        due_at=payload.due_at,
        max_points=payload.max_points,
        attachment_url=payload.attachment_url,
    )
    try:
        db.add(assignment)
        db.flush()
        db.add_all(
            models.AssignmentRecipient(
                assignment_id=assignment.id,
                student_id=student_id,
            )
            for student_id in selected_ids
        )
        notification_service.notify_assignment_recipients(
            db, assignment, sorted(selected_ids)
        )
        db.commit()
        db.refresh(assignment)
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(
            "The assignment could not be created because the course changed. Please try again."
        ) from exc
    except Exception:
        db.rollback()
        raise
    return assignment


def get_teacher_assignments(db: Session, teacher_id: int) -> list[dict]:
    statement = (
        _assignment_list_query()
        .where(models.Course.teacher_id == teacher_id)
        .order_by(models.Assignment.due_at.asc(), models.Assignment.created_at.desc())
    )
    return _assignment_list_response(db.execute(statement).all())


def get_student_assignments(db: Session, student_id: int) -> list[dict]:
    statement = (
        select(
            models.Assignment,
            models.Course.title,
            models.Course.course_code,
            models.Submission,
            models.Grade,
        )
        .join(models.Course, models.Course.id == models.Assignment.course_id)
        .join(
            models.Enrollment,
            models.Enrollment.course_id == models.Course.id,
        )
        .outerjoin(
            models.Submission,
            (models.Submission.assignment_id == models.Assignment.id)
            & (models.Submission.student_id == student_id),
        )
        .outerjoin(models.Grade, models.Grade.submission_id == models.Submission.id)
        .join(
            models.AssignmentRecipient,
            models.AssignmentRecipient.assignment_id == models.Assignment.id,
        )
        .where(
            models.Enrollment.student_id == student_id,
            models.AssignmentRecipient.student_id == student_id,
        )
        .order_by(models.Assignment.due_at.asc(), models.Assignment.created_at.desc())
    )
    results = []
    submission_ids = []
    for assignment, course_title, course_code, submission, grade in db.execute(statement):
        item = _assignment_list_response(
            [(assignment, course_title, course_code)]
        )[0]
        item["submission"] = submission
        item["grade"] = grade
        results.append(item)
        if submission is not None:
            submission_ids.append(submission.id)
    resources_by_submission = _get_submission_resources(db, submission_ids)
    for item in results:
        submission = item["submission"]
        item["resources"] = (
            resources_by_submission.get(submission.id, [])
            if submission is not None
            else []
        )
    return results


def _resource_response(resource: models.SubmissionResource) -> dict:
    return {
        "id": resource.id,
        "kind": resource.kind,
        "name": resource.name,
        "external_url": resource.external_url,
        "content_type": resource.content_type,
        "size_bytes": resource.size_bytes,
        "download_url": (
            f"/api/assignments/submissions/{resource.submission_id}"
            f"/attachments/{resource.id}"
            if resource.kind == "file"
            else None
        ),
    }


def _get_submission_resources(
    db: Session,
    submission_ids: list[int],
) -> dict[int, list[dict]]:
    if not submission_ids:
        return {}
    resources = db.scalars(
        select(models.SubmissionResource)
        .where(models.SubmissionResource.submission_id.in_(submission_ids))
        .order_by(models.SubmissionResource.id.asc())
    ).all()
    result: dict[int, list[dict]] = {}
    for resource in resources:
        result.setdefault(resource.submission_id, []).append(
            _resource_response(resource)
        )
    return result


def get_course_assignments(
    db: Session,
    user: models.User,
    course_id: int,
) -> list[dict]:
    course = db.scalar(
        select(models.Course).where(models.Course.id == course_id)
    )
    if course is None:
        raise LookupError("Course not found.")

    if user.role == "teacher":
        has_access = course.teacher_id == user.id
    elif user.role == "student":
        has_access = db.scalar(
            select(models.Enrollment.id)
            .join(
                models.AssignmentRecipient,
                models.AssignmentRecipient.student_id
                == models.Enrollment.student_id,
            )
            .join(
                models.Assignment,
                models.Assignment.id
                == models.AssignmentRecipient.assignment_id,
            )
            .where(
                models.Enrollment.course_id == course_id,
                models.Enrollment.student_id == user.id,
                models.Assignment.course_id == course_id,
            )
        ) is not None
    else:
        has_access = False

    if not has_access:
        raise LookupError("Course not found.")

    statement = (
        _assignment_list_query()
        .where(models.Assignment.course_id == course_id)
        .order_by(models.Assignment.due_at.asc(), models.Assignment.created_at.desc())
    )
    if user.role == "student":
        statement = statement.join(
            models.AssignmentRecipient,
            (models.AssignmentRecipient.assignment_id == models.Assignment.id)
            & (models.AssignmentRecipient.student_id == user.id),
        )
    return _assignment_list_response(db.execute(statement).all())


def get_course_students_for_assignment(
    db: Session,
    teacher_id: int,
    course_id: int,
) -> list[dict]:
    course_exists = db.scalar(
        select(models.Course.id).where(
            models.Course.id == course_id,
            models.Course.teacher_id == teacher_id,
        )
    )
    if course_exists is None:
        raise LookupError("Course not found.")
    statement = (
        select(models.User.id, models.User.full_name, models.User.email)
        .join(models.Enrollment, models.Enrollment.student_id == models.User.id)
        .where(models.Enrollment.course_id == course_id)
        .order_by(models.User.full_name.asc(), models.User.id.asc())
    )
    return [
        {"id": student_id, "full_name": full_name, "email": email}
        for student_id, full_name, email in db.execute(statement).all()
    ]


def update_assignment_recipients(
    db: Session,
    teacher_id: int,
    assignment_id: int,
    recipient_student_ids: list[int],
) -> None:
    assignment = db.scalar(
        select(models.Assignment)
        .join(models.Course, models.Course.id == models.Assignment.course_id)
        .where(
            models.Assignment.id == assignment_id,
            models.Course.teacher_id == teacher_id,
        )
    )
    if assignment is None:
        raise LookupError("Assignment not found.")
    selected_ids = set(recipient_student_ids)
    if len(selected_ids) != len(recipient_student_ids):
        raise ValueError("Choose each student only once.")
    enrolled_ids = set(
        db.scalars(
            select(models.Enrollment.student_id).where(
                models.Enrollment.course_id == assignment.course_id
            )
        ).all()
    )
    if not selected_ids.issubset(enrolled_ids):
        raise ValueError("All assignment recipients must be enrolled in this course.")

    existing_ids = set(
        db.scalars(
            select(models.AssignmentRecipient.student_id).where(
                models.AssignmentRecipient.assignment_id == assignment_id
            )
        ).all()
    )
    removed_ids = existing_ids - selected_ids
    if removed_ids:
        protected_ids = set(
            db.scalars(
                select(models.Submission.student_id).where(
                    models.Submission.assignment_id == assignment_id,
                    models.Submission.student_id.in_(removed_ids),
                )
            ).all()
        )
        selected_ids.update(protected_ids)
    added_ids = selected_ids - existing_ids

    try:
        for student_id in added_ids:
            db.add(
                models.AssignmentRecipient(
                    assignment_id=assignment_id,
                    student_id=student_id,
                )
            )
        for student_id in existing_ids - selected_ids:
            db.delete(
                db.get(
                    models.AssignmentRecipient,
                    (assignment_id, student_id),
                )
            )
        notification_service.notify_assignment_recipients(
            db, assignment, sorted(added_ids)
        )
        db.commit()
    except Exception:
        db.rollback()
        raise


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _submission_status(
    due_at: datetime | None,
    submitted_at: datetime,
    *,
    is_resubmission: bool,
) -> str:
    if is_resubmission:
        return "resubmitted"
    if due_at is None:
        return "submitted"
    if due_at.tzinfo is None:
        due_at = due_at.replace(tzinfo=timezone.utc)
    return "late" if submitted_at > due_at else "submitted"


def submit_assignment(
    db: Session,
    student: models.User,
    assignment_id: int,
    payload: SubmissionCreate,
) -> models.Submission:
    assignment = db.get(models.Assignment, assignment_id)
    if assignment is None:
        raise LookupError("Assignment not found.")

    is_enrolled = db.scalar(
        select(models.Enrollment.id).where(
            models.Enrollment.course_id == assignment.course_id,
            models.Enrollment.student_id == student.id,
        )
    )
    if is_enrolled is None:
        raise LookupError("Assignment not found.")
    is_recipient = db.get(
        models.AssignmentRecipient,
        (assignment_id, student.id),
    )
    if is_recipient is None:
        raise LookupError("Assignment not found.")

    submission = db.scalar(
        select(models.Submission).where(
            models.Submission.assignment_id == assignment_id,
            models.Submission.student_id == student.id,
        )
    )
    submitted_at = _utc_now()
    is_resubmission = submission is not None
    if submission is not None and submission.grade is not None:
        raise ValueError("This submission is locked because it has been graded.")

    try:
        if submission is None:
            submission = models.Submission(
                assignment_id=assignment_id,
                student_id=student.id,
            )
            db.add(submission)
        elif submission.grade is not None:
            db.delete(submission.grade)

        submission.text_response = payload.text_response
        submission.file_url = payload.file_url
        submission.status = _submission_status(
            assignment.due_at,
            submitted_at,
            is_resubmission=is_resubmission,
        )
        submission.submitted_at = submitted_at
        submission.updated_at = submitted_at
        db.flush()
        teacher_id = db.scalar(
            select(models.Course.teacher_id).where(
                models.Course.id == assignment.course_id
            )
        )
        notification_service.notify_submission(
            db,
            teacher_id=teacher_id,
            student_name=student.full_name,
            assignment_title=assignment.title,
            submission_id=submission.id,
            submitted_at=submitted_at,
            is_resubmission=is_resubmission,
        )
        db.commit()
        db.refresh(submission)
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(
            "The submission was updated at the same time. Refresh and try again."
        ) from exc
    except Exception:
        db.rollback()
        raise
    return submission


def _validate_file_content(extension: str, path: Path) -> str:
    mime_type = mimetypes.guess_type(f"file{extension}")[0]
    valid = False
    with path.open("rb") as uploaded_file:
        content = uploaded_file.read(512)
    if extension in {".jpg", ".jpeg"}:
        valid = content.startswith(b"\xff\xd8\xff")
    elif extension == ".png":
        valid = content.startswith(b"\x89PNG\r\n\x1a\n")
    elif extension == ".gif":
        valid = content.startswith((b"GIF87a", b"GIF89a"))
    elif extension == ".webp":
        valid = len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP"
    elif extension == ".bmp":
        dib_header_size = (
            int.from_bytes(content[14:18], "little")
            if len(content) >= 18
            else 0
        )
        valid = (
            content.startswith(b"BM")
            and len(content) >= 26
            and dib_header_size in {12, 40, 52, 56, 64, 108, 124}
        )
    elif extension == ".pdf":
        valid = content.startswith(b"%PDF-")
    elif extension == ".doc":
        valid = content.startswith(bytes.fromhex("D0CF11E0A1B11AE1"))
    elif extension in {".docx", ".xlsx", ".pptx", ".odt"}:
        try:
            with zipfile.ZipFile(path) as archive:
                names = set(archive.namelist())
            required = {
                ".docx": "word/document.xml",
                ".xlsx": "xl/workbook.xml",
                ".pptx": "ppt/presentation.xml",
                ".odt": "mimetype",
            }[extension]
            valid = required in names
        except (KeyError, zipfile.BadZipFile):
            valid = False
    elif extension in {".xls", ".ppt"}:
        valid = content.startswith(bytes.fromhex("D0CF11E0A1B11AE1"))
    elif extension in {".txt", ".csv", ".rtf"}:
        try:
            decoded = content.decode("utf-8-sig")
            valid = extension != ".rtf" or decoded.lstrip().startswith(r"{\rtf")
        except UnicodeDecodeError:
            valid = False

    if not valid:
        raise ValueError(f"The file contents do not match the {extension} file type.")
    return mime_type or "application/octet-stream"


async def submit_assignment_resources(
    db: Session,
    student: models.User,
    assignment_id: int,
    text_response: str | None,
    links: list[str],
    files: list[UploadFile],
    keep_resource_ids: list[int] | None = None,
) -> models.Submission:
    keep_resource_ids = set(keep_resource_ids or [])
    if len(files) > MAX_UPLOADS_PER_SUBMISSION:
        raise ValueError(f"You can attach up to {MAX_UPLOADS_PER_SUBMISSION} files.")
    if len(links) > MAX_LINKS_PER_SUBMISSION:
        raise ValueError(f"You can submit up to {MAX_LINKS_PER_SUBMISSION} links.")
    normalized_links = []
    for link in links:
        link = link.strip()
        if len(link) > 2000:
            raise ValueError("Each submitted link must be no longer than 2000 characters.")
        parsed = urlparse(link)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Each submitted link must be a valid http or https URL.")
        normalized_links.append(link)
    normalized_text = text_response.strip() if text_response else None
    if normalized_text and len(normalized_text) > 50000:
        raise ValueError("A written response cannot exceed 50000 characters.")
    if not normalized_text and not normalized_links and not files:
        raise ValueError("Add a written answer, a link, or at least one file.")

    assignment = db.get(models.Assignment, assignment_id)
    if assignment is None:
        raise LookupError("Assignment not found.")
    is_enrolled = db.scalar(
        select(models.Enrollment.id).where(
            models.Enrollment.course_id == assignment.course_id,
            models.Enrollment.student_id == student.id,
        )
    )
    is_recipient = db.get(
        models.AssignmentRecipient,
        (assignment_id, student.id),
    )
    if is_enrolled is None or is_recipient is None:
        raise LookupError("Assignment not found.")

    submission = db.scalar(
        select(models.Submission).where(
            models.Submission.assignment_id == assignment_id,
            models.Submission.student_id == student.id,
        )
    )
    if submission is not None and submission.grade is not None:
        raise ValueError("This submission is locked because it has been graded.")
    existing_file_ids = {
        resource.id
        for resource in submission.resources
        if resource.kind == "file"
    } if submission is not None else set()
    if not keep_resource_ids.issubset(existing_file_ids):
        raise ValueError("One or more attachments cannot be retained.")
    if len(keep_resource_ids) + len(files) > MAX_UPLOADS_PER_SUBMISSION:
        raise ValueError(
            f"You can attach up to {MAX_UPLOADS_PER_SUBMISSION} files in total."
        )

    storage_dir = settings.SUBMISSION_UPLOAD_DIR.resolve()
    staging_dir = storage_dir / ".staging"
    staged_paths: list[Path] = []
    old_paths: list[Path] = []
    new_final_paths: list[Path] = []
    resource_rows: list[models.SubmissionResource] = []
    committed = False
    storage_dir.mkdir(parents=True, exist_ok=True)
    staging_dir.mkdir(parents=True, exist_ok=True)

    try:
        for upload in files:
            raw_name = Path((upload.filename or "attachment").replace("\\", "/")).name
            extension = Path(raw_name).suffix.lower()
            if extension not in ALLOWED_UPLOAD_TYPES:
                raise ValueError(f"Unsupported file type: {extension or 'unknown'}.")
            staged_path = staging_dir / f"{uuid.uuid4().hex}.upload"
            staged_paths.append(staged_path)
            total_bytes = 0
            with staged_path.open("wb") as staged_file:
                while chunk := await upload.read(64 * 1024):
                    total_bytes += len(chunk)
                    if total_bytes > MAX_UPLOAD_SIZE:
                        raise ValueError(
                            f"Each file must be no larger than {MAX_UPLOAD_SIZE // (1024 * 1024)} MB."
                        )
                    staged_file.write(chunk)
            content_type = _validate_file_content(extension, staged_path)
            storage_key = f"{uuid.uuid4().hex}{extension}"
            final_path = storage_dir / storage_key
            new_final_paths.append(final_path)
            resource_rows.append(
                models.SubmissionResource(
                    kind="file",
                    name=raw_name[:255],
                    storage_key=storage_key,
                    content_type=content_type,
                    size_bytes=total_bytes,
                )
            )

        now = _utc_now()
        is_resubmission = submission is not None
        if submission is None:
            submission = models.Submission(
                assignment_id=assignment_id,
                student_id=student.id,
            )
            db.add(submission)
            db.flush()
        else:
            for old_resource in list(submission.resources):
                if (
                    old_resource.kind == "file"
                    and old_resource.id in keep_resource_ids
                ):
                    continue
                if old_resource.storage_key:
                    old_path = storage_dir / old_resource.storage_key
                    old_paths.append(old_path)
                db.delete(old_resource)

        submission.text_response = normalized_text
        submission.file_url = None
        submission.status = _submission_status(
            assignment.due_at,
            now,
            is_resubmission=is_resubmission,
        )
        submission.submitted_at = now
        submission.updated_at = now
        resource_index = 0
        for link in normalized_links:
            resource_rows.insert(
                resource_index,
                models.SubmissionResource(
                    submission_id=submission.id,
                    kind="link",
                    name=link[:255],
                    external_url=link,
                ),
            )
            resource_index += 1
        for resource in resource_rows:
            resource.submission_id = submission.id
            db.add(resource)

        for staged_path, final_path in zip(staged_paths, new_final_paths):
            shutil.move(str(staged_path), str(final_path))
        teacher_id = db.scalar(
            select(models.Course.teacher_id).where(
                models.Course.id == assignment.course_id
            )
        )
        notification_service.notify_submission(
            db,
            teacher_id=teacher_id,
            student_name=student.full_name,
            assignment_title=assignment.title,
            submission_id=submission.id,
            submitted_at=now,
            is_resubmission=is_resubmission,
        )
        db.commit()
        committed = True
        db.refresh(submission)
    except IntegrityError as exc:
        db.rollback()
        raise ValueError(
            "The submission changed at the same time. Refresh and try again."
        ) from exc
    except Exception:
        db.rollback()
        raise
    finally:
        for staged_path in staged_paths:
            staged_path.unlink(missing_ok=True)
        paths_to_remove = old_paths if committed else new_final_paths
        for path in paths_to_remove:
            path.unlink(missing_ok=True)

    return submission


def get_assignment_submissions(
    db: Session,
    teacher_id: int,
    assignment_id: int,
) -> list[dict]:
    assignment = db.scalar(
        select(models.Assignment)
        .join(models.Course, models.Course.id == models.Assignment.course_id)
        .where(
            models.Assignment.id == assignment_id,
            models.Course.teacher_id == teacher_id,
        )
    )
    if assignment is None:
        raise LookupError("Assignment not found.")

    statement = (
        select(models.User, models.Submission, models.Grade)
        .join(
            models.Enrollment,
            models.Enrollment.student_id == models.User.id,
        )
        .join(
            models.AssignmentRecipient,
            (models.AssignmentRecipient.student_id == models.User.id)
            & (models.AssignmentRecipient.assignment_id == assignment_id),
        )
        .outerjoin(
            models.Submission,
            (models.Submission.student_id == models.User.id)
            & (models.Submission.assignment_id == assignment_id),
        )
        .outerjoin(models.Grade, models.Grade.submission_id == models.Submission.id)
        .where(models.Enrollment.course_id == assignment.course_id)
        .order_by(models.User.full_name.asc(), models.User.id.asc())
    )
    rows = [
        {
            "student_id": student.id,
            "student_name": student.full_name,
            "student_email": student.email,
            "submission": submission,
            "grade": grade,
            "resources": [],
        }
        for student, submission, grade in db.execute(statement).all()
    ]
    resources_by_submission = _get_submission_resources(
        db,
        [
            row["submission"].id
            for row in rows
            if row["submission"] is not None
        ],
    )
    for row in rows:
        if row["submission"] is not None:
            row["resources"] = resources_by_submission.get(
                row["submission"].id,
                [],
            )
    return rows


def grade_submission(
    db: Session,
    teacher: models.User,
    submission_id: int,
    payload: GradeCreate,
) -> models.Grade:
    row = db.execute(
        select(models.Submission, models.Assignment)
        .join(
            models.Assignment,
            models.Assignment.id == models.Submission.assignment_id,
        )
        .join(models.Course, models.Course.id == models.Assignment.course_id)
        .where(
            models.Submission.id == submission_id,
            models.Course.teacher_id == teacher.id,
        )
    ).first()
    if row is None:
        raise LookupError("Submission not found.")

    submission, assignment = row
    if payload.score > assignment.max_points:
        raise ValueError(
            f"Score cannot exceed the assignment maximum of {assignment.max_points:g}."
        )

    grade = db.scalar(
        select(models.Grade).where(
            models.Grade.submission_id == submission_id
        )
    )
    now = _utc_now()
    try:
        if grade is None:
            grade = models.Grade(
                submission_id=submission_id,
                graded_by_id=teacher.id,
                score=payload.score,
                feedback=payload.feedback,
            )
            db.add(grade)
        else:
            grade.graded_by_id = teacher.id
            grade.score = payload.score
            grade.feedback = payload.feedback
        grade.graded_at = now
        notification_service.notify_grade(
            db,
            student_id=submission.student_id,
            assignment_title=assignment.title,
            submission_id=submission.id,
            graded_at=now,
        )
        db.commit()
        db.refresh(grade)
    except Exception:
        db.rollback()
        raise
    return grade


def get_submission_attachment(
    db: Session,
    user: models.User,
    submission_id: int,
    resource_id: int,
) -> tuple[Path, str, str]:
    row = db.execute(
        select(
            models.SubmissionResource,
            models.Submission,
            models.Assignment,
            models.Course,
        )
        .join(
            models.Submission,
            models.Submission.id == models.SubmissionResource.submission_id,
        )
        .join(
            models.Assignment,
            models.Assignment.id == models.Submission.assignment_id,
        )
        .join(models.Course, models.Course.id == models.Assignment.course_id)
        .where(
            models.SubmissionResource.id == resource_id,
            models.SubmissionResource.submission_id == submission_id,
            models.SubmissionResource.kind == "file",
        )
    ).first()
    if row is None:
        raise LookupError("Attachment not found.")

    resource, submission, assignment, course = row
    if user.role == "teacher":
        authorized = course.teacher_id == user.id
    elif user.role == "student":
        is_enrolled = db.scalar(
            select(models.Enrollment.id).where(
                models.Enrollment.course_id == assignment.course_id,
                models.Enrollment.student_id == user.id,
            )
        )
        authorized = (
            submission.student_id == user.id
            and is_enrolled is not None
            and db.get(
                models.AssignmentRecipient,
                (assignment.id, user.id),
            )
            is not None
        )
    else:
        authorized = False
    if not authorized or not resource.storage_key:
        raise LookupError("Attachment not found.")

    storage_dir = settings.SUBMISSION_UPLOAD_DIR.resolve()
    file_path = (storage_dir / resource.storage_key).resolve()
    if file_path.parent != storage_dir or not file_path.is_file():
        raise LookupError("Attachment not found.")
    return file_path, resource.name, resource.content_type or "application/octet-stream"