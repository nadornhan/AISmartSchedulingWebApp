"""create weekly AI insights

Revision ID: ac4e9b2d7310
Revises: 9f3a6c1d8e42
Create Date: 2026-09-14 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "ac4e9b2d7310"
down_revision: str | Sequence[str] | None = "9f3a6c1d8e42"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "weekly_ai_insights",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("narrative", sa.Text(), nullable=False),
        sa.Column("model", sa.String(length=128), nullable=False),
        sa.Column("prompt_version", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "period_start",
            "period_end",
            name="unique_weekly_ai_insight_user_period",
        ),
    )
    op.create_index(
        op.f("ix_weekly_ai_insights_user_id"),
        "weekly_ai_insights",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_weekly_ai_insights_user_created_at",
        "weekly_ai_insights",
        ["user_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_weekly_ai_insights_user_created_at",
        table_name="weekly_ai_insights",
    )
    op.drop_index(
        op.f("ix_weekly_ai_insights_user_id"),
        table_name="weekly_ai_insights",
    )
    op.drop_table("weekly_ai_insights")
