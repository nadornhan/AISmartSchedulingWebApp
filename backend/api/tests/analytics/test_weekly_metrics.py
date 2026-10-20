from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.analytics import service
from app.analytics.models import WeeklyAIInsight
from app.analytics.schemas import WeeklyInsightNarrative
from app.auth.models import User
from app.database import Base
from app.focus.models import FocusSession, focus_session_tasks
from app.settings.models import UserSettings
from app.tasks.models import Task, TaskStatus


def task(task_id, estimate=60, completed_at=None):
    return SimpleNamespace(
        id=task_id, estimated_duration_minutes=estimate, completed_at=completed_at
    )


def session(start, seconds, task_id=1, linked=(), elapsed=None):
    return SimpleNamespace(
        started_at=start,
        ended_at=start + timedelta(seconds=seconds if elapsed is None else elapsed),
        actual_duration_seconds=seconds,
        duration_minutes=90,
        task_id=task_id,
        tasks=[SimpleNamespace(id=value) for value in linked],
    )


@pytest.mark.parametrize(
    "reference, timezone, expected_start, expected_end",
    [
        (
            datetime(2026, 9, 16, tzinfo=UTC),
            "UTC",
            "2026-09-07T00:00:00+00:00",
            "2026-09-14T00:00:00+00:00",
        ),
        # It is already Monday in Sydney, although the UTC date is still Sunday.
        (
            datetime(2026, 9, 20, 15, tzinfo=UTC),
            "Australia/Sydney",
            "2026-09-13T14:00:00+00:00",
            "2026-09-20T14:00:00+00:00",
        ),
        # The completed week contains the spring DST transition (167 elapsed hours).
        (
            datetime(2026, 10, 5, tzinfo=UTC),
            "Australia/Sydney",
            "2026-09-27T14:00:00+00:00",
            "2026-10-04T13:00:00+00:00",
        ),
    ],
)
def test_previous_completed_local_week(reference, timezone, expected_start, expected_end):
    start, end = service._previous_week_bounds(reference, timezone)
    assert start.isoformat() == expected_start
    assert end.isoformat() == expected_end


def test_default_utc_weekly_cache_can_use_the_client_timezone():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(
        engine,
        tables=[
            User.__table__,
            UserSettings.__table__,
            Task.__table__,
            FocusSession.__table__,
            focus_session_tasks,
            WeeklyAIInsight.__table__,
        ],
    )
    ai = SimpleNamespace(
        generate_structured=Mock(
            return_value=SimpleNamespace(
                data=WeeklyInsightNarrative(narrative="Sydney weekly insight."),
                metadata=SimpleNamespace(
                    model="test",
                    prompt_version="weekly-insights-v1",
                ),
            )
        )
    )
    reference = datetime(2026, 9, 20, 15, tzinfo=UTC)

    with Session(engine) as db:
        user = User(email="browser-timezone@example.com", password_hash="test")
        db.add(user)
        db.flush()
        db.add(UserSettings(user_id=user.id, timezone="UTC"))
        db.commit()

        insight = service.get_or_create_weekly_insight(
            db,
            user,
            ai_service=ai,
            reference=reference,
            client_timezone_name="Australia/Sydney",
        )

        assert insight.metrics.timezone == "Australia/Sydney"
        assert insight.period_start.replace(tzinfo=UTC) == datetime(2026, 9, 13, 14, tzinfo=UTC)
        assert insight.period_end.replace(tzinfo=UTC) == datetime(2026, 9, 20, 14, tzinfo=UTC)

        cached = service.get_or_create_weekly_insight(
            db,
            user,
            ai_service=ai,
            reference=reference,
            client_timezone_name="Australia/Sydney",
        )
        assert cached.cached
        assert ai.generate_structured.call_count == 1

    engine.dispose()


def test_timezone_change_reuses_the_same_local_week_cache():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(
        engine,
        tables=[
            User.__table__,
            UserSettings.__table__,
            Task.__table__,
            FocusSession.__table__,
            focus_session_tasks,
            WeeklyAIInsight.__table__,
        ],
    )
    ai = SimpleNamespace(
        generate_structured=Mock(
            return_value=SimpleNamespace(
                data=WeeklyInsightNarrative(narrative="One narrative."),
                metadata=SimpleNamespace(model="test", prompt_version="weekly-insights-v1"),
            )
        )
    )
    reference = datetime(2026, 9, 23, 12, tzinfo=UTC)

    with Session(engine) as db:
        user = User(email="travel@example.com", password_hash="test")
        db.add(user)
        db.flush()
        db.add(UserSettings(user_id=user.id, timezone="UTC"))
        db.commit()

        first = service.get_or_create_weekly_insight(
            db,
            user,
            ai_service=ai,
            reference=reference,
            client_timezone_name="Australia/Sydney",
        )
        cached = service.get_or_create_weekly_insight(
            db,
            user,
            ai_service=ai,
            reference=reference,
            client_timezone_name="America/New_York",
        )

        assert not first.cached
        assert cached.cached
        assert cached.generated_at == first.generated_at
        assert cached.narrative == first.narrative
        assert ai.generate_structured.call_count == 1

    engine.dispose()


def test_zero_actual_time_does_not_become_planned_time():
    start = datetime(2026, 9, 7, tzinfo=UTC)
    value = session(start, 0, elapsed=3600)
    assert service._session_seconds_in_window(value, start, start + timedelta(hours=1)) == 0


def test_pause_time_and_cross_week_overlap():
    start = datetime(2026, 9, 6, 23, 30, tzinfo=UTC)
    value = session(start, 1800, elapsed=3600)
    boundary = datetime(2026, 9, 7, tzinfo=UTC)
    assert service._session_seconds_in_window(value, boundary, boundary + timedelta(days=7)) == 900


