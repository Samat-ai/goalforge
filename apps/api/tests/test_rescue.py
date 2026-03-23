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


# ---------------------------------------------------------------------------
# goal_is_rescue_mode (ORM object variant)
# ---------------------------------------------------------------------------

def _make_orm_goal(
    status="active",
    sprint_status="active",
    completed_at=None,
    created_at=None,
    has_rescue_task_today=False,
):
    """Build a MagicMock mimicking a loaded Goal ORM object."""
    now = datetime.now(timezone.utc)
    goal = MagicMock()
    goal.status = status
    goal.created_at = created_at or (now - timedelta(hours=49))

    milestone = MagicMock()
    milestone.sprint_status = sprint_status
    goal.milestones = [milestone]

    tasks = []
    if completed_at:
        t = MagicMock()
        t.is_completed = True
        t.completed_at = completed_at
        t.is_rescue_task = False
        t.assigned_date = date.today() - timedelta(days=1)
        tasks.append(t)
    if has_rescue_task_today:
        rescue = MagicMock()
        rescue.is_rescue_task = True
        rescue.assigned_date = date.today()
        rescue.is_completed = False
        tasks.append(rescue)
    goal.daily_tasks = tasks
    return goal


def test_goal_is_rescue_mode_true_when_no_completions():
    from services.rescue_service import goal_is_rescue_mode
    goal = _make_orm_goal()
    assert goal_is_rescue_mode(goal) is True


def test_goal_is_rescue_mode_false_when_recent_completion():
    from services.rescue_service import goal_is_rescue_mode
    recent = datetime.now(timezone.utc) - timedelta(hours=10)
    goal = _make_orm_goal(completed_at=recent)
    assert goal_is_rescue_mode(goal) is False


def test_goal_is_rescue_mode_true_at_exact_48h_boundary():
    from services.rescue_service import goal_is_rescue_mode
    exactly_48h = datetime.now(timezone.utc) - timedelta(hours=48)
    goal = _make_orm_goal(completed_at=exactly_48h)
    assert goal_is_rescue_mode(goal) is True


def test_goal_is_rescue_mode_false_when_rescue_task_today():
    from services.rescue_service import goal_is_rescue_mode
    goal = _make_orm_goal(has_rescue_task_today=True)
    assert goal_is_rescue_mode(goal) is False


def test_goal_is_rescue_mode_false_when_not_active():
    from services.rescue_service import goal_is_rescue_mode
    goal = _make_orm_goal(status="achieved")
    assert goal_is_rescue_mode(goal) is False


def test_goal_is_rescue_mode_false_when_no_active_sprint():
    from services.rescue_service import goal_is_rescue_mode
    goal = _make_orm_goal(sprint_status="completed")
    assert goal_is_rescue_mode(goal) is False


# ---------------------------------------------------------------------------
# POST /goals/{goal_id}/rescue endpoint tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rescue_endpoint_returns_202_and_sets_generating(client, created_goal):
    """POST /rescue sets milestone to generating and returns the goal."""
    goal_id = created_goal["id"]

    with patch(
        "services.rescue_service._execute_rescue_sprint",
        new=AsyncMock(return_value=None),
    ):
        resp = await client.post(f"/goals/{goal_id}/rescue")

    assert resp.status_code == 202
    data = resp.json()
    # Milestone should now be 'generating'
    assert any(m["sprint_status"] == "generating" for m in data["milestones"])
    assert "rescue_mode" in data


@pytest.mark.asyncio
async def test_rescue_endpoint_409_when_no_active_sprint(client, created_goal, db_session):
    """POST /rescue returns 409 when there is no active sprint."""
    from sqlalchemy import update as sql_update
    from models import Milestone

    goal_id = created_goal["id"]

    # Mark all milestones as completed so there is no active sprint
    await db_session.execute(
        sql_update(Milestone)
        .where(Milestone.goal_id == uuid.UUID(goal_id))
        .values(sprint_status="completed")
    )
    await db_session.commit()

    resp = await client.post(f"/goals/{goal_id}/rescue")
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_rescue_endpoint_403_for_other_user(client, created_goal):
    """POST /rescue returns 403 when called by a different user.

    Uses try/finally auth override swap — per CLAUDE.md 'Test auth override gotcha',
    using both client and other_client fixtures in one test causes override conflicts.
    """
    from auth import get_current_user_id
    from main import app

    goal_id = created_goal["id"]

    try:
        app.dependency_overrides[get_current_user_id] = lambda: "user_other_xyz789"
        resp = await client.post(f"/goals/{goal_id}/rescue")
    finally:
        app.dependency_overrides[get_current_user_id] = lambda: "user_test_abc123"

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# send_rescue_email
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_send_rescue_email_logs_when_no_api_key(caplog):
    """send_rescue_email falls back to logging when RESEND_API_KEY is unset."""
    import logging
    from services.email_service import send_rescue_email

    with patch("services.email_service.settings") as mock_settings, \
         caplog.at_level(logging.INFO, logger="services.email_service"):
        mock_settings.resend_api_key = ""
        await send_rescue_email("test@example.com", "Star Forger")

    assert any("rescue email (mock)" in r.message.lower() for r in caplog.records)
