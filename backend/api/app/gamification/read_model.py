from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.focus.models import FocusSession
from app.gamification.models import (
    PlantSpecies,
    PlantStatus,
    RewardEvent,
    UserGamificationProfile,
    UserPlant,
)
from app.gamification.rules import (
    DEFAULT_MATURE_GP,
    MIN_VALID_FOCUS_MINUTES,
    SOURCE_ACHIEVEMENT_CLAIM,
    STAGE_THRESHOLDS,
    SUPPORTIVE_MESSAGES,
    normalize_stage,
    stage_progress,
)
from app.gamification.schemas import (
    AchievementProgress,
    AchievementTitleTier,
    ForestPosition,
    GamificationProfileResponse,
    GrowthStageThresholds,
    PlantSpeciesSummary,
    StreakSummary,
    UserPlantResponse,
)
from app.settings import service as settings_service
from app.tasks.models import Task, TaskStatus
from app.timezones import local_date, local_today

STAGE_LABELS = {
    "seedling": "Seedling",
    "growing": "Growing Plant",
    "mature": "Mature Tree",
}

ACHIEVEMENT_CATEGORY_LABELS = {
    "getting_started": "Getting Started",
    "focus": "Focus",
    "productivity": "Productivity",
    "consistency": "Consistency",
    "forest": "Forest",
}

ACHIEVEMENT_TITLE_TIERS = (
    ("time_seed", "Time Seed", "Your first steps toward mastering your time.", 0),
    ("sprout_seeker", "Sprout Seeker", "You have begun turning plans into progress.", 1),
    ("routine_keeper", "Routine Keeper", "Small routines are taking root.", 3),
    ("focus_gardener", "Focus Gardener", "You are tending focus with consistency.", 6),
    ("forest_builder", "Forest Builder", "Your steady work is growing a thriving forest.", 10),
    ("chrono_master", "Chrono Master", "You shape your schedule with clarity and purpose.", 15),
    ("legend_of_time", "Legend of Time", "You have mastered every season of productivity.", 22),
)


def _thresholds() -> GrowthStageThresholds:
    return GrowthStageThresholds(**STAGE_THRESHOLDS)


def get_or_create_profile(db: Session, user_id: uuid.UUID) -> UserGamificationProfile:
    profile = db.get(UserGamificationProfile, user_id)
    if profile is not None:
        return profile
    profile = UserGamificationProfile(user_id=user_id)
    db.add(profile)
    db.flush()
    return profile


def _growing_plant(db: Session, user_id: uuid.UUID) -> UserPlant | None:
    return db.scalar(
        select(UserPlant)
        .options(selectinload(UserPlant.species))
        .where(
            UserPlant.user_id == user_id,
            UserPlant.status == PlantStatus.GROWING.value,
        )
        .order_by(UserPlant.started_at.desc())
    )


def _completed_plants(db: Session, user_id: uuid.UUID) -> list[UserPlant]:
    return list(
        db.scalars(
            select(UserPlant)
            .options(selectinload(UserPlant.species))
            .where(
                UserPlant.user_id == user_id,
                UserPlant.status == PlantStatus.COMPLETED.value,
            )
            .order_by(UserPlant.completed_at.desc())
        ).all()
    )


def _forest_scene_plants(db: Session, user_id: uuid.UUID) -> list[UserPlant]:
    """Growing + mature plants share one forest identity (seed-to-forest)."""
    plants: list[UserPlant] = []
    growing = _growing_plant(db, user_id)
    if growing is not None:
        plants.append(growing)
    plants.extend(_completed_plants(db, user_id))
    return plants


def _placed_plants(db: Session, user_id: uuid.UUID) -> list[UserPlant]:
    return [item for item in _forest_scene_plants(db, user_id) if item.is_placed_in_forest]


def _count_completed_tasks(db: Session, user_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(Task)
            .where(Task.user_id == user_id, Task.status == TaskStatus.DONE)
        )
        or 0
    )


def _count_focus_sessions(db: Session, user_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(FocusSession)
            .where(
                FocusSession.user_id == user_id,
                FocusSession.completed.is_(True),
                FocusSession.duration_minutes >= MIN_VALID_FOCUS_MINUTES,
            )
        )
        or 0
    )


def _count_focus_minutes(db: Session, user_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.coalesce(func.sum(FocusSession.duration_minutes), 0)).where(
                FocusSession.user_id == user_id,
                FocusSession.completed.is_(True),
            )
        )
        or 0
    )


def _count_active_days(db: Session, user_id: uuid.UUID) -> int:
    profile = get_or_create_profile(db, user_id)
    timezone_name = settings_service.timezone_name_for_user(db, user_id)
    days = db.scalars(
        select(RewardEvent.created_at).where(
            RewardEvent.user_id == user_id,
            RewardEvent.source_type != SOURCE_ACHIEVEMENT_CLAIM,
        )
    ).all()
    unique = {
        local_date(created_at, timezone_name).isoformat()
        for created_at in days
        if created_at is not None
    }
    if profile.last_activity_date is not None:
        unique.add(str(profile.last_activity_date))
    return max(len(unique), profile.longest_streak)


