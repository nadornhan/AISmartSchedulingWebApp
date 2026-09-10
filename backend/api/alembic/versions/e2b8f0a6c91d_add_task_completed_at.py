"""add task completed at

Revision ID: e2b8f0a6c91d
Revises: c4d7a9f2b183
Create Date: 2026-08-04 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e2b8f0a6c91d"
down_revision: str | Sequence[str] | None = "c4d7a9f2b183"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Track when tasks become done."""

    op.add_column(
        "tasks",
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.execute(
        """
        UPDATE tasks
        SET completed_at = updated_at
        WHERE status = 'done'
        AND completed_at IS NULL
        """
    )


def downgrade() -> None:
    """Remove task completion timestamps."""

    op.drop_column("tasks", "completed_at")
