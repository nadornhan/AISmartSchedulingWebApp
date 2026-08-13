import uuid
from datetime import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.settings.models import UserSettings
from app.settings.schemas import UserSettingsResponse, UserSettingsUpdate

DEFAULT_WORK_START = time(9, 0)
DEFAULT_WORK_END = time(17, 0)


def _invalidate_ai_plan(db: Session, user_id: uuid.UUID) -> None:
    # Lazy import avoids circular dependency with scheduling.service.
    from app.scheduling import service as scheduling_service

    scheduling_service.invalidate_pending_plan(db, user_id)


def get_or_create_user_settings(
    db: Session,
    user_id: uuid.UUID,
) -> UserSettings:
    settings = db.scalar(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )

    if settings is not None:
        return settings

    settings = UserSettings(user_id=user_id)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def serialize_user_settings(settings: UserSettings) -> UserSettingsResponse:
    return UserSettingsResponse(
        id=settings.id,
        user_id=settings.user_id,
        work_pattern={
            "work_start": settings.work_start,
            "work_end": settings.work_end,
            "pomodoro_minutes": settings.pomodoro_minutes,
        },
        ai_scheduling={
            "ai_assistant_enabled": settings.ai_assistant_enabled,
            "ai_deadline_urgency_weight": settings.ai_deadline_urgency_weight,
            "ai_priority_weight": settings.ai_priority_weight,
            "ai_estimated_duration_weight": settings.ai_estimated_duration_weight,
        },
        notifications={
            "notify_task_reminders": settings.notify_task_reminders,
            "notify_productivity_reminders": settings.notify_productivity_reminders,
            "notify_daily_digest": settings.notify_daily_digest,
            "notify_overdue_alerts": settings.notify_overdue_alerts,
            "notify_focus_do_not_disturb": settings.notify_focus_do_not_disturb,
            "notify_weekly_report": settings.notify_weekly_report,
        },
        channels={
            "channel_desktop": settings.channel_desktop,
            "channel_push": settings.channel_push,
            "channel_email": settings.channel_email,
        },
        created_at=settings.created_at,
        updated_at=settings.updated_at,
    )


def update_user_settings(
    db: Session,
    *,
    user_id: uuid.UUID,
    update: UserSettingsUpdate,
) -> UserSettings:
    settings = db.scalar(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    work_start = settings.work_start if settings is not None else DEFAULT_WORK_START
    work_end = settings.work_end if settings is not None else DEFAULT_WORK_END

    if update.work_pattern is not None:
        work_pattern_update = update.work_pattern.model_dump(exclude_unset=True)
        work_start = work_pattern_update.get("work_start", work_start)
        work_end = work_pattern_update.get("work_end", work_end)
        validate_work_window(work_start, work_end)

    if settings is None:
        settings = UserSettings(user_id=user_id)
        db.add(settings)

    if update.work_pattern is not None:
        apply_update_group(settings, update.work_pattern.model_dump(exclude_unset=True))

    if update.ai_scheduling is not None:
        apply_update_group(settings, update.ai_scheduling.model_dump(exclude_unset=True))

    if update.notifications is not None:
        apply_update_group(settings, update.notifications.model_dump(exclude_unset=True))

    if update.channels is not None:
        apply_update_group(settings, update.channels.model_dump(exclude_unset=True))

    scheduling_inputs_changed = (
        update.work_pattern is not None or update.ai_scheduling is not None
    )

    db.commit()
    db.refresh(settings)

    if scheduling_inputs_changed:
        _invalidate_ai_plan(db, user_id)

    return settings


def apply_update_group(
    settings: UserSettings,
    values: dict[str, object],
) -> None:
    for field, value in values.items():
        setattr(settings, field, value)


def validate_work_window(work_start: time, work_end: time) -> None:
    if work_end <= work_start:
        raise ValueError("work_end must be later than work_start")
