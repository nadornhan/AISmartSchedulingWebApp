"""add intelligent rescheduling foundation

Revision ID: a3f7c2e91b64
Revises: 9f3a6c1d8e42
Create Date: 2026-09-15 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a3f7c2e91b64"
down_revision: str | Sequence[str] | None = "9f3a6c1d8e42"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column(
            "schedule_locked",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "ck_tasks_locked_schedule_complete",
        "tasks",
        "NOT schedule_locked OR "
        "(scheduled_start IS NOT NULL AND scheduled_end IS NOT NULL "
        "AND scheduled_end > scheduled_start)",
    )

    op.create_table(
        "reschedule_proposals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            server_default="preview",
            nullable=False,
        ),
        sa.Column("state_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("detected_context", sa.JSON(), nullable=False),
        sa.Column("state_snapshot", sa.JSON(), nullable=False),
        sa.Column("alternatives", sa.JSON(), nullable=False),
        sa.Column("selected_option_id", sa.Uuid(), nullable=True),
        sa.Column("before_snapshot", sa.JSON(), nullable=True),
        sa.Column("after_snapshot", sa.JSON(), nullable=True),
        sa.Column("ai_explanations", sa.JSON(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("undone_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
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
        sa.CheckConstraint(
            "status IN ('preview', 'applied', 'undone', 'superseded', 'expired')",
            name="ck_reschedule_proposals_status_allowed",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_reschedule_proposals_user_status_created_at",
        "reschedule_proposals",
        ["user_id", "status", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_reschedule_proposals_user_status_created_at",
        table_name="reschedule_proposals",
    )
    op.drop_table("reschedule_proposals")
    op.drop_constraint(
        "ck_tasks_locked_schedule_complete",
        "tasks",
        type_="check",
    )
    op.drop_column("tasks", "schedule_locked")
