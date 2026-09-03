from __future__ import annotations

import json
from datetime import UTC
from typing import Any

from app.settings.models import UserSettings
from app.tasks.models import Task


def build_ai_preview_prompt(
    *,
    tasks: list[Task],
    settings: UserSettings,
) -> str:
    payload = {
        "tasks": [_task_payload(task) for task in tasks],
        "rules": {
            "work_start": settings.work_start.strftime("%H:%M"),
            "work_end": settings.work_end.strftime("%H:%M"),
            "default_duration_minutes": settings.pomodoro_minutes,
            "minimum_slot_minutes": 15,
            "maximum_slot_minutes": 120,
            "maximum_slots": 5,
            "availability_limitation": (
                "Only work_start and work_end are available. Meetings, classes, "
                "external calendars, and unavailable periods are not included."
            ),
        },
        "output_contract": {
            "schedule": [
                {
                    "task_id": "UUID copied exactly from one requested task",
                    "suggested_start": "ISO 8601 datetime",
                    "suggested_end": "ISO 8601 datetime",
                    "explanation": "short reason",
                }
            ]
        },
    }

    return (
        "Create one schedule preview for the requested CHRONO tasks. "
        "Return only JSON matching the output_contract. Do not include markdown. "
        "Use only the provided task IDs and rules.\n\n"
        f"{json.dumps(payload, sort_keys=True, separators=(',', ':'), default=str)}"
    )


def _task_payload(task: Task) -> dict[str, Any]:
    due_date = task.due_date
    if due_date is not None and due_date.tzinfo is not None:
        due_date = due_date.astimezone(UTC)

    return {
        "id": str(task.id),
        "title": task.title,
        "priority": task.priority.value,
        "due_date": due_date.isoformat() if due_date is not None else None,
        "estimated_duration_minutes": task.estimated_duration_minutes,
    }
