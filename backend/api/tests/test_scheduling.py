import uuid
from collections import Counter
from datetime import UTC, datetime, time, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import User
from app.scheduling import service as scheduling_service
from app.scheduling.engine import RankedTask, build_schedule_slots, rank_open_tasks
from app.scheduling.models import AiScheduleSuggestion, ScheduleSuggestionStatus
from app.scheduling.schemas import ScheduleSuggestionResponse
from app.scheduling.windows import scheduling_required_minutes
from app.scoring.constraints import validate_schedule_candidate
from app.scoring.criteria import deadline_urgency, duration_preference
from app.scoring.engine import calculate_slack_aware_task_importance, score_task
from app.scoring.profiles import LegacySchedulingProfile, SchedulingProfileV5
from app.settings.models import UserSettings
from app.tasks.models import Task, TaskPriority, TaskStatus


def _settings(
    *,
    work_start: time = time(9, 0),
    work_end: time = time(17, 0),
    deadline_weight: int = 80,
    priority_weight: int = 70,
    duration_weight: int = 50,
    timezone: str = "UTC",
) -> UserSettings:
    return UserSettings(
        work_start=work_start,
        work_end=work_end,
        timezone=timezone,
        ai_deadline_urgency_weight=deadline_weight,
        ai_priority_weight=priority_weight,
        ai_estimated_duration_weight=duration_weight,
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
        title="Scoring parity",
        priority=priority,
        due_date=due_date,
        estimated_duration_minutes=estimated_duration_minutes,
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        status=status,
    )


def _score_without_focus(task: Task, *, now: datetime) -> float:
    scored = score_task(
        task,
        LegacySchedulingProfile.from_settings(_settings()),
        now=now,
        preferred_focus_hours=Counter(),
    )
    return scored.score


def auth_headers(client: TestClient) -> dict[str, str]:
    email = f"schedule-{uuid.uuid4()}@example.com"
    password = "TestPassword123"
    assert client.post(
        "/auth/register",
        json={"email": email, "password": password},
    ).status_code == 201
    login = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def auth_context(client: TestClient) -> tuple[dict[str, str], str]:
    email = f"schedule-{uuid.uuid4()}@example.com"
    password = "TestPassword123"
    assert client.post(
        "/auth/register",
        json={"email": email, "password": password},
    ).status_code == 201
    login = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}, email


def test_scoring_parity_short_medium_beats_long_high_under_defaults() -> None:
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

    assert _score_without_focus(high_long, now=now) == 0.805
    assert _score_without_focus(medium_short, now=now) == 0.875
    assert _score_without_focus(high_long, now=now) < _score_without_focus(
        medium_short,
        now=now,
    )


def test_scoring_parity_deadline_23_vs_25_hour_threshold() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)

    assert (
        deadline_urgency(
            due_date=now + timedelta(hours=23),
            status=TaskStatus.PENDING,
            now=now,
        )[0]
        == 0.95
    )
    assert (
        deadline_urgency(
            due_date=now + timedelta(hours=25),
            status=TaskStatus.PENDING,
            now=now,
        )[0]
        == 0.75
    )


def test_scoring_parity_overdue_deadlines_share_factor() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)

    five_minutes_overdue = deadline_urgency(
        due_date=now - timedelta(minutes=5),
        status=TaskStatus.PENDING,
        now=now,
    )[0]
    multi_day_overdue = deadline_urgency(
        due_date=now - timedelta(days=3),
        status=TaskStatus.PENDING,
        now=now,
    )[0]

    assert five_minutes_overdue == 1.0
    assert multi_day_overdue == 1.0


def test_scoring_parity_no_duration_fallback() -> None:
    assert duration_preference(None)[0] == 0.4


def test_scoring_parity_all_factor_weights_zero() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    scored = score_task(
        _task(
            priority=TaskPriority.HIGH,
            due_date=now + timedelta(hours=1),
            estimated_duration_minutes=5,
        ),
        LegacySchedulingProfile.from_settings(
            _settings(deadline_weight=0, priority_weight=0, duration_weight=0),
        ),
        now=now,
        preferred_focus_hours=Counter(),
    )

    assert scored.score == 0


