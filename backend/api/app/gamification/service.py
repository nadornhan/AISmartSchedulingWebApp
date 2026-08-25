from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.focus.models import FocusSession
from app.gamification.models import (
    Achievement,
    GrowthStage,
    PlantSpecies,
    PlantStatus,
    RewardEvent,
    UserAchievement,
    UserGamificationProfile,
    UserPlant,
)
from app.gamification.rules import (
    DAILY_ALL_TASKS_BONUS_GP,
    DEFAULT_MATURE_GP,
    FOCUS_SESSION_GP,
    FOCUS_SESSION_STREAK_BONUS_GP,
    HIGH_PRIORITY_BONUS_GP,
    MIN_VALID_FOCUS_MINUTES,
    SOURCE_DAILY_CLEAR,
    SOURCE_FOCUS_SESSION,
    SOURCE_STREAK_BONUS,
    SOURCE_TASK_COMPLETE,
    STAGE_THRESHOLDS,
    STREAK_DAY_BONUS_GP,
    SUPPORTIVE_MESSAGES,
    TASK_COMPLETE_GP,
    normalize_stage,
    stage_for_points,
    stage_progress,
)
from app.gamification.schemas import (
    AchievementCategoryGroup,
    AchievementProgress,
    AchievementsResponse,
    DashboardForestWidget,
    ForestPosition,
    ForestResponse,
    ForestSceneResponse,
    GamificationProfileResponse,
    GrowthStageThresholds,
    PlacePlantRequest,
    PlantCatalogResponse,
    PlantSpeciesSummary,
    RewardFeedback,
    StreakSummary,
    UpdateForestRequest,
    UpdatePlantRequest,
    UserPlantResponse,
)
from app.tasks.models import Task, TaskPriority, TaskStatus
from app.tasks.overdue import utc_now

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


def _profile_for_update(db: Session, user_id: uuid.UUID) -> UserGamificationProfile:
    """Lock the user's GP balance while rewards or transfers are applied."""
    profile = get_or_create_profile(db, user_id)
    db.flush()
    return (
        db.scalar(
            select(UserGamificationProfile)
            .where(UserGamificationProfile.user_id == user_id)
            .with_for_update()
        )
        or profile
    )


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
    return [
        item
        for item in _forest_scene_plants(db, user_id)
        if item.is_placed_in_forest
    ]


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
    # Approximate unique productive days from reward events + streak history.
    days = db.scalars(
        select(func.date(RewardEvent.created_at)).where(RewardEvent.user_id == user_id)
    ).all()
    unique = {str(day) for day in days if day is not None}
    if profile.last_activity_date is not None:
        unique.add(str(profile.last_activity_date))
    return max(len(unique), profile.longest_streak)


def _count_active_weeks(db: Session, user_id: uuid.UUID) -> int:
    rows = db.scalars(
        select(func.date(RewardEvent.created_at)).where(RewardEvent.user_id == user_id)
    ).all()
    weeks: set[str] = set()
    for row in rows:
        if row is None:
            continue
        if isinstance(row, date):
            iso = row.isocalendar()
        else:
            continue
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
    return "Keep nurturing your forest to unlock this plant"


def _is_species_unlocked(
    db: Session,
    user_id: uuid.UUID,
    species: PlantSpecies,
    *,
    profile: UserGamificationProfile | None = None,
) -> bool:
    requirement = species.unlock_requirement or {"type": "default"}
    kind = requirement.get("type", "default")
    value = int(requirement.get("value", 0))
    if kind == "default" or species.is_default:
        return True
    if kind == "tasks_completed":
        return _count_completed_tasks(db, user_id) >= value
    if kind == "focus_sessions":
        return _count_focus_sessions(db, user_id) >= value
    if kind == "active_weeks":
        return _count_active_weeks(db, user_id) >= value
    if kind == "trees_grown":
        profile = profile or get_or_create_profile(db, user_id)
        return profile.total_trees_grown >= value
    return False


def _species_summary(
    db: Session,
    user_id: uuid.UUID,
    species: PlantSpecies,
    *,
    profile: UserGamificationProfile | None = None,
) -> PlantSpeciesSummary:
    unlocked = _is_species_unlocked(db, user_id, species, profile=profile)
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


