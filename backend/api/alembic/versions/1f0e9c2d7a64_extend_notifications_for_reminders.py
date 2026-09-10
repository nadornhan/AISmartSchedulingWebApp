"""extend notifications for reminders

Revision ID: 1f0e9c2d7a64
Revises: 8c4d2f0a9b31
Create Date: 2026-08-11 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1f0e9c2d7a64"
down_revision: str | Sequence[str] | None = "8c4d2f0a9b31"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add reminder metadata and dedupe support."""

    op.add_column(
        "notifications",
        sa.Column(
            "type",
            sa.String(length=64),
            server_default="general",
            nullable=False,
        ),
    )
    op.add_column(
        "notifications",
        sa.Column("metadata", sa.JSON(), nullable=True),
    )
    op.add_column(
        "notifications",
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "notifications",
        sa.Column("dedupe_key", sa.String(length=255), nullable=True),
    )
    op.create_index(
        "ix_notifications_type",
        "notifications",
        ["type"],
    )
    op.create_index(
        "ix_notifications_scheduled_for",
        "notifications",
        ["scheduled_for"],
    )
    op.create_index(
        "ix_notifications_dedupe_key",
        "notifications",
        ["dedupe_key"],
        unique=True,
    )


def downgrade() -> None:
    """Remove reminder metadata and dedupe support."""

    op.drop_index("ix_notifications_dedupe_key", table_name="notifications")
    op.drop_index("ix_notifications_scheduled_for", table_name="notifications")
    op.drop_index("ix_notifications_type", table_name="notifications")
    op.drop_column("notifications", "dedupe_key")
    op.drop_column("notifications", "scheduled_for")
    op.drop_column("notifications", "metadata")
    op.drop_column("notifications", "type")
