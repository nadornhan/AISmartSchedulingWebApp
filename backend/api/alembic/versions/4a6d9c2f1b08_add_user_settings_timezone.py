"""add user settings timezone

Revision ID: 4a6d9c2f1b08
Revises: e7c4a1d92b30, e7f4a2c91b63
Create Date: 2026-09-04 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "4a6d9c2f1b08"
down_revision: str | Sequence[str] | None = ("e7c4a1d92b30", "e7f4a2c91b63")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column(
            "timezone",
            sa.String(length=64),
            server_default="UTC",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("user_settings", "timezone")