def test_scoring_parity_focus_bonus_clamps_to_one() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    scored = score_task(
        _task(
            priority=TaskPriority.HIGH,
            due_date=now + timedelta(hours=1),
            estimated_duration_minutes=5,
        ),
        LegacySchedulingProfile.from_settings(_settings()),
        now=now,
        preferred_focus_hours=Counter({9: 3}),
    )

    assert scored.breakdown.focus_bonus == 0.15
    assert scored.score == 1.0


def test_scoring_parity_equal_scores_keep_task_id_tie_break() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    later_id = uuid.UUID("22222222-2222-4222-8222-222222222222")
    earlier_id = uuid.UUID("11111111-1111-4111-8111-111111111111")

    ranked = rank_open_tasks(
        [
            _task(task_id=later_id),
            _task(task_id=earlier_id),
        ],
        _settings(),
        now=now,
        preferred_focus_hours=Counter(),
        dismissed_task_ids=set(),
    )

    assert [item.task.id for item in ranked] == [earlier_id, later_id]


def test_rank_open_tasks_uses_scheduling_v5_without_duration_bias() -> None:
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

    ranked = rank_open_tasks(
        [medium_short, high_long],
        _settings(),
        now=now,
        preferred_focus_hours=Counter(),
        dismissed_task_ids=set(),
    )

    assert ranked[0].task.id == high_long.id
    assert ranked[0].score == calculate_slack_aware_task_importance(
        high_long,
        SchedulingProfileV5.from_settings(_settings()),
        now=now,
        required_minutes=scheduling_required_minutes(high_long, _settings()),
    ).score
    assert "Short estimated duration" not in ranked[1].reasons


def test_rank_open_tasks_score_excludes_current_hour_focus_bonus() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    task = _task(
        priority=TaskPriority.HIGH,
        due_date=now + timedelta(hours=1),
    )

    ranked = rank_open_tasks(
        [task],
        _settings(),
        now=now,
        preferred_focus_hours=Counter({9: 5}),
        dismissed_task_ids=set(),
    )

    assert ranked[0].score == calculate_slack_aware_task_importance(
        task,
        SchedulingProfileV5.from_settings(_settings()),
        now=now,
        required_minutes=scheduling_required_minutes(task, _settings()),
    ).score
    assert "Matches your usual focus hours" not in ranked[0].reasons


def test_production_v5_output_ignores_estimated_duration_weight() -> None:
    now = datetime(2026, 1, 1, 8, tzinfo=UTC)
    due = now + timedelta(hours=8)
    high_long_id = uuid.UUID("11111111-1111-4111-8111-111111111111")
    medium_short_id = uuid.UUID("22222222-2222-4222-8222-222222222222")

    def generate(duration_weight: int) -> tuple[list[tuple[uuid.UUID, float]], list[tuple]]:
        settings = _settings(duration_weight=duration_weight)
        tasks = [
            _task(
                task_id=medium_short_id,
                priority=TaskPriority.MEDIUM,
                due_date=due,
                estimated_duration_minutes=10,
            ),
            _task(
                task_id=high_long_id,
                priority=TaskPriority.HIGH,
                due_date=due,
                estimated_duration_minutes=90,
            ),
        ]
        ranked = rank_open_tasks(
            tasks,
            settings,
            now=now,
            preferred_focus_hours=Counter(),
            dismissed_task_ids=set(),
        )
        slots = build_schedule_slots(
            ranked,
            settings,
            now=now,
            existing_tasks=tasks,
            preferred_focus_hours=Counter(),
        )
        return (
            [(item.task.id, item.score) for item in ranked],
            [(task.id, start, end) for task, start, end, _explanation in slots],
        )

    assert generate(0) == generate(100)


