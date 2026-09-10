"""Growth thresholds and reward amounts for Personal Forest.

Frontend should read stage thresholds from API responses rather than
hardcoding these values.

Life stages (3):
  seedling → growing → mature
"""

from __future__ import annotations

# Inclusive lower bounds for each life stage (GP on the current plant).
STAGE_THRESHOLDS: dict[str, int] = {
    "seedling": 0,
    "growing": 50,
    "mature": 100,
}

# Default required GP to fully mature a plant when species does not override.
DEFAULT_MATURE_GP = 100

# Productivity rewards (backend-only; never exposed as an add-points endpoint).
TASK_COMPLETE_GP = 10
HIGH_PRIORITY_BONUS_GP = 5
FOCUS_SESSION_GP = 5
FOCUS_SESSION_STREAK_BONUS_GP = 2  # when 2+ valid focus sessions same day
DAILY_ALL_TASKS_BONUS_GP = 8
STREAK_DAY_BONUS_GP = 3

# Focus sessions shorter than this do not award Growth Points.
MIN_VALID_FOCUS_MINUTES = 5

SOURCE_TASK_COMPLETE = "task_complete"
SOURCE_FOCUS_SESSION = "focus_session"
SOURCE_DAILY_CLEAR = "daily_clear"
SOURCE_STREAK_BONUS = "streak_bonus"

SUPPORTIVE_MESSAGES = {
    "seedling": "A quiet beginning. Every small step helps your forest.",
    "growing": "Your plant is stretching taller — keep tending it gently.",
    "mature": "Fully grown and ready to join your forest.",
    "quiet_day": "Yesterday was a quiet day. Your forest is ready whenever you are.",
    "no_plant": "Choose a plant to start growing your personal forest.",
    "stage_up": "Your {name} has grown into the next stage!",
    "stage_mature": "Your {name} is fully grown — a calm milestone for your forest.",
}

# Legacy stage aliases from the earlier 5-stage system.
_LEGACY_STAGE_MAP = {
    "seed": "seedling",
    "sprout": "seedling",
    "young": "growing",
}


def normalize_stage(stage: str) -> str:
    return _LEGACY_STAGE_MAP.get(stage, stage)


def stage_for_points(points: int, *, mature_at: int = DEFAULT_MATURE_GP) -> str:
    if points >= mature_at:
        return "mature"
    if points >= STAGE_THRESHOLDS["growing"]:
        return "growing"
    return "seedling"


def next_stage_threshold(stage: str, *, mature_at: int = DEFAULT_MATURE_GP) -> int | None:
    stage = normalize_stage(stage)
    order = ["seedling", "growing", "mature"]
    try:
        index = order.index(stage)
    except ValueError:
        return STAGE_THRESHOLDS["growing"]
    if index >= len(order) - 1:
        return None
    nxt = order[index + 1]
    if nxt == "mature":
        return mature_at
    return STAGE_THRESHOLDS[nxt]


def stage_progress(
    points: int,
    *,
    mature_at: int = DEFAULT_MATURE_GP,
) -> tuple[str, int, int | None, float]:
    """Return (stage, points, next_threshold, ratio 0-1 toward next stage)."""
    stage = stage_for_points(points, mature_at=mature_at)
    nxt = next_stage_threshold(stage, mature_at=mature_at)
    if nxt is None:
        return stage, points, None, 1.0
    lower = STAGE_THRESHOLDS[stage] if stage != "mature" else mature_at
    span = max(nxt - lower, 1)
    ratio = min(max((points - lower) / span, 0.0), 1.0)
    return stage, points, nxt, ratio
