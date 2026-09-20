"""add timezone source

Revision ID: c6a1f4e92b08
Revises: b4e7c9a1d205, f81d06a42c93
Create Date: 2026-09-21 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c6a1f4e92b08"
down_revision: str | Sequence[str] | None = ("b4e7c9a1d205", "f81d06a42c93")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column("timezone_source", sa.String(length=16), server_default="default", nullable=False),
    )
    op.execute(
        "UPDATE user_settings SET timezone_source = 'user' WHERE timezone <> 'UTC'"
    )
    op.create_check_constraint(
        "ck_user_settings_timezone_source_allowed",
        "user_settings",
        "timezone_source IN ('default', 'detected', 'user')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_user_settings_timezone_source_allowed",
        "user_settings",
        type_="check",
    )
    op.drop_column("user_settings", "timezone_source")
