import asyncio
import io
import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from urllib.error import HTTPError, URLError

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import models
from database import Base
from routers import ai
from services import ai_service
from schemas import (
    AIChatMessage,
    AIChatRequest,
    AIQuizAnswer,
    AIQuizRequest,
    AIStudyPlanRequest,
    AIQuizSubmission,
    AITeacherMaterialSave,
)


class AIAssistantTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.student = models.User(
            id=801,
            full_name="Study Student",
            email="study@example.test",
            password_hash="unused",
            role="student",
            is_active=True,
        )
        ai._request_times.pop(self.student.id, None)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        ai._request_times.pop(self.student.id, None)

    def test_chat_endpoint_returns_ollama_response_without_api_key(self):
        request = AIChatRequest(
            messages=[AIChatMessage(role="user", content="Explain fractions")]
        )
        response_body = json.dumps(
            {
                "message": {
                    "role": "assistant",
                    "content": "Fractions describe equal parts of a whole.",
                },
                "done": True,
            }
        ).encode()

        class ProviderResponse(io.BytesIO):
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                self.close()

        with (
            patch.object(ai_service.settings, "AI_BASE_URL", "http://localhost:11434/api"),
            patch.object(ai_service.settings, "AI_MODEL", "qwen2.5:7b"),
            patch(
                "services.ai_service.urlopen",
                return_value=ProviderResponse(response_body),
            ),
        ):
            result = asyncio.run(ai.ask_ai(request, self.student))
        self.assertEqual(
            result["response"],
            "Fractions describe equal parts of a whole.",
        )

    def test_provider_sends_ollama_chat_payload_and_returns_response(self):
        response_body = json.dumps(
            {
                "message": {
                    "role": "assistant",
                    "content": "A local Ollama response.",
                },
                "done": True,
            }
        ).encode()
        captured = {}

        class ProviderResponse(io.BytesIO):
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                self.close()

        def provider_request(request, timeout):
            captured["request"] = request
            captured["timeout"] = timeout
            return ProviderResponse(response_body)

        with (
            patch.object(
                ai_service.settings,
                "AI_BASE_URL",
                "http://localhost:11434/api",
            ),
            patch.object(ai_service.settings, "AI_MODEL", "qwen2.5:7b"),
            patch("services.ai_service.urlopen", side_effect=provider_request),
        ):
            result = asyncio.run(
                ai_service.complete(
                    [
                        {"role": "system", "content": "Teach clearly."},
                        {"role": "user", "content": "Explain fractions"},
                        {"role": "assistant", "content": "A fraction is a part."},
                        {"role": "user", "content": "Give an example."},
                    ],
                    json_mode=True,
                )
            )

        self.assertEqual(result, "A local Ollama response.")
        self.assertEqual(
            captured["request"].full_url,
            "http://localhost:11434/api/chat",
        )
        self.assertIsNone(captured["request"].get_header("X-goog-api-key"))
        self.assertEqual(captured["timeout"], ai_service.settings.AI_TIMEOUT_SECONDS)
        payload = json.loads(captured["request"].data.decode("utf-8"))
        self.assertEqual(payload["model"], "qwen2.5:7b")
        self.assertFalse(payload["stream"])
        self.assertEqual(payload["format"], "json")
        self.assertEqual(
            [message["role"] for message in payload["messages"]],
            ["system", "user", "assistant", "user"],
        )
        self.assertEqual(
            payload["messages"][0]["content"],
            "Teach clearly.",
        )
        self.assertEqual(
            payload["messages"][2]["content"],
            "A fraction is a part.",
        )

    def test_provider_errors_explain_missing_model_and_busy_service(self):
        for code, expected in (
            (404, "model 'qwen2.5:7b' was not found"),
            (429, "Ollama is busy"),
        ):
            with self.subTest(status=code):
                error = HTTPError(
                    "http://localhost:11434/api/chat",
                    code,
                    "provider failure",
                    {},
                    io.BytesIO(b"private response body"),
                )
                with (
                    patch.object(ai_service.settings, "AI_MODEL", "qwen2.5:7b"),
                    patch("services.ai_service.urlopen", side_effect=error),
                ):
                    with self.assertRaises(ai_service.AIProviderError) as raised:
                        asyncio.run(
                            ai_service.complete(
                                [{"role": "user", "content": "Explain fractions"}]
                            )
                        )
                self.assertIn(expected, str(raised.exception))
                self.assertNotIn("private response body", str(raised.exception))

    def test_provider_network_failures_are_reported_without_provider_details(self):
        with patch(
            "services.ai_service.urlopen",
            side_effect=URLError("connection refused"),
        ):
            with self.assertRaises(ai_service.AIProviderError) as raised:
                asyncio.run(ai_service.complete([{"role": "user", "content": "Hello"}]))
        self.assertIn("Could not connect to Ollama", str(raised.exception))
        self.assertNotIn("connection refused", str(raised.exception))

    def test_chat_surfaces_provider_failures(self):
        request = AIChatRequest(
            messages=[AIChatMessage(role="user", content="Explain fractions")]
        )
        with patch.object(
            ai.ai_service,
            "complete",
            new=AsyncMock(
                side_effect=ai.ai_service.AIProviderError(
                    "The AI provider could not complete the request. Please try again."
                )
            ),
        ):
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(ai.ask_ai(request, self.student))
        self.assertEqual(raised.exception.status_code, 502)

    def test_generated_quiz_hides_answers_and_scores_on_server(self):
        generated_quiz = {
            "questions": [
                {
                    "type": "mcq",
                    "question": "What is 1 + 2?",
                    "options": ["2", "3", "4", "5"],
                    "answer": "3",
                    "accepted_answers": [],
                    "explanation": "Adding one and two gives three.",
                },
                {
                    "type": "short_answer",
                    "question": "What process divides a cell nucleus?",
                    "options": [],
                    "answer": "Mitosis",
                    "accepted_answers": ["mitotic division"],
                    "explanation": "Mitosis divides the nucleus into two nuclei.",
                },
            ]
        }
        request = AIQuizRequest(
            subject="Biology",
            topic="Cell division",
            question_count=2,
        )
        with patch.object(
            ai.ai_service,
            "complete",
            new=AsyncMock(return_value=json.dumps(generated_quiz)),
        ):
            generated = asyncio.run(ai.generate_quiz(request, self.db, self.student))

        self.assertEqual(len(generated["questions"]), 2)
        self.assertNotIn("answer", generated["questions"][0])

        submission = AIQuizSubmission(
            answers=[
                AIQuizAnswer(answer="3"),
                AIQuizAnswer(answer="MITOTIC division!"),
            ]
        )
        result = ai.submit_quiz(generated["id"], submission, self.db, self.student)
        self.assertEqual(result["score"], 2)
        self.assertEqual(result["percentage"], 100)
        self.assertTrue(all(item["correct"] for item in result["results"]))
        with self.assertRaises(HTTPException) as wrong_answer_count:
            ai.submit_quiz(
                generated["id"],
                AIQuizSubmission(answers=[AIQuizAnswer(answer="3")]),
                self.db,
                self.student,
            )
        self.assertEqual(wrong_answer_count.exception.status_code, 422)
        other_user = models.User(
            id=804,
            full_name="Another Student",
            email="another@example.test",
            password_hash="unused",
            role="student",
            is_active=True,
        )
        with self.assertRaises(HTTPException) as other_owner:
            ai.submit_quiz(
                generated["id"],
                submission,
                self.db,
                other_user,
            )
        self.assertEqual(other_owner.exception.status_code, 404)

    def test_teacher_tools_reject_students(self):
        teacher_route = next(
            route
            for route in ai.router.routes
            if route.path == "/api/ai/teacher/generate"
        )
        checker = next(
            dependency.call
            for dependency in teacher_route.dependant.dependencies
            if dependency.call.__name__ == "role_checker"
        )
        with self.assertRaises(HTTPException) as raised:
            checker(self.student)
        self.assertEqual(raised.exception.status_code, 403)

    def test_teacher_can_save_and_reload_only_owned_drafts(self):
        teacher = models.User(
            id=805,
            full_name="Draft Teacher",
            email="draft-teacher@example.test",
            password_hash="unused",
            role="teacher",
            is_active=True,
        )
        saved = ai.save_teacher_material(
            AITeacherMaterialSave(
                generation_type="teacher_lesson_plan",
                title="Photosynthesis lesson",
                prompt="Subject: Biology\nTopic: Photosynthesis",
                result_text="An editable lesson draft.",
            ),
            self.db,
            teacher,
        )
        drafts = ai.list_teacher_materials(self.db, teacher)
        self.assertEqual(saved["id"], drafts[0]["id"])
        self.assertEqual(drafts[0]["title"], "Photosynthesis lesson")
        self.assertEqual(drafts[0]["result_text"], "An editable lesson draft.")
        self.assertEqual(ai.list_teacher_materials(self.db, self.student), [])

    def test_study_plan_uses_only_the_students_authorized_schedule(self):
        now = datetime.now(timezone.utc)
        teacher = models.User(
            id=802,
            full_name="Course Teacher",
            email="teacher@example.test",
            password_hash="unused",
            role="teacher",
            is_active=True,
        )
        other_student = models.User(
            id=803,
            full_name="Other Student",
            email="other@example.test",
            password_hash="unused",
            role="student",
            is_active=True,
        )
        course = models.Course(
            id=901,
            join_code="ABCDEF123456",
            course_code="BIO101",
            title="Biology",
            semester="Fall",
            section="A",
            teacher_id=teacher.id,
        )
        other_course = models.Course(
            id=902,
            join_code="GHIJKL123456",
            course_code="CHEM101",
            title="Chemistry",
            semester="Fall",
            section="A",
            teacher_id=teacher.id,
        )
        self.db.add_all([self.student, teacher, other_student, course, other_course])
        self.db.flush()
        self.db.add_all(
            [
                models.Enrollment(student_id=self.student.id, course_id=course.id),
                models.Enrollment(student_id=other_student.id, course_id=other_course.id),
                models.TimetablePreference(user_id=self.student.id),
                models.TimetableEntry(
                    user_id=self.student.id,
                    title="Biology lecture",
                    weekday=1,
                    start_time="09:00",
                    end_time="10:00",
                ),
                models.Assignment(
                    id=1001,
                    course_id=course.id,
                    created_by_id=teacher.id,
                    title="Cell structure assignment",
                    description="Do not send descriptions to AI",
                    due_at=now + timedelta(days=3),
                    max_points=10,
                ),
                models.AssignmentRecipient(assignment_id=1001, student_id=self.student.id),
                models.Assignment(
                    id=1002,
                    course_id=other_course.id,
                    created_by_id=teacher.id,
                    title="Other student's private assignment",
                    due_at=now + timedelta(days=2),
                    max_points=10,
                ),
                models.AssignmentRecipient(assignment_id=1002, student_id=other_student.id),
                models.CalendarEvent(
                    course_id=course.id,
                    created_by_id=teacher.id,
                    title="Biology exam",
                    event_type="exam",
                    start_at=now + timedelta(days=5),
                    end_at=now + timedelta(days=5, hours=2),
                ),
            ]
        )
        self.db.commit()
        provider = AsyncMock(return_value="A plan using the provided schedule.")
        with patch.object(ai.ai_service, "complete", new=provider):
            result = asyncio.run(
                ai.generate_study_plan(
                    AIStudyPlanRequest(horizon_days=7, hours_per_day=2),
                    self.db,
                    self.student,
                )
            )

        self.assertTrue(result["timetable_configured"])
        self.assertEqual(result["timetable_entries_used"], 1)
        self.assertEqual(result["deadlines_used"], 1)
        self.assertEqual(result["exam_events_used"], 1)
        supplied_context = json.loads(provider.await_args.args[0][-1]["content"])
        self.assertIn("Cell structure assignment", str(supplied_context))
        self.assertIn("Biology exam", str(supplied_context))
        self.assertIn("Biology lecture", str(supplied_context))
        self.assertNotIn("Other student's private assignment", str(supplied_context))
        self.assertNotIn("Do not send descriptions to AI", str(supplied_context))

    def test_chat_request_rejects_non_alternating_history(self):
        with self.assertRaises(ValueError):
            AIChatRequest(
                messages=[
                    AIChatMessage(role="user", content="First"),
                    AIChatMessage(role="user", content="Second"),
                ]
            )


if __name__ == "__main__":
    unittest.main()
