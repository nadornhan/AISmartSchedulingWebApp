"""create focus sessions and ai scheduling tables

Revision ID: a9c3e1f7b204
Revises: 1f0e9c2d7a64
Create Date: 2026-08-13 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a9c3e1f7b204"
down_revision: str | Sequence[str] | None = "1f0e9c2d7a64"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "focus_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column(
            "completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "duration_minutes > 0",
            name="ck_focus_sessions_duration_positive",
        ),
    )
    op.create_index("ix_focus_sessions_user_id", "focus_sessions", ["user_id"])
    op.create_index("ix_focus_sessions_task_id", "focus_sessions", ["task_id"])
    op.create_index(
        "ix_focus_sessions_started_at",
        "focus_sessions",
        ["started_at"],
    )

    op.create_table(
        "ai_recommendations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=True),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("reasons", sa.JSON(), nullable=False),
        sa.Column("based_on", sa.JSON(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False, server_default="0"),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("weights_snapshot", sa.JSON(), nullable=False),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_recommendations_user_id",
        "ai_recommendations",
        ["user_id"],
    )
    op.create_index(
        "ix_ai_recommendations_status",
        "ai_recommendations",
        ["status"],
    )

    op.create_table(
        "ai_schedule_suggestions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("recommendation_id", sa.Uuid(), nullable=True),
        sa.Column("task_id", sa.Uuid(), nullable=False),
        sa.Column("suggested_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("suggested_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "position",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["recommendation_id"],
            ["ai_recommendations.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "suggested_end > suggested_start",
            name="ck_ai_schedule_suggestions_range",
        ),
    )
    op.create_index(
        "ix_ai_schedule_suggestions_user_id",
        "ai_schedule_suggestions",
        ["user_id"],
    )
    op.create_index(
        "ix_ai_schedule_suggestions_status",
        "ai_schedule_suggestions",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_ai_schedule_suggestions_status",
        table_name="ai_schedule_suggestions",
    )
    op.drop_index(
        "ix_ai_schedule_suggestions_user_id",
        table_name="ai_schedule_suggestions",
    )
    op.drop_table("ai_schedule_suggestions")
    op.drop_index("ix_ai_recommendations_status", table_name="ai_recommendations")
    op.drop_index("ix_ai_recommendations_user_id", table_name="ai_recommendations")
    op.drop_table("ai_recommendations")
    op.drop_index("ix_focus_sessions_started_at", table_name="focus_sessions")
    op.drop_index("ix_focus_sessions_task_id", table_name="focus_sessions")
    op.drop_index("ix_focus_sessions_user_id", table_name="focus_sessions")
    op.drop_table("focus_sessions")
