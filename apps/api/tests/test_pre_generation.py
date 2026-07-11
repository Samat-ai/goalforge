"""Tests for the REAL _pre_generate_sprint background coroutine.

conftest's `client` fixture replaces services.task_service._pre_generate_sprint
with an AsyncMock for the HTTP-level tests, which means the real function was
never exercised — and a transaction-lifecycle bug (SELECT before an explicit
session.begin() → InvalidRequestError via autobegin) shipped undetected.

These tests import the real coroutine directly (bypassing the fixture's patch,
which only replaces the module attribute) and run it against the test engine,
mocking only the Gemini call.
"""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import func, select

from exceptions import AIGenerationError
from models import DailyTask, Milestone
from services.task_service import _pre_generate_sprint
from tests.conftest import TEST_USER_ID, _make_mock_sprint_tasks, create_test_goal


def _pending_milestone(goal: dict) -> dict:
    return next(m for m in goal["milestones"] if m["sprint_status"] == "pending")


@pytest.mark.asyncio
async def test_pre_generate_sprint_marks_milestone_ready(client, engine, db_session):
    """Happy path: pending milestone ends 'ready' with 7 persisted tasks."""
    goal = await create_test_goal(client)
    milestone_id = uuid.UUID(_pending_milestone(goal)["id"])

    with (
        patch("services.task_service.engine", engine),
        patch(
            "services.task_service.generate_sprint_tasks",
            new=AsyncMock(return_value=_make_mock_sprint_tasks()),
        ),
    ):
        await _pre_generate_sprint(
            milestone_id=milestone_id,
            goal_id=uuid.UUID(goal["id"]),
            user_id=TEST_USER_ID,
            goal_context="Run 5K: build endurance",
            sprint_theme="Interval speed work",
        )

    ms = (
        await db_session.execute(select(Milestone).where(Milestone.id == milestone_id))
    ).scalar_one()
    assert ms.sprint_status == "ready"
    assert ms.generation_started_at is not None

    task_count = (
        await db_session.execute(
            select(func.count(DailyTask.id)).where(DailyTask.milestone_id == milestone_id)
        )
    ).scalar_one()
    assert task_count == 7


@pytest.mark.asyncio
async def test_pre_generate_sprint_marks_failed_on_ai_error(client, engine, db_session):
    """AI failure path: milestone ends 'failed' (not stuck in pending/generating)."""
    goal = await create_test_goal(client)
    milestone_id = uuid.UUID(_pending_milestone(goal)["id"])

    with (
        patch("services.task_service.engine", engine),
        patch(
            "services.task_service.generate_sprint_tasks",
            new=AsyncMock(side_effect=AIGenerationError("boom")),
        ),
    ):
        await _pre_generate_sprint(
            milestone_id=milestone_id,
            goal_id=uuid.UUID(goal["id"]),
            user_id=TEST_USER_ID,
            goal_context="Run 5K: build endurance",
            sprint_theme="Interval speed work",
        )

    ms = (
        await db_session.execute(select(Milestone).where(Milestone.id == milestone_id))
    ).scalar_one()
    assert ms.sprint_status == "failed"

    task_count = (
        await db_session.execute(
            select(func.count(DailyTask.id)).where(DailyTask.milestone_id == milestone_id)
        )
    ).scalar_one()
    assert task_count == 0
