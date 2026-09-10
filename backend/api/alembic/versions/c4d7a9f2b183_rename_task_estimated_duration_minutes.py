"""rename task estimated duration minutes

Revision ID: c4d7a9f2b183
Revises: 5b3a1f77c2d4
Create Date: 2026-08-04 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4d7a9f2b183"
down_revision: str | Sequence[str] | None = "5b3a1f77c2d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


CONSTRAINT_NAME = "ck_tasks_estimated_duration_minutes_positive"


def upgrade() -> None:
    """Rename minute-based estimates and enforce positive values."""

    op.execute(
        """
        UPDATE tasks
        SET estimated_duration = NULL
        WHERE estimated_duration IS NOT NULL
        AND estimated_duration <= 0
        """
    )
    op.alter_column(
        "tasks",
        "estimated_duration",
        new_column_name="estimated_duration_minutes",
        existing_type=sa.Integer(),
        existing_nullable=True,
    )
    op.create_check_constraint(
        CONSTRAINT_NAME,
        "tasks",
        "estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0",
    )


def downgrade() -> None:
    """Restore the previous column name."""

    op.drop_constraint(CONSTRAINT_NAME, "tasks", type_="check")
    op.alter_column(
        "tasks",
        "estimated_duration_minutes",
        new_column_name="estimated_duration",
        existing_type=sa.Integer(),
        existing_nullable=True,
    )