def test_deadline_weight_still_affects_production_task_importance() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    urgent_low = _task(
        task_id=uuid.UUID("11111111-1111-4111-8111-111111111111"),
        priority=TaskPriority.LOW,
        due_date=now + timedelta(hours=4),
    )
    later_high = _task(
        task_id=uuid.UUID("22222222-2222-4222-8222-222222222222"),
        priority=TaskPriority.HIGH,
        due_date=now + timedelta(days=14),
    )

    ranked = rank_open_tasks(
        [later_high, urgent_low],
        _settings(deadline_weight=100, priority_weight=0),
        now=now,
        preferred_focus_hours=Counter(),
        dismissed_task_ids=set(),
    )

    assert ranked[0].task.id == urgent_low.id


def test_priority_weight_still_affects_production_task_importance() -> None:
    now = datetime(2026, 1, 1, 9, tzinfo=UTC)
    urgent_low = _task(
        task_id=uuid.UUID("11111111-1111-4111-8111-111111111111"),
        priority=TaskPriority.LOW,
        due_date=now + timedelta(hours=4),
    )
    later_high = _task(
        task_id=uuid.UUID("22222222-2222-4222-8222-222222222222"),
        priority=TaskPriority.HIGH,
        due_date=now + timedelta(days=14),
    )

    ranked = rank_open_tasks(
        [urgent_low, later_high],
        _settings(deadline_weight=0, priority_weight=100),
        now=now,
        preferred_focus_hours=Counter(),
        dismissed_task_ids=set(),
    )

    assert ranked[0].task.id == later_high.id


def test_constraints_reject_existing_scheduled_task_overlap() -> None:
    day = datetime(2099, 1, 1, tzinfo=UTC)
    candidate = _task()
    existing = _task(
        scheduled_start=day.replace(hour=9),
        scheduled_end=day.replace(hour=10),
    )

    result = validate_schedule_candidate(
        task=candidate,
        start=day.replace(hour=9, minute=30),
        end=day.replace(hour=10, minute=30),
        settings=_settings(),
        existing_tasks=[existing],
    )

    assert not result.valid
    assert any(
        not check.passed and check.name == "existing_schedule_conflict"
        for check in result.checks
    )


def test_constraints_allow_boundary_touching_existing_schedule() -> None:
    day = datetime(2099, 1, 1, tzinfo=UTC)
    candidate = _task()
    existing = _task(
        scheduled_start=day.replace(hour=9),
        scheduled_end=day.replace(hour=10),
    )

    result = validate_schedule_candidate(
        task=candidate,
        start=day.replace(hour=10),
        end=day.replace(hour=10, minute=30),
        settings=_settings(),
        existing_tasks=[existing],
    )

    assert result.valid


def test_constraints_reject_candidate_fully_inside_occupied_interval() -> None:
    day = datetime(2099, 1, 1, tzinfo=UTC)
    result = validate_schedule_candidate(
        task=_task(),
        start=day.replace(hour=9, minute=15),
        end=day.replace(hour=9, minute=45),
        settings=_settings(),
        existing_tasks=[
            _task(
                scheduled_start=day.replace(hour=9),
                scheduled_end=day.replace(hour=10),
            )
        ],
    )

    assert not result.valid


def test_constraints_reject_candidate_containing_occupied_interval() -> None:
    day = datetime(2099, 1, 1, tzinfo=UTC)
    result = validate_schedule_candidate(
        task=_task(),
        start=day.replace(hour=8, minute=30),
        end=day.replace(hour=10, minute=30),
        settings=_settings(work_start=time(8, 0)),
        existing_tasks=[
            _task(
                scheduled_start=day.replace(hour=9),
                scheduled_end=day.replace(hour=10),
            )
        ],
    )

    assert not result.valid


