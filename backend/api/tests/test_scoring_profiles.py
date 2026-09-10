import uuid
from collections import Counter
from datetime import UTC, datetime, timedelta

from app.scheduling.windows import (
    CandidateWindow,
    TaskCapacitySummary,
    build_task_window_candidate,
)
from app.scoring import (
    NextTaskProfileV1,
    QuickWinProfileV1,
    SchedulingProfileV1,
    SchedulingProfileV2,
    SchedulingProfileV3,
    SchedulingProfileV4,
    SchedulingProfileV5,
    SchedulingProfileV6,
    SchedulingProfileV7,
    calculate_capacity_aware_task_importance,
    calculate_slack_aware_task_importance,
    calculate_task_importance,
    score_window_candidate,
    window_candidate_sort_key,
    window_candidate_sort_key_v6,
)
from app.scoring.criteria import (
    duration_slot_fit,
    focus_slot_fit,
    scheduling_flexibility_pressure,
    slack_aware_deadline_urgency,
)
from app.scoring.engine import score_task
from app.settings.models import UserSettings
from app.tasks.models import Task, TaskPriority, TaskStatus


def _task(
    *,
    task_id: uuid.UUID | None = None,
    priority: TaskPriority = TaskPriority.NO_PRIORITY,
    due_date: datetime | None = None,
    estimated_duration_minutes: int | None = None,
    status: TaskStatus = TaskStatus.PENDING,
) -> Task:
    return Task(
        id=task_id or uuid.uuid4(),
        user_id=uuid.uuid4(),
        title="Profile candidate",
        priority=priority,
        due_date=due_date,
        estimated_duration_minutes=estimated_duration_minutes,
        status=status,
    )


def _settings() -> UserSettings:
    return UserSettings(
        ai_deadline_urgency_weight=80,
        ai_priority_weight=70,
        ai_estimated_duration_weight=50,
    )


def _capacity(
    *,
    task_id: uuid.UUID | None = None,
    required_minutes: int = 60,
    total_available_minutes: int = 60,
    largest_window_minutes: int = 60,
    feasible_window_count: int = 1,
    earliest_feasible_start: datetime | None = None,
    latest_feasible_start: datetime | None = None,
) -> TaskCapacitySummary:
    return TaskCapacitySummary(
        task_id=task_id or uuid.uuid4(),
        required_minutes=required_minutes,
        total_available_minutes=total_available_minutes,
        largest_window_minutes=largest_window_minutes,
        feasible_window_count=feasible_window_count,
        has_contiguous_capacity=feasible_window_count > 0,
        earliest_feasible_start=earliest_feasible_start,
        latest_feasible_start=latest_feasible_start,
    )


def test_profile_identity_metadata_is_available_without_persistence() -> None:
    scheduling = SchedulingProfileV1.from_settings(_settings())
    scheduling_v2 = SchedulingProfileV2.from_settings(_settings())
    scheduling_v6 = SchedulingProfileV6.from_settings(_settings())
    next_task = NextTaskProfileV1()
    quick_win = QuickWinProfileV1()

    assert scheduling.profile_name == "scheduling"
    assert scheduling.scoring_version == "v1"
    assert scheduling_v2.profile_name == "scheduling"
    assert scheduling_v2.scoring_version == "v2"
    assert scheduling_v6.profile_name == "scheduling"
    assert scheduling_v6.scoring_version == "v6"
    assert scheduling_v6.task_importance_profile_name == "scheduling"
    assert scheduling_v6.task_importance_scoring_version == "v5"
    assert next_task.profile_name == "next_task"
    assert next_task.scoring_version == "v1"
    assert quick_win.profile_name == "quick_win"
    assert quick_win.scoring_version == "v1"


def test_scheduling_v7_profile_identity_metadata_is_available() -> None:
    profile = SchedulingProfileV7.from_settings(_settings())

    assert profile.profile_name == "scheduling"
    assert profile.scoring_version == "v7"
    assert profile.task_importance_profile_name == "scheduling"
    assert profile.task_importance_scoring_version == "v7"
    assert profile.factor_weights() == {
        "deadline_urgency": 0.8,
        "priority": 0.7,
    }


def test_next_task_profile_prefers_due_today_candidate() -> None:
    now = datetime(2099, 1, 1, 9, tzinfo=UTC)
    profile = NextTaskProfileV1()
    due_today = _task(due_date=now.replace(hour=16), estimated_duration_minutes=60)
    due_later = _task(
        due_date=now + timedelta(days=1),
        estimated_duration_minutes=5,
        priority=TaskPriority.HIGH,
    )

    assert profile.select([due_later, due_today], now=now) == due_today


def test_next_task_profile_preserves_shorter_task_ordering() -> None:
    now = datetime(2099, 1, 1, 9, tzinfo=UTC)
    profile = NextTaskProfileV1()
    short = _task(estimated_duration_minutes=5)
    long = _task(estimated_duration_minutes=30)

    assert profile.select([long, short], now=now) == short


