"""
Pure logic tests for analytics computations that don't need HTTP.
These run on main today and verify the streak calculation and trend algorithms.
"""
from datetime import date, timedelta

import pytest


# ---------------------------------------------------------------------------
# Inline algorithm implementations
# These mirror the logic expected inside the analytics service so the tests
# document — and guard against regressions in — the core computation.
# ---------------------------------------------------------------------------


def compute_streak(active_days: set[date]) -> int:
    """
    Return the current streak: how many consecutive days ending today (or
    yesterday, to handle the case where today's tasks aren't done yet) are
    in active_days.
    """
    if not active_days:
        return 0

    today = date.today()
    # Accept a streak that ends today OR ended yesterday
    for anchor in (today, today - timedelta(days=1)):
        if anchor not in active_days:
            continue
        streak = 0
        cursor = anchor
        while cursor in active_days:
            streak += 1
            cursor -= timedelta(days=1)
        return streak
    return 0


def compute_longest_streak(active_days: set[date]) -> int:
    """Return the longest consecutive-day run in active_days."""
    if not active_days:
        return 0

    sorted_days = sorted(active_days)
    longest = current = 1
    for i in range(1, len(sorted_days)):
        if sorted_days[i] - sorted_days[i - 1] == timedelta(days=1):
            current += 1
            longest = max(longest, current)
        else:
            current = 1
    return longest


def compute_streak_periods(active_days: set[date]) -> list[dict]:
    """
    Split active_days into contiguous streak periods.
    Returns a list of {"start_date", "end_date", "length"} dicts, sorted
    chronologically.
    """
    if not active_days:
        return []

    sorted_days = sorted(active_days)
    periods: list[dict] = []
    period_start = sorted_days[0]
    prev = sorted_days[0]

    for day in sorted_days[1:]:
        if day - prev == timedelta(days=1):
            prev = day
        else:
            periods.append(
                {
                    "start_date": str(period_start),
                    "end_date": str(prev),
                    "length": (prev - period_start).days + 1,
                }
            )
            period_start = day
            prev = day

    periods.append(
        {
            "start_date": str(period_start),
            "end_date": str(prev),
            "length": (prev - period_start).days + 1,
        }
    )
    return periods


def compute_velocity_trend(
    recent_total: int, prior_total: int, tolerance: float = 0.05
) -> str:
    """
    Compare recent 4-week total vs prior 4-week total.
    Returns "improving", "declining", or "stable".
    Stable when the difference is within `tolerance` * max(prior, 1).
    """
    if prior_total == 0 and recent_total == 0:
        return "stable"
    threshold = tolerance * max(prior_total, 1)
    diff = recent_total - prior_total
    if diff > threshold:
        return "improving"
    if diff < -threshold:
        return "declining"
    return "stable"


# ---------------------------------------------------------------------------
# Streak calculation tests
# ---------------------------------------------------------------------------


class TestStreakCalculation:
    def test_consecutive_days_form_streak(self):
        """7 consecutive days ending today = streak of 7."""
        today = date.today()
        days = {today - timedelta(days=i) for i in range(7)}
        assert compute_streak(days) == 7

    def test_gap_breaks_streak(self):
        """A 2-day gap resets the streak counter."""
        today = date.today()
        # Days 0-6 present; days 7-8 missing; days 9-14 present
        days = {today - timedelta(days=i) for i in range(7)} | {
            today - timedelta(days=i) for i in range(9, 15)
        }
        streak = compute_streak(days)
        # Only the unbroken run ending today/yesterday counts
        assert streak == 7

    def test_empty_days_gives_zero_streak(self):
        assert compute_streak(set()) == 0

    def test_single_day_is_streak_of_1(self):
        days = {date.today()}
        assert compute_streak(days) == 1

    def test_streak_anchors_on_yesterday_when_today_missing(self):
        """If today has no activity but yesterday does, streak continues."""
        today = date.today()
        yesterday = today - timedelta(days=1)
        days = {yesterday - timedelta(days=i) for i in range(5)}
        assert compute_streak(days) == 5

    def test_streak_breaks_when_both_today_and_yesterday_missing(self):
        """Two consecutive missed days means current streak is 0."""
        today = date.today()
        days = {today - timedelta(days=i) for i in range(3, 10)}
        assert compute_streak(days) == 0


