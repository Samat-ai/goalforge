"""
Integration-style tests verifying that plan limits are enforced at the route level.

These tests exercise the HTTP layer via the existing test client from conftest.py.
They are marked xfail(strict=False) so they are recorded as expected failures on
main (where the feature-gating PR has not been merged yet), and will be promoted
to regular passing tests once feature/feature-gating lands.

Routes exercised
----------------
POST /users/{user_id}/goals           — goal creation limit for free users
POST /users/{user_id}/coach/sessions/start — pro-only coaching gate
POST /users/{user_id}/energy-resize   — pro-only energy resize gate
"""

import pytest
from tests.conftest import TEST_USER_ID, OTHER_USER_ID, create_test_goal

pytestmark = pytest.mark.asyncio

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_GOAL_PAYLOAD = {"raw_input": "I want to run a 5K race in under 25 minutes within 3 months"}


async def _create_goal(client) -> dict:
    """Create one fully-populated goal and return its JSON dict."""
    return await create_test_goal(client)


# ---------------------------------------------------------------------------
# TestGoalCreationLimit
# ---------------------------------------------------------------------------

class TestGoalCreationLimit:
    @pytest.mark.xfail(strict=False, reason="feature/feature-gating not merged yet")
    async def test_free_user_cannot_create_third_goal(self, client):
        """Free plan allows 2 active goals; the 3rd POST must return 402."""
        # Create the two goals the free plan allows
        await _create_goal(client)
        await _create_goal(client)

        # Third goal creation should be blocked
        resp = await client.post(f"/users/{TEST_USER_ID}/goals", json=_GOAL_PAYLOAD)
        assert resp.status_code == 402, (
            "Expected 402 Payment Required when a free user exceeds the 2-goal limit"
        )
        detail = resp.json().get("detail", {})
        assert isinstance(detail, dict), "402 detail must be a JSON object"
        assert detail.get("feature") == "goals"
        assert detail.get("upgrade_url") == "/billing"

    @pytest.mark.xfail(strict=False, reason="feature/feature-gating not merged yet")
    async def test_pro_user_can_create_unlimited_goals(self, client):
        """Pro users are not subject to the 2-goal limit."""
        from unittest.mock import AsyncMock, patch

        # Simulate a pro subscription so check_goal_limit becomes a no-op
        with patch(
            "services.subscription_service.check_goal_limit",
            new=AsyncMock(return_value=None),
        ):
            for _ in range(3):
                resp = await client.post(f"/users/{TEST_USER_ID}/goals", json=_GOAL_PAYLOAD)
                assert resp.status_code in (200, 201, 202), (
                    "Pro users must be able to create goals beyond the free-tier limit"
                )

    @pytest.mark.xfail(strict=False, reason="feature/feature-gating not merged yet")
    async def test_goal_limit_402_detail_structure(self, client):
        """The 402 response body for goal limit includes required keys."""
        await _create_goal(client)
        await _create_goal(client)

        resp = await client.post(f"/users/{TEST_USER_ID}/goals", json=_GOAL_PAYLOAD)
        assert resp.status_code == 402

        detail = resp.json().get("detail", {})
        required_keys = {"feature", "message", "upgrade_url"}
        missing = required_keys - set(detail.keys())
        assert not missing, f"402 detail is missing keys: {missing}"

    @pytest.mark.xfail(strict=False, reason="feature/feature-gating not merged yet")
    async def test_abandoned_goals_do_not_count_toward_limit(self, client):
        """Abandoned goals are inactive and must NOT count against the free-tier limit."""
        from unittest.mock import AsyncMock, patch

        goal1 = await _create_goal(client)
        goal2 = await _create_goal(client)

        # Abandon both goals so active count drops to 0
        await client.patch(f"/goals/{goal1['id']}", json={"status": "abandoned"})
        await client.patch(f"/goals/{goal2['id']}", json={"status": "abandoned"})

        # Now creating a new goal should succeed
        resp = await client.post(f"/users/{TEST_USER_ID}/goals", json=_GOAL_PAYLOAD)
        assert resp.status_code in (200, 201, 202), (
            "Abandoned goals must not count toward the free-tier active goal limit"
        )