def test_next_task_profile_preserves_priority_tie_break() -> None:
    now = datetime(2099, 1, 1, 9, tzinfo=UTC)
    profile = NextTaskProfileV1()
    high = _task(priority=TaskPriority.HIGH, estimated_duration_minutes=30)
    low = _task(priority=TaskPriority.LOW, estimated_duration_minutes=30)

    assert profile.select([low, high], now=now) == high


def test_next_task_profile_preserves_due_date_tie_break() -> None:
    now = datetime(2099, 1, 1, 9, tzinfo=UTC)
    profile = NextTaskProfileV1()
    earlier = _task(due_date=now + timedelta(days=1), estimated_duration_minutes=30)
    later = _task(due_date=now + timedelta(days=2), estimated_duration_minutes=30)

    assert profile.select([later, earlier], now=now) == earlier


def test_next_task_profile_preserves_id_tie_break() -> None:
    now = datetime(2099, 1, 1, 9, tzinfo=UTC)
    profile = NextTaskProfileV1()
    earlier_id = uuid.UUID("11111111-1111-4111-8111-111111111111")
    later_id = uuid.UUID("22222222-2222-4222-8222-222222222222")
    earlier = _task(task_id=earlier_id, estimated_duration_minutes=30)
    later = _task(task_id=later_id, estimated_duration_minutes=30)

    assert profile.select([later, earlier], now=now) == earlier


def test_quick_win_profile_qualifies_ten_minutes_or_less_only() -> None:
    profile = QuickWinProfileV1()

    assert profile.is_eligible(_task(estimated_duration_minutes=10))
    assert not profile.is_eligible(_task(estimated_duration_minutes=11))
    assert not profile.is_eligible(_task(estimated_duration_minutes=None))


def test_quick_win_profile_preserves_due_priority_duration_id_ordering() -> None:
    now = datetime(2099, 1, 1, 9, tzinfo=UTC)
    profile = QuickWinProfileV1()
    due_later_high = _task(
        task_id=uuid.UUID("44444444-4444-4444-8444-444444444444"),
        priority=TaskPriority.HIGH,
        due_date=now + timedelta(days=2),
        estimated_duration_minutes=5,
    )
    due_earlier_low = _task(
        task_id=uuid.UUID("33333333-3333-4333-8333-333333333333"),
        priority=TaskPriority.LOW,
        due_date=now + timedelta(days=1),
        estimated_duration_minutes=10,
    )
    same_due_shorter = _task(
        task_id=uuid.UUID("22222222-2222-4222-8222-222222222222"),
        priority=TaskPriority.HIGH,
        due_date=now + timedelta(days=3),
        estimated_duration_minutes=5,
    )
    same_due_longer = _task(
        task_id=uuid.UUID("11111111-1111-4111-8111-111111111111"),
        priority=TaskPriority.HIGH,
        due_date=now + timedelta(days=3),
        estimated_duration_minutes=10,
    )

    assert profile.select(
        [
            same_due_longer,
            same_due_shorter,
            due_later_high,
            due_earlier_low,
        ],
        limit=4,
    ) == [
        due_earlier_low,
        due_later_high,
        same_due_shorter,
        same_due_longer,
    ]


def test_quick_win_profile_preserves_result_limit() -> None:
    profile = QuickWinProfileV1()
    tasks = [_task(estimated_duration_minutes=5) for _index in range(6)]

    assert len(profile.select(tasks, limit=5)) == 5


def test_scheduling_and_quick_win_profiles_treat_duration_differently() -> None:
    now = datetime(2099, 1, 1, 9, tzinfo=UTC)
    short_task = _task(
        priority=TaskPriority.NO_PRIORITY,
        due_date=None,
        estimated_duration_minutes=10,
    )

    assert QuickWinProfileV1().is_eligible(short_task)
    scored = score_task(
        short_task,
        SchedulingProfileV1.from_settings(_settings()),
        now=now,
        preferred_focus_hours=Counter(),
    )
    assert scored.breakdown.factors[2].name == "duration_preference"
    assert scored.score == 0.42


def test_scheduling_v1_keeps_legacy_short_duration_bias() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    due = now + timedelta(hours=23)
    high_long = _task(
        priority=TaskPriority.HIGH,
        due_date=due,
        estimated_duration_minutes=90,
    )
    medium_short = _task(
        priority=TaskPriority.MEDIUM,
        due_date=due,
        estimated_duration_minutes=10,
    )

    high_score = score_task(
        high_long,
        SchedulingProfileV1.from_settings(_settings()),
        now=now,
        preferred_focus_hours=Counter(),
    )
    medium_score = score_task(
        medium_short,
        SchedulingProfileV1.from_settings(_settings()),
        now=now,
        preferred_focus_hours=Counter(),
    )

    assert high_score.score == 0.805
    assert medium_score.score == 0.875
    assert medium_score.score > high_score.score


