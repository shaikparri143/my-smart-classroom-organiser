"""add notification deduplication key

Revision ID: ad71c2e5f904
Revises: 5a0d8bc12e74
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "ad71c2e5f904"
down_revision: Union[str, Sequence[str], None] = "5a0d8bc12e74"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column("dedupe_key", sa.String(length=200), nullable=True),
    )
    op.create_index(
        "uq_notifications_dedupe_key",
        "notifications",
        ["dedupe_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_notifications_dedupe_key", table_name="notifications")
    op.drop_column("notifications", "dedupe_key")
