"""add daily work limit

Revision ID: d9a7f3c6b201
Revises: c8d4e6f2a190
Create Date: 2026-09-15 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d9a7f3c6b201"
down_revision: str | Sequence[str] | None = "c8d4e6f2a190"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column(
            "daily_work_limit_minutes",
            sa.Integer(),
            server_default="480",
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "ck_user_settings_daily_work_limit_range",
        "user_settings",
        "daily_work_limit_minutes BETWEEN 30 AND 1440",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_user_settings_daily_work_limit_range",
        "user_settings",
        type_="check",
    )
    op.drop_column("user_settings", "daily_work_limit_minutes")
