"""User profile and settings routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user_id
from database import get_db
from models import User
from schemas import UserProfileResponse, UserSettingsUpdate

router = APIRouter()


@router.get(
    "/users/{user_id}/profile",
    summary="Get user profile (star_points etc.)",
)
async def get_user_profile(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {"star_points": user.star_points}


@router.get(
    "/users/{user_id}/settings",
    response_model=UserProfileResponse,
    summary="Get user settings (timezone, display_name)",
)
async def get_user_settings(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch(
    "/users/{user_id}/settings",
    response_model=UserProfileResponse,
    summary="Update user settings (timezone, display_name)",
)
async def update_user_settings(
    user_id: str,
    payload: UserSettingsUpdate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.timezone is not None:
        user.timezone = payload.timezone
    if payload.display_name is not None:
        user.display_name = payload.display_name
    await db.commit()
    await db.refresh(user)
    return user
