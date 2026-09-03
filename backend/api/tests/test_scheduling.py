import uuid
from collections import Counter
from datetime import UTC, datetime, time, timedelta

from fastapi.testclient import TestClient

from app.scheduling.engine import rank_open_tasks
from app.scoring.criteria import deadline_urgency, duration_preference
from app.scoring.engine import score_task
from app.scoring.profiles import LegacySchedulingProfile
from app.settings.models import UserSettings
from app.tasks.models import Task, TaskPriority, TaskStatus


def _settings(
    *,
    deadline_weight: int = 80,
    priority_weight: int = 70,
    duration_weight: int = 50,
) -> UserSettings:
    return UserSettings(
        work_start=time(9, 0),
        work_end=time(17, 0),
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
    status: TaskStatus = TaskStatus.PENDING,
) -> Task:
    return Task(
        id=task_id or uuid.uuid4(),
        user_id=uuid.uuid4(),
        title="Scoring parity",
        priority=priority,
        due_date=due_date,
        estimated_duration_minutes=estimated_duration_minutes,
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


def test_generate_plan_and_apply_schedule(client: TestClient) -> None:
    headers = auth_headers(client)
    due = (datetime.now(UTC) + timedelta(hours=6)).isoformat()
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
