"""User profile, settings, and data control routes."""

import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user_id
from database import get_db
from deps import _load_user_with_ownership
from models import Goal, Reward, User
from schemas import UserProfileResponse, UserSettingsUpdate

router = APIRouter()


def _build_csv_export(*, user: User, goals: list[Goal], rewards: list[Reward]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["section", "key", "value"])
    writer.writerow(["user", "id", user.id])
    writer.writerow(["user", "email", user.email])
    writer.writerow(["user", "star_points", user.star_points])
    writer.writerow(["user", "timezone", user.timezone])
    writer.writerow(["user", "display_name", user.display_name or ""])

    writer.writerow([])
    writer.writerow([
        "goals",
        "goal_id",
        "title",
        "status",
        "progress",
        "target_date",
        "created_at",
    ])
    for goal in goals:
        writer.writerow([
            "goals",
            str(goal.id),
            goal.smart_title,
            goal.status,
            goal.progress,
            goal.target_date.isoformat(),
            goal.created_at.isoformat(),
        ])

    writer.writerow([])
    writer.writerow([
        "milestones",
        "milestone_id",
        "goal_id",
        "title",
        "position",
        "sprint_status",
        "is_completed",
    ])
    for goal in goals:
        for milestone in goal.milestones:
            writer.writerow([
                "milestones",
                str(milestone.id),
                str(goal.id),
                milestone.title,
                milestone.position,
                milestone.sprint_status,
                milestone.is_completed,
            ])

    writer.writerow([])
    writer.writerow([
        "daily_tasks",
        "task_id",
        "goal_id",
        "milestone_id",
        "description",
        "assigned_date",
        "is_completed",
        "is_rescue_task",
    ])
    for goal in goals:
        for task in goal.daily_tasks:
            writer.writerow([
                "daily_tasks",
                str(task.id),
                str(goal.id),
                str(task.milestone_id) if task.milestone_id else "",
                task.description,
                task.assigned_date.isoformat(),
                task.is_completed,
                task.is_rescue_task,
            ])

    writer.writerow([])
    writer.writerow([
        "rewards",
        "reward_id",
        "reward_type",
        "reward_key",
        "is_equipped",
        "acquired_at",
    ])
    for reward in rewards:
        writer.writerow([
            "rewards",
            str(reward.id),
            reward.reward_type,
            reward.reward_key,
            reward.is_equipped,
            reward.acquired_at.isoformat(),
        ])

    return output.getvalue()


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
    user = await _load_user_with_ownership(user_id, current_user_id, db)

    goals_result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.user_id == user_id)
        .order_by(Goal.created_at.asc())
    )
    goals = goals_result.scalars().all()

    rewards_result = await db.execute(
        select(Reward).where(Reward.user_id == user_id).order_by(Reward.acquired_at.asc())
    )
    rewards = rewards_result.scalars().all()

    exported_at = datetime.now(timezone.utc).isoformat()

    if format == "csv":
        csv_body = _build_csv_export(user=user, goals=goals, rewards=rewards)
        return Response(
            content=csv_body,
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="goalforge-export.csv"'},
        )

    return {
        "exported_at": exported_at,
        "user": {
            "id": user.id,
            "email": user.email,
            "star_points": user.star_points,
            "timezone": user.timezone,
            "display_name": user.display_name,
        },
        "goals": [
            {
                "id": str(goal.id),
                "raw_input": goal.raw_input,
                "smart_title": goal.smart_title,
                "smart_description": goal.smart_description,
                "goal_type": goal.goal_type,
                "target_date": goal.target_date.isoformat(),
                "status": goal.status,
                "progress": goal.progress,
                "created_at": goal.created_at.isoformat(),
                "milestones": [
                    {
                        "id": str(ms.id),
                        "title": ms.title,
                        "position": ms.position,
                        "is_final": ms.is_final,
                        "sprint_theme": ms.sprint_theme,
                        "sprint_status": ms.sprint_status,
                        "is_completed": ms.is_completed,
                        "completed_at": ms.completed_at.isoformat() if ms.completed_at else None,
                    }
                    for ms in goal.milestones
                ],
                "daily_tasks": [
                    {
                        "id": str(task.id),
                        "description": task.description,
                        "tip": task.tip,
                        "assigned_date": task.assigned_date.isoformat(),
                        "position": task.position,
                        "is_completed": task.is_completed,
                        "is_rescue_task": task.is_rescue_task,
                        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
                    }
                    for task in goal.daily_tasks
                ],
            }
            for goal in goals
        ],
        "rewards": [
            {
                "id": str(reward.id),
                "reward_type": reward.reward_type,
                "reward_key": reward.reward_key,
                "is_equipped": reward.is_equipped,
                "acquired_at": reward.acquired_at.isoformat(),
            }
            for reward in rewards
        ],
    }


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete user account data (goals, tasks, milestones, rewards)",
)
async def delete_user_data(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await _load_user_with_ownership(user_id, current_user_id, db)
    await db.delete(user)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