def test_scheduling_v1_remains_sensitive_to_legacy_duration_weight() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    task = _task(
        priority=TaskPriority.NO_PRIORITY,
        due_date=None,
        estimated_duration_minutes=10,
    )

    no_duration_weight = score_task(
        task,
        SchedulingProfileV1.from_settings(
            UserSettings(
                ai_deadline_urgency_weight=80,
                ai_priority_weight=70,
                ai_estimated_duration_weight=0,
            )
        ),
        now=now,
        preferred_focus_hours=Counter(),
    )
    high_duration_weight = score_task(
        task,
        SchedulingProfileV1.from_settings(
            UserSettings(
                ai_deadline_urgency_weight=80,
                ai_priority_weight=70,
                ai_estimated_duration_weight=100,
            )
        ),
        now=now,
        preferred_focus_hours=Counter(),
    )

    assert high_duration_weight.score > no_duration_weight.score


def test_scheduling_v2_removes_generic_short_duration_bias() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    due = now + timedelta(hours=23)
    high_long = _task(
        priority=TaskPriority.HIGH,
        due_date=due,
        estimated_duration_minutes=90,
    )
    medium_short = _task(
        priority=TaskPriority.MEDIUM,
        due_date=due,
        estimated_duration_minutes=10,
    )

    high_score = score_task(
        high_long,
        SchedulingProfileV2.from_settings(_settings()),
        now=now,
        preferred_focus_hours=Counter(),
    )
    medium_score = score_task(
        medium_short,
        SchedulingProfileV2.from_settings(_settings()),
        now=now,
        preferred_focus_hours=Counter(),
    )

    assert [factor.name for factor in high_score.breakdown.factors] == [
        "deadline_urgency",
        "priority",
    ]
    assert high_score.breakdown.profile_name == "scheduling"
    assert high_score.breakdown.scoring_version == "v2"
    assert high_score.score > medium_score.score


def test_scheduling_v2_scores_equal_when_only_duration_differs() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    due = now + timedelta(hours=23)
    short = _task(
        priority=TaskPriority.HIGH,
        due_date=due,
        estimated_duration_minutes=10,
    )
    long = _task(
        priority=TaskPriority.HIGH,
        due_date=due,
        estimated_duration_minutes=120,
    )

    short_score = score_task(
        short,
        SchedulingProfileV2.from_settings(_settings()),
        now=now,
        preferred_focus_hours=Counter(),
    )
    long_score = score_task(
        long,
        SchedulingProfileV2.from_settings(_settings()),
        now=now,
        preferred_focus_hours=Counter(),
    )

    assert short_score.score == long_score.score


def test_scheduling_v2_all_active_weights_zero_is_deterministic() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    settings = UserSettings(
        ai_deadline_urgency_weight=0,
        ai_priority_weight=0,
        ai_estimated_duration_weight=100,
    )

    scored = score_task(
        _task(
            priority=TaskPriority.HIGH,
            due_date=now + timedelta(hours=1),
            estimated_duration_minutes=5,
        ),
        SchedulingProfileV2.from_settings(settings),
        now=now,
        preferred_focus_hours=Counter({9: 5}),
    )

    assert scored.breakdown.weighted_score == 0
    assert scored.breakdown.focus_bonus == 0
    assert scored.score == 0


def test_next_task_profile_keeps_current_duration_ordering_independent_of_v2() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    short_medium = _task(
        priority=TaskPriority.MEDIUM,
        due_date=now + timedelta(days=1),
        estimated_duration_minutes=10,
    )
    long_high = _task(
        priority=TaskPriority.HIGH,
        due_date=now + timedelta(days=1),
        estimated_duration_minutes=90,
    )

    assert NextTaskProfileV1().select([long_high, short_medium], now=now) == short_medium


def test_scheduling_v3_profile_identity_metadata_is_available() -> None:
    profile = SchedulingProfileV3()

    assert profile.profile_name == "scheduling"
    assert profile.scoring_version == "v3"
    assert profile.task_importance_profile_name == "scheduling"
    assert profile.task_importance_scoring_version == "v2"


def test_scheduling_v4_profile_identity_metadata_is_available() -> None:
    profile = SchedulingProfileV4()

    assert profile.profile_name == "scheduling"
    assert profile.scoring_version == "v4"
    assert profile.task_importance_profile_name == "scheduling"
    assert profile.task_importance_scoring_version == "task_importance"


def test_scheduling_v5_profile_identity_metadata_is_available() -> None:
    profile = SchedulingProfileV5.from_settings(_settings())

    assert profile.profile_name == "scheduling"
    assert profile.scoring_version == "v5"
    assert profile.factor_weights() == {
        "deadline_urgency": 0.8,
        "priority": 0.7,
    }


def test_slack_aware_deadline_urgency_same_deadline_rewards_less_slack() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    due = now + timedelta(hours=10)

    long_score = slack_aware_deadline_urgency(
        due_date=due,
        now=now,
        required_minutes=8 * 60,
    )[0]
    short_score = slack_aware_deadline_urgency(
        due_date=due,
        now=now,
        required_minutes=30,
    )[0]

    assert long_score > short_score


def test_slack_aware_deadline_urgency_same_work_prefers_earlier_deadline() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)

    earlier = slack_aware_deadline_urgency(
        due_date=now + timedelta(hours=6),
        now=now,
        required_minutes=60,
    )[0]
    later = slack_aware_deadline_urgency(
        due_date=now + timedelta(hours=48),
        now=now,
        required_minutes=60,
    )[0]

    assert earlier > later


