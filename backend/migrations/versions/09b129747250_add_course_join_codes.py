
"""add course join codes

Revision ID: 09b129747250
Revises: 3dc10b300e76
"""

import secrets
import string
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "09b129747250"
down_revision: Union[str, Sequence[str], None] = "3dc10b300e76"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def generate_join_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(10))


def upgrade() -> None:
    # Add the column as nullable so existing courses remain valid.
    op.add_column(
        "courses",
        sa.Column("join_code", sa.String(length=12), nullable=True),
    )

    # Backfill a unique code for every existing course.
    connection = op.get_bind()
    courses = connection.execute(
        sa.text("SELECT id FROM courses ORDER BY id")
    ).fetchall()

    used_codes = set()

    for course in courses:
        while True:
            code = generate_join_code()
            if code not in used_codes:
                used_codes.add(code)
                break

        connection.execute(
            sa.text(
                "UPDATE courses SET join_code = :code WHERE id = :course_id"
            ),
            {"code": code, "course_id": course.id},
        )

    # Enforce the model's NOT NULL and uniqueness requirements.
    op.alter_column(
        "courses",
        "join_code",
        existing_type=sa.String(length=12),
        nullable=False,
    )
    op.create_index(
        "ix_courses_join_code",
        "courses",
        ["join_code"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_courses_join_code", table_name="courses")
    op.drop_column("courses", "join_code")
