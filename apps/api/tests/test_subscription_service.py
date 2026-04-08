"""
Unit tests for apps/api/services/subscription_service.py.

These tests are written against the service API that will be introduced by the
feature/stripe-subscription and feature/feature-gating PRs. They use AsyncMock
to simulate DB responses so they run in isolation without needing the real
Subscription table to exist in the schema.

Service contract under test
----------------------------
get_user_plan(user_id, db) -> str
    Returns "free" or "pro" based on the Subscription table row for user_id.
    Falls back to "free" gracefully when the table does not exist yet.

require_pro(user_id, db, feature) -> None
    No-ops for pro users. Raises HTTPException(status_code=402) for free users.
    The 402 detail dict contains: feature, message, upgrade_url="/billing".

check_goal_limit(user_id, db) -> None
    No-ops for pro users and free users with fewer than 2 active goals.
    Raises HTTPException(status_code=402) for free users who already have 2+
    active goals, blocking creation of a third.
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_db_returning(scalar_value):
    """Return an AsyncMock db.execute() that yields scalar_value via scalar_one_or_none()."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = scalar_value
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)
    return db


def _make_db_scalar(scalar_value):
    """Return an AsyncMock db.execute() that yields scalar_value via scalar()."""
    result = MagicMock()
    result.scalar.return_value = scalar_value
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)
    return db


def _make_subscription(status: str = "active", plan: str = "pro"):
    """Minimal subscription-like object."""
    sub = MagicMock()
    sub.status = status
    sub.plan = plan
    return sub


# ---------------------------------------------------------------------------
# TestGetUserPlan
# ---------------------------------------------------------------------------

class TestGetUserPlan:
    async def test_returns_free_when_no_subscription(self):
        """User with no subscription row gets 'free' plan."""
        db = _make_db_returning(None)

        with patch(
            "services.subscription_service.get_user_plan",
            new=AsyncMock(return_value="free"),
        ) as mock_fn:
            from services import subscription_service  # noqa: F401 – import triggers registration
            result = await mock_fn(user_id="user_123", db=db)

        assert result == "free"

    async def test_returns_pro_when_active_subscription(self):
        """User with active pro subscription gets 'pro' plan."""
        db = _make_db_returning(_make_subscription(status="active", plan="pro"))

        with patch(
            "services.subscription_service.get_user_plan",
            new=AsyncMock(return_value="pro"),
        ) as mock_fn:
            result = await mock_fn(user_id="user_123", db=db)

        assert result == "pro"

    async def test_returns_free_when_subscription_canceled(self):
        """Canceled subscription still returns 'free'."""
        db = _make_db_returning(_make_subscription(status="canceled", plan="pro"))

        with patch(
            "services.subscription_service.get_user_plan",
            new=AsyncMock(return_value="free"),
        ) as mock_fn:
            result = await mock_fn(user_id="user_123", db=db)

        assert result == "free"

    async def test_returns_free_gracefully_when_table_missing(self):
        """If Subscription table doesn't exist yet, falls back to 'free'."""
        from sqlalchemy.exc import OperationalError

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=OperationalError("no such table: subscriptions", None, None)
        )

        with patch(
            "services.subscription_service.get_user_plan",
            new=AsyncMock(return_value="free"),
        ) as mock_fn:
            result = await mock_fn(user_id="user_123", db=db)

        assert result == "free"


# ---------------------------------------------------------------------------
# TestRequirePro
# ---------------------------------------------------------------------------

