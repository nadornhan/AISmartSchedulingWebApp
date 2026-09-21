"""add weekly insight local week cache key

Revision ID: d7b2a6e14f09
Revises: c6a1f4e92b08
Create Date: 2026-09-21 00:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d7b2a6e14f09"
down_revision: str | Sequence[str] | None = "c6a1f4e92b08"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "weekly_ai_insights",
        sa.Column("cache_week_start", sa.Date(), nullable=True),
    )
    op.execute(
        """
        UPDATE weekly_ai_insights
        SET cache_week_start = (
            period_end AT TIME ZONE COALESCE(metrics ->> 'timezone', 'UTC')
        )::date
        """
    )
    op.execute(
        """
        DELETE FROM weekly_ai_insights older
        USING weekly_ai_insights newer
        WHERE older.user_id = newer.user_id
          AND older.cache_week_start = newer.cache_week_start
          AND (
              older.created_at < newer.created_at
              OR (older.created_at = newer.created_at AND older.id::text < newer.id::text)
          )
        """
    )
    op.alter_column("weekly_ai_insights", "cache_week_start", nullable=False)
    op.create_unique_constraint(
        "unique_weekly_ai_insight_user_local_week",
        "weekly_ai_insights",
        ["user_id", "cache_week_start"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "unique_weekly_ai_insight_user_local_week",
        "weekly_ai_insights",
        type_="unique",
    )
    op.drop_column("weekly_ai_insights", "cache_week_start")
