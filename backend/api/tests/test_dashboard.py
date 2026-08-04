import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.projects.models import Project
from app.tasks.models import Task, TaskPriority, TaskStatus


def create_auth_headers(client: TestClient) -> tuple[dict[str, str], str]:
    email = f"dashboard-{uuid.uuid4()}@example.com"
    password = "TestPassword123"

    register_response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Dana",
            "last_name": "Dashboard",
            "role": "student",
        },
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/auth/login",
        json={
            "email": email,
            "password": password,
        },
    )
    assert login_response.status_code == 200

    return {
        "Authorization": f"Bearer {login_response.json()['access_token']}",
    }, register_response.json()["id"]


def add_task(
    db_session: Session,
    *,
    user_id: str,
    title: str,
    status: TaskStatus = TaskStatus.PENDING,
    priority: TaskPriority = TaskPriority.NO_PRIORITY,
    due_date: datetime | None = None,
    estimated_duration_minutes: int | None = None,
    project_id: uuid.UUID | None = None,
) -> Task:
    task = Task(
        user_id=uuid.UUID(user_id),
        project_id=project_id,
        title=title,
        status=status,
        priority=priority,
        due_date=due_date,
        estimated_duration_minutes=estimated_duration_minutes,
    )
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)
    return task


def test_dashboard_summary_requires_auth(client: TestClient) -> None:
    response = client.get("/dashboard/summary")
    assert response.status_code == 401