def test_constraints_allow_candidate_before_and_after_occupied_interval() -> None:
    day = datetime(2099, 1, 1, tzinfo=UTC)
    existing = _task(
        scheduled_start=day.replace(hour=10),
        scheduled_end=day.replace(hour=11),
    )

    before = validate_schedule_candidate(
        task=_task(),
        start=day.replace(hour=9),
        end=day.replace(hour=10),
        settings=_settings(),
        existing_tasks=[existing],
    )
    after = validate_schedule_candidate(
        task=_task(),
        start=day.replace(hour=11),
        end=day.replace(hour=12),
        settings=_settings(),
        existing_tasks=[existing],
    )

    assert before.valid
    assert after.valid


def test_constraints_reject_outside_working_hours() -> None:
    day = datetime(2099, 1, 1, tzinfo=UTC)
    result = validate_schedule_candidate(
        task=_task(),
        start=day.replace(hour=8, minute=30),
        end=day.replace(hour=9, minute=30),
        settings=_settings(),
        existing_tasks=[],
    )

    assert not result.valid
    assert any(
        not check.passed and check.name == "working_hours"
        for check in result.checks
    )


def test_constraints_evaluate_working_hours_in_user_timezone() -> None:
    result = validate_schedule_candidate(
        task=_task(),
        start=datetime(2026, 9, 3, 23, tzinfo=UTC),
        end=datetime(2026, 9, 4, 0, tzinfo=UTC),
        settings=_settings(timezone="Australia/Sydney"),
        existing_tasks=[],
    )

    assert result.valid


def test_constraints_reject_after_local_work_end_in_user_timezone() -> None:
    result = validate_schedule_candidate(
        task=_task(),
        start=datetime(2026, 9, 4, 6, 30, tzinfo=UTC),
        end=datetime(2026, 9, 4, 8, tzinfo=UTC),
        settings=_settings(timezone="Australia/Sydney"),
        existing_tasks=[],
    )

    assert not result.valid
    assert any(
        not check.passed and check.name == "working_hours"
        for check in result.checks
    )


def test_constraints_allow_ending_exactly_at_work_end() -> None:
    day = datetime(2099, 1, 1, tzinfo=UTC)
    result = validate_schedule_candidate(
        task=_task(),
        start=day.replace(hour=16, minute=30),
        end=day.replace(hour=17),
        settings=_settings(),
        existing_tasks=[],
    )

    assert result.valid


def test_constraints_reject_ending_after_work_end() -> None:
    day = datetime(2099, 1, 1, tzinfo=UTC)
    result = validate_schedule_candidate(
        task=_task(),
        start=day.replace(hour=16, minute=45),
        end=day.replace(hour=17, minute=15),
        settings=_settings(),
        existing_tasks=[],
    )

    assert not result.valid


def test_constraints_allow_ending_on_or_before_deadline() -> None:
    day = datetime(2099, 1, 1, tzinfo=UTC)
    result = validate_schedule_candidate(
        task=_task(due_date=day.replace(hour=10)),
        start=day.replace(hour=9),
        end=day.replace(hour=10),
        settings=_settings(),
        existing_tasks=[],
    )

    assert result.valid


def test_constraints_reject_ending_after_deadline() -> None:
    day = datetime(2099, 1, 1, tzinfo=UTC)
    result = validate_schedule_candidate(
        task=_task(due_date=day.replace(hour=10)),
        start=day.replace(hour=9, minute=30),
        end=day.replace(hour=10, minute=30),
        settings=_settings(),
        existing_tasks=[],
    )

    assert not result.valid
    assert any(
        not check.passed and check.name == "deadline_feasible"
        for check in result.checks
    )


def test_constraints_ignore_completed_scheduled_tasks_as_blockers() -> None:
    day = datetime(2099, 1, 1, tzinfo=UTC)
    result = validate_schedule_candidate(
        task=_task(),
        start=day.replace(hour=9, minute=30),
        end=day.replace(hour=10, minute=30),
        settings=_settings(),
        existing_tasks=[
            _task(
                scheduled_start=day.replace(hour=9),
                scheduled_end=day.replace(hour=10),
                status=TaskStatus.DONE,
            )
        ],
    )

    assert result.valid


