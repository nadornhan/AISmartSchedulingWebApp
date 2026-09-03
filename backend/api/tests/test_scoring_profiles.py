import uuid
from collections import Counter
from datetime import UTC, datetime, timedelta

from app.scoring import NextTaskProfileV1, QuickWinProfileV1, SchedulingProfileV1
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
    next_task = NextTaskProfileV1()
    quick_win = QuickWinProfileV1()

    assert scheduling.profile_name == "scheduling"
    assert scheduling.scoring_version == "v1"
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
