"""User profile and settings routes."""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai_utils import generate_weekly_coach_recommendation
from auth import get_current_user_id
from database import get_db
from deps import _ensure_owner, _load_user_with_ownership
from exceptions import AIGenerationError
from models import DailyTask, Goal, User, WeeklyReflection
from rate_limiting import rate_limit, _user_key
from schemas import (
    UserProfileResponse,
    UserSettingsUpdate,
    WeeklyReflectionCreate,
    WeeklyReflectionResponse,
    WeeklyReviewResponse,
)
from utils import user_today

router = APIRouter()


@router.get(
    "/users/{user_id}/profile",
    summary="Get user profile (star_points etc.)",
)
async def get_user_profile(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await _load_user_with_ownership(user_id, current_user_id, db)
    return {"star_points": user.star_points}


@router.get(
    "/users/{user_id}/settings",
    response_model=UserProfileResponse,
    summary="Get user settings (timezone, display_name)",
)
async def get_user_settings(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await _load_user_with_ownership(user_id, current_user_id, db)
    return user


@router.patch(
    "/users/{user_id}/settings",
    response_model=UserProfileResponse,
    summary="Update user settings (timezone, display_name)",
)
async def update_user_settings(
    user_id: str,
    payload: UserSettingsUpdate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await _load_user_with_ownership(user_id, current_user_id, db)
    if payload.timezone is not None:
        user.timezone = payload.timezone
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.reminder_enabled is not None:
        user.reminder_enabled = payload.reminder_enabled
    if payload.reminder_hour is not None:
        user.reminder_hour = payload.reminder_hour
    await db.commit()
    await db.refresh(user)
    return user


@router.post(
    "/users/{user_id}/weekly-reflection",
    response_model=WeeklyReflectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit weekly reflection and get AI coaching recommendation",
)
@rate_limit("3/day", key_func=_user_key)
async def create_weekly_reflection(
    request: Request,
    user_id: str,
    payload: WeeklyReflectionCreate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    end_date = user_today(user.timezone)
    start_date = end_date - timedelta(days=6)
    rows = (
        await db.execute(
            select(DailyTask.assigned_date, DailyTask.is_completed)
            .join(Goal, DailyTask.goal_id == Goal.id)
            .where(
                Goal.user_id == user_id,
                DailyTask.assigned_date >= start_date,
                DailyTask.assigned_date <= end_date,
            )
        )
    ).all()
    total = len(rows)
    completed = sum(1 for row in rows if row.is_completed)
    completion_rate = (completed / total) if total else 0.0
    overdue = sum(1 for row in rows if (not row.is_completed) and row.assigned_date < end_date)

    try:
        recommendation = await generate_weekly_coach_recommendation(
            payload.went_well,
            payload.blockers,
            payload.week_rating,
            completion_rate,
            overdue,
        )
    except AIGenerationError:
        if completion_rate < 0.5:
            recommendation = "Pick one 10-minute anchor task for the same time each day this week, and complete it before anything else."
        else:
            recommendation = "Keep your strongest routine block and remove one recurring blocker by pre-planning tomorrow's first task tonight."

    reflection = WeeklyReflection(
        user_id=user_id,
        went_well=payload.went_well,
        blockers=payload.blockers,
        week_rating=payload.week_rating,
        coach_recommendation=recommendation,
    )
    db.add(reflection)
    await db.flush()
    await db.refresh(reflection)
    return reflection


@router.get(
    "/users/{user_id}/weekly-reflection/latest",
    response_model=WeeklyReflectionResponse,
    summary="Get latest weekly reflection",
)
async def get_latest_weekly_reflection(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)

    reflection = (
        await db.execute(
            select(WeeklyReflection)
            .where(WeeklyReflection.user_id == user_id)
            .order_by(WeeklyReflection.created_at.desc())
        )
    ).scalars().first()

    if reflection is None:
        raise HTTPException(status_code=404, detail="No weekly reflection found")
    return reflection


@router.get(
    "/users/{user_id}/weekly-review",
    response_model=WeeklyReviewResponse,
    summary="Get weekly review metrics and recommendation",
)
async def get_weekly_review(
    user_id: str,
    days: int = Query(7, ge=3, le=14),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    end_date = user_today(user.timezone)
    start_date = end_date - timedelta(days=days - 1)

    tasks_result = await db.execute(
        select(DailyTask.assigned_date, DailyTask.is_completed)
        .join(Goal, DailyTask.goal_id == Goal.id)
        .where(
            Goal.user_id == user_id,
            DailyTask.assigned_date >= start_date,
            DailyTask.assigned_date <= end_date,
        )
    )
    rows = tasks_result.all()

    total_tasks = len(rows)
    completed_tasks = sum(1 for row in rows if row.is_completed)
    completed_days = len({row.assigned_date for row in rows if row.is_completed})
    overdue_tasks = sum(1 for row in rows if (not row.is_completed) and row.assigned_date < end_date)
    completion_rate = (completed_tasks / total_tasks) if total_tasks > 0 else 0.0

    if total_tasks == 0:
        risk_level = "medium"
        recommendation = "Start with one tiny task today to kick off a fresh weekly arc."
    elif completion_rate >= 0.8 and overdue_tasks == 0:
        risk_level = "low"
        recommendation = "Great consistency this week. Keep difficulty balanced and protect your routine."
    elif completion_rate >= 0.5:
        risk_level = "medium"
        recommendation = "Solid momentum. Clear one overdue task first, then lock in one focus task for today."
    else:
        risk_level = "high"
        recommendation = "Shrink today to one 2-minute action and rebuild confidence with a guaranteed win."

    return WeeklyReviewResponse(
        start_date=start_date,
        end_date=end_date,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        completion_rate=round(completion_rate, 4),
        completed_days=completed_days,
        overdue_tasks=overdue_tasks,
        risk_level=risk_level,
        recommendation=recommendation,
    )
