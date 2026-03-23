"""Tests for AI error handling and retry behavior."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient

from exceptions import AIGenerationError
from tests.conftest import TEST_USER_ID


async def test_create_goal_returns_202_even_when_background_task_would_fail(client: AsyncClient):
    """
    Two-phase: POST always returns 202 (placeholder).
    Even if _generate_goal_async would fail, the endpoint still returns 202
    with a placeholder milestone in 'generating' status.
    """
    with patch(
        "routes.goals._generate_goal_async",
        new=AsyncMock(),  # no-op — simulates the background not populating data
    ):
        resp = await client.post(
            f"/users/{TEST_USER_ID}/goals",
            json={"raw_input": "I want to run a 5K"},
        )
    # Phase 1 always returns 202 with placeholder
    assert resp.status_code == 202
    data = resp.json()
    assert data["status"] == "active"
    # The placeholder milestone was created with sprint_status="generating"
    assert len(data["milestones"]) == 1
    assert data["milestones"][0]["sprint_status"] == "generating"


async def test_with_retry_calls_factory_three_times(monkeypatch):
    """_with_retry exhausts 3 attempts before raising AIGenerationError."""
    from google.genai import errors as genai_errors
    import ai_utils

    call_count = 0

    mock_response = MagicMock()
    mock_response.body_segments = [{"error": {"message": "overloaded", "code": 503, "status": "UNAVAILABLE"}}]

    async def _failing_call():
        nonlocal call_count
        call_count += 1
        raise genai_errors.APIError(503, mock_response)

    monkeypatch.setattr("ai_utils.asyncio.sleep", AsyncMock())

    with pytest.raises(AIGenerationError):
        await ai_utils._with_retry(_failing_call, "test")

    assert call_count == 3