def _plant_response(plant: UserPlant, *, user_id: uuid.UUID, db: Session) -> UserPlantResponse:
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
        species=_species_summary(db, user_id, plant.species),
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


def _streak_message(profile: UserGamificationProfile) -> str:
    today = utc_now().date()
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
    plant = _growing_plant(db, user_id)
    return GamificationProfileResponse(
        total_growth_points=profile.total_growth_points,
        unassigned_growth_points=profile.unassigned_growth_points,
        total_trees_grown=profile.total_trees_grown,
        streak=StreakSummary(
            current_streak=profile.current_streak,
            longest_streak=profile.longest_streak,
            last_activity_date=profile.last_activity_date,
            message=_streak_message(profile),
        ),
        current_plant=_plant_response(plant, user_id=user_id, db=db) if plant else None,
        needs_plant_selection=plant is None,
        stage_thresholds=_thresholds(),
        recently_unlocked_achievements=recently_unlocked or [],
    )


def get_profile(db: Session, user_id: uuid.UUID) -> GamificationProfileResponse:
    return _profile_response(db, user_id)


def get_forest(db: Session, user_id: uuid.UUID) -> ForestResponse:
    plant = _growing_plant(db, user_id)
    completed = [
        _plant_response(item, user_id=user_id, db=db)
        for item in _completed_plants(db, user_id)
    ]
    profile = get_or_create_profile(db, user_id)
    if plant is None and not completed:
        message = "Your forest starts here. Complete tasks and focus sessions to help your first plant grow."
    elif plant is None:
        message = SUPPORTIVE_MESSAGES["no_plant"]
    else:
        message = SUPPORTIVE_MESSAGES.get(
            normalize_stage(plant.growth_stage),
            SUPPORTIVE_MESSAGES["seedling"],
        )
    return ForestResponse(
        forest_name=_forest_display_name(profile),
        unassigned_growth_points=profile.unassigned_growth_points,
        current_plant=_plant_response(plant, user_id=user_id, db=db) if plant else None,
        completed_plants=completed,
        needs_plant_selection=plant is None,
        total_trees_grown=profile.total_trees_grown,
        supportive_message=str(message),
    )


def get_forest_scene(db: Session, user_id: uuid.UUID) -> ForestSceneResponse:
    trees = [
        _plant_response(item, user_id=user_id, db=db)
        for item in _forest_scene_plants(db, user_id)
    ]
    profile = get_or_create_profile(db, user_id)
    if not trees:
        message = (
            "Your forest is waiting. Choose a plant, place the seedling, "
            "and grow it with every effort."
        )
    elif any(not tree.is_placed_in_forest for tree in trees):
        message = "Plant your seedling in the forest — it will grow here as you earn Growth Points."
    else:
        message = "Wander your garden — move and rotate trees wherever feels peaceful."
    return ForestSceneResponse(
        forest_name=_forest_display_name(profile),
        trees=trees,
        total_trees_grown=profile.total_trees_grown,
        supportive_message=message,
    )


def get_plant_catalog(db: Session, user_id: uuid.UUID) -> PlantCatalogResponse:
    profile = get_or_create_profile(db, user_id)
    species = list(
        db.scalars(select(PlantSpecies).order_by(PlantSpecies.sort_order.asc())).all()
    )
    return PlantCatalogResponse(
        plants=[
            _species_summary(db, user_id, item, profile=profile) for item in species
        ]
    )


def select_plant(
    db: Session,
    user_id: uuid.UUID,
    species_id: str,
) -> GamificationProfileResponse:
    profile = _profile_for_update(db, user_id)
    if _growing_plant(db, user_id) is not None:
        raise ValueError("You already have a plant growing. Finish it before selecting another.")

    species = db.get(PlantSpecies, species_id)
    if species is None:
        raise LookupError("Plant species not found")
    if not _is_species_unlocked(db, user_id, species):
        raise PermissionError("This plant is still locked")

    transferred_points = profile.unassigned_growth_points
    mature_at = species.required_growth_points or DEFAULT_MATURE_GP
    growth_stage = stage_for_points(transferred_points, mature_at=mature_at)
    plant_completed = transferred_points >= mature_at
    plant = UserPlant(
        user_id=user_id,
        species_id=species.id,
        current_growth_points=transferred_points,
        growth_stage=growth_stage,
        status=(
            PlantStatus.COMPLETED.value if plant_completed else PlantStatus.GROWING.value
        ),
        custom_name=None,
        completed_at=utc_now() if plant_completed else None,
    )
    db.add(plant)
    profile.unassigned_growth_points = 0
    if plant_completed:
        profile.total_trees_grown += 1
    db.commit()
    return _profile_response(db, user_id)


