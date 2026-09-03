import uuid
from collections import Counter
from datetime import UTC, datetime, timedelta

from app.scheduling.windows import CandidateWindow, build_task_window_candidate
from app.scoring import (
    NextTaskProfileV1,
    QuickWinProfileV1,
    SchedulingProfileV1,
    SchedulingProfileV2,
    SchedulingProfileV3,
    SchedulingProfileV4,
    calculate_task_importance,
    score_window_candidate,
    window_candidate_sort_key,
)
from app.scoring.criteria import duration_slot_fit, focus_slot_fit
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


def test_profile_identity_metadata_is_available_without_persistence() -> None:
    scheduling = SchedulingProfileV1.from_settings(_settings())
    scheduling_v2 = SchedulingProfileV2.from_settings(_settings())
    next_task = NextTaskProfileV1()
    quick_win = QuickWinProfileV1()

    assert scheduling.profile_name == "scheduling"
    assert scheduling.scoring_version == "v1"
    assert scheduling_v2.profile_name == "scheduling"
    assert scheduling_v2.scoring_version == "v2"
    assert next_task.profile_name == "next_task"
    assert next_task.scoring_version == "v1"
    assert quick_win.profile_name == "quick_win"
    assert quick_win.scoring_version == "v1"


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