class TestLongestStreak:
    def test_longest_streak_all_consecutive(self):
        today = date.today()
        days = {today - timedelta(days=i) for i in range(10)}
        assert compute_longest_streak(days) == 10

    def test_longest_streak_picks_max_run(self):
        today = date.today()
        # Run of 3, gap, run of 7
        run_a = {today - timedelta(days=i) for i in range(3)}
        run_b = {today - timedelta(days=i) for i in range(5, 12)}
        assert compute_longest_streak(run_a | run_b) == 7

    def test_longest_streak_empty(self):
        assert compute_longest_streak(set()) == 0

    def test_longest_streak_single_day(self):
        assert compute_longest_streak({date.today()}) == 1

    def test_longest_streak_gte_current(self):
        today = date.today()
        # Active yesterday and today, but also a 10-day run ending 30 days ago
        recent = {today, today - timedelta(days=1)}
        old_run = {today - timedelta(days=30 + i) for i in range(10)}
        days = recent | old_run
        longest = compute_longest_streak(days)
        current = compute_streak(days)
        assert longest >= current


class TestStreakPeriods:
    def test_two_runs_produce_two_periods(self):
        today = date.today()
        run_a = {today - timedelta(days=i) for i in range(3)}          # 3-day
        run_b = {today - timedelta(days=i) for i in range(6, 10)}      # 4-day
        periods = compute_streak_periods(run_a | run_b)
        assert len(periods) == 2

    def test_period_length_matches_days(self):
        today = date.today()
        days = {today - timedelta(days=i) for i in range(5)}
        periods = compute_streak_periods(days)
        assert len(periods) == 1
        assert periods[0]["length"] == 5

    def test_periods_sorted_chronologically(self):
        today = date.today()
        run_a = {today - timedelta(days=i) for i in range(3)}
        run_b = {today - timedelta(days=i) for i in range(10, 15)}
        periods = compute_streak_periods(run_a | run_b)
        starts = [p["start_date"] for p in periods]
        assert starts == sorted(starts)

    def test_all_periods_have_positive_length(self):
        today = date.today()
        days = (
            {today - timedelta(days=i) for i in range(3)}
            | {today - timedelta(days=i) for i in range(7, 12)}
            | {today - timedelta(days=i) for i in range(20, 22)}
        )
        for period in compute_streak_periods(days):
            assert period["length"] > 0

    def test_empty_days_returns_empty_periods(self):
        assert compute_streak_periods(set()) == []

    def test_single_day_is_one_period_of_length_1(self):
        periods = compute_streak_periods({date.today()})
        assert len(periods) == 1
        assert periods[0]["length"] == 1


# ---------------------------------------------------------------------------
# Velocity trend tests
# ---------------------------------------------------------------------------


class TestVelocityTrend:
    def test_increasing_completions_is_improving(self):
        """More tasks in recent 4 weeks vs prior 4 = improving."""
        assert compute_velocity_trend(recent_total=50, prior_total=30) == "improving"

    def test_decreasing_completions_is_declining(self):
        assert compute_velocity_trend(recent_total=20, prior_total=50) == "declining"

    def test_equal_completions_is_stable(self):
        assert compute_velocity_trend(recent_total=40, prior_total=40) == "stable"

    def test_both_zero_is_stable(self):
        assert compute_velocity_trend(recent_total=0, prior_total=0) == "stable"

    def test_small_variance_within_tolerance_is_stable(self):
        """A difference of 1 on a base of 100 is within the default 5% tolerance."""
        assert compute_velocity_trend(recent_total=101, prior_total=100) == "stable"

    def test_large_improvement_from_zero_is_improving(self):
        """Going from 0 prior to a non-trivial recent total is improving."""
        assert compute_velocity_trend(recent_total=10, prior_total=0) == "improving"

    def test_decline_from_nonzero_to_zero_is_declining(self):
        assert compute_velocity_trend(recent_total=0, prior_total=20) == "declining"

    def test_trend_values_are_exhaustive(self):
        """Verify all three valid trend strings can be produced."""
        results = {
            compute_velocity_trend(100, 50),
            compute_velocity_trend(50, 100),
            compute_velocity_trend(70, 70),
        }
        assert results == {"improving", "declining", "stable"}
