"""Tests for POST /goals/{goal_id}/milestones/{milestone_id}/retry-generation."""

import uuid
from unittest.mock import AsyncMock, patch
from datetime import date, timedelta

from auth import get_current_user_id
from exceptions import AIGenerationError
from main import app
from services.goal_service import PLACEHOLDER_MILESTONE_TITLE
from schemas import AITaskOutput
from tests.conftest import OTHER_USER_ID, TEST_USER_ID, create_test_goal, utc_today


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sorted_milestones(goal: dict) -> list[dict]:
    return sorted(goal["milestones"], key=lambda m: m["position"])


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

async def test_retry_generation_happy_path(client):
    """Retry on active milestone (milestone 1) returns 200 with sprint_status active."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]
    milestone_id = _sorted_milestones(goal)[0]["id"]

    resp = await client.post(
        f"/goals/{goal_id}/milestones/{milestone_id}/retry-generation"
    )
    assert resp.status_code == 200

    data = resp.json()
    updated_ms = _sorted_milestones(data)
    assert updated_ms[0]["sprint_status"] == "active"


async def test_retry_generation_passes_difficulty_mode_to_ai(client):
    """Adaptive mode should be threaded into generate_sprint_tasks call."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]
    milestone_id = _sorted_milestones(goal)[0]["id"]

    start = utc_today()
    task_outputs = [
        AITaskOutput(
            description=f"Task {i + 1}",
            tip="Keep going",
            assigned_date=start + timedelta(days=i),
        )
        for i in range(7)
    ]

    with patch(
        "routes.milestones.generate_sprint_tasks",
        new=AsyncMock(return_value=task_outputs),
    ) as mock_generate:
        resp = await client.post(
            f"/goals/{goal_id}/milestones/{milestone_id}/retry-generation"
        )

    assert resp.status_code == 200
    called_kwargs = mock_generate.await_args.kwargs
    assert "difficulty_mode" in called_kwargs
    assert called_kwargs["difficulty_mode"] in ("lighter", "balanced", "stretch")


async def test_retry_generation_deletes_existing_tasks(client):
    """Existing tasks for the milestone are removed and replaced by the 7 mock tasks."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]
    milestones = _sorted_milestones(goal)
    milestone_id = milestones[0]["id"]

    # Milestone 1 starts with 7 tasks (from the conftest mock)
    tasks_before = [t for t in goal["daily_tasks"] if t["milestone_id"] == milestone_id]
    assert len(tasks_before) == 7

    resp = await client.post(
        f"/goals/{goal_id}/milestones/{milestone_id}/retry-generation"
    )
    assert resp.status_code == 200

    data = resp.json()
    tasks_after = [t for t in data["daily_tasks"] if t["milestone_id"] == milestone_id]
    # Old tasks deleted + 7 new tasks created by the mock
    assert len(tasks_after) == 7
    # The new task descriptions come from the mock ("Sprint day N task")
    descriptions = {t["description"] for t in tasks_after}
    assert all("Sprint day" in d for d in descriptions)


# ---------------------------------------------------------------------------
# 400 — wrong status
# ---------------------------------------------------------------------------

async def test_retry_generation_400_pending_milestone(client):
    """Milestone 2 has sprint_status='pending'; retry must return 400."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]
    # Milestone at position 2 is pending
    milestone_id = _sorted_milestones(goal)[1]["id"]

    resp = await client.post(
        f"/goals/{goal_id}/milestones/{milestone_id}/retry-generation"
    )
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert "pending" in detail


async def test_retry_generation_400_completed_milestone(client):
    """Milestone that is is_completed=True returns 400."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]
    first_id = _sorted_milestones(goal)[0]["id"]

    # Complete milestone 1
    complete_resp = await client.post(
        f"/goals/{goal_id}/milestones/{first_id}/complete"
    )
    assert complete_resp.status_code == 200

    # Now retry-generation on the completed milestone
    resp = await client.post(
        f"/goals/{goal_id}/milestones/{first_id}/retry-generation"
    )
    assert resp.status_code == 400
    assert "completed" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# 403 — wrong user
# ---------------------------------------------------------------------------

async def test_retry_generation_403_wrong_user(client):
    """A different user attempting retry on another user's goal gets 403."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]
    milestone_id = _sorted_milestones(goal)[0]["id"]

    try:
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        resp = await client.post(
            f"/goals/{goal_id}/milestones/{milestone_id}/retry-generation"
        )
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 404 — unknown goal / milestone
# ---------------------------------------------------------------------------

