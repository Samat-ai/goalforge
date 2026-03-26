"""Tests for users.py routes: GET/PATCH /users/{user_id}/settings, star-log."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from auth import get_current_user_id
from main import app
from tests.conftest import TEST_USER_ID, TEST_USER_EMAIL, OTHER_USER_ID, create_test_goal

MOCK_RECOMMENDATION = "Focus on completing your morning routine first thing — it anchors the rest of your day and builds momentum for harder tasks."

pytestmark = pytest.mark.asyncio


async def test_get_settings_returns_user_profile(client):
    await create_test_goal(client)
    resp = await client.get(f"/users/{TEST_USER_ID}/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert "email" in data
    assert "star_points" in data
    assert "timezone" in data
    assert "display_name" in data
    assert "reminder_enabled" in data
    assert "reminder_hour" in data
    assert data["id"] == TEST_USER_ID
    assert data["email"] == TEST_USER_EMAIL
    assert data["reminder_enabled"] is True
    assert data["reminder_hour"] == 9


async def test_get_settings_403_wrong_user(client):
    try:
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        resp = await client.get(f"/users/{TEST_USER_ID}/settings")
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
    assert resp.status_code == 403


async def test_get_settings_404_user_not_found(client):
    # Do NOT create a goal — user row does not exist yet
    resp = await client.get(f"/users/{TEST_USER_ID}/settings")
    assert resp.status_code == 404


async def test_patch_settings_updates_timezone(client):
    await create_test_goal(client)
    resp = await client.patch(
        f"/users/{TEST_USER_ID}/settings",
        json={"timezone": "America/New_York"},
    )
    assert resp.status_code == 200
    assert resp.json()["timezone"] == "America/New_York"


async def test_patch_settings_updates_display_name(client):
    await create_test_goal(client)
    resp = await client.patch(
        f"/users/{TEST_USER_ID}/settings",
        json={"display_name": "Alice"},
    )
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Alice"


async def test_patch_settings_partial_update(client):
    await create_test_goal(client)
    resp = await client.patch(
        f"/users/{TEST_USER_ID}/settings",
        json={"timezone": "Europe/London"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["timezone"] == "Europe/London"
    # display_name was never set, so it should still be None
    assert data["display_name"] is None


async def test_patch_settings_updates_reminder_preferences(client):
    await create_test_goal(client)
    resp = await client.patch(
        f"/users/{TEST_USER_ID}/settings",
        json={"reminder_enabled": False, "reminder_hour": 20},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["reminder_enabled"] is False
    assert data["reminder_hour"] == 20


async def test_patch_settings_403_wrong_user(client):
    try:
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        resp = await client.patch(
            f"/users/{TEST_USER_ID}/settings",
            json={"timezone": "UTC"},
        )
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
    assert resp.status_code == 403


async def test_patch_settings_404_user_not_found(client):
    # Do NOT create a goal — user row does not exist yet
    resp = await client.patch(
        f"/users/{TEST_USER_ID}/settings",
        json={"timezone": "UTC"},
    )
    assert resp.status_code == 404


@patch("routes.users.generate_weekly_coach_recommendation", new_callable=AsyncMock, return_value=MOCK_RECOMMENDATION)
async def test_create_weekly_reflection_returns_recommendation(mock_coach, client):
    await create_test_goal(client)
    resp = await client.post(
        f"/users/{TEST_USER_ID}/weekly-reflection",
        json={
            "went_well": "I completed tasks early in the morning.",
            "blockers": "Late-night scrolling reduced focus.",
            "week_rating": 4,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["user_id"] == TEST_USER_ID
    assert data["coach_recommendation"] == MOCK_RECOMMENDATION
    mock_coach.assert_called_once()


@patch("routes.users.generate_weekly_coach_recommendation", new_callable=AsyncMock, return_value=MOCK_RECOMMENDATION)
async def test_get_latest_weekly_reflection(mock_coach, client):
    await create_test_goal(client)
    create_resp = await client.post(
        f"/users/{TEST_USER_ID}/weekly-reflection",
        json={
            "went_well": "I kept momentum on weekdays.",
            "blockers": "Context switching slowed me down.",
            "week_rating": 3,
        },
    )
    assert create_resp.status_code == 201

    latest_resp = await client.get(f"/users/{TEST_USER_ID}/weekly-reflection/latest")
    assert latest_resp.status_code == 200
    latest = latest_resp.json()
    assert latest["id"] == create_resp.json()["id"]


async def test_weekly_reflection_403_wrong_user(client):
    await create_test_goal(client)
    try:
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        resp = await client.post(
            f"/users/{TEST_USER_ID}/weekly-reflection",
            json={
                "went_well": "I stayed consistent.",
                "blockers": "Meetings overloaded my day.",
                "week_rating": 3,
            },
        )
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
    assert resp.status_code == 403


async def test_get_weekly_review_returns_metrics(client):
    goal = await create_test_goal(client)
    task_id = goal["daily_tasks"][0]["id"]
    complete_resp = await client.patch(f"/tasks/{task_id}/complete")
    assert complete_resp.status_code == 200

    resp = await client.get(f"/users/{TEST_USER_ID}/weekly-review?days=7")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_tasks"] >= 1
    assert data["completed_tasks"] >= 1
    assert 0 <= data["completion_rate"] <= 1
    assert data["risk_level"] in ["low", "medium", "high"]
    assert isinstance(data["recommendation"], str)


async def test_get_weekly_review_no_data_window(client):
    await create_test_goal(client)
    resp = await client.get(f"/users/{TEST_USER_ID}/weekly-review?days=3")
    assert resp.status_code == 200
    data = resp.json()
    assert data["completed_tasks"] == 0
    assert data["risk_level"] in ["medium", "high"]


async def test_get_weekly_review_403_wrong_user(client):
    await create_test_goal(client)
    try:
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        resp = await client.get(f"/users/{TEST_USER_ID}/weekly-review")
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
    assert resp.status_code == 403


# ── Star Log ──────────────────────────────────────────────────────────


@patch(
    "routes.users.generate_star_log_narrative",
    new_callable=AsyncMock,
    return_value=SimpleNamespace(
        chapter_title="Week of Ignition",
        chapter_body="You showed up consistently and moved your goal forward.",
        highlights=["Started strong", "Kept daily rhythm"],
    ),
)
async def test_get_star_log_generates_and_persists(mock_ai, client):
    goal = await create_test_goal(client)
    task_id = goal["daily_tasks"][0]["id"]
    await client.patch(f"/tasks/{task_id}/complete")

    resp = await client.get(f"/users/{TEST_USER_ID}/star-log?days=7")
    assert resp.status_code == 200
    data = resp.json()
    assert data["chapter_title"] == "Week of Ignition"
    assert data["is_fallback"] is False
    assert data["completed_tasks"] >= 1
    assert "id" in data  # persisted — has a DB id
    mock_ai.assert_called_once()

    # Second call should return cached — no second AI call
    resp2 = await client.get(f"/users/{TEST_USER_ID}/star-log?days=7")
    assert resp2.status_code == 200
    assert resp2.json()["id"] == data["id"]
    mock_ai.assert_called_once()  # still only one call


async def test_get_star_log_fallback_no_completed_tasks(client):
    await create_test_goal(client)
    resp = await client.get(f"/users/{TEST_USER_ID}/star-log?days=3")
    assert resp.status_code == 200
    data = resp.json()
    assert data["chapter_title"] == "Quiet Orbit"
    assert data["is_fallback"] is True
    assert "id" in data  # persisted even for fallback


async def test_get_star_log_403_wrong_user(client):
    await create_test_goal(client)
    try:
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        resp = await client.get(f"/users/{TEST_USER_ID}/star-log")
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
    assert resp.status_code == 403


# ── Data Export & Deletion ────────────────────────────────────────────


async def test_export_user_data_json(client):
    await create_test_goal(client)
    resp = await client.get(f"/users/{TEST_USER_ID}/export")
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["id"] == TEST_USER_ID
    assert "exported_at" in data
    assert isinstance(data["goals"], list)
    assert isinstance(data["rewards"], list)
    assert isinstance(data["star_logs"], list)
    assert isinstance(data["weekly_reflections"], list)
    assert isinstance(data["shop_rewards"], list)
    assert isinstance(data["push_subscriptions"], list)


async def test_export_user_data_csv(client):
    await create_test_goal(client)
    resp = await client.get(f"/users/{TEST_USER_ID}/export?format=csv")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert 'attachment; filename="goalforge-export.csv"' in resp.headers["content-disposition"]
    body = resp.text
    assert "section,key,value" in body


async def test_export_user_data_403_wrong_user(client):
    await create_test_goal(client)
    try:
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        resp = await client.get(f"/users/{TEST_USER_ID}/export")
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
    assert resp.status_code == 403


async def test_delete_user_data(client):
    goal = await create_test_goal(client)

    delete_resp = await client.delete(f"/users/{TEST_USER_ID}")
    assert delete_resp.status_code == 204

    # Goal should be cascade-deleted
    goal_resp = await client.get(f"/goals/{goal['id']}")
    assert goal_resp.status_code == 404

    # Profile auto-recreates the user row (self-healing after deletion)
    profile_resp = await client.get(f"/users/{TEST_USER_ID}/profile")
    assert profile_resp.status_code == 200
    assert profile_resp.json()["star_points"] == 0  # fresh user


async def test_delete_user_data_403_wrong_user(client):
    await create_test_goal(client)
    try:
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        resp = await client.delete(f"/users/{TEST_USER_ID}")
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
    assert resp.status_code == 403
