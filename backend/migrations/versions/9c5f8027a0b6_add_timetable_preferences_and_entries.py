"""add timetable preferences and entries

Revision ID: 9c5f8027a0b6
Revises: d21a64b9c730
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9c5f8027a0b6"
down_revision: Union[str, Sequence[str], None] = "d21a64b9c730"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "timetable_preferences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("timetable_mode", sa.String(length=20), nullable=False, server_default="weekly"),
        sa.Column("day_order_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("teaching_weekdays", sa.JSON(), nullable=False),
        sa.Column("first_teaching_date", sa.Date(), nullable=True),
        sa.Column("first_day_order", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("holiday_policy", sa.String(length=20), nullable=False, server_default="skip"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_timetable_preferences_user"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_timetable_preferences_id"), "timetable_preferences", ["id"], unique=False)

    op.create_table(
        "timetable_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=True),
        sa.Column("day_order", sa.Integer(), nullable=True),
        sa.Column("start_time", sa.String(length=20), nullable=False),
        sa.Column("end_time", sa.String(length=20), nullable=False),
        sa.Column("location", sa.String(length=200), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_timetable_entries_id"), "timetable_entries", ["id"], unique=False)
    op.create_index(op.f("ix_timetable_entries_user_id"), "timetable_entries", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_timetable_entries_user_id"), table_name="timetable_entries")
    op.drop_index(op.f("ix_timetable_entries_id"), table_name="timetable_entries")
    op.drop_table("timetable_entries")
    op.drop_index(op.f("ix_timetable_preferences_id"), table_name="timetable_preferences")
    op.drop_table("timetable_preferences")
