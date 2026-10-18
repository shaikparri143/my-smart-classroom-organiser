"""add flexible assessment components and attendance threshold

Revision ID: c4b8a218f301
Revises: b872f1c6a4d3
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4b8a218f301"
down_revision: Union[str, Sequence[str], None] = "b872f1c6a4d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "courses",
        sa.Column(
            "attendance_threshold",
            sa.Float(),
            server_default=sa.text("75"),
            nullable=False,
        ),
    )
    op.create_table(
        "assessment_components",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("max_marks", sa.Numeric(12, 2), nullable=False),
        sa.Column("assessment_date", sa.Date(), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column(
            "is_archived",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "is_published",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "max_marks > 0", name="ck_assessment_component_max_marks"
        ),
        sa.CheckConstraint(
            "display_order >= 0", name="ck_assessment_component_order"
        ),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("course_id", "name", name="uq_assessment_course_name"),
    )
    op.create_index(
        "ix_assessment_components_id", "assessment_components", ["id"], unique=False
    )
    op.create_index(
        "ix_assessment_components_course_id",
        "assessment_components",
        ["course_id"],
        unique=False,
    )
    op.create_table(
        "component_marks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("component_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("graded_by_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.Numeric(12, 2), nullable=False),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("score >= 0", name="ck_component_mark_nonnegative"),
        sa.ForeignKeyConstraint(
            ["component_id"], ["assessment_components.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["graded_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "component_id", "student_id", name="uq_component_mark_student"
        ),
    )
    op.create_index("ix_component_marks_id", "component_marks", ["id"], unique=False)
    op.create_index(
        "ix_component_marks_component_id",
        "component_marks",
        ["component_id"],
        unique=False,
    )
    op.create_index(
        "ix_component_marks_student_id",
        "component_marks",
        ["student_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_component_marks_student_id", table_name="component_marks")
    op.drop_index("ix_component_marks_component_id", table_name="component_marks")
    op.drop_index("ix_component_marks_id", table_name="component_marks")
    op.drop_table("component_marks")
    op.drop_index(
        "ix_assessment_components_course_id", table_name="assessment_components"
    )
    op.drop_index("ix_assessment_components_id", table_name="assessment_components")
    op.drop_table("assessment_components")
    op.drop_column("courses", "attendance_threshold")
