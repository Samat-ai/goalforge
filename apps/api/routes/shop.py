"""Star shop reward endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy import update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user_id
from database import get_db
from deps import _ensure_owner, _load_shop_reward_with_ownership
from models import ShopReward, User
from rate_limiting import rate_limit, _user_key
from schemas import (
    ShopRewardCreate,
    ShopRewardRedeemResponse,
    ShopRewardResponse,
    ShopRewardUpdate,
)

router = APIRouter()


@router.get(
    "/users/{user_id}/shop-rewards",
    response_model=list[ShopRewardResponse],
    summary="List custom star-shop rewards",
)
async def list_shop_rewards(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)

    result = await db.execute(
        select(ShopReward)
        .where(ShopReward.user_id == user_id)
        .order_by(ShopReward.created_at.asc())
    )
    return result.scalars().all()


@router.post(
    "/users/{user_id}/shop-rewards",
    response_model=ShopRewardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a custom reward in your star shop",
)
@rate_limit("20/minute", key_func=_user_key)
async def create_shop_reward(
    request: Request,
    user_id: str,
    payload: ShopRewardCreate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)

    user_result = await db.execute(select(User.id).where(User.id == user_id))
    if user_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="User not found")

    reward = ShopReward(
        id=uuid.uuid4(),
        user_id=user_id,
        title=payload.title.strip(),
        cost=payload.cost,
        is_active=True,
    )
    db.add(reward)
    await db.flush()
    await db.refresh(reward)
    return reward


@router.patch(
    "/shop-rewards/{reward_id}",
    response_model=ShopRewardResponse,
    summary="Update a custom shop reward",
)
async def update_shop_reward(
    reward_id: uuid.UUID,
    payload: ShopRewardUpdate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    reward = await _load_shop_reward_with_ownership(reward_id, current_user_id, db)

    if payload.title is not None:
        reward.title = payload.title.strip()
    if payload.cost is not None:
        reward.cost = payload.cost
    if payload.is_active is not None:
        reward.is_active = payload.is_active

    await db.flush()
    await db.refresh(reward)
    return reward


@router.delete(
    "/shop-rewards/{reward_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a custom shop reward",
)
async def delete_shop_reward(
    reward_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    reward = await _load_shop_reward_with_ownership(reward_id, current_user_id, db)
    await db.delete(reward)


@router.post(
    "/shop-rewards/{reward_id}/redeem",
    response_model=ShopRewardRedeemResponse,
    summary="Redeem a custom shop reward by spending star points",
)
@rate_limit("10/minute", key_func=_user_key)
async def redeem_shop_reward(
    request: Request,
    reward_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    reward = await _load_shop_reward_with_ownership(reward_id, current_user_id, db)
    if not reward.is_active:
        raise HTTPException(status_code=400, detail="Reward is inactive")

    # Atomic point deduction — WHERE guard prevents double-spend
    deduct_result = await db.execute(
        sql_update(User)
        .where(
            User.id == current_user_id,
            User.star_points >= reward.cost,
        )
        .values(star_points=User.star_points - reward.cost)
        .returning(User.star_points)
    )
    remaining = deduct_result.scalar_one_or_none()
    if remaining is None:
        raise HTTPException(status_code=400, detail="Not enough star points")

    # Atomic redemption count increment — SQL-level to prevent lost updates
    await db.execute(
        sql_update(ShopReward)
        .where(ShopReward.id == reward_id)
        .values(redemption_count=ShopReward.redemption_count + 1)
    )
    await db.refresh(reward)

    return ShopRewardRedeemResponse(
        reward=reward,
        remaining_star_points=remaining,
    )
