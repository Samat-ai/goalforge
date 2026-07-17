"""Background goal generation -- Phase 2 of two-phase goal creation."""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete as sql_delete, func, select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from ai_utils import generate_smart_goal
from database import engine
from exceptions import AIGenerationError
from models import DailyTask, Goal, Milestone
from utils import user_today

logger = logging.getLogger(__name__)

# Sentinel title used on placeholder milestones created during Phase 1.
# Used by retry_sprint_generation to detect initial-creation failures.
PLACEHOLDER_MILESTONE_TITLE = "Generating your plan\u2026"

# Star lifecycle: an active goal with no activity for this long has burned out
# (frontend twin: FADED_IDLE_DAYS in apps/web/src/lib/goalView.ts \u2014 a fully-bright
# star's habitStrength decays to ~0 after ~28 idle days, so 30 \u2248 "brightness 0").
AUTO_ABANDON_DAYS = 30


async def auto_abandon_stale_goals(db: AsyncSession, now: datetime | None = None) -> int:
    """Set status='abandoned' on active goals with no activity for AUTO_ABANDON_DAYS.

    Last activity = latest completed task's completed_at, else goal.created_at
    (same definition as rescue_service.goal_is_rescue_mode). The bulk UPDATE
    re-checks status='active' at write time \u2014 the set-based analog of the
    per-row .with_for_update() convention \u2014 so a goal achieved between the
    candidate SELECT and the UPDATE is skipped. Returns the number abandoned.
    """
    cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=AUTO_ABANDON_DAYS)

    last_done = (
        select(DailyTask.goal_id, func.max(DailyTask.completed_at).label("last_done_at"))
        .where(DailyTask.is_completed == True)  # noqa: E712
        .group_by(DailyTask.goal_id)
        .subquery()
    )
    stale_ids = (
        select(Goal.id)
        .outerjoin(last_done, last_done.c.goal_id == Goal.id)
        .where(
            Goal.status == "active",
            func.coalesce(last_done.c.last_done_at, Goal.created_at) < cutoff,
        )
    )
    result = await db.execute(
        sql_update(Goal)
        .where(Goal.id.in_(stale_ids), Goal.status == "active")
        .values(status="abandoned")
        .execution_options(synchronize_session=False)
    )
    abandoned = result.rowcount or 0
    if abandoned:
        logger.info("auto_abandon_stale_goals: %d goal(s) faded", abandoned)
    return abandoned


async def _generate_goal_async(
    goal_id: uuid.UUID,
    user_id: str,
    user_timezone: str,
    raw_input: str,
) -> None:
    """
    Phase 2 of two-phase goal creation.

    Called via FastAPI BackgroundTasks after create_goal returns 202.
    Opens its own AsyncSession -- the request session is already closed.

    On success: updates goal fields, replaces placeholder milestone with
    real milestones + sprint-1 tasks.
    On AIGenerationError: sets the placeholder milestone sprint_status='failed'
    so the user sees the retry button.
    """
    async with AsyncSession(engine) as db:
        today = user_today(user_timezone)

        try:
            ai_output = await generate_smart_goal(raw_input, today=today)
        except AIGenerationError as exc:
            logger.error(
                "_generate_goal_async: AI failed for goal %s (user %s): %s",
                goal_id, user_id, exc,
            )
            async with db.begin():
                await db.execute(
                    sql_update(Milestone)
                    .where(Milestone.goal_id == goal_id)
                    .values(sprint_status="failed")
                )
            return

        try:
            async with db.begin():
                # Update goal with AI-generated fields
                await db.execute(
                    sql_update(Goal)
                    .where(Goal.id == goal_id)
                    .values(
                        smart_title=ai_output.smart_title,
                        smart_description=ai_output.smart_description,
                        goal_type=ai_output.goal_type,
                        target_date=ai_output.target_date,
                    )
                )

                # Delete the placeholder milestone (and any orphaned tasks)
                await db.execute(sql_delete(Milestone).where(Milestone.goal_id == goal_id))

                # Create real milestones
                milestone_rows: list[Milestone] = []
                for i, ms_config in enumerate(ai_output.milestones):
                    ms = Milestone(
                        id=uuid.uuid4(),
                        goal_id=goal_id,
                        title=ms_config.title,
                        position=i + 1,
                        is_final=ms_config.is_final,
                        sprint_theme=ms_config.sprint_theme,
                        sprint_status="active" if i == 0 else "pending",
                    )
                    db.add(ms)
                    milestone_rows.append(ms)

                # flush to get milestone PKs before creating tasks
                await db.flush()

                # Clean up any NULL-milestone orphaned tasks (can accumulate on partial retry)
                await db.execute(
                    sql_delete(DailyTask).where(
                        DailyTask.goal_id == goal_id,
                        DailyTask.milestone_id == None,  # noqa: E711
                    )
                )

                first_milestone = milestone_rows[0]
                for task_data in ai_output.initial_tasks:
                    db.add(DailyTask(
                        id=uuid.uuid4(),
                        goal_id=goal_id,
                        milestone_id=first_milestone.id,
                        description=task_data.description,
                        tip=task_data.tip,
                        assigned_date=task_data.assigned_date,
                    ))

        except Exception as exc:
            logger.error(
                "_generate_goal_async: DB write failed for goal %s: %s", goal_id, exc
            )
            try:
                async with db.begin():
                    await db.execute(
                        sql_update(Milestone)
                        .where(Milestone.goal_id == goal_id)
                        .values(sprint_status="failed")
                    )
            except Exception as inner:
                logger.error(
                    "_generate_goal_async: could not set failed status for goal %s: %s",
                    goal_id, inner,
                )
