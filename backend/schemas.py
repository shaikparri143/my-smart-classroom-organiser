
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class APIBaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------------
# Courses
# -------------------------------------------------------------------

class CourseCreate(BaseModel):
    course_code: str = Field(min_length=2, max_length=30)
    title: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=5000)
    semester: str = Field(default="Not specified", min_length=1, max_length=30)
    section: str = Field(default="A", min_length=1, max_length=30)


class CourseUpdate(BaseModel):
    course_code: str | None = Field(default=None, min_length=2, max_length=30)
    title: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=5000)
    semester: str | None = Field(default=None, min_length=1, max_length=30)
    section: str | None = Field(default=None, min_length=1, max_length=30)
    is_active: bool | None = None


class CourseResponse(APIBaseSchema):
    id: int
    course_code: str
    title: str
    description: str | None
    semester: str
    section: str
    attendance_threshold: float
    teacher_id: int
    is_active: bool
    created_at: datetime


class EnrollmentCreate(BaseModel):
    student_id: int = Field(gt=0)


class EnrollmentResponse(APIBaseSchema):
    id: int
    student_id: int
    course_id: int
    enrolled_at: datetime


# -------------------------------------------------------------------
# Attendance
# -------------------------------------------------------------------

AttendanceStatus = Literal["present", "absent", "late", "excused"]


class AttendanceCreate(BaseModel):
    student_id: int = Field(gt=0)
    attendance_date: date
    status: AttendanceStatus
    notes: str | None = Field(default=None, max_length=2000)


class AttendanceUpdate(BaseModel):
    status: AttendanceStatus
    notes: str | None = Field(default=None, max_length=2000)


class AttendanceEntry(BaseModel):
    student_id: int = Field(gt=0)
    status: AttendanceStatus
    notes: str | None = Field(default=None, max_length=2000)


class AttendanceBatch(BaseModel):
    attendance_date: date
    records: list[AttendanceEntry] = Field(min_length=1, max_length=500)

    @field_validator("records")
    @classmethod
    def validate_unique_students(
        cls, records: list[AttendanceEntry]
    ) -> list[AttendanceEntry]:
        student_ids = [record.student_id for record in records]
        if len(student_ids) != len(set(student_ids)):
            raise ValueError("Each student can only appear once per attendance date.")
        return records


class AttendanceResponse(APIBaseSchema):
    id: int
    course_id: int
    student_id: int
    marked_by_id: int
    attendance_date: date
    status: AttendanceStatus
    notes: str | None
    created_at: datetime


class AttendanceHistoryItem(BaseModel):
    attendance_date: date
    status: AttendanceStatus
    notes: str | None


class TeacherAttendanceStudent(BaseModel):
    student_id: int
    student_name: str
    student_email: str
    status: AttendanceStatus | None
    notes: str | None
    total_records: int
    attended_records: int
    eligible_records: int
    present_count: int
    absent_count: int
    late_count: int
    excused_count: int
    attendance_percentage: float | None
    required_attendance_percentage: float
    requirement_met: bool | None
    margin_percentage_points: float | None
    additional_classes_needed: int | None
    history: list[AttendanceHistoryItem]


class StudentAttendanceCourseSummary(BaseModel):
    course_id: int
    course_code: str
    course_title: str
    required_attendance_percentage: float
    total_sessions: int
    present_count: int
    absent_count: int
    late_count: int
    excused_count: int
    attendance_percentage: float | None
    requirement_met: bool | None
    margin_percentage_points: float | None
    additional_classes_needed: int | None
    history: list[AttendanceHistoryItem]


# -------------------------------------------------------------------
# Assignments and submissions
# -------------------------------------------------------------------

class AssignmentCreate(BaseModel):
    course_id: int = Field(gt=0)
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(min_length=1, max_length=10000)
    due_at: datetime
    max_points: float = Field(gt=0, le=100000)
    attachment_url: str | None = Field(default=None, max_length=1000)
    recipient_student_ids: list[int] = Field(min_length=1)

    @field_validator("title", "description")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value

    @field_validator("title")
    @classmethod
    def validate_title_length(cls, value: str) -> str:
        if len(value) < 2:
            raise ValueError("Title must contain at least 2 characters.")
        return value

    @field_validator("due_at")
    @classmethod
    def validate_due_at_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("The due date must include a timezone.")
        return value


class AssignmentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    due_at: datetime | None = None
    max_points: float | None = Field(default=None, gt=0, le=100000)
    attachment_url: str | None = Field(default=None, max_length=1000)


class AssignmentResponse(APIBaseSchema):
    id: int
    course_id: int
    created_by_id: int
    title: str
    description: str | None
    due_at: datetime | None
    max_points: float
    attachment_url: str | None
    created_at: datetime
    updated_at: datetime


class AssignmentListResponse(AssignmentResponse):
    course_title: str
    course_code: str


class GradeResponse(APIBaseSchema):
    id: int
    submission_id: int
    graded_by_id: int
    score: float
    feedback: str | None
    graded_at: datetime


class SubmissionCreate(BaseModel):
    text_response: str = Field(min_length=1, max_length=50000)
    file_url: str | None = Field(default=None, max_length=1000)

    @field_validator("text_response")
    @classmethod
    def validate_text_response(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A written response is required.")
        return value


class SubmissionResponse(APIBaseSchema):
    id: int
    assignment_id: int
    student_id: int
    text_response: str | None
    file_url: str | None
    status: Literal["submitted", "late", "resubmitted"]
    submitted_at: datetime
    updated_at: datetime


class SubmissionResourceResponse(APIBaseSchema):
    id: int
    kind: Literal["link", "file"]
    name: str
    external_url: str | None
    content_type: str | None
    size_bytes: int | None
    download_url: str | None = None


class StudentAssignmentResponse(AssignmentListResponse):
    submission: SubmissionResponse | None = None
    grade: GradeResponse | None = None
    resources: list[SubmissionResourceResponse] = Field(default_factory=list)


class AssignmentSubmissionReview(BaseModel):
    student_id: int
    student_name: str
    student_email: str
    submission: SubmissionResponse | None
    grade: GradeResponse | None
    resources: list[SubmissionResourceResponse] = Field(default_factory=list)


class AssignmentRecipientUpdate(BaseModel):
    recipient_student_ids: list[int] = Field(min_length=1)


class EnrolledStudentAssignmentResponse(BaseModel):
    id: int
    full_name: str
    email: str


# -------------------------------------------------------------------
# Grades
# -------------------------------------------------------------------


class GradeCreate(BaseModel):
    score: float = Field(ge=0, le=100000)
    feedback: str | None = Field(default=None, max_length=10000)

    @field_validator("feedback")
    @classmethod
    def strip_feedback(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class AttendanceThresholdUpdate(BaseModel):
    attendance_threshold: float = Field(ge=0, le=100, allow_inf_nan=False)


# -------------------------------------------------------------------
# Component-wise marks
# -------------------------------------------------------------------


class AssessmentComponentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    max_marks: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    description: str | None = Field(default=None, max_length=10000)
    assessment_date: date | None = None
    instructions: str | None = Field(default=None, max_length=10000)
    display_order: int = Field(default=0, ge=0)

    @field_validator("name")
    @classmethod
    def strip_component_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A component name cannot be blank.")
        return value


class AssessmentComponentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    max_marks: Decimal | None = Field(
        default=None, gt=0, max_digits=12, decimal_places=2
    )
    description: str | None = Field(default=None, max_length=10000)
    assessment_date: date | None = None
    instructions: str | None = Field(default=None, max_length=10000)
    display_order: int | None = Field(default=None, ge=0)
    is_archived: bool | None = None
    is_published: bool | None = None

    @field_validator("name")
    @classmethod
    def strip_updated_component_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("A component name cannot be blank.")
        return value

    @model_validator(mode="after")
    def reject_null_required_updates(self):
        for field in ("name", "max_marks", "display_order", "is_archived", "is_published"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field.replace('_', ' ').capitalize()} cannot be null.")
        return self


class ComponentMarkEntry(BaseModel):
    student_id: int = Field(gt=0)
    score: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    feedback: str | None = Field(default=None, max_length=10000)

    @field_validator("feedback")
    @classmethod
    def strip_mark_feedback(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class ComponentMarksBatch(BaseModel):
    records: list[ComponentMarkEntry] = Field(min_length=1, max_length=500)

    @field_validator("records")
    @classmethod
    def validate_unique_students(
        cls, records: list[ComponentMarkEntry]
    ) -> list[ComponentMarkEntry]:
        student_ids = [record.student_id for record in records]
        if len(student_ids) != len(set(student_ids)):
            raise ValueError("Each student can only have one mark per component.")
        return records


class AssessmentComponentResponse(APIBaseSchema):
    id: int
    course_id: int
    name: str
    description: str | None
    max_marks: Decimal
    assessment_date: date | None
    instructions: str | None
    display_order: int
    is_archived: bool
    is_published: bool
    created_at: datetime
    updated_at: datetime


class ComponentMarkStudent(BaseModel):
    student_id: int
    student_name: str
    student_email: str
    score: Decimal | None
    feedback: str | None


class TeacherComponentMarks(BaseModel):
    component: AssessmentComponentResponse
    students: list[ComponentMarkStudent]


class TeacherCourseMarks(BaseModel):
    course_id: int
    course_code: str
    course_title: str
    current_max_total: Decimal
    components: list[TeacherComponentMarks]


class StudentComponentMark(BaseModel):
    source: Literal["assessment", "assignment"]
    component_id: int
    name: str
    description: str | None
    max_marks: Decimal
    assessment_date: date | None
    instructions: str | None
    score: Decimal | None
    percentage: float | None
    feedback: str | None
    display_order: int


class StudentCourseMarks(BaseModel):
    course_id: int
    course_code: str
    course_title: str
    components: list[StudentComponentMark]
    total_obtained: Decimal
    total_maximum: Decimal
    overall_percentage: float | None
    graded_components: int
    available_components: int
    is_in_progress: bool


# -------------------------------------------------------------------
# Timetable and calendar
# -------------------------------------------------------------------

class TimetablePreferenceCreate(BaseModel):
    timetable_mode: Literal["weekly", "day_order"]
    day_order_count: int = Field(default=1, ge=1, le=14)
    teaching_weekdays: list[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5])
    first_teaching_date: date | None = None
    first_day_order: int = Field(default=1, ge=1, le=14)
    holiday_policy: Literal["skip", "advance", "override"] = "skip"

    @field_validator("teaching_weekdays")
    @classmethod
    def validate_weekdays(cls, value: list[int]) -> list[int]:
        cleaned = sorted(set(int(item) for item in value))
        if not cleaned:
            raise ValueError("At least one teaching weekday must be selected.")
        if any(day < 0 or day > 6 for day in cleaned):
            raise ValueError("Weekday values must be between 0 and 6.")
        return cleaned


class TimetablePreferenceResponse(APIBaseSchema):
    id: int
    user_id: int
    timetable_mode: str
    day_order_count: int
    teaching_weekdays: list[int]
    first_teaching_date: date | None
    first_day_order: int
    holiday_policy: str
    created_at: datetime
    updated_at: datetime
    configured: bool


class TimetableEntryCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    weekday: int | None = Field(default=None, ge=0, le=6)
    day_order: int | None = Field(default=None, ge=1, le=14)
    start_time: str = Field(min_length=1, max_length=20)
    end_time: str = Field(min_length=1, max_length=20)
    course_id: int | None = Field(default=None, gt=0)
    location: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("title", "start_time", "end_time")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value

    @field_validator("day_order")
    @classmethod
    def validate_day_order(cls, value: int | None) -> int | None:
        if value is not None and value < 1:
            raise ValueError("Day order must be at least 1.")
        return value


class TimetableEntryUpdate(TimetableEntryCreate):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    start_time: str | None = Field(default=None, min_length=1, max_length=20)
    end_time: str | None = Field(default=None, min_length=1, max_length=20)


class TimetableEntryResponse(APIBaseSchema):
    id: int
    user_id: int
    course_id: int | None
    title: str
    weekday: int | None
    day_order: int | None
    start_time: str
    end_time: str
    location: str | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CalendarEventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    event_type: str = Field(default="general", min_length=1, max_length=40)
    start_at: datetime
    end_at: datetime
    description: str | None = Field(default=None, max_length=5000)
    course_id: int | None = Field(default=None, gt=0)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value

    @field_validator("end_at")
    @classmethod
    def validate_end_after_start(cls, value: datetime, info):
        start = info.data.get("start_at")
        if start and value < start:
            raise ValueError("The end time must be after the start time.")
        return value


class CalendarEventResponse(APIBaseSchema):
    id: int
    course_id: int | None
    created_by_id: int
    title: str
    description: str | None
    event_type: str
    start_at: datetime
    end_at: datetime
    created_at: datetime


class CalendarDayDetail(BaseModel):
    date: date
    weekday: str
    is_teaching_day: bool
    day_order: int | None = None
    timetable: list[TimetableEntryResponse] = Field(default_factory=list)
    events: list[CalendarEventResponse] = Field(default_factory=list)
    academic_deadlines: list[CalendarEventResponse] = Field(default_factory=list)
    is_holiday: bool = False


# -------------------------------------------------------------------
# Announcements
# -------------------------------------------------------------------

class AnnouncementCreate(BaseModel):
    course_id: int = Field(gt=0)
    title: str = Field(min_length=2, max_length=200)
    content: str = Field(min_length=1, max_length=20000)
    published_at: datetime | None = None
    recipient_student_ids: list[int] | None = Field(default=None, min_length=1)

    @field_validator("title", "content")
    @classmethod
    def strip_announcement_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value


class AnnouncementUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    content: str | None = Field(default=None, min_length=1, max_length=20000)
    recipient_student_ids: list[int] | None = Field(default=None, min_length=1)

    @field_validator("title", "content")
    @classmethod
    def strip_announcement_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value

    @model_validator(mode="after")
    def reject_null_text_fields(self):
        for field in ("title", "content"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field.capitalize()} cannot be null.")
        return self


class AnnouncementResponse(APIBaseSchema):
    id: int
    course_id: int | None
    created_by_id: int
    title: str
    content: str
    published_at: datetime | None
    created_at: datetime
    course_title: str
    course_code: str
    author_name: str
    recipient_student_ids: list[int]


# -------------------------------------------------------------------
# Classroom discussions
# -------------------------------------------------------------------

class DiscussionPostCreate(BaseModel):
    message: str = Field(min_length=1, max_length=10000)

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A discussion message cannot be blank.")
        return value


class DiscussionPostUpdate(DiscussionPostCreate):
    pass


class DiscussionReplyResponse(BaseModel):
    id: int
    author_id: int
    author_name: str
    author_role: str
    message: str
    created_at: datetime
    updated_at: datetime


class DiscussionPostResponse(DiscussionReplyResponse):
    course_id: int
    replies: list[DiscussionReplyResponse] = Field(default_factory=list)


# -------------------------------------------------------------------
# Calendar
# -------------------------------------------------------------------

class CalendarEventCreate(BaseModel):
    course_id: int | None = None
    title: str = Field(min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    event_type: str = Field(default="general", min_length=1, max_length=40)
    start_at: datetime
    end_at: datetime

    @model_validator(mode="after")
    def validate_event_times(self):
        if self.end_at < self.start_at:
            raise ValueError("The event end time must be after its start time.")
        return self


class CalendarEventResponse(APIBaseSchema):
    id: int
    course_id: int | None
    created_by_id: int
    title: str
    description: str | None
    event_type: str
    start_at: datetime
    end_at: datetime
    created_at: datetime


# -------------------------------------------------------------------
# Student doubts
# -------------------------------------------------------------------

class DoubtCreate(BaseModel):
    course_id: int = Field(gt=0)
    title: str = Field(min_length=2, max_length=200)
    question: str = Field(min_length=3, max_length=20000)


class DoubtAnswer(BaseModel):
    answer: str = Field(min_length=1, max_length=20000)


class DoubtResponse(APIBaseSchema):
    id: int
    course_id: int
    student_id: int
    answered_by_id: int | None
    title: str
    question: str
    answer: str | None
    status: Literal["open", "answered", "closed"]
    created_at: datetime
    answered_at: datetime | None


# -------------------------------------------------------------------
# Notifications
# -------------------------------------------------------------------

class NotificationResponse(APIBaseSchema):
    id: int
    user_id: int
    title: str
    message: str
    notification_type: str
    link: str | None
    is_read: bool
    created_at: datetime
    read_at: datetime | None


# -------------------------------------------------------------------
# AI generation history
# -------------------------------------------------------------------

class AIGenerationCreate(BaseModel):
    course_id: int | None = None
    generation_type: str = Field(min_length=1, max_length=60)
    prompt: str = Field(min_length=1, max_length=20000)


class AIGenerationResponse(APIBaseSchema):
    id: int
    user_id: int
    course_id: int | None
    generation_type: str
    prompt: str
    result_text: str
    provider: str | None
    created_at: datetime


class AIChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)

    @field_validator("content")
    @classmethod
    def strip_ai_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message cannot be blank.")
        return value


class AIChatRequest(BaseModel):
    messages: list[AIChatMessage] = Field(min_length=1, max_length=12)

    @field_validator("messages")
    @classmethod
    def validate_conversation(cls, value: list[AIChatMessage]) -> list[AIChatMessage]:
        if value[0].role != "user" or value[-1].role != "user":
            raise ValueError("A conversation must begin and end with a user message.")
        if any(first.role == second.role for first, second in zip(value, value[1:])):
            raise ValueError("Conversation messages must alternate roles.")
        return value


class AIQuizRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=120)
    topic: str = Field(min_length=1, max_length=240)
    question_count: int = Field(default=5, ge=2, le=10)
    difficulty: Literal["beginner", "intermediate", "advanced"] = "intermediate"

    @field_validator("subject", "topic")
    @classmethod
    def strip_quiz_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value


class AIQuizAnswer(BaseModel):
    answer: str | None = Field(default=None, max_length=500)


class AIQuizSubmission(BaseModel):
    answers: list[AIQuizAnswer] = Field(min_length=1, max_length=10)


class AIStudyPlanRequest(BaseModel):
    horizon_days: int = Field(default=7, ge=1, le=30)
    hours_per_day: float = Field(default=2, gt=0, le=8, allow_inf_nan=False)
    focus_topics: str = Field(default="", max_length=2000)


class AITeacherMaterialRequest(BaseModel):
    kind: Literal["lesson_plan", "quiz", "assignment_suggestions"]
    subject: str = Field(min_length=1, max_length=120)
    topic: str = Field(min_length=1, max_length=240)
    target_group: str = Field(default="", max_length=120)
    details: str = Field(default="", max_length=2000)

    @field_validator("subject", "topic", "target_group", "details")
    @classmethod
    def strip_material_text(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def require_subject_and_topic(self):
        if not self.subject or not self.topic:
            raise ValueError("Subject and topic cannot be blank.")
        return self


class AITeacherMaterialSave(BaseModel):
    generation_type: Literal[
        "teacher_lesson_plan",
        "teacher_quiz",
        "teacher_assignment_suggestions",
    ]
    title: str = Field(min_length=1, max_length=200)
    prompt: str = Field(min_length=1, max_length=4000)
    result_text: str = Field(min_length=1, max_length=20000)

    @field_validator("title", "prompt", "result_text")
    @classmethod
    def strip_saved_material(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value


# -------------------------------------------------------------------
# Shared pagination
# -------------------------------------------------------------------

class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class PaginatedResponse(BaseModel):
    items: list[dict]
    total: int
    page: int
    page_size: int
    total_pages: int

class TeacherCourseResponse(CourseResponse):
    join_code: str
    enrollment_count: int


class StudentCourseResponse(CourseResponse):
    teacher_name: str
    teacher_email: str


class JoinCourseRequest(BaseModel):
    join_code: str = Field(min_length=10, max_length=12)

    @field_validator("join_code", mode="before")
    @classmethod
    def normalize_join_code(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip().upper()
        return value


class EnrolledStudentResponse(APIBaseSchema):
    id: int
    full_name: str
    email: str
    enrolled_at: datetime
