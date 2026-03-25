"""User profile and settings routes."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user_id
from database import get_db
from models import DailyTask, Goal, User
from schemas import BadgeResponse, UserProfileResponse, UserSettingsUpdate

router = APIRouter()


def _streak_length(completed_days: list[str]) -> int:
    if not completed_days:
        return 0
    sorted_days = sorted(set(completed_days), reverse=True)
    streak = 1
    for i in range(1, len(sorted_days)):
        prev = date.fromisoformat(sorted_days[i - 1])
        curr = date.fromisoformat(sorted_days[i])
        if (prev - curr).days == 1:
            streak += 1
        else:
            break
    return streak


@router.get(
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
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
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
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.timezone is not None:
        user.timezone = payload.timezone
    if payload.display_name is not None:
        user.display_name = payload.display_name
    await db.commit()
    await db.refresh(user)
    return user


@router.get(
    "/users/{user_id}/badges",
    response_model=list[BadgeResponse],
    summary="Get achievement badge progress",
)
async def get_user_badges(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    goals = (
        await db.execute(
            select(Goal).where(Goal.user_id == user_id)
        )
    ).scalars().all()
    tasks = (
        await db.execute(
            select(DailyTask).join(Goal, DailyTask.goal_id == Goal.id).where(Goal.user_id == user_id)
        )
    ).scalars().all()

    completed_tasks = sum(1 for t in tasks if t.is_completed)
    achieved_goals = sum(1 for g in goals if g.status == "achieved")
    completed_days = sorted({t.assigned_date.isoformat() for t in tasks if t.is_completed})
    streak = _streak_length(completed_days)

    return [
        BadgeResponse(
            key="first_light",
            title="First Light",
            description="Complete your first task.",
            unlocked=completed_tasks >= 1,
            current=min(completed_tasks, 1),
            target=1,
        ),
        BadgeResponse(
            key="streak_spark",
            title="Streak Spark",
            description="Maintain a 3-day streak.",
            unlocked=streak >= 3,
            current=min(streak, 3),
            target=3,
        ),
        BadgeResponse(
            key="goal_master",
            title="Goal Master",
            description="Achieve your first full goal.",
            unlocked=achieved_goals >= 1,
            current=min(achieved_goals, 1),
            target=1,
        ),
        BadgeResponse(
            key="consistency_forge",
            title="Consistency Forge",
            description="Complete 20 tasks.",
            unlocked=completed_tasks >= 20,
            current=min(completed_tasks, 20),
            target=20,
        ),
    ]
