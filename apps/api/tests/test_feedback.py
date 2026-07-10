"""Tests for POST /feedback."""

import pytest

pytestmark = pytest.mark.asyncio


@pytest.mark.parametrize("category", ["bug", "idea", "other"])
async def test_submit_feedback_happy_path(client, category):
    resp = await client.post(
        "/feedback",
        json={"category": category, "message": "The star animation is delightful."},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "received"
    assert body["id"]


async def test_submit_feedback_rejects_unknown_category(client):
    resp = await client.post(
        "/feedback",
        json={"category": "complaint", "message": "hello"},
    )
    assert resp.status_code == 422


async def test_submit_feedback_rejects_empty_message(client):
    resp = await client.post("/feedback", json={"category": "bug", "message": ""})
    assert resp.status_code == 422


async def test_submit_feedback_rejects_whitespace_only_message(client):
    resp = await client.post("/feedback", json={"category": "bug", "message": "   "})
    assert resp.status_code == 422


async def test_submit_feedback_rejects_overlong_message(client):
    resp = await client.post(
        "/feedback", json={"category": "idea", "message": "x" * 2001}
    )
    assert resp.status_code == 422


async def test_submit_feedback_persists_row(client, db_session):
    from sqlalchemy import select

    from models import Feedback

    resp = await client.post(
        "/feedback", json={"category": "bug", "message": "Persist me"}
    )
    assert resp.status_code == 201

    result = await db_session.execute(
        select(Feedback).where(Feedback.message == "Persist me")
    )
    row = result.scalar_one()
    assert row.category == "bug"
