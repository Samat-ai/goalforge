"""FastAPI shared dependencies and helpers."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Goal, Reward


async def _load_goal_with_ownership(
    goal_id: uuid.UUID, current_user_id: str, db: AsyncSession,
) -> Goal:
    """Load a goal and verify ownership. Raises 404 or 403 on failure."""
    result = await db.execute(select(Goal).where(Goal.id == goal_id))
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    if goal.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return goal


async def _load_reward_with_ownership(
    reward_id: uuid.UUID, current_user_id: str, db: AsyncSession,
) -> Reward:
    """Load a reward and verify ownership. Raises 404 or 403 on failure."""
    result = await db.execute(select(Reward).where(Reward.id == reward_id))
    reward = result.scalar_one_or_none()
    if reward is None:
        raise HTTPException(status_code=404, detail="Reward not found")
    if reward.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return reward