def update_plant(
    db: Session,
    user_id: uuid.UUID,
    plant_id: uuid.UUID,
    payload: UpdatePlantRequest,
) -> UserPlantResponse:
    plant = db.scalar(
        select(UserPlant)
        .options(selectinload(UserPlant.species))
        .where(UserPlant.id == plant_id, UserPlant.user_id == user_id)
    )
    if plant is None:
        raise LookupError("Plant not found")
    plant.custom_name = payload.custom_name
    db.commit()
    db.refresh(plant)
    return _plant_response(plant, user_id=user_id, db=db)


def update_forest_name(
    db: Session,
    user_id: uuid.UUID,
    payload: UpdateForestRequest,
) -> ForestSceneResponse:
    profile = get_or_create_profile(db, user_id)
    profile.forest_name = payload.forest_name
    db.commit()
    return get_forest_scene(db, user_id)


def _positions_overlap(
    x: float,
    z: float,
    others: list[UserPlant],
    *,
    ignore_id: uuid.UUID | None = None,
    min_distance: float = 2.4,
) -> bool:
    for other in others:
        if ignore_id is not None and other.id == ignore_id:
            continue
        if other.position_x is None or other.position_z is None:
            continue
        dx = other.position_x - x
        dz = other.position_z - z
        if (dx * dx + dz * dz) ** 0.5 < min_distance:
            return True
    return False


def place_plant(
    db: Session,
    user_id: uuid.UUID,
    plant_id: uuid.UUID,
    payload: PlacePlantRequest,
) -> UserPlantResponse:
    plant = db.scalar(
        select(UserPlant)
        .options(selectinload(UserPlant.species))
        .where(
            UserPlant.id == plant_id,
            UserPlant.user_id == user_id,
            UserPlant.status.in_(
                [PlantStatus.GROWING.value, PlantStatus.COMPLETED.value]
            ),
        )
    )
    if plant is None:
        raise LookupError("Plant not found")

    placed = _placed_plants(db, user_id)
    if _positions_overlap(payload.position_x, payload.position_z, placed, ignore_id=plant.id):
        raise ValueError("That spot is too close to another tree. Try a nearby clearing.")

    plant.position_x = payload.position_x
    plant.position_y = payload.position_y
    plant.position_z = payload.position_z
    plant.rotation_x = payload.rotation_x
    plant.rotation_y = payload.rotation_y
    plant.is_placed_in_forest = True
    db.commit()
    db.refresh(plant)
    return _plant_response(plant, user_id=user_id, db=db)


def get_achievements(db: Session, user_id: uuid.UUID) -> AchievementsResponse:
    items = _achievement_progress(db, user_id)
    grouped: dict[str, list[AchievementProgress]] = {}
    for item in items:
        grouped.setdefault(item.category, []).append(item)
    categories = [
        AchievementCategoryGroup(
            id=category_id,
            label=ACHIEVEMENT_CATEGORY_LABELS.get(category_id, category_id.title()),
            achievements=grouped[category_id],
        )
        for category_id in (
            "getting_started",
            "focus",
            "productivity",
            "consistency",
            "forest",
        )
        if category_id in grouped
    ]
    return AchievementsResponse(achievements=items, categories=categories)


def get_dashboard_widget(db: Session, user_id: uuid.UUID) -> DashboardForestWidget:
    profile = _profile_response(db, user_id)
    plant = profile.current_plant
    if plant is None:
        return DashboardForestWidget(
            total_trees_grown=profile.total_trees_grown,
            unassigned_growth_points=profile.unassigned_growth_points,
            needs_plant_selection=True,
            supportive_message=SUPPORTIVE_MESSAGES["no_plant"],
        )
    return DashboardForestWidget(
        species_name=plant.species.name,
        display_name=plant.display_name,
        growth_stage=plant.growth_stage,
        growth_stage_label=plant.growth_stage_label,
        current_growth_points=plant.current_growth_points,
        next_stage_at=plant.next_stage_at or plant.required_growth_points,
        total_trees_grown=profile.total_trees_grown,
        unassigned_growth_points=profile.unassigned_growth_points,
        needs_plant_selection=False,
        supportive_message=plant.supportive_message,
    )