def test_slack_aware_deadline_urgency_handles_negative_and_zero_slack() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)

    negative_slack = slack_aware_deadline_urgency(
        due_date=now + timedelta(hours=2),
        now=now,
        required_minutes=3 * 60,
    )[0]
    zero_slack = slack_aware_deadline_urgency(
        due_date=now + timedelta(hours=2),
        now=now,
        required_minutes=2 * 60,
    )[0]

    assert negative_slack == 1.0
    assert zero_slack == 1.0


def test_slack_aware_deadline_urgency_no_deadline_and_large_slack_floor() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)

    no_deadline = slack_aware_deadline_urgency(
        due_date=None,
        now=now,
        required_minutes=60,
    )[0]
    large_slack = slack_aware_deadline_urgency(
        due_date=now + timedelta(days=30),
        now=now,
        required_minutes=60,
    )[0]

    assert no_deadline == 0.15
    assert large_slack == 0.25


def test_slack_aware_deadline_urgency_interpolates_smoothly_near_boundaries() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)

    for boundary_hours in (24, 72, 168):
        before = slack_aware_deadline_urgency(
            due_date=now + timedelta(hours=boundary_hours, minutes=-1),
            now=now,
            required_minutes=0,
        )[0]
        after = slack_aware_deadline_urgency(
            due_date=now + timedelta(hours=boundary_hours, minutes=1),
            now=now,
            required_minutes=0,
        )[0]

        assert before > after
        assert before - after < 0.01


def test_slack_aware_deadline_urgency_treats_offset_equivalent_instants_equally() -> None:
    now = datetime(2026, 9, 4, 0, tzinfo=UTC)
    utc_due = datetime(2026, 9, 4, 8, tzinfo=UTC)
    sydney_due = datetime.fromisoformat("2026-09-04T18:00:00+10:00")

    assert slack_aware_deadline_urgency(
        due_date=utc_due,
        now=now,
        required_minutes=60,
    )[0] == slack_aware_deadline_urgency(
        due_date=sydney_due,
        now=now,
        required_minutes=60,
    )[0]


def test_slack_aware_task_importance_uses_required_minutes_metadata() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    task = _task(
        priority=TaskPriority.HIGH,
        due_date=now + timedelta(hours=10),
        estimated_duration_minutes=None,
    )

    scored = calculate_slack_aware_task_importance(
        task,
        SchedulingProfileV5.from_settings(_settings()),
        now=now,
        required_minutes=25,
    )
    deadline_factor = scored.breakdown.factors[0]

    assert scored.breakdown.scoring_version == "v5"
    assert deadline_factor.name == "deadline_urgency"
    assert deadline_factor.metadata is not None
    assert deadline_factor.metadata["required_minutes"] == 25
    assert deadline_factor.metadata["model"] == "slack-aware"


def test_slack_aware_task_importance_respects_active_weight_controls() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    urgent_low = _task(
        priority=TaskPriority.LOW,
        due_date=now + timedelta(hours=2),
    )
    relaxed_high = _task(
        priority=TaskPriority.HIGH,
        due_date=now + timedelta(days=30),
    )

    deadline_only_settings = UserSettings(
        ai_deadline_urgency_weight=100,
        ai_priority_weight=0,
        ai_estimated_duration_weight=100,
    )
    priority_only_settings = UserSettings(
        ai_deadline_urgency_weight=0,
        ai_priority_weight=100,
        ai_estimated_duration_weight=100,
    )
    zero_settings = UserSettings(
        ai_deadline_urgency_weight=0,
        ai_priority_weight=0,
        ai_estimated_duration_weight=100,
    )

    deadline_only_urgent = calculate_slack_aware_task_importance(
        urgent_low,
        SchedulingProfileV5.from_settings(deadline_only_settings),
        now=now,
        required_minutes=60,
    )
    deadline_only_relaxed = calculate_slack_aware_task_importance(
        relaxed_high,
        SchedulingProfileV5.from_settings(deadline_only_settings),
        now=now,
        required_minutes=60,
    )
    priority_only_urgent = calculate_slack_aware_task_importance(
        urgent_low,
        SchedulingProfileV5.from_settings(priority_only_settings),
        now=now,
        required_minutes=60,
    )
    priority_only_relaxed = calculate_slack_aware_task_importance(
        relaxed_high,
        SchedulingProfileV5.from_settings(priority_only_settings),
        now=now,
        required_minutes=60,
    )
    zero_weighted = calculate_slack_aware_task_importance(
        relaxed_high,
        SchedulingProfileV5.from_settings(zero_settings),
        now=now,
        required_minutes=60,
    )

    assert deadline_only_urgent.score > deadline_only_relaxed.score
    assert priority_only_relaxed.score > priority_only_urgent.score
    assert zero_weighted.score == 0.0


