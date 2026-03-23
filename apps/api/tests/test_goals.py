from main import app
from auth import get_current_user_id
from tests.conftest import TEST_USER_ID, OTHER_USER_ID, create_test_goal


async def test_create_goal(client):
    """POST returns 202 with placeholder; background task populates real data."""
    resp = await client.post(
        f"/users/{TEST_USER_ID}/goals",
        json={"raw_input": "I want to run a 5K race in under 25 minutes within 3 months"},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert data["status"] == "active"
    assert data["user_id"] == TEST_USER_ID
    # Phase 1 placeholder values
    assert data["smart_title"] == "I want to run a 5K race in under 25 minutes within 3 months"
    assert len(data["milestones"]) == 1
    assert data["milestones"][0]["sprint_status"] == "generating"

    # After BackgroundTasks run, GET returns the fully-populated goal
    goal_id = data["id"]
    get_resp = await client.get(f"/goals/{goal_id}")
    assert get_resp.status_code == 200
    full_data = get_resp.json()
    assert full_data["smart_title"] == "Run 5K in under 25 minutes"
    assert len(full_data["milestones"]) == 3
    assert len(full_data["daily_tasks"]) == 7


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


async def test_list_goals_resets_stuck_generating_milestone_to_failed(client, engine):
    """
    A milestone stuck in 'generating' for >5 minutes is reset to 'failed'
    by the lazy eval in list_goals.
    """
    import uuid as _uuid
    from datetime import datetime, timedelta, timezone
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
    from sqlalchemy import update as sql_update
    from models import Milestone

    # Create a goal (will have a real active milestone from mock)
    goal = await create_test_goal(client)
    goal_id = goal["id"]
    milestone_id = goal["milestones"][0]["id"]

    # Directly force milestone into stuck 'generating' state with old timestamp
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        stale_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        await session.execute(
            sql_update(Milestone)
            .where(Milestone.id == _uuid.UUID(milestone_id))
            .values(sprint_status="generating", generation_started_at=stale_time)
        )
        await session.commit()

    # list_goals should lazily reset it to 'failed'
    resp = await client.get(f"/users/{TEST_USER_ID}/goals")
    assert resp.status_code == 200
    milestones = resp.json()["items"][0]["milestones"]
    stuck_ms = next(m for m in milestones if m["id"] == str(milestone_id))
    assert stuck_ms["sprint_status"] == "failed", (
        "Milestone stuck in 'generating' for >5 min should be reset to 'failed'"
    )


async def test_achieve_goal_concurrent_requests_award_points_once(client):
    """
    Achieving a goal twice awards +100 exactly once.
    Both requests return 200 (status update is idempotent), but the second skips the bonus
    because old_status is already 'achieved'.
    The .with_for_update() lock in update_goal_status enforces this in production (PostgreSQL).
    This test verifies the application-level idempotency guard.
    """
    goal = await create_test_goal(client)
    goal_id = goal["id"]

    pts_before = (await client.get(f"/users/{TEST_USER_ID}/profile")).json()["star_points"]

    resp1 = await client.patch(f"/goals/{goal_id}", json={"status": "achieved"})
    resp2 = await client.patch(f"/goals/{goal_id}", json={"status": "achieved"})

    assert resp1.status_code == 200
    assert resp2.status_code == 200

    pts_after = (await client.get(f"/users/{TEST_USER_ID}/profile")).json()["star_points"]
    assert pts_after == pts_before + 100, "Goal achievement bonus must be awarded exactly once"
