"""add forest_name to user gamification profiles

Revision ID: d2b9e5f03c18
Revises: c1a8f4e92b07
Create Date: 2026-08-14 20:26:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d2b9e5f03c18"
down_revision: Union[str, Sequence[str], None] = "c1a8f4e92b07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_gamification_profiles",
        sa.Column("forest_name", sa.String(length=48), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_gamification_profiles", "forest_name")
