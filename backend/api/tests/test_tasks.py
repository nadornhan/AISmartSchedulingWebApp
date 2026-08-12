import uuid

import pytest
from fastapi.testclient import TestClient


def create_auth_headers(
    client: TestClient,
    email_prefix: str = "task-test",
) -> dict[str, str]:
    email = f"{email_prefix}-{uuid.uuid4()}@example.com"
    password = "TestPassword123"

    register_response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
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
        "Authorization": (f"Bearer {login_response.json()['access_token']}"),
    }


@pytest.fixture
def auth_headers(client: TestClient) -> dict[str, str]:
    return create_auth_headers(client)


def create_project(
    client: TestClient,
    auth_headers: dict[str, str],
    name: str = "Test Project",
) -> dict:
    response = client.post(
        "/projects",
        headers=auth_headers,
        json={"name": name},
    )

    assert response.status_code == 201
    return response.json()


def create_task(
    client: TestClient,
    auth_headers: dict[str, str],
    title: str,
    project_id: str | None = None,
) -> dict:
    payload = {
        "title": title,
        "description": "Task description",
    }

    if project_id is not None:
        payload["project_id"] = project_id

    response = client.post(
        "/tasks",
        headers=auth_headers,
        json=payload,
    )

    assert response.status_code == 201
    return response.json()


def test_create_task_with_project(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    project = create_project(client, auth_headers)

    response = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "Complete assignment",
            "description": "Finish the backend tests",
            "project_id": project["id"],
        },
    )

    assert response.status_code == 201

    task = response.json()

    assert task["title"] == "Complete assignment"
    assert task["description"] == "Finish the backend tests"
    assert task["project_id"] == project["id"]
    assert task["status"] == "pending"
    assert task["id"]
    assert task["user_id"]


