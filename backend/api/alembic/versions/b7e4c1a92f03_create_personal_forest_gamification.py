"""create personal forest gamification tables

Revision ID: b7e4c1a92f03
Revises: a9c3e1f7b204
Create Date: 2026-08-14 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b7e4c1a92f03"
down_revision: str | Sequence[str] | None = "a9c3e1f7b204"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


PLANT_SPECIES = [
    {
        "id": "oak",
        "name": "Oak",
        "description": "A steady companion for everyday progress.",
        "image_key": "oak",
        "required_growth_points": 100,
        "unlock_requirement": {"type": "default"},
        "sort_order": 1,
        "is_default": True,
    },
    {
        "id": "maple",
        "name": "Maple",
        "description": "Warm leaves for calm, consistent days.",
        "image_key": "maple",
        "required_growth_points": 100,
        "unlock_requirement": {"type": "default"},
        "sort_order": 2,
        "is_default": True,
    },
    {
        "id": "pine",
        "name": "Pine",
        "description": "Evergreen focus through quiet seasons.",
        "image_key": "pine",
        "required_growth_points": 100,
        "unlock_requirement": {"type": "tasks_completed", "value": 15},
        "sort_order": 3,
        "is_default": False,
    },
    {
        "id": "cherry_blossom",
        "name": "Cherry Blossom",
        "description": "Soft blooms for milestones worth celebrating.",
        "image_key": "cherry_blossom",
        "required_growth_points": 110,
        "unlock_requirement": {"type": "tasks_completed", "value": 30},
        "sort_order": 4,
        "is_default": False,
    },
    {
        "id": "bonsai",
        "name": "Bonsai",
        "description": "Careful growth shaped by deep focus.",
        "image_key": "bonsai",
        "required_growth_points": 100,
        "unlock_requirement": {"type": "focus_sessions", "value": 20},
        "sort_order": 5,
        "is_default": False,
    },
    {
        "id": "willow",
        "name": "Willow",
        "description": "Flexible roots for long-term consistency.",
        "image_key": "willow",
        "required_growth_points": 110,
        "unlock_requirement": {"type": "active_weeks", "value": 4},
        "sort_order": 6,
        "is_default": False,
    },
    {
        "id": "lavender",
        "name": "Lavender",
        "description": "A gentle reminder that rest is part of growth.",
        "image_key": "lavender",
        "required_growth_points": 100,
        "unlock_requirement": {"type": "focus_sessions", "value": 10},
        "sort_order": 7,
        "is_default": False,
    },
    {
        "id": "sunflower",
        "name": "Sunflower",
        "description": "Bright energy for returning after quiet days.",
        "image_key": "sunflower",
        "required_growth_points": 100,
        "unlock_requirement": {"type": "trees_grown", "value": 2},
        "sort_order": 8,
        "is_default": False,
    },
]

ACHIEVEMENTS = [
    {
        "id": "getting_started",
        "name": "Getting Started",
        "description": "Complete your first task.",
        "icon": "seedling",
        "category": "getting_started",
        "requirement_type": "first_task",
        "requirement_value": 1,
        "sort_order": 1,
    },
    {
        "id": "deep_focus",
        "name": "Deep Focus",
        "description": "Complete your first focus session.",
        "icon": "focus",
        "category": "getting_started",
        "requirement_type": "first_focus",
        "requirement_value": 1,
        "sort_order": 2,
    },
    {
        "id": "first_tree",
        "name": "First Tree",
        "description": "Grow your first mature tree.",
        "icon": "tree",
        "category": "getting_started",
        "requirement_type": "trees_grown",
        "requirement_value": 1,
        "sort_order": 3,
    },
    {
        "id": "focus_explorer",
        "name": "Focus Explorer",
        "description": "Complete 10 focus sessions.",
        "icon": "compass",
        "category": "focus",
        "requirement_type": "focus_sessions",
        "requirement_value": 10,
        "sort_order": 11,
    },
    {
        "id": "focus_5_hours",
        "name": "5 Hours Focused",
        "description": "Accumulate 5 hours of focus time.",
        "icon": "hourglass",
        "category": "focus",
        "requirement_type": "focus_minutes",
        "requirement_value": 300,
        "sort_order": 12,
    },
    {
        "id": "time_master",
        "name": "Time Master",
        "description": "Accumulate 10 hours of focus time.",
        "icon": "hourglass",
        "category": "focus",
        "requirement_type": "focus_minutes",
        "requirement_value": 600,
        "sort_order": 13,
    },
    {
        "id": "growing_momentum",
        "name": "Growing Momentum",
        "description": "Complete 10 tasks.",
        "icon": "leaf",
        "category": "productivity",
        "requirement_type": "tasks_completed",
        "requirement_value": 10,
        "sort_order": 21,
    },
    {
        "id": "tasks_50",
        "name": "50 Tasks Completed",
        "description": "Complete 50 tasks.",
        "icon": "leaf",
        "category": "productivity",
        "requirement_type": "tasks_completed",
        "requirement_value": 50,
        "sort_order": 22,
    },
    {
        "id": "tasks_100",
        "name": "100 Tasks Completed",
        "description": "Complete 100 tasks.",
        "icon": "leaf",
        "category": "productivity",
        "requirement_type": "tasks_completed",
        "requirement_value": 100,
        "sort_order": 23,
    },
    {
        "id": "active_days_3",
        "name": "3 Active Days",
        "description": "Be productive on 3 different days.",
        "icon": "calendar",
        "category": "consistency",
        "requirement_type": "active_days",
        "requirement_value": 3,
        "sort_order": 31,
    },
    {
        "id": "consistent_growth",
        "name": "Consistent Growth",
        "description": "Be productive on 7 different days.",
        "icon": "calendar",
        "category": "consistency",
        "requirement_type": "active_days",
        "requirement_value": 7,
        "sort_order": 32,
    },
    {
        "id": "active_days_30",
        "name": "30 Active Days",
        "description": "Be productive on 30 different days.",
        "icon": "calendar",
        "category": "consistency",
        "requirement_type": "active_days",
        "requirement_value": 30,
        "sort_order": 33,
    },
    {
        "id": "forest_builder",
        "name": "Forest Builder",
        "description": "Grow your first mature tree.",
        "icon": "tree",
        "category": "forest",
        "requirement_type": "trees_grown",
        "requirement_value": 1,
        "sort_order": 40,
    },
    {
        "id": "green_thumb",
        "name": "Green Thumb",
        "description": "Grow 5 mature trees.",
        "icon": "forest",
        "category": "forest",
        "requirement_type": "trees_grown",
        "requirement_value": 5,
        "sort_order": 41,
    },
    {
        "id": "trees_10",
        "name": "10 Trees Grown",
        "description": "Grow 10 mature trees.",
        "icon": "forest",
        "category": "forest",
        "requirement_type": "trees_grown",
        "requirement_value": 10,
        "sort_order": 42,
    },
    {
        "id": "species_5",
        "name": "Unlock 5 Species",
        "description": "Unlock five plant species.",
        "icon": "spark",
        "category": "forest",
        "requirement_type": "species_unlocked",
        "requirement_value": 5,
        "sort_order": 43,
    },
]


def upgrade() -> None:
    op.create_table(
        "plant_species",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("image_key", sa.String(length=64), nullable=False),
        sa.Column("required_growth_points", sa.Integer(), nullable=False),
        sa.Column("unlock_requirement", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "achievements",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("icon", sa.String(length=64), nullable=False),
        sa.Column(
            "category",
            sa.String(length=64),
            nullable=False,
            server_default="getting_started",
        ),
        sa.Column("requirement_type", sa.String(length=64), nullable=False),
        sa.Column("requirement_value", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "user_gamification_profiles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("total_growth_points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("longest_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_trees_grown", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_activity_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    op.create_table(
        "user_plants",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("species_id", sa.String(length=64), nullable=False),
        sa.Column("current_growth_points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "growth_stage",
            sa.String(length=32),
            nullable=False,
            server_default="seedling",
        ),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="growing"),
        sa.Column("custom_name", sa.String(length=48), nullable=True),
        sa.Column("tasks_contributed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "focus_sessions_contributed",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("position_x", sa.Float(), nullable=True),
        sa.Column("position_y", sa.Float(), nullable=True),
        sa.Column("position_z", sa.Float(), nullable=True),
        sa.Column("rotation_y", sa.Float(), nullable=False, server_default="0"),
        sa.Column(
            "is_placed_in_forest",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["species_id"], ["plant_species.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_plants_user_id", "user_plants", ["user_id"])
    op.create_index("ix_user_plants_species_id", "user_plants", ["species_id"])

    op.create_table(
        "user_achievements",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("achievement_id", sa.String(length=64), nullable=False),
        sa.Column(
            "unlocked_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["achievement_id"], ["achievements.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "achievement_id",
            name="uq_user_achievements_user_achievement",
        ),
    )
    op.create_index("ix_user_achievements_user_id", "user_achievements", ["user_id"])
    op.create_index(
        "ix_user_achievements_achievement_id",
        "user_achievements",
        ["achievement_id"],
    )

    op.create_table(
        "reward_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("source_type", sa.String(length=64), nullable=False),
        sa.Column("source_id", sa.String(length=64), nullable=False),
        sa.Column("growth_points", sa.Integer(), nullable=False),
        sa.Column("metadata_json", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "source_type",
            "source_id",
            name="uq_reward_events_user_source",
        ),
    )
    op.create_index("ix_reward_events_user_id", "reward_events", ["user_id"])

    species_table = sa.table(
        "plant_species",
        sa.column("id", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
        sa.column("image_key", sa.String),
        sa.column("required_growth_points", sa.Integer),
        sa.column("unlock_requirement", postgresql.JSON),
        sa.column("sort_order", sa.Integer),
        sa.column("is_default", sa.Boolean),
    )
    op.bulk_insert(species_table, PLANT_SPECIES)

    achievements_table = sa.table(
        "achievements",
        sa.column("id", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
        sa.column("icon", sa.String),
        sa.column("category", sa.String),
        sa.column("requirement_type", sa.String),
        sa.column("requirement_value", sa.Integer),
        sa.column("sort_order", sa.Integer),
    )
    op.bulk_insert(achievements_table, ACHIEVEMENTS)


def downgrade() -> None:
    op.drop_index("ix_reward_events_user_id", table_name="reward_events")
    op.drop_table("reward_events")
    op.drop_index("ix_user_achievements_achievement_id", table_name="user_achievements")
    op.drop_index("ix_user_achievements_user_id", table_name="user_achievements")
    op.drop_table("user_achievements")
    op.drop_index("ix_user_plants_species_id", table_name="user_plants")
    op.drop_index("ix_user_plants_user_id", table_name="user_plants")
    op.drop_table("user_plants")
    op.drop_table("user_gamification_profiles")
    op.drop_table("achievements")
    op.drop_table("plant_species")
