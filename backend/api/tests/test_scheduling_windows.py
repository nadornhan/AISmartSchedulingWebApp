import uuid
from collections import Counter
from datetime import UTC, datetime, time
from zoneinfo import ZoneInfo

from app.scheduling import engine as scheduling_engine
from app.scheduling.engine import RankedTask, build_schedule_slots
from app.scheduling.windows import (
    CandidateWindow,
    OccupiedInterval,
    PlanningHorizon,
    WorkingPeriod,
    build_task_window_candidate,
    candidate_windows_before_deadline,
    derive_free_windows,
    derive_free_windows_for_periods,
    planning_horizon,
    scheduling_required_minutes,
    summarize_task_capacity,
    task_fits_window,
    work_window_for_day,
    working_periods_for_horizon,
)
from app.scoring.criteria import scheduling_flexibility_pressure
from app.settings.models import UserSettings
from app.tasks.models import Task, TaskPriority, TaskStatus


def _settings(
    *,
    work_start: time = time(9, 0),
    work_end: time = time(17, 0),
    pomodoro_minutes: int = 25,
    timezone: str = "UTC",
    deadline_weight: int = 80,
    priority_weight: int = 70,
) -> UserSettings:
    return UserSettings(
        work_start=work_start,
        work_end=work_end,
        timezone=timezone,
        pomodoro_minutes=pomodoro_minutes,
        ai_deadline_urgency_weight=deadline_weight,
        ai_priority_weight=priority_weight,
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


def _window_on(day: int, hour_start: int, hour_end: int) -> CandidateWindow:
    base = datetime(2099, 1, day, tzinfo=UTC)
    return CandidateWindow(
        start=base.replace(hour=hour_start),
        end=base.replace(hour=hour_end),
    )


def _occupied(hour_start: int, hour_end: int) -> OccupiedInterval:
    window = _window(hour_start, hour_end)
    return OccupiedInterval(
        start=window.start,
        end=window.end,
        source_id=uuid.uuid4(),
        source_type="task",
    )


def _blocking_task(day: int, hour_start: int, hour_end: int) -> Task:
    window = _window_on(day, hour_start, hour_end)
    return _task(scheduled_start=window.start, scheduled_end=window.end)


def _full_day_blockers(*days: int) -> list[Task]:
    return [_blocking_task(day, 9, 17) for day in days]


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


def test_work_window_for_day_respects_sydney_local_hours() -> None:
    settings = _settings(timezone="Australia/Sydney")
    window = work_window_for_day(
        day=datetime(2026, 9, 4, tzinfo=UTC).date(),
        settings=settings,
    )

    assert window.start.astimezone(ZoneInfo("Australia/Sydney")).time() == time(9, 0)
    assert window.end.astimezone(ZoneInfo("Australia/Sydney")).time() == time(17, 0)


def test_work_window_for_day_respects_non_dst_local_hours() -> None:
    settings = _settings(timezone="Asia/Ho_Chi_Minh")
    window = work_window_for_day(
        day=datetime(2026, 9, 4, tzinfo=UTC).date(),
        settings=settings,
    )

    assert window.start == datetime(2026, 9, 4, 2, tzinfo=UTC)
    assert window.end == datetime(2026, 9, 4, 10, tzinfo=UTC)


def test_work_window_for_day_keeps_sydney_nine_am_across_dst_transition() -> None:
    settings = _settings(timezone="Australia/Sydney")
    timezone = ZoneInfo("Australia/Sydney")

    before_dst = work_window_for_day(
        day=datetime(2026, 10, 3, tzinfo=UTC).date(),
        settings=settings,
    )
    after_dst = work_window_for_day(
        day=datetime(2026, 10, 5, tzinfo=UTC).date(),
        settings=settings,
    )

    assert before_dst.start.astimezone(timezone).time() == time(9, 0)
    assert after_dst.start.astimezone(timezone).time() == time(9, 0)
    assert before_dst.start.utcoffset() == UTC.utcoffset(before_dst.start)
    assert after_dst.start < after_dst.end
    assert before_dst.start.hour != after_dst.start.hour


def test_v7_capacity_pressure_preserves_sydney_work_hours_across_dst() -> None:
    settings = _settings(timezone="Australia/Sydney")
    timezone = ZoneInfo("Australia/Sydney")
    horizon = PlanningHorizon(
        start=datetime(2026, 10, 2, 22, tzinfo=UTC),
        end=datetime(2026, 10, 5, 8, tzinfo=UTC),
        days=2,
    )
    periods = working_periods_for_horizon(
        horizon=horizon,
        settings=settings,
        timezone_name=settings.timezone,
    )
    windows = [period.as_window for period in periods]
    task = _task(
        due_date=datetime(2026, 10, 5, 17, tzinfo=timezone),
        estimated_duration_minutes=60,
    )

    summary = summarize_task_capacity(
        task=task,
        windows=windows,
        settings=settings,
    )
    pressure, _reason, metadata = scheduling_flexibility_pressure(
        due_date=task.due_date,
        now=horizon.start,
        capacity=summary,
    )

    assert [period.start.astimezone(timezone).time() for period in periods] == [
        time(9, 0),
        time(9, 0),
        time(9, 0),
    ]
    assert summary.latest_feasible_start is not None
    assert summary.latest_feasible_start.astimezone(timezone) == datetime(
        2026,
        10,
        5,
        16,
        tzinfo=timezone,
    )
    assert pressure < 1.0
    assert metadata["latest_feasible_start"] == summary.latest_feasible_start.isoformat()


def test_production_schedule_uses_user_local_work_start() -> None:
    now = datetime(2026, 9, 3, 22, tzinfo=UTC)
    task = _task(estimated_duration_minutes=60)

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(timezone="Australia/Sydney"),
        now=now,
        existing_tasks=[task],
    )

    _task_result, start, end, _explanation = slots[0]
    timezone = ZoneInfo("Australia/Sydney")
    assert start.astimezone(timezone) == datetime(
        2026,
        9,
        4,
        9,
        tzinfo=timezone,
    )
    assert end.astimezone(timezone).time() == time(10, 0)