def test_scheduling_flexibility_pressure_uses_latest_feasible_start() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    early_only = _capacity(
        earliest_feasible_start=now + timedelta(hours=2),
        latest_feasible_start=now + timedelta(hours=2),
    )
    late_option = _capacity(
        earliest_feasible_start=now + timedelta(hours=2),
        latest_feasible_start=now + timedelta(days=2),
    )

    early_pressure, early_reason, early_metadata = scheduling_flexibility_pressure(
        due_date=now + timedelta(days=3),
        now=now,
        capacity=early_only,
    )
    late_pressure = scheduling_flexibility_pressure(
        due_date=now + timedelta(days=3),
        now=now,
        capacity=late_option,
    )[0]

    assert early_pressure > late_pressure
    assert early_reason == "Scheduling flexibility pressure"
    assert early_metadata["flexibility_minutes"] == 120


def test_scheduling_flexibility_pressure_no_contiguous_window_is_maximum() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    fragmented = _capacity(
        required_minutes=120,
        total_available_minutes=120,
        largest_window_minutes=60,
        feasible_window_count=0,
    )

    pressure, reason, metadata = scheduling_flexibility_pressure(
        due_date=now + timedelta(days=1),
        now=now,
        capacity=fragmented,
    )

    assert pressure == 1.0
    assert reason == "No feasible contiguous window before deadline"
    assert metadata["total_available_minutes"] == 120
    assert metadata["has_contiguous_capacity"] is False


def test_scheduling_flexibility_pressure_without_deadline_stays_low() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)

    pressure, reason, metadata = scheduling_flexibility_pressure(
        due_date=None,
        now=now,
        capacity=_capacity(latest_feasible_start=now),
    )

    assert pressure == 0.15
    assert reason is None
    assert metadata["model"] == "scheduling-flexibility"


def test_capacity_aware_importance_uses_max_deadline_pressure() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    profile = SchedulingProfileV7.from_settings(
        UserSettings(
            ai_deadline_urgency_weight=100,
            ai_priority_weight=0,
            ai_estimated_duration_weight=100,
        )
    )
    urgent_wall_clock = _task(
        due_date=now + timedelta(hours=2),
        estimated_duration_minutes=60,
    )
    scarce_calendar = _task(
        due_date=now + timedelta(days=3),
        estimated_duration_minutes=60,
    )

    urgent_score = calculate_capacity_aware_task_importance(
        urgent_wall_clock,
        profile,
        now=now,
        capacity=_capacity(
            required_minutes=60,
            latest_feasible_start=now + timedelta(days=2),
        ),
    )
    scarce_score = calculate_capacity_aware_task_importance(
        scarce_calendar,
        profile,
        now=now,
        capacity=_capacity(
            required_minutes=60,
            latest_feasible_start=now + timedelta(hours=2),
        ),
    )

    assert urgent_score.score == 0.9917
    assert scarce_score.score == 0.9833
    assert urgent_score.breakdown.scoring_version == "v7"
    assert scarce_score.breakdown.factors[0].metadata is not None
    assert (
        scarce_score.breakdown.factors[0].metadata[
            "scheduling_flexibility_pressure"
        ]
        > scarce_score.breakdown.factors[0].metadata["wall_clock_slack_urgency"]
    )


def test_capacity_aware_importance_respects_active_weight_controls() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    zero_profile = SchedulingProfileV7.from_settings(
        UserSettings(
            ai_deadline_urgency_weight=0,
            ai_priority_weight=0,
            ai_estimated_duration_weight=100,
        )
    )

    scored = calculate_capacity_aware_task_importance(
        _task(
            priority=TaskPriority.HIGH,
            due_date=now + timedelta(hours=1),
        ),
        zero_profile,
        now=now,
        capacity=_capacity(latest_feasible_start=now),
    )

    assert scored.score == 0.0


def test_focus_slot_fit_no_history_is_neutral() -> None:
    score, reason, peak = focus_slot_fit(Counter(), candidate_hour=9)

    assert score == 0.0
    assert reason is None
    assert peak is None


def test_focus_slot_fit_scores_exact_near_far_and_circular_hours() -> None:
    exact, exact_reason, exact_peak = focus_slot_fit(
        Counter({9: 4}),
        candidate_hour=9,
    )
    near, near_reason, near_peak = focus_slot_fit(
        Counter({9: 4}),
        candidate_hour=11,
    )
    far, far_reason, far_peak = focus_slot_fit(
        Counter({9: 4}),
        candidate_hour=15,
    )
    circular, circular_reason, circular_peak = focus_slot_fit(
        Counter({23: 4}),
        candidate_hour=0,
    )

    assert (exact, exact_reason, exact_peak) == (1.0, "Exact focus hour fit", 9)
    assert (near, near_reason, near_peak) == (0.5, "Near focus hour fit", 9)
    assert (far, far_reason, far_peak) == (0.0, None, 9)
    assert (circular, circular_reason, circular_peak) == (
        0.5,
        "Near focus hour fit",
        23,
    )


def test_focus_slot_fit_uses_candidate_hour_not_current_clock() -> None:
    preferred = Counter({9: 3})

    morning = focus_slot_fit(preferred, candidate_hour=9)
    same_morning = focus_slot_fit(preferred, candidate_hour=9)
    afternoon = focus_slot_fit(preferred, candidate_hour=15)

    assert morning == same_morning
    assert morning[0] == 1.0
    assert afternoon[0] == 0.0


