"""
GoalForge API — entry point.

Start with:
    uvicorn main:app --reload --port 8000
"""

import logging
import uuid
from datetime import date, datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ai_utils import generate_smart_goal
from database import engine, get_db, Base
from models import DailyTask, Goal, User
from schemas import GoalCreate, GoalResponse, TaskResponse, TaskUpdate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="GoalForge API",
    version="0.1.0",
    description="AI-powered goal-tracking backend",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def on_startup():
    # In production use Alembic migrations; this is convenient for dev.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("GoalForge API started.")


# ---------------------------------------------------------------------------
# Helper — resolve or create a User from a Clerk user_id header
# ---------------------------------------------------------------------------

async def get_or_create_user(
    user_id: str,
    email: str,
    db: AsyncSession,
) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(id=user_id, email=email)
        db.add(user)
        await db.flush()
    return user


# ---------------------------------------------------------------------------
# Goals
# ---------------------------------------------------------------------------

@app.post(
    "/users/{user_id}/goals",
    response_model=GoalResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a SMART goal from raw user input",
)
async def create_goal(
    user_id: str,
    payload: GoalCreate,
    email: str = "unknown@example.com",  # In real app, extract from Clerk JWT
    db: AsyncSession = Depends(get_db),
):
    user = await get_or_create_user(user_id, email, db)

    # --- Call Gemini to generate the structured goal ---
    try:
        ai_output = await generate_smart_goal(payload.raw_input)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    goal = Goal(
        id=uuid.uuid4(),
        user_id=user.id,
        raw_input=payload.raw_input,
        smart_title=ai_output.smart_title,
        smart_description=ai_output.smart_description,
        goal_type=ai_output.goal_type,
        target_date=ai_output.target_date,
        milestones=ai_output.milestones,
        status="active",
    )
    db.add(goal)
    await db.flush()  # get goal.id before inserting tasks

    for task_data in ai_output.initial_tasks:
        task = DailyTask(
            id=uuid.uuid4(),
            goal_id=goal.id,
            description=task_data.description,
            tip=task_data.tip,
            assigned_date=task_data.assigned_date,
        )
        db.add(task)

    await db.flush()

    # Reload with relationships for the response
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.daily_tasks))
        .where(Goal.id == goal.id)
    )
    goal = result.scalar_one()
    return goal


@app.get(
    "/users/{user_id}/goals",
    response_model=list[GoalResponse],
    summary="List all goals for a user",
)
async def list_goals(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.daily_tasks))
        .where(Goal.user_id == user_id)
        .order_by(Goal.created_at.desc())
    )
    return result.scalars().all()


@app.get(
    "/goals/{goal_id}",
    response_model=GoalResponse,
    summary="Get a single goal by ID",
)
async def get_goal(goal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.daily_tasks))
        .where(Goal.id == goal_id)
    )
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


# ---------------------------------------------------------------------------
# Daily Tasks
# ---------------------------------------------------------------------------

@app.get(
    "/goals/{goal_id}/tasks",
    response_model=list[TaskResponse],
    summary="List tasks for a goal, optionally filtered by date",
)
async def list_tasks(
    goal_id: uuid.UUID,
    assigned_date: date | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(DailyTask).where(DailyTask.goal_id == goal_id)
    if assigned_date:
        query = query.where(DailyTask.assigned_date == assigned_date)
    result = await db.execute(query.order_by(DailyTask.assigned_date))
    return result.scalars().all()


@app.patch(
    "/tasks/{task_id}/complete",
    response_model=TaskResponse,
    summary="Mark a daily task as completed",
)
async def complete_task(task_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DailyTask).where(DailyTask.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.is_completed:
        raise HTTPException(status_code=400, detail="Task already completed")

    task.is_completed = True
    task.completed_at = datetime.now(timezone.utc)
    await db.flush()
    return task


@app.patch(
    "/tasks/{task_id}",
    response_model=TaskResponse,
    summary="Update a pending task's description",
)
async def update_task(
    task_id: uuid.UUID,
    body: TaskUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(DailyTask).where(DailyTask.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.is_completed:
        raise HTTPException(status_code=400, detail="Cannot edit a completed task")

    task.description = body.description
    await db.flush()
    return task


@app.delete(
    "/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a pending task",
)
async def delete_task(task_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DailyTask).where(DailyTask.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.is_completed:
        raise HTTPException(status_code=400, detail="Cannot delete a completed task")

    await db.delete(task)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}