def test_production_schedule_does_not_schedule_after_local_work_end() -> None:
    now = datetime(2026, 9, 4, 6, 30, tzinfo=UTC)
    task = _task(estimated_duration_minutes=90)

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(timezone="Australia/Sydney"),
        now=now,
        existing_tasks=[task],
    )

    _task_result, start, _end, _explanation = slots[0]
    assert start.astimezone(ZoneInfo("Australia/Sydney")) == datetime(
        2026,
        9,
        5,
        9,
        tzinfo=ZoneInfo("Australia/Sydney"),
    )


def test_planning_horizon_defaults_to_seven_days_from_now() -> None:
    now = datetime(2099, 1, 1, 10, 15, tzinfo=UTC)

    horizon = planning_horizon(now=now)

    assert horizon == PlanningHorizon(
        start=now,
        end=datetime(2099, 1, 8, 10, 15, tzinfo=UTC),
        days=7,
    )


def test_planning_horizon_rejects_non_positive_days() -> None:
    now = datetime(2099, 1, 1, 10, tzinfo=UTC)

    try:
        planning_horizon(now=now, days=0)
    except ValueError as exc:
        assert str(exc) == "planning horizon must include at least one day"
    else:
        raise AssertionError("expected planning_horizon to reject zero days")


def test_working_periods_for_horizon_create_one_period_per_day() -> None:
    horizon = PlanningHorizon(
        start=datetime(2099, 1, 1, 8, tzinfo=UTC),
        end=datetime(2099, 1, 4, 8, tzinfo=UTC),
        days=3,
    )

    assert working_periods_for_horizon(
        horizon=horizon,
        settings=_settings(),
    ) == [
        WorkingPeriod(
            start=datetime(2099, 1, 1, 9, tzinfo=UTC),
            end=datetime(2099, 1, 1, 17, tzinfo=UTC),
        ),
        WorkingPeriod(
            start=datetime(2099, 1, 2, 9, tzinfo=UTC),
            end=datetime(2099, 1, 2, 17, tzinfo=UTC),
        ),
        WorkingPeriod(
            start=datetime(2099, 1, 3, 9, tzinfo=UTC),
            end=datetime(2099, 1, 3, 17, tzinfo=UTC),
        ),
    ]


