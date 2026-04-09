"""Billing routes — Stripe checkout, portal, and webhook handling."""

import logging
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user_id
from config import settings
from database import get_db
from deps import _ensure_owner
from models import Subscription, User
from schemas import CheckoutSessionResponse, PortalSessionResponse, SubscriptionResponse

logger = logging.getLogger(__name__)

router = APIRouter()


def _stripe_client() -> stripe.Stripe:
    """Return a configured Stripe client instance."""
    return stripe.Stripe(settings.stripe_secret_key)


async def _get_or_create_subscription(user_id: str, db: AsyncSession) -> Subscription:
    """Load the Subscription row for a user, creating a free-tier row if absent."""
    result = await db.execute(select(Subscription).where(Subscription.user_id == user_id))
    sub = result.scalar_one_or_none()
    if sub is None:
        sub = Subscription(user_id=user_id, plan="free", status="active")
        db.add(sub)
        await db.flush()
        await db.refresh(sub)
    return sub


# ---------------------------------------------------------------------------
# GET /users/{user_id}/billing/subscription
# ---------------------------------------------------------------------------

@router.get(
    "/users/{user_id}/billing/subscription",
    response_model=SubscriptionResponse,
    summary="Get current subscription plan and status",
)
async def get_subscription(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)
    sub = await _get_or_create_subscription(user_id, db)
    await db.commit()
    return sub


# ---------------------------------------------------------------------------
# POST /users/{user_id}/billing/create-checkout-session
# ---------------------------------------------------------------------------

@router.post(
    "/users/{user_id}/billing/create-checkout-session",
    response_model=CheckoutSessionResponse,
    summary="Create a Stripe Checkout session to upgrade to Pro",
)
async def create_checkout_session(
    user_id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)

    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured",
        )
    if not settings.stripe_pro_price_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pro plan price is not configured",
        )

    # Load user (auto-create if needed) and their subscription record
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    sub = await _get_or_create_subscription(user_id, db)

    # Determine origin for redirect URLs
    origin = request.headers.get("origin", "http://localhost:5173")

    stripe.api_key = settings.stripe_secret_key

    try:
        # Re-use existing Stripe customer if we have one
        customer_kwargs: dict = {}
        if sub.stripe_customer_id:
            customer_kwargs["customer"] = sub.stripe_customer_id
        else:
            customer_kwargs["customer_email"] = user.email

        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": settings.stripe_pro_price_id, "quantity": 1}],
            success_url=f"{origin}/billing?session_id={{CHECKOUT_SESSION_ID}}&status=success",
            cancel_url=f"{origin}/billing?status=canceled",
            metadata={"user_id": user_id},
            **customer_kwargs,
        )
    except stripe.StripeError as exc:
        logger.error("Stripe checkout session creation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not create checkout session",
        ) from exc

    await db.commit()
    return CheckoutSessionResponse(url=session.url)


# ---------------------------------------------------------------------------
# POST /users/{user_id}/billing/create-portal-session
# ---------------------------------------------------------------------------

@router.post(
    "/users/{user_id}/billing/create-portal-session",
    response_model=PortalSessionResponse,
    summary="Create a Stripe Customer Portal session to manage subscription",
)
async def create_portal_session(
    user_id: str,
    request: Request,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)

    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured",
        )

    sub = await _get_or_create_subscription(user_id, db)

    if not sub.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No billing account found. Please upgrade to Pro first.",
        )

    origin = request.headers.get("origin", "http://localhost:5173")

    stripe.api_key = settings.stripe_secret_key

    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=sub.stripe_customer_id,
            return_url=f"{origin}/billing",
        )
    except stripe.StripeError as exc:
        logger.error("Stripe portal session creation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not create portal session",
        ) from exc

    return PortalSessionResponse(url=portal_session.url)


# ---------------------------------------------------------------------------
# POST /api/webhooks/stripe  (no auth — verified via webhook signature)
# ---------------------------------------------------------------------------

@router.post(
    "/api/webhooks/stripe",
    include_in_schema=False,
    summary="Stripe webhook receiver",
)
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if not settings.stripe_webhook_secret:
        logger.warning("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook not configured",
        )

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except stripe.SignatureVerificationError as exc:
        logger.warning("Stripe webhook signature verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature",
        ) from exc
    except Exception as exc:
        logger.error("Stripe webhook payload parsing failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook payload",
        ) from exc

    event_type: str = event["type"]
    event_data = event["data"]["object"]

    logger.info("Stripe webhook received: %s", event_type)

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(event_data, db)

    elif event_type == "customer.subscription.updated":
        await _handle_subscription_updated(event_data, db)

    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(event_data, db)

    else:
        logger.debug("Unhandled Stripe event type: %s", event_type)

    return {"received": True}


