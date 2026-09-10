"""create user settings table

Revision ID: 8c4d2f0a9b31
Revises: f6c2d9b4a8e1
Create Date: 2026-08-11 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8c4d2f0a9b31"
down_revision: str | Sequence[str] | None = "f6c2d9b4a8e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Persist per-user scheduling and notification preferences."""

    op.create_table(
        "user_settings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "work_start",
            sa.Time(),
            server_default="09:00:00",
            nullable=False,
        ),
        sa.Column(
            "work_end",
            sa.Time(),
            server_default="17:00:00",
            nullable=False,
        ),
        sa.Column(
            "pomodoro_minutes",
            sa.Integer(),
            server_default="25",
            nullable=False,
        ),
        sa.Column(
            "ai_assistant_enabled",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "ai_deadline_urgency_weight",
            sa.Integer(),
            server_default="80",
            nullable=False,
        ),
        sa.Column(
            "ai_priority_weight",
            sa.Integer(),
            server_default="70",
            nullable=False,
        ),
        sa.Column(
            "ai_estimated_duration_weight",
            sa.Integer(),
            server_default="50",
            nullable=False,
        ),
        sa.Column(
            "notify_task_reminders",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "notify_productivity_reminders",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "notify_daily_digest",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "notify_overdue_alerts",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "notify_focus_do_not_disturb",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "notify_weekly_report",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "channel_desktop",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "channel_push",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "channel_email",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
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
            "pomodoro_minutes BETWEEN 1 AND 240",
            name="ck_user_settings_pomodoro_minutes_range",
        ),
        sa.CheckConstraint(
            "ai_deadline_urgency_weight BETWEEN 0 AND 100",
            name="ck_user_settings_deadline_weight_range",
        ),
        sa.CheckConstraint(
            "ai_priority_weight BETWEEN 0 AND 100",
            name="ck_user_settings_priority_weight_range",
        ),
        sa.CheckConstraint(
            "ai_estimated_duration_weight BETWEEN 0 AND 100",
            name="ck_user_settings_duration_weight_range",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(
        "ix_user_settings_user_id",
        "user_settings",
        ["user_id"],
    )


def downgrade() -> None:
    """Remove persisted user settings."""

    op.drop_index("ix_user_settings_user_id", table_name="user_settings")
    op.drop_table("user_settings")
