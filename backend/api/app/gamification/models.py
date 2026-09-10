import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PlantStatus(str, enum.Enum):
    GROWING = "growing"
    COMPLETED = "completed"
    RESTING = "resting"


class GrowthStage(str, enum.Enum):
    SEEDLING = "seedling"
    GROWING = "growing"
    MATURE = "mature"


class UserGamificationProfile(Base):
    __tablename__ = "user_gamification_profiles"
    __table_args__ = (
        CheckConstraint(
            "unassigned_growth_points >= 0",
            name="ck_user_gamification_profiles_unassigned_gp_nonnegative",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    total_growth_points: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    unassigned_growth_points: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    current_streak: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    longest_streak: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    total_trees_grown: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    forest_name: Mapped[str | None] = mapped_column(String(48), nullable=True)
    last_activity_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class PlantSpecies(Base):
    __tablename__ = "plant_species"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    image_key: Mapped[str] = mapped_column(String(64), nullable=False)
    required_growth_points: Mapped[int] = mapped_column(Integer, nullable=False)
    unlock_requirement: Mapped[dict] = mapped_column(JSON, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    user_plants: Mapped[list["UserPlant"]] = relationship(back_populates="species")


class UserPlant(Base):
    __tablename__ = "user_plants"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    species_id: Mapped[str] = mapped_column(
        ForeignKey("plant_species.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    current_growth_points: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    growth_stage: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=GrowthStage.SEEDLING.value,
        server_default=GrowthStage.SEEDLING.value,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=PlantStatus.GROWING.value,
        server_default=PlantStatus.GROWING.value,
    )
    custom_name: Mapped[str | None] = mapped_column(String(48), nullable=True)
    tasks_contributed: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    focus_sessions_contributed: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    position_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    position_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    position_z: Mapped[float | None] = mapped_column(Float, nullable=True)
    rotation_x: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0"
    )
    rotation_y: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0"
    )
    is_placed_in_forest: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    species: Mapped[PlantSpecies] = relationship(back_populates="user_plants")


class Achievement(Base):
    __tablename__ = "achievements"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    icon: Mapped[str] = mapped_column(String(64), nullable=False)
    category: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="getting_started",
        server_default="getting_started",
    )
    requirement_type: Mapped[str] = mapped_column(String(64), nullable=False)
    requirement_value: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class UserAchievement(Base):
    __tablename__ = "user_achievements"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "achievement_id",
            name="uq_user_achievements_user_achievement",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    achievement_id: Mapped[str] = mapped_column(
        ForeignKey("achievements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    unlocked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    achievement: Mapped[Achievement] = relationship()


class RewardEvent(Base):
    __tablename__ = "reward_events"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "source_type",
            "source_id",
            name="uq_reward_events_user_source",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    source_id: Mapped[str] = mapped_column(String(64), nullable=False)
    growth_points: Mapped[int] = mapped_column(Integer, nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
