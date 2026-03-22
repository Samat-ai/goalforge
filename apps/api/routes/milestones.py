"""Milestone advancement routes."""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete as sql_delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ai_utils import generate_sprint_tasks
from auth import get_current_user_id
from services.task_service import create_sprint_tasks
from database import get_db
from deps import _load_goal_with_ownership
from exceptions import AIGenerationError
from models import DailyTask, Goal, Milestone, User
from rate_limiting import _user_key, rate_limit
from schemas import GoalResponse
from utils import user_today

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/goals/{goal_id}/milestones/{milestone_id}/complete",
    response_model=GoalResponse,
    summary="Mark a sprint complete and unlock the next sprint",
)
@rate_limit("10/minute", key_func=_user_key)
async def complete_milestone(
    request: Request,
    goal_id: uuid.UUID,
    milestone_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # Verify goal ownership before touching milestone data
    goal_obj = await _load_goal_with_ownership(goal_id, current_user_id, db)

    # Load and validate milestone
    ms_result = await db.execute(
        select(Milestone)
        .where(Milestone.id == milestone_id, Milestone.goal_id == goal_id)
        .with_for_update()
    )
    milestone = ms_result.scalar_one_or_none()
    if milestone is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    if milestone.is_completed:
        raise HTTPException(status_code=400, detail="Milestone already completed")

    # Mark current milestone complete
    milestone.is_completed = True
    milestone.completed_at = datetime.now(timezone.utc)
    milestone.sprint_status = "completed"
    await db.flush()

    # Find and activate next milestone (if any)
    next_ms_result = await db.execute(
        select(Milestone)
        .where(Milestone.goal_id == goal_id, Milestone.position == milestone.position + 1)
        .with_for_update()
    )
    next_ms = next_ms_result.scalar_one_or_none()

    if next_ms:
        user_result = await db.execute(select(User).where(User.id == current_user_id))
        user_obj = user_result.scalar_one_or_none()
        if user_obj is None:
            logger.warning("complete_milestone: user row not found for %s, defaulting to UTC", current_user_id)
        today = user_today(user_obj.timezone if user_obj else "UTC")

        if next_ms.sprint_status == "ready":
            # Pre-gen succeeded — shift task dates to start from today
            tasks_result = await db.execute(
                select(DailyTask)
                .where(DailyTask.milestone_id == next_ms.id)
                .order_by(DailyTask.assigned_date)
            )
            for i, t in enumerate(tasks_result.scalars().all()):
                t.assigned_date = today + timedelta(days=i)
            next_ms.sprint_status = "active"

        elif next_ms.sprint_status in ("pending", "failed"):
            # No tasks yet — generate synchronously (goal_obj already loaded above)
            goal_context = f"{goal_obj.smart_title}: {goal_obj.smart_description}"
            try:
                task_outputs = await generate_sprint_tasks(
                    goal_context, next_ms.sprint_theme, today
                )
            except AIGenerationError as exc:
                raise HTTPException(status_code=502, detail=str(exc))
            await create_sprint_tasks(db, goal_id, next_ms.id, task_outputs, today)
            next_ms.sprint_status = "active"

        elif next_ms.sprint_status == "generating":
            # Still in flight — mark active so frontend shows the sprint; tasks
            # will appear once the background task commits them.
            next_ms.sprint_status = "active"

        await db.flush()

    # Return full goal with updated milestones and tasks
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.id == goal_id)
    )
    return result.scalar_one()


@router.post(
    "/goals/{goal_id}/milestones/{milestone_id}/retry-generation",
    response_model=GoalResponse,
    summary="Retry AI task generation for a failed or task-empty sprint",
)
@rate_limit("5/minute", key_func=_user_key)
async def retry_sprint_generation(
    request: Request,
    goal_id: uuid.UUID,
    milestone_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    goal_obj = await _load_goal_with_ownership(goal_id, current_user_id, db)

    ms_result = await db.execute(
        select(Milestone)
        .where(Milestone.id == milestone_id, Milestone.goal_id == goal_id)
        .with_for_update()
    )
    milestone = ms_result.scalar_one_or_none()
    if milestone is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    if milestone.is_completed:
        raise HTTPException(status_code=400, detail="Milestone already completed")
    if milestone.sprint_status not in ("failed", "active"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry milestone in status '{milestone.sprint_status}'",
        )

    user_result = await db.execute(select(User).where(User.id == current_user_id))
    user_obj = user_result.scalar_one_or_none()
    today = user_today(user_obj.timezone if user_obj else "UTC")

    goal_context = f"{goal_obj.smart_title}: {goal_obj.smart_description}"
    try:
        task_outputs = await generate_sprint_tasks(
            goal_context, milestone.sprint_theme, today
        )
    except AIGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    # Remove any existing tasks before inserting new ones (prevents duplication
    # if background pre-gen committed tasks between the status check and here)
    await db.execute(sql_delete(DailyTask).where(DailyTask.milestone_id == milestone_id))

    await create_sprint_tasks(db, goal_id, milestone_id, task_outputs, today)
    milestone.sprint_status = "active"
    await db.flush()

    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.id == goal_id)
    )
    return result.scalar_one()
