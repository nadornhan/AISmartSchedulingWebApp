"""add legendary Chrono plant species

Revision ID: 9f3a6c1d8e42
Revises: 5d7a1c9e4b20
Create Date: 2026-09-10 22:25:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9f3a6c1d8e42"
down_revision: str | Sequence[str] | None = "5d7a1c9e4b20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    species = sa.table(
        "plant_species",
        sa.column("id", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
        sa.column("image_key", sa.String),
        sa.column("required_growth_points", sa.Integer),
        sa.column("unlock_requirement", sa.JSON),
        sa.column("sort_order", sa.Integer),
        sa.column("is_default", sa.Boolean),
    )
    op.bulk_insert(
        species,
        [
            {
                "id": "chrono",
                "name": "Chrono",
                "description": (
                    "The legendary keeper of time, earned only through lasting mastery."
                ),
                "image_key": "chrono",
                "required_growth_points": 500,
                "unlock_requirement": {
                    "type": "chrono_legend",
                    "trees_grown": 10,
                    "tasks_completed": 250,
                    "focus_sessions": 100,
                    "active_weeks": 12,
                },
                "sort_order": 99,
                "is_default": False,
            }
        ],
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM plant_species WHERE id = 'chrono'"))