async def test_retry_generation_404_unknown_goal(client):
    """Random goal UUID that doesn't exist returns 404."""
    fake_goal_id = str(uuid.uuid4())
    fake_milestone_id = str(uuid.uuid4())

    resp = await client.post(
        f"/goals/{fake_goal_id}/milestones/{fake_milestone_id}/retry-generation"
    )
    assert resp.status_code == 404


async def test_retry_generation_404_unknown_milestone(client):
    """Valid goal but non-existent milestone UUID returns 404."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]
    fake_milestone_id = str(uuid.uuid4())

    resp = await client.post(
        f"/goals/{goal_id}/milestones/{fake_milestone_id}/retry-generation"
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 502 — AI failure
# ---------------------------------------------------------------------------

async def test_retry_generation_502_on_ai_failure(client):
    """When generate_sprint_tasks raises AIGenerationError the endpoint returns 502."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]
    milestone_id = _sorted_milestones(goal)[0]["id"]

    with patch(
        "routes.milestones.generate_sprint_tasks",
        new=AsyncMock(side_effect=AIGenerationError("AI down")),
    ):
        resp = await client.post(
            f"/goals/{goal_id}/milestones/{milestone_id}/retry-generation"
        )

    assert resp.status_code == 502
    assert "AI down" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# Sentinel routing — initial goal creation failure
# ---------------------------------------------------------------------------

async def test_retry_generation_sentinel_routes_to_generate_goal_async(client, engine):
    """
    A milestone with the sentinel title (placeholder from Phase 1 goal creation)
    must route to _generate_goal_async, not generate_sprint_tasks.
    """
    from sqlalchemy import update as sql_update
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
    from models import Milestone

    goal = await create_test_goal(client)
    goal_id = goal["id"]
    milestone_id = _sorted_milestones(goal)[0]["id"]

    # Force the milestone into the sentinel / failed state
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        await session.execute(
            sql_update(Milestone)
            .where(Milestone.id == uuid.UUID(milestone_id))
            .values(
                title=PLACEHOLDER_MILESTONE_TITLE,
                sprint_status="failed",
                sprint_theme="",
            )
        )
        await session.commit()

    mock_generate_goal = AsyncMock()
    with patch("routes.milestones._generate_goal_async", new=mock_generate_goal):
        resp = await client.post(
            f"/goals/{goal_id}/milestones/{milestone_id}/retry-generation"
        )

    assert resp.status_code == 200
    mock_generate_goal.assert_called_once()

    # Milestone should be reset to "generating" while background task runs
    milestones = resp.json()["milestones"]
    sentinel_ms = next(m for m in milestones if m["id"] == milestone_id)
    assert sentinel_ms["sprint_status"] == "generating"


async def test_retry_generation_sentinel_does_not_call_generate_sprint_tasks(client, engine):
    """generate_sprint_tasks must NOT be called for sentinel milestones."""
    from sqlalchemy import update as sql_update
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
    from models import Milestone

    goal = await create_test_goal(client)
    goal_id = goal["id"]
    milestone_id = _sorted_milestones(goal)[0]["id"]

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        await session.execute(
            sql_update(Milestone)
            .where(Milestone.id == uuid.UUID(milestone_id))
            .values(
                title=PLACEHOLDER_MILESTONE_TITLE,
                sprint_status="failed",
                sprint_theme="",
            )
        )
        await session.commit()

    mock_sprint_tasks = AsyncMock()
    mock_generate_goal = AsyncMock()
    with (
        patch("routes.milestones.generate_sprint_tasks", new=mock_sprint_tasks),
        patch("routes.milestones._generate_goal_async", new=mock_generate_goal),
    ):
        resp = await client.post(
            f"/goals/{goal_id}/milestones/{milestone_id}/retry-generation"
        )

    assert resp.status_code == 200
    mock_sprint_tasks.assert_not_called()
