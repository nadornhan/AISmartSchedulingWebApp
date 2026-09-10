"""extend focus session lifecycle

Revision ID: e7f4a2c91b63
Revises: d2b9e5f03c18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e7f4a2c91b63"
down_revision: str | Sequence[str] | None = "d2b9e5f03c18"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("focus_sessions", sa.Column("planned_duration_minutes", sa.Integer(), nullable=True))
    op.add_column(
        "focus_sessions",
        sa.Column("actual_duration_seconds", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "focus_sessions",
        sa.Column("status", sa.String(length=24), server_default="active", nullable=False),
    )
    op.add_column(
        "focus_sessions",
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.execute("UPDATE focus_sessions SET planned_duration_minutes = duration_minutes")
    op.execute("UPDATE focus_sessions SET actual_duration_seconds = duration_minutes * 60")
    op.execute("UPDATE focus_sessions SET status = CASE WHEN completed THEN 'completed' ELSE 'cancelled' END")
    op.alter_column("focus_sessions", "planned_duration_minutes", nullable=False)
    op.alter_column("focus_sessions", "ended_at", existing_type=sa.DateTime(timezone=True), nullable=True)
    op.create_index("ix_focus_sessions_status", "focus_sessions", ["status"])
    op.create_check_constraint(
        "ck_focus_sessions_planned_duration_positive",
        "focus_sessions",
        "planned_duration_minutes > 0",
    )
    op.create_check_constraint(
        "ck_focus_sessions_actual_duration_nonnegative",
        "focus_sessions",
        "actual_duration_seconds >= 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_focus_sessions_actual_duration_nonnegative", "focus_sessions", type_="check")
    op.drop_constraint("ck_focus_sessions_planned_duration_positive", "focus_sessions", type_="check")
    op.drop_index("ix_focus_sessions_status", table_name="focus_sessions")
    op.execute("UPDATE focus_sessions SET ended_at = started_at WHERE ended_at IS NULL")
    op.alter_column("focus_sessions", "ended_at", existing_type=sa.DateTime(timezone=True), nullable=False)
    op.drop_column("focus_sessions", "updated_at")
    op.drop_column("focus_sessions", "status")
    op.drop_column("focus_sessions", "actual_duration_seconds")
    op.drop_column("focus_sessions", "planned_duration_minutes")