def test_working_periods_clip_first_day_to_now_inside_work_hours() -> None:
    horizon = PlanningHorizon(
        start=datetime(2099, 1, 1, 10, 30, tzinfo=UTC),
        end=datetime(2099, 1, 2, 12, tzinfo=UTC),
        days=1,
    )

    assert working_periods_for_horizon(
        horizon=horizon,
        settings=_settings(),
    )[0] == WorkingPeriod(
        start=datetime(2099, 1, 1, 10, 30, tzinfo=UTC),
        end=datetime(2099, 1, 1, 17, tzinfo=UTC),
    )


def test_working_periods_start_at_work_start_before_work_hours() -> None:
    horizon = PlanningHorizon(
        start=datetime(2099, 1, 1, 6, tzinfo=UTC),
        end=datetime(2099, 1, 1, 12, tzinfo=UTC),
        days=1,
    )

    assert working_periods_for_horizon(
        horizon=horizon,
        settings=_settings(),
    ) == [
        WorkingPeriod(
            start=datetime(2099, 1, 1, 9, tzinfo=UTC),
            end=datetime(2099, 1, 1, 12, tzinfo=UTC),
        )
    ]


def test_working_periods_skip_current_day_after_work_end() -> None:
    horizon = PlanningHorizon(
        start=datetime(2099, 1, 1, 18, tzinfo=UTC),
        end=datetime(2099, 1, 2, 12, tzinfo=UTC),
        days=1,
    )

    assert working_periods_for_horizon(
        horizon=horizon,
        settings=_settings(),
    ) == [
        WorkingPeriod(
            start=datetime(2099, 1, 2, 9, tzinfo=UTC),
            end=datetime(2099, 1, 2, 12, tzinfo=UTC),
        )
    ]


def test_working_periods_clip_final_period_to_horizon_end() -> None:
    horizon = PlanningHorizon(
        start=datetime(2099, 1, 1, 8, tzinfo=UTC),
        end=datetime(2099, 1, 2, 14, 30, tzinfo=UTC),
        days=1,
    )

    assert working_periods_for_horizon(
        horizon=horizon,
        settings=_settings(),
    )[-1] == WorkingPeriod(
        start=datetime(2099, 1, 2, 9, tzinfo=UTC),
        end=datetime(2099, 1, 2, 14, 30, tzinfo=UTC),
    )


def test_free_windows_for_periods_do_not_merge_across_days() -> None:
    periods = [
        WorkingPeriod(
            start=datetime(2099, 1, 1, 9, tzinfo=UTC),
            end=datetime(2099, 1, 1, 17, tzinfo=UTC),
        ),
        WorkingPeriod(
            start=datetime(2099, 1, 2, 9, tzinfo=UTC),
            end=datetime(2099, 1, 2, 17, tzinfo=UTC),
        ),
    ]

    assert derive_free_windows_for_periods(
        working_periods=periods,
        occupied_intervals=[],
    ) == [_window_on(1, 9, 17), _window_on(2, 9, 17)]


def test_free_windows_for_periods_respect_future_day_occupancy() -> None:
    periods = [
        WorkingPeriod(
            start=datetime(2099, 1, 1, 9, tzinfo=UTC),
            end=datetime(2099, 1, 1, 17, tzinfo=UTC),
        ),
        WorkingPeriod(
            start=datetime(2099, 1, 2, 9, tzinfo=UTC),
            end=datetime(2099, 1, 2, 17, tzinfo=UTC),
        ),
    ]
    occupied = OccupiedInterval(
        start=datetime(2099, 1, 2, 10, tzinfo=UTC),
        end=datetime(2099, 1, 2, 12, tzinfo=UTC),
        source_id=uuid.uuid4(),
        source_type="task",
    )

    assert derive_free_windows_for_periods(
        working_periods=periods,
        occupied_intervals=[occupied],
    ) == [_window_on(1, 9, 17), _window_on(2, 9, 10), _window_on(2, 12, 17)]


def test_free_windows_for_periods_merge_overlapping_future_occupancy() -> None:
    periods = [
        WorkingPeriod(
            start=datetime(2099, 1, 2, 9, tzinfo=UTC),
            end=datetime(2099, 1, 2, 17, tzinfo=UTC),
        )
    ]
    occupied = [
        OccupiedInterval(
            start=datetime(2099, 1, 2, 10, tzinfo=UTC),
            end=datetime(2099, 1, 2, 11, 30, tzinfo=UTC),
            source_id=uuid.uuid4(),
            source_type="task",
        ),
        OccupiedInterval(
            start=datetime(2099, 1, 2, 11, tzinfo=UTC),
            end=datetime(2099, 1, 2, 12, tzinfo=UTC),
            source_id=uuid.uuid4(),
            source_type="task",
        ),
    ]

    assert derive_free_windows_for_periods(
        working_periods=periods,
        occupied_intervals=occupied,
    ) == [_window_on(2, 9, 10), _window_on(2, 12, 17)]


