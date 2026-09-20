import uuid
from datetime import datetime, time

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Time, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

DEFAULT_DAILY_WORK_LIMIT_MINUTES = 8 * 60


def effective_daily_work_limit_minutes(settings: "UserSettings") -> int:
    return settings.daily_work_limit_minutes or DEFAULT_DAILY_WORK_LIMIT_MINUTES


class UserSettings(Base):
    __tablename__ = "user_settings"
    __table_args__ = (
        CheckConstraint(
            "pomodoro_minutes BETWEEN 1 AND 240",
            name="ck_user_settings_pomodoro_minutes_range",
        ),
        CheckConstraint(
            "ai_deadline_urgency_weight BETWEEN 0 AND 100",
            name="ck_user_settings_deadline_weight_range",
        ),
        CheckConstraint(
            "ai_priority_weight BETWEEN 0 AND 100",
            name="ck_user_settings_priority_weight_range",
        ),
        CheckConstraint(
            "ai_estimated_duration_weight BETWEEN 0 AND 100",
            name="ck_user_settings_duration_weight_range",
        ),
        CheckConstraint(
            "daily_work_limit_minutes BETWEEN 30 AND 1440",
            name="ck_user_settings_daily_work_limit_range",
        ),
        CheckConstraint(
            "timezone_source IN ('default', 'detected', 'user')",
            name="ck_user_settings_timezone_source_allowed",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    work_start: Mapped[time] = mapped_column(
        Time,
        default=time(9, 0),
        server_default="09:00:00",
        nullable=False,
    )
    work_end: Mapped[time] = mapped_column(
        Time,
        default=time(17, 0),
        server_default="17:00:00",
        nullable=False,
    )
    timezone: Mapped[str] = mapped_column(
        String(64),
        default="UTC",
        server_default="UTC",
        nullable=False,
    )
    timezone_source: Mapped[str] = mapped_column(
        String(16),
        default="default",
        server_default="default",
        nullable=False,
    )
    pomodoro_minutes: Mapped[int] = mapped_column(
        Integer,
        default=25,
        server_default="25",
        nullable=False,
    )
    daily_work_limit_minutes: Mapped[int] = mapped_column(
        Integer,
        default=DEFAULT_DAILY_WORK_LIMIT_MINUTES,
        server_default=str(DEFAULT_DAILY_WORK_LIMIT_MINUTES),
        nullable=False,
    )
    ai_assistant_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )
    ai_deadline_urgency_weight: Mapped[int] = mapped_column(
        Integer,
        default=80,
        server_default="80",
        nullable=False,
    )
    ai_priority_weight: Mapped[int] = mapped_column(
        Integer,
        default=70,
        server_default="70",
        nullable=False,
    )
    ai_estimated_duration_weight: Mapped[int] = mapped_column(
        Integer,
        default=50,
        server_default="50",
        nullable=False,
    )
    notify_task_reminders: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )
    notify_productivity_reminders: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )
    notify_daily_digest: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )
    notify_overdue_alerts: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )
    notify_focus_do_not_disturb: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )
    notify_weekly_report: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default="false",
        nullable=False,
    )
    channel_desktop: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default="false",
        nullable=False,
    )
    channel_push: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )
    channel_email: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
