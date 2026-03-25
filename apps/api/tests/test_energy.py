"""Integration tests for energy resize endpoints."""

import uuid
from datetime import date
from unittest.mock import AsyncMock, patch

import pytest

from models import DailyTask
from schemas import AITaskOutput
from tests.conftest import OTHER_USER_ID, TEST_USER_ID, create_test_goal

MOCK_RESIZE = AITaskOutput(
    description="Open your running app",
    tip="Just doing this is a win today.",
    assigned_date=date.today(),
)


async def test_schema_has_original_fields(client):
    """TaskResponse includes original_description and original_tip (both None by default)."""
    goal = await create_test_goal(client)
    task = goal["daily_tasks"][0]
    assert "original_description" in task
    assert task["original_description"] is None
    assert "original_tip" in task
    assert task["original_tip"] is None


async def test_energy_resize_bulk_mutates_tasks(client):
    """Resized tasks get micro-descriptions; original is preserved in original_description."""
    goal = await create_test_goal(client)
    today = goal["daily_tasks"][0]["assigned_date"]
    tasks_today = [t for t in goal["daily_tasks"] if t["assigned_date"] == today]
    assert tasks_today, "Need at least one task today"
    original_desc = tasks_today[0]["description"]

    with patch("routes.energy.resize_task_for_low_energy", new=AsyncMock(return_value=MOCK_RESIZE)):
        resp = await client.post(f"/users/{TEST_USER_ID}/energy-resize")

    assert resp.status_code == 200
    data = resp.json()
    assert data["tasks_resized"] == len(tasks_today)
    resized = [t for t in data["tasks"] if t["original_description"] is not None]
    assert len(resized) == data["tasks_resized"]
    assert resized[0]["description"] == "Open your running app"
    assert resized[0]["original_description"] == original_desc


async def test_energy_resize_idempotent(client):
    """Second call when all tasks already resized returns tasks_resized=0."""
    await create_test_goal(client)

    with patch("routes.energy.resize_task_for_low_energy", new=AsyncMock(return_value=MOCK_RESIZE)):
        await client.post(f"/users/{TEST_USER_ID}/energy-resize")
        resp = await client.post(f"/users/{TEST_USER_ID}/energy-resize")

    assert resp.status_code == 200
    assert resp.json()["tasks_resized"] == 0


async def test_energy_resize_forbidden_for_other_user(client):
    resp = await client.post(f"/users/{OTHER_USER_ID}/energy-resize")
    assert resp.status_code == 403


async def test_energy_resize_partial_gemini_failure(client):
    """Tasks where Gemini fails are skipped; others succeed."""
    goal = await create_test_goal(client)
    today = goal["daily_tasks"][0]["assigned_date"]
    tasks_today = [t for t in goal["daily_tasks"] if t["assigned_date"] == today]
    if len(tasks_today) < 2:
        pytest.skip("Need at least 2 tasks today for this test")

    call_count = 0

    async def mock_resize_partial(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise Exception("Simulated Gemini failure")
        return MOCK_RESIZE

    with patch("routes.energy.resize_task_for_low_energy", new=mock_resize_partial):
        resp = await client.post(f"/users/{TEST_USER_ID}/energy-resize")

    assert resp.status_code == 200
    data = resp.json()
    assert data["tasks_resized"] == len(tasks_today) - 1


async def test_energy_resize_all_gemini_failures(client):
    """If all Gemini calls fail, tasks_resized=0 and existing tasks returned unchanged."""
    goal = await create_test_goal(client)
    today = goal["daily_tasks"][0]["assigned_date"]
    tasks_today = [t for t in goal["daily_tasks"] if t["assigned_date"] == today]
    assert tasks_today

    with patch(
        "routes.energy.resize_task_for_low_energy",
        new=AsyncMock(side_effect=Exception("All Gemini calls failed")),
    ):
        resp = await client.post(f"/users/{TEST_USER_ID}/energy-resize")

    assert resp.status_code == 200
    data = resp.json()
    assert data["tasks_resized"] == 0
    # Tasks returned unchanged
    unchanged = [t for t in data["tasks"] if t["original_description"] is None]
    assert len(unchanged) == len(tasks_today)


async def test_energy_resize_caps_at_10(client, db_session):
    """When more than 10 pending tasks exist today, only 10 are resized (Gemini cap)."""
    goal = await create_test_goal(client)
    goal_id = goal["id"]
    today_str = goal["daily_tasks"][0]["assigned_date"]
    today = date.fromisoformat(today_str)

    # Add extra tasks so there are 12 total for today (7 already created by mock AI)
    existing_today = [t for t in goal["daily_tasks"] if t["assigned_date"] == today_str]
    extra_needed = 12 - len(existing_today)
    goal_uuid = uuid.UUID(goal_id)
    for _ in range(extra_needed):
        db_session.add(DailyTask(
            id=uuid.uuid4(),
            goal_id=goal_uuid,
            milestone_id=None,
            description="Extra task for cap test",
            tip="Keep going.",
            assigned_date=today,
            is_completed=False,
        ))
    await db_session.commit()

    mock_resize = AsyncMock(return_value=MOCK_RESIZE)
    with patch("routes.energy.resize_task_for_low_energy", new=mock_resize):
        resp = await client.post(f"/users/{TEST_USER_ID}/energy-resize")

    assert resp.status_code == 200
    data = resp.json()
    assert data["tasks_resized"] == 10
    assert mock_resize.call_count == 10
