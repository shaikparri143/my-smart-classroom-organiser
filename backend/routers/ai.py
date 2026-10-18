import json
import re
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
from database import get_db
from dependencies import CurrentStudent, CurrentTeacher, CurrentUser
from schemas import (
    AIChatRequest,
    AIQuizRequest,
    AIQuizSubmission,
    AIStudyPlanRequest,
    AITeacherMaterialRequest,
    AITeacherMaterialSave,
)
from services import ai_service


router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])
DbSession = Annotated[Session, Depends(get_db)]

RATE_LIMIT = 12
RATE_WINDOW_SECONDS = 60
_request_times: dict[int, list[float]] = {}
_rate_limit_lock = threading.Lock()


class QuizQuestion(BaseModel):
    type: Literal["mcq", "short_answer"]
    question: str = Field(min_length=1, max_length=1000)
    options: list[str] = Field(default_factory=list, max_length=6)
    answer: str = Field(min_length=1, max_length=1000)
    accepted_answers: list[str] = Field(default_factory=list, max_length=5)
    explanation: str = Field(min_length=1, max_length=2000)

    @field_validator("question", "answer", "explanation")
    @classmethod
    def strip_quiz_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Quiz content cannot be blank.")
        return value

    @field_validator("options", "accepted_answers")
    @classmethod
    def strip_quiz_values(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip() for value in values]
        if any(not value for value in cleaned):
            raise ValueError("Quiz options cannot be blank.")
        return cleaned


class GeneratedQuiz(BaseModel):
    questions: list[QuizQuestion] = Field(min_length=2, max_length=10)


def _enforce_rate_limit(user_id: int) -> None:
    now = time.monotonic()
    with _rate_limit_lock:
        recent = [
            timestamp
            for timestamp in _request_times.get(user_id, [])
            if now - timestamp < RATE_WINDOW_SECONDS
        ]
        if len(recent) >= RATE_LIMIT:
            _request_times[user_id] = recent
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI request limit reached. Please wait a minute and try again.",
                headers={"Retry-After": str(RATE_WINDOW_SECONDS)},
            )
        recent.append(now)
        _request_times[user_id] = recent
        if len(_request_times) > 10000:
            expired = [
                key
                for key, values in _request_times.items()
                if not values or now - values[-1] >= RATE_WINDOW_SECONDS
            ]
            for key in expired:
                _request_times.pop(key, None)


async def _complete(messages: list[dict], *, json_mode: bool = False) -> str:
    try:
        return await ai_service.complete(messages, json_mode=json_mode)
    except ai_service.AIProviderError as exc:
        message = str(exc).lower()
        if "not configured" in message:
            code = status.HTTP_503_SERVICE_UNAVAILABLE
        elif "rate limit" in message or "quota" in message:
            code = status.HTTP_429_TOO_MANY_REQUESTS
        else:
            code = status.HTTP_502_BAD_GATEWAY
        raise HTTPException(status_code=code, detail=str(exc)) from exc


def _parse_quiz(content: str) -> GeneratedQuiz:
    try:
        payload = ai_service.parse_json_response(content)
        quiz = GeneratedQuiz.model_validate(payload)
    except (ai_service.AIProviderError, ValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI provider returned an invalid quiz. Please try again.",
        ) from exc

    for question in quiz.questions:
        if question.type == "mcq":
            if len(question.options) < 2 or len(question.options) > 6:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="The AI provider returned an invalid quiz. Please try again.",
                )
            if question.answer not in question.options:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="The AI provider returned an invalid quiz. Please try again.",
                )
        elif question.type == "short_answer":
            if question.options:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="The AI provider returned an invalid quiz. Please try again.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The AI provider returned an invalid quiz. Please try again.",
            )
    if {question.type for question in quiz.questions} != {"mcq", "short_answer"}:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI provider returned a quiz without both required question types.",
        )
    return quiz


def _public_quiz(generation: models.AIGeneration, quiz: GeneratedQuiz) -> dict:
    return {
        "id": generation.id,
        "title": generation.prompt,
        "questions": [
            {
                "type": question.type,
                "question": question.question,
                "options": question.options,
            }
            for question in quiz.questions
        ],
    }


@router.post("/chat")
async def ask_ai(payload: AIChatRequest, user: CurrentUser):
    _enforce_rate_limit(user.id)
    messages = [
        {
            "role": "system",
            "content": (
                "You are ClassPilot, a supportive academic study assistant. "
                "Explain concepts clearly with accurate examples, adapt to follow-up "
                "questions, and encourage learning rather than doing graded work for "
                "the learner. Keep responses focused and educational. Do not claim "
                "access to the student's records or invent course-specific facts."
            ),
        },
        *[message.model_dump() for message in payload.messages],
    ]
    return {"response": await _complete(messages)}


