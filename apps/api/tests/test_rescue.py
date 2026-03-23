"""Tests for rescue loop — goal_is_rescue_mode and rescue endpoint."""

import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from schemas import AIRescueTaskItem


@pytest.mark.asyncio
async def test_generate_rescue_tasks_returns_two_items():
    """generate_rescue_tasks parses Gemini response into 2 AIRescueTaskItem objects."""
    import json
    from ai_utils import generate_rescue_tasks

    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "tasks": [
            {"description": "Listen to a 2-min podcast clip", "tip": "Small steps unlock momentum."},
            {"description": "Write one sentence about your goal", "tip": "Just one word to start."},
        ]
    })

    with patch("ai_utils._client") as mock_client:
        mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
        result = await generate_rescue_tasks("Learn Spanish", "90-day Spanish fluency goal")

    assert len(result) == 2
    assert all(isinstance(r, AIRescueTaskItem) for r in result)
    assert result[0].description == "Listen to a 2-min podcast clip"
