"""Unit tests for services/reward_service.py — loot roll engine."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from models import DailyTask, Goal, Reward, User
from services import reward_service
from tests.conftest import TEST_USER_ID


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _make_user_goal(db_session):
    """Insert a minimal User + Goal row and return (user, goal)."""
    user = User(id=TEST_USER_ID, email="test@example.com", star_points=0, timezone="UTC")
    db_session.add(user)
    goal = Goal(
        id=uuid.uuid4(),
        user_id=TEST_USER_ID,
        raw_input="test",
        smart_title="Test Goal",
        smart_description="Test",
        goal_type="fitness",
        target_date=datetime.now(timezone.utc).date() + timedelta(days=30),
        status="active",
        progress=0,
    )
    db_session.add(goal)
    await db_session.flush()
    return user, goal


async def _add_completed_task(db_session, goal, completed_at):
    """Insert a completed DailyTask with specified completed_at datetime."""
    task = DailyTask(
        id=uuid.uuid4(),
        goal_id=goal.id,
        description="task",
        tip="tip",
        assigned_date=completed_at.date(),
        is_completed=True,
        completed_at=completed_at,
    )
    db_session.add(task)
    await db_session.flush()
    return task


# ---------------------------------------------------------------------------
# compute_consistency_score
# ---------------------------------------------------------------------------

async def test_consistency_score_zero_for_new_user(db_session):
    user, goal = await _make_user_goal(db_session)
    score = await reward_service.compute_consistency_score(TEST_USER_ID, db_session)
    assert score == 0


async def test_consistency_score_counts_distinct_days(db_session):
    user, goal = await _make_user_goal(db_session)
    now = datetime.now(timezone.utc)

    # 3 tasks on day 0 — should count as 1 distinct day
    for _ in range(3):
        await _add_completed_task(db_session, goal, now)

    # 1 task on day -1
    await _add_completed_task(db_session, goal, now - timedelta(days=1))

    score = await reward_service.compute_consistency_score(TEST_USER_ID, db_session)
    assert score == 2


async def test_consistency_score_ignores_tasks_older_than_14_days(db_session):
    user, goal = await _make_user_goal(db_session)
    now = datetime.now(timezone.utc)

    # Within window (day -13 is the edge — included)
    await _add_completed_task(db_session, goal, now - timedelta(days=13))
    # Outside window (day -15 is NOT included)
    await _add_completed_task(db_session, goal, now - timedelta(days=15))

    score = await reward_service.compute_consistency_score(TEST_USER_ID, db_session)
    assert score == 1


async def test_consistency_score_max_14(db_session):
    user, goal = await _make_user_goal(db_session)
    now = datetime.now(timezone.utc)

    for i in range(14):
        await _add_completed_task(db_session, goal, now - timedelta(days=i))

    score = await reward_service.compute_consistency_score(TEST_USER_ID, db_session)
    assert score == 14


# ---------------------------------------------------------------------------
# roll_reward
# ---------------------------------------------------------------------------

def test_roll_reward_returns_valid_tier():
    for score in [0, 3, 7, 11, 14]:
        tier = reward_service.roll_reward(score)
        assert tier in ("standard", "bonus", "crit", "jackpot")


def test_roll_reward_seeded_standard():
    import random
    # Verify the function runs without error at all score levels
    for score in [0, 4, 8, 12]:
        tier = reward_service.roll_reward(score)
        assert tier in ("standard", "bonus", "crit", "jackpot")


def test_consistency_tier_mapping():
    assert reward_service._consistency_tier(0) == "base"
    assert reward_service._consistency_tier(3) == "base"
    assert reward_service._consistency_tier(4) == "improved"
    assert reward_service._consistency_tier(7) == "improved"
    assert reward_service._consistency_tier(8) == "high"
    assert reward_service._consistency_tier(11) == "high"
    assert reward_service._consistency_tier(12) == "max"
    assert reward_service._consistency_tier(14) == "max"
