from datetime import UTC, date, datetime

from app.timezones import local_date, utc_bounds_for_local_date


def test_local_date_can_differ_from_utc_date() -> None:
    instant = datetime(2026, 9, 20, 15, tzinfo=UTC)

    assert local_date(instant, "Australia/Sydney") == date(2026, 9, 21)
    assert local_date(instant, "America/New_York") == date(2026, 9, 20)


def test_local_day_bounds_follow_daylight_saving_transition() -> None:
    start, end = utc_bounds_for_local_date(date(2026, 10, 4), "Australia/Sydney")

    assert start == datetime(2026, 10, 3, 14, tzinfo=UTC)
    assert end == datetime(2026, 10, 4, 13, tzinfo=UTC)
    assert (end - start).total_seconds() == 23 * 60 * 60