def _already_rewarded(
    db: Session,
    user_id: uuid.UUID,
    source_type: str,
    source_id: str,
) -> bool:
    existing = db.scalar(
        select(RewardEvent.id).where(
            RewardEvent.user_id == user_id,
            RewardEvent.source_type == source_type,
            RewardEvent.source_id == source_id,
        )
    )
    return existing is not None


def _record_reward(
    db: Session,
    user_id: uuid.UUID,
    *,
    source_type: str,
    source_id: str,
    growth_points: int,
    metadata: dict | None = None,
) -> RewardEvent | None:
    if growth_points <= 0:
        return None
    if _already_rewarded(db, user_id, source_type, source_id):
        return None
    event = RewardEvent(
        user_id=user_id,
        source_type=source_type,
        source_id=source_id,
        growth_points=growth_points,
        metadata_json=metadata or {},
    )
    try:
        with db.begin_nested():
            db.add(event)
            db.flush()
    except IntegrityError:
        return None
    return event


def _update_streak(db: Session, profile: UserGamificationProfile) -> int:
    today = utc_now().date()
    bonus = 0
    if profile.last_activity_date == today:
        return 0
    if profile.last_activity_date == today - timedelta(days=1):
        profile.current_streak += 1
    elif profile.last_activity_date is None or profile.last_activity_date < today - timedelta(
        days=1
    ):
        # Forgiving restart — no punitive messaging stored.
        profile.current_streak = 1
    profile.last_activity_date = today
    profile.longest_streak = max(profile.longest_streak, profile.current_streak)
    if profile.current_streak > 1 and profile.current_streak % 3 == 0:
        bonus = STREAK_DAY_BONUS_GP
    return bonus


def _apply_points_to_plant(
    db: Session,
    user_id: uuid.UUID,
    profile: UserGamificationProfile,
    points: int,
    *,
    from_task: bool = False,
    from_focus: bool = False,
) -> tuple[UserPlant | None, bool, str | None, str | None, bool]:
    plant = _growing_plant(db, user_id)
    if plant is None or points <= 0:
        awarded_points = max(points, 0)
        profile.total_growth_points += awarded_points
        profile.unassigned_growth_points += awarded_points
        return None, False, None, None, False

    previous_stage = plant.growth_stage
    plant.current_growth_points += points
    profile.total_growth_points += points
    if from_task:
        plant.tasks_contributed += 1
    if from_focus:
        plant.focus_sessions_contributed += 1

    mature_at = plant.species.required_growth_points or DEFAULT_MATURE_GP
    new_stage = stage_for_points(plant.current_growth_points, mature_at=mature_at)
    plant.growth_stage = new_stage
    stage_changed = new_stage != previous_stage
    plant_completed = False

    if plant.current_growth_points >= mature_at:
        plant.growth_stage = GrowthStage.MATURE.value
        plant.status = PlantStatus.COMPLETED.value
        plant.completed_at = utc_now()
        profile.total_trees_grown += 1
        plant_completed = True
        stage_changed = True
        new_stage = GrowthStage.MATURE.value

    return plant, stage_changed, previous_stage, new_stage, plant_completed


def _metric_value(db: Session, user_id: uuid.UUID, requirement_type: str) -> int:
    profile = get_or_create_profile(db, user_id)
    if requirement_type == "tasks_completed":
        return _count_completed_tasks(db, user_id)
    if requirement_type == "focus_sessions":
        return _count_focus_sessions(db, user_id)
    if requirement_type == "focus_minutes":
        return _count_focus_minutes(db, user_id)
    if requirement_type == "active_days":
        return _count_active_days(db, user_id)
    if requirement_type == "trees_grown":
        return profile.total_trees_grown
    if requirement_type == "species_unlocked":
        species = list(db.scalars(select(PlantSpecies)).all())
        return sum(1 for item in species if _is_species_unlocked(db, user_id, item, profile=profile))
    if requirement_type == "first_task":
        return 1 if _count_completed_tasks(db, user_id) >= 1 else 0
    if requirement_type == "first_focus":
        return 1 if _count_focus_sessions(db, user_id) >= 1 else 0
    return 0


