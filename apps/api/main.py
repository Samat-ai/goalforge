"""
GoalForge API — entry point.

Start with:
    uvicorn main:app --reload --port 8000
"""

import asyncio
import logging
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from ai_utils import generate_smart_goal, generate_sprint_tasks
from auth import get_current_user_email, get_current_user_id
from config import settings
from exceptions import AIGenerationError
from database import engine, get_db, Base
from models import DailyTask, Goal, Milestone, User
from schemas import (
    GoalCreate, GoalProgressUpdate, GoalResponse, GoalStatusUpdate,
    MilestoneResponse, PaginatedGoalsResponse, TaskResponse, TaskUpdate,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="GoalForge API",
    version="0.1.0",
    description="AI-powered goal-tracking backend",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=settings.environment == "production",
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------

def _user_key(request: Request) -> str:
    """Rate-limit key: Clerk user_id from path params, fall back to IP."""
    return request.path_params.get("user_id") or get_remote_address(request)


async def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Rate limit exceeded. Please slow down your requests.",
            "limit": str(exc.detail),
        },
        headers={"Retry-After": "60"},
    )


if settings.rate_limit_enabled:
    _limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
    app.state.limiter = _limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    def rate_limit(limit_str: str, key_func=None):
        kwargs = {"key_func": key_func} if key_func else {}
        return _limiter.limit(limit_str, **kwargs)
else:
    def rate_limit(limit_str: str, key_func=None):  # type: ignore[misc]
        def decorator(func):
            return func
        return decorator


# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def on_startup():
    if settings.environment != "production":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    logger.info("GoalForge API started.")


# ---------------------------------------------------------------------------
# Background helper — pre-generate next sprint tasks
# ---------------------------------------------------------------------------

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

    Status transitions: pending → generating → ready (or failed on error).
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
# Users
# ---------------------------------------------------------------------------

@app.get(
    "/users/{user_id}/profile",
    summary="Get user profile (star_points etc.)",
)
async def get_user_profile(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {"star_points": user.star_points}


# ---------------------------------------------------------------------------
# Goals
# ---------------------------------------------------------------------------

@app.post(
    "/users/{user_id}/goals",
    response_model=GoalResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a SMART goal from raw user input",
)
@rate_limit("5/minute", key_func=_user_key)
async def create_goal(
    request: Request,
    user_id: str,
    payload: GoalCreate,
    current_user_id: str = Depends(get_current_user_id),
    current_user_email: str = Depends(get_current_user_email),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    user = await get_or_create_user(user_id, current_user_email, db)

    try:
        ai_output = await generate_smart_goal(payload.raw_input)
    except AIGenerationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Our AI is temporarily busy. Your goal has been saved — "
                "we'll generate the plan shortly. Please refresh in a minute."
            ),
        )

    goal = Goal(
        id=uuid.uuid4(),
        user_id=user.id,
        raw_input=payload.raw_input,
        smart_title=ai_output.smart_title,
        smart_description=ai_output.smart_description,
        goal_type=ai_output.goal_type,
        target_date=ai_output.target_date,
        status="active",
    )
    db.add(goal)
    await db.flush()

    # Create Milestone rows from AI-generated AIMilestoneConfig objects.
    # Sprint 1 is set to "active"; remaining sprints start as "pending".
    milestone_rows: list[Milestone] = []
    for i, ms_config in enumerate(ai_output.milestones):
        m = Milestone(
            id=uuid.uuid4(),
            goal_id=goal.id,
            title=ms_config.title,
            position=i + 1,
            is_final=ms_config.is_final,
            sprint_theme=ms_config.sprint_theme,
            sprint_status="active" if i == 0 else "pending",
        )
        db.add(m)
        milestone_rows.append(m)
    await db.flush()

    # Sprint 1 tasks are linked to the first milestone.
    first_milestone = milestone_rows[0]
    for task_data in ai_output.initial_tasks:
        task = DailyTask(
            id=uuid.uuid4(),
            goal_id=goal.id,
            milestone_id=first_milestone.id,
            description=task_data.description,
            tip=task_data.tip,
            assigned_date=task_data.assigned_date,
        )
        db.add(task)

    await db.flush()

    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.id == goal.id)
    )
    goal = result.scalar_one()
    return goal


@app.get(
    "/users/{user_id}/goals",
    response_model=PaginatedGoalsResponse,
    summary="List all goals for a user",
)
async def list_goals(
    user_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    total_result = await db.execute(
        select(func.count(Goal.id)).where(Goal.user_id == user_id)
    )
    total = total_result.scalar_one()
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.user_id == user_id)
        .order_by(Goal.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = result.scalars().all()
    return PaginatedGoalsResponse(items=items, total=total, limit=limit, offset=offset)


@app.get(
    "/goals/{goal_id}",
    response_model=GoalResponse,
    summary="Get a single goal by ID",
)
async def get_goal(
    goal_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.id == goal_id)
    )
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    if goal.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return goal


@app.patch(
    "/goals/{goal_id}",
    response_model=GoalResponse,
    summary="Update goal status (active / achieved / abandoned)",
)
async def update_goal_status(
    goal_id: uuid.UUID,
    body: GoalStatusUpdate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.id == goal_id)
    )
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    if goal.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    old_status = goal.status
    goal.status = body.status

    # Award 100 star points the first time a goal is achieved (atomic SQL increment)
    if body.status == "achieved" and old_status != "achieved":
        await db.execute(
            sql_update(User)
            .where(User.id == goal.user_id)
            .values(star_points=User.star_points + 100)
        )

    await db.flush()
    return goal


@app.patch(
    "/goals/{goal_id}/progress",
    response_model=GoalResponse,
    summary="Update goal progress percentage (0-100)",
)
async def update_goal_progress(
    goal_id: uuid.UUID,
    body: GoalProgressUpdate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.id == goal_id)
    )
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    if goal.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    goal.progress = body.progress
    await db.flush()
    return goal


@app.delete(
    "/goals/{goal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Permanently delete a goal and all its tasks",
)
async def delete_goal(
    goal_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    if goal.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    await db.delete(goal)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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


@app.patch(
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
                    asyncio.create_task(_pre_generate_sprint(
                        milestone_id=next_ms.id,
                        goal_id=goal.id,
                        goal_context=goal_context,
                        sprint_theme=next_ms.sprint_theme,
                        start_date=date.today() + timedelta(days=1),
                    ))

    return task


@app.patch(
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


@app.delete(
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


# ---------------------------------------------------------------------------
# Milestones
# ---------------------------------------------------------------------------

@app.post(
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
    goal_check = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal_obj = goal_check.scalar_one_or_none()
    if goal_obj is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    if goal_obj.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Load and validate milestone
    ms_result = await db.execute(
        select(Milestone)
        .where(Milestone.id == milestone_id, Milestone.goal_id == goal_id)
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
    )
    next_ms = next_ms_result.scalar_one_or_none()

    if next_ms:
        today = date.today()

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
            except ValueError as exc:
                raise HTTPException(status_code=502, detail=str(exc))
            for i, task_data in enumerate(task_outputs):
                db.add(DailyTask(
                    id=uuid.uuid4(),
                    goal_id=goal_id,
                    milestone_id=next_ms.id,
                    description=task_data.description,
                    tip=task_data.tip,
                    assigned_date=today + timedelta(days=i),
                ))
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


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}
