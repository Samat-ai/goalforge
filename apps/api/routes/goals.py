"""Goal CRUD routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ai_utils import generate_smart_goal
from auth import get_current_user_email, get_current_user_id
from database import get_db
from deps import _load_goal_with_ownership
from exceptions import AIGenerationError
from models import DailyTask, Goal, Milestone, User
from rate_limiting import _user_key, rate_limit
from schemas import (
    GoalCreate, GoalProgressUpdate, GoalResponse, GoalStatusUpdate,
    PaginatedGoalsResponse,
)
from utils import user_today

router = APIRouter()


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


@router.post(
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
        ai_output = await generate_smart_goal(payload.raw_input, today=user_today(user.timezone))
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


@router.get(
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


@router.get(
    "/goals/{goal_id}",
    response_model=GoalResponse,
    summary="Get a single goal by ID",
)
async def get_goal(
    goal_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await _load_goal_with_ownership(goal_id, current_user_id, db)  # 403/404 guard
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.id == goal_id)
    )
    return result.scalar_one()


@router.patch(
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
    await _load_goal_with_ownership(goal_id, current_user_id, db)  # 403/404 guard
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.id == goal_id)
        .with_for_update()
    )
    goal = result.scalar_one()

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


@router.patch(
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
    await _load_goal_with_ownership(goal_id, current_user_id, db)  # 403/404 guard
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.id == goal_id)
    )
    goal = result.scalar_one()

    goal.progress = body.progress
    await db.flush()
    return goal


@router.delete(
    "/goals/{goal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Permanently delete a goal and all its tasks",
)
async def delete_goal(
    goal_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    goal = await _load_goal_with_ownership(goal_id, current_user_id, db)
    await db.delete(goal)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
