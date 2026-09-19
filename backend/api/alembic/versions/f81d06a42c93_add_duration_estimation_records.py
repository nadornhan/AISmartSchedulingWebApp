"""Add duration decisions and pre-focus baselines.

Revision ID: f81d06a42c93
Revises: 9f3a6c1d8e42
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "f81d06a42c93"
down_revision = "9f3a6c1d8e42"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "duration_estimate_decisions",
        sa.Column("proposal_id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "task_id", sa.Uuid(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("action", sa.String(16), nullable=False),
        sa.Column("applied_duration_minutes", sa.Integer(), nullable=True),
        sa.Column("request_fingerprint", sa.String(64), nullable=False),
        sa.Column("task_snapshot_after", sa.String(64), nullable=False),
        sa.Column("estimate", postgresql.JSONB(), nullable=False),
        sa.Column("response", postgresql.JSONB(), nullable=False),
        sa.Column(
            "resolved_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "action IN ('accepted', 'changed', 'ignored')", name="ck_duration_action"
        ),
        sa.CheckConstraint(
            "(action = 'ignored' AND applied_duration_minutes IS NULL) OR "
            "(action IN ('accepted', 'changed') AND applied_duration_minutes BETWEEN 1 AND 10080)",
            name="ck_duration_applied_minutes",
        ),
    )
    op.create_index(
        "ix_duration_decisions_user_task",
        "duration_estimate_decisions",
        ["user_id", "task_id", "resolved_at"],
    )
    op.create_table(
        "task_duration_baselines",
        sa.Column(
            "task_id", sa.Uuid(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("estimated_minutes", sa.Integer(), nullable=True),
        sa.Column("reference_source", sa.String(32), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_task_duration_baselines_user_id", "task_duration_baselines", ["user_id"])


def downgrade():
    op.drop_table("task_duration_baselines")
    op.drop_table("duration_estimate_decisions")