def _count_active_weeks(db: Session, user_id: uuid.UUID) -> int:
    timezone_name = settings_service.timezone_name_for_user(db, user_id)
    rows = db.scalars(
        select(RewardEvent.created_at).where(
            RewardEvent.user_id == user_id,
            RewardEvent.source_type != SOURCE_ACHIEVEMENT_CLAIM,
        )
    ).all()
    weeks: set[str] = set()
    for row in rows:
        if row is None:
            continue
        iso = local_date(row, timezone_name).isocalendar()
        weeks.add(f"{iso.year}-W{iso.week}")
    return len(weeks)


def _unlock_hint(requirement: dict) -> str | None:
    kind = requirement.get("type", "default")
    value = requirement.get("value")
    if kind == "default":
        return None
    if kind == "tasks_completed":
        return f"Unlock after completing {value} tasks"
    if kind == "focus_sessions":
        return f"Unlock after completing {value} focus sessions"
    if kind == "active_weeks":
        return f"Unlock after productive activity across {value} weeks"
    if kind == "trees_grown":
        return f"Unlock after growing {value} mature trees"
    if kind == "chrono_legend":
        return (
            f"Legendary: grow {requirement.get('trees_grown', 10)} trees, complete "
            f"{requirement.get('tasks_completed', 250)} tasks and "
            f"{requirement.get('focus_sessions', 100)} focus sessions across "
            f"{requirement.get('active_weeks', 12)} active weeks"
        )
    return "Keep nurturing your forest to unlock this plant"


def _is_species_unlocked(
    db: Session,
    user_id: uuid.UUID,
    species: PlantSpecies,
    *,
    profile: UserGamificationProfile | None = None,
    metrics: dict[str, int] | None = None,
) -> bool:
    requirement = species.unlock_requirement or {"type": "default"}
    kind = requirement.get("type", "default")
    value = int(requirement.get("value", 0))
    if kind == "default" or species.is_default:
        return True
    if kind == "tasks_completed":
        return _metric_value(db, user_id, kind, metrics=metrics) >= value
    if kind == "focus_sessions":
        return _metric_value(db, user_id, kind, metrics=metrics) >= value
    if kind == "active_weeks":
        return _metric_value(db, user_id, kind, metrics=metrics) >= value
    if kind == "trees_grown":
        profile = profile or get_or_create_profile(db, user_id)
        return profile.total_trees_grown >= value
    if kind == "chrono_legend":
        profile = profile or get_or_create_profile(db, user_id)
        return (
            profile.total_trees_grown >= int(requirement.get("trees_grown", 10))
            and _metric_value(db, user_id, "tasks_completed", metrics=metrics)
            >= int(requirement.get("tasks_completed", 250))
            and _metric_value(db, user_id, "focus_sessions", metrics=metrics)
            >= int(requirement.get("focus_sessions", 100))
            and _metric_value(db, user_id, "active_weeks", metrics=metrics)
            >= int(requirement.get("active_weeks", 12))
        )
    return False


def _species_summary(
    db: Session,
    user_id: uuid.UUID,
    species: PlantSpecies,
    *,
    profile: UserGamificationProfile | None = None,
    metrics: dict[str, int] | None = None,
) -> PlantSpeciesSummary:
    unlocked = _is_species_unlocked(db, user_id, species, profile=profile, metrics=metrics)
    return PlantSpeciesSummary(
        id=species.id,
        name=species.name,
        description=species.description,
        image_key=species.image_key,
        required_growth_points=species.required_growth_points,
        unlocked=unlocked,
        unlock_hint=None if unlocked else _unlock_hint(species.unlock_requirement),
        is_default=species.is_default,
    )


def _display_name(plant: UserPlant) -> str:
    if plant.custom_name and plant.custom_name.strip():
        return plant.custom_name.strip()
    return plant.species.name


DEFAULT_FOREST_NAME = "Your Personal Forest"


def _forest_display_name(profile: UserGamificationProfile) -> str:
    if profile.forest_name and profile.forest_name.strip():
        return profile.forest_name.strip()
    return DEFAULT_FOREST_NAME