# ---------------------------------------------------------------------------
# TestCoachingGate
# ---------------------------------------------------------------------------

class TestCoachingGate:
    @pytest.mark.xfail(strict=False, reason="feature/feature-gating not merged yet")
    async def test_free_user_cannot_start_coaching(self, client):
        """Coaching is a Pro-only feature; free users must receive 402."""
        resp = await client.post(f"/users/{TEST_USER_ID}/coach/sessions/start")
        assert resp.status_code == 402, (
            "Expected 402 Payment Required when a free user attempts to start a coach session"
        )
        detail = resp.json().get("detail", {})
        assert isinstance(detail, dict), "402 detail must be a JSON object"
        assert detail.get("upgrade_url") == "/billing"

    @pytest.mark.xfail(strict=False, reason="feature/feature-gating not merged yet")
    async def test_coaching_402_detail_includes_feature(self, client):
        """Coaching 402 detail must name the blocked feature."""
        resp = await client.post(f"/users/{TEST_USER_ID}/coach/sessions/start")
        assert resp.status_code == 402

        detail = resp.json().get("detail", {})
        assert "feature" in detail, "Coaching 402 detail must include 'feature' key"
        # The feature value should relate to coaching
        assert detail["feature"] in ("ai_coaching", "coaching", "coach")

    @pytest.mark.xfail(strict=False, reason="feature/feature-gating not merged yet")
    async def test_pro_user_can_start_coaching(self, client):
        """Pro users can start a coach session without hitting a 402."""
        from unittest.mock import AsyncMock, patch

        with patch(
            "services.subscription_service.require_pro",
            new=AsyncMock(return_value=None),
        ):
            resp = await client.post(f"/users/{TEST_USER_ID}/coach/sessions/start")
            # 201 Created is expected for a new session; 200 if resumed
            assert resp.status_code in (200, 201), (
                "Pro users must be able to start a coach session"
            )


# ---------------------------------------------------------------------------
# TestEnergyResizeGate
# ---------------------------------------------------------------------------

class TestEnergyResizeGate:
    @pytest.mark.xfail(strict=False, reason="feature/feature-gating not merged yet")
    async def test_free_user_cannot_energy_resize(self, client):
        """Energy resize is a Pro-only feature; free users must receive 402."""
        resp = await client.post(f"/users/{TEST_USER_ID}/energy-resize")
        assert resp.status_code == 402, (
            "Expected 402 Payment Required when a free user attempts energy resize"
        )
        detail = resp.json().get("detail", {})
        assert isinstance(detail, dict), "402 detail must be a JSON object"
        assert detail.get("upgrade_url") == "/billing"

    @pytest.mark.xfail(strict=False, reason="feature/feature-gating not merged yet")
    async def test_energy_resize_402_detail_includes_feature(self, client):
        """Energy resize 402 detail must name the blocked feature."""
        resp = await client.post(f"/users/{TEST_USER_ID}/energy-resize")
        assert resp.status_code == 402

        detail = resp.json().get("detail", {})
        assert "feature" in detail, "Energy resize 402 detail must include 'feature' key"
        assert detail["feature"] in ("energy_resize", "energy-resize", "energy_ai")

    @pytest.mark.xfail(strict=False, reason="feature/feature-gating not merged yet")
    async def test_pro_user_can_energy_resize(self, client):
        """Pro users can call energy resize without hitting a 402."""
        from unittest.mock import AsyncMock, patch

        # Create a goal so there are tasks to resize
        await _create_goal(client)

        with patch(
            "services.subscription_service.require_pro",
            new=AsyncMock(return_value=None),
        ):
            resp = await client.post(f"/users/{TEST_USER_ID}/energy-resize")
            # 200 OK with task list, or 200 with empty list if no tasks today
            assert resp.status_code == 200, (
                "Pro users must be able to use energy resize"
            )