def test_completed_future_tasks_do_not_create_occupied_intervals() -> None:
    done = _task(
        scheduled_start=datetime(2099, 1, 2, 10, tzinfo=UTC),
        scheduled_end=datetime(2099, 1, 2, 12, tzinfo=UTC),
        status=TaskStatus.DONE,
    )
    periods = [
        WorkingPeriod(
            start=datetime(2099, 1, 2, 9, tzinfo=UTC),
            end=datetime(2099, 1, 2, 17, tzinfo=UTC),
        )
    ]

    assert derive_free_windows_for_periods(
        working_periods=periods,
        occupied_intervals=scheduling_engine.occupied_intervals_from_tasks([done]),
    ) == [_window_on(2, 9, 17)]


def test_capacity_summary_requires_one_contiguous_window() -> None:
    task = _task(estimated_duration_minutes=120)

    summary = summarize_task_capacity(
        task=task,
        windows=[
            CandidateWindow(
                start=datetime(2099, 1, 1, 9, tzinfo=UTC),
                end=datetime(2099, 1, 1, 10, tzinfo=UTC),
            ),
            CandidateWindow(
                start=datetime(2099, 1, 1, 11, tzinfo=UTC),
                end=datetime(2099, 1, 1, 12, tzinfo=UTC),
            ),
        ],
        settings=_settings(),
    )

    assert summary.required_minutes == 120
    assert summary.total_available_minutes == 120
    assert summary.largest_window_minutes == 60
    assert summary.feasible_window_count == 0
    assert not summary.has_contiguous_capacity
    assert summary.earliest_feasible_start is None
    assert summary.latest_feasible_start is None


def test_capacity_summary_identifies_contiguous_capacity() -> None:
    task = _task(estimated_duration_minutes=120)

    summary = summarize_task_capacity(
        task=task,
        windows=[
            CandidateWindow(
                start=datetime(2099, 1, 1, 9, tzinfo=UTC),
                end=datetime(2099, 1, 1, 10, tzinfo=UTC),
            ),
            CandidateWindow(
                start=datetime(2099, 1, 2, 13, tzinfo=UTC),
                end=datetime(2099, 1, 2, 16, tzinfo=UTC),
            ),
        ],
        settings=_settings(),
    )

    assert summary.required_minutes == 120
    assert summary.total_available_minutes == 240
    assert summary.largest_window_minutes == 180
    assert summary.feasible_window_count == 1
    assert summary.has_contiguous_capacity
    assert summary.earliest_feasible_start == datetime(2099, 1, 2, 13, tzinfo=UTC)
    assert summary.latest_feasible_start == datetime(2099, 1, 2, 14, tzinfo=UTC)


def test_deadline_clips_candidate_windows_before_capacity_summary() -> None:
    task = _task(
        due_date=datetime(2099, 1, 1, 10, 30, tzinfo=UTC),
        estimated_duration_minutes=90,
    )
    windows = [_window_on(1, 9, 12), _window_on(1, 13, 17)]

    clipped = candidate_windows_before_deadline(task=task, windows=windows)
    summary = summarize_task_capacity(task=task, windows=windows, settings=_settings())

    assert clipped == [
        CandidateWindow(
            start=datetime(2099, 1, 1, 9, tzinfo=UTC),
            end=datetime(2099, 1, 1, 10, 30, tzinfo=UTC),
        )
    ]
    assert summary.total_available_minutes == 90
    assert summary.has_contiguous_capacity


def test_deadline_excludes_windows_starting_after_deadline() -> None:
    task = _task(due_date=datetime(2099, 1, 1, 12, tzinfo=UTC))

    assert candidate_windows_before_deadline(
        task=task,
        windows=[_window_on(1, 12, 13), _window_on(2, 9, 17)],
    ) == []


