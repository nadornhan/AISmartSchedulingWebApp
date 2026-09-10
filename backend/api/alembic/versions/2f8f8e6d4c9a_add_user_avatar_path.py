"""add user avatar path

Revision ID: 2f8f8e6d4c9a
Revises: b42f6a9e7c18
Create Date: 2026-08-02 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2f8f8e6d4c9a"
down_revision: str | Sequence[str] | None = "b42f6a9e7c18"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Store the relative uploaded avatar path for each user."""

    op.add_column(
        "users",
        sa.Column("avatar_path", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    """Remove uploaded avatar metadata."""

    op.drop_column("users", "avatar_path")
