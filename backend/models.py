
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('student', 'teacher', 'admin')",
            name="ck_users_role",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="student")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    taught_courses: Mapped[list["Course"]] = relationship(
        back_populates="teacher",
        foreign_keys="Course.teacher_id",
    )
    enrollments: Mapped[list["Enrollment"]] = relationship(
        back_populates="student",
        foreign_keys="Enrollment.student_id",
        cascade="all, delete-orphan",
    )
    attendance_marked: Mapped[list["AttendanceRecord"]] = relationship(
        back_populates="marked_by",
        foreign_keys="AttendanceRecord.marked_by_id",
    )
    submissions: Mapped[list["Submission"]] = relationship(
        back_populates="student",
        foreign_keys="Submission.student_id",
    )
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    doubts_asked: Mapped[list["Doubt"]] = relationship(
        back_populates="student",
        foreign_keys="Doubt.student_id",
    )
    ai_generations: Mapped[list["AIGeneration"]] = relationship(
        back_populates="user"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        back_populates="actor",
        foreign_keys="AuditLog.actor_id",
    )
    timetable_preferences: Mapped["TimetablePreference | None"] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    timetable_entries: Mapped[list["TimetableEntry"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (
        UniqueConstraint(
            "course_code",
            "semester",
            "section",
            name="uq_courses_code_semester_section",
        ),
        CheckConstraint(
            "attendance_threshold >= 0 AND attendance_threshold <= 100",
            name="ck_course_attendance_threshold",
        ),
        Index("ix_courses_teacher_id", "teacher_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    join_code: Mapped[str] = mapped_column(
    String(12),
    nullable=False,
    unique=True,
    index=True,)
    course_code: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    semester: Mapped[str] = mapped_column(
        String(30), nullable=False, default="Not specified"
    )
    section: Mapped[str] = mapped_column(String(30), nullable=False, default="A")
    attendance_threshold: Mapped[float] = mapped_column(
        Float, nullable=False, default=75.0, server_default="75"
    )
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    teacher: Mapped["User"] = relationship(
        back_populates="taught_courses",
        foreign_keys=[teacher_id],
    )
    enrollments: Mapped[list["Enrollment"]] = relationship(
        back_populates="course",
        cascade="all, delete-orphan",
    )
    attendance_records: Mapped[list["AttendanceRecord"]] = relationship(
        back_populates="course",
        cascade="all, delete-orphan",
    )
    assignments: Mapped[list["Assignment"]] = relationship(
        back_populates="course",
        cascade="all, delete-orphan",
    )
    announcements: Mapped[list["Announcement"]] = relationship(
        back_populates="course",
    )
    calendar_events: Mapped[list["CalendarEvent"]] = relationship(
        back_populates="course",
    )
    doubts: Mapped[list["Doubt"]] = relationship(
        back_populates="course",
    )


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("student_id", "course_id", name="uq_enrollment_student_course"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    student: Mapped["User"] = relationship(
        back_populates="enrollments",
        foreign_keys=[student_id],
    )
    course: Mapped["Course"] = relationship(back_populates="enrollments")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint(
            "course_id",
            "student_id",
            "attendance_date",
            name="uq_attendance_course_student_date",
        ),
        CheckConstraint(
            "status IN ('present', 'absent', 'late', 'excused')",
            name="ck_attendance_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    marked_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    course: Mapped["Course"] = relationship(back_populates="attendance_records")
    student: Mapped["User"] = relationship(foreign_keys=[student_id])
    marked_by: Mapped["User"] = relationship(
        back_populates="attendance_marked",
        foreign_keys=[marked_by_id],
    )


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    max_points: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    attachment_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    course: Mapped["Course"] = relationship(back_populates="assignments")
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])
    submissions: Mapped[list["Submission"]] = relationship(
        back_populates="assignment",
        cascade="all, delete-orphan",
    )
    recipients: Mapped[list["AssignmentRecipient"]] = relationship(
        back_populates="assignment",
        cascade="all, delete-orphan",
    )


class AssignmentRecipient(Base):
    __tablename__ = "assignment_recipients"

    assignment_id: Mapped[int] = mapped_column(
        ForeignKey("assignments.id", ondelete="CASCADE"), primary_key=True
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )

    assignment: Mapped["Assignment"] = relationship(back_populates="recipients")
    student: Mapped["User"] = relationship()


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (
        UniqueConstraint(
            "assignment_id",
            "student_id",
            name="uq_submission_assignment_student",
        ),
        CheckConstraint(
            "status IN ('submitted', 'late', 'resubmitted')",
            name="ck_submission_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    assignment_id: Mapped[int] = mapped_column(
        ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    text_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="submitted")
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    assignment: Mapped["Assignment"] = relationship(back_populates="submissions")
    student: Mapped["User"] = relationship(
        back_populates="submissions",
        foreign_keys=[student_id],
    )
    grade: Mapped["Grade | None"] = relationship(
        back_populates="submission",
        uselist=False,
        cascade="all, delete-orphan",
    )
    resources: Mapped[list["SubmissionResource"]] = relationship(
        back_populates="submission",
        cascade="all, delete-orphan",
    )


class SubmissionResource(Base):
    __tablename__ = "submission_resources"
    __table_args__ = (
        CheckConstraint(
            "(kind = 'link' AND external_url IS NOT NULL AND storage_key IS NULL) OR "
            "(kind = 'file' AND external_url IS NULL AND storage_key IS NOT NULL)",
            name="ck_submission_resource_location",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    external_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    storage_key: Mapped[str | None] = mapped_column(String(80), nullable=True, unique=True)
    content_type: Mapped[str | None] = mapped_column(String(150), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    submission: Mapped["Submission"] = relationship(back_populates="resources")


class Grade(Base):
    __tablename__ = "grades"
    __table_args__ = (
        CheckConstraint("score >= 0", name="ck_grade_score_nonnegative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    graded_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    score: Mapped[float] = mapped_column(Float, nullable=False)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    graded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    submission: Mapped["Submission"] = relationship(back_populates="grade")
    graded_by: Mapped["User"] = relationship(foreign_keys=[graded_by_id])


class AssessmentComponent(Base):
    __tablename__ = "assessment_components"
    __table_args__ = (
        UniqueConstraint("course_id", "name", name="uq_assessment_course_name"),
        CheckConstraint("max_marks > 0", name="ck_assessment_component_max_marks"),
        CheckConstraint("display_order >= 0", name="ck_assessment_component_order"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_marks: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    assessment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_archived: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ComponentMark(Base):
    __tablename__ = "component_marks"
    __table_args__ = (
        UniqueConstraint(
            "component_id", "student_id", name="uq_component_mark_student"
        ),
        CheckConstraint("score >= 0", name="ck_component_mark_nonnegative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    component_id: Mapped[int] = mapped_column(
        ForeignKey("assessment_components.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    graded_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    score: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    course_id: Mapped[int | None] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL"), nullable=True
    )
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    course: Mapped["Course | None"] = relationship(back_populates="announcements")
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])
    recipients: Mapped[list["AnnouncementRecipient"]] = relationship(
        back_populates="announcement",
        cascade="all, delete-orphan",
    )


class AnnouncementRecipient(Base):
    __tablename__ = "announcement_recipients"
    __table_args__ = (Index("ix_announcement_recipients_student_id", "student_id"),)

    announcement_id: Mapped[int] = mapped_column(
        ForeignKey("announcements.id", ondelete="CASCADE"), primary_key=True
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )

    announcement: Mapped["Announcement"] = relationship(back_populates="recipients")
    student: Mapped["User"] = relationship()


class TimetablePreference(Base):
    __tablename__ = "timetable_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    timetable_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, default="weekly"
    )
    day_order_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    teaching_weekdays: Mapped[list[int]] = mapped_column(JSON, nullable=False, default=lambda: [1, 2, 3, 4, 5])
    first_teaching_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    first_day_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    holiday_policy: Mapped[str] = mapped_column(
        String(20), nullable=False, default="skip"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="timetable_preferences")


class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id: Mapped[int | None] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    weekday: Mapped[int | None] = mapped_column(Integer, nullable=True)
    day_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    start_time: Mapped[str] = mapped_column(String(20), nullable=False)
    end_time: Mapped[str] = mapped_column(String(20), nullable=False)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="timetable_entries")
    course: Mapped["Course | None"] = relationship()


class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    __table_args__ = (
        CheckConstraint("end_at >= start_at", name="ck_calendar_event_time_order"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    course_id: Mapped[int | None] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL"), nullable=True
    )
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_type: Mapped[str] = mapped_column(
        String(40), nullable=False, default="general"
    )
    start_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    end_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    course: Mapped["Course | None"] = relationship(back_populates="calendar_events")
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])


class Doubt(Base):
    __tablename__ = "doubts"
    __table_args__ = (
        CheckConstraint(
            "status IN ('open', 'answered', 'closed')",
            name="ck_doubt_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    answered_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    answered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    course: Mapped["Course"] = relationship(back_populates="doubts")
    student: Mapped["User"] = relationship(
        back_populates="doubts_asked",
        foreign_keys=[student_id],
    )
    answered_by: Mapped["User | None"] = relationship(
        foreign_keys=[answered_by_id]
    )


class DiscussionPost(Base):
    __tablename__ = "discussion_posts"
    __table_args__ = (
        Index("ix_discussion_posts_course_created", "course_id", "created_at"),
        Index("ix_discussion_posts_parent_id", "parent_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("discussion_posts.id", ondelete="CASCADE"), nullable=True
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    author: Mapped["User"] = relationship(foreign_keys=[author_id])
    parent: Mapped["DiscussionPost | None"] = relationship(
        back_populates="replies",
        remote_side=[id],
    )
    replies: Mapped[list["DiscussionPost"]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="DiscussionPost.created_at",
    )


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("uq_notifications_dedupe_key", "dedupe_key", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(
        String(40), nullable=False, default="general"
    )
    dedupe_key: Mapped[str | None] = mapped_column(String(200), nullable=True)
    link: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship(back_populates="notifications")


class AIGeneration(Base):
    __tablename__ = "ai_generations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    course_id: Mapped[int | None] = mapped_column(
        ForeignKey("courses.id", ondelete="SET NULL"), nullable=True
    )
    generation_type: Mapped[str] = mapped_column(String(60), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    result_text: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="ai_generations")
    course: Mapped["Course | None"] = relationship()


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    actor_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    actor: Mapped["User | None"] = relationship(
        back_populates="audit_logs",
        foreign_keys=[actor_id],
    )
