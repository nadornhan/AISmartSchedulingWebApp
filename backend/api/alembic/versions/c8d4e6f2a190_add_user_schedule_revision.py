"""add minimal user schedule revision

Revision ID: c8d4e6f2a190
Revises: a3f7c2e91b64
Create Date: 2026-09-15 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c8d4e6f2a190"
down_revision: str | Sequence[str] | None = "a3f7c2e91b64"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_schedule_states",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "revision",
            sa.BigInteger(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("user_schedule_states")
