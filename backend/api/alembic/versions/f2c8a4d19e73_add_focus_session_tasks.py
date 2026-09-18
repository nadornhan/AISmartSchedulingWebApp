"""add focus session tasks

Revision ID: f2c8a4d19e73
Revises: d9a7f3c6b201, ac4e9b2d7310
Create Date: 2026-09-17 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f2c8a4d19e73"
down_revision: str | Sequence[str] | None = ("d9a7f3c6b201", "ac4e9b2d7310")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "focus_session_tasks",
        sa.Column("focus_session_id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["focus_session_id"],
            ["focus_sessions.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("focus_session_id", "task_id"),
    )
    op.create_index(
        "ix_focus_session_tasks_task_id",
        "focus_session_tasks",
        ["task_id"],
    )
    op.execute(
        """
        INSERT INTO focus_session_tasks (focus_session_id, task_id)
        SELECT id, task_id
        FROM focus_sessions
        WHERE task_id IS NOT NULL
        ON CONFLICT DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_focus_session_tasks_task_id",
        table_name="focus_session_tasks",
    )
    op.drop_table("focus_session_tasks")
