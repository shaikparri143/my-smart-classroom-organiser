"""add assignment recipients and submission resources

Revision ID: 5a0d8bc12e74
Revises: 09b129747250
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "5a0d8bc12e74"
down_revision: Union[str, Sequence[str], None] = "09b129747250"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assignment_recipients",
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["assignment_id"], ["assignments.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("assignment_id", "student_id"),
    )
    op.create_table(
        "submission_resources",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("submission_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("external_url", sa.String(length=2000), nullable=True),
        sa.Column("storage_key", sa.String(length=80), nullable=True),
        sa.Column("content_type", sa.String(length=150), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(kind = 'link' AND external_url IS NOT NULL AND storage_key IS NULL) OR "
            "(kind = 'file' AND external_url IS NULL AND storage_key IS NOT NULL)",
            name="ck_submission_resource_location",
        ),
        sa.ForeignKeyConstraint(
            ["submission_id"], ["submissions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key"),
    )
    op.create_index(
        "ix_submission_resources_submission_id",
        "submission_resources",
        ["submission_id"],
    )

    connection = op.get_bind()
    connection.execute(
        sa.text(
            "INSERT INTO assignment_recipients (assignment_id, student_id) "
            "SELECT assignments.id, enrollments.student_id "
            "FROM assignments "
            "JOIN enrollments ON enrollments.course_id = assignments.course_id"
        )
    )
    connection.execute(
        sa.text(
            "INSERT INTO submission_resources "
            "(submission_id, kind, name, external_url, storage_key, content_type, size_bytes) "
            "SELECT id, 'link', 'Previously submitted link', file_url, NULL, NULL, NULL "
            "FROM submissions WHERE file_url IS NOT NULL AND file_url <> ''"
        )
    )


def downgrade() -> None:
    op.drop_index(
        "ix_submission_resources_submission_id",
        table_name="submission_resources",
    )
    op.drop_table("submission_resources")
    op.drop_table("assignment_recipients")
