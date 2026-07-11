from unittest.mock import AsyncMock, patch

import pytest

from exceptions import AIGenerationError
from schemas import AIGuardVerdict
from tests.conftest import TEST_USER_ID

RAW = {"raw_input": "I want to run a 5K race in under 25 minutes within 3 months"}


@pytest.mark.asyncio
async def test_deflected_goal_input_returns_422(client):
    with patch(
        "routes.goals.classify_user_input",
        new=AsyncMock(return_value=AIGuardVerdict(verdict="deflect", category="off_topic")),
    ):
        resp = await client.post(f"/users/{TEST_USER_ID}/goals", json=RAW)
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert detail["code"] == "content_deflected"
    assert isinstance(detail["message"], str) and detail["message"]


@pytest.mark.asyncio
async def test_support_goal_input_returns_422_with_support_message(client):
    from services.coach_service import SUPPORT_MESSAGE
    with patch(
        "routes.goals.classify_user_input",
        new=AsyncMock(return_value=AIGuardVerdict(verdict="support", category="self_harm")),
    ):
        resp = await client.post(f"/users/{TEST_USER_ID}/goals", json=RAW)
    assert resp.status_code == 422
    assert resp.json()["detail"]["message"] == SUPPORT_MESSAGE


@pytest.mark.asyncio
async def test_allowed_goal_input_still_202(client):
    resp = await client.post(f"/users/{TEST_USER_ID}/goals", json=RAW)
    assert resp.status_code == 202


@pytest.mark.asyncio
async def test_guard_failure_fails_open_202(client):
    with patch(
        "routes.goals.classify_user_input",
        new=AsyncMock(side_effect=AIGenerationError("down")),
    ):
        resp = await client.post(f"/users/{TEST_USER_ID}/goals", json=RAW)
    assert resp.status_code == 202
