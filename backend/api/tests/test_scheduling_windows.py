import uuid
from datetime import UTC, datetime, time

from app.scheduling.engine import RankedTask, build_schedule_slots
from app.scheduling.windows import (
    CandidateWindow,
    OccupiedInterval,
    build_task_window_candidate,
    derive_free_windows,
    scheduling_required_minutes,
    task_fits_window,
)
from app.settings.models import UserSettings
from app.tasks.models import Task, TaskPriority, TaskStatus


def _settings(
    *,
    work_start: time = time(9, 0),
    work_end: time = time(17, 0),
    pomodoro_minutes: int = 25,
) -> UserSettings:
    return UserSettings(
        work_start=work_start,
        work_end=work_end,
        pomodoro_minutes=pomodoro_minutes,
        ai_deadline_urgency_weight=80,
        ai_priority_weight=70,
        ai_estimated_duration_weight=50,
    )


def _task(
    *,
    task_id: uuid.UUID | None = None,
    priority: TaskPriority = TaskPriority.NO_PRIORITY,
    due_date: datetime | None = None,
    estimated_duration_minutes: int | None = None,
    scheduled_start: datetime | None = None,
    scheduled_end: datetime | None = None,
    status: TaskStatus = TaskStatus.PENDING,
) -> Task:
    return Task(
        id=task_id or uuid.uuid4(),
        user_id=uuid.uuid4(),
        title="Window candidate",
        priority=priority,
        due_date=due_date,
        estimated_duration_minutes=estimated_duration_minutes,
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        status=status,
    )


def _window(hour_start: int, hour_end: int) -> CandidateWindow:
    day = datetime(2099, 1, 1, tzinfo=UTC)
    return CandidateWindow(
        start=day.replace(hour=hour_start),
        end=day.replace(hour=hour_end),
    )


def _occupied(hour_start: int, hour_end: int) -> OccupiedInterval:
    window = _window(hour_start, hour_end)
    return OccupiedInterval(
        start=window.start,
        end=window.end,
        source_id=uuid.uuid4(),
        source_type="task",
    )


def test_free_windows_without_occupied_intervals() -> None:
    assert derive_free_windows(
        work_window=_window(9, 17),
        occupied_intervals=[],
    ) == [_window(9, 17)]


def test_free_windows_split_around_one_occupied_interval() -> None:
    assert derive_free_windows(
        work_window=_window(9, 17),
        occupied_intervals=[_occupied(10, 11)],
    ) == [_window(9, 10), _window(11, 17)]


def test_free_windows_split_around_multiple_occupied_intervals() -> None:
    assert derive_free_windows(
        work_window=_window(9, 17),
        occupied_intervals=[_occupied(13, 14), _occupied(10, 11)],
    ) == [_window(9, 10), _window(11, 13), _window(14, 17)]


def test_free_windows_merge_overlapping_occupied_intervals() -> None:
    day = datetime(2099, 1, 1, tzinfo=UTC)
    first = OccupiedInterval(
        start=day.replace(hour=10),
        end=day.replace(hour=11, minute=30),
        source_id=uuid.uuid4(),
        source_type="task",
    )
    second = OccupiedInterval(
        start=day.replace(hour=11),
        end=day.replace(hour=12),
        source_id=uuid.uuid4(),
        source_type="task",
    )

    assert derive_free_windows(
        work_window=_window(9, 17),
        occupied_intervals=[first, second],
    ) == [_window(9, 10), _window(12, 17)]


def test_free_windows_clip_occupied_interval_to_working_hours() -> None:
    day = datetime(2099, 1, 1, tzinfo=UTC)
    interval = OccupiedInterval(
        start=day.replace(hour=8),
        end=day.replace(hour=10),
        source_id=uuid.uuid4(),
        source_type="task",
    )

    assert derive_free_windows(
        work_window=_window(9, 17),
        occupied_intervals=[interval],
    ) == [_window(10, 17)]


