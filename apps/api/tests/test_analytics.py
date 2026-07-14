"""
Tests for the enhanced analytics endpoints.
Route tests are @pytest.mark.xfail(strict=False) until feature/analytics-enhanced is merged.
Data-setup and query tests run on main today.
"""
import uuid
from datetime import date, timedelta, datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from auth import get_current_user_id
from main import app
from models import DailyTask, Goal, Milestone, User
from tests.conftest import TEST_USER_ID, OTHER_USER_ID, create_test_goal

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _ensure_user(session: AsyncSession, user_id: str, email: str) -> None:
    """Insert a User row if it does not already exist."""
    existing = await session.get(User, user_id)
    if existing is None:
        session.add(
            User(
                id=user_id,
                email=email,
                star_points=0,
                timezone="UTC",
            )
        )
        await session.flush()


async def _insert_completed_task(
    session: AsyncSession,
    goal_id: uuid.UUID,
    milestone_id: uuid.UUID,
    assigned: date,
    completed_at: datetime,
) -> DailyTask:
    """Create a completed DailyTask directly in the DB."""
    task = DailyTask(
        id=uuid.uuid4(),
        goal_id=goal_id,
        milestone_id=milestone_id,
        description="Analytics test task",
        tip="Keep going.",
        assigned_date=assigned,
        is_completed=True,
        completed_at=completed_at,
    )
    session.add(task)
    return task


# ---------------------------------------------------------------------------
# Fixture: user_with_history
# ---------------------------------------------------------------------------

@pytest.fixture
async def user_with_history(client, engine):
    """
    Creates a user with:
    - 2 active goals (via the HTTP layer so all FK rows are wired up)
    - 30 days of task completions (3 tasks/day) with a 2-day gap at day 15
    - Some completed milestones

    Returns (user_id, goal_ids, task_ids).
    """
    # Create two goals via the standard helper (sets up User, Goal, Milestone rows)
    goal1 = await create_test_goal(client)
    goal2 = await create_test_goal(client)

    goal_ids = [goal1["id"], goal2["id"]]
    milestone1_id = uuid.UUID(goal1["milestones"][0]["id"])
    milestone2_id = uuid.UUID(goal2["milestones"][0]["id"])

    session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )

    today = date.today()
    task_ids: list[str] = []

    async with session_factory() as session:
        for day_offset in range(30):
            # Skip days 14 and 15 (the 2-day gap)
            if day_offset in (14, 15):
                continue

            day = today - timedelta(days=day_offset)
            # Alternate between the two goals/milestones
            goal_id = uuid.UUID(goal_ids[day_offset % 2])
            ms_id = milestone1_id if day_offset % 2 == 0 else milestone2_id

            for hour in (9, 14, 19):
                completed_at = datetime(
                    day.year, day.month, day.day, hour, 0, 0, tzinfo=timezone.utc
                )
                task = await _insert_completed_task(
                    session,
                    goal_id=goal_id,
                    milestone_id=ms_id,
                    assigned=day,
                    completed_at=completed_at,
                )
                task_ids.append(str(task.id))

        # Mark milestone1 as completed
        ms = await session.get(Milestone, milestone1_id)
        if ms:
            ms.is_completed = True
            ms.completed_at = datetime.now(timezone.utc)
            ms.sprint_status = "completed"

        await session.commit()

    return TEST_USER_ID, goal_ids, task_ids


# ---------------------------------------------------------------------------
# Overview endpoint
# ---------------------------------------------------------------------------

