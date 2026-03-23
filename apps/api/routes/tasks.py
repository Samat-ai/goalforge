"""Daily task routes."""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ai_utils import regenerate_single_task
from auth import get_current_user_id
from database import get_db
from deps import _load_goal_with_ownership
from models import DailyTask, Goal, Milestone
from schemas import (
    TaskCreate,
    TaskReorderRequest,
    TaskResponse,
    TaskUpdate,
)
from services.task_service import complete_task_and_award_points

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _load_task_with_ownership(
    task_id: uuid.UUID, current_user_id: str, db: AsyncSession,
) -> tuple[DailyTask, Goal]:
    result = await db.execute(select(DailyTask).where(DailyTask.id == task_id).with_for_update())
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    goal = await _load_goal_with_ownership(task.goal_id, current_user_id, db)
    return task, goal


# ---------------------------------------------------------------------------
# Existing endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/goals/{goal_id}/tasks",
    response_model=list[TaskResponse],
    summary="List tasks for a goal, optionally filtered by date",
)
async def list_tasks(
    goal_id: uuid.UUID,
    assigned_date: date | None = None,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await _load_goal_with_ownership(goal_id, current_user_id, db)

    query = select(DailyTask).where(DailyTask.goal_id == goal_id)
    if assigned_date:
        query = query.where(DailyTask.assigned_date == assigned_date)
    result = await db.execute(query.order_by(DailyTask.assigned_date, DailyTask.position))
    return result.scalars().all()


@router.patch(
    "/tasks/{task_id}/complete",
    response_model=TaskResponse,
    summary="Mark a daily task as completed and award star points",
)
async def complete_task(
    task_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    task, goal = await _load_task_with_ownership(task_id, current_user_id, db)

    if task.is_completed:
        raise HTTPException(status_code=400, detail="Task already completed")

    await complete_task_and_award_points(task, goal, db)
    return task


@router.patch(
    "/tasks/{task_id}",
    response_model=TaskResponse,
    summary="Update a pending task's description",
)
async def update_task(
    task_id: uuid.UUID,
    body: TaskUpdate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    task, _ = await _load_task_with_ownership(task_id, current_user_id, db)
    if task.is_completed:
        raise HTTPException(status_code=400, detail="Cannot edit a completed task")

    task.description = body.description
    await db.flush()
    return task


@router.delete(
    "/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a pending task",
)
async def delete_task(
    task_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    task, _ = await _load_task_with_ownership(task_id, current_user_id, db)
    if task.is_completed:
        raise HTTPException(status_code=400, detail="Cannot delete a completed task")

    await db.delete(task)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# New endpoints: create, reorder, regenerate
# ---------------------------------------------------------------------------

@router.post(
    "/goals/{goal_id}/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a custom task to a goal's active sprint",
)
async def create_task(
    goal_id: uuid.UUID,
    body: TaskCreate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    goal = await _load_goal_with_ownership(goal_id, current_user_id, db)

    # Resolve milestone — use provided or fall back to active milestone
    milestone_id = body.milestone_id
    if milestone_id is None:
        ms_result = await db.execute(
            select(Milestone)
            .where(Milestone.goal_id == goal_id, Milestone.sprint_status == "active")
        )
        active_ms = ms_result.scalar_one_or_none()
        milestone_id = active_ms.id if active_ms else None

    assigned = body.assigned_date or date.today()

    # Compute next position for tasks with same milestone + date
    max_pos = (await db.execute(
        select(func.coalesce(func.max(DailyTask.position), -1))
        .where(DailyTask.goal_id == goal_id, DailyTask.assigned_date == assigned)
    )).scalar_one()

    task = DailyTask(
        id=uuid.uuid4(),
        goal_id=goal.id,
        milestone_id=milestone_id,
        description=body.description,
        tip=body.tip,
        assigned_date=assigned,
        position=max_pos + 1,
    )
    db.add(task)
    await db.flush()
    return task


@router.put(
    "/goals/{goal_id}/tasks/reorder",
    response_model=list[TaskResponse],
    summary="Bulk-update task positions for a goal",
)
async def reorder_tasks(
    goal_id: uuid.UUID,
    body: TaskReorderRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await _load_goal_with_ownership(goal_id, current_user_id, db)

    task_ids = [item.id for item in body.tasks]
    result = await db.execute(
        select(DailyTask).where(DailyTask.id.in_(task_ids))
    )
    tasks = {t.id: t for t in result.scalars().all()}

    # Verify all IDs exist and belong to this goal
    for item in body.tasks:
        task = tasks.get(item.id)
        if task is None:
            raise HTTPException(status_code=404, detail=f"Task {item.id} not found")
        if task.goal_id != goal_id:
            raise HTTPException(status_code=400, detail=f"Task {item.id} does not belong to this goal")
        task.position = item.position

    await db.flush()
    return list(tasks.values())


@router.post(
    "/tasks/{task_id}/regenerate",
    response_model=TaskResponse,
    summary="Regenerate a task description via AI",
)
async def regenerate_task(
    task_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    task, goal = await _load_task_with_ownership(task_id, current_user_id, db)
    if task.is_completed:
        raise HTTPException(status_code=400, detail="Cannot regenerate a completed task")

    # Build context for AI
    goal_context = f"{goal.smart_title}: {goal.smart_description}"
    sprint_theme = ""
    if task.milestone_id:
        ms_result = await db.execute(
            select(Milestone).where(Milestone.id == task.milestone_id)
        )
        ms = ms_result.scalar_one_or_none()
        if ms:
            sprint_theme = ms.sprint_theme

    try:
        new_task = await regenerate_single_task(
            goal_context=goal_context,
            sprint_theme=sprint_theme,
            assigned_date=task.assigned_date,
            current_description=task.description,
        )
    except Exception:
        raise HTTPException(status_code=503, detail="AI generation failed. Please try again.")

    task.description = new_task.description
    task.tip = new_task.tip
    await db.flush()
    return task
