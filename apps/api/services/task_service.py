"""Task completion business logic and background sprint pre-generation."""

import asyncio
import logging
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from ai_utils import generate_sprint_tasks
from database import engine
from exceptions import AIGenerationError
from models import DailyTask, Goal, Milestone, User

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Background task helpers
# ---------------------------------------------------------------------------

def _log_task_exception(task: asyncio.Task) -> None:
    """Done-callback: log any unhandled exception from a background asyncio task."""
    if not task.cancelled() and (exc := task.exception()) is not None:
        logger.error("Background task %r raised an unhandled exception: %s", task.get_name(), exc, exc_info=exc)


async def _pre_generate_sprint(
    milestone_id: uuid.UUID,
    goal_id: uuid.UUID,
    goal_context: str,
    sprint_theme: str,
    start_date: date,
) -> None:
    """
    Background coroutine: call Gemini to generate tasks for the next sprint
    milestone and persist them. Runs via asyncio.create_task() so it does not
    block the complete_task response.

    Status transitions: pending -> generating -> ready (or failed on error).
    The milestone advance endpoint handles "failed" by regenerating synchronously.
    """
    async with AsyncSession(engine) as db:
        # 1. Mark as generating (own commit so the frontend sees it immediately)
        try:
            async with db.begin():
                await db.execute(
                    sql_update(Milestone)
                    .where(Milestone.id == milestone_id)
                    .values(sprint_status="generating")
                )
        except Exception as exc:
            logger.error("Pre-gen: could not set generating status for %s: %s", milestone_id, exc)
            return

        # 2. Call Gemini with retry (outside any DB transaction)
        try:
            task_outputs = await generate_sprint_tasks(goal_context, sprint_theme, start_date)
        except AIGenerationError as exc:
            logger.error(
                "Pre-gen: AI failed for milestone %s (goal %s, theme %r, start %s): %s",
                milestone_id, goal_id, sprint_theme, start_date, exc,
            )
            async with db.begin():
                await db.execute(
                    sql_update(Milestone)
                    .where(Milestone.id == milestone_id)
                    .values(sprint_status="failed")
                )
            return

        # 3. Persist tasks and mark ready
        try:
            async with db.begin():
                for task_data in task_outputs:
                    db.add(DailyTask(
                        id=uuid.uuid4(),
                        goal_id=goal_id,
                        milestone_id=milestone_id,
                        description=task_data.description,
                        tip=task_data.tip,
                        assigned_date=task_data.assigned_date,
                    ))
                await db.execute(
                    sql_update(Milestone)
                    .where(Milestone.id == milestone_id)
                    .values(sprint_status="ready")
                )
        except Exception as exc:
            logger.error("Pre-gen: DB write failed for milestone %s: %s", milestone_id, exc)


# ---------------------------------------------------------------------------
# Task completion logic
# ---------------------------------------------------------------------------

async def complete_task_and_award_points(
    task: DailyTask,
    goal: Goal,
    db: AsyncSession,
) -> None:
    """
    Mark a task complete, award star points, and kick off pre-gen if this was
    the last task in the current sprint.
    """
    task.is_completed = True
    task.completed_at = datetime.now(timezone.utc)

    # Award 10 star points to the goal's owner (atomic SQL increment avoids race conditions)
    await db.execute(
        sql_update(User)
        .where(User.id == goal.user_id)
        .values(star_points=User.star_points + 10)
    )

    await db.flush()

    # Magic Pre-Gen: if this was the last task in the current sprint, kick off
    # background generation of next sprint's tasks so the advance is near-instant.
    if task.milestone_id is not None:
        remaining = (await db.execute(
            select(func.count(DailyTask.id))
            .where(DailyTask.milestone_id == task.milestone_id)
            .where(DailyTask.is_completed == False)
        )).scalar_one()

        if remaining == 0:
            current_ms = (await db.execute(
                select(Milestone).where(Milestone.id == task.milestone_id)
            )).scalar_one_or_none()

            if current_ms and not current_ms.is_final:
                next_ms = (await db.execute(
                    select(Milestone)
                    .where(Milestone.goal_id == current_ms.goal_id)
                    .where(Milestone.position == current_ms.position + 1)
                    .where(Milestone.sprint_status == "pending")
                )).scalar_one_or_none()

                if next_ms and goal:
                    goal_context = f"{goal.smart_title}: {goal.smart_description}"
                    _t = asyncio.create_task(_pre_generate_sprint(
                        milestone_id=next_ms.id,
                        goal_id=goal.id,
                        goal_context=goal_context,
                        sprint_theme=next_ms.sprint_theme,
                        start_date=date.today() + timedelta(days=1),
                    ))
                    _t.add_done_callback(_log_task_exception)
