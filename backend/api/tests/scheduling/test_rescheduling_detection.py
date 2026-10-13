import uuid
from datetime import UTC, datetime, time
from zoneinfo import ZoneInfo

from app.focus.models import FocusSession, FocusSessionStatus
from app.scheduling.detection import detect_rescheduling_needs
from app.settings.models import UserSettings
from app.tasks.models import Task, TaskStatus


def _settings(
    *,
    work_start: time = time(9),
    work_end: time = time(17),
    timezone: str = "UTC",
    daily_work_limit_minutes: int | None = None,
) -> UserSettings:
    settings = UserSettings(
        work_start=work_start,
        work_end=work_end,
        timezone=timezone,
        pomodoro_minutes=25,
        ai_deadline_urgency_weight=80,
        ai_priority_weight=70,
        ai_estimated_duration_weight=50,
    )
    if daily_work_limit_minutes is not None:
        settings.daily_work_limit_minutes = daily_work_limit_minutes
    return settings


def _task(
    *,
    task_id: uuid.UUID | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    duration: int | None = None,
    due_date: datetime | None = None,
    locked: bool = False,
    status: TaskStatus = TaskStatus.PENDING,
) -> Task:
    return Task(
        id=task_id or uuid.uuid4(),
        user_id=uuid.uuid4(),
        title="Detection task",
        status=status,
        scheduled_start=start,
        scheduled_end=end,
        estimated_duration_minutes=duration,
        due_date=due_date,
        schedule_locked=locked,
    )


def _codes(result) -> set[str]:
    return {change.code for change in result.changes}


def test_valid_current_schedule_does_not_require_rescheduling() -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    task = _task(
        start=now.replace(hour=9),
        end=now.replace(hour=10),
        duration=60,
    )

    result = detect_rescheduling_needs(
        tasks=[task],
        settings=_settings(),
        now=now,
    )

    assert not result.needs_rescheduling
    assert result.movable_task_ids == (task.id,)
    assert result.fixed_task_ids == ()


def test_detects_invalid_schedule_inputs_and_classifies_locked_task_as_fixed() -> None:
    now = datetime(2030, 1, 1, 12, tzinfo=UTC)
    locked = _task(
        start=now.replace(hour=8),
        end=now.replace(hour=9),
        duration=90,
        due_date=now.replace(hour=8, minute=30),
        locked=True,
    )

    result = detect_rescheduling_needs(
        tasks=[locked],
        settings=_settings(),
        now=now,
    )

    assert _codes(result) == {
        "SCHEDULE_DELAYED",
        "DURATION_NO_LONGER_FITS",
        "OUTSIDE_WORKING_HOURS",
        "ENDS_AFTER_DEADLINE",
    }
    assert result.fixed_task_ids == (locked.id,)
    assert result.movable_task_ids == ()
    assert result.affected_task_ids == (locked.id,)


def test_detects_conflicts_and_ignores_completed_tasks() -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    first = _task(start=now.replace(hour=9), end=now.replace(hour=10))
    second = _task(start=now.replace(hour=9, minute=30), end=now.replace(hour=11))
    done = _task(
        start=now.replace(hour=9),
        end=now.replace(hour=11),
        status=TaskStatus.DONE,
    )

    result = detect_rescheduling_needs(
        tasks=[second, done, first],
        settings=_settings(),
        now=now,
    )

    conflicts = [change for change in result.changes if change.code == "SCHEDULE_CONFLICT"]
    assert len(conflicts) == 1
    assert result.affected_task_ids == tuple(sorted((first.id, second.id), key=str))
    assert done.id not in result.movable_task_ids


def test_detects_capacity_pressure_for_unscheduled_task() -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    blocker = _task(
        start=now.replace(hour=9),
        end=now.replace(hour=17),
        locked=True,
    )
    unscheduled = _task(
        duration=60,
        due_date=now.replace(hour=17),
    )

    result = detect_rescheduling_needs(
        tasks=[blocker, unscheduled],
        settings=_settings(),
        now=now,
    )

    pressure = [change for change in result.changes if change.code == "CAPACITY_PRESSURE"]
    assert len(pressure) == 1
    assert pressure[0].task_id == unscheduled.id


