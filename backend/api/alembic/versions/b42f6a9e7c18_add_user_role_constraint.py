"""add user role constraint

Revision ID: b42f6a9e7c18
Revises: 9c2b7f1d0a43
Create Date: 2026-08-01 18:30:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b42f6a9e7c18"
down_revision: str | Sequence[str] | None = "9c2b7f1d0a43"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ALLOWED_ROLES = ("student", "teacher", "other", "admin")
ROLE_CONSTRAINT_NAME = "ck_users_role_allowed"


def upgrade() -> None:
    """Restrict users.role to supported account roles."""

    allowed_roles = "', '".join(ALLOWED_ROLES)
    op.execute(
        f"UPDATE users SET role = 'student' "
        f"WHERE role IS NULL OR role NOT IN ('{allowed_roles}')"
    )
    op.create_check_constraint(
        ROLE_CONSTRAINT_NAME,
        "users",
        f"role IN ('{allowed_roles}')",
    )


def downgrade() -> None:
    """Remove users.role value restriction."""

    op.drop_constraint(ROLE_CONSTRAINT_NAME, "users", type_="check")
