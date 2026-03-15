"""Tests for AI error handling and retry behavior."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient

from exceptions import AIGenerationError
from tests.conftest import TEST_USER_ID


async def test_create_goal_returns_503_on_ai_failure(client: AsyncClient):
    """generate_smart_goal raising AIGenerationError → 503 with exact message."""
    with patch(
        "routes.goals.generate_smart_goal",
        new=AsyncMock(side_effect=AIGenerationError()),
    ):
        resp = await client.post(
            f"/users/{TEST_USER_ID}/goals",
            json={"raw_input": "I want to run a 5K"},
        )
    assert resp.status_code == 503
    assert resp.json()["detail"] == (
        "Our AI is temporarily busy. Your goal has been saved — "
        "we'll generate the plan shortly. Please refresh in a minute."
    )


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
