from __future__ import annotations

from dataclasses import dataclass

from app.settings.models import UserSettings


@dataclass(frozen=True)
class LegacySchedulingProfile:
    deadline_weight: float
    priority_weight: float
    duration_weight: float

    @classmethod
    def from_settings(cls, settings: UserSettings) -> LegacySchedulingProfile:
        return cls(
            deadline_weight=settings.ai_deadline_urgency_weight / 100,
            priority_weight=settings.ai_priority_weight / 100,
            duration_weight=settings.ai_estimated_duration_weight / 100,
        )
