"""add achievement claim rewards and progression

Revision ID: b4e7c9a1d205
Revises: f2c8a4d19e73
Create Date: 2026-09-18 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "b4e7c9a1d205"
down_revision: str | Sequence[str] | None = "f2c8a4d19e73"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


NEW_ACHIEVEMENTS = [
    {
        "id": "focus_sessions_25",
        "name": "Focused Rhythm",
        "description": "Complete 25 valid focus sessions.",
        "icon": "focus",
        "category": "focus",
        "requirement_type": "focus_sessions",
        "requirement_value": 25,
        "reward_growth_points": 15,
        "sort_order": 14,
    },
    {
        "id": "focus_20_hours",
        "name": "Twenty Quiet Hours",
        "description": "Accumulate 20 hours of focus time.",
        "icon": "hourglass",
        "category": "focus",
        "requirement_type": "focus_minutes",
        "requirement_value": 1200,
        "reward_growth_points": 20,
        "sort_order": 15,
    },
    {
        "id": "focus_sessions_50",
        "name": "Flow Keeper",
        "description": "Complete 50 valid focus sessions.",
        "icon": "focus",
        "category": "focus",
        "requirement_type": "focus_sessions",
        "requirement_value": 50,
        "reward_growth_points": 25,
        "sort_order": 16,
    },
    {
        "id": "focus_50_hours",
        "name": "Deep Work Master",
        "description": "Accumulate 50 hours of focus time.",
        "icon": "hourglass",
        "category": "focus",
        "requirement_type": "focus_minutes",
        "requirement_value": 3000,
        "reward_growth_points": 30,
        "sort_order": 17,
    },
    {
        "id": "tasks_250",
        "name": "Momentum Maker",
        "description": "Complete 250 tasks.",
        "icon": "leaf",
        "category": "productivity",
        "requirement_type": "tasks_completed",
        "requirement_value": 250,
        "reward_growth_points": 20,
        "sort_order": 24,
    },
    {
        "id": "tasks_500",
        "name": "Plan Finisher",
        "description": "Complete 500 tasks.",
        "icon": "leaf",
        "category": "productivity",
        "requirement_type": "tasks_completed",
        "requirement_value": 500,
        "reward_growth_points": 25,
        "sort_order": 25,
    },
    {
        "id": "tasks_1000",
        "name": "Chrono Achiever",
        "description": "Complete 1,000 tasks.",
        "icon": "spark",
        "category": "productivity",
        "requirement_type": "tasks_completed",
        "requirement_value": 1000,
        "reward_growth_points": 35,
        "sort_order": 26,
    },
    {
        "id": "active_days_60",
        "name": "Steady Seasons",
        "description": "Be productive on 60 different days.",
        "icon": "calendar",
        "category": "consistency",
        "requirement_type": "active_days",
        "requirement_value": 60,
        "reward_growth_points": 20,
        "sort_order": 34,
    },
    {
        "id": "active_days_100",
        "name": "Hundred Day Habit",
        "description": "Be productive on 100 different days.",
        "icon": "calendar",
        "category": "consistency",
        "requirement_type": "active_days",
        "requirement_value": 100,
        "reward_growth_points": 25,
        "sort_order": 35,
    },
    {
        "id": "active_days_180",
        "name": "Timeless Consistency",
        "description": "Be productive on 180 different days.",
        "icon": "calendar",
        "category": "consistency",
        "requirement_type": "active_days",
        "requirement_value": 180,
        "reward_growth_points": 35,
        "sort_order": 36,
    },
    {
        "id": "species_8",
        "name": "Botanical Collector",
        "description": "Unlock eight plant species.",
        "icon": "spark",
        "category": "forest",
        "requirement_type": "species_unlocked",
        "requirement_value": 8,
        "reward_growth_points": 20,
        "sort_order": 44,
    },
    {
        "id": "trees_20",
        "name": "Flourishing Grove",
        "description": "Grow 20 mature trees.",
        "icon": "forest",
        "category": "forest",
        "requirement_type": "trees_grown",
        "requirement_value": 20,
        "reward_growth_points": 25,
        "sort_order": 45,
    },
    {
        "id": "trees_50",
        "name": "Forest Guardian",
        "description": "Grow 50 mature trees.",
        "icon": "forest",
        "category": "forest",
        "requirement_type": "trees_grown",
        "requirement_value": 50,
        "reward_growth_points": 30,
        "sort_order": 46,
    },
    {
        "id": "trees_100",
        "name": "Keeper of Chrono Forest",
        "description": "Grow 100 mature trees.",
        "icon": "tree",
        "category": "forest",
        "requirement_type": "trees_grown",
        "requirement_value": 100,
        "reward_growth_points": 40,
        "sort_order": 47,
    },
]


def upgrade() -> None:
    op.add_column(
        "achievements",
        sa.Column(
            "reward_growth_points",
            sa.Integer(),
            nullable=False,
            server_default="5",
        ),
    )
    op.create_check_constraint(
        "ck_achievements_reward_growth_points_nonnegative",
        "achievements",
        "reward_growth_points >= 0",
    )
    op.add_column(
        "user_achievements",
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
    )

    achievements = sa.table(
        "achievements",
        sa.column("id", sa.String()),
        sa.column("name", sa.String()),
        sa.column("description", sa.Text()),
        sa.column("icon", sa.String()),
        sa.column("category", sa.String()),
        sa.column("requirement_type", sa.String()),
        sa.column("requirement_value", sa.Integer()),
        sa.column("reward_growth_points", sa.Integer()),
        sa.column("sort_order", sa.Integer()),
    )
    op.bulk_insert(achievements, NEW_ACHIEVEMENTS)

    reward_by_id = {
        "getting_started": 5,
        "deep_focus": 5,
        "first_tree": 10,
        "focus_explorer": 10,
        "focus_5_hours": 10,
        "time_master": 15,
        "growing_momentum": 10,
        "tasks_50": 15,
        "tasks_100": 20,
        "active_days_3": 5,
        "consistent_growth": 10,
        "active_days_30": 15,
        "forest_builder": 10,
        "green_thumb": 15,
        "trees_10": 20,
        "species_5": 15,
    }
    for achievement_id, reward in reward_by_id.items():
        op.execute(
            achievements.update()
            .where(achievements.c.id == achievement_id)
            .values(reward_growth_points=reward)
        )


def downgrade() -> None:
    achievement_ids = [item["id"] for item in NEW_ACHIEVEMENTS]
    achievements = sa.table("achievements", sa.column("id", sa.String()))
    op.execute(achievements.delete().where(achievements.c.id.in_(achievement_ids)))
    op.drop_column("user_achievements", "claimed_at")
    op.drop_constraint(
        "ck_achievements_reward_growth_points_nonnegative",
        "achievements",
        type_="check",
    )
    op.drop_column("achievements", "reward_growth_points")