def _achievement_progress(db: Session, user_id: uuid.UUID) -> list[AchievementProgress]:
    achievements = list(
        db.scalars(select(Achievement).order_by(Achievement.sort_order.asc())).all()
    )
    unlocked_rows = {
        row.achievement_id: row
        for row in db.scalars(
            select(UserAchievement).where(UserAchievement.user_id == user_id)
        ).all()
    }
    result: list[AchievementProgress] = []
    for item in achievements:
        unlocked = unlocked_rows.get(item.id)
        progress_value = _metric_value(db, user_id, item.requirement_type)
        if item.requirement_type in {"first_task", "first_focus"}:
            requirement_value = 1
        else:
            requirement_value = item.requirement_value
        result.append(
            AchievementProgress(
                id=item.id,
                name=item.name,
                description=item.description,
                icon=item.icon,
                category=getattr(item, "category", None) or "getting_started",
                unlocked=unlocked is not None,
                unlocked_at=unlocked.unlocked_at if unlocked else None,
                progress_value=min(progress_value, requirement_value)
                if unlocked is None
                else requirement_value,
                requirement_value=requirement_value,
                requirement_type=item.requirement_type,
            )
        )
    return result


def _evaluate_achievements(
    db: Session,
    user_id: uuid.UUID,
) -> list[AchievementProgress]:
    newly: list[AchievementProgress] = []
    for item in _achievement_progress(db, user_id):
        if item.unlocked:
            continue
        if item.progress_value < item.requirement_value:
            continue
        row = UserAchievement(user_id=user_id, achievement_id=item.id)
        try:
            with db.begin_nested():
                db.add(row)
                db.flush()
        except IntegrityError:
            continue
        newly.append(
            AchievementProgress(
                id=item.id,
                name=item.name,
                description=item.description,
                icon=item.icon,
                category=item.category,
                unlocked=True,
                unlocked_at=utc_now(),
                progress_value=item.requirement_value,
                requirement_value=item.requirement_value,
                requirement_type=item.requirement_type,
            )
        )
    return newly


def _maybe_daily_clear_bonus(db: Session, user_id: uuid.UUID) -> int:
    today = utc_now().date()
    source_id = today.isoformat()
    if _already_rewarded(db, user_id, SOURCE_DAILY_CLEAR, source_id):
        return 0

    open_due_today = db.scalar(
        select(func.count())
        .select_from(Task)
        .where(
            Task.user_id == user_id,
            Task.status != TaskStatus.DONE,
            func.date(Task.due_date) == today,
        )
    )
    due_today_total = db.scalar(
        select(func.count())
        .select_from(Task)
        .where(
            Task.user_id == user_id,
            func.date(Task.due_date) == today,
        )
    )
    if not due_today_total or open_due_today:
        return 0

    event = _record_reward(
        db,
        user_id,
        source_type=SOURCE_DAILY_CLEAR,
        source_id=source_id,
        growth_points=DAILY_ALL_TASKS_BONUS_GP,
        metadata={"reason": "all_due_tasks_done"},
    )
    return event.growth_points if event else 0


