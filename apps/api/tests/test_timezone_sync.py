"""Tests for automatic timezone sync via X-User-Timezone header."""

import pytest
from tests.conftest import TEST_USER_ID, create_test_goal

pytestmark = pytest.mark.asyncio


async def test_timezone_synced_from_header_on_profile(client):
    """GET /profile with X-User-Timezone header updates user timezone."""
    await create_test_goal(client)
    resp = await client.get(
        f"/users/{TEST_USER_ID}/profile",
        headers={"X-User-Timezone": "America/New_York"},
    )
    assert resp.status_code == 200

    settings = await client.get(f"/users/{TEST_USER_ID}/settings")
    assert settings.json()["timezone"] == "America/New_York"


async def test_timezone_synced_from_header_on_settings(client):
    """GET /settings with X-User-Timezone header updates user timezone."""
    await create_test_goal(client)
    resp = await client.get(
        f"/users/{TEST_USER_ID}/settings",
        headers={"X-User-Timezone": "Asia/Tokyo"},
    )
    assert resp.status_code == 200
    assert resp.json()["timezone"] == "Asia/Tokyo"


async def test_timezone_not_updated_when_same(client):
    """No DB write when header matches stored timezone (default UTC)."""
    await create_test_goal(client)
    resp = await client.get(
        f"/users/{TEST_USER_ID}/settings",
        headers={"X-User-Timezone": "UTC"},
    )
    assert resp.status_code == 200
    assert resp.json()["timezone"] == "UTC"


async def test_timezone_invalid_header_ignored(client):
    """Invalid timezone string in header is silently ignored."""
    await create_test_goal(client)
    resp = await client.get(
        f"/users/{TEST_USER_ID}/settings",
        headers={"X-User-Timezone": "Not/A/Timezone"},
    )
    assert resp.status_code == 200
    assert resp.json()["timezone"] == "UTC"


async def test_timezone_missing_header_no_change(client):
    """No header means no timezone update."""
    await create_test_goal(client)
    # First set a known timezone
    await client.get(
        f"/users/{TEST_USER_ID}/settings",
        headers={"X-User-Timezone": "Europe/Berlin"},
    )
    # Then request without header
    resp = await client.get(f"/users/{TEST_USER_ID}/settings")
    assert resp.status_code == 200
    assert resp.json()["timezone"] == "Europe/Berlin"


async def test_patch_settings_no_longer_accepts_timezone(client):
    """PATCH /settings should ignore timezone field (no longer user-settable)."""
    await create_test_goal(client)
    resp = await client.patch(
        f"/users/{TEST_USER_ID}/settings",
        json={"timezone": "Asia/Shanghai", "display_name": "Test"},
    )
    assert resp.status_code == 200
    # timezone should NOT have changed — still UTC default
    assert resp.json()["timezone"] == "UTC"
