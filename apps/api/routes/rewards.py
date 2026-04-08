"""Reward collection endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy import update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user_id
from database import get_db
from deps import _load_reward_with_ownership
from models import Reward
from collectibles import BY_KEY
from schemas import RewardResponse

router = APIRouter()


def _to_reward_response(reward: Reward) -> RewardResponse:
    c = BY_KEY.get(reward.reward_key)
    lore_text = c.description if (c and c.reward_type == "lore") else None
    return RewardResponse(
        id=reward.id,
        reward_type=reward.reward_type,
        reward_key=reward.reward_key,
        display_name=c.display_name if c else reward.reward_key,
        description=lore_text,
        rarity=c.rarity if c else None,
        body=lore_text,
        is_equipped=reward.is_equipped,
        acquired_at=reward.acquired_at,
    )


@router.get(
    "/users/{user_id}/rewards",
    response_model=list[RewardResponse],
    summary="List all collected rewards for a user",
)
async def list_rewards(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(Reward)
        .where(Reward.user_id == user_id)
        .order_by(Reward.acquired_at.asc())
    )
    rewards = result.scalars().all()
    return [_to_reward_response(r) for r in rewards]


@router.patch(
    "/rewards/{reward_id}/equip",
    response_model=RewardResponse,
    summary="Equip a reward; unsets any previously equipped item of the same type",
)
async def equip_reward(
    reward_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    reward = await _load_reward_with_ownership(reward_id, current_user_id, db)

    if reward.reward_type not in ("theme", "title"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only theme and title rewards can be equipped",
        )

    # Atomically unset any currently equipped reward of the same type
    await db.execute(
        sql_update(Reward)
        .where(
            Reward.user_id == current_user_id,
            Reward.reward_type == reward.reward_type,
            Reward.is_equipped == True,  # noqa: E712
        )
        .values(is_equipped=False)
    )

    reward.is_equipped = True
    await db.flush()

    return _to_reward_response(reward)