@router.post("/quiz")
async def generate_quiz(
    payload: AIQuizRequest,
    db: DbSession,
    user: CurrentUser,
):
    _enforce_rate_limit(user.id)
    prompt = (
        f"{payload.subject}: {payload.topic} "
        f"({payload.question_count} practice questions, {payload.difficulty} difficulty)"
    )
    content = await _complete(
        [
            {
                "role": "system",
                "content": (
                    "Create accurate educational practice questions. Return only a "
                    "JSON object with a questions array. Each item must contain type "
                    "('mcq' or 'short_answer'), question, options (four distinct "
                    "strings for mcq and [] for short_answer), answer (exactly one "
                    "option for mcq, concise reference answer for short_answer), "
                    "accepted_answers (up to five equivalent short-answer variants, "
                    "or [] for mcq), and explanation. Include both question types."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Subject: {payload.subject}\nTopic: {payload.topic}\n"
                    f"Count: {payload.question_count}\nDifficulty: {payload.difficulty}"
                ),
            },
        ],
        json_mode=True,
    )
    quiz = _parse_quiz(content)
    if len(quiz.questions) != payload.question_count:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI provider returned an incomplete quiz. Please try again.",
        )
    generation = models.AIGeneration(
        user_id=user.id,
        generation_type="student_quiz",
        prompt=prompt,
        result_text=quiz.model_dump_json(),
        provider="ollama",
    )
    db.add(generation)
    db.commit()
    db.refresh(generation)
    return _public_quiz(generation, quiz)


def _normalize_answer(answer: str | None) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[\W_]+", " ", (answer or "").casefold())).strip()


@router.post("/quiz/{generation_id}/submit")
def submit_quiz(
    generation_id: int,
    payload: AIQuizSubmission,
    db: DbSession,
    user: CurrentUser,
):
    generation = db.scalar(
        select(models.AIGeneration).where(
            models.AIGeneration.id == generation_id,
            models.AIGeneration.user_id == user.id,
            models.AIGeneration.generation_type == "student_quiz",
        )
    )
    if generation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Practice quiz not found.",
        )
    try:
        quiz = GeneratedQuiz.model_validate_json(generation.result_text)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="This saved quiz is unavailable. Generate a new practice quiz.",
        ) from exc
    if len(payload.answers) != len(quiz.questions):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Submit one answer for every quiz question.",
        )

    results = []
    correct_count = 0
    for index, (question, submitted) in enumerate(zip(quiz.questions, payload.answers)):
        accepted_answers = [question.answer, *question.accepted_answers]
        correct = _normalize_answer(submitted.answer) in {
            _normalize_answer(answer) for answer in accepted_answers
        }
        correct_count += int(correct)
        results.append(
            {
                "question_index": index,
                "correct": correct,
                "correct_answer": question.answer,
                "explanation": question.explanation,
            }
        )
    return {
        "score": correct_count,
        "total": len(quiz.questions),
        "percentage": round(correct_count / len(quiz.questions) * 100),
        "results": results,
    }


@router.post("/study-plan")
async def generate_study_plan(
    payload: AIStudyPlanRequest,
    db: DbSession,
    student: CurrentStudent,
):
    _enforce_rate_limit(student.id)
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=payload.horizon_days)
    course_ids = list(
        db.scalars(
            select(models.Enrollment.course_id).where(
                models.Enrollment.student_id == student.id
            )
        ).all()
    )
    timetable_preference = db.scalar(
        select(models.TimetablePreference).where(
            models.TimetablePreference.user_id == student.id
        )
    )
    timetable_entries = db.scalars(
        select(models.TimetableEntry)
        .where(
            models.TimetableEntry.user_id == student.id,
            models.TimetableEntry.is_active.is_(True),
        )
        .order_by(models.TimetableEntry.weekday, models.TimetableEntry.start_time)
        .limit(100)
    ).all()

    assignments = []
    exam_events = []
    if course_ids:
        assignments = db.scalars(
            select(models.Assignment)
            .join(
                models.AssignmentRecipient,
                models.AssignmentRecipient.assignment_id == models.Assignment.id,
            )
            .where(
                models.Assignment.course_id.in_(course_ids),
                models.AssignmentRecipient.student_id == student.id,
                models.Assignment.due_at >= now,
                models.Assignment.due_at <= end,
            )
            .order_by(models.Assignment.due_at.asc())
            .limit(100)
        ).all()
        exam_events = db.scalars(
            select(models.CalendarEvent)
            .where(
                (
                    (models.CalendarEvent.created_by_id == student.id)
                    | (models.CalendarEvent.course_id.in_(course_ids))
                ),
                models.CalendarEvent.event_type == "exam",
                models.CalendarEvent.start_at <= end,
                models.CalendarEvent.end_at >= now,
            )
            .order_by(models.CalendarEvent.start_at.asc())
            .limit(100)
        ).all()
    else:
        exam_events = db.scalars(
            select(models.CalendarEvent)
            .where(
                models.CalendarEvent.created_by_id == student.id,
                models.CalendarEvent.event_type == "exam",
                models.CalendarEvent.start_at <= end,
                models.CalendarEvent.end_at >= now,
            )
            .order_by(models.CalendarEvent.start_at.asc())
            .limit(100)
        ).all()

    timetable_data = (
        [
            {
                "title": entry.title,
                "weekday": entry.weekday,
                "day_order": entry.day_order,
                "start_time": entry.start_time,
                "end_time": entry.end_time,
                "location": entry.location,
            }
            for entry in timetable_entries
        ]
        if timetable_preference is not None
        else []
    )
    assignment_data = [
        {
            "title": assignment.title,
            "due_at": assignment.due_at.isoformat(),
        }
        for assignment in assignments
    ]
    exam_data = [
        {
            "title": event.title,
            "start_at": event.start_at.isoformat(),
            "end_at": event.end_at.isoformat(),
        }
        for event in exam_events
    ]
    timetable_configured = timetable_preference is not None
    prompt = {
        "planning_horizon_days": payload.horizon_days,
        "available_study_hours_per_day": payload.hours_per_day,
        "timetable_configured": timetable_configured,
        "timetable_entries": timetable_data,
        "assigned_deadlines": assignment_data,
        "authorized_exam_events": exam_data,
        "student_requested_focus_topics": payload.focus_topics.strip(),
    }
    content = await _complete(
        [
            {
                "role": "system",
                "content": (
                    "Create a practical editable study plan based only on the "
                    "provided facts. Never invent dates, assignments, exams, or "
                    "timetable entries. If timetable_configured is false, clearly "
                    "say no personal timetable is configured and make a flexible "
                    "manual plan from the student's requested focus topics and "
                    "available hours, prioritizing only deadlines or exams actually "
                    "provided. Do not imply guessed timetable slots. Do not refer "
                    "to grades, attendance, submissions, or other students. Clearly "
                    "distinguish provided deadlines and exam events from suggested "
                    "study sessions."
                ),
            },
            {"role": "user", "content": json.dumps(prompt)},
        ]
    )
    return {
        "plan": content,
        "timetable_configured": timetable_configured,
        "timetable_entries_used": len(timetable_data),
        "deadlines_used": len(assignment_data),
        "exam_events_used": len(exam_data),
    }


