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


def test_task_response_has_is_rescue_task():
    """TaskResponse serializes is_rescue_task field."""
    from schemas import TaskResponse
    task = TaskResponse(
        id=uuid.uuid4(),
        goal_id=uuid.uuid4(),
        milestone_id=None,
        description="Test task",
        tip="Keep going",
        assigned_date=date.today(),
        position=0,
        is_completed=False,
        completed_at=None,
        is_rescue_task=True,
    )
    assert task.is_rescue_task is True


def test_goal_response_rescue_mode_true_when_inactive_48h():
    """GoalResponse.rescue_mode is True when last completion > 48h ago."""
    from schemas import GoalResponse, MilestoneResponse, TaskResponse

    old_time = datetime.now(timezone.utc) - timedelta(hours=49)
    goal = GoalResponse(
        id=uuid.uuid4(),
        user_id="user_test",
        raw_input="Learn Spanish",
        smart_title="Spanish Fluency",
        smart_description="90-day goal",
        goal_type="learning",
        target_date=date.today() + timedelta(days=90),
        status="active",
        progress=0,
        created_at=old_time,
        milestones=[
            MilestoneResponse(
                id=uuid.uuid4(),
                goal_id=uuid.uuid4(),
                title="M1",
                position=0,
                is_final=False,
                sprint_theme="Foundation",
                sprint_status="active",
                is_completed=False,
                completed_at=None,
                generation_started_at=None,
                created_at=old_time,
            )
        ],
        daily_tasks=[
            TaskResponse(
                id=uuid.uuid4(),
                goal_id=uuid.uuid4(),
                milestone_id=None,
                description="Old task",
                tip="tip",
                assigned_date=date.today() - timedelta(days=3),
                position=0,
                is_completed=True,
                completed_at=old_time,
                is_rescue_task=False,
            )
        ],
    )
    assert goal.rescue_mode is True


def test_goal_response_rescue_mode_false_when_rescue_task_today():
    """GoalResponse.rescue_mode is False when a rescue task already exists today."""
    from schemas import GoalResponse, MilestoneResponse, TaskResponse

    old_time = datetime.now(timezone.utc) - timedelta(hours=49)
    goal = GoalResponse(
        id=uuid.uuid4(),
        user_id="user_test",
        raw_input="Learn Spanish",
        smart_title="Spanish Fluency",
        smart_description="90-day goal",
        goal_type="learning",
        target_date=date.today() + timedelta(days=90),
        status="active",
        progress=0,
        created_at=old_time,
        milestones=[
            MilestoneResponse(
                id=uuid.uuid4(),
                goal_id=uuid.uuid4(),
                title="M1",
                position=0,
                is_final=False,
                sprint_theme="Foundation",
                sprint_status="active",
                is_completed=False,
                completed_at=None,
                generation_started_at=None,
                created_at=old_time,
            )
        ],
        daily_tasks=[
            TaskResponse(
                id=uuid.uuid4(),
                goal_id=uuid.uuid4(),
                milestone_id=None,
                description="Rescue task",
                tip="tip",
                assigned_date=date.today(),
                position=0,
                is_completed=False,
                completed_at=None,
                is_rescue_task=True,
            )
        ],
    )
    assert goal.rescue_mode is False


def test_goal_response_rescue_mode_false_when_active_less_than_48h():
    """GoalResponse.rescue_mode is False when last completion < 48h ago."""
    from schemas import GoalResponse, MilestoneResponse, TaskResponse

    recent_time = datetime.now(timezone.utc) - timedelta(hours=12)
    goal = GoalResponse(
        id=uuid.uuid4(),
        user_id="user_test",
        raw_input="Learn Spanish",
        smart_title="Spanish Fluency",
        smart_description="90-day goal",
        goal_type="learning",
        target_date=date.today() + timedelta(days=90),
        status="active",
        progress=0,
        created_at=recent_time,
        milestones=[
            MilestoneResponse(
                id=uuid.uuid4(),
                goal_id=uuid.uuid4(),
                title="M1",
                position=0,
                is_final=False,
                sprint_theme="Foundation",
                sprint_status="active",
                is_completed=False,
                completed_at=None,
                generation_started_at=None,
                created_at=recent_time,
            )
        ],
        daily_tasks=[
            TaskResponse(
                id=uuid.uuid4(),
                goal_id=uuid.uuid4(),
                milestone_id=None,
                description="Recent task",
                tip="tip",
                assigned_date=date.today(),
                position=0,
                is_completed=True,
                completed_at=recent_time,
                is_rescue_task=False,
            )
        ],
    )
    assert goal.rescue_mode is False


def test_goal_response_rescue_mode_true_when_no_completions_and_old_goal():
    """GoalResponse.rescue_mode is True for a brand-new goal with no completions older than 48h."""
    from schemas import GoalResponse, MilestoneResponse

    old_time = datetime.now(timezone.utc) - timedelta(hours=50)
    goal = GoalResponse(
        id=uuid.uuid4(),
        user_id="user_test",
        raw_input="Learn Spanish",
        smart_title="Spanish Fluency",
        smart_description="90-day goal",
        goal_type="learning",
        target_date=date.today() + timedelta(days=90),
        status="active",
        progress=0,
        created_at=old_time,
        milestones=[
            MilestoneResponse(
                id=uuid.uuid4(),
                goal_id=uuid.uuid4(),
                title="M1",
                position=0,
                is_final=False,
                sprint_theme="Foundation",
                sprint_status="active",
                is_completed=False,
                completed_at=None,
                generation_started_at=None,
                created_at=old_time,
            )
        ],
        daily_tasks=[],  # No tasks, no completions — fallback to created_at
    )
    assert goal.rescue_mode is True
