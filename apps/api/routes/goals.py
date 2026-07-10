"""Goal CRUD routes."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user_email, get_current_user_id
from database import get_db
from deps import _load_goal_with_ownership
from models import Goal, Milestone, User
from services.goal_service import _generate_goal_async, PLACEHOLDER_MILESTONE_TITLE
from services.rescue_service import _execute_rescue_sprint
from rate_limiting import _user_key, rate_limit
from schemas import (
    CursorPage,
    GoalCreate, GoalProgressUpdate, GoalResponse, GoalStatusUpdate,
    PaginatedGoalsResponse,
)
from utils import decode_cursor, encode_cursor, user_today

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
    status_code=status.HTTP_202_ACCEPTED,
    summary="Create a SMART goal from raw user input (two-phase: returns immediately)",
)
@rate_limit("5/minute", key_func=_user_key)
async def create_goal(
    request: Request,
    user_id: str,
    payload: GoalCreate,
    background_tasks: BackgroundTasks,
    current_user_id: str = Depends(get_current_user_id),
    current_user_email: str = Depends(get_current_user_email),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    user = await get_or_create_user(user_id, current_user_email, db)
    user_timezone = user.timezone  # capture before session closes

    today = user_today(user_timezone)

    # Phase 1: save placeholder goal + milestone immediately
    goal = Goal(
        id=uuid.uuid4(),
        user_id=user.id,
        raw_input=payload.raw_input,
        smart_title=payload.raw_input,          # placeholder — overwritten in Phase 2
        smart_description="",                    # placeholder
        goal_type="personal",                    # placeholder
        target_date=today + timedelta(days=35),  # placeholder (5 sprints x 7 days)
        status="active",
    )
    db.add(goal)
    await db.flush()

    placeholder_ms = Milestone(
        id=uuid.uuid4(),
        goal_id=goal.id,
        title=PLACEHOLDER_MILESTONE_TITLE,
        position=1,
        is_final=False,
        sprint_theme="",
        sprint_status="generating",
        generation_started_at=datetime.now(timezone.utc),
    )
    db.add(placeholder_ms)
    await db.flush()

    # Phase 2: enqueue AI generation as a background task
    background_tasks.add_task(
        _generate_goal_async,
        goal_id=goal.id,
        user_id=user.id,
        user_timezone=user_timezone,
        raw_input=payload.raw_input,
    )

    # Return the placeholder goal (milestones eagerly loaded)
    result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.id == goal.id)
    )
    return result.scalar_one()


@router.get(
    "/users/{user_id}/goals",
    response_model=CursorPage[GoalResponse],
    summary="List all goals for a user",
)
async def list_goals(
    user_id: str,
    cursor: str | None = Query(None),
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

    base_query = (
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.user_id == user_id)
        .order_by(Goal.created_at.desc())
    )

    if cursor is not None:
        # Cursor-based keyset pagination: decode cursor to created_at timestamp
        try:
            cursor_ts_str = decode_cursor(cursor)
            cursor_ts = datetime.fromisoformat(cursor_ts_str)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid cursor")
        result = await db.execute(
            base_query
            .where(Goal.created_at < cursor_ts)
            .limit(limit)
        )
    else:
        # Legacy offset-based behaviour (no cursor supplied)
        result = await db.execute(base_query.limit(limit).offset(offset))

    items = list(result.scalars().all())

    # Lazy eval: reset milestones stuck in "generating" for >5 minutes to "failed"
    stale_threshold = datetime.now(timezone.utc) - timedelta(minutes=5)
    mutated = False
    for goal in items:
        for ms in goal.milestones:
            if (
                ms.sprint_status == "generating"
                and ms.generation_started_at is not None
            ):
                started = ms.generation_started_at
                # normalize naive datetimes from SQLite (production PostgreSQL is always aware)
                if started.tzinfo is None:
                    started = started.replace(tzinfo=timezone.utc)
                if started < stale_threshold:
                    ms.sprint_status = "failed"
                    mutated = True
    if mutated:
        await db.flush()

    has_more = len(items) == limit
    next_cursor: str | None = None
    if has_more and items:
        last_ts = items[-1].created_at
        if last_ts.tzinfo is None:
            last_ts = last_ts.replace(tzinfo=timezone.utc)
        next_cursor = encode_cursor(last_ts.isoformat())

    return CursorPage(items=items, next_cursor=next_cursor, has_more=has_more, total=total)


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

    # Award 100 star points exactly once per goal (idempotency flag prevents farming via re-activation)
    if body.status == "achieved" and not goal.achievement_reward_granted:
        await db.execute(
            sql_update(User)
            .where(User.id == goal.user_id)
            .values(star_points=User.star_points + 100)
        )
        goal.achievement_reward_granted = True

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


@router.post("/goals/{goal_id}/rescue", response_model=GoalResponse, status_code=202, summary="Trigger a Recovery Sprint for a stalled goal")
@rate_limit("10/minute", key_func=_user_key)
async def trigger_rescue_sprint(
    request: Request,
    goal_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a Recovery Sprint: shift uncompleted tasks + generate 2 AI micro-tasks."""
    await _load_goal_with_ownership(goal_id, current_user_id, db)  # 403/404 guard

    # Re-fetch with milestones eagerly loaded (async session cannot lazy-load)
    goal_result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones))
        .where(Goal.id == goal_id)
    )
    goal = goal_result.scalar_one()

    if goal.status != "active":
        raise HTTPException(status_code=409, detail="Goal is not active")

    active_milestone = next(
        (m for m in goal.milestones if m.sprint_status in ("active", "ready")),
        None,
    )
    if not active_milestone:
        raise HTTPException(status_code=409, detail="No active sprint to rescue")

    # Set to generating so the frontend shows the loading skeleton
    active_milestone.sprint_status = "generating"
    active_milestone.generation_started_at = datetime.now(timezone.utc)
    await db.commit()  # Must commit before background task — it opens its own session

    background_tasks.add_task(
        _execute_rescue_sprint,
        goal_id=goal_id,
        milestone_id=active_milestone.id,
        user_id=current_user_id,
    )

    # Re-load goal to return the updated state (sprint_status = 'generating')
    result = await db.execute(
        select(Goal)
        .options(
            selectinload(Goal.milestones),
            selectinload(Goal.daily_tasks),
        )
        .where(Goal.id == goal_id)
    )
    return result.scalar_one()