class TestAnalyticsOverview:
    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_overview_returns_expected_fields(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/overview")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_tasks_completed" in data
        assert "current_streak_days" in data
        assert "longest_streak_days" in data
        assert "average_tasks_per_day" in data
        assert "most_active_hour" in data
        assert "active_days_last_30" in data

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_overview_zero_for_new_user(self, client):
        """New user with no completions gets zeroes, not errors."""
        # create_test_goal seeds the user row; no tasks are completed
        await create_test_goal(client)
        resp = await client.get(f"/users/{TEST_USER_ID}/analytics/overview")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_tasks_completed"] == 0
        assert data["current_streak_days"] == 0

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_overview_requires_auth(self, client):
        # Temporarily remove the auth override so the request is unauthenticated
        app.dependency_overrides.pop(get_current_user_id, None)
        try:
            resp = await client.get(f"/users/{TEST_USER_ID}/analytics/overview")
            assert resp.status_code == 401
        finally:
            app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_overview_enforces_ownership(self, client):
        """Authenticated user cannot read another user's analytics."""
        await create_test_goal(client)
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        try:
            resp = await client.get(f"/users/{TEST_USER_ID}/analytics/overview")
            assert resp.status_code == 403
        finally:
            app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_overview_total_tasks_matches_completions(self, client, user_with_history):
        """total_tasks_completed should equal the tasks we inserted (28 days * 3)."""
        user_id, _, task_ids = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/overview")
        assert resp.status_code == 200
        assert resp.json()["total_tasks_completed"] == len(task_ids)

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_overview_most_active_hour_in_valid_range(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/overview")
        assert resp.status_code == 200
        assert 0 <= resp.json()["most_active_hour"] <= 23

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_overview_average_tasks_per_day_positive(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/overview")
        assert resp.status_code == 200
        assert resp.json()["average_tasks_per_day"] > 0.0


# ---------------------------------------------------------------------------
# Heatmap endpoint
# ---------------------------------------------------------------------------

class TestCompletionHeatmap:
    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_heatmap_default_90_days(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/completion-heatmap")
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert "max_count" in data
        assert len(data["data"]) <= 90

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_heatmap_custom_days(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(
            f"/users/{user_id}/analytics/completion-heatmap?days=30"
        )
        assert resp.status_code == 200
        assert len(resp.json()["data"]) <= 30

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_heatmap_dates_in_order(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/completion-heatmap")
        assert resp.status_code == 200
        dates = [entry["date"] for entry in resp.json()["data"]]
        assert dates == sorted(dates)

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_heatmap_max_count_matches_data(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/completion-heatmap")
        assert resp.status_code == 200
        data = resp.json()
        if data["data"]:
            computed_max = max(d["count"] for d in data["data"])
            assert data["max_count"] == computed_max

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_heatmap_entries_have_required_fields(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/completion-heatmap")
        assert resp.status_code == 200
        for entry in resp.json()["data"]:
            assert "date" in entry
            assert "count" in entry
            assert entry["count"] >= 0

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_heatmap_gap_days_absent_or_zero(self, client, user_with_history):
        """Days with no completions should either be absent or have count=0."""
        user_id, _, _ = user_with_history
        today = date.today()
        # Day 14 and 15 were skipped in user_with_history
        gap_dates = {
            str(today - timedelta(days=14)),
            str(today - timedelta(days=15)),
        }
        resp = await client.get(f"/users/{user_id}/analytics/completion-heatmap")
        assert resp.status_code == 200
        for entry in resp.json()["data"]:
            if entry["date"] in gap_dates:
                assert entry["count"] == 0, (
                    f"Gap day {entry['date']} should have count=0, got {entry['count']}"
                )

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_heatmap_empty_for_new_user(self, client):
        await create_test_goal(client)
        resp = await client.get(f"/users/{TEST_USER_ID}/analytics/completion-heatmap")
        assert resp.status_code == 200
        data = resp.json()
        # Either empty list or all counts are zero
        counts = [e["count"] for e in data["data"]]
        assert all(c == 0 for c in counts)
        assert data["max_count"] == 0


# ---------------------------------------------------------------------------
# Streak history
# ---------------------------------------------------------------------------

class TestStreakHistory:
    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_streak_history_fields(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/streak-history")
        assert resp.status_code == 200
        data = resp.json()
        assert "current_streak" in data
        assert "longest_streak" in data
        assert "streak_history" in data

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_longest_streak_gte_current(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/streak-history")
        assert resp.status_code == 200
        data = resp.json()
        assert data["longest_streak"] >= data["current_streak"]

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_streak_periods_have_required_fields(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/streak-history")
        assert resp.status_code == 200
        for period in resp.json()["streak_history"]:
            assert "start_date" in period
            assert "end_date" in period
            assert "length" in period
            assert period["length"] > 0

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_streak_gap_detected(self, client, user_with_history):
        """The 2-day gap at days 14-15 should appear as a streak break."""
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/streak-history")
        assert resp.status_code == 200
        history = resp.json()["streak_history"]
        # With a gap at days 14-15 there should be at least 2 streak periods
        assert len(history) >= 2, (
            "Expected at least 2 streak periods due to the 2-day gap"
        )

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_streak_zero_for_new_user(self, client):
        await create_test_goal(client)
        resp = await client.get(f"/users/{TEST_USER_ID}/analytics/streak-history")
        assert resp.status_code == 200
        data = resp.json()
        assert data["current_streak"] == 0
        assert data["longest_streak"] == 0

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_streak_history_enforces_ownership(self, client):
        await create_test_goal(client)
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        try:
            resp = await client.get(f"/users/{TEST_USER_ID}/analytics/streak-history")
            assert resp.status_code == 403
        finally:
            app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID


# ---------------------------------------------------------------------------
# Goal performance
# ---------------------------------------------------------------------------

class TestGoalPerformance:
    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_goal_performance_fields(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/goal-performance")
        assert resp.status_code == 200
        data = resp.json()
        assert "goals" in data

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_completion_rate_between_0_and_1(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/goal-performance")
        assert resp.status_code == 200
        for goal in resp.json()["goals"]:
            assert 0.0 <= goal["completion_rate"] <= 1.0

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_goal_performance_contains_both_goals(self, client, user_with_history):
        user_id, goal_ids, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/goal-performance")
        assert resp.status_code == 200
        returned_ids = {g["goal_id"] for g in resp.json()["goals"]}
        for gid in goal_ids:
            assert gid in returned_ids

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_goal_performance_entries_have_required_fields(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/goal-performance")
        assert resp.status_code == 200
        for goal in resp.json()["goals"]:
            assert "goal_id" in goal
            assert "completion_rate" in goal

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_goal_performance_enforces_ownership(self, client):
        await create_test_goal(client)
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        try:
            resp = await client.get(f"/users/{TEST_USER_ID}/analytics/goal-performance")
            assert resp.status_code == 403
        finally:
            app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_goal_performance_empty_list_for_new_user(self, client):
        await create_test_goal(client)
        resp = await client.get(f"/users/{TEST_USER_ID}/analytics/goal-performance")
        assert resp.status_code == 200
        # goals list exists; may be empty or contain goals with 0 completion
        data = resp.json()
        assert isinstance(data["goals"], list)


# ---------------------------------------------------------------------------
# Activity by hour
# ---------------------------------------------------------------------------

class TestActivityByHour:
    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_activity_has_24_hours(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/activity-by-hour")
        assert resp.status_code == 200
        data = resp.json()
        assert "hourly" in data
        assert len(data["hourly"]) == 24

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_peak_hour_in_valid_range(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/activity-by-hour")
        assert resp.status_code == 200
        assert 0 <= resp.json()["peak_hour"] <= 23

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_hourly_counts_are_non_negative(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/activity-by-hour")
        assert resp.status_code == 200
        for entry in resp.json()["hourly"]:
            assert entry["count"] >= 0

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_hourly_covers_all_hours_0_to_23(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/activity-by-hour")
        assert resp.status_code == 200
        hours = {entry["hour"] for entry in resp.json()["hourly"]}
        assert hours == set(range(24))

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_activity_enforces_ownership(self, client):
        await create_test_goal(client)
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        try:
            resp = await client.get(f"/users/{TEST_USER_ID}/analytics/activity-by-hour")
            assert resp.status_code == 403
        finally:
            app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_peak_hour_reflects_inserted_data(self, client, user_with_history):
        """
        user_with_history inserts completions at hours 9, 14, 19.
        The peak hour must be one of those three.
        """
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/activity-by-hour")
        assert resp.status_code == 200
        assert resp.json()["peak_hour"] in (9, 14, 19)


# ---------------------------------------------------------------------------
# Velocity
# ---------------------------------------------------------------------------

class TestVelocity:
    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_velocity_has_weeks(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/velocity")
        assert resp.status_code == 200
        data = resp.json()
        assert "weeks" in data
        assert "trend" in data

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_trend_is_valid_value(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/velocity")
        assert resp.status_code == 200
        assert resp.json()["trend"] in ("improving", "declining", "stable")

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_velocity_weeks_have_required_fields(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/velocity")
        assert resp.status_code == 200
        for week in resp.json()["weeks"]:
            assert "week_start" in week
            assert "tasks_completed" in week

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_velocity_tasks_completed_non_negative(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/velocity")
        assert resp.status_code == 200
        for week in resp.json()["weeks"]:
            assert week["tasks_completed"] >= 0

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_velocity_enforces_ownership(self, client):
        await create_test_goal(client)
        app.dependency_overrides[get_current_user_id] = lambda: OTHER_USER_ID
        try:
            resp = await client.get(f"/users/{TEST_USER_ID}/analytics/velocity")
            assert resp.status_code == 403
        finally:
            app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_velocity_weeks_sorted_chronologically(self, client, user_with_history):
        user_id, _, _ = user_with_history
        resp = await client.get(f"/users/{user_id}/analytics/velocity")
        assert resp.status_code == 200
        week_starts = [w["week_start"] for w in resp.json()["weeks"]]
        assert week_starts == sorted(week_starts)

    @pytest.mark.xfail(strict=False, reason="feature/analytics-enhanced not merged")
    async def test_velocity_empty_for_new_user(self, client):
        await create_test_goal(client)
        resp = await client.get(f"/users/{TEST_USER_ID}/analytics/velocity")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["weeks"], list)
        assert data["trend"] in ("improving", "declining", "stable")