def test_comparison_excludes_missing_measurements_and_ambiguous_sessions():
    start = datetime(2026, 9, 6, tzinfo=UTC)
    tasks = [task(1), task(2, None), task(3), task(4)]
    sessions = [
        session(start, 3600),
        session(start, 300, task_id=2),
        session(start, 1800, task_id=3, linked=(3, 4)),
    ]
    assert service._duration_comparison(tasks, sessions) == (60, 60, 100, 1)


def test_estimate_errors_do_not_cancel_out():
    start = datetime(2026, 9, 6, tzinfo=UTC)
    result = service._duration_comparison(
        [task(1), task(2)],
        [session(start, 1800), session(start, 5400, task_id=2)],
    )
    assert result == (120, 120, 50, 2)


def test_weekly_metrics_use_full_task_history_and_aggregate_before_rounding():
    start = datetime(2026, 9, 7, tzinfo=UTC)
    end = start + timedelta(days=7)
    completed = task(1, 61, start + timedelta(hours=12))
    sessions = [
        session(start - timedelta(days=1), 3600),
        session(start + timedelta(hours=10, minutes=59, seconds=30), 90),
        session(start + timedelta(hours=11, minutes=5), 30),
    ]
    db = Mock()
    db.scalars.side_effect = [
        Mock(all=lambda: [completed]),
        Mock(all=lambda: sessions),
        Mock(all=lambda: [completed]),
    ]
    db.scalar.side_effect = [1, 0]
    metrics = service.get_weekly_productivity_metrics(db, 1, period_start=start, period_end=end)
    assert metrics.actual_minutes == 62  # Includes Sunday's work on Monday's completed task.
    assert metrics.focus_duration_minutes == 2  # Only work inside the reporting week.
    assert metrics.productivity_trend[0].focus_minutes == 2
    assert {p.hour: p.focus_minutes for p in metrics.productive_hours}[11] == 1
    assert metrics.current_streak_days == 0  # Report ends Sunday, not the wall-clock date.
    assert metrics.duration_comparison_task_count == 1


def test_streak_uses_local_report_end_and_ignores_future_completions():
    reference = datetime(2026, 9, 13, 13, 59, tzinfo=UTC)  # Sunday night in Sydney.
    db = Mock()
    db.scalars.return_value.all.return_value = [
        task(1, completed_at=datetime(2026, 9, 12, 15, tzinfo=UTC)),
        task(2, completed_at=datetime(2026, 9, 11, 15, tzinfo=UTC)),
        task(3, completed_at=datetime(2026, 9, 13, 15, tzinfo=UTC)),
    ]
    assert (
        service._current_streak_days(db, 1, reference=reference, timezone_name="Australia/Sydney")
        == 2
    )


def test_saved_report_reused_across_sessions_and_week_rollover():
    # SQLite tests persistence/query behavior; PostgreSQL locking has its own test.
    engine = create_engine("sqlite://")
    Base.metadata.create_all(
        engine,
        tables=[
            User.__table__,
            UserSettings.__table__,
            Task.__table__,
            FocusSession.__table__,
            focus_session_tasks,
            WeeklyAIInsight.__table__,
        ],
    )
    ai = SimpleNamespace(
        generate_structured=Mock(
            return_value=SimpleNamespace(
                data=WeeklyInsightNarrative(narrative="Saved weekly narrative."),
                metadata=SimpleNamespace(
                    model="test",
                    prompt_version="weekly-insights-v1",
                ),
            )
        )
    )
    reference = datetime(2026, 9, 16, tzinfo=UTC)
    with Session(engine) as db:
        user = User(email="weekly@example.com", password_hash="test")
        db.add(user)
        db.flush()
        user_id = user.id
        db.add(UserSettings(user_id=user_id, timezone="Australia/Sydney"))
        completed = Task(
            user_id=user_id,
            title="Private title",
            status=TaskStatus.DONE,
            estimated_duration_minutes=60,
            created_at=datetime(2026, 9, 1, tzinfo=UTC),
            completed_at=datetime(2026, 9, 7, 3, tzinfo=UTC),
        )
        db.add(completed)
        db.flush()
        db.add(
            FocusSession(
                user_id=user_id,
                task_id=completed.id,
                started_at=datetime(2026, 9, 5, tzinfo=UTC),
                ended_at=datetime(2026, 9, 5, 1, tzinfo=UTC),
                actual_duration_seconds=3600,
                duration_minutes=60,
                planned_duration_minutes=60,
                status="completed",
                completed=True,
            )
        )
        db.commit()
        first = service.get_or_create_weekly_insight(db, user, ai_service=ai, reference=reference)
        assert first.metrics.actual_minutes == 60
        assert first.metrics.focus_duration_minutes == 0
        assert first.metrics.timezone == "Australia/Sydney"
        assert "Private title" not in ai.generate_structured.call_args.kwargs["prompt"]
        completed.estimated_duration_minutes = 120
        db.commit()
    with Session(engine) as db:
        user = db.get(User, user_id)
        cached = service.get_or_create_weekly_insight(db, user, ai_service=ai, reference=reference)
        assert cached.cached
        assert cached.metrics == first.metrics
        assert ai.generate_structured.call_count == 1
        following = service.get_or_create_weekly_insight(
            db,
            user,
            ai_service=ai,
            reference=reference + timedelta(days=7),
        )
        assert not following.cached
        assert following.period_start != cached.period_start
        assert ai.generate_structured.call_count == 2
    engine.dispose()