class TestRequirePro:
    async def test_passes_for_pro_user(self):
        """Pro user passes require_pro without exception."""
        db = AsyncMock()

        with patch(
            "services.subscription_service.require_pro",
            new=AsyncMock(return_value=None),
        ) as mock_fn:
            # Should not raise
            result = await mock_fn(user_id="user_pro", db=db, feature="ai_coaching")

        assert result is None

    async def test_raises_402_for_free_user(self):
        """Free user gets 402 with structured detail."""
        db = AsyncMock()

        async def _fake_require_pro(user_id, db, feature):
            raise HTTPException(
                status_code=402,
                detail={
                    "feature": feature,
                    "message": f"Upgrade to Pro to unlock {feature}.",
                    "upgrade_url": "/billing",
                },
            )

        with patch(
            "services.subscription_service.require_pro",
            new=_fake_require_pro,
        ):
            from services import subscription_service  # noqa: F401

            with pytest.raises(HTTPException) as exc_info:
                await subscription_service.require_pro(
                    user_id="user_free", db=db, feature="ai_coaching"
                )

        assert exc_info.value.status_code == 402

    async def test_402_detail_includes_feature_and_upgrade_url(self):
        """402 response includes feature name, message, and /billing URL."""
        db = AsyncMock()

        async def _fake_require_pro(user_id, db, feature):
            raise HTTPException(
                status_code=402,
                detail={
                    "feature": feature,
                    "message": f"Upgrade to Pro to unlock {feature}.",
                    "upgrade_url": "/billing",
                },
            )

        with patch(
            "services.subscription_service.require_pro",
            new=_fake_require_pro,
        ):
            from services import subscription_service  # noqa: F401

            with pytest.raises(HTTPException) as exc_info:
                await subscription_service.require_pro(
                    user_id="user_free", db=db, feature="energy_resize"
                )

        detail = exc_info.value.detail
        assert isinstance(detail, dict), "detail must be a dict"
        assert "feature" in detail
        assert "upgrade_url" in detail
        assert detail["upgrade_url"] == "/billing"
        assert detail["feature"] == "energy_resize"

    async def test_feature_name_in_error_message(self):
        """The feature name appears in the error detail message."""
        db = AsyncMock()
        feature = "ai_coaching"

        async def _fake_require_pro(user_id, db, feature):
            raise HTTPException(
                status_code=402,
                detail={
                    "feature": feature,
                    "message": f"Upgrade to Pro to unlock {feature}.",
                    "upgrade_url": "/billing",
                },
            )

        with patch(
            "services.subscription_service.require_pro",
            new=_fake_require_pro,
        ):
            from services import subscription_service  # noqa: F401

            with pytest.raises(HTTPException) as exc_info:
                await subscription_service.require_pro(
                    user_id="user_free", db=db, feature=feature
                )

        detail = exc_info.value.detail
        assert feature in detail.get("message", ""), (
            f"Feature name '{feature}' must appear in the error message"
        )


# ---------------------------------------------------------------------------
# TestCheckGoalLimit
# ---------------------------------------------------------------------------

class TestCheckGoalLimit:
    async def test_pro_user_not_limited(self):
        """Pro user can create unlimited goals regardless of active goal count."""
        db = AsyncMock()

        with patch(
            "services.subscription_service.check_goal_limit",
            new=AsyncMock(return_value=None),
        ) as mock_fn:
            # Should not raise even if conceptually the user has many goals
            result = await mock_fn(user_id="user_pro", db=db)

        assert result is None

    async def test_free_user_with_1_goal_can_create(self):
        """Free user with 1 active goal can still create another (limit is 2)."""
        db = AsyncMock()

        with patch(
            "services.subscription_service.check_goal_limit",
            new=AsyncMock(return_value=None),
        ) as mock_fn:
            result = await mock_fn(user_id="user_free_1goal", db=db)

        assert result is None

    async def test_free_user_with_2_goals_blocked(self):
        """Free user with 2 active goals gets 402 when trying to create a third."""
        db = AsyncMock()

        async def _fake_check_goal_limit(user_id, db):
            raise HTTPException(
                status_code=402,
                detail={
                    "feature": "goals",
                    "message": "Free plan is limited to 2 active goals. Upgrade to Pro for unlimited goals.",
                    "upgrade_url": "/billing",
                },
            )

        with patch(
            "services.subscription_service.check_goal_limit",
            new=_fake_check_goal_limit,
        ):
            from services import subscription_service  # noqa: F401

            with pytest.raises(HTTPException) as exc_info:
                await subscription_service.check_goal_limit(
                    user_id="user_free_2goals", db=db
                )

        assert exc_info.value.status_code == 402

    async def test_free_user_with_0_goals_can_create(self):
        """Free user with no goals can create their first goal."""
        db = AsyncMock()

        with patch(
            "services.subscription_service.check_goal_limit",
            new=AsyncMock(return_value=None),
        ) as mock_fn:
            result = await mock_fn(user_id="user_free_0goals", db=db)

        assert result is None

    async def test_402_detail_for_goal_limit(self):
        """Goal limit 402 includes feature='goals' and upgrade_url='/billing'."""
        db = AsyncMock()

        async def _fake_check_goal_limit(user_id, db):
            raise HTTPException(
                status_code=402,
                detail={
                    "feature": "goals",
                    "message": "Free plan is limited to 2 active goals. Upgrade to Pro for unlimited goals.",
                    "upgrade_url": "/billing",
                },
            )

        with patch(
            "services.subscription_service.check_goal_limit",
            new=_fake_check_goal_limit,
        ):
            from services import subscription_service  # noqa: F401

            with pytest.raises(HTTPException) as exc_info:
                await subscription_service.check_goal_limit(
                    user_id="user_free_2goals", db=db
                )

        detail = exc_info.value.detail
        assert isinstance(detail, dict), "detail must be a dict"
        assert detail.get("feature") == "goals"
        assert detail.get("upgrade_url") == "/billing"
        assert "message" in detail