def test_schedule_response_presentation_is_chronological_without_rewriting_position() -> None:
    task_id = uuid.uuid4()
    tomorrow = ScheduleSuggestionResponse(
        id=uuid.uuid4(),
        task_id=task_id,
        task_title="Tomorrow selection",
        suggested_start=datetime(2099, 1, 2, 9, tzinfo=UTC),
        suggested_end=datetime(2099, 1, 2, 10, tzinfo=UTC),
        explanation="Selected first by task importance.",
        status=ScheduleSuggestionStatus.PENDING.value,
        position=0,
    )
    today = ScheduleSuggestionResponse(
        id=uuid.uuid4(),
        task_id=task_id,
        task_title="Today selection",
        suggested_start=datetime(2099, 1, 1, 9, tzinfo=UTC),
        suggested_end=datetime(2099, 1, 1, 10, tzinfo=UTC),
        explanation="Selected second but displayed first.",
        status=ScheduleSuggestionStatus.PENDING.value,
        position=1,
    )

    ordered = scheduling_service._chronological_schedule([tomorrow, today])

    assert [item.suggested_start for item in ordered] == [
        datetime(2099, 1, 1, 9, tzinfo=UTC),
        datetime(2099, 1, 2, 9, tzinfo=UTC),
    ]
    assert [item.position for item in ordered] == [1, 0]


def test_build_schedule_slots_skips_task_with_existing_active_schedule() -> None:
    now = datetime(2099, 1, 1, 8, tzinfo=UTC)
    scheduled_task = _task(
        scheduled_start=now.replace(hour=9),
        scheduled_end=now.replace(hour=10),
        estimated_duration_minutes=30,
    )
    unscheduled_task = _task(
        priority=TaskPriority.MEDIUM,
        estimated_duration_minutes=30,
    )
    ranked = [
        RankedTask(scheduled_task, 1.0, [], []),
        RankedTask(unscheduled_task, 0.7, [], []),
    ]

    slots = build_schedule_slots(
        ranked,
        _settings(),
        now=now,
        existing_tasks=[scheduled_task, unscheduled_task],
    )

    assert [task.id for task, *_rest in slots] == [unscheduled_task.id]


