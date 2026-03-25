"""Tests for web push subscription endpoints."""

import pytest

from auth import get_current_user_id
from main import app
from tests.conftest import OTHER_USER_ID, TEST_USER_ID, create_test_goal

pytestmark = pytest.mark.asyncio


async def test_create_and_list_push_subscriptions(client):
    await create_test_goal(client)

    create_resp = await client.post(
        f"/users/{TEST_USER_ID}/push-subscriptions",
        json={
            "endpoint": "https://push.example/sub/123",
            "keys": {"p256dh": "abcde12345fghij67890", "auth": "auth12345"},
        },
    )
    assert create_resp.status_code == 201

    list_resp = await client.get(f"/users/{TEST_USER_ID}/push-subscriptions")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1


async def test_push_subscriptions_forbidden_wrong_user(client):
    await create_test_goal(client)
    try:
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        resp = await client.get(f"/users/{TEST_USER_ID}/push-subscriptions")
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID

    assert resp.status_code == 403
