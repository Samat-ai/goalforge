"""User feedback submission."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user_email, get_current_user_id
from database import get_db
from deps import get_or_create_user
from models import Feedback
from rate_limiting import _user_key, rate_limit
from schemas import FeedbackCreate, FeedbackResponse
from services.email_service import send_feedback_notification

router = APIRouter()


@router.post(
    "/feedback",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit feedback (bug report, idea, or other)",
)
@rate_limit("5/hour", key_func=_user_key)
async def submit_feedback(
    request: Request,
    payload: FeedbackCreate,
    current_user_id: str = Depends(get_current_user_id),
    current_user_email: str = Depends(get_current_user_email),
    db: AsyncSession = Depends(get_db),
):
    user = await get_or_create_user(current_user_id, current_user_email, db)

    entry = Feedback(user_id=user.id, category=payload.category, message=payload.message)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    # Notification never raises — the stored row is the source of truth.
    await send_feedback_notification(payload.category, payload.message, user.email)

    return FeedbackResponse(id=entry.id)
