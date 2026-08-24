"""add unassigned growth points balance

Revision ID: e7c4a1d92b30
Revises: d2b9e5f03c18
Create Date: 2026-08-24 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e7c4a1d92b30"
down_revision: str | Sequence[str] | None = "d2b9e5f03c18"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_gamification_profiles",
        sa.Column(
            "unassigned_growth_points",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.create_check_constraint(
        "ck_user_gamification_profiles_unassigned_gp_nonnegative",
        "user_gamification_profiles",
        "unassigned_growth_points >= 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_user_gamification_profiles_unassigned_gp_nonnegative",
        "user_gamification_profiles",
        type_="check",
    )
    op.drop_column("user_gamification_profiles", "unassigned_growth_points")
