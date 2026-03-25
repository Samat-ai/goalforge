"""Tests for star shop reward endpoints."""

import pytest

from auth import get_current_user_id
from main import app
from tests.conftest import OTHER_USER_ID, TEST_USER_ID, create_test_goal

pytestmark = pytest.mark.asyncio


async def test_create_and_list_shop_rewards(client):
    await create_test_goal(client)

    create_resp = await client.post(
        f"/users/{TEST_USER_ID}/shop-rewards",
        json={"title": "Coffee Break", "cost": 20},
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["title"] == "Coffee Break"
    assert created["cost"] == 20
    assert created["redemption_count"] == 0
    assert created["is_active"] is True

    list_resp = await client.get(f"/users/{TEST_USER_ID}/shop-rewards")
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) == 1
    assert items[0]["id"] == created["id"]


async def test_update_shop_reward(client):
    await create_test_goal(client)
    create_resp = await client.post(
        f"/users/{TEST_USER_ID}/shop-rewards",
        json={"title": "Coffee", "cost": 10},
    )
    reward_id = create_resp.json()["id"]

    update_resp = await client.patch(
        f"/shop-rewards/{reward_id}",
        json={"title": "Fancy Coffee", "cost": 15},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "Fancy Coffee"
    assert update_resp.json()["cost"] == 15


async def test_delete_shop_reward(client):
    await create_test_goal(client)
    create_resp = await client.post(
        f"/users/{TEST_USER_ID}/shop-rewards",
        json={"title": "Nap Time", "cost": 30},
    )
    reward_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/shop-rewards/{reward_id}")
    assert del_resp.status_code == 204

    list_resp = await client.get(f"/users/{TEST_USER_ID}/shop-rewards")
    assert len(list_resp.json()) == 0


async def test_redeem_shop_reward_deducts_points_and_increments_count(client):
    goal = await create_test_goal(client)
    first_task_id = goal["daily_tasks"][0]["id"]
    complete_resp = await client.patch(f"/tasks/{first_task_id}/complete")
    assert complete_resp.status_code == 200

    create_resp = await client.post(
        f"/users/{TEST_USER_ID}/shop-rewards",
        json={"title": "Watch Episode", "cost": 10},
    )
    reward_id = create_resp.json()["id"]

    redeem_resp = await client.post(f"/shop-rewards/{reward_id}/redeem")
    assert redeem_resp.status_code == 200
    data = redeem_resp.json()
    assert data["remaining_star_points"] == 0
    assert data["reward"]["redemption_count"] == 1


async def test_redeem_shop_reward_insufficient_points_returns_400(client):
    await create_test_goal(client)

    create_resp = await client.post(
        f"/users/{TEST_USER_ID}/shop-rewards",
        json={"title": "Weekend Trip", "cost": 200},
    )
    reward_id = create_resp.json()["id"]

    redeem_resp = await client.post(f"/shop-rewards/{reward_id}/redeem")
    assert redeem_resp.status_code == 400
    assert "Not enough star points" in redeem_resp.json()["detail"]


async def test_redeem_inactive_reward_returns_400(client):
    await create_test_goal(client)
    create_resp = await client.post(
        f"/users/{TEST_USER_ID}/shop-rewards",
        json={"title": "Deactivated", "cost": 5},
    )
    reward_id = create_resp.json()["id"]

    # Deactivate the reward
    await client.patch(f"/shop-rewards/{reward_id}", json={"is_active": False})

    redeem_resp = await client.post(f"/shop-rewards/{reward_id}/redeem")
    assert redeem_resp.status_code == 400
    assert "inactive" in redeem_resp.json()["detail"]


async def test_shop_reward_endpoints_forbid_wrong_user(client):
    await create_test_goal(client)
    create_resp = await client.post(
        f"/users/{TEST_USER_ID}/shop-rewards",
        json={"title": "Coffee", "cost": 10},
    )
    reward_id = create_resp.json()["id"]

    try:
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        list_resp = await client.get(f"/users/{TEST_USER_ID}/shop-rewards")
        update_resp = await client.patch(
            f"/shop-rewards/{reward_id}",
            json={"title": "Tea"},
        )
        delete_resp = await client.delete(f"/shop-rewards/{reward_id}")
        redeem_resp = await client.post(f"/shop-rewards/{reward_id}/redeem")
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID

    assert list_resp.status_code == 403
    assert update_resp.status_code == 403
    assert delete_resp.status_code == 403
    assert redeem_resp.status_code == 403
