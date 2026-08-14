"""add rotation_x for forest plant placement

Revision ID: c1a8f4e92b07
Revises: b7e4c1a92f03
Create Date: 2026-08-14 20:10:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c1a8f4e92b07"
down_revision: Union[str, Sequence[str], None] = "b7e4c1a92f03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_plants",
        sa.Column(
            "rotation_x",
            sa.Float(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("user_plants", "rotation_x")
