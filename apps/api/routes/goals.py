"""Goal CRUD routes."""

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user_email, get_current_user_id
from database import get_db
from deps import _ensure_owner, _load_goal_with_ownership, get_or_create_user, load_full_goal
from models import Goal, Milestone, User
from services.goal_service import _generate_goal_async, PLACEHOLDER_MILESTONE_TITLE
from services.rescue_service import _execute_rescue_sprint
from rate_limiting import _user_key, rate_limit
from schemas import GoalCreate, GoalResponse, GoalStatusUpdate, PaginatedGoalsResponse
from utils import user_today

router = APIRouter()


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
    _ensure_owner(user_id, current_user_id)
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
    return await load_full_goal(goal.id, db)


@router.get(
    "/users/{user_id}/goals",
    response_model=PaginatedGoalsResponse,
    summary="List all goals for a user",
)
async def list_goals(
    request: Request,
    response: Response,
    user_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)
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

    # ETag: stable hash of goal IDs + their updated_at timestamps + total count.
    # Lets clients skip re-parsing an unchanged list.
    etag_source = f"{total}:" + ",".join(
        f"{g.id}:{g.updated_at.isoformat() if g.updated_at else ''}" for g in items
    )
    etag = f'"{hashlib.md5(etag_source.encode()).hexdigest()}"'  # noqa: S324 — non-crypto use
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "private, no-cache"  # revalidate, don't serve stale
    if request.headers.get("If-None-Match") == etag:
        return Response(status_code=304)

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
    return await _load_goal_with_ownership(goal_id, current_user_id, db, full=True)


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
    goal = await _load_goal_with_ownership(
        goal_id, current_user_id, db, full=True, for_update=True
    )

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
    goal = await _load_goal_with_ownership(goal_id, current_user_id, db, full=True)

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
    return await load_full_goal(goal_id, db)