def test_adjusted_suggestion_cannot_move_onto_occupied_period(
    client: TestClient,
    db_session: Session,
) -> None:
    headers, email = auth_context(client)
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None

    occupied = client.post(
        "/tasks",
        headers=headers,
        json={
            "title": "Already scheduled",
            "scheduled_start": "2099-01-01T09:00:00+00:00",
            "scheduled_end": "2099-01-01T10:00:00+00:00",
        },
    )
    assert occupied.status_code == 201
    target = client.post(
        "/tasks",
        headers=headers,
        json={"title": "Move suggestion here", "estimated_duration_minutes": 30},
    )
    assert target.status_code == 201

    suggestion = AiScheduleSuggestion(
        user_id=user.id,
        task_id=uuid.UUID(target.json()["id"]),
        suggested_start=datetime(2099, 1, 1, 10, tzinfo=UTC),
        suggested_end=datetime(2099, 1, 1, 10, 30, tzinfo=UTC),
        explanation="Initial valid suggestion.",
        status=ScheduleSuggestionStatus.PENDING.value,
        position=0,
    )
    db_session.add(suggestion)
    db_session.commit()

    response = client.post(
        f"/scheduling/suggestions/{suggestion.id}/adjust",
        headers=headers,
        json={
            "suggested_start": "2099-01-01T09:30:00+00:00",
            "suggested_end": "2099-01-01T10:00:00+00:00",
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Schedule conflicts with an existing scheduled task"


def test_adjusted_future_suggestion_remains_future_dated(
    client: TestClient,
    db_session: Session,
) -> None:
    headers, email = auth_context(client)
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None

    target = client.post(
        "/tasks",
        headers=headers,
        json={"title": "Adjust future slot", "estimated_duration_minutes": 60},
    )
    assert target.status_code == 201
    task_id = uuid.UUID(target.json()["id"])
    suggestion = AiScheduleSuggestion(
        user_id=user.id,
        task_id=task_id,
        suggested_start=datetime(2099, 1, 2, 9, tzinfo=UTC),
        suggested_end=datetime(2099, 1, 2, 10, tzinfo=UTC),
        explanation="Initial future suggestion.",
        status=ScheduleSuggestionStatus.PENDING.value,
        position=0,
    )
    db_session.add(suggestion)
    db_session.commit()

    response = client.post(
        f"/scheduling/suggestions/{suggestion.id}/adjust",
        headers=headers,
        json={
            "suggested_start": "2099-01-03T11:00:00+00:00",
            "suggested_end": "2099-01-03T12:00:00+00:00",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "adjusted"
    assert response.json()["suggested_start"] == "2099-01-03T11:00:00Z"
    assert response.json()["suggested_end"] == "2099-01-03T12:00:00Z"


def test_applied_future_suggestion_persists_task_schedule(
    client: TestClient,
    db_session: Session,
) -> None:
    headers, email = auth_context(client)
    user = db_session.scalar(select(User).where(User.email == email))
    assert user is not None

    target = client.post(
        "/tasks",
        headers=headers,
        json={"title": "Apply future slot", "estimated_duration_minutes": 60},
    )
    assert target.status_code == 201
    task_id = uuid.UUID(target.json()["id"])
    suggestion = AiScheduleSuggestion(
        user_id=user.id,
        task_id=task_id,
        suggested_start=datetime(2099, 1, 2, 9, tzinfo=UTC),
        suggested_end=datetime(2099, 1, 2, 10, tzinfo=UTC),
        explanation="Future suggestion.",
        status=ScheduleSuggestionStatus.ACCEPTED.value,
        position=0,
    )
    db_session.add(suggestion)
    db_session.commit()

    response = client.post(
        "/scheduling/suggestions/apply",
        headers=headers,
        json={"suggestion_ids": [str(suggestion.id)]},
    )
    task = client.get(f"/tasks/{task_id}", headers=headers)

    assert response.status_code == 200
    assert task.status_code == 200
    assert task.json()["scheduled_start"] == "2099-01-02T09:00:00Z"
    assert task.json()["scheduled_end"] == "2099-01-02T10:00:00Z"


def test_generate_plan_and_apply_schedule(client: TestClient) -> None:
    headers = auth_headers(client)
    due = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    create = client.post(
        "/tasks",
        headers=headers,
        json={
            "title": "Ship scheduling",
            "priority": "high",
            "due_date": due,
            "estimated_duration_minutes": 30,
        },
    )
    assert create.status_code == 201

    plan = client.get("/scheduling/plan", headers=headers)
    assert plan.status_code == 200
    body = plan.json()
    assert body["recommendation"] is not None
    assert body["recommendation"]["task"]["title"] == "Ship scheduling"
    assert any("weight" in item.lower() for item in body["recommendation"]["based_on"])
    assert body["footnote"] == "AI based on your patterns"
    assert len(body["schedule"]) >= 1

    suggestion_id = body["schedule"][0]["id"]
    accept = client.post(
        f"/scheduling/suggestions/{suggestion_id}/accept",
        headers=headers,
    )
    assert accept.status_code == 200
    assert accept.json()["status"] == "accepted"

    applied = client.post(
        "/scheduling/suggestions/apply",
        headers=headers,
        json={"suggestion_ids": [suggestion_id]},
    )
    assert applied.status_code == 200

    task = client.get(f"/tasks/{create.json()['id']}", headers=headers)
    assert task.status_code == 200
    assert task.json()["scheduled_start"] is not None
    assert task.json()["scheduled_end"] is not None


def test_focus_session_and_regenerate(client: TestClient) -> None:
    headers = auth_headers(client)
    create = client.post(
        "/tasks",
        headers=headers,
        json={"title": "Focus capture", "priority": "medium"},
    )
    assert create.status_code == 201
    task_id = create.json()["id"]

    started = datetime.now(UTC) - timedelta(minutes=25)
    ended = datetime.now(UTC)
    session = client.post(
        "/focus/sessions",
        headers=headers,
        json={
            "task_id": task_id,
            "started_at": started.isoformat(),
            "ended_at": ended.isoformat(),
            "duration_minutes": 25,
            "completed": True,
        },
    )
    assert session.status_code == 201

    regenerated = client.post("/scheduling/plan/regenerate", headers=headers)
    assert regenerated.status_code == 200
    assert regenerated.json()["recommendation"] is not None


def test_dashboard_includes_ai_recommendation(client: TestClient) -> None:
    headers = auth_headers(client)
    client.post(
        "/tasks",
        headers=headers,
        json={
            "title": "Dashboard AI card",
            "priority": "high",
            "estimated_duration_minutes": 20,
            "due_date": (datetime.now(UTC) + timedelta(hours=4)).isoformat(),
        },
    )

    response = client.get("/dashboard/summary", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["ai_recommendation"] is not None
    assert payload["ai_recommendation"]["footnote"] == "AI based on your patterns"
    assert payload["ai_recommendation"]["task"]["title"] == "Dashboard AI card"
    assert payload["next_best_task"] is not None


def test_recommendation_refreshes_after_task_and_settings_changes(
    client: TestClient,
) -> None:
    headers = auth_headers(client)
    due = (datetime.now(UTC) + timedelta(hours=5)).isoformat()

    first = client.post(
        "/tasks",
        headers=headers,
        json={
            "title": "Finish first",
            "priority": "high",
            "due_date": due,
            "estimated_duration_minutes": 25,
        },
    )
    assert first.status_code == 201
    first_id = first.json()["id"]

    second = client.post(
        "/tasks",
        headers=headers,
        json={
            "title": "Then second",
            "priority": "medium",
            "due_date": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
            "estimated_duration_minutes": 45,
        },
    )
    assert second.status_code == 201
    second_id = second.json()["id"]

    plan = client.get("/scheduling/plan", headers=headers)
    assert plan.status_code == 200
    assert plan.json()["recommendation"]["task"]["id"] == first_id
    first_recommendation_id = plan.json()["recommendation"]["id"]

    completed = client.patch(
        f"/tasks/{first_id}",
        headers=headers,
        json={"status": "done"},
    )
    assert completed.status_code == 200

    refreshed = client.get("/scheduling/plan", headers=headers)
    assert refreshed.status_code == 200
    assert refreshed.json()["recommendation"] is not None
    assert refreshed.json()["recommendation"]["task"]["id"] == second_id
    assert refreshed.json()["recommendation"]["id"] != first_recommendation_id

    updated_task = client.patch(
        f"/tasks/{second_id}",
        headers=headers,
        json={"title": "Then second (updated)", "priority": "high"},
    )
    assert updated_task.status_code == 200

    after_edit = client.get("/scheduling/plan", headers=headers)
    assert after_edit.status_code == 200
    assert after_edit.json()["recommendation"]["task"]["title"] == "Then second (updated)"
    assert after_edit.json()["recommendation"]["id"] != refreshed.json()["recommendation"]["id"]

    settings = client.patch(
        "/settings",
        headers=headers,
        json={
            "ai_scheduling": {
                "ai_deadline_urgency_weight": 90,
                "ai_priority_weight": 10,
                "ai_estimated_duration_weight": 10,
            }
        },
    )
    assert settings.status_code == 200

    after_weights = client.get("/scheduling/plan", headers=headers)
    assert after_weights.status_code == 200
    assert after_weights.json()["recommendation"] is not None
    assert (
        after_weights.json()["recommendation"]["weights"]["deadline_urgency"] == 90
    )
