"""extend task data model

Revision ID: 3d8b14894d8e
Revises: 6a9e0b2b0d6d
Create Date: 2026-07-24 23:45:06.914176

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "3d8b14894d8e"
down_revision: Union[str, Sequence[str], None] = "6a9e0b2b0d6d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Extend the task model while preserving existing task data."""

    # Remove the old default before replacing the PostgreSQL enum.
    op.alter_column(
        "tasks",
        "status",
        server_default=None,
    )

    # Keep the old enum temporarily so existing values can be converted.
    op.execute("ALTER TYPE task_status RENAME TO task_status_old")

    op.execute(
        """
        CREATE TYPE task_status AS ENUM (
            'pending',
            'in_progress',
            'done'
        )
        """
    )

    # Safely map existing task statuses:
    # active -> pending
    # completed -> done
    op.execute(
        """
        ALTER TABLE tasks
        ALTER COLUMN status TYPE task_status
        USING (
            CASE status::text
                WHEN 'active' THEN 'pending'
                WHEN 'completed' THEN 'done'
            END
        )::task_status
        """
    )

    op.execute("DROP TYPE task_status_old")

    op.alter_column(
        "tasks",
        "status",
        server_default=sa.text("'pending'"),
        nullable=False,
    )

    task_priority = postgresql.ENUM(
        "no_priority",
        "low",
        "medium",
        "high",
        name="task_priority",
        create_type=False,
    )
    task_priority.create(op.get_bind(), checkfirst=True)

    # The server default ensures existing tasks receive no_priority.
    op.add_column(
        "tasks",
        sa.Column(
            "priority",
            task_priority,
            nullable=False,
            server_default=sa.text("'no_priority'"),
        ),
    )

    op.add_column(
        "tasks",
        sa.Column(
            "due_date",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "tasks",
        sa.Column(
            "estimated_duration",
            sa.Integer(),
            nullable=True,
        ),
    )
    op.add_column(
        "tasks",
        sa.Column(
            "scheduled_start",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "tasks",
        sa.Column(
            "scheduled_end",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Restore the previous task model while preserving task data."""

    op.drop_column("tasks", "scheduled_end")
    op.drop_column("tasks", "scheduled_start")
    op.drop_column("tasks", "estimated_duration")
    op.drop_column("tasks", "due_date")
    op.drop_column("tasks", "priority")

    task_priority = postgresql.ENUM(
        "no_priority",
        "low",
        "medium",
        "high",
        name="task_priority",
        create_type=False,
    )
    task_priority.drop(op.get_bind(), checkfirst=True)

    op.alter_column(
        "tasks",
        "status",
        server_default=None,
    )

    op.execute("ALTER TYPE task_status RENAME TO task_status_new")

    op.execute(
        """
        CREATE TYPE task_status AS ENUM (
            'active',
            'completed'
        )
        """
    )

    # in_progress has no equivalent in the old model,
    # so both pending and in_progress become active.
    op.execute(
        """
        ALTER TABLE tasks
        ALTER COLUMN status TYPE task_status
        USING (
            CASE status::text
                WHEN 'pending' THEN 'active'
                WHEN 'in_progress' THEN 'active'
                WHEN 'done' THEN 'completed'
            END
        )::task_status
        """
    )

    op.execute("DROP TYPE task_status_new")

    op.alter_column(
        "tasks",
        "status",
        server_default=sa.text("'active'"),
        nullable=False,
    )