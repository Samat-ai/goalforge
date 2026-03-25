"""Tests for accountability partner endpoints."""

import uuid

import pytest

from auth import get_current_user_id
from main import app
from models import User
from tests.conftest import OTHER_USER_ID, TEST_USER_EMAIL, TEST_USER_ID, create_test_goal

pytestmark = pytest.mark.asyncio


async def _create_partner_user(db_session):
    partner_id = f"user_partner_{uuid.uuid4().hex[:8]}"
    partner_email = f"partner_{uuid.uuid4().hex[:6]}@example.com"
    db_session.add(User(id=partner_id, email=partner_email, timezone="UTC", display_name="Partner"))
    await db_session.commit()
    return partner_id, partner_email


async def test_invite_and_list_partners(client, db_session):
    await create_test_goal(client)
    _, partner_email = await _create_partner_user(db_session)

    invite_resp = await client.post(
        f"/users/{TEST_USER_ID}/partners/invite",
        json={"partner_email": partner_email},
    )
    assert invite_resp.status_code == 201
    invited = invite_resp.json()
    assert invited["status"] == "pending"

    list_resp = await client.get(f"/users/{TEST_USER_ID}/partners")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1


async def test_accept_partner_invite(client, other_client, db_session):
    await create_test_goal(client)
    partner_id, partner_email = await _create_partner_user(db_session)

    invite_resp = await client.post(
        f"/users/{TEST_USER_ID}/partners/invite",
        json={"partner_email": partner_email},
    )
    assert invite_resp.status_code == 201
    link_id = invite_resp.json()["id"]

    try:
        app.dependency_overrides[get_current_user_id] = lambda: partner_id
        accept_resp = await other_client.post(f"/partners/{link_id}/accept")
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID

    assert accept_resp.status_code == 200
    assert accept_resp.json()["status"] == "accepted"


async def test_invite_partner_wrong_user_forbidden(client):
    await create_test_goal(client)
    try:
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        resp = await client.post(
            f"/users/{TEST_USER_ID}/partners/invite",
            json={"partner_email": TEST_USER_EMAIL},
        )
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID

    assert resp.status_code == 403