def award_for_task_completion(
    db: Session,
    user_id: uuid.UUID,
    task: Task,
) -> RewardFeedback:
    source_id = str(task.id)
    if _already_rewarded(db, user_id, SOURCE_TASK_COMPLETE, source_id):
        return RewardFeedback(
            awarded=False,
            message="Growth Points already awarded for this task.",
            profile=_profile_response(db, user_id),
        )

    points = TASK_COMPLETE_GP
    if task.priority == TaskPriority.HIGH:
        points += HIGH_PRIORITY_BONUS_GP

    event = _record_reward(
        db,
        user_id,
        source_type=SOURCE_TASK_COMPLETE,
        source_id=source_id,
        growth_points=points,
        metadata={"priority": task.priority.value, "title": task.title},
    )
    if event is None:
        return RewardFeedback(awarded=False, profile=_profile_response(db, user_id))

    profile = _profile_for_update(db, user_id)
    streak_bonus = _update_streak(db, profile)
    if streak_bonus:
        _record_reward(
            db,
            user_id,
            source_type=SOURCE_STREAK_BONUS,
            source_id=f"{utc_now().date().isoformat()}:{profile.current_streak}",
            growth_points=streak_bonus,
            metadata={"streak": profile.current_streak},
        )
        points += streak_bonus

    points += _maybe_daily_clear_bonus(db, user_id)

    plant, stage_changed, previous_stage, new_stage, plant_completed = _apply_points_to_plant(
        db,
        user_id,
        profile,
        points,
        from_task=True,
    )
    unlocked = _evaluate_achievements(db, user_id)
    db.commit()

    plant_name = _display_name(plant) if plant is not None else None
    if plant is None:
        plant_message = f"{points} Growth Points saved until you choose a plant"
    elif plant_completed:
        plant_message = SUPPORTIVE_MESSAGES["stage_mature"].format(name=plant_name)
    elif stage_changed:
        plant_message = SUPPORTIVE_MESSAGES["stage_up"].format(name=plant_name)
    else:
        plant_message = f"Your {plant_name} is getting stronger"
    return RewardFeedback(
        awarded=True,
        growth_points=points,
        message=f"Task completed · +{points} Growth Points",
        plant_message=plant_message,
        stage_changed=stage_changed,
        previous_stage=previous_stage,
        new_stage=new_stage,
        plant_completed=plant_completed,
        unlocked_achievements=unlocked,
        profile=_profile_response(db, user_id, recently_unlocked=unlocked),
    )


def award_for_focus_session(
    db: Session,
    user_id: uuid.UUID,
    session: FocusSession,
) -> RewardFeedback:
    if not session.completed or session.duration_minutes < MIN_VALID_FOCUS_MINUTES:
        return RewardFeedback(
            awarded=False,
            message="Focus a little longer to help your forest grow.",
            profile=_profile_response(db, user_id),
        )

    source_id = str(session.id)
    if _already_rewarded(db, user_id, SOURCE_FOCUS_SESSION, source_id):
        return RewardFeedback(awarded=False, profile=_profile_response(db, user_id))

    points = FOCUS_SESSION_GP
    today = utc_now().date()
    sessions_today = int(
        db.scalar(
            select(func.count())
            .select_from(FocusSession)
            .where(
                FocusSession.user_id == user_id,
                FocusSession.completed.is_(True),
                FocusSession.duration_minutes >= MIN_VALID_FOCUS_MINUTES,
                func.date(FocusSession.ended_at) == today,
            )
        )
        or 0
    )
    if sessions_today >= 2:
        points += FOCUS_SESSION_STREAK_BONUS_GP

    event = _record_reward(
        db,
        user_id,
        source_type=SOURCE_FOCUS_SESSION,
        source_id=source_id,
        growth_points=points,
        metadata={"duration_minutes": session.duration_minutes},
    )
    if event is None:
        return RewardFeedback(awarded=False, profile=_profile_response(db, user_id))

    profile = _profile_for_update(db, user_id)
    streak_bonus = _update_streak(db, profile)
    if streak_bonus:
        _record_reward(
            db,
            user_id,
            source_type=SOURCE_STREAK_BONUS,
            source_id=f"focus:{today.isoformat()}:{profile.current_streak}",
            growth_points=streak_bonus,
        )
        points += streak_bonus

    plant, stage_changed, previous_stage, new_stage, plant_completed = _apply_points_to_plant(
        db,
        user_id,
        profile,
        points,
        from_focus=True,
    )
    unlocked = _evaluate_achievements(db, user_id)
    db.commit()

    plant_name = _display_name(plant) if plant is not None else None
    if plant is None:
        plant_message = f"{points} Growth Points saved until you choose a plant"
    elif plant_completed:
        plant_message = SUPPORTIVE_MESSAGES["stage_mature"].format(name=plant_name)
    elif stage_changed:
        plant_message = SUPPORTIVE_MESSAGES["stage_up"].format(name=plant_name)
    else:
        plant_message = f"Your {plant_name} enjoyed that quiet focus"
    return RewardFeedback(
        awarded=True,
        growth_points=points,
        message=f"Focus session complete · +{points} Growth Points",
        plant_message=plant_message,
        stage_changed=stage_changed,
        previous_stage=previous_stage,
        new_stage=new_stage,
        plant_completed=plant_completed,
        unlocked_achievements=unlocked,
        profile=_profile_response(db, user_id, recently_unlocked=unlocked),
    )
