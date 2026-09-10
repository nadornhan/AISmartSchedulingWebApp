"""add user profile fields

Revision ID: 9c2b7f1d0a43
Revises: 3d8b14894d8e
Create Date: 2026-07-31 14:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9c2b7f1d0a43"
down_revision: Union[str, Sequence[str], None] = "3d8b14894d8e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add basic profile data collected by the registration page."""

    op.add_column(
        "users",
        sa.Column("first_name", sa.String(length=100), server_default="", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("last_name", sa.String(length=100), server_default="", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("role", sa.String(length=32), server_default="student", nullable=False),
    )


def downgrade() -> None:
    """Remove user profile fields."""

    op.drop_column("users", "role")
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