def test_filter_tasks_by_project(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    first_project = create_project(
        client,
        auth_headers,
        "First Project",
    )
    second_project = create_project(
        client,
        auth_headers,
        "Second Project",
    )

    create_task(
        client,
        auth_headers,
        "First project task",
        first_project["id"],
    )
    create_task(
        client,
        auth_headers,
        "Second project task",
        second_project["id"],
    )
    create_task(
        client,
        auth_headers,
        "Task without project",
    )

    response = client.get(
        "/tasks",
        headers=auth_headers,
        params={"project_id": first_project["id"]},
    )

    assert response.status_code == 200

    data = response.json()
    tasks = data["items"]

    assert len(tasks) == 1
    assert tasks[0]["title"] == "First project task"
    assert tasks[0]["project_id"] == first_project["id"]

    assert data["page"] == 1
    assert data["page_size"] == 20
    assert data["total"] == 1
    assert data["total_pages"] == 1


def test_update_task_to_another_project(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    first_project = create_project(
        client,
        auth_headers,
        "Original Project",
    )
    second_project = create_project(
        client,
        auth_headers,
        "New Project",
    )
    task = create_task(
        client,
        auth_headers,
        "Move this task",
        first_project["id"],
    )

    response = client.patch(
        f"/tasks/{task['id']}",
        headers=auth_headers,
        json={"project_id": second_project["id"]},
    )

    assert response.status_code == 200
    assert response.json()["project_id"] == second_project["id"]


def test_remove_task_from_project(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    project = create_project(client, auth_headers)
    task = create_task(
        client,
        auth_headers,
        "Remove from project",
        project["id"],
    )

    response = client.patch(
        f"/tasks/{task['id']}",
        headers=auth_headers,
        json={"project_id": None},
    )

    assert response.status_code == 200
    assert response.json()["project_id"] is None


def test_cannot_use_another_users_project(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    other_user_headers = create_auth_headers(
        client,
        "other-user",
    )
    other_project = create_project(
        client,
        other_user_headers,
        "Other User Project",
    )

    response = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "Unauthorised task",
            "project_id": other_project["id"],
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_deleting_project_sets_task_project_id_to_null(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    project = create_project(client, auth_headers)
    task = create_task(
        client,
        auth_headers,
        "Keep after project deletion",
        project["id"],
    )

    delete_response = client.delete(
        f"/projects/{project['id']}",
        headers=auth_headers,
    )

    assert delete_response.status_code == 204

    list_response = client.get(
        "/tasks",
        headers=auth_headers,
    )

    assert list_response.status_code == 200

    tasks = list_response.json()["items"]

    matching_tasks = [
        item
        for item in tasks
        if item["id"] == task["id"]
    ]

    assert len(matching_tasks) == 1
    assert matching_tasks[0]["project_id"] is None


def test_create_task_with_new_fields_and_project_summary(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    project = create_project(client, auth_headers, "University")

    response = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "Prepare presentation",
            "project_id": project["id"],
            "priority": "high",
            "due_date": "2030-08-10T12:00:00Z",
            "estimated_duration_minutes": 90,
            "scheduled_start": "2030-08-10T09:00:00Z",
            "scheduled_end": "2030-08-10T10:30:00Z",
        },
    )

    assert response.status_code == 201

    task = response.json()

    assert task["status"] == "pending"
    assert task["priority"] == "high"
    assert task["estimated_duration_minutes"] == 90
    assert task["due_date"] == "2030-08-10T12:00:00Z"
    assert task["scheduled_start"] == "2030-08-10T09:00:00Z"
    assert task["scheduled_end"] == "2030-08-10T10:30:00Z"
    assert task["project"]["id"] == project["id"]
    assert task["project"]["name"] == "University"
    assert task["project"]["color"] == project["color"]
    assert task["subtasks"] == []
    assert task["subtask_progress"] == {
        "completed": 0,
        "total": 0,
        "percent": None,
    }


def test_create_task_with_subtasks(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "Build onboarding",
            "subtasks": [
                {
                    "title": "Write copy",
                    "is_completed": True,
                    "position": 2,
                },
                {
                    "title": "Design empty state",
                    "position": 1,
                },
            ],
        },
    )

    assert response.status_code == 201

    task = response.json()
    assert [
        subtask["title"]
        for subtask in task["subtasks"]
    ] == [
        "Design empty state",
        "Write copy",
    ]
    assert [
        subtask["position"]
        for subtask in task["subtasks"]
    ] == [0, 1]
    assert task["subtasks"][0]["is_completed"] is False
    assert task["subtasks"][1]["is_completed"] is True
    assert task["subtask_progress"] == {
        "completed": 1,
        "total": 2,
        "percent": 50,
    }


def test_update_task_replaces_and_clears_subtasks(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    create_response = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "Refine recommendation model",
            "subtasks": [
                {"title": "Audit signals"},
                {"title": "Tune score weights"},
            ],
        },
    )
    assert create_response.status_code == 201
    task = create_response.json()

    update_response = client.patch(
        f"/tasks/{task['id']}",
        headers=auth_headers,
        json={
            "subtasks": [
                {
                    "title": "Document final weights",
                    "is_completed": True,
                }
            ],
        },
    )

    assert update_response.status_code == 200
    updated_task = update_response.json()
    assert len(updated_task["subtasks"]) == 1
    assert updated_task["subtasks"][0]["title"] == "Document final weights"
    assert updated_task["subtasks"][0]["position"] == 0
    assert updated_task["subtask_progress"] == {
        "completed": 1,
        "total": 1,
        "percent": 100,
    }

    clear_response = client.patch(
        f"/tasks/{task['id']}",
        headers=auth_headers,
        json={"subtasks": []},
    )

    assert clear_response.status_code == 200
    assert clear_response.json()["subtasks"] == []
    assert clear_response.json()["subtask_progress"] == {
        "completed": 0,
        "total": 0,
        "percent": None,
    }


@pytest.mark.parametrize(
    "duration",
    [None, 5, 10, 15, 30, 60, 135],
)
def test_create_task_with_valid_estimated_duration_minutes(
    client: TestClient,
    auth_headers: dict[str, str],
    duration: int | None,
) -> None:
    payload = {"title": f"Duration {duration}"}
    if duration is not None:
        payload["estimated_duration_minutes"] = duration

    response = client.post(
        "/tasks",
        headers=auth_headers,
        json=payload,
    )

    assert response.status_code == 201
    task = response.json()
    assert task["estimated_duration_minutes"] == duration
    assert "estimated_duration" not in task


def test_create_task_accepts_explicit_null_estimated_duration_minutes(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "No estimate",
            "estimated_duration_minutes": None,
        },
    )

    assert response.status_code == 201
    assert response.json()["estimated_duration_minutes"] is None


@pytest.mark.parametrize("duration", [0, -1, 3.5])
def test_reject_invalid_estimated_duration_minutes(
    client: TestClient,
    auth_headers: dict[str, str],
    duration: float,
) -> None:
    response = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "Invalid estimate",
            "estimated_duration_minutes": duration,
        },
    )

    assert response.status_code == 422