def _plant_response(
    plant: UserPlant,
    *,
    user_id: uuid.UUID,
    db: Session,
    profile: UserGamificationProfile | None = None,
    metrics: dict[str, int] | None = None,
) -> UserPlantResponse:
    mature_at = plant.species.required_growth_points or DEFAULT_MATURE_GP
    stage, points, nxt, ratio = stage_progress(
        plant.current_growth_points,
        mature_at=mature_at,
    )
    stage = normalize_stage(stage)
    position = None
    if plant.is_placed_in_forest and plant.position_x is not None and plant.position_z is not None:
        position = ForestPosition(
            x=plant.position_x,
            y=plant.position_y or 0,
            z=plant.position_z,
            rotation_x=getattr(plant, "rotation_x", 0) or 0,
            rotation_y=plant.rotation_y or 0,
        )
    return UserPlantResponse(
        id=plant.id,
        species=_species_summary(db, user_id, plant.species, profile=profile, metrics=metrics),
        display_name=_display_name(plant),
        custom_name=plant.custom_name,
        current_growth_points=points,
        required_growth_points=mature_at,
        growth_stage=stage,
        growth_stage_label=STAGE_LABELS.get(stage, stage.title()),
        status=plant.status,
        progress_ratio=ratio,
        next_stage_at=nxt,
        supportive_message=SUPPORTIVE_MESSAGES.get(
            stage,
            SUPPORTIVE_MESSAGES["seedling"],
        ),
        tasks_contributed=plant.tasks_contributed,
        focus_sessions_contributed=plant.focus_sessions_contributed,
        started_at=plant.started_at,
        completed_at=plant.completed_at,
        position=position,
        is_placed_in_forest=bool(plant.is_placed_in_forest),
    )


def _streak_message(profile: UserGamificationProfile, *, today: date) -> str:
    if profile.current_streak > 0:
        return f"{profile.current_streak}-day consistency streak"
    if profile.last_activity_date and profile.last_activity_date < today - timedelta(days=1):
        return SUPPORTIVE_MESSAGES["quiet_day"]
    return "Your forest grows whenever you do — no pressure."


def _profile_response(
    db: Session,
    user_id: uuid.UUID,
    *,
    recently_unlocked: list[AchievementProgress] | None = None,
) -> GamificationProfileResponse:
    profile = get_or_create_profile(db, user_id)
    timezone_name = settings_service.timezone_name_for_user(db, user_id)
    plant = _growing_plant(db, user_id)
    return GamificationProfileResponse(
        total_growth_points=profile.total_growth_points,
        unassigned_growth_points=profile.unassigned_growth_points,
        total_trees_grown=profile.total_trees_grown,
        streak=StreakSummary(
            current_streak=profile.current_streak,
            longest_streak=profile.longest_streak,
            last_activity_date=profile.last_activity_date,
            message=_streak_message(profile, today=local_today(timezone_name)),
        ),
        current_plant=_plant_response(plant, user_id=user_id, db=db) if plant else None,
        needs_plant_selection=plant is None,
        stage_thresholds=_thresholds(),
        recently_unlocked_achievements=recently_unlocked or [],
    )


def _achievement_title_summary(
    claimed_count: int,
) -> tuple[list[AchievementTitleTier], AchievementTitleTier, AchievementTitleTier | None]:
    current_index = 0
    for index, (_, _, _, requirement) in enumerate(ACHIEVEMENT_TITLE_TIERS):
        if claimed_count >= requirement:
            current_index = index

    tiers = [
        AchievementTitleTier(
            id=tier_id,
            name=name,
            description=description,
            required_claimed_achievements=requirement,
            unlocked=claimed_count >= requirement,
            current=index == current_index,
        )
        for index, (tier_id, name, description, requirement) in enumerate(ACHIEVEMENT_TITLE_TIERS)
    ]
    return (
        tiers,
        tiers[current_index],
        tiers[current_index + 1] if current_index + 1 < len(tiers) else None,
    )


def _metric_value(
    db: Session,
    user_id: uuid.UUID,
    requirement_type: str,
    *,
    metrics: dict[str, int] | None = None,
) -> int:
    # A read builds many plants/achievement tiers from the same user totals.
    # Keep this memo local to that operation so mutations never reuse stale totals.
    values = metrics if metrics is not None else {}
    if requirement_type == "first_task":
        return min(1, _metric_value(db, user_id, "tasks_completed", metrics=values))
    if requirement_type == "first_focus":
        return min(1, _metric_value(db, user_id, "focus_sessions", metrics=values))
    if requirement_type in values:
        return values[requirement_type]

    if requirement_type == "tasks_completed":
        value = _count_completed_tasks(db, user_id)
    elif requirement_type == "focus_sessions":
        value = _count_focus_sessions(db, user_id)
    elif requirement_type == "focus_minutes":
        value = _count_focus_minutes(db, user_id)
    elif requirement_type == "active_days":
        value = _count_active_days(db, user_id)
    elif requirement_type == "active_weeks":
        value = _count_active_weeks(db, user_id)
    elif requirement_type == "trees_grown":
        value = get_or_create_profile(db, user_id).total_trees_grown
    elif requirement_type == "species_unlocked":
        profile = get_or_create_profile(db, user_id)
        species = list(db.scalars(select(PlantSpecies)).all())
        value = sum(
            1 for item in species
            if _is_species_unlocked(db, user_id, item, profile=profile, metrics=values)
        )
    else:
        value = 0
    values[requirement_type] = value
    return value
