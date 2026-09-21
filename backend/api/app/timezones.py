from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DEFAULT_USER_TIMEZONE = "UTC"


def validate_timezone_name(value: str) -> str:
    try:
        ZoneInfo(value)
    except ZoneInfoNotFoundError as exc:
        raise ValueError("timezone must be a valid IANA timezone") from exc

    return value


def user_timezone(value: str | None) -> ZoneInfo:
    return ZoneInfo(validate_timezone_name(value or DEFAULT_USER_TIMEZONE))


def normalize_instant(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)

    return value.astimezone(UTC)


def local_date(value: datetime, timezone_name: str | None):
    return normalize_instant(value).astimezone(user_timezone(timezone_name)).date()


def local_hour(value: datetime, timezone_name: str | None) -> int:
    return normalize_instant(value).astimezone(user_timezone(timezone_name)).hour


def local_today(
    timezone_name: str | None,
    *,
    now: datetime | None = None,
) -> date:
    return local_date(now or datetime.now(UTC), timezone_name)


def utc_bounds_for_local_date(
    day: date,
    timezone_name: str | None,
) -> tuple[datetime, datetime]:
    timezone = user_timezone(timezone_name)
    local_start = datetime.combine(day, time.min, tzinfo=timezone)
    local_end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=timezone)
    return local_start.astimezone(UTC), local_end.astimezone(UTC)