def test_update_and_clear_estimated_duration_minutes(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    task = create_task(client, auth_headers, "Change estimate")

    update_response = client.patch(
        f"/tasks/{task['id']}",
        headers=auth_headers,
        json={"estimated_duration_minutes": 45},
    )

    assert update_response.status_code == 200
    assert update_response.json()["estimated_duration_minutes"] == 45

    clear_response = client.patch(
        f"/tasks/{task['id']}",
        headers=auth_headers,
        json={"estimated_duration_minutes": None},
    )

    assert clear_response.status_code == 200
    assert clear_response.json()["estimated_duration_minutes"] is None


def test_past_due_task_is_returned_as_overdue(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "Late task",
            "due_date": "2020-01-01T00:00:00Z",
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "overdue"


def test_done_task_is_not_returned_as_overdue(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    task = create_task(client, auth_headers, "Completed late task")

    response = client.patch(
        f"/tasks/{task['id']}",
        headers=auth_headers,
        json={
            "status": "done",
            "due_date": "2020-01-01T00:00:00Z",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "done"
    assert response.json()["completed_at"] is not None


def test_completed_at_is_set_and_cleared_with_done_status(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    task = create_task(client, auth_headers, "Completion timestamp")
    assert task["completed_at"] is None

    done_response = client.patch(
        f"/tasks/{task['id']}",
        headers=auth_headers,
        json={"status": "done"},
    )

    assert done_response.status_code == 200
    completed_at = done_response.json()["completed_at"]
    assert completed_at is not None

    noop_done_response = client.patch(
        f"/tasks/{task['id']}",
        headers=auth_headers,
        json={"description": "Edited after completion"},
    )

    assert noop_done_response.status_code == 200
    assert noop_done_response.json()["completed_at"] == completed_at

    reopen_response = client.patch(
        f"/tasks/{task['id']}",
        headers=auth_headers,
        json={"status": "pending"},
    )

    assert reopen_response.status_code == 200
    assert reopen_response.json()["completed_at"] is None


def test_reject_invalid_schedule_on_create(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "Invalid schedule",
            "scheduled_start": "2030-08-10T10:00:00Z",
            "scheduled_end": "2030-08-10T09:00:00Z",
        },
    )

    assert response.status_code == 422


def test_reject_invalid_schedule_when_patching_one_time(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "Scheduled task",
            "scheduled_start": "2030-08-10T09:00:00Z",
            "scheduled_end": "2030-08-10T10:00:00Z",
        },
    )

    assert response.status_code == 201
    task = response.json()

    patch_response = client.patch(
        f"/tasks/{task['id']}",
        headers=auth_headers,
        json={
            "scheduled_start": "2030-08-10T11:00:00Z",
        },
    )

    assert patch_response.status_code == 422
    assert (
        patch_response.json()["detail"]
        == "scheduled_end must be later than scheduled_start"
    )


def test_cannot_set_overdue_status_directly(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    task = create_task(client, auth_headers, "Status test")

    response = client.patch(
        f"/tasks/{task['id']}",
        headers=auth_headers,
        json={"status": "overdue"},
    )

    assert response.status_code == 422

def test_search_tasks_by_title_and_description(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    create_task(client, auth_headers, "Prepare database report")

    response = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "University work",
            "description": "Complete the FastAPI assignment",
        },
    )
    assert response.status_code == 201

    title_search = client.get(
        "/tasks",
        headers=auth_headers,
        params={"search": "DATABASE"},
    )
    assert title_search.status_code == 200

    title_data = title_search.json()
    assert title_data["total"] == 1
    assert title_data["items"][0]["title"] == "Prepare database report"

    description_search = client.get(
        "/tasks",
        headers=auth_headers,
        params={"search": "fastapi"},
    )
    assert description_search.status_code == 200

    description_data = description_search.json()
    assert description_data["total"] == 1
    assert description_data["items"][0]["title"] == "University work"


def test_filter_tasks_by_status(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    pending_task = create_task(
        client,
        auth_headers,
        "Pending task",
    )
    in_progress_task = create_task(
        client,
        auth_headers,
        "In-progress task",
    )
    done_task = create_task(
        client,
        auth_headers,
        "Done task",
    )

    in_progress_response = client.patch(
        f"/tasks/{in_progress_task['id']}",
        headers=auth_headers,
        json={"status": "in_progress"},
    )
    assert in_progress_response.status_code == 200

    done_response = client.patch(
        f"/tasks/{done_task['id']}",
        headers=auth_headers,
        json={"status": "done"},
    )
    assert done_response.status_code == 200

    response = client.get(
        "/tasks",
        headers=auth_headers,
        params={"status": "in_progress"},
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["id"] == in_progress_task["id"]
    assert data["items"][0]["status"] == "in_progress"

    assert pending_task["id"] != data["items"][0]["id"]
    assert done_task["id"] != data["items"][0]["id"]


def test_filter_overdue_tasks(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    overdue_response = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "Overdue assignment",
            "due_date": "2020-01-01T00:00:00Z",
        },
    )
    assert overdue_response.status_code == 201
    overdue_task = overdue_response.json()

    future_response = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "Future assignment",
            "due_date": "2030-01-01T00:00:00Z",
        },
    )
    assert future_response.status_code == 201

    response = client.get(
        "/tasks",
        headers=auth_headers,
        params={"status": "overdue"},
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["id"] == overdue_task["id"]
    assert data["items"][0]["status"] == "overdue"


def test_filter_tasks_by_priority(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    for title, priority in [
        ("Low-priority task", "low"),
        ("High-priority task", "high"),
        ("Medium-priority task", "medium"),
    ]:
        response = client.post(
            "/tasks",
            headers=auth_headers,
            json={
                "title": title,
                "priority": priority,
            },
        )
        assert response.status_code == 201

    response = client.get(
        "/tasks",
        headers=auth_headers,
        params={"priority": "high"},
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["title"] == "High-priority task"
    assert data["items"][0]["priority"] == "high"

def test_filter_tasks_by_due_date_range(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    for title, due_date in [
        ("Before range", "2026-06-30T12:00:00Z"),
        ("Inside range", "2026-07-15T12:00:00Z"),
        ("After range", "2026-08-01T12:00:00Z"),
    ]:
        response = client.post(
            "/tasks",
            headers=auth_headers,
            json={
                "title": title,
                "due_date": due_date,
            },
        )
        assert response.status_code == 201

    response = client.get(
        "/tasks",
        headers=auth_headers,
        params={
            "due_from": "2026-07-01T00:00:00Z",
            "due_to": "2026-07-31T23:59:59Z",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["title"] == "Inside range"


def test_sort_tasks_by_title(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    for title in ["Charlie", "Alpha", "Bravo"]:
        create_task(client, auth_headers, title)

    response = client.get(
        "/tasks",
        headers=auth_headers,
        params={
            "sort_by": "title",
            "sort_order": "asc",
        },
    )

    assert response.status_code == 200

    titles = [
        task["title"]
        for task in response.json()["items"]
    ]

    assert titles == ["Alpha", "Bravo", "Charlie"]


def test_sort_tasks_by_due_date_with_null_last(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    for title, due_date in [
        ("Later task", "2026-07-20T00:00:00Z"),
        ("No due date", None),
        ("Earlier task", "2026-07-10T00:00:00Z"),
    ]:
        payload = {"title": title}

        if due_date is not None:
            payload["due_date"] = due_date

        response = client.post(
            "/tasks",
            headers=auth_headers,
            json=payload,
        )
        assert response.status_code == 201

    response = client.get(
        "/tasks",
        headers=auth_headers,
        params={
            "sort_by": "due_date",
            "sort_order": "asc",
        },
    )

    assert response.status_code == 200

    titles = [
        task["title"]
        for task in response.json()["items"]
    ]

    assert titles == [
        "Earlier task",
        "Later task",
        "No due date",
    ]


def test_sort_tasks_by_priority(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    for title, priority in [
        ("No-priority task", "no_priority"),
        ("Low-priority task", "low"),
        ("High-priority task", "high"),
        ("Medium-priority task", "medium"),
    ]:
        response = client.post(
            "/tasks",
            headers=auth_headers,
            json={
                "title": title,
                "priority": priority,
            },
        )
        assert response.status_code == 201

    response = client.get(
        "/tasks",
        headers=auth_headers,
        params={
            "sort_by": "priority",
            "sort_order": "asc",
        },
    )

    assert response.status_code == 200

    priorities = [
        task["priority"]
        for task in response.json()["items"]
    ]

    assert priorities == [
        "high",
        "medium",
        "low",
        "no_priority",
    ]


def test_paginate_tasks(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    for number in range(1, 6):
        create_task(
            client,
            auth_headers,
            f"Task {number}",
        )

    first_response = client.get(
        "/tasks",
        headers=auth_headers,
        params={
            "sort_by": "title",
            "sort_order": "asc",
            "page": 1,
            "page_size": 2,
        },
    )
    second_response = client.get(
        "/tasks",
        headers=auth_headers,
        params={
            "sort_by": "title",
            "sort_order": "asc",
            "page": 2,
            "page_size": 2,
        },
    )
    third_response = client.get(
        "/tasks",
        headers=auth_headers,
        params={
            "sort_by": "title",
            "sort_order": "asc",
            "page": 3,
            "page_size": 2,
        },
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert third_response.status_code == 200

    first_page = first_response.json()
    second_page = second_response.json()
    third_page = third_response.json()

    assert first_page["page"] == 1
    assert first_page["page_size"] == 2
    assert first_page["total"] == 5
    assert first_page["total_pages"] == 3

    assert [
        task["title"]
        for task in first_page["items"]
    ] == ["Task 1", "Task 2"]

    assert [
        task["title"]
        for task in second_page["items"]
    ] == ["Task 3", "Task 4"]

    assert [
        task["title"]
        for task in third_page["items"]
    ] == ["Task 5"]


def test_reject_invalid_task_list_parameters(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    invalid_parameters = [
        {"page": 0},
        {"page_size": 0},
        {"page_size": 101},
        {"status": "invalid"},
        {"priority": "invalid"},
        {"sort_by": "invalid"},
        {"sort_order": "invalid"},
        {"search": ""},
        {"due_from": "not-a-datetime"},
    ]

    for parameters in invalid_parameters:
        response = client.get(
            "/tasks",
            headers=auth_headers,
            params=parameters,
        )

        assert response.status_code == 422, parameters


def test_reject_reversed_due_date_range(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.get(
        "/tasks",
        headers=auth_headers,
        params={
            "due_from": "2026-07-31T00:00:00Z",
            "due_to": "2026-07-01T00:00:00Z",
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == (
        "due_to must be later than or equal to due_from"
    )

def test_get_task_by_id_returns_workflow_status(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    task = create_task(client, auth_headers, "Readable task")

    response = client.get(
        f"/tasks/{task['id']}",
        headers=auth_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == task["id"]
    assert body["workflow_status"] == "pending"
    assert body["status"] in {"pending", "overdue"}


def test_duplicate_task_copies_fields_and_resets_status(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    project = create_project(client, auth_headers, "Dup Project")
    original = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "Original task",
            "description": "Keep me",
            "project_id": project["id"],
            "priority": "high",
            "subtasks": [{"title": "Step 1", "is_completed": True}],
        },
    ).json()

    client.patch(
        f"/tasks/{original['id']}",
        headers=auth_headers,
        json={"status": "in_progress"},
    )

    response = client.post(
        f"/tasks/{original['id']}/duplicate",
        headers=auth_headers,
        json={},
    )

    assert response.status_code == 201
    duplicated = response.json()
    assert duplicated["id"] != original["id"]
    assert duplicated["title"] == "Original task (Copy)"
    assert duplicated["description"] == "Keep me"
    assert duplicated["project_id"] == project["id"]
    assert duplicated["priority"] == "high"
    assert duplicated["workflow_status"] == "pending"
    assert len(duplicated["subtasks"]) == 1
    assert duplicated["subtasks"][0]["is_completed"] is False


def test_reschedule_task_updates_due_date(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    task = create_task(client, auth_headers, "Reschedule me")

    response = client.post(
        f"/tasks/{task['id']}/reschedule",
        headers=auth_headers,
        json={"due_date": "2026-12-01T09:00:00Z"},
    )

    assert response.status_code == 200
    assert response.json()["due_date"].startswith("2026-12-01T09:00:00")


def test_bulk_update_and_delete_tasks(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    project = create_project(client, auth_headers, "Bulk Project")
    first = create_task(client, auth_headers, "Bulk one")
    second = create_task(client, auth_headers, "Bulk two")

    update_response = client.post(
        "/tasks/bulk/update",
        headers=auth_headers,
        json={
            "task_ids": [first["id"], second["id"]],
            "status": "done",
            "project_id": project["id"],
        },
    )

    assert update_response.status_code == 200
    updated = update_response.json()["updated"]
    assert len(updated) == 2
    assert all(item["workflow_status"] == "done" for item in updated)
    assert all(item["project_id"] == project["id"] for item in updated)

    delete_response = client.post(
        "/tasks/bulk/delete",
        headers=auth_headers,
        json={"task_ids": [first["id"], second["id"]]},
    )

    assert delete_response.status_code == 200
    assert delete_response.json()["deleted_count"] == 2

    missing = client.get(f"/tasks/{first['id']}", headers=auth_headers)
    assert missing.status_code == 404


def test_pending_filter_excludes_overdue_tasks(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    overdue = client.post(
        "/tasks",
        headers=auth_headers,
        json={
            "title": "Already late",
            "due_date": "2020-01-01T00:00:00Z",
        },
    ).json()
    pending = create_task(client, auth_headers, "Still pending")

    response = client.get(
        "/tasks",
        headers=auth_headers,
        params={"status": "pending"},
    )

    assert response.status_code == 200
    ids = {item["id"] for item in response.json()["items"]}
    assert pending["id"] in ids
    assert overdue["id"] not in ids


def test_inbox_only_filter(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    project = create_project(client, auth_headers)
    create_task(client, auth_headers, "In project", project_id=project["id"])
    inbox = create_task(client, auth_headers, "Inbox task")

    response = client.get(
        "/tasks",
        headers=auth_headers,
        params={"inbox_only": True},
    )

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == inbox["id"]
    assert items[0]["project_id"] is None

