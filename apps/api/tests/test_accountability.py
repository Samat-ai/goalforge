"""Tests for secure accountability invite endpoints."""

import pytest
from sqlalchemy import select

from auth import get_current_user_id
from config import settings
from main import app
from models import AccountabilityInvite, User
from rate_limiting import limiter, rate_limit_enabled
from tests.conftest import OTHER_USER_ID, TEST_USER_EMAIL, TEST_USER_ID

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def reset_rate_limiter_storage():
    if rate_limit_enabled and limiter is not None and hasattr(limiter, "_storage"):
        limiter._storage.reset()


async def _ensure_test_user(client):
    resp = await client.get(f"/users/{TEST_USER_ID}/profile")
    assert resp.status_code == 200


async def test_send_invite_is_enumeration_safe_for_missing_email(client):
    await _ensure_test_user(client)

    resp = await client.post(
        f"/users/{TEST_USER_ID}/accountability-invites",
        json={"email": "missing-user@example.com"},
    )

    assert resp.status_code == 200
    assert resp.json() == {"message": "Invite sent or pending"}


async def test_send_invite_is_enumeration_safe_for_existing_email(client, db_session):
    await _ensure_test_user(client)
    db_session.add(User(id=OTHER_USER_ID, email="other@example.com"))
    await db_session.flush()

    resp = await client.post(
        f"/users/{TEST_USER_ID}/accountability-invites",
        json={"email": "other@example.com"},
    )

    assert resp.status_code == 200
    assert resp.json() == {"message": "Invite sent or pending"}


async def test_send_invite_deduplicates_pending_requests(client, db_session):
    await _ensure_test_user(client)
    db_session.add(User(id=OTHER_USER_ID, email="other@example.com"))
    await db_session.flush()

    first = await client.post(
        f"/users/{TEST_USER_ID}/accountability-invites",
        json={"email": "other@example.com"},
    )
    second = await client.post(
        f"/users/{TEST_USER_ID}/accountability-invites",
        json={"email": "other@example.com"},
    )

    assert first.status_code == 200
    assert second.status_code == 200

    invites = (
        await db_session.execute(
            select(AccountabilityInvite).where(
                AccountabilityInvite.inviter_user_id == TEST_USER_ID,
                AccountabilityInvite.target_email == "other@example.com",
                AccountabilityInvite.status == "pending",
            )
        )
    ).scalars().all()
    assert len(invites) == 1


async def test_send_invite_rate_limited_5_per_minute(client):
    await _ensure_test_user(client)

    if not settings.rate_limit_enabled:
        pytest.skip("Rate limiting disabled in this test environment")

    statuses = []
    for idx in range(6):
        resp = await client.post(
            f"/users/{TEST_USER_ID}/accountability-invites",
            json={"email": f"person{idx}@example.com"},
        )
        statuses.append(resp.status_code)

    assert statuses[:5] == [200, 200, 200, 200, 200]
    assert statuses[5] == 429


async def test_accept_invite_creates_bidirectional_partners(client, db_session):
    await _ensure_test_user(client)
    db_session.add(User(id=OTHER_USER_ID, email="other@example.com"))
    await db_session.flush()

    send_resp = await client.post(
        f"/users/{TEST_USER_ID}/accountability-invites",
        json={"email": "other@example.com"},
    )
    assert send_resp.status_code == 200

    try:
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID

        incoming = await client.get(f"/users/{OTHER_USER_ID}/accountability-invites")
        assert incoming.status_code == 200
        invite_id = incoming.json()["incoming"][0]["id"]

        accept = await client.post(f"/accountability-invites/{invite_id}/accept")
        assert accept.status_code == 200
        assert accept.json()["status"] == "accepted"

        after = await client.get(f"/users/{OTHER_USER_ID}/accountability-invites")
        assert after.status_code == 200
        data = after.json()
        assert data["incoming"] == []
        assert any(p["partner_user_id"] == TEST_USER_ID for p in data["partners"])
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID


async def test_decline_invite_marks_declined_without_partner(client, db_session):
    await _ensure_test_user(client)
    db_session.add(User(id=OTHER_USER_ID, email="other@example.com"))
    await db_session.flush()

    await client.post(
        f"/users/{TEST_USER_ID}/accountability-invites",
        json={"email": "other@example.com"},
    )

    try:
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        incoming = await client.get(f"/users/{OTHER_USER_ID}/accountability-invites")
        invite_id = incoming.json()["incoming"][0]["id"]

        decline = await client.post(f"/accountability-invites/{invite_id}/decline")
        assert decline.status_code == 200
        assert decline.json()["status"] == "declined"

        after = await client.get(f"/users/{OTHER_USER_ID}/accountability-invites")
        assert after.status_code == 200
        data = after.json()
        assert data["incoming"] == []
        assert data["partners"] == []
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID


async def test_send_invite_403_wrong_owner(client):
    await _ensure_test_user(client)

    try:
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        resp = await client.post(
            f"/users/{TEST_USER_ID}/accountability-invites",
            json={"email": TEST_USER_EMAIL},
        )
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID

    assert resp.status_code == 403
