import uuid
from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field, field_serializer, model_validator

from app.timezones import validate_timezone_name


class WorkPatternSettings(BaseModel):
    work_start: time
    work_end: time
    timezone: str
    pomodoro_minutes: int = Field(ge=1, le=240)

    @field_serializer("work_start", "work_end")
    def serialize_time(self, value: time) -> str:
        return value.strftime("%H:%M")

    @model_validator(mode="after")
    def validate_work_window(self) -> "WorkPatternSettings":
        if self.work_end <= self.work_start:
            raise ValueError("work_end must be later than work_start")

        return self


class WorkPatternSettingsUpdate(BaseModel):
    work_start: time | None = None
    work_end: time | None = None
    timezone: str | None = None
    pomodoro_minutes: int | None = Field(default=None, ge=1, le=240)

    @model_validator(mode="after")
    def validate_work_pattern(self) -> "WorkPatternSettingsUpdate":
        if (
            self.work_start is not None
            and self.work_end is not None
            and self.work_end <= self.work_start
        ):
            raise ValueError("work_end must be later than work_start")

        if self.timezone is not None:
            validate_timezone_name(self.timezone)

        return self


class AiSchedulingSettings(BaseModel):
    ai_assistant_enabled: bool
    ai_deadline_urgency_weight: int = Field(ge=0, le=100)
    ai_priority_weight: int = Field(ge=0, le=100)
    # Deprecated compatibility field; production scheduling/v4 ignores it.
    ai_estimated_duration_weight: int = Field(ge=0, le=100)


class AiSchedulingSettingsUpdate(BaseModel):
    ai_assistant_enabled: bool | None = None
    ai_deadline_urgency_weight: int | None = Field(default=None, ge=0, le=100)
    ai_priority_weight: int | None = Field(default=None, ge=0, le=100)
    ai_estimated_duration_weight: int | None = Field(default=None, ge=0, le=100)


class NotificationPreferences(BaseModel):
    notify_task_reminders: bool
    notify_productivity_reminders: bool
    notify_daily_digest: bool
    notify_overdue_alerts: bool
    notify_focus_do_not_disturb: bool
    notify_weekly_report: bool


class NotificationPreferencesUpdate(BaseModel):
    notify_task_reminders: bool | None = None
    notify_productivity_reminders: bool | None = None
    notify_daily_digest: bool | None = None
    notify_overdue_alerts: bool | None = None
    notify_focus_do_not_disturb: bool | None = None
    notify_weekly_report: bool | None = None


class ChannelPreferences(BaseModel):
    channel_desktop: bool
    channel_push: bool
    channel_email: bool


class ChannelPreferencesUpdate(BaseModel):
    channel_desktop: bool | None = None
    channel_push: bool | None = None
    channel_email: bool | None = None


class UserSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    work_pattern: WorkPatternSettings
    ai_scheduling: AiSchedulingSettings
    notifications: NotificationPreferences
    channels: ChannelPreferences
    created_at: datetime
    updated_at: datetime


class UserSettingsUpdate(BaseModel):
    work_pattern: WorkPatternSettingsUpdate | None = None
    ai_scheduling: AiSchedulingSettingsUpdate | None = None
    notifications: NotificationPreferencesUpdate | None = None
    channels: ChannelPreferencesUpdate | None = None
