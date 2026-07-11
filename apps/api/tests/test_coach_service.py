import uuid
from datetime import timedelta
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from models import CoachMessage, CoachSession, DailyTask, Goal, Milestone, User
from schemas import AIPlanEdit
from services import coach_service
from tests.conftest import TEST_USER_ID, OTHER_USER_ID, utc_today
from tests.test_coach import _mock_goal_output


async def _seed_user_and_goal(db, user_id=TEST_USER_ID):
    user = User(id=user_id, email=f"{user_id}@example.com")
    db.add(user)
    goal = Goal(
        id=uuid.uuid4(), user_id=user_id, raw_input="run",
        smart_title="Run 5K", smart_description="Run a 5K in 12 weeks.",
        goal_type="health", target_date=utc_today() + timedelta(days=84),
        status="active",
    )
    db.add(goal)
    await db.flush()
    ms = Milestone(
        id=uuid.uuid4(), goal_id=goal.id, title="Base", position=1,
        is_final=False, sprint_theme="Build base", sprint_status="active",
    )
    db.add(ms)
    await db.flush()
    open_task = DailyTask(
        id=uuid.uuid4(), goal_id=goal.id, milestone_id=ms.id,
        description="Run 10 minutes", tip="Easy pace.", assigned_date=utc_today(),
    )
    done_task = DailyTask(
        id=uuid.uuid4(), goal_id=goal.id, milestone_id=ms.id,
        description="Stretch", tip="Gently.", assigned_date=utc_today(),
        is_completed=True,
    )
    db.add(open_task)
    db.add(done_task)
    await db.flush()
    return goal, ms, open_task, done_task


@pytest.mark.asyncio
async def test_apply_plan_edits_validation_matrix(db_session):
    goal, ms, open_task, done_task = await _seed_user_and_goal(db_session)
    # foreign user's goal
    other_goal, _, other_task, _ = await _seed_user_and_goal(db_session, user_id=OTHER_USER_ID)

    edits = [
        AIPlanEdit(target="task_description", target_id=str(open_task.id), new_value="Run 12 minutes"),   # valid
        AIPlanEdit(target="task_description", target_id=str(done_task.id), new_value="hack"),             # completed → drop
        AIPlanEdit(target="task_description", target_id=str(other_task.id), new_value="hack"),            # foreign → drop
        AIPlanEdit(target="task_tip", target_id="not-a-uuid", new_value="hack"),                          # bad id → drop
        AIPlanEdit(target="goal_title", target_id=str(goal.id), new_value="x" * 201),                     # too long → drop
        AIPlanEdit(target="milestone_theme", target_id=str(ms.id), new_value="Speed over distance"),      # valid
        AIPlanEdit(target="goal_description", target_id=str(uuid.uuid4()), new_value="ghost"),            # unknown → drop
    ]
    applied, dropped = await coach_service.apply_plan_edits(edits, TEST_USER_ID, db_session)
    assert (applied, dropped) == (2, 5)
    await db_session.refresh(open_task)
    await db_session.refresh(ms)
    await db_session.refresh(other_task)
    assert open_task.description == "Run 12 minutes"
    assert ms.sprint_theme == "Speed over distance"
    assert other_task.description == "Run 10 minutes"  # untouched


@pytest.mark.asyncio
async def test_build_user_context_contains_ids_and_tasks(db_session):
    goal, ms, open_task, _ = await _seed_user_and_goal(db_session)
    session = CoachSession(id=uuid.uuid4(), user_id=TEST_USER_ID, stage=0, is_completed=False)
    db_session.add(session)
    await db_session.flush()

    block = await coach_service.build_user_context(TEST_USER_ID, session, db_session)
    assert str(goal.id) in block
    assert "Run 5K" in block
    assert str(open_task.id) in block
    assert "untitled" in block.lower()


@pytest.mark.asyncio
async def test_count_user_messages_today(db_session):
    await _seed_user_and_goal(db_session)
    session = CoachSession(id=uuid.uuid4(), user_id=TEST_USER_ID, stage=0, is_completed=False)
    db_session.add(session)
    await db_session.flush()
    for i in range(3):
        db_session.add(CoachMessage(id=uuid.uuid4(), session_id=session.id, role="user", content=f"m{i}"))
    db_session.add(CoachMessage(id=uuid.uuid4(), session_id=session.id, role="coach", content="reply"))
    await db_session.flush()

    count = await coach_service.count_user_messages_today(TEST_USER_ID, "UTC", db_session)
    assert count == 3


@pytest.mark.asyncio
async def test_forge_goal_from_brief_creates_rows(db_session):
    await _seed_user_and_goal(db_session)
    with patch(
        "services.coach_service.generate_smart_goal",
        new=AsyncMock(return_value=_mock_goal_output()),
    ):
        goal = await coach_service.forge_goal_from_brief("Weekly writing habit", TEST_USER_ID, db_session)
    assert goal.smart_title == "Launch a weekly writing habit"
    assert goal.raw_input == "Weekly writing habit"
    milestones = (await db_session.execute(
        select(Milestone).where(Milestone.goal_id == goal.id).order_by(Milestone.position)
    )).scalars().all()
    assert len(milestones) == 3
    assert milestones[0].sprint_status == "active"
    assert all(m.sprint_status == "pending" for m in milestones[1:])
    tasks = (await db_session.execute(
        select(DailyTask).where(DailyTask.goal_id == goal.id)
    )).scalars().all()
    assert len(tasks) == 7