def test_no_deadline_uses_all_horizon_windows_for_capacity() -> None:
    task = _task(estimated_duration_minutes=60)

    summary = summarize_task_capacity(
        task=task,
        windows=[_window_on(1, 9, 10), _window_on(2, 9, 10)],
        settings=_settings(),
    )

    assert summary.total_available_minutes == 120
    assert summary.feasible_window_count == 2


def test_capacity_summary_uses_pomodoro_for_missing_duration() -> None:
    task = _task(estimated_duration_minutes=None)

    summary = summarize_task_capacity(
        task=task,
        windows=[
            CandidateWindow(
                start=datetime(2099, 1, 1, 9, tzinfo=UTC),
                end=datetime(2099, 1, 1, 9, 25, tzinfo=UTC),
            )
        ],
        settings=_settings(pomodoro_minutes=25),
    )

    assert summary.required_minutes == 25
    assert summary.has_contiguous_capacity


def test_capacity_summary_keeps_deterministic_earliest_and_largest_metrics() -> None:
    task = _task(estimated_duration_minutes=30)

    summary = summarize_task_capacity(
        task=task,
        windows=[
            _window_on(2, 13, 17),
            _window_on(1, 9, 10),
            _window_on(3, 9, 11),
        ],
        settings=_settings(),
    )

    assert summary.earliest_feasible_start == datetime(2099, 1, 1, 9, tzinfo=UTC)
    assert summary.latest_feasible_start == datetime(2099, 1, 3, 10, 30, tzinfo=UTC)
    assert summary.largest_window_minutes == 240


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


def test_no_focus_history_does_not_change_candidate_placement() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    task = _task(estimated_duration_minutes=60)
    blocker = _task(
        scheduled_start=datetime(2099, 1, 1, 11, tzinfo=UTC),
        scheduled_end=datetime(2099, 1, 1, 15, tzinfo=UTC),
    )

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[task, blocker],
        preferred_focus_hours=Counter(),
    )

    assert slots[0][1:3] == (
        datetime(2099, 1, 1, 9, tzinfo=UTC),
        datetime(2099, 1, 1, 10, tzinfo=UTC),
    )


def test_same_task_same_duration_fit_prefers_focus_slot_in_allocation() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    task = _task(estimated_duration_minutes=60)
    blocker = _task(
        scheduled_start=datetime(2099, 1, 1, 11, tzinfo=UTC),
        scheduled_end=datetime(2099, 1, 1, 15, tzinfo=UTC),
    )

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[task, blocker],
        preferred_focus_hours=Counter({15: 4}),
    )

    assert slots[0][1:3] == (
        datetime(2099, 1, 1, 15, tzinfo=UTC),
        datetime(2099, 1, 1, 16, tzinfo=UTC),
    )


def test_build_schedule_slots_uses_scheduling_v7_for_candidate_placement(
    monkeypatch,
) -> None:
    seen_versions: list[str] = []
    original = scheduling_engine.score_window_candidate

    def spy_score_window_candidate(candidate, profile, **kwargs):
        seen_versions.append(profile.scoring_version)
        return original(candidate, profile, **kwargs)

    monkeypatch.setattr(
        scheduling_engine,
        "score_window_candidate",
        spy_score_window_candidate,
    )

    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    task = _task(estimated_duration_minutes=60)
    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[task],
        preferred_focus_hours=Counter({9: 1}),
    )

    assert slots
    assert seen_versions
    assert set(seen_versions) == {"v7"}


def test_today_full_tomorrow_free_gets_tomorrow_suggestion() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    task = _task(estimated_duration_minutes=60)

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[task, *_full_day_blockers(1)],
    )

    assert slots[0][1:3] == (
        datetime(2099, 1, 2, 9, tzinfo=UTC),
        datetime(2099, 1, 2, 10, tzinfo=UTC),
    )


def test_today_candidate_wins_over_tomorrow_exact_fit() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    task = _task(estimated_duration_minutes=60)

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[
            task,
            _blocking_task(1, 11, 17),
            _blocking_task(2, 10, 17),
        ],
    )

    assert slots[0][1:3] == (
        datetime(2099, 1, 1, 9, tzinfo=UTC),
        datetime(2099, 1, 1, 10, tzinfo=UTC),
    )


