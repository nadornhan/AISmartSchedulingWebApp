"""create AI generation events

Revision ID: 5d7a1c9e4b20
Revises: 4a6d9c2f1b08
Create Date: 2026-09-09 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "5d7a1c9e4b20"
down_revision: str | Sequence[str] | None = "4a6d9c2f1b08"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_generation_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("feature", sa.String(length=64), nullable=False),
        sa.Column("prompt_version", sa.String(length=64), nullable=False),
        sa.Column("outcome", sa.String(length=16), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("model", sa.String(length=128), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column("thinking_tokens", sa.Integer(), nullable=False),
        sa.Column("total_tokens", sa.Integer(), nullable=False),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "outcome IN ('success', 'fallback', 'failure')",
            name="ck_ai_generation_events_outcome_allowed",
        ),
        sa.CheckConstraint(
            "input_tokens >= 0 AND output_tokens >= 0 AND "
            "thinking_tokens >= 0 AND total_tokens >= 0 AND latency_ms >= 0",
            name="ck_ai_generation_events_metrics_nonnegative",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_generation_events_feature_created_at",
        "ai_generation_events",
        ["feature", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_ai_generation_events_user_created_at",
        "ai_generation_events",
        ["user_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_ai_generation_events_user_created_at",
        table_name="ai_generation_events",
    )
    op.drop_index(
        "ix_ai_generation_events_feature_created_at",
        table_name="ai_generation_events",
    )
    op.drop_table("ai_generation_events")
