from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import ClassVar

from app.settings.models import UserSettings
from app.tasks.models import Task, TaskPriority
from app.tasks.overdue import is_task_overdue


@dataclass(frozen=True)
class SchedulingProfileV1:
    deadline_weight: float
    priority_weight: float
    duration_weight: float
    profile_name: ClassVar[str] = "scheduling"
    scoring_version: ClassVar[str] = "v1"

    @classmethod
    def from_settings(cls, settings: UserSettings) -> SchedulingProfileV1:
        return cls(
            deadline_weight=settings.ai_deadline_urgency_weight / 100,
            priority_weight=settings.ai_priority_weight / 100,
            duration_weight=settings.ai_estimated_duration_weight / 100,
        )

    def factor_weights(self) -> dict[str, float]:
        return {
            "deadline_urgency": self.deadline_weight,
            "priority": self.priority_weight,
            "duration_preference": self.duration_weight,
        }

    def should_apply_focus_bonus(self, *, active_weight_sum: float) -> bool:
        return True


@dataclass(frozen=True)
class SchedulingProfileV2:
    deadline_weight: float
    priority_weight: float
    profile_name: ClassVar[str] = "scheduling"
    scoring_version: ClassVar[str] = "v2"

    @classmethod
    def from_settings(cls, settings: UserSettings) -> SchedulingProfileV2:
        return cls(
            deadline_weight=settings.ai_deadline_urgency_weight / 100,
            priority_weight=settings.ai_priority_weight / 100,
        )

    def factor_weights(self) -> dict[str, float]:
        return {
            "deadline_urgency": self.deadline_weight,
            "priority": self.priority_weight,
        }

    def should_apply_focus_bonus(self, *, active_weight_sum: float) -> bool:
        return active_weight_sum > 0


@dataclass(frozen=True)
class SchedulingProfileV3:
    profile_name: ClassVar[str] = "scheduling"
    scoring_version: ClassVar[str] = "v3"
    task_importance_profile_name: ClassVar[str] = SchedulingProfileV2.profile_name
    task_importance_scoring_version: ClassVar[str] = SchedulingProfileV2.scoring_version


@dataclass(frozen=True)
class SchedulingProfileV4:
    profile_name: ClassVar[str] = "scheduling"
    scoring_version: ClassVar[str] = "v4"
    task_importance_profile_name: ClassVar[str] = SchedulingProfileV2.profile_name
    task_importance_scoring_version: ClassVar[str] = "task_importance"


@dataclass(frozen=True)
class SchedulingProfileV5:
    deadline_weight: float
    priority_weight: float
    profile_name: ClassVar[str] = "scheduling"
    scoring_version: ClassVar[str] = "v5"
    task_importance_profile_name: ClassVar[str] = "scheduling"
    task_importance_scoring_version: ClassVar[str] = "v5"

    @classmethod
    def from_settings(cls, settings: UserSettings) -> SchedulingProfileV5:
        return cls(
            deadline_weight=settings.ai_deadline_urgency_weight / 100,
            priority_weight=settings.ai_priority_weight / 100,
        )

    def factor_weights(self) -> dict[str, float]:
        return {
            "deadline_urgency": self.deadline_weight,
            "priority": self.priority_weight,
        }


LegacySchedulingProfile = SchedulingProfileV1


PRIORITY_RANK = {
    TaskPriority.HIGH: 0,
    TaskPriority.MEDIUM: 1,
    TaskPriority.LOW: 2,
    TaskPriority.NO_PRIORITY: 3,
}


def _day_bounds(day) -> tuple[datetime, datetime]:
    start = datetime.combine(day, datetime.min.time(), tzinfo=UTC)
    end = start + timedelta(days=1)
    return start, end


def _is_between(value: datetime | None, start: datetime, end: datetime) -> bool:
    if value is None:
        return False

    return start <= value.astimezone(UTC) < end


def _due_sort_value(task: Task) -> datetime:
    return task.due_date or datetime.max.replace(tzinfo=UTC)


@dataclass(frozen=True)
class NextTaskProfileV1:
    profile_name: ClassVar[str] = "next_task"
    scoring_version: ClassVar[str] = "v1"

    def sort_key(self, task: Task, *, now: datetime) -> tuple:
        today_start, today_end = _day_bounds(now.date())
        due_today = _is_between(task.due_date, today_start, today_end)

        return (
            not due_today,
            task.estimated_duration_minutes or 999999,
            PRIORITY_RANK[task.priority],
            _due_sort_value(task),
            str(task.id),
        )

    def reasons(self, task: Task, *, now: datetime) -> list[str]:
        reasons: list[str] = []
        today_start, today_end = _day_bounds(now.date())

        if _is_between(task.due_date, today_start, today_end):
            reasons.append("Due today")
        elif is_task_overdue(status=task.status, due_date=task.due_date, now=now):
            reasons.append("Overdue")
        elif task.due_date is not None:
            reasons.append("Due soon")

        if task.priority == TaskPriority.HIGH:
            reasons.append("High priority")

        if (
            task.estimated_duration_minutes is not None
            and task.estimated_duration_minutes <= 10
        ):
            reasons.append("Short estimated duration")

        return reasons

    def select(self, tasks: list[Task], *, now: datetime) -> Task | None:
        return min(
            tasks,
            key=lambda task: self.sort_key(task, now=now),
            default=None,
        )


@dataclass(frozen=True)
class QuickWinProfileV1:
    profile_name: ClassVar[str] = "quick_win"
    scoring_version: ClassVar[str] = "v1"

    def is_eligible(self, task: Task) -> bool:
        return (
            task.estimated_duration_minutes is not None
            and task.estimated_duration_minutes <= 10
        )

    def sort_key(self, task: Task) -> tuple:
        return (
            _due_sort_value(task),
            PRIORITY_RANK[task.priority],
            task.estimated_duration_minutes or 999999,
            str(task.id),
        )

    def select(self, tasks: list[Task], *, limit: int) -> list[Task]:
        return sorted(
            (task for task in tasks if self.is_eligible(task)),
            key=self.sort_key,
        )[:limit]
