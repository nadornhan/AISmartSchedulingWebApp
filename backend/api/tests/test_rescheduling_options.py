import uuid
from datetime import UTC, datetime, time
from itertools import pairwise
from zoneinfo import ZoneInfo

from app.focus.models import FocusSession, FocusSessionStatus
from app.scheduling.detection import detect_rescheduling_needs
from app.scheduling.rescheduling import generate_rescheduling_options
from app.scoring.constraints import intervals_overlap, is_within_working_hours
from app.settings.models import UserSettings
from app.tasks.models import Task, TaskPriority, TaskStatus


def _settings(*, timezone: str = "UTC") -> UserSettings:
    return UserSettings(
        work_start=time(9),
        work_end=time(17),
        timezone=timezone,
        pomodoro_minutes=25,
        ai_deadline_urgency_weight=80,
        ai_priority_weight=70,
        ai_estimated_duration_weight=50,
    )


def _task(
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    duration: int | None = 60,
    due_date: datetime | None = None,
    locked: bool = False,
) -> Task:
    return Task(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        title="Reschedule task",
        status=TaskStatus.PENDING,
        priority=TaskPriority.NO_PRIORITY,
        scheduled_start=start,
        scheduled_end=end,
        estimated_duration_minutes=duration,
        due_date=due_date,
        schedule_locked=locked,
    )


def _generate(
    tasks: list[Task],
    *,
    now: datetime,
    settings: UserSettings | None = None,
):
    settings = settings or _settings()
    detection = detect_rescheduling_needs(tasks=tasks, settings=settings, now=now)
    return generate_rescheduling_options(
        tasks=tasks,
        settings=settings,
        detection=detection,
        now=now,
    )


def test_generates_unique_deterministic_v7_options_without_moving_locked_task() -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    locked = _task(
        start=now.replace(hour=15),
        end=now.replace(hour=16),
        due_date=now.replace(hour=17),
        locked=True,
    )
    movable = _task(
        start=now.replace(hour=15),
        end=now.replace(hour=16),
        due_date=now.replace(hour=17),
    )

    first = _generate([locked, movable], now=now)
    second = _generate([movable, locked], now=now)

    assert 2 <= len(first.options) <= 3
    assert first == second
    assert [option.deterministic_rank for option in first.options] == list(
        range(1, len(first.options) + 1)
    )
    signatures = {
        tuple((move.task_id, move.proposed_start, move.proposed_end) for move in option.moves)
        for option in first.options
    }
    assert len(signatures) == len(first.options)
    for option in first.options:
        assert locked.id in option.preserved_task_ids
        assert {move.task_id for move in option.moves} == {movable.id}
        move = option.moves[0]
        assert not intervals_overlap(
            start=move.proposed_start,
            end=move.proposed_end,
            existing_start=locked.scheduled_start,
            existing_end=locked.scheduled_end,
        )
        assert move.proposed_end <= movable.due_date
        assert is_within_working_hours(
            start=move.proposed_start,
            end=move.proposed_end,
            settings=_settings(),
        ).passed
        assert move.scoring is not None
        assert move.scoring.scoring_version == "v7"
        assert "SCHEDULE_CONFLICT" in option.resolved_change_codes


def test_returns_one_option_when_only_one_unique_schedule_is_feasible() -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    blocker = _task(
        start=now.replace(hour=9),
        end=now.replace(hour=16),
        locked=True,
    )
    movable = _task(
        start=now.replace(hour=15),
        end=now.replace(hour=16),
        due_date=now.replace(hour=17),
    )

    result = _generate([blocker, movable], now=now)

    assert len(result.options) == 1
    assert result.options[0].moves[0].proposed_start == now.replace(hour=16)
    assert result.options[0].moves[0].proposed_end == now.replace(hour=17)


def test_returns_capacity_issue_when_no_option_is_feasible() -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    blocker = _task(
        start=now.replace(hour=9),
        end=now.replace(hour=17),
        locked=True,
    )
    unscheduled = _task(due_date=now.replace(hour=17))

    result = _generate([blocker, unscheduled], now=now)

    assert result.options == ()
    assert len(result.issues) == 1
    assert result.issues[0].task_id == unscheduled.id
    assert result.issues[0].code == "NO_WINDOW_BEFORE_DEADLINE"


def test_locked_invalid_state_requires_manual_action() -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    locked = _task(
        start=now.replace(hour=8),
        end=now.replace(hour=9),
        locked=True,
    )

    result = _generate([locked], now=now)

    assert result.options == ()
    assert len(result.issues) == 1
    assert result.issues[0].code == "LOCKED_TASK_REQUIRES_MANUAL_ACTION"


def test_multi_task_option_has_no_internal_overlap() -> None:
    now = datetime(2030, 1, 1, 8, tzinfo=UTC)
    locked = _task(
        start=now.replace(hour=12),
        end=now.replace(hour=13),
        locked=True,
    )
    first = _task(
        start=now.replace(hour=12),
        end=now.replace(hour=13),
        due_date=now.replace(hour=17),
    )
    second = _task(
        start=now.replace(hour=12, minute=30),
        end=now.replace(hour=13, minute=30),
        due_date=now.replace(hour=17),
    )

    result = _generate([locked, first, second], now=now)

    assert result.options
    for option in result.options:
        ordered = sorted(option.moves, key=lambda move: move.proposed_start)
        assert all(
            previous.proposed_end <= current.proposed_start
            for previous, current in pairwise(ordered)
        )


def test_options_respect_sydney_hours_and_deadline_across_dst() -> None:
    timezone = ZoneInfo("Australia/Sydney")
    now = datetime(2030, 10, 5, 8, tzinfo=timezone)
    deadline = datetime(2030, 10, 5, 17, tzinfo=timezone)
    locked = _task(
        start=datetime(2030, 10, 5, 15, tzinfo=timezone),
        end=datetime(2030, 10, 5, 16, tzinfo=timezone),
        due_date=deadline,
        locked=True,
    )
    movable = _task(
        start=datetime(2030, 10, 5, 15, tzinfo=timezone),
        end=datetime(2030, 10, 5, 16, tzinfo=timezone),
        due_date=deadline,
    )
    settings = _settings(timezone="Australia/Sydney")

    result = _generate([locked, movable], now=now, settings=settings)

    assert result.options
    for option in result.options:
        move = option.moves[0]
        local_start = move.proposed_start.astimezone(timezone)
        local_end = move.proposed_end.astimezone(timezone)
        assert time(9) <= local_start.time() < local_end.time() <= time(17)
        assert move.proposed_end <= deadline


def test_active_overrun_is_a_temporary_fixed_interval() -> None:
    now = datetime(2030, 1, 1, 10, tzinfo=UTC)
    running = _task(
        start=now.replace(hour=9),
        end=now.replace(hour=9, minute=30),
    )
    downstream = _task(
        start=now.replace(hour=9, minute=30),
        end=now.replace(hour=10, minute=30),
        due_date=now.replace(hour=17),
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
    settings = _settings()
    detection = detect_rescheduling_needs(
        tasks=[running, downstream],
        settings=settings,
        now=now,
        focus_sessions=[session],
    )

    result = generate_rescheduling_options(
        tasks=[running, downstream],
        settings=settings,
        detection=detection,
        now=now,
    )

    assert result.options
    for option in result.options:
        assert running.id in option.preserved_task_ids
        assert {move.task_id for move in option.moves} == {downstream.id}
        assert option.moves[0].proposed_start >= now.replace(hour=10)
