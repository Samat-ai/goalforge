"""Web push subscription endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user_id
from database import get_db
from deps import _ensure_owner
from models import WebPushSubscription
from schemas import PushSubscriptionCreate, PushSubscriptionResponse

router = APIRouter()


@router.get(
    "/users/{user_id}/push-subscriptions",
    response_model=list[PushSubscriptionResponse],
    summary="List web push subscriptions for the current user",
)
async def list_push_subscriptions(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)

    rows = (
        await db.execute(
            select(WebPushSubscription)
            .where(WebPushSubscription.user_id == user_id)
            .order_by(WebPushSubscription.created_at.desc())
        )
    ).scalars().all()
    return rows


@router.post(
    "/users/{user_id}/push-subscriptions",
    response_model=PushSubscriptionResponse,
    status_code=201,
    summary="Register a web push subscription",
)
async def create_push_subscription(
    user_id: str,
    payload: PushSubscriptionCreate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)

    existing = (
        await db.execute(
            select(WebPushSubscription).where(WebPushSubscription.endpoint == payload.endpoint)
        )
    ).scalar_one_or_none()

    if existing is not None:
        existing.user_id = user_id
        existing.p256dh = payload.keys.p256dh
        existing.auth = payload.keys.auth
        existing.is_active = True
        await db.flush()
        await db.refresh(existing)
        return existing

    sub = WebPushSubscription(
        user_id=user_id,
        endpoint=payload.endpoint,
        p256dh=payload.keys.p256dh,
        auth=payload.keys.auth,
        is_active=True,
    )
    db.add(sub)
    await db.flush()
    await db.refresh(sub)
    return sub


@router.delete(
    "/push-subscriptions/{subscription_id}",
    status_code=204,
    summary="Deactivate a web push subscription",
)
async def delete_push_subscription(
    subscription_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    sub = (
        await db.execute(select(WebPushSubscription).where(WebPushSubscription.id == subscription_id))
    ).scalar_one_or_none()
    if sub is None:
        raise HTTPException(status_code=404, detail="Push subscription not found")
    _ensure_owner(sub.user_id, current_user_id)

    sub.is_active = False