def test_task_importance_excludes_legacy_current_hour_focus_bonus() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    task = _task(
        priority=TaskPriority.HIGH,
        due_date=now + timedelta(hours=1),
    )

    legacy_v2 = score_task(
        task,
        SchedulingProfileV2.from_settings(_settings()),
        now=now,
        preferred_focus_hours=Counter({9: 5}),
    )
    importance = calculate_task_importance(
        task,
        SchedulingProfileV2.from_settings(_settings()),
        now=now,
    )

    assert legacy_v2.breakdown.focus_bonus == 0.15
    assert legacy_v2.score == 1.0
    assert importance.breakdown.focus_bonus == 0.0
    assert importance.breakdown.scoring_version == "task_importance"
    assert importance.score == 0.9733


def test_duration_slot_fit_scores_exact_and_loose_fit() -> None:
    assert duration_slot_fit(required_minutes=60, window_minutes=60)[0] == 1.0
    assert duration_slot_fit(required_minutes=60, window_minutes=120)[0] == 0.5
    assert duration_slot_fit(required_minutes=30, window_minutes=120)[0] == 0.25


def test_duration_slot_fit_rejects_infeasible_candidate_before_scoring() -> None:
    task = _task(estimated_duration_minutes=120)
    window = CandidateWindow(
        start=datetime(2099, 1, 1, 9, tzinfo=UTC),
        end=datetime(2099, 1, 1, 10, tzinfo=UTC),
    )

    assert build_task_window_candidate(
        task=task,
        window=window,
        settings=_settings(),
    ) is None


