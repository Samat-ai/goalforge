"""Subscription / plan gating helpers.

Gracefully handles the case where the Subscription model/table does not exist
yet (returns 'free' as a safe default). The Subscription model will be added
in the stripe-subscription branch via a separate PR.
"""

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Goal


async def get_user_plan(user_id: str, db: AsyncSession) -> str:
    """Returns 'free' or 'pro'. Looks up Subscription table if it exists, else returns 'free'."""
    try:
        from models import Subscription
        result = await db.execute(select(Subscription).where(Subscription.user_id == user_id))
        sub = result.scalar_one_or_none()
        if sub and sub.plan == "pro" and sub.status == "active":
            return "pro"
    except Exception:
        pass
    return "free"


async def require_pro(user_id: str, db: AsyncSession, feature: str) -> None:
    """Raises HTTPException 402 if user is on free plan."""
    plan = await get_user_plan(user_id, db)
    if plan != "pro":
        raise HTTPException(
            status_code=402,
            detail={
                "feature": feature,
                "message": f"{feature.replace('_', ' ').title()} is a Pro feature. Upgrade to unlock it.",
                "upgrade_url": "/billing"
            }
        )


async def check_goal_limit(user_id: str, db: AsyncSession) -> None:
    """Raises HTTPException 402 if free user already has 2+ active goals."""
    plan = await get_user_plan(user_id, db)
    if plan == "pro":
        return
    result = await db.execute(
        select(func.count(Goal.id)).where(Goal.user_id == user_id, Goal.status == "active")
    )
    count = result.scalar_one()
    if count >= 2:
        raise HTTPException(
            status_code=402,
            detail={
                "feature": "goals",
                "message": "Free plan allows up to 2 active goals. Upgrade to Pro for unlimited goals.",
                "upgrade_url": "/billing"
            }
        )