# ---------------------------------------------------------------------------
# Webhook event handlers
# ---------------------------------------------------------------------------

async def _handle_checkout_completed(session_obj: dict, db: AsyncSession) -> None:
    """Fired when a checkout session is paid — link customer to the user row."""
    user_id: str | None = (session_obj.get("metadata") or {}).get("user_id")
    customer_id: str | None = session_obj.get("customer")
    stripe_subscription_id: str | None = session_obj.get("subscription")

    if not user_id:
        logger.warning("checkout.session.completed missing user_id metadata")
        return

    sub = await _get_or_create_subscription(user_id, db)
    if customer_id:
        sub.stripe_customer_id = customer_id
    if stripe_subscription_id:
        sub.stripe_subscription_id = stripe_subscription_id
        # Fetch full subscription to get period end and status
        stripe.api_key = settings.stripe_secret_key
        try:
            stripe_sub = stripe.Subscription.retrieve(stripe_subscription_id)
            sub.plan = "pro"
            sub.status = _map_stripe_status(stripe_sub["status"])
            period_end_ts = stripe_sub.get("current_period_end")
            if period_end_ts:
                sub.current_period_end = datetime.fromtimestamp(period_end_ts, tz=timezone.utc)
        except stripe.StripeError as exc:
            logger.error("Could not retrieve Stripe subscription %s: %s", stripe_subscription_id, exc)

    await db.commit()
    logger.info("Subscription activated for user %s", user_id)


async def _handle_subscription_updated(stripe_sub: dict, db: AsyncSession) -> None:
    """Fired on any subscription change (renewal, upgrade, downgrade)."""
    stripe_subscription_id: str = stripe_sub["id"]
    customer_id: str | None = stripe_sub.get("customer")

    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    )
    sub = result.scalar_one_or_none()

    # Fall back to customer_id lookup in case subscription_id wasn't stored yet
    if sub is None and customer_id:
        result = await db.execute(
            select(Subscription).where(Subscription.stripe_customer_id == customer_id)
        )
        sub = result.scalar_one_or_none()

    if sub is None:
        logger.warning(
            "customer.subscription.updated — no matching subscription found "
            "(stripe_subscription_id=%s, customer=%s)",
            stripe_subscription_id,
            customer_id,
        )
        return

    sub.stripe_subscription_id = stripe_subscription_id
    new_status = _map_stripe_status(stripe_sub.get("status", "active"))
    sub.status = new_status
    # Keep plan as "pro" unless explicitly canceled/deleted
    if new_status == "active":
        sub.plan = "pro"

    period_end_ts = stripe_sub.get("current_period_end")
    if period_end_ts:
        sub.current_period_end = datetime.fromtimestamp(period_end_ts, tz=timezone.utc)

    await db.commit()
    logger.info(
        "Subscription updated for stripe_subscription_id=%s → status=%s",
        stripe_subscription_id,
        new_status,
    )


async def _handle_subscription_deleted(stripe_sub: dict, db: AsyncSession) -> None:
    """Fired when a subscription is fully canceled."""
    stripe_subscription_id: str = stripe_sub["id"]
    customer_id: str | None = stripe_sub.get("customer")

    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    )
    sub = result.scalar_one_or_none()

    if sub is None and customer_id:
        result = await db.execute(
            select(Subscription).where(Subscription.stripe_customer_id == customer_id)
        )
        sub = result.scalar_one_or_none()

    if sub is None:
        logger.warning(
            "customer.subscription.deleted — no matching subscription found "
            "(stripe_subscription_id=%s)",
            stripe_subscription_id,
        )
        return

    sub.plan = "free"
    sub.status = "canceled"
    sub.stripe_subscription_id = None

    await db.commit()
    logger.info(
        "Subscription canceled for user %s (was stripe_subscription_id=%s)",
        sub.user_id,
        stripe_subscription_id,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _map_stripe_status(stripe_status: str) -> str:
    """Map Stripe subscription status string to our internal status enum."""
    mapping = {
        "active": "active",
        "trialing": "active",
        "past_due": "past_due",
        "canceled": "canceled",
        "unpaid": "past_due",
        "incomplete": "past_due",
        "incomplete_expired": "canceled",
        "paused": "past_due",
    }
    return mapping.get(stripe_status, "active")
