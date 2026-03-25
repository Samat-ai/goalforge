"""Accountability partner endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user_id
from database import get_db
from models import AccountabilityPartner, User
from schemas import PartnerInviteRequest, PartnerResponse

router = APIRouter()


def _to_partner_response(link: AccountabilityPartner, partner_email: str) -> PartnerResponse:
    return PartnerResponse(
        id=link.id,
        user_id=link.user_id,
        partner_user_id=link.partner_user_id,
        partner_email=partner_email,
        status=link.status,
        created_at=link.created_at,
    )


@router.get(
    "/users/{user_id}/partners",
    response_model=list[PartnerResponse],
    summary="List accountability partners and invites",
)
async def list_partners(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    rows = (
        await db.execute(
            select(AccountabilityPartner)
            .where(
                or_(
                    AccountabilityPartner.user_id == user_id,
                    AccountabilityPartner.partner_user_id == user_id,
                )
            )
            .order_by(AccountabilityPartner.created_at.desc())
        )
    ).scalars().all()

    responses: list[PartnerResponse] = []
    for link in rows:
        partner_id = link.partner_user_id if link.user_id == user_id else link.user_id
        partner_email = (
            await db.execute(select(User.email).where(User.id == partner_id))
        ).scalar_one_or_none() or "unknown"
        responses.append(_to_partner_response(link, partner_email))

    return responses


@router.post(
    "/users/{user_id}/partners/invite",
    response_model=PartnerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a partner by email",
)
async def invite_partner(
    user_id: str,
    payload: PartnerInviteRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    partner = (
        await db.execute(select(User).where(User.email == payload.partner_email.strip()))
    ).scalar_one_or_none()
    if partner is None:
        raise HTTPException(status_code=404, detail="Partner user not found")
    if partner.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot invite yourself")

    existing = (
        await db.execute(
            select(AccountabilityPartner).where(
                or_(
                    (AccountabilityPartner.user_id == user_id)
                    & (AccountabilityPartner.partner_user_id == partner.id),
                    (AccountabilityPartner.user_id == partner.id)
                    & (AccountabilityPartner.partner_user_id == user_id),
                )
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=400, detail="Partner link already exists")

    link = AccountabilityPartner(
        id=uuid.uuid4(),
        user_id=user_id,
        partner_user_id=partner.id,
        status="pending",
    )
    db.add(link)
    await db.flush()
    await db.refresh(link)
    return _to_partner_response(link, partner.email)


@router.post(
    "/partners/{partner_link_id}/accept",
    response_model=PartnerResponse,
    summary="Accept a partner invite",
)
async def accept_partner_invite(
    partner_link_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    link = (
        await db.execute(
            select(AccountabilityPartner).where(AccountabilityPartner.id == partner_link_id)
        )
    ).scalar_one_or_none()
    if link is None:
        raise HTTPException(status_code=404, detail="Partner invite not found")
    if link.partner_user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    link.status = "accepted"
    await db.flush()
    partner_email = (
        await db.execute(select(User.email).where(User.id == link.user_id))
    ).scalar_one_or_none() or "unknown"
    return _to_partner_response(link, partner_email)
