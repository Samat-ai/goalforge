"""Tests for users.py routes: GET/PATCH /users/{user_id}/settings."""

import pytest
from auth import get_current_user_id
from main import app
from tests.conftest import TEST_USER_ID, TEST_USER_EMAIL, OTHER_USER_ID, create_test_goal


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
    assert data["id"] == TEST_USER_ID
    assert data["email"] == TEST_USER_EMAIL


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


async def test_export_user_data_json(client):
    await create_test_goal(client)
    resp = await client.get(f"/users/{TEST_USER_ID}/export")
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["id"] == TEST_USER_ID
    assert isinstance(data["goals"], list)
    assert isinstance(data["rewards"], list)
    assert "exported_at" in data


async def test_export_user_data_csv(client):
    await create_test_goal(client)
    resp = await client.get(f"/users/{TEST_USER_ID}/export?format=csv")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=\"goalforge-export.csv\"" in resp.headers["content-disposition"]
    body = resp.text
    assert "section,key,value" in body
    assert "goals,goal_id,title,status,progress,target_date,created_at" in body


async def test_delete_user_data(client):
    goal = await create_test_goal(client)

    delete_resp = await client.delete(f"/users/{TEST_USER_ID}")
    assert delete_resp.status_code == 204

    settings_resp = await client.get(f"/users/{TEST_USER_ID}/settings")
    assert settings_resp.status_code == 404

    goal_resp = await client.get(f"/goals/{goal['id']}")
    assert goal_resp.status_code == 404
