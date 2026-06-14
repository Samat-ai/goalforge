"""Secure accountability invite and partner routes."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from auth import get_current_user_email, get_current_user_id
from database import get_db
from deps import _ensure_owner, _load_user_with_ownership, get_or_create_user
from services.subscription_service import require_pro
from models import AccountabilityInvite, AccountabilityPartnership, User
from rate_limiting import _user_key, rate_limit
from schemas import (
    AccountabilityInviteActionResponse,
    AccountabilityInviteCreate,
    AccountabilityInviteResponse,
    AccountabilityInviteSendResponse,
    AccountabilityOverviewResponse,
    AccountabilityPartnerResponse,
)

router = APIRouter()

_GENERIC_INVITE_MESSAGE = "Invite sent or pending"


def _normalize_email(email: str) -> str:
    return email.strip().lower()


@router.post(
    "/users/{user_id}/accountability-invites",
    response_model=AccountabilityInviteSendResponse,
    summary="Send an accountability invite (enumeration-safe)",
)
@rate_limit("5/minute", key_func=_user_key)
async def send_accountability_invite(
    request: Request,
    user_id: str,
    payload: AccountabilityInviteCreate,
    current_user_id: str = Depends(get_current_user_id),
    current_user_email: str = Depends(get_current_user_email),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)
    await require_pro(user_id, db, "accountability")
    inviter = await get_or_create_user(user_id, current_user_email, db)
    target_email = _normalize_email(payload.email)

    # Never leak existence details. Self-invites become a no-op with generic response.
    if target_email == _normalize_email(inviter.email):
        return AccountabilityInviteSendResponse(message=_GENERIC_INVITE_MESSAGE)

    invitee = (
        await db.execute(
            select(User).where(func.lower(User.email) == target_email)
        )
    ).scalar_one_or_none()

    invitee_user_id = invitee.id if invitee is not None else None

    if invitee_user_id is not None:
        partnership_exists = (
            await db.execute(
                select(AccountabilityPartnership.id).where(
                    AccountabilityPartnership.user_id == inviter.id,
                    AccountabilityPartnership.partner_user_id == invitee_user_id,
                )
            )
        ).scalar_one_or_none()
        if partnership_exists is not None:
            return AccountabilityInviteSendResponse(message=_GENERIC_INVITE_MESSAGE)

    pending_invite = (
        await db.execute(
            select(AccountabilityInvite.id).where(
                AccountabilityInvite.inviter_user_id == inviter.id,
                AccountabilityInvite.target_email == target_email,
                AccountabilityInvite.status == "pending",
            )
        )
    ).scalar_one_or_none()

    if pending_invite is None:
        db.add(
            AccountabilityInvite(
                id=uuid.uuid4(),
                inviter_user_id=inviter.id,
                invitee_user_id=invitee_user_id,
                target_email=target_email,
                status="pending",
            )
        )

    return AccountabilityInviteSendResponse(message=_GENERIC_INVITE_MESSAGE)


@router.get(
    "/users/{user_id}/accountability-invites",
    response_model=AccountabilityOverviewResponse,
    summary="List incoming/outgoing accountability invites and accepted partners",
)
async def get_accountability_overview(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    current_user_email: str = Depends(get_current_user_email),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)

    real_email = _normalize_email(current_user_email)
    has_real_email = not real_email.endswith("@placeholder.goalforge.app")

    # Match on invitee_user_id (already resolved) OR on target_email when we have
    # a real email and invitee_user_id was left NULL at send-time (recipient had no
    # User row yet, or Clerk email was not in JWT at send-time).
    invitee_filter = AccountabilityInvite.invitee_user_id == user_id
    if has_real_email:
        invitee_filter = or_(
            AccountabilityInvite.invitee_user_id == user_id,
            and_(
                AccountabilityInvite.invitee_user_id.is_(None),
                AccountabilityInvite.target_email == real_email,
            ),
        )

    # JOIN User (as inviter) so the UI can display who sent each incoming invite.
    InviterUser = aliased(User)
    incoming_rows = (
        await db.execute(
            select(AccountabilityInvite, InviterUser.email, InviterUser.display_name)
            .join(InviterUser, InviterUser.id == AccountabilityInvite.inviter_user_id)
            .where(invitee_filter, AccountabilityInvite.status == "pending")
            .order_by(AccountabilityInvite.created_at.desc())
        )
    ).all()

    # Backfill invitee_user_id on email-matched invites so accept/decline work correctly.
    for row in incoming_rows:
        invite = row[0]
        if invite.invitee_user_id is None:
            invite.invitee_user_id = user_id

    incoming = [
        AccountabilityInviteResponse(
            id=row[0].id,
            inviter_user_id=row[0].inviter_user_id,
            invitee_user_id=row[0].invitee_user_id,
            target_email=row[0].target_email,
            status=row[0].status,
            created_at=row[0].created_at,
            responded_at=row[0].responded_at,
            inviter_email=row[1],
            inviter_display_name=row[2],
        )
        for row in incoming_rows
    ]

    outgoing = (
        await db.execute(
            select(AccountabilityInvite)
            .where(
                AccountabilityInvite.inviter_user_id == user_id,
                AccountabilityInvite.status == "pending",
            )
            .order_by(AccountabilityInvite.created_at.desc())
        )
    ).scalars().all()

    partner_rows = (
        await db.execute(
            select(
                AccountabilityPartnership,
                User.email,
                User.display_name,
            )
            .join(User, User.id == AccountabilityPartnership.partner_user_id)
            .where(AccountabilityPartnership.user_id == user_id)
            .order_by(AccountabilityPartnership.created_at.desc())
        )
    ).all()

    partners = [
        AccountabilityPartnerResponse(
            id=row[0].id,
            user_id=row[0].user_id,
            partner_user_id=row[0].partner_user_id,
            partner_email=row[1],
            partner_display_name=row[2],
            created_at=row[0].created_at,
        )
        for row in partner_rows
    ]

    return AccountabilityOverviewResponse(
        incoming=incoming,
        outgoing=outgoing,
        partners=partners,
    )


@router.post(
    "/accountability-invites/{invite_id}/accept",
    response_model=AccountabilityInviteActionResponse,
    summary="Accept an accountability invite",
)
async def accept_accountability_invite(
    invite_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    invite = (
        await db.execute(
            select(AccountabilityInvite)
            .where(AccountabilityInvite.id == invite_id)
            .with_for_update()
        )
    ).scalar_one_or_none()

    if invite is None:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.invitee_user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if invite.status != "pending":
        raise HTTPException(status_code=400, detail="Invite is no longer pending")

    invite.status = "accepted"
    invite.responded_at = datetime.now(timezone.utc)

    inviter_id = invite.inviter_user_id
    invitee_id = current_user_id

    # Use a savepoint per direction so concurrent accepts are idempotent across
    # both PostgreSQL and SQLite (tests). begin_nested() flushes on exit, surfacing
    # any UniqueConstraint violation inside the savepoint; we swallow it and continue
    # so the outer transaction (invite status update) still commits cleanly.
    for uid, partner_uid in ((inviter_id, invitee_id), (invitee_id, inviter_id)):
        try:
            async with db.begin_nested():
                db.add(AccountabilityPartnership(id=uuid.uuid4(), user_id=uid, partner_user_id=partner_uid))
        except IntegrityError:
            pass  # partnership already exists — idempotent

    return AccountabilityInviteActionResponse(message="Invite accepted", status="accepted")


@router.post(
    "/accountability-invites/{invite_id}/decline",
    response_model=AccountabilityInviteActionResponse,
    summary="Decline an accountability invite",
)
async def decline_accountability_invite(
    invite_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    invite = (
        await db.execute(
            select(AccountabilityInvite)
            .where(AccountabilityInvite.id == invite_id)
            .with_for_update()
        )
    ).scalar_one_or_none()

    if invite is None:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.invitee_user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if invite.status != "pending":
        raise HTTPException(status_code=400, detail="Invite is no longer pending")

    invite.status = "declined"
    invite.responded_at = datetime.now(timezone.utc)

    return AccountabilityInviteActionResponse(message="Invite declined", status="declined")
