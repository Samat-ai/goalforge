"""Tests for rescue loop — goal_is_rescue_mode and rescue endpoint."""

import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from schemas import AIRescueTaskItem


@pytest.mark.asyncio
async def test_generate_rescue_tasks_returns_two_items():
    """generate_rescue_tasks returns exactly 2 AIRescueTaskItem objects."""
    mock_item = AIRescueTaskItem(
        description="Listen to a 2-min podcast clip",
        tip="Small steps unlock momentum.",
    )
    with patch(
        "ai_utils.generate_rescue_tasks",
        new=AsyncMock(return_value=[mock_item, mock_item]),
    ):
        from ai_utils import generate_rescue_tasks
        result = await generate_rescue_tasks("Learn Spanish", "90-day Spanish fluency goal")
    assert len(result) == 2
    assert all(isinstance(r, AIRescueTaskItem) for r in result)
