"""Unit tests for resize_task_for_low_energy AI function."""

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from ai_utils import resize_task_for_low_energy


@pytest.mark.asyncio
async def test_resize_task_returns_first_step():
    today = date.today()
    mock_response = MagicMock()
    mock_response.text = (
        f'{{"description": "Open your running app", '
        f'"tip": "Just doing this is a win today.", '
        f'"assigned_date": "{today.isoformat()}"}}'
    )

    with patch("ai_utils._client") as mock_client:
        mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
        result = await resize_task_for_low_energy(
            goal_context="Run 5K: Build endurance over 90 days.",
            sprint_theme="Build base",
            original_description="Run 3 miles at moderate pace",
            assigned_date=today,
        )

    assert result.description == "Open your running app"
    assert "win today" in result.tip


@pytest.mark.asyncio
async def test_resize_task_prompt_contains_original_task():
    """The system instruction must include the original task description."""
    today = date.today()
    captured_configs = []
    mock_response = MagicMock()
    mock_response.text = (
        f'{{"description": "Open your notes app", '
        f'"tip": "Just doing this is a win today.", '
        f'"assigned_date": "{today.isoformat()}"}}'
    )

    async def mock_generate(*args, **kwargs):
        captured_configs.append(kwargs.get("config"))
        return mock_response

    with patch("ai_utils._client") as mock_client:
        mock_client.aio.models.generate_content = mock_generate
        await resize_task_for_low_energy(
            goal_context="Write a novel: Complete first draft.",
            sprint_theme="Outline act 1",
            original_description="Write 500 words of chapter 2",
            assigned_date=today,
        )

    assert len(captured_configs) == 1
    # The system instruction must mention the original task
    config = captured_configs[0]
    assert config is not None
    assert "Write 500 words of chapter 2" in config.system_instruction
