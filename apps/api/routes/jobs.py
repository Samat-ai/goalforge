"""Background job trigger routes."""

from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import DailyTask, Goal, User
from services.email_service import TaskDigestItem, send_reminder_digest

router = APIRouter()


def _verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Require X-Api-Key header when jobs_api_key is configured."""
    if settings.jobs_api_key and x_api_key != settings.jobs_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )


@router.post(
    "/trigger-reminders",
    summary="Send daily reminder digest for all pending tasks due today",
    dependencies=[Depends(_verify_api_key)],
)
async def trigger_reminders(db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(
        select(DailyTask, User.email, User.display_name, Goal.smart_title)
        .join(Goal, DailyTask.goal_id == Goal.id)
        .join(User, Goal.user_id == User.id)
        .where(DailyTask.assigned_date == date.today())
        .where(DailyTask.is_completed == False)  # noqa: E712
    )
    rows = result.all()

    # Group tasks by user (email, display_name)
    user_tasks: dict[tuple[str, str | None], list[TaskDigestItem]] = defaultdict(list)
    for task, email, display_name, goal_title in rows:
        user_tasks[(email, display_name)].append(
            TaskDigestItem(
                description=task.description,
                tip=task.tip,
                goal_title=goal_title,
            )
        )

    for (email, display_name), tasks in user_tasks.items():
        await send_reminder_digest(email, display_name, tasks)

    return {"sent": len(user_tasks)}
