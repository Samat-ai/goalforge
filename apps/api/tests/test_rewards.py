"""Integration tests for GET /users/{id}/rewards and PATCH /rewards/{id}/equip."""

import uuid

import pytest
from sqlalchemy import select

from auth import get_current_user_id
from main import app
from models import Reward
from tests.conftest import OTHER_USER_ID, TEST_USER_ID, create_test_goal


async def _seed_reward(db_session, user_id, reward_type, reward_key, is_equipped=False):
    r = Reward(
        id=uuid.uuid4(),
        user_id=user_id,
        reward_type=reward_type,
        reward_key=reward_key,
        is_equipped=is_equipped,
    )
    db_session.add(r)
    await db_session.flush()
    return r


async def test_list_rewards_empty_for_new_user(client):
    resp = await client.get(f"/users/{TEST_USER_ID}/rewards")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_rewards_returns_collected(client, db_session):
    await _seed_reward(db_session, TEST_USER_ID, "lore", "lore_speck")
    await _seed_reward(db_session, TEST_USER_ID, "title", "the_relentless", is_equipped=True)
    await db_session.commit()

    resp = await client.get(f"/users/{TEST_USER_ID}/rewards")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    keys = {r["reward_key"] for r in data}
    assert keys == {"lore_speck", "the_relentless"}
    # Equipped title should have is_equipped=True
    title = next(r for r in data if r["reward_key"] == "the_relentless")
    assert title["is_equipped"] is True
    assert title["display_name"] == "The Relentless"


async def test_list_rewards_403_for_wrong_user(client):
    resp = await client.get(f"/users/{OTHER_USER_ID}/rewards")
    assert resp.status_code == 403


async def test_equip_title_reward(client, db_session):
    r = await _seed_reward(db_session, TEST_USER_ID, "title", "the_relentless")
    await db_session.commit()

    resp = await client.patch(f"/rewards/{r.id}/equip")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_equipped"] is True
    assert data["reward_key"] == "the_relentless"


async def test_equip_swaps_previously_equipped(client, db_session):
    old_r = await _seed_reward(db_session, TEST_USER_ID, "title", "streak_survivor", is_equipped=True)
    new_r = await _seed_reward(db_session, TEST_USER_ID, "title", "the_relentless", is_equipped=False)
    await db_session.commit()

    resp = await client.patch(f"/rewards/{new_r.id}/equip")
    assert resp.status_code == 200

    # Verify old reward is now unequipped in DB
    old_row = (await db_session.execute(
        select(Reward).where(Reward.id == old_r.id)
    )).scalar_one()
    await db_session.refresh(old_row)
    assert old_row.is_equipped is False


async def test_equip_returns_404_for_unknown_reward(client):
    resp = await client.patch(f"/rewards/{uuid.uuid4()}/equip")
    assert resp.status_code == 404


async def test_equip_returns_403_for_wrong_user(client, db_session):
    # Seed reward for OTHER_USER
    r = await _seed_reward(db_session, OTHER_USER_ID, "title", "comeback_kid")
    await db_session.commit()

    resp = await client.patch(f"/rewards/{r.id}/equip")
    assert resp.status_code == 403
