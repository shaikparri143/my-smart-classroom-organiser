"""add announcement recipients and classroom discussions

Revision ID: b872f1c6a4d3
Revises: ad71c2e5f904
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b872f1c6a4d3"
down_revision: Union[str, Sequence[str], None] = "ad71c2e5f904"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "announcement_recipients",
        sa.Column("announcement_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["announcement_id"], ["announcements.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("announcement_id", "student_id"),
    )
    op.create_index(
        "ix_announcement_recipients_student_id",
        "announcement_recipients",
        ["student_id"],
        unique=False,
    )
    op.execute(
        sa.text(
            "INSERT INTO announcement_recipients (announcement_id, student_id) "
            "SELECT announcements.id, enrollments.student_id "
            "FROM announcements "
            "JOIN enrollments ON enrollments.course_id = announcements.course_id "
            "WHERE announcements.course_id IS NOT NULL"
        )
    )
    op.create_table(
        "discussion_posts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
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
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["parent_id"], ["discussion_posts.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_discussion_posts_id", "discussion_posts", ["id"])
    op.create_index(
        "ix_discussion_posts_course_created",
        "discussion_posts",
        ["course_id", "created_at"],
    )
    op.create_index(
        "ix_discussion_posts_parent_id",
        "discussion_posts",
        ["parent_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_discussion_posts_parent_id", table_name="discussion_posts")
    op.drop_index("ix_discussion_posts_course_created", table_name="discussion_posts")
    op.drop_index("ix_discussion_posts_id", table_name="discussion_posts")
    op.drop_table("discussion_posts")
    op.drop_index(
        "ix_announcement_recipients_student_id",
        table_name="announcement_recipients",
    )
    op.drop_table("announcement_recipients")