def test_scheduling_v3_task_importance_beats_better_slot_fit() -> None:
    high_candidate = build_task_window_candidate(
        task=_task(priority=TaskPriority.HIGH, estimated_duration_minutes=60),
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 9, tzinfo=UTC),
            end=datetime(2099, 1, 1, 11, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    medium_candidate = build_task_window_candidate(
        task=_task(priority=TaskPriority.MEDIUM, estimated_duration_minutes=60),
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 11, tzinfo=UTC),
            end=datetime(2099, 1, 1, 12, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    assert high_candidate is not None
    assert medium_candidate is not None

    profile = SchedulingProfileV3()
    ordered = sorted(
        [
            score_window_candidate(
                medium_candidate,
                profile,
                task_importance_score=0.8,
            ),
            score_window_candidate(
                high_candidate,
                profile,
                task_importance_score=0.9,
            ),
        ],
        key=window_candidate_sort_key,
    )

    assert ordered[0].candidate == high_candidate
    assert ordered[0].duration_slot_fit_score == 0.5
    assert ordered[1].duration_slot_fit_score == 1.0


def test_scheduling_v3_equal_importance_uses_slot_fit_then_time_and_id() -> None:
    profile = SchedulingProfileV3()
    earlier_id = uuid.UUID("11111111-1111-4111-8111-111111111111")
    later_id = uuid.UUID("22222222-2222-4222-8222-222222222222")
    loose = build_task_window_candidate(
        task=_task(task_id=later_id, estimated_duration_minutes=60),
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 9, tzinfo=UTC),
            end=datetime(2099, 1, 1, 11, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    exact_later = build_task_window_candidate(
        task=_task(task_id=later_id, estimated_duration_minutes=60),
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 11, tzinfo=UTC),
            end=datetime(2099, 1, 1, 12, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    exact_earlier = build_task_window_candidate(
        task=_task(task_id=earlier_id, estimated_duration_minutes=60),
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 11, tzinfo=UTC),
            end=datetime(2099, 1, 1, 12, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    assert loose is not None
    assert exact_later is not None
    assert exact_earlier is not None

    ordered = sorted(
        [
            score_window_candidate(loose, profile, task_importance_score=0.8),
            score_window_candidate(exact_later, profile, task_importance_score=0.8),
            score_window_candidate(exact_earlier, profile, task_importance_score=0.8),
        ],
        key=window_candidate_sort_key,
    )

    assert ordered[0].candidate == exact_earlier
    assert ordered[1].candidate == exact_later
    assert ordered[2].candidate == loose


def test_scheduling_v3_remains_reproducible_without_focus_slot_fit() -> None:
    profile = SchedulingProfileV3()
    candidate = build_task_window_candidate(
        task=_task(estimated_duration_minutes=60),
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 9, tzinfo=UTC),
            end=datetime(2099, 1, 1, 10, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    assert candidate is not None

    scored = score_window_candidate(
        candidate,
        profile,
        task_importance_score=0.8,
        preferred_focus_hours=Counter({9: 5}),
    )

    assert scored.breakdown.scoring_version == "v3"
    assert scored.focus_slot_fit_score == 0.0
    assert scored.breakdown.focus_peak_hour is None


def test_scheduling_v4_same_duration_fit_prefers_focus_slot() -> None:
    profile = SchedulingProfileV4()
    task = _task(estimated_duration_minutes=60)
    focused = build_task_window_candidate(
        task=task,
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 9, tzinfo=UTC),
            end=datetime(2099, 1, 1, 11, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    unfocused = build_task_window_candidate(
        task=task,
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 15, tzinfo=UTC),
            end=datetime(2099, 1, 1, 17, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    assert focused is not None
    assert unfocused is not None

    ordered = sorted(
        [
            score_window_candidate(
                unfocused,
                profile,
                task_importance_score=0.8,
                preferred_focus_hours=Counter({9: 5}),
            ),
            score_window_candidate(
                focused,
                profile,
                task_importance_score=0.8,
                preferred_focus_hours=Counter({9: 5}),
            ),
        ],
        key=window_candidate_sort_key,
    )

    assert ordered[0].candidate == focused
    assert ordered[0].focus_slot_fit_score == 1.0
    assert ordered[1].focus_slot_fit_score == 0.0


def test_scheduling_v4_task_importance_beats_better_focus_slot_fit() -> None:
    profile = SchedulingProfileV4()
    high_importance_poor_focus = build_task_window_candidate(
        task=_task(priority=TaskPriority.HIGH, estimated_duration_minutes=60),
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 15, tzinfo=UTC),
            end=datetime(2099, 1, 1, 16, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    lower_importance_perfect_focus = build_task_window_candidate(
        task=_task(priority=TaskPriority.MEDIUM, estimated_duration_minutes=60),
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 9, tzinfo=UTC),
            end=datetime(2099, 1, 1, 10, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    assert high_importance_poor_focus is not None
    assert lower_importance_perfect_focus is not None

    ordered = sorted(
        [
            score_window_candidate(
                lower_importance_perfect_focus,
                profile,
                task_importance_score=0.8,
                preferred_focus_hours=Counter({9: 5}),
            ),
            score_window_candidate(
                high_importance_poor_focus,
                profile,
                task_importance_score=0.9,
                preferred_focus_hours=Counter({9: 5}),
            ),
        ],
        key=window_candidate_sort_key,
    )

    assert ordered[0].candidate == high_importance_poor_focus


def test_scheduling_v4_duration_fit_beats_focus_slot_fit() -> None:
    profile = SchedulingProfileV4()
    exact_weak_focus = build_task_window_candidate(
        task=_task(estimated_duration_minutes=60),
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 15, tzinfo=UTC),
            end=datetime(2099, 1, 1, 16, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    loose_perfect_focus = build_task_window_candidate(
        task=_task(estimated_duration_minutes=60),
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 9, tzinfo=UTC),
            end=datetime(2099, 1, 1, 11, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    assert exact_weak_focus is not None
    assert loose_perfect_focus is not None

    ordered = sorted(
        [
            score_window_candidate(
                loose_perfect_focus,
                profile,
                task_importance_score=0.8,
                preferred_focus_hours=Counter({9: 5}),
            ),
            score_window_candidate(
                exact_weak_focus,
                profile,
                task_importance_score=0.8,
                preferred_focus_hours=Counter({9: 5}),
            ),
        ],
        key=window_candidate_sort_key,
    )

    assert ordered[0].candidate == exact_weak_focus
    assert ordered[0].duration_slot_fit_score == 1.0
    assert ordered[1].focus_slot_fit_score == 1.0


def test_scheduling_v5_cross_day_ordering_remains_reproducible() -> None:
    profile = SchedulingProfileV5.from_settings(_settings())
    task = _task(estimated_duration_minutes=60)
    today_loose = build_task_window_candidate(
        task=task,
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 9, tzinfo=UTC),
            end=datetime(2099, 1, 1, 11, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    tomorrow_exact = build_task_window_candidate(
        task=task,
        window=CandidateWindow(
            start=datetime(2099, 1, 2, 9, tzinfo=UTC),
            end=datetime(2099, 1, 2, 10, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    assert today_loose is not None
    assert tomorrow_exact is not None

    ordered = sorted(
        [
            score_window_candidate(today_loose, profile, task_importance_score=0.8),
            score_window_candidate(tomorrow_exact, profile, task_importance_score=0.8),
        ],
        key=window_candidate_sort_key,
    )

    assert ordered[0].candidate == tomorrow_exact
    assert ordered[0].breakdown.scoring_version == "v5"


def test_scheduling_v6_prefers_earlier_day_before_slot_fit() -> None:
    profile = SchedulingProfileV6.from_settings(_settings())
    task = _task(estimated_duration_minutes=60)
    today_loose = build_task_window_candidate(
        task=task,
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 9, tzinfo=UTC),
            end=datetime(2099, 1, 1, 11, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    tomorrow_exact = build_task_window_candidate(
        task=task,
        window=CandidateWindow(
            start=datetime(2099, 1, 2, 9, tzinfo=UTC),
            end=datetime(2099, 1, 2, 10, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    assert today_loose is not None
    assert tomorrow_exact is not None

    ordered = sorted(
        [
            score_window_candidate(today_loose, profile, task_importance_score=0.8),
            score_window_candidate(tomorrow_exact, profile, task_importance_score=0.8),
        ],
        key=window_candidate_sort_key_v6,
    )

    assert ordered[0].candidate == today_loose
    assert ordered[0].breakdown.scoring_version == "v6"
    assert ordered[0].breakdown.task_importance_profile == "scheduling/v5"


def test_scheduling_v6_still_optimizes_slot_quality_within_same_day() -> None:
    profile = SchedulingProfileV6.from_settings(_settings())
    task = _task(estimated_duration_minutes=60)
    loose = build_task_window_candidate(
        task=task,
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 9, tzinfo=UTC),
            end=datetime(2099, 1, 1, 11, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    exact = build_task_window_candidate(
        task=task,
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 13, tzinfo=UTC),
            end=datetime(2099, 1, 1, 14, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    assert loose is not None
    assert exact is not None

    ordered = sorted(
        [
            score_window_candidate(loose, profile, task_importance_score=0.8),
            score_window_candidate(exact, profile, task_importance_score=0.8),
        ],
        key=window_candidate_sort_key_v6,
    )

    assert ordered[0].candidate == exact
    assert ordered[0].duration_slot_fit_score == 1.0


def test_scheduling_v6_same_day_same_duration_fit_uses_focus_then_start() -> None:
    profile = SchedulingProfileV6.from_settings(_settings())
    task = _task(estimated_duration_minutes=60)
    focused_later = build_task_window_candidate(
        task=task,
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 15, tzinfo=UTC),
            end=datetime(2099, 1, 1, 17, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    unfocused_earlier = build_task_window_candidate(
        task=task,
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 9, tzinfo=UTC),
            end=datetime(2099, 1, 1, 11, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    assert focused_later is not None
    assert unfocused_earlier is not None

    ordered = sorted(
        [
            score_window_candidate(
                unfocused_earlier,
                profile,
                task_importance_score=0.8,
                preferred_focus_hours=Counter({15: 5}),
            ),
            score_window_candidate(
                focused_later,
                profile,
                task_importance_score=0.8,
                preferred_focus_hours=Counter({15: 5}),
            ),
        ],
        key=window_candidate_sort_key_v6,
    )

    assert ordered[0].candidate == focused_later
    assert ordered[0].focus_slot_fit_score == 1.0


def test_scheduling_v6_same_placement_quality_uses_earlier_start() -> None:
    profile = SchedulingProfileV6.from_settings(_settings())
    task = _task(estimated_duration_minutes=60)
    earlier = build_task_window_candidate(
        task=task,
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 9, tzinfo=UTC),
            end=datetime(2099, 1, 1, 10, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    later = build_task_window_candidate(
        task=task,
        window=CandidateWindow(
            start=datetime(2099, 1, 1, 10, tzinfo=UTC),
            end=datetime(2099, 1, 1, 11, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    assert earlier is not None
    assert later is not None

    ordered = sorted(
        [
            score_window_candidate(later, profile, task_importance_score=0.8),
            score_window_candidate(earlier, profile, task_importance_score=0.8),
        ],
        key=window_candidate_sort_key_v6,
    )

    assert ordered[0].candidate == earlier


def test_scheduling_v6_candidate_day_uses_user_timezone() -> None:
    profile = SchedulingProfileV6.from_settings(_settings())
    task = _task(estimated_duration_minutes=60)
    earlier_local_day = build_task_window_candidate(
        task=task,
        window=CandidateWindow(
            start=datetime(2026, 9, 4, 13, 30, tzinfo=UTC),
            end=datetime(2026, 9, 4, 14, 30, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    later_local_day_exact_fit = build_task_window_candidate(
        task=task,
        window=CandidateWindow(
            start=datetime(2026, 9, 4, 23, 30, tzinfo=UTC),
            end=datetime(2026, 9, 5, 0, 30, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    assert earlier_local_day is not None
    assert later_local_day_exact_fit is not None

    ordered = sorted(
        [
            score_window_candidate(
                later_local_day_exact_fit,
                profile,
                task_importance_score=0.8,
                timezone_name="Australia/Sydney",
            ),
            score_window_candidate(
                earlier_local_day,
                profile,
                task_importance_score=0.8,
                timezone_name="Australia/Sydney",
            ),
        ],
        key=lambda item: window_candidate_sort_key_v6(
            item,
            timezone_name="Australia/Sydney",
        ),
    )

    assert ordered[0].candidate == earlier_local_day


def test_scheduling_v6_focus_slot_uses_user_local_candidate_hour() -> None:
    profile = SchedulingProfileV6.from_settings(_settings())
    task = _task(estimated_duration_minutes=60)
    local_nine_am = build_task_window_candidate(
        task=task,
        window=CandidateWindow(
            start=datetime(2026, 9, 3, 23, tzinfo=UTC),
            end=datetime(2026, 9, 4, 0, tzinfo=UTC),
        ),
        settings=_settings(),
    )
    assert local_nine_am is not None

    scored = score_window_candidate(
        local_nine_am,
        profile,
        task_importance_score=0.8,
        preferred_focus_hours=Counter({9: 5}),
        timezone_name="Australia/Sydney",
    )

    assert scored.breakdown.candidate_hour == 9
    assert scored.focus_slot_fit_score == 1.0
