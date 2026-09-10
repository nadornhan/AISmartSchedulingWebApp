"""add project id to tasks

Revision ID: 6a9e0b2b0d6d
Revises: 7e86e1485f84
Create Date: 2026-07-22 22:25:18.514991

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6a9e0b2b0d6d"
down_revision: Union[str, Sequence[str], None] = "7e86e1485f84"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "tasks",
        sa.Column("project_id", sa.Uuid(), nullable=True),
    )
    op.create_index(
        op.f("ix_tasks_project_id"),
        "tasks",
        ["project_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_tasks_project_id_projects",
        "tasks",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "fk_tasks_project_id_projects",
        "tasks",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_tasks_project_id"),
        table_name="tasks",
    )
    op.drop_column("tasks", "project_id")
