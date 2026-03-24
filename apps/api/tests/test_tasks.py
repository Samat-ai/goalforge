from auth import get_current_user_id
from main import app
from tests.conftest import OTHER_USER_ID, TEST_USER_ID, create_test_goal


async def test_complete_task_awards_points(client):
    goal = await create_test_goal(client)
    task_id = goal["daily_tasks"][0]["id"]

    pts_before = (await client.get(f"/users/{TEST_USER_ID}/profile")).json()["star_points"]

    resp = await client.patch(f"/tasks/{task_id}/complete")
    assert resp.status_code == 200
    assert resp.json()["is_completed"] is True

    pts_after = (await client.get(f"/users/{TEST_USER_ID}/profile")).json()["star_points"]
    assert pts_after == pts_before + 10


async def test_complete_already_completed_task_returns_400(client):
    goal = await create_test_goal(client)
    task_id = goal["daily_tasks"][0]["id"]

    await client.patch(f"/tasks/{task_id}/complete")

    resp = await client.patch(f"/tasks/{task_id}/complete")
    assert resp.status_code == 400
    assert "already completed" in resp.json()["detail"]


async def test_edit_pending_task(client):
    goal = await create_test_goal(client)
    task_id = goal["daily_tasks"][0]["id"]

    resp = await client.patch(f"/tasks/{task_id}", json={"description": "Updated description"})
    assert resp.status_code == 200
    assert resp.json()["description"] == "Updated description"


async def test_edit_completed_task_returns_400(client):
    goal = await create_test_goal(client)
    task_id = goal["daily_tasks"][0]["id"]

    await client.patch(f"/tasks/{task_id}/complete")

    resp = await client.patch(f"/tasks/{task_id}", json={"description": "Updated description"})
    assert resp.status_code == 400
    assert "completed" in resp.json()["detail"]


async def test_delete_pending_task(client):
    goal = await create_test_goal(client)
    task_id = goal["daily_tasks"][0]["id"]

    resp = await client.delete(f"/tasks/{task_id}")
    assert resp.status_code == 204


async def test_delete_completed_task_returns_400(client):
    goal = await create_test_goal(client)
    task_id = goal["daily_tasks"][0]["id"]

    await client.patch(f"/tasks/{task_id}/complete")

    resp = await client.delete(f"/tasks/{task_id}")
    assert resp.status_code == 400
    assert "completed" in resp.json()["detail"]


async def test_list_tasks_for_goal(client):
    goal = await create_test_goal(client)
    resp = await client.get(f"/goals/{goal['id']}/tasks")
    assert resp.status_code == 200
    assert len(resp.json()) == 7


# ---------------------------------------------------------------------------
# Custom task creation
# ---------------------------------------------------------------------------


async def test_create_custom_task(client):
    goal = await create_test_goal(client)
    goal_id = goal["id"]
    # The first milestone should be active (created with initial tasks)
    milestone_id = goal["milestones"][0]["id"]

    resp = await client.post(
        f"/goals/{goal_id}/tasks",
        json={"description": "My custom task", "milestone_id": milestone_id},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["description"] == "My custom task"
    assert data["milestone_id"] == milestone_id
    assert data["goal_id"] == goal_id
    assert data["is_completed"] is False
    assert data["position"] >= 0


async def test_create_custom_task_auto_position(client):
    goal = await create_test_goal(client)
    goal_id = goal["id"]

    resp1 = await client.post(
        f"/goals/{goal_id}/tasks",
        json={"description": "First custom task"},
    )
    assert resp1.status_code == 201
    pos1 = resp1.json()["position"]

    resp2 = await client.post(
        f"/goals/{goal_id}/tasks",
        json={"description": "Second custom task"},
    )
    assert resp2.status_code == 201
    pos2 = resp2.json()["position"]

    assert pos2 > pos1


async def test_create_custom_task_forbidden(client):
    goal = await create_test_goal(client)
    goal_id = goal["id"]

    app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
    try:
        resp = await client.post(
            f"/goals/{goal_id}/tasks",
            json={"description": "Intruder task"},
        )
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Task reordering
# ---------------------------------------------------------------------------


async def test_reorder_tasks(client):
    goal = await create_test_goal(client)
    goal_id = goal["id"]
    tasks = goal["daily_tasks"]

    # Reverse the first two tasks' positions
    reorder_body = {
        "tasks": [
            {"id": tasks[0]["id"], "position": 5},
            {"id": tasks[1]["id"], "position": 0},
        ]
    }
    resp = await client.put(f"/goals/{goal_id}/tasks/reorder", json=reorder_body)
    assert resp.status_code == 200
    data = resp.json()

    positions_by_id = {t["id"]: t["position"] for t in data}
    assert positions_by_id[tasks[0]["id"]] == 5
    assert positions_by_id[tasks[1]["id"]] == 0


async def test_reorder_tasks_wrong_goal(client):
    goal1 = await create_test_goal(client)
    goal2 = await create_test_goal(client)

    # Try to reorder goal1's tasks under goal2's endpoint
    task_from_goal1 = goal1["daily_tasks"][0]
    reorder_body = {
        "tasks": [
            {"id": task_from_goal1["id"], "position": 0},
        ]
    }
    resp = await client.put(f"/goals/{goal2['id']}/tasks/reorder", json=reorder_body)
    assert resp.status_code == 400
    assert "does not belong" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# Task regeneration
# ---------------------------------------------------------------------------


async def test_regenerate_task(client):
    goal = await create_test_goal(client)
    task = goal["daily_tasks"][0]
    original_desc = task["description"]

    resp = await client.post(f"/tasks/{task['id']}/regenerate")
    assert resp.status_code == 200
    data = resp.json()
    assert data["description"] == "Regenerated task"
    assert data["tip"] == "Fresh motivation"
    assert data["description"] != original_desc


async def test_regenerate_completed_task_returns_400(client):
    goal = await create_test_goal(client)
    task_id = goal["daily_tasks"][0]["id"]

    await client.patch(f"/tasks/{task_id}/complete")

    resp = await client.post(f"/tasks/{task_id}/regenerate")
    assert resp.status_code == 400
    assert "completed" in resp.json()["detail"]


async def test_complete_task_response_has_reward_drop_field(client):
    """TaskCompleteResponse always includes reward_drop (null for standard tier)."""
    goal = await create_test_goal(client)
    task_id = goal["daily_tasks"][0]["id"]

    resp = await client.patch(f"/tasks/{task_id}/complete")
    assert resp.status_code == 200
    data = resp.json()
    assert "reward_drop" in data          # field always present
    assert data["reward_drop"] is None    # standard tier → null
    assert data["is_completed"] is True


async def test_complete_task_concurrent_requests_award_points_once(client):
    """
    Completing the same task twice awards +10 exactly once.
    The first request marks the task complete; the second sees is_completed=True and returns 400.
    The .with_for_update() lock in complete_task enforces this in production (PostgreSQL).
    This test verifies the application-level idempotency guard.
    """
    goal = await create_test_goal(client)
    task_id = goal["daily_tasks"][0]["id"]

    pts_before = (await client.get(f"/users/{TEST_USER_ID}/profile")).json()["star_points"]

    resp1 = await client.patch(f"/tasks/{task_id}/complete")
    resp2 = await client.patch(f"/tasks/{task_id}/complete")

    assert resp1.status_code == 200
    assert resp2.status_code == 400

    pts_after = (await client.get(f"/users/{TEST_USER_ID}/profile")).json()["star_points"]
    assert pts_after == pts_before + 10, "Points must be awarded exactly once"