@router.post("/teacher/generate")
async def generate_teacher_material(
    payload: AITeacherMaterialRequest,
    teacher: CurrentTeacher,
):
    _enforce_rate_limit(teacher.id)
    material_instructions = {
        "lesson_plan": (
            "Draft an editable lesson plan with learning objectives, materials, "
            "a timed sequence of activities, checks for understanding, and "
            "differentiation."
        ),
        "quiz": (
            "Draft a balanced practice quiz with varied question types, then put "
            "a clearly separated answer key with brief explanations at the end."
        ),
        "assignment_suggestions": (
            "Suggest assignment questions and measurable learning objectives. "
            "Include varied difficulty and concise assessment criteria."
        ),
    }
    prompt = (
        f"Subject: {payload.subject}\nTopic: {payload.topic}\n"
        f"Target group: {payload.target_group or 'Not specified'}\n"
        f"Teacher guidance: {payload.details or 'None'}"
    )
    draft = await _complete(
        [
            {
                "role": "system",
                "content": (
                    "You help teachers draft educational material for review. "
                    "Return clear, editable text. Do not claim the draft was "
                    "saved or used."
                ),
            },
            {
                "role": "user",
                "content": f"{material_instructions[payload.kind]}\n\n{prompt}",
            },
        ]
    )
    return {
        "kind": payload.kind,
        "title": f"{payload.subject}: {payload.topic}",
        "prompt": prompt,
        "draft": draft,
    }


@router.post("/teacher/materials", status_code=status.HTTP_201_CREATED)
def save_teacher_material(
    payload: AITeacherMaterialSave,
    db: DbSession,
    teacher: CurrentTeacher,
):
    generation = models.AIGeneration(
        user_id=teacher.id,
        generation_type=payload.generation_type,
        prompt=json.dumps(
            {"title": payload.title, "prompt": payload.prompt},
            ensure_ascii=False,
        ),
        result_text=payload.result_text,
        provider="ollama",
    )
    db.add(generation)
    db.commit()
    db.refresh(generation)
    return {
        "id": generation.id,
        "title": payload.title,
        "generation_type": generation.generation_type,
        "created_at": generation.created_at.isoformat(),
    }


@router.get("/teacher/materials")
def list_teacher_materials(db: DbSession, teacher: CurrentTeacher):
    materials = db.scalars(
        select(models.AIGeneration)
        .where(
            models.AIGeneration.user_id == teacher.id,
            models.AIGeneration.generation_type.in_(
                (
                    "teacher_lesson_plan",
                    "teacher_quiz",
                    "teacher_assignment_suggestions",
                )
            ),
        )
        .order_by(models.AIGeneration.created_at.desc())
        .limit(30)
    ).all()
    saved_items = []
    for item in materials:
        try:
            prompt_data = json.loads(item.prompt)
        except json.JSONDecodeError:
            prompt_data = {"title": item.prompt[:200], "prompt": item.prompt}
        saved_items.append(
            {
                "id": item.id,
                "generation_type": item.generation_type,
                "title": prompt_data.get("title", "Saved teacher draft"),
                "prompt": prompt_data.get("prompt", item.prompt),
                "result_text": item.result_text,
                "created_at": item.created_at.isoformat(),
            }
        )
    return saved_items