import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.gamification.models import (
    GrowthStage,
    PlantStatus,
    UserGamificationProfile,
    UserPlant,
)
from app.gamification.rules import (
    FOCUS_SESSION_GP,
    MIN_VALID_FOCUS_MINUTES,
    TASK_COMPLETE_GP,
    stage_for_points,
)


def auth_headers(client: TestClient) -> tuple[dict[str, str], str]:
    email = f"forest-{uuid.uuid4()}@example.com"
    password = "TestPassword123"
    register = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "first_name": "Forest",
            "last_name": "Grower",
        },
    )
    assert register.status_code == 201
    login = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200
    return {
        "Authorization": f"Bearer {login.json()['access_token']}",
    }, register.json()["id"]


def select_oak(client: TestClient, headers: dict[str, str]) -> dict:
    response = client.post(
        "/gamification/plants/select",
        headers=headers,
        json={"species_id": "oak"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["needs_plant_selection"] is False
    assert body["current_plant"] is not None
    assert body["current_plant"]["species"]["id"] == "oak"
    assert body["current_plant"]["growth_stage"] == "seedling"
    return body


def test_stage_calculation_respects_species_maturity_threshold() -> None:
    assert stage_for_points(100, mature_at=110) == GrowthStage.GROWING.value
    assert stage_for_points(110, mature_at=110) == GrowthStage.MATURE.value


def test_select_plant_and_forest_state(client: TestClient) -> None:
    headers, _user_id = auth_headers(client)

    empty = client.get("/gamification/forest", headers=headers)
    assert empty.status_code == 200
    assert empty.json()["needs_plant_selection"] is True
    assert empty.json()["current_plant"] is None

    profile = select_oak(client, headers)
    plant_id = profile["current_plant"]["id"]

    forest = client.get("/gamification/forest", headers=headers)
    assert forest.status_code == 200
    payload = forest.json()
    assert payload["needs_plant_selection"] is False
    assert payload["current_plant"]["id"] == plant_id
    assert payload["current_plant"]["display_name"] == "Oak"

    conflict = client.post(
        "/gamification/plants/select",
        headers=headers,
        json={"species_id": "maple"},
    )
    assert conflict.status_code == 409


def test_task_completion_awards_gp_once(client: TestClient) -> None:
    headers, _user_id = auth_headers(client)
    select_oak(client, headers)

    create = client.post(
        "/tasks",
        headers=headers,
        json={"title": "Water the seedling", "priority": "medium"},
    )
    assert create.status_code == 201
    task_id = create.json()["id"]

    done = client.patch(
        f"/tasks/{task_id}",
        headers=headers,
        json={"status": "done"},
    )
    assert done.status_code == 200
    reward = done.json().get("growth_reward")
    assert reward is not None
    assert reward["awarded"] is True
    assert reward["growth_points"] >= TASK_COMPLETE_GP

    forest = client.get("/gamification/forest", headers=headers)
    assert forest.json()["current_plant"]["current_growth_points"] >= TASK_COMPLETE_GP
    assert forest.json()["unassigned_growth_points"] == 0

    again = client.patch(
        f"/tasks/{task_id}",
        headers=headers,
        json={"status": "done"},
    )
    assert again.status_code == 200
    second = again.json().get("growth_reward")
    assert second is None or second.get("awarded") is False


def test_task_rewards_are_stored_until_a_plant_is_selected(client: TestClient) -> None:
    headers, _user_id = auth_headers(client)

    create = client.post(
        "/tasks",
        headers=headers,
        json={"title": "Save growth for later", "priority": "medium"},
    )
    assert create.status_code == 201
    task_id = create.json()["id"]

    done = client.patch(
        f"/tasks/{task_id}",
        headers=headers,
        json={"status": "done"},
    )
    assert done.status_code == 200
    reward = done.json()["growth_reward"]
    earned_points = reward["growth_points"]
    assert earned_points >= TASK_COMPLETE_GP
    assert reward["stage_changed"] is False
    assert reward["plant_completed"] is False

    profile = client.get("/gamification/profile", headers=headers)
    assert profile.status_code == 200
    assert profile.json()["current_plant"] is None
    assert profile.json()["unassigned_growth_points"] == earned_points
    assert profile.json()["total_growth_points"] == earned_points

    repeated = client.patch(
        f"/tasks/{task_id}",
        headers=headers,
        json={"status": "done"},
    )
    assert repeated.status_code == 200
    after_repeat = client.get("/gamification/profile", headers=headers).json()
    assert after_repeat["unassigned_growth_points"] == earned_points

    selected = select_oak(client, headers)
    assert selected["unassigned_growth_points"] == 0
    assert selected["current_plant"]["current_growth_points"] == earned_points


def test_focus_session_awards_gp_and_short_session_does_not(
    client: TestClient,
) -> None:
    headers, _user_id = auth_headers(client)
    select_oak(client, headers)

    started = datetime.now(UTC) - timedelta(minutes=20)
    ended = datetime.now(UTC)
    valid = client.post(
        "/scheduling/focus-sessions",
        headers=headers,
        json={
            "started_at": started.isoformat(),
            "ended_at": ended.isoformat(),
            "duration_minutes": 20,
            "completed": True,
        },
    )
    assert valid.status_code == 201
    reward = valid.json().get("growth_reward")
    assert reward is not None
    assert reward["awarded"] is True
    assert reward["growth_points"] >= FOCUS_SESSION_GP

    short_started = datetime.now(UTC) - timedelta(minutes=2)
    short = client.post(
        "/scheduling/focus-sessions",
        headers=headers,
        json={
            "started_at": short_started.isoformat(),
            "ended_at": datetime.now(UTC).isoformat(),
            "duration_minutes": max(1, MIN_VALID_FOCUS_MINUTES - 1),
            "completed": True,
        },
    )
    assert short.status_code == 201
    short_reward = short.json().get("growth_reward")
    assert short_reward is None or short_reward.get("awarded") is False


def test_focus_reward_is_unassigned_without_an_active_plant(client: TestClient) -> None:
    headers, _user_id = auth_headers(client)
    started = datetime.now(UTC) - timedelta(minutes=20)

    response = client.post(
        "/scheduling/focus-sessions",
        headers=headers,
        json={
            "started_at": started.isoformat(),
            "ended_at": datetime.now(UTC).isoformat(),
            "duration_minutes": 20,
            "completed": True,
        },
    )
    assert response.status_code == 201
    reward = response.json()["growth_reward"]
    assert reward["awarded"] is True

    profile = client.get("/gamification/profile", headers=headers).json()
    assert profile["current_plant"] is None
    assert profile["unassigned_growth_points"] == reward["growth_points"]


def test_select_plant_transfers_all_points_and_calculates_final_stage(
    client: TestClient,
    db_session: Session,
) -> None:
    headers, user_id = auth_headers(client)
    initial = client.get("/gamification/profile", headers=headers)
    assert initial.status_code == 200

    profile = db_session.get(UserGamificationProfile, uuid.UUID(user_id))
    assert profile is not None
    profile.unassigned_growth_points = 125
    profile.total_growth_points = 125
    db_session.commit()

    selected = client.post(
        "/gamification/plants/select",
        headers=headers,
        json={"species_id": "oak"},
    )
    assert selected.status_code == 200, selected.text

    db_session.expire_all()
    updated_profile = db_session.get(UserGamificationProfile, uuid.UUID(user_id))
    assert updated_profile is not None
    assert updated_profile.unassigned_growth_points == 0
    assert updated_profile.total_growth_points == 125
    assert updated_profile.total_trees_grown == 1

    plant = db_session.query(UserPlant).filter(UserPlant.user_id == uuid.UUID(user_id)).one()
    assert plant.current_growth_points == 125
    assert plant.growth_stage == GrowthStage.MATURE.value
    assert plant.status == PlantStatus.COMPLETED.value
    assert plant.completed_at is not None

    forest = client.get("/gamification/forest", headers=headers).json()
    assert forest["unassigned_growth_points"] == 0
    assert len(forest["completed_plants"]) == 1
    assert forest["completed_plants"][0]["current_growth_points"] == 125


def test_rename_plant(client: TestClient) -> None:
    headers, _user_id = auth_headers(client)
    plant_id = select_oak(client, headers)["current_plant"]["id"]

    renamed = client.patch(
        f"/gamification/plants/{plant_id}",
        headers=headers,
        json={"custom_name": "  Sunny Oak  "},
    )
    assert renamed.status_code == 200
    assert renamed.json()["custom_name"] == "Sunny Oak"
    assert renamed.json()["display_name"] == "Sunny Oak"

    empty = client.patch(
        f"/gamification/plants/{plant_id}",
        headers=headers,
        json={"custom_name": "   "},
    )
    assert empty.status_code == 422


def test_place_seedling_and_preserve_through_maturity(
    client: TestClient, db_session: Session
) -> None:
    headers, _user_id = auth_headers(client)
    plant_id = select_oak(client, headers)["current_plant"]["id"]

    # Seed-to-forest: seedling can be planted immediately.
    scene_before = client.get("/gamification/forest/scene", headers=headers)
    assert scene_before.status_code == 200
    assert len(scene_before.json()["trees"]) == 1
    assert scene_before.json()["trees"][0]["growth_stage"] == "seedling"

    placed_seedling = client.patch(
        f"/gamification/forest/{plant_id}/position",
        headers=headers,
        json={
            "position_x": 2.0,
            "position_y": 0,
            "position_z": 1.5,
            "rotation_x": 0.05,
            "rotation_y": 0.8,
        },
    )
    assert placed_seedling.status_code == 200, placed_seedling.text
    seedling_body = placed_seedling.json()
    assert seedling_body["is_placed_in_forest"] is True
    assert seedling_body["growth_stage"] == "seedling"
    assert seedling_body["position"]["x"] == 2.0
    assert seedling_body["position"]["rotation_y"] == 0.8
    assert seedling_body["position"]["rotation_x"] == 0.05

    plant = db_session.get(UserPlant, uuid.UUID(plant_id))
    assert plant is not None
    plant.current_growth_points = 100
    plant.growth_stage = GrowthStage.MATURE.value
    plant.status = PlantStatus.COMPLETED.value
    plant.completed_at = datetime.now(UTC)
    db_session.commit()

    scene = client.get("/gamification/forest/scene", headers=headers)
    assert scene.status_code == 200
    assert len(scene.json()["trees"]) == 1
    # Placement identity survives maturity.
    assert scene.json()["trees"][0]["is_placed_in_forest"] is True
    assert scene.json()["trees"][0]["position"]["x"] == 2.0

    moved = client.patch(
        f"/gamification/forest/{plant_id}/position",
        headers=headers,
        json={
            "position_x": 4.5,
            "position_y": 0,
            "position_z": -3.0,
            "rotation_y": 0.5,
        },
    )
    assert moved.status_code == 200, moved.text
    body = moved.json()
    assert body["is_placed_in_forest"] is True
    assert body["position"]["x"] == 4.5
    assert body["position"]["z"] == -3.0


def test_rename_forest(client: TestClient) -> None:
    headers, _user_id = auth_headers(client)
    select_oak(client, headers)

    scene = client.get("/gamification/forest/scene", headers=headers)
    assert scene.status_code == 200
    assert scene.json()["forest_name"] == "Your Personal Forest"

    renamed = client.patch(
        "/gamification/forest",
        headers=headers,
        json={"forest_name": "  Quiet Grove  "},
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["forest_name"] == "Quiet Grove"

    forest = client.get("/gamification/forest", headers=headers)
    assert forest.status_code == 200
    assert forest.json()["forest_name"] == "Quiet Grove"

    empty = client.patch(
        "/gamification/forest",
        headers=headers,
        json={"forest_name": "   "},
    )
    assert empty.status_code == 422


def test_achievements_endpoint(client: TestClient) -> None:
    headers, _user_id = auth_headers(client)
    select_oak(client, headers)

    create = client.post(
        "/tasks",
        headers=headers,
        json={"title": "Unlock starter achievement", "priority": "low"},
    )
    assert create.status_code == 201
    client.patch(
        f"/tasks/{create.json()['id']}",
        headers=headers,
        json={"status": "done"},
    )

    response = client.get("/gamification/achievements", headers=headers)
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["achievements"]) > 0
    assert len(payload["categories"]) > 0
    starter = next(
        item for item in payload["achievements"] if item["id"] == "getting_started"
    )
    assert starter["unlocked"] is True
    assert "category" in starter


def test_dashboard_includes_forest_widget(client: TestClient) -> None:
    headers, _user_id = auth_headers(client)
    plant_id = select_oak(client, headers)["current_plant"]["id"]

    renamed = client.patch(
        f"/gamification/plants/{plant_id}",
        headers=headers,
        json={"custom_name": "Dashboard Oak"},
    )
    assert renamed.status_code == 200

    dashboard = client.get("/dashboard/summary", headers=headers)
    assert dashboard.status_code == 200
    forest_widget = dashboard.json().get("forest")
    assert forest_widget is not None
    assert forest_widget["display_name"] == "Dashboard Oak"
    assert forest_widget["needs_plant_selection"] is False
    assert forest_widget["growth_stage"] == "seedling"