def test_after_work_end_today_contributes_no_candidate_period() -> None:
    now = datetime(2099, 1, 1, 18, tzinfo=UTC)
    task = _task(estimated_duration_minutes=60)

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[task],
    )

    assert slots[0][1:3] == (
        datetime(2099, 1, 2, 9, tzinfo=UTC),
        datetime(2099, 1, 2, 10, tzinfo=UTC),
    )


def test_current_day_start_preserves_fifteen_minute_boundary() -> None:
    now = datetime(2099, 1, 1, 9, 7, 20, tzinfo=UTC)
    task = _task(estimated_duration_minutes=30)

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[task],
    )

    assert slots[0][1:3] == (
        datetime(2099, 1, 1, 9, 15, tzinfo=UTC),
        datetime(2099, 1, 1, 9, 45, tzinfo=UTC),
    )


def test_future_scheduled_task_blocks_tomorrow_interval() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    task = _task(estimated_duration_minutes=60)

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[
            task,
            *_full_day_blockers(1),
            _blocking_task(2, 9, 10),
        ],
    )

    assert slots[0][1:3] == (
        datetime(2099, 1, 2, 10, tzinfo=UTC),
        datetime(2099, 1, 2, 11, tzinfo=UTC),
    )


def test_future_completed_task_does_not_block_tomorrow_interval() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    task = _task(estimated_duration_minutes=60)
    completed = _task(
        scheduled_start=datetime(2099, 1, 2, 9, tzinfo=UTC),
        scheduled_end=datetime(2099, 1, 2, 10, tzinfo=UTC),
        status=TaskStatus.DONE,
    )

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[task, *_full_day_blockers(1), completed],
    )

    assert slots[0][1:3] == (
        datetime(2099, 1, 2, 9, tzinfo=UTC),
        datetime(2099, 1, 2, 10, tzinfo=UTC),
    )


def test_deadline_tomorrow_clips_multi_day_candidate_windows() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    task = _task(
        due_date=datetime(2099, 1, 2, 10, tzinfo=UTC),
        estimated_duration_minutes=60,
    )

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[
            task,
            *_full_day_blockers(1),
            _blocking_task(2, 10, 17),
        ],
    )

    assert slots[0][1:3] == (
        datetime(2099, 1, 2, 9, tzinfo=UTC),
        datetime(2099, 1, 2, 10, tzinfo=UTC),
    )


def test_candidate_after_deadline_is_excluded_across_days() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    task = _task(
        due_date=datetime(2099, 1, 2, 9, tzinfo=UTC),
        estimated_duration_minutes=60,
    )

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[task, *_full_day_blockers(1)],
    )

    assert slots == []


def test_task_without_deadline_can_use_later_horizon_window() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    task = _task(estimated_duration_minutes=60)

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[task, *_full_day_blockers(1, 2, 3)],
    )

    assert slots[0][1:3] == (
        datetime(2099, 1, 4, 9, tzinfo=UTC),
        datetime(2099, 1, 4, 10, tzinfo=UTC),
    )


def test_no_suggestion_is_created_beyond_planning_horizon() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    task = _task(estimated_duration_minutes=60)

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[task, *_full_day_blockers(1, 2, 3, 4, 5, 6, 7)],
    )

    assert slots == []


def test_fragmented_free_windows_across_days_do_not_satisfy_long_task() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    task = _task(estimated_duration_minutes=120)

    slots = build_schedule_slots(
        [RankedTask(task, 1.0, [], [])],
        _settings(),
        now=now,
        existing_tasks=[
            task,
            _blocking_task(1, 10, 17),
            _blocking_task(2, 10, 17),
            *_full_day_blockers(3, 4, 5, 6, 7),
        ],
    )

    assert slots == []


def test_multiple_tasks_can_be_placed_across_days_without_overlap() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    first = _task(priority=TaskPriority.HIGH, estimated_duration_minutes=480)
    second = _task(estimated_duration_minutes=480)

    slots = build_schedule_slots(
        [
            RankedTask(first, 1.0, [], []),
            RankedTask(second, 0.9, [], []),
        ],
        _settings(),
        now=now,
        existing_tasks=[first, second],
    )

    assert [(task.id, start, end) for task, start, end, _explanation in slots] == [
        (
            first.id,
            datetime(2099, 1, 1, 9, tzinfo=UTC),
            datetime(2099, 1, 1, 17, tzinfo=UTC),
        ),
        (
            second.id,
            datetime(2099, 1, 2, 9, tzinfo=UTC),
            datetime(2099, 1, 2, 17, tzinfo=UTC),
        ),
    ]


