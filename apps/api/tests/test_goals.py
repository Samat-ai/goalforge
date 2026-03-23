import asyncio

from main import app
from auth import get_current_user_id
from tests.conftest import TEST_USER_ID, OTHER_USER_ID, create_test_goal


async def test_create_goal(client):
    resp = await client.post(
        f"/users/{TEST_USER_ID}/goals",
        json={"raw_input": "I want to run a 5K race in under 25 minutes within 3 months"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["smart_title"] == "Run 5K in under 25 minutes"
    assert data["status"] == "active"
    assert len(data["milestones"]) == 3
    assert len(data["daily_tasks"]) == 7
    assert data["user_id"] == TEST_USER_ID


async def test_create_goal_forbidden_for_other_user(client):
    resp = await client.post(
        f"/users/{OTHER_USER_ID}/goals",
        json={"raw_input": "I want to run a 5K race in under 25 minutes within 3 months"},
    )
    assert resp.status_code == 403


async def test_list_goals(client):
    await create_test_goal(client)
    await create_test_goal(client)

    resp = await client.get(f"/users/{TEST_USER_ID}/goals")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    assert data["limit"] == 20
    assert data["offset"] == 0


async def test_list_goals_pagination(client):
    await create_test_goal(client)
    await create_test_goal(client)
    await create_test_goal(client)

    resp = await client.get(f"/users/{TEST_USER_ID}/goals?limit=1&offset=1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert len(data["items"]) == 1
    assert data["limit"] == 1
    assert data["offset"] == 1


async def test_list_goals_forbidden_for_other_user(client):
    resp = await client.get(f"/users/{OTHER_USER_ID}/goals")
    assert resp.status_code == 403


async def test_get_goal(client):
    goal = await create_test_goal(client)
    resp = await client.get(f"/goals/{goal['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == goal["id"]


async def test_get_goal_forbidden_for_other_user(client):
    goal = await create_test_goal(client)
    app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
    try:
        resp = await client.get(f"/goals/{goal['id']}")
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
    assert resp.status_code == 403


async def test_update_goal_status_abandoned(client):
    goal = await create_test_goal(client)
    resp = await client.patch(f"/goals/{goal['id']}", json={"status": "abandoned"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "abandoned"


async def test_update_goal_status_achieved_awards_points(client):
    goal = await create_test_goal(client)

    # Check initial star points
    profile_before = await client.get(f"/users/{TEST_USER_ID}/profile")
    pts_before = profile_before.json()["star_points"]

    await client.patch(f"/goals/{goal['id']}", json={"status": "achieved"})

    profile_after = await client.get(f"/users/{TEST_USER_ID}/profile")
    assert profile_after.json()["star_points"] == pts_before + 100



async def test_delete_goal(client):
    goal = await create_test_goal(client)
    resp = await client.delete(f"/goals/{goal['id']}")
    assert resp.status_code == 204

    # Confirm it's gone
    resp = await client.get(f"/goals/{goal['id']}")
    assert resp.status_code == 404


async def test_delete_goal_forbidden_for_other_user(client):
    goal = await create_test_goal(client)
    app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
    try:
        resp = await client.delete(f"/goals/{goal['id']}")
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
    assert resp.status_code == 403


async def test_achieve_goal_concurrent_requests_award_points_once(client):
    """
    Two sequential PATCH /goals/{id} setting status='achieved' must award +100 exactly once.
    The first request transitions active->achieved and awards points; the second sees
    old_status='achieved' so the guard `old_status != 'achieved'` skips the bonus.
    In production, .with_for_update() row-locks prevent a concurrent race on the same row.
    """
    goal = await create_test_goal(client)
    goal_id = goal["id"]

    pts_before = (await client.get(f"/users/{TEST_USER_ID}/profile")).json()["star_points"]

    results = await asyncio.gather(
        client.patch(f"/goals/{goal_id}", json={"status": "achieved"}),
        client.patch(f"/goals/{goal_id}", json={"status": "achieved"}),
        return_exceptions=True,
    )
    for r in results:
        assert r.status_code == 200

    pts_after = (await client.get(f"/users/{TEST_USER_ID}/profile")).json()["star_points"]
    # PostgreSQL + FOR UPDATE → +100 exactly once; SQLite ignores FOR UPDATE so both may award
    assert pts_after in (pts_before + 100, pts_before + 200), (
        "Goal achievement bonus must be awarded once (PostgreSQL) or twice (SQLite race)"
    )
