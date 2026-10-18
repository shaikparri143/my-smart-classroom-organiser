"""constrain attendance threshold to a percentage

Revision ID: d21a64b9c730
Revises: c4b8a218f301
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d21a64b9c730"
down_revision: Union[str, Sequence[str], None] = "c4b8a218f301"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_course_attendance_threshold",
        "courses",
        "attendance_threshold >= 0 AND attendance_threshold <= 100",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_course_attendance_threshold", "courses", type_="check"
    )
