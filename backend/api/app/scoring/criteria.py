from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime
from itertools import pairwise

from app.tasks.models import TaskPriority, TaskStatus
from app.tasks.overdue import is_task_overdue, normalize_due_datetime

PRIORITY_SCORE = {
    TaskPriority.HIGH: 1.0,
    TaskPriority.MEDIUM: 0.7,
    TaskPriority.LOW: 0.4,
    TaskPriority.NO_PRIORITY: 0.2,
}


def deadline_urgency(
    *,
    due_date: datetime | None,
    status: TaskStatus,
    now: datetime,
) -> tuple[float, str | None]:
    if due_date is None:
        return 0.25, None

    due = normalize_due_datetime(due_date)
    hours = (due - now.astimezone(UTC)).total_seconds() / 3600

    if is_task_overdue(status=status, due_date=due_date, now=now):
        return 1.0, "Overdue deadline"
    if hours <= 24:
        return 0.95, "Due within 24 hours"
    if hours <= 72:
        return 0.75, "Due within 3 days"
    if hours <= 168:
        return 0.55, "Due this week"
    return 0.35, "Upcoming deadline"


SLACK_URGENCY_ANCHORS: tuple[tuple[int, float], ...] = (
    (0, 1.0),
    (6 * 60, 0.95),
    (24 * 60, 0.85),
    (72 * 60, 0.65),
    (168 * 60, 0.45),
    (336 * 60, 0.25),
)


def _interpolate_pressure(
    *,
    minutes: float,
    anchors: tuple[tuple[int, float], ...],
) -> float:
    if minutes <= anchors[0][0]:
        return anchors[0][1]

    for (left_minutes, left_score), (right_minutes, right_score) in pairwise(anchors):
        if minutes <= right_minutes:
            ratio = (minutes - left_minutes) / (right_minutes - left_minutes)
            return left_score + ratio * (right_score - left_score)

    return anchors[-1][1]


def slack_aware_deadline_urgency(
    *,
    due_date: datetime | None,
    now: datetime,
    required_minutes: int,
) -> tuple[float, str | None, dict[str, float | int | str | None]]:
    if due_date is None:
        return (
            0.15,
            None,
            {
                "model": "slack-aware",
                "time_until_deadline_minutes": None,
                "required_minutes": required_minutes,
                "slack_minutes": None,
            },
        )

    due = normalize_due_datetime(due_date)
    time_until_deadline = (due - now.astimezone(UTC)).total_seconds() / 60
    slack_minutes = time_until_deadline - required_minutes
    metadata = {
        "model": "slack-aware",
        "time_until_deadline_minutes": round(time_until_deadline, 2),
        "required_minutes": required_minutes,
        "slack_minutes": round(slack_minutes, 2),
    }

    if time_until_deadline <= 0 or slack_minutes <= 0:
        return 1.0, "No deadline slack remaining", metadata

    score = _interpolate_pressure(
        minutes=slack_minutes,
        anchors=SLACK_URGENCY_ANCHORS,
    )
    reason = (
        "Large deadline slack"
        if slack_minutes >= SLACK_URGENCY_ANCHORS[-1][0]
        else "Slack-aware deadline urgency"
    )
    return max(0.0, min(1.0, score)), reason, metadata


def scheduling_flexibility_pressure(
    *,
    due_date: datetime | None,
    now: datetime,
    capacity,
) -> tuple[float, str | None, dict[str, float | int | str | None | bool]]:
    largest_window_slack = capacity.largest_window_minutes - capacity.required_minutes
    metadata: dict[str, float | int | str | None | bool] = {
        "model": "scheduling-flexibility",
        "required_minutes": capacity.required_minutes,
        "total_available_minutes": capacity.total_available_minutes,
        "largest_window_minutes": capacity.largest_window_minutes,
        "largest_window_slack_minutes": largest_window_slack,
        "feasible_window_count": capacity.feasible_window_count,
        "has_contiguous_capacity": capacity.has_contiguous_capacity,
        "earliest_feasible_start": (
            capacity.earliest_feasible_start.isoformat()
            if capacity.earliest_feasible_start
            else None
        ),
        "latest_feasible_start": (
            capacity.latest_feasible_start.isoformat()
            if capacity.latest_feasible_start
            else None
        ),
        "flexibility_minutes": None,
    }

    if due_date is None:
        return 0.15, None, metadata

    if not capacity.has_contiguous_capacity or capacity.latest_feasible_start is None:
        return 1.0, "No feasible contiguous window before deadline", metadata

    flexibility_minutes = (
        capacity.latest_feasible_start - now.astimezone(UTC)
    ).total_seconds() / 60
    metadata["flexibility_minutes"] = round(flexibility_minutes, 2)

    if flexibility_minutes <= 0:
        return 1.0, "No scheduling flexibility remaining", metadata

    score = _interpolate_pressure(
        minutes=flexibility_minutes,
        anchors=SLACK_URGENCY_ANCHORS,
    )
    reason = (
        "Large scheduling flexibility"
        if flexibility_minutes >= SLACK_URGENCY_ANCHORS[-1][0]
        else "Scheduling flexibility pressure"
    )
    return max(0.0, min(1.0, score)), reason, metadata


def explicit_priority(priority: TaskPriority) -> tuple[float, str | None]:
    return PRIORITY_SCORE[priority], None


def duration_preference(minutes: int | None) -> tuple[float, str | None]:
    # This is the legacy short-task preference, not slot-fit scoring.
    if minutes is None:
        return 0.4, None
    if minutes <= 10:
        return 1.0, "Short estimated duration"
    if minutes <= 30:
        return 0.8, "Fits a focused block"
    if minutes <= 60:
        return 0.55, "Medium estimated duration"
    return 0.3, "Longer estimated duration"


def duration_slot_fit(
    *,
    required_minutes: int,
    window_minutes: int,
) -> tuple[float, str | None]:
    if required_minutes <= 0 or window_minutes <= 0:
        return 0.0, "Invalid duration slot fit"
    if required_minutes > window_minutes:
        return 0.0, "Task does not fit candidate window"

    fit = max(0.0, min(1.0, required_minutes / window_minutes))
    if fit == 1.0:
        return fit, "Exact duration fit"
    return fit, "Fits within candidate window"


def peak_focus_hour(preferred_hours: Counter[int]) -> int | None:
    if not preferred_hours:
        return None

    max_count = max(preferred_hours.values())
    return min(hour for hour, count in preferred_hours.items() if count == max_count)


def focus_slot_fit(
    preferred_hours: Counter[int],
    *,
    candidate_hour: int,
) -> tuple[float, str | None, int | None]:
    peak = peak_focus_hour(preferred_hours)
    if peak is None:
        return 0.0, None, None

    distance = min(abs(candidate_hour - peak), 24 - abs(candidate_hour - peak))
    if distance == 0:
        return 1.0, "Exact focus hour fit", peak
    if distance <= 2:
        return 0.5, "Near focus hour fit", peak
    return 0.0, None, peak


def focus_hour_bonus(
    preferred_hours: Counter[int],
    *,
    candidate_hour: int,
) -> float:
    if not preferred_hours:
        return 0.0
    top = preferred_hours.most_common(1)[0][0]
    distance = min(abs(candidate_hour - top), 24 - abs(candidate_hour - top))
    if distance == 0:
        return 0.15
    if distance <= 2:
        return 0.08
    return 0.0
