"""Background job trigger routes."""

import secrets
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from config import settings
from database import get_db
from models import Goal, User
from services.email_service import TaskDigestItem, send_reminder_digest, send_rescue_email
from services.rescue_service import goal_is_rescue_mode

router = APIRouter()


def _verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Require X-Api-Key header. Always enforced — no dev bypass."""
    api_key = settings.jobs_api_key
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jobs API key is not configured on this server",
        )
    if x_api_key is None or not secrets.compare_digest(x_api_key, api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )


@router.post(
    "/trigger-reminders",
    summary="Send daily reminder digest or rescue email per user",
    dependencies=[Depends(_verify_api_key)],
)
async def trigger_reminders(db: AsyncSession = Depends(get_db)) -> dict:
    # Load users with active goals, eagerly loading milestones + tasks for rescue detection
    result = await db.execute(
        select(User)
        .join(Goal, Goal.user_id == User.id)
        .where(Goal.status == "active")
        .options(
            selectinload(User.goals).selectinload(Goal.milestones),
            selectinload(User.goals).selectinload(Goal.daily_tasks),
        )
        .distinct()
    )
    users = result.scalars().all()

    rescue_count = 0
    digest_count = 0

    for user in users:
        active_goals = [g for g in user.goals if g.status == "active"]
        in_rescue = any(goal_is_rescue_mode(g) for g in active_goals)

        if in_rescue:
            await send_rescue_email(user.email, user.display_name)
            rescue_count += 1
        else:
            today = date.today()
            tasks = [
                TaskDigestItem(
                    description=t.description,
                    tip=t.tip,
                    goal_title=next(
                        (g.smart_title for g in active_goals if g.id == t.goal_id),
                        "Your Goal",
                    ),
                )
                for g in active_goals
                for t in g.daily_tasks
                if t.assigned_date == today and not t.is_completed
            ]
            if tasks:
                await send_reminder_digest(user.email, user.display_name, tasks)
                digest_count += 1

    return {"rescue_emails": rescue_count, "digest_emails": digest_count}
