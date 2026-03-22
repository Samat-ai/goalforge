"""FastAPI shared dependencies and helpers."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Goal


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