def test_higher_importance_tomorrow_task_and_today_task_both_get_suggestions() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    high_tomorrow = _task(
        priority=TaskPriority.HIGH,
        due_date=datetime(2099, 1, 2, 17, tzinfo=UTC),
        estimated_duration_minutes=480,
    )
    low_today = _task(estimated_duration_minutes=60)

    slots = build_schedule_slots(
        [
            RankedTask(high_tomorrow, 1.0, [], []),
            RankedTask(low_today, 0.5, [], []),
        ],
        _settings(),
        now=now,
        existing_tasks=[
            high_tomorrow,
            low_today,
            _blocking_task(1, 10, 17),
        ],
    )

    assert [(task.id, start) for task, start, _end, _explanation in slots] == [
        (high_tomorrow.id, datetime(2099, 1, 2, 9, tzinfo=UTC)),
        (low_today.id, datetime(2099, 1, 1, 9, tzinfo=UTC)),
    ]


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
    first = _task(
        priority=TaskPriority.HIGH,
        estimated_duration_minutes=60,
    )
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


def test_deadline_clipped_capacity_uses_latest_start_inside_clipped_window() -> None:
    task = _task(
        due_date=datetime(2099, 1, 1, 16, tzinfo=UTC),
        estimated_duration_minutes=60,
    )

    summary = summarize_task_capacity(
        task=task,
        windows=[
            CandidateWindow(
                start=datetime(2099, 1, 1, 14, tzinfo=UTC),
                end=datetime(2099, 1, 1, 18, tzinfo=UTC),
            )
        ],
        settings=_settings(),
    )

    assert summary.total_available_minutes == 120
    assert summary.latest_feasible_start == datetime(2099, 1, 1, 15, tzinfo=UTC)


def test_capacity_summary_large_window_latest_start_is_end_minus_duration() -> None:
    task = _task(estimated_duration_minutes=60)

    summary = summarize_task_capacity(
        task=task,
        windows=[_window(9, 17)],
        settings=_settings(),
    )

    assert summary.earliest_feasible_start == datetime(2099, 1, 1, 9, tzinfo=UTC)
    assert summary.latest_feasible_start == datetime(2099, 1, 1, 16, tzinfo=UTC)


def test_build_schedule_slots_recomputes_v7_capacity_after_allocation(
    monkeypatch,
) -> None:
    seen_latest_starts: dict[uuid.UUID, list[str | None]] = {}
    original = scheduling_engine.calculate_capacity_aware_task_importance

    def spy_calculate_capacity_aware_task_importance(task, profile, **kwargs):
        scored = original(task, profile, **kwargs)
        factor = scored.breakdown.factors[0]
        assert factor.metadata is not None
        flexibility = factor.metadata["scheduling_flexibility"]
        assert isinstance(flexibility, dict)
        seen_latest_starts.setdefault(task.id, []).append(
            flexibility["latest_feasible_start"]
        )
        return scored

    monkeypatch.setattr(
        scheduling_engine,
        "calculate_capacity_aware_task_importance",
        spy_calculate_capacity_aware_task_importance,
    )

    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    first = _task(
        priority=TaskPriority.HIGH,
        due_date=datetime(2099, 1, 1, 17, tzinfo=UTC),
        estimated_duration_minutes=120,
    )
    second = _task(
        priority=TaskPriority.NO_PRIORITY,
        due_date=datetime(2099, 1, 1, 17, tzinfo=UTC),
        estimated_duration_minutes=60,
    )
    blocker = _blocking_task(1, 12, 15)

    slots = build_schedule_slots(
        [
            RankedTask(first, 1.0, [], []),
            RankedTask(second, 0.5, [], []),
        ],
        _settings(deadline_weight=0, priority_weight=100),
        now=now,
        existing_tasks=[first, second, blocker],
    )

    assert [(task.id, start) for task, start, _end, _explanation in slots] == [
        (first.id, datetime(2099, 1, 1, 15, tzinfo=UTC)),
        (second.id, datetime(2099, 1, 1, 9, tzinfo=UTC)),
    ]
    assert seen_latest_starts[second.id] == [
        "2099-01-01T16:00:00+00:00",
        "2099-01-01T11:00:00+00:00",
    ]