def test_free_windows_preserve_boundary_touching() -> None:
    assert derive_free_windows(
        work_window=_window(9, 17),
        occupied_intervals=[_occupied(9, 10), _occupied(10, 11)],
    ) == [_window(11, 17)]


def test_duration_feasibility_compares_required_duration_to_window() -> None:
    window = _window(9, 10)

    assert task_fits_window(
        _task(estimated_duration_minutes=30),
        window,
        _settings(),
    )
    assert not task_fits_window(
        _task(estimated_duration_minutes=90),
        window,
        _settings(),
    )
    assert task_fits_window(
        _task(estimated_duration_minutes=60),
        window,
        _settings(),
    )


def test_missing_duration_uses_pomodoro_fallback() -> None:
    task = _task(estimated_duration_minutes=None)

    assert scheduling_required_minutes(task, _settings(pomodoro_minutes=25)) == 25


def test_long_task_is_not_truncated_to_120_minutes() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    long_task = _task(estimated_duration_minutes=480)

    slots = build_schedule_slots(
        [RankedTask(long_task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[long_task],
    )

    assert len(slots) == 1
    _task_result, start, end, _explanation = slots[0]
    assert start == datetime(2099, 1, 1, 9, tzinfo=UTC)
    assert end == datetime(2099, 1, 1, 17, tzinfo=UTC)
    assert int((end - start).total_seconds() // 60) == 480


def test_long_task_is_skipped_when_no_full_window_fits() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    too_long = _task(estimated_duration_minutes=481)

    slots = build_schedule_slots(
        [RankedTask(too_long, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[too_long],
    )

    assert slots == []


def test_ranked_task_uses_first_feasible_free_window() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    task = _task(estimated_duration_minutes=30)

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[task],
    )

    assert slots[0][1:3] == (
        datetime(2099, 1, 1, 9, tzinfo=UTC),
        datetime(2099, 1, 1, 9, 30, tzinfo=UTC),
    )


def test_active_suggestion_candidates_are_treated_as_occupied() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    task = _task(estimated_duration_minutes=60)

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[task],
        existing_candidates=[
            (
                uuid.uuid4(),
                datetime(2099, 1, 1, 9, tzinfo=UTC),
                datetime(2099, 1, 1, 10, tzinfo=UTC),
            )
        ],
    )

    assert slots[0][1:3] == (
        datetime(2099, 1, 1, 10, tzinfo=UTC),
        datetime(2099, 1, 1, 11, tzinfo=UTC),
    )


def test_later_feasible_window_is_used_when_first_window_is_too_small() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    task = _task(estimated_duration_minutes=90)
    blocker = _task(
        scheduled_start=datetime(2099, 1, 1, 9, 30, tzinfo=UTC),
        scheduled_end=datetime(2099, 1, 1, 10, tzinfo=UTC),
    )

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[task, blocker],
    )

    assert slots[0][1:3] == (
        datetime(2099, 1, 1, 10, tzinfo=UTC),
        datetime(2099, 1, 1, 11, 30, tzinfo=UTC),
    )


def test_same_task_prefers_tighter_fit_window_over_earlier_loose_window() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    task = _task(estimated_duration_minutes=60)
    blocker = _task(
        scheduled_start=datetime(2099, 1, 1, 11, tzinfo=UTC),
        scheduled_end=datetime(2099, 1, 1, 16, tzinfo=UTC),
    )

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[task, blocker],
    )

    assert slots[0][1:3] == (
        datetime(2099, 1, 1, 16, tzinfo=UTC),
        datetime(2099, 1, 1, 17, tzinfo=UTC),
    )


def test_higher_importance_task_beats_better_slot_fit_in_allocation() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    high_long = _task(
        priority=TaskPriority.HIGH,
        estimated_duration_minutes=60,
    )
    medium_short = _task(
        priority=TaskPriority.MEDIUM,
        estimated_duration_minutes=30,
    )
    blocker = _task(
        scheduled_start=datetime(2099, 1, 1, 11, tzinfo=UTC),
        scheduled_end=datetime(2099, 1, 1, 11, 30, tzinfo=UTC),
    )

    slots = build_schedule_slots(
        [
            RankedTask(high_long, 0.9, [], []),
            RankedTask(medium_short, 0.8, [], []),
        ],
        _settings(work_end=time(12, 0)),
        now=now,
        existing_tasks=[high_long, medium_short, blocker],
    )

    assert slots[0][0].id == high_long.id
    assert slots[0][1:3] == (
        datetime(2099, 1, 1, 9, tzinfo=UTC),
        datetime(2099, 1, 1, 10, tzinfo=UTC),
    )


def test_short_medium_task_does_not_recover_v1_bias_through_slot_fit() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    high_long = _task(priority=TaskPriority.HIGH, estimated_duration_minutes=90)
    medium_short = _task(priority=TaskPriority.MEDIUM, estimated_duration_minutes=10)

    slots = build_schedule_slots(
        [
            RankedTask(high_long, 0.9, [], []),
            RankedTask(medium_short, 0.8, [], []),
        ],
        _settings(),
        now=now,
        existing_tasks=[high_long, medium_short],
    )

    assert slots[0][0].id == high_long.id


def test_tighter_fit_preserves_large_block_for_long_task() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    short_task = _task(estimated_duration_minutes=60)
    long_task = _task(estimated_duration_minutes=120)
    blocker = _task(
        scheduled_start=datetime(2099, 1, 1, 10, tzinfo=UTC),
        scheduled_end=datetime(2099, 1, 1, 11, tzinfo=UTC),
    )

    slots = build_schedule_slots(
        [
            RankedTask(short_task, 1.0, [], []),
            RankedTask(long_task, 0.9, [], []),
        ],
        _settings(),
        now=now,
        existing_tasks=[short_task, long_task, blocker],
    )

    assert [(slot[0].id, slot[1], slot[2]) for slot in slots] == [
        (
            short_task.id,
            datetime(2099, 1, 1, 9, tzinfo=UTC),
            datetime(2099, 1, 1, 10, tzinfo=UTC),
        ),
        (
            long_task.id,
            datetime(2099, 1, 1, 11, tzinfo=UTC),
            datetime(2099, 1, 1, 13, tzinfo=UTC),
        ),
    ]


def test_multiple_tasks_can_consume_one_large_window_sequentially() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    first = _task(estimated_duration_minutes=60)
    second = _task(estimated_duration_minutes=90)

    slots = build_schedule_slots(
        [
            RankedTask(first, 1.0, [], []),
            RankedTask(second, 0.9, [], []),
        ],
        _settings(),
        now=now,
        existing_tasks=[first, second],
    )

    assert slots[0][1:3] == (
        datetime(2099, 1, 1, 9, tzinfo=UTC),
        datetime(2099, 1, 1, 10, tzinfo=UTC),
    )
    assert slots[1][1:3] == (
        datetime(2099, 1, 1, 10, tzinfo=UTC),
        datetime(2099, 1, 1, 11, 30, tzinfo=UTC),
    )


def test_candidate_ending_after_deadline_is_skipped() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    task = _task(
        due_date=datetime(2099, 1, 1, 9, 30, tzinfo=UTC),
        estimated_duration_minutes=60,
    )

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[task],
    )

    assert slots == []


def test_task_window_candidate_represents_entire_required_duration() -> None:
    task = _task(estimated_duration_minutes=90)
    candidate = build_task_window_candidate(
        task=task,
        window=_window(9, 12),
        settings=_settings(),
    )

    assert candidate is not None
    assert candidate.required_minutes == 90
    assert candidate.proposed_start == datetime(2099, 1, 1, 9, tzinfo=UTC)
    assert candidate.proposed_end == datetime(2099, 1, 1, 10, 30, tzinfo=UTC)
