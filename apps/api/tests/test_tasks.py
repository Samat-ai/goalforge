from tests.conftest import TEST_USER_ID, create_test_goal


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
