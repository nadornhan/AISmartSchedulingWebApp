"""Resolve explicit calendar details against the user's local date."""

import re
from dataclasses import dataclass
from datetime import date, timedelta

_WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
_DATE = re.compile(
    r"\b(?:on\s+|due\s+)?(?:"
    r"(?P<iso>\d{4}-\d{2}-\d{2})|"
    r"(?P<relative>day after tomorrow|tomorrow|today|tmr)|"
    r"(?:(?P<modifier>next|this)\s+)?"
    r"(?P<weekday>monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b",
    re.IGNORECASE,
)
_TIME = re.compile(
    r"\b(?:at\s+)?(?:"
    r"(?P<hour12>1[0-2]|0?[1-9])(?::(?P<minute12>[0-5]\d))?\s*(?P<period>am|pm)|"
    r"(?P<hour24>[01]?\d|2[0-3]):(?P<minute24>[0-5]\d))\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ExplicitSchedule:
    text: str
    due_date: date | None
    due_time: str | None


def resolve_schedule(text: str, *, today: date) -> ExplicitSchedule:
    due_date = None
    due_time = None
    spans = []
    date_match = _DATE.search(text)
    if date_match:
        if iso := date_match.group("iso"):
            try:
                due_date = date.fromisoformat(iso)
            except ValueError:
                pass
        elif relative := date_match.group("relative"):
            days = {"today": 0, "tomorrow": 1, "tmr": 1, "day after tomorrow": 2}
            due_date = today + timedelta(days=days[relative.lower()])
        else:
            weekday = _WEEKDAYS.index(date_match.group("weekday").lower())
            days_ahead = (weekday - today.weekday()) % 7
            if days_ahead == 0 and (date_match.group("modifier") or "").lower() == "next":
                days_ahead = 7
            due_date = today + timedelta(days=days_ahead)
        if due_date is not None:
            spans.append(date_match.span())
    time_match = _TIME.search(text)
    if time_match:
        if time_match.group("period"):
            hour = int(time_match.group("hour12")) % 12
            if time_match.group("period").lower() == "pm":
                hour += 12
            minute = int(time_match.group("minute12") or 0)
        else:
            hour = int(time_match.group("hour24"))
            minute = int(time_match.group("minute24"))
        due_time = f"{hour:02d}:{minute:02d}"
        spans.append(time_match.span())
    for start, end in sorted(spans, reverse=True):
        text = text[:start] + " " + text[end:]
    return ExplicitSchedule(text=text, due_date=due_date, due_time=due_time)
