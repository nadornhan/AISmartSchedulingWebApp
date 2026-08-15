import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator


class GrowthStageThresholds(BaseModel):
    seedling: int
    growing: int
    mature: int


class PlantSpeciesSummary(BaseModel):
    id: str
    name: str
    description: str
    image_key: str
    required_growth_points: int
    unlocked: bool
    unlock_hint: str | None = None
    is_default: bool = False


class ForestPosition(BaseModel):
    x: float
    y: float = 0
    z: float
    rotation_x: float = 0
    rotation_y: float = 0


class UserPlantResponse(BaseModel):
    id: uuid.UUID
    species: PlantSpeciesSummary
    display_name: str
    custom_name: str | None = None
    current_growth_points: int
    required_growth_points: int
    growth_stage: str
    growth_stage_label: str
    status: str
    progress_ratio: float = Field(ge=0, le=1)
    next_stage_at: int | None = None
    supportive_message: str
    tasks_contributed: int = 0
    focus_sessions_contributed: int = 0
    started_at: datetime
    completed_at: datetime | None = None
    position: ForestPosition | None = None
    is_placed_in_forest: bool = False


class StreakSummary(BaseModel):
    current_streak: int = Field(ge=0)
    longest_streak: int = Field(ge=0)
    last_activity_date: date | None = None
    message: str


class GamificationProfileResponse(BaseModel):
    total_growth_points: int = Field(ge=0)
    total_trees_grown: int = Field(ge=0)
    streak: StreakSummary
    current_plant: UserPlantResponse | None
    needs_plant_selection: bool
    stage_thresholds: GrowthStageThresholds
    recently_unlocked_achievements: list["AchievementProgress"] = Field(default_factory=list)


class ForestResponse(BaseModel):
    forest_name: str
    current_plant: UserPlantResponse | None
    completed_plants: list[UserPlantResponse]
    needs_plant_selection: bool
    total_trees_grown: int
    supportive_message: str


class ForestSceneResponse(BaseModel):
    forest_name: str
    trees: list[UserPlantResponse]
    total_trees_grown: int
    supportive_message: str


class UpdateForestRequest(BaseModel):
    forest_name: str = Field(min_length=1, max_length=48)

    @field_validator("forest_name")
    @classmethod
    def normalize_forest_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Forest name cannot be empty")
        return cleaned[:48]


class PlantCatalogResponse(BaseModel):
    plants: list[PlantSpeciesSummary]


class SelectPlantRequest(BaseModel):
    species_id: str = Field(min_length=1, max_length=64)


class UpdatePlantRequest(BaseModel):
    custom_name: str = Field(min_length=1, max_length=48)

    @field_validator("custom_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Plant name cannot be empty")
        return cleaned[:48]


class PlacePlantRequest(BaseModel):
    position_x: float = Field(ge=-40, le=40)
    position_y: float = Field(default=0, ge=-2, le=5)
    position_z: float = Field(ge=-40, le=40)
    rotation_x: float = Field(default=0, ge=-1.0, le=1.0)
    rotation_y: float = Field(default=0, ge=-6.3, le=6.3)


class AchievementProgress(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    category: str
    unlocked: bool
    unlocked_at: datetime | None = None
    progress_value: int = 0
    requirement_value: int
    requirement_type: str


class AchievementCategoryGroup(BaseModel):
    id: str
    label: str
    achievements: list[AchievementProgress]


class AchievementsResponse(BaseModel):
    achievements: list[AchievementProgress]
    categories: list[AchievementCategoryGroup] = Field(default_factory=list)


class RewardFeedback(BaseModel):
    awarded: bool
    growth_points: int = 0
    message: str | None = None
    plant_message: str | None = None
    stage_changed: bool = False
    previous_stage: str | None = None
    new_stage: str | None = None
    plant_completed: bool = False
    unlocked_achievements: list[AchievementProgress] = Field(default_factory=list)
    profile: GamificationProfileResponse | None = None


class DashboardForestWidget(BaseModel):
    species_name: str | None = None
    display_name: str | None = None
    growth_stage: str | None = None
    growth_stage_label: str | None = None
    current_growth_points: int = 0
    next_stage_at: int | None = None
    total_trees_grown: int = 0
    needs_plant_selection: bool = False
    supportive_message: str
