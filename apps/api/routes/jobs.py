"""Background job trigger routes."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import DailyTask, Goal, User
from services.email_service import send_reminder_email

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
    summary="Send daily reminder emails for all pending tasks due today",
    dependencies=[Depends(_verify_api_key)],
)
async def trigger_reminders(db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(
        select(DailyTask, User.email)
        .join(Goal, DailyTask.goal_id == Goal.id)
        .join(User, Goal.user_id == User.id)
        .where(DailyTask.assigned_date == date.today())
        .where(DailyTask.is_completed == False)  # noqa: E712
    )
    rows = result.all()

    for task, email in rows:
        await send_reminder_email(email, task.description)

    return {"sent": len(rows)}
