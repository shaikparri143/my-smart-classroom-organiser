from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from dependencies import CurrentStudent, CurrentTeacher, CurrentUser
from schemas import (
    AssignmentRecipientUpdate,
    AssignmentCreate,
    AssignmentListResponse,
    AssignmentResponse,
    AssignmentSubmissionReview,
    EnrolledStudentAssignmentResponse,
    GradeCreate,
    GradeResponse,
    StudentAssignmentResponse,
    SubmissionResponse,
)
from services import assignment_service


router = APIRouter(prefix="/api/assignments", tags=["Assignments"])
DbSession = Annotated[Session, Depends(get_db)]


@router.post(
    "",
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_assignment(
    payload: AssignmentCreate,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        return assignment_service.create_assignment(db, teacher, payload)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.get("/teacher", response_model=list[AssignmentListResponse])
def list_teacher_assignments(
    db: DbSession,
    teacher: CurrentTeacher,
):
    return assignment_service.get_teacher_assignments(db, teacher.id)


@router.get("/student", response_model=list[StudentAssignmentResponse])
def list_student_assignments(
    db: DbSession,
    student: CurrentStudent,
):
    return assignment_service.get_student_assignments(db, student.id)


@router.put(
    "/{assignment_id}/submission",
    response_model=SubmissionResponse,
)
async def submit_assignment(
    assignment_id: int,
    db: DbSession,
    student: CurrentStudent,
    text_response: str | None = Form(default=None),
    links: list[str] | None = Form(default=None),
    files: list[UploadFile] | None = File(default=None),
    keep_resource_ids: list[int] | None = Form(default=None),
):
    try:
        return await assignment_service.submit_assignment_resources(
            db,
            student,
            assignment_id,
            text_response,
            links or [],
            files or [],
            keep_resource_ids or [],
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.get(
    "/course/{course_id}/students",
    response_model=list[EnrolledStudentAssignmentResponse],
)
def list_course_students_for_assignment(
    course_id: int,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        return assignment_service.get_course_students_for_assignment(
            db, teacher.id, course_id
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.put("/{assignment_id}/recipients", status_code=status.HTTP_204_NO_CONTENT)
def update_assignment_recipients(
    assignment_id: int,
    payload: AssignmentRecipientUpdate,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        assignment_service.update_assignment_recipients(
            db, teacher.id, assignment_id, payload.recipient_student_ids
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


@router.get(
    "/{assignment_id}/submissions",
    response_model=list[AssignmentSubmissionReview],
)
def list_assignment_submissions(
    assignment_id: int,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        return assignment_service.get_assignment_submissions(
            db, teacher.id, assignment_id
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.put(
    "/submissions/{submission_id}/grade",
    response_model=GradeResponse,
)
def grade_submission(
    submission_id: int,
    payload: GradeCreate,
    db: DbSession,
    teacher: CurrentTeacher,
):
    try:
        return assignment_service.grade_submission(
            db, teacher, submission_id, payload
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


@router.get(
    "/submissions/{submission_id}/attachments/{resource_id}",
    response_class=FileResponse,
)
def download_submission_attachment(
    submission_id: int,
    resource_id: int,
    db: DbSession,
    user: CurrentUser,
):
    try:
        path, filename, content_type = assignment_service.get_submission_attachment(
            db, user, submission_id, resource_id
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    return FileResponse(
        path,
        media_type=content_type,
        filename=filename,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


@router.get(
    "/course/{course_id}",
    response_model=list[AssignmentListResponse],
)
def list_course_assignments(
    course_id: int,
    db: DbSession,
    user: CurrentUser,
):
    try:
        return assignment_service.get_course_assignments(db, user, course_id)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc