"""Energy resize routes — low-energy day task fragmentation."""

import asyncio
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai_utils import resize_task_for_low_energy
from auth import get_current_user_id
from database import get_db
from models import DailyTask, Goal, Milestone, User
from rate_limiting import _user_key, rate_limit
from schemas import EnergyResizeResponse, TaskResponse
from utils import user_today

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/users/{user_id}/energy-resize",
    response_model=EnergyResizeResponse,
    summary="Bulk-resize today's pending tasks into 3-minute first steps",
)
@rate_limit("3/hour", key_func=_user_key)
async def energy_resize(
    request: Request,
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if current_user_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    today = user_today(user.timezone)

    stmt = (
        select(DailyTask)
        .join(Goal, DailyTask.goal_id == Goal.id)
        .where(
            Goal.user_id == user_id,
            Goal.status == "active",
            DailyTask.assigned_date == today,
            DailyTask.is_completed.is_(False),
        )
        .order_by(DailyTask.assigned_date, DailyTask.position)
    )
    result = await db.execute(stmt)
    all_tasks = list(result.scalars().all())

    to_resize = [t for t in all_tasks if t.original_description is None]

    if not to_resize:
        return EnergyResizeResponse(
            tasks_resized=0,
            tasks=[TaskResponse.model_validate(t) for t in all_tasks],
        )

    to_resize = to_resize[:10]  # cap at 10 Gemini calls

    goal_ids = {t.goal_id for t in to_resize}
    milestone_ids = {t.milestone_id for t in to_resize if t.milestone_id}

    goals_result = await db.execute(select(Goal).where(Goal.id.in_(goal_ids)))
    goals_map = {g.id: g for g in goals_result.scalars().all()}

    milestones_map: dict = {}
    if milestone_ids:
        ms_result = await db.execute(
            select(Milestone).where(Milestone.id.in_(milestone_ids))
        )
        milestones_map = {m.id: m for m in ms_result.scalars().all()}

    async def _resize_one(task: DailyTask):
        goal = goals_map.get(task.goal_id)
        goal_context = (
            f"{goal.smart_title}: {goal.smart_description}" if goal else ""
        )
        milestone = milestones_map.get(task.milestone_id) if task.milestone_id else None
        sprint_theme = milestone.sprint_theme if milestone else ""
        return await resize_task_for_low_energy(
            goal_context=goal_context,
            sprint_theme=sprint_theme,
            original_description=task.description,
            assigned_date=task.assigned_date,
        )

    raw_results = await asyncio.gather(
        *[_resize_one(t) for t in to_resize],
        return_exceptions=True,
    )

    tasks_resized = 0
    for task, res in zip(to_resize, raw_results):
        if isinstance(res, Exception):
            logger.warning("Energy resize skipped task %s: %s", task.id, res)
            continue
        # IMPORTANT: only consume description and tip — never assigned_date
        task.original_description = task.description
        task.original_tip = task.tip
        task.description = res.description
        task.tip = res.tip
        tasks_resized += 1

    await db.flush()

    return EnergyResizeResponse(
        tasks_resized=tasks_resized,
        tasks=[TaskResponse.model_validate(t) for t in all_tasks],
    )