def test_active_focus_progress_can_signal_real_overrun() -> None:
    now = datetime(2030, 1, 1, 10, tzinfo=UTC)
    running = _task(
        start=now.replace(hour=9),
        end=now.replace(hour=9, minute=30),
        duration=30,
    )
    next_task = _task(
        start=now.replace(hour=9, minute=30),
        end=now.replace(hour=10, minute=30),
    )
    session = FocusSession(
        id=uuid.uuid4(),
        user_id=running.user_id,
        task_id=running.id,
        started_at=now.replace(hour=9),
        duration_minutes=30,
        planned_duration_minutes=30,
        actual_duration_seconds=45 * 60,
        status=FocusSessionStatus.ACTIVE.value,
        completed=False,
    )

    result = detect_rescheduling_needs(
        tasks=[running, next_task],
        settings=_settings(),
        now=now,
        focus_sessions=[session],
    )

    overrun = next(change for change in result.changes if change.code == "TASK_OVERRUN")
    assert overrun.task_id == running.id
    assert overrun.related_task_ids == (next_task.id,)
    assert len(result.additional_fixed_intervals) == 1
    assert result.additional_fixed_intervals[0].start == running.scheduled_end
    assert result.additional_fixed_intervals[0].end == now.replace(hour=9, minute=45)


def test_detection_is_deterministic_and_does_not_mutate_tasks() -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    first = _task(start=now.replace(hour=9), end=now.replace(hour=10))
    second = _task(start=now.replace(hour=9, minute=30), end=now.replace(hour=11))
    original = (first.scheduled_start, first.scheduled_end, second.scheduled_start)

    forward = detect_rescheduling_needs(
        tasks=[first, second],
        settings=_settings(),
        now=now,
    )
    reverse = detect_rescheduling_needs(
        tasks=[second, first],
        settings=_settings(),
        now=now,
    )

    assert forward == reverse
    assert original == (first.scheduled_start, first.scheduled_end, second.scheduled_start)


def test_incomplete_interval_is_reported_without_crashing() -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    task = _task(start=now.replace(hour=9))

    result = detect_rescheduling_needs(
        tasks=[task],
        settings=_settings(),
        now=now,
    )

    assert _codes(result) == {"INVALID_SCHEDULE_INTERVAL"}


def test_working_hours_detection_uses_user_timezone_across_dst() -> None:
    timezone = ZoneInfo("Australia/Sydney")
    now = datetime(2030, 10, 5, 8, tzinfo=timezone)
    task = _task(
        start=datetime(2030, 10, 5, 9, tzinfo=timezone),
        end=datetime(2030, 10, 5, 10, tzinfo=timezone),
        duration=60,
    )

    result = detect_rescheduling_needs(
        tasks=[task],
        settings=_settings(timezone="Australia/Sydney"),
        now=now,
    )

    assert "OUTSIDE_WORKING_HOURS" not in _codes(result)


def test_detects_only_tasks_beyond_daily_work_limit() -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    first = _task(start=now.replace(hour=9), end=now.replace(hour=10), duration=60)
    second = _task(start=now.replace(hour=10), end=now.replace(hour=11), duration=60)
    overflow = _task(start=now.replace(hour=11), end=now.replace(hour=12), duration=60)

    result = detect_rescheduling_needs(
        tasks=[overflow, second, first],
        settings=_settings(work_end=time(22), daily_work_limit_minutes=120),
        now=now,
    )

    changes = [
        change for change in result.changes if change.code == "DAILY_WORK_LIMIT_EXCEEDED"
    ]
    assert [change.task_id for change in changes] == [overflow.id]


def test_locked_workload_over_daily_limit_requires_manual_action() -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    locked = _task(
        start=now.replace(hour=9),
        end=now.replace(hour=11),
        duration=120,
        locked=True,
    )

    result = detect_rescheduling_needs(
        tasks=[locked],
        settings=_settings(work_end=time(22), daily_work_limit_minutes=60),
        now=now,
    )

    change = next(
        change for change in result.changes if change.code == "DAILY_WORK_LIMIT_EXCEEDED"
    )
    assert change.task_id == locked.id
    assert result.fixed_task_ids == (locked.id,)
