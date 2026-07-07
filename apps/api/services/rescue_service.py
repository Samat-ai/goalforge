"""Rescue loop service — 48h inactivity detection and Recovery Sprint execution."""

import logging
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ai_utils import generate_rescue_tasks
from database import engine
from models import DailyTask, Goal, Milestone, User
from utils import user_today

logger = logging.getLogger(__name__)


def goal_is_rescue_mode(goal, now: datetime | None = None) -> bool:
    """Pure function: True when a Goal ORM object warrants rescue mode.

    Mirrors GoalResponse.rescue_mode but operates on ORM objects (not Pydantic).
    Used by routes/jobs.py trigger_reminders to avoid a circular import with schemas.py.

    Qualifying conditions (all must be true):
    - goal.status == 'active'
    - At least one milestone with sprint_status in ('active', 'ready')
    - No rescue task already assigned today (idempotency guard)
    - 48h+ elapsed since last task completion (or since created_at if no completions)

    Note: Uses the UTC calendar date for the today check. Unlike the Pydantic
    computed field in schemas.py, this function is NOT called in a per-request context
    with user timezone access. The caller (trigger_reminders) already filters to
    users with active goals, so the UTC date check is an acceptable approximation.

    Args:
        goal: A Goal ORM instance with .milestones and .daily_tasks eagerly loaded.
        now: Override current UTC time (for testing). Defaults to datetime.now(UTC).
    """
    if goal.status != "active":
        return False

    active_milestone = next(
        (m for m in goal.milestones if m.sprint_status in ("active", "ready")),
        None,
    )
    if not active_milestone:
        return False

    today = (now or datetime.now(timezone.utc)).date()
    rescue_task_today = any(
        t.is_rescue_task and t.assigned_date == today
        for t in goal.daily_tasks
    )
    if rescue_task_today:
        return False

    _now = now or datetime.now(timezone.utc)
    completed_times = [
        t.completed_at
        for t in goal.daily_tasks
        if t.is_completed and t.completed_at is not None
    ]
    if completed_times:
        last_completed = max(completed_times)
    else:
        last_completed = goal.created_at

    # Normalize to UTC-aware (ORM created_at may be naive but is UTC)
    if last_completed.tzinfo is None:
        last_completed = last_completed.replace(tzinfo=timezone.utc)

    return (_now - last_completed) >= timedelta(hours=48)


async def _execute_rescue_sprint(
    goal_id: UUID,
    milestone_id: UUID,
    user_id: str,
) -> None:
    """Background task: sprint-shift uncompleted tasks + generate 2 rescue micro-tasks.

    Opens its own AsyncSession (runs after response is sent via FastAPI BackgroundTasks).
    On failure, sets milestone sprint_status to 'failed' via UPDATE statement to avoid
    DetachedInstanceError — same pattern as _pre_generate_sprint in task_service.py.
    """
    async with AsyncSession(engine) as db:
        try:
            goal = await db.get(Goal, goal_id)
            milestone = await db.get(Milestone, milestone_id)
            user = await db.get(User, user_id)

            if not goal or not milestone or not user:
                logger.error(
                    "rescue_sprint_missing_objects",
                    extra={
                        "goal_id": str(goal_id),
                        "milestone_id": str(milestone_id),
                        "user_id": user_id,
                    },
                )
                if milestone:
                    await db.execute(
                        update(Milestone)
                        .where(Milestone.id == milestone_id)
                        .values(sprint_status="failed", generation_started_at=None)
                    )
                    await db.commit()
                return

            # Use user's local date for sprint-shift math (same as _pre_generate_sprint)
            today = user_today(user.timezone)

            # Idempotency: abort if rescue tasks already exist for today
            existing_rescue = await db.execute(
                select(func.count(DailyTask.id)).where(
                    DailyTask.goal_id == goal_id,
                    DailyTask.is_rescue_task == True,  # noqa: E712
                    DailyTask.assigned_date == today,
                )
            )
            if existing_rescue.scalar_one() > 0:
                logger.info(
                    "rescue_sprint_already_exists_today",
                    extra={"goal_id": str(goal_id)},
                )
                await db.execute(
                    update(Milestone)
                    .where(Milestone.id == milestone_id)
                    .values(sprint_status="active", generation_started_at=None)
                )
                await db.commit()
                return

            tomorrow = today + timedelta(days=1)

            # Find oldest uncompleted non-rescue task in this sprint
            result = await db.execute(
                select(func.min(DailyTask.assigned_date)).where(
                    DailyTask.goal_id == goal_id,
                    DailyTask.milestone_id == milestone_id,
                    DailyTask.is_completed == False,  # noqa: E712
                    DailyTask.is_rescue_task == False,  # noqa: E712
                )
            )
            oldest_date = result.scalar_one_or_none()

            if oldest_date:
                shift_days = (tomorrow - oldest_date).days
                if shift_days > 0:
                    # Use timedelta — PostgreSQL date + integer is not valid SQL
                    await db.execute(
                        update(DailyTask)
                        .where(
                            DailyTask.goal_id == goal_id,
                            DailyTask.milestone_id == milestone_id,
                            DailyTask.is_completed == False,  # noqa: E712
                            DailyTask.is_rescue_task == False,  # noqa: E712
                        )
                        .values(
                            assigned_date=DailyTask.assigned_date + timedelta(days=shift_days)
                        )
                    )

            # Generate 2 AI micro-tasks via Gemini
            rescue_tasks = await generate_rescue_tasks(
                goal_title=goal.smart_title,
                goal_description=goal.smart_description,
            )

            # Insert rescue tasks assigned to today
            for i, task_output in enumerate(rescue_tasks):
                db.add(
                    DailyTask(
                        goal_id=goal_id,
                        milestone_id=milestone_id,
                        description=task_output.description,
                        tip=task_output.tip,
                        assigned_date=today,
                        is_rescue_task=True,
                        position=i,
                    )
                )

            # Restore milestone to active
            milestone.sprint_status = "active"
            milestone.generation_started_at = None
            await db.commit()

            logger.info("rescue_sprint_complete", extra={"goal_id": str(goal_id)})

        except Exception:
            logger.exception("rescue_sprint_failed", extra={"goal_id": str(goal_id)})
            # Session may be rolled back; use UPDATE statement (not ORM mutation)
            # to avoid DetachedInstanceError — same pattern as _pre_generate_sprint
            try:
                await db.execute(
                    update(Milestone)
                    .where(Milestone.id == milestone_id)
                    .values(sprint_status="failed", generation_started_at=None)
                )
                await db.commit()
            except Exception:
                logger.exception(
                    "rescue_sprint_failed_to_mark_failed",
                    extra={"goal_id": str(goal_id)},
                )
