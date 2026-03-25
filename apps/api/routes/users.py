"""User profile and settings routes."""

import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user_id
from database import get_db
from models import Goal, Reward, User
from schemas import UserProfileResponse, UserSettingsUpdate

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
    "/users/{user_id}/export",
    summary="Export user data as JSON or CSV",
)
async def export_user_data(
    user_id: str,
    format: str = Query("json", pattern="^(json|csv)$"),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    goals_result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.user_id == user_id)
        .order_by(Goal.created_at.desc())
    )
    goals = goals_result.scalars().all()

    rewards_result = await db.execute(
        select(Reward)
        .where(Reward.user_id == user_id)
        .order_by(Reward.acquired_at.desc())
    )
    rewards = rewards_result.scalars().all()

    if format == "json":
        payload = {
            "user": {
                "id": user.id,
                "email": user.email,
                "star_points": user.star_points,
                "timezone": user.timezone,
                "display_name": user.display_name,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            },
            "goals": [
                {
                    "id": str(g.id),
                    "raw_input": g.raw_input,
                    "smart_title": g.smart_title,
                    "smart_description": g.smart_description,
                    "goal_type": g.goal_type,
                    "target_date": g.target_date.isoformat() if g.target_date else None,
                    "status": g.status,
                    "progress": g.progress,
                    "created_at": g.created_at.isoformat() if g.created_at else None,
                    "milestones": [
                        {
                            "id": str(m.id),
                            "title": m.title,
                            "position": m.position,
                            "is_final": m.is_final,
                            "sprint_theme": m.sprint_theme,
                            "sprint_status": m.sprint_status,
                            "is_completed": m.is_completed,
                            "completed_at": m.completed_at.isoformat() if m.completed_at else None,
                            "created_at": m.created_at.isoformat() if m.created_at else None,
                        }
                        for m in g.milestones
                    ],
                    "daily_tasks": [
                        {
                            "id": str(t.id),
                            "milestone_id": str(t.milestone_id) if t.milestone_id else None,
                            "description": t.description,
                            "tip": t.tip,
                            "assigned_date": t.assigned_date.isoformat() if t.assigned_date else None,
                            "position": t.position,
                            "is_completed": t.is_completed,
                            "is_rescue_task": t.is_rescue_task,
                            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                        }
                        for t in g.daily_tasks
                    ],
                }
                for g in goals
            ],
            "rewards": [
                {
                    "id": str(r.id),
                    "reward_type": r.reward_type,
                    "reward_key": r.reward_key,
                    "is_equipped": r.is_equipped,
                    "acquired_at": r.acquired_at.isoformat() if r.acquired_at else None,
                }
                for r in rewards
            ],
        }
        return payload

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "goal_id",
        "goal_title",
        "goal_status",
        "task_id",
        "task_description",
        "assigned_date",
        "is_completed",
        "is_rescue_task",
        "milestone_title",
    ])
    for g in goals:
        milestone_map = {str(m.id): m.title for m in g.milestones}
        for t in g.daily_tasks:
            writer.writerow([
                str(g.id),
                g.smart_title,
                g.status,
                str(t.id),
                t.description,
                t.assigned_date.isoformat() if t.assigned_date else "",
                str(t.is_completed),
                str(t.is_rescue_task),
                milestone_map.get(str(t.milestone_id), "") if t.milestone_id else "",
            ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="goalforge-export-{user_id}.csv"'},
    )
