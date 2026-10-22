"""add configurable daily focus goal

Revision ID: a8c3d1f9b624
Revises: d7b2a6e14f09
Create Date: 2026-10-23 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a8c3d1f9b624"
down_revision: str | Sequence[str] | None = "d7b2a6e14f09"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column(
            "daily_focus_goal_minutes",
            sa.Integer(),
            server_default="360",
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "ck_user_settings_daily_focus_goal_range",
        "user_settings",
        "daily_focus_goal_minutes BETWEEN 30 AND 1440",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_user_settings_daily_focus_goal_range",
        "user_settings",
        type_="check",
    )
    op.drop_column("user_settings", "daily_focus_goal_minutes")
