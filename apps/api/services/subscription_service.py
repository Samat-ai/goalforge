"""
Subscription / feature-gating service.

Pro-only features are enforced here.  If the user is not on a Pro plan,
an HTTP 402 Payment Required is raised with a machine-readable detail so
the frontend can redirect to /billing.

Feature registry (mirrors PR #108 feature-gating spec):
    "export"   — data export (JSON / CSV ZIP)
"""

import logging

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Feature → plan mapping
# ---------------------------------------------------------------------------

# All features listed here require at least a Pro subscription.
_PRO_FEATURES: frozenset[str] = frozenset(
    {
        "export",
    }
)


async def is_pro(user_id: str, db: AsyncSession) -> bool:  # noqa: ARG001
    """Return True when the user holds an active Pro subscription.

    This is a stub that always returns True for now; it will be backed by a
    real Stripe / subscription table lookup once billing is wired up (see
    PR #108).  Keeping the interface stable so callers never change.
    """
    # TODO: query a `subscriptions` table once billing is implemented.
    return True


async def require_pro(user_id: str, db: AsyncSession, feature: str) -> None:
    """Raise HTTP 402 if *user_id* does not have access to *feature*.

    Usage::

        await require_pro(user_id, db, "export")

    Raises:
        HTTPException(402): when the feature is Pro-only and the user is not
            on a Pro plan.
        HTTPException(403): when the feature name is not recognised (defence
            against typos in callers).
    """
    if feature not in _PRO_FEATURES:
        logger.error("Unknown feature gate requested: %r", feature)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Unknown feature: {feature!r}",
        )

    if not await is_pro(user_id, db):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "pro_required",
                "feature": feature,
                "message": "This feature requires a GoalForge Pro subscription.",
                "upgrade_url": "/billing",
            },
        )