def test_dashboard_summary_for_empty_user(client: TestClient) -> None:
    headers, _user_id = create_auth_headers(client)

    response = client.get("/dashboard/summary", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["task_progress"] == {
        "completed": 0,
        "total": 0,
        "percent": None,
    }
    assert payload["overdue_count"] == 0
    assert payload["next_best_task"] is None
    assert payload["quick_wins"] == []
    assert payload["in_progress"] == []


def test_dashboard_summary_derives_overdue_and_progress(
    client: TestClient,
    db_session: Session,
) -> None:
    headers, user_id = create_auth_headers(client)
    now = datetime.now(UTC)

    overdue = add_task(
        db_session,
        user_id=user_id,
        title="Past open",
        priority=TaskPriority.MEDIUM,
        due_date=now - timedelta(days=1),
        estimated_duration_minutes=30,
    )
    done_late = add_task(
        db_session,
        user_id=user_id,
        title="Done late",
        status=TaskStatus.DONE,
        due_date=now - timedelta(days=2),
        estimated_duration_minutes=30,
    )
    add_task(
        db_session,
        user_id=user_id,
        title="Future open",
        priority=TaskPriority.HIGH,
        due_date=now + timedelta(days=1),
        estimated_duration_minutes=20,
    )

    response = client.get("/dashboard/summary", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["task_progress"] == {
        "completed": 1,
        "total": 3,
        "percent": 33,
    }
    assert payload["overdue_count"] == 1
    assert payload["next_best_task"]["task"]["id"] == str(overdue.id)
    assert payload["next_best_task"]["task"]["status"] == "overdue"
    assert payload["next_best_task"]["task"]["stored_status"] == "pending"
    assert payload["next_best_task"]["task"]["is_overdue"] is True
    assert "Overdue" in payload["next_best_task"]["reasons"]
    assert str(done_late.id) not in [
        payload["next_best_task"]["task"]["id"],
        *[task["id"] for task in payload["quick_wins"]],
    ]


def test_dashboard_next_best_task_ordering(
    client: TestClient,
    db_session: Session,
) -> None:
    headers, user_id = create_auth_headers(client)
    now = datetime.now(UTC)

    future_high = add_task(
        db_session,
        user_id=user_id,
        title="Future high",
        priority=TaskPriority.HIGH,
        due_date=now + timedelta(hours=4),
        estimated_duration_minutes=10,
    )
    add_task(
        db_session,
        user_id=user_id,
        title="Future earlier",
        priority=TaskPriority.LOW,
        due_date=now + timedelta(hours=1),
        estimated_duration_minutes=60,
    )

    response = client.get("/dashboard/summary", headers=headers)
    assert response.status_code == 200
    payload = response.json()

    assert payload["next_best_task"]["task"]["title"] == "Future earlier"
    assert payload["next_best_task"]["task"]["id"] != str(future_high.id)
    assert payload["next_best_task"]["reasons"] == ["Due soon"]


def test_dashboard_next_best_task_uses_priority_then_shorter_duration_tie_breakers(
    client: TestClient,
    db_session: Session,
) -> None:
    headers, user_id = create_auth_headers(client)
    due_date = datetime.now(UTC) + timedelta(hours=2)

    add_task(
        db_session,
        user_id=user_id,
        title="Medium same due",
        priority=TaskPriority.MEDIUM,
        due_date=due_date,
        estimated_duration_minutes=5,
    )
    high_long = add_task(
        db_session,
        user_id=user_id,
        title="High same due long",
        priority=TaskPriority.HIGH,
        due_date=due_date,
        estimated_duration_minutes=30,
    )
    add_task(
        db_session,
        user_id=user_id,
        title="High same due short",
        priority=TaskPriority.HIGH,
        due_date=due_date,
        estimated_duration_minutes=10,
    )

    response = client.get("/dashboard/summary", headers=headers)
    assert response.status_code == 200
    payload = response.json()

    assert payload["next_best_task"]["task"]["title"] == "High same due short"
    assert payload["next_best_task"]["task"]["id"] != str(high_long.id)
    assert payload["next_best_task"]["reasons"] == [
        "Due soon",
        "High priority",
        "Short estimated duration",
    ]


def test_dashboard_quick_wins_require_short_estimates_and_limit_to_five(
    client: TestClient,
    db_session: Session,
) -> None:
    headers, user_id = create_auth_headers(client)
    now = datetime.now(UTC)

    for index, duration in enumerate([5, 10, 8, 6, 7, 9], start=1):
        add_task(
            db_session,
            user_id=user_id,
            title=f"Quick {index}",
            priority=TaskPriority.LOW,
            due_date=now + timedelta(days=index),
            estimated_duration_minutes=duration,
        )

    add_task(
        db_session,
        user_id=user_id,
        title="No estimate",
        due_date=now + timedelta(hours=1),
    )
    add_task(
        db_session,
        user_id=user_id,
        title="Too long",
        due_date=now + timedelta(hours=2),
        estimated_duration_minutes=11,
    )

    response = client.get("/dashboard/summary", headers=headers)
    assert response.status_code == 200
    quick_wins = response.json()["quick_wins"]

    assert [task["title"] for task in quick_wins] == [
        "Quick 1",
        "Quick 2",
        "Quick 3",
        "Quick 4",
        "Quick 5",
    ]
    assert len(quick_wins) == 5
    assert all(task["estimated_duration_minutes"] <= 10 for task in quick_wins)


def test_dashboard_in_progress_includes_project_and_overdue_badge_data(
    client: TestClient,
    db_session: Session,
) -> None:
    headers, user_id = create_auth_headers(client)
    project = Project(
        user_id=uuid.UUID(user_id),
        name="Dashboard Project",
        color="#22F0B1",
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    in_progress = add_task(
        db_session,
        user_id=user_id,
        title="Active dashboard task",
        status=TaskStatus.IN_PROGRESS,
        priority=TaskPriority.HIGH,
        due_date=datetime.now(UTC) - timedelta(hours=1),
        estimated_duration_minutes=15,
        project_id=project.id,
    )
    add_task(
        db_session,
        user_id=user_id,
        title="Pending task",
        status=TaskStatus.PENDING,
    )

    response = client.get("/dashboard/summary", headers=headers)
    assert response.status_code == 200
    items = response.json()["in_progress"]

    assert len(items) == 1
    assert items[0]["id"] == str(in_progress.id)
    assert items[0]["title"] == "Active dashboard task"
    assert items[0]["project"]["name"] == "Dashboard Project"
    assert items[0]["priority"] == "high"
    assert items[0]["estimated_duration_minutes"] == 15
    assert items[0]["status"] == "overdue"
    assert items[0]["stored_status"] == "in_progress"
    assert items[0]["is_overdue"] is True
