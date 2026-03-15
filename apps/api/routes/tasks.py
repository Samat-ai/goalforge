"""Daily task routes."""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user_id
from database import get_db
from models import DailyTask, Goal
from schemas import TaskResponse, TaskUpdate
from services.task_service import complete_task_and_award_points

router = APIRouter()


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
    goal_result = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = goal_result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    if goal.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    query = select(DailyTask).where(DailyTask.goal_id == goal_id)
    if assigned_date:
        query = query.where(DailyTask.assigned_date == assigned_date)
    result = await db.execute(query.order_by(DailyTask.assigned_date))
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
    result = await db.execute(select(DailyTask).where(DailyTask.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    # Load goal early for ownership check and star points
    goal_result = await db.execute(select(Goal).where(Goal.id == task.goal_id))
    goal = goal_result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    if goal.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

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
    result = await db.execute(select(DailyTask).where(DailyTask.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    goal_result = await db.execute(select(Goal).where(Goal.id == task.goal_id))
    goal = goal_result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    if goal.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
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
    result = await db.execute(select(DailyTask).where(DailyTask.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    goal_result = await db.execute(select(Goal).where(Goal.id == task.goal_id))
    goal = goal_result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    if goal.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if task.is_completed:
        raise HTTPException(status_code=400, detail="Cannot delete a completed task")

    await db.delete(task)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
