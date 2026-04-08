"""Enhanced analytics routes for GoalForge."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, timedelta, datetime, timezone
from collections import defaultdict
from zoneinfo import ZoneInfo

from auth import get_current_user_id
from database import get_db
from deps import _ensure_owner
from models import DailyTask, Goal, Milestone, User
from schemas import (
    AnalyticsOverview,
    HeatmapResponse,
    StreakHistory,
    GoalPerformance,
    ActivityByHour,
    VelocityResponse,
)
from utils import user_today

router = APIRouter(prefix="/users/{user_id}/analytics", tags=["analytics"])


def _compute_streaks(sorted_dates: list[date]) -> tuple[int, int, list[dict]]:
    """Given a sorted list of unique dates (ascending), compute current streak,
    longest streak, and full streak history list."""
    if not sorted_dates:
        return 0, 0, []

    streak_history: list[dict] = []
    current_streak_start: date | None = None
    current_streak_end: date | None = None
    current_streak_len = 0
    longest_streak_len = 0

    prev: date | None = None
    streak_start = sorted_dates[0]
    streak_len = 1

    for i, d in enumerate(sorted_dates):
        if i == 0:
            streak_start = d
            streak_len = 1
        else:
            if (d - prev).days == 1:  # type: ignore[operator]
                streak_len += 1
            else:
                # flush previous streak
                streak_history.append({
                    "start_date": streak_start.isoformat(),
                    "end_date": prev.isoformat(),  # type: ignore[union-attr]
                    "length": streak_len,
                })
                if streak_len > longest_streak_len:
                    longest_streak_len = streak_len
                streak_start = d
                streak_len = 1
        prev = d

    # flush last streak
    if prev is not None:
        streak_history.append({
            "start_date": streak_start.isoformat(),
            "end_date": prev.isoformat(),
            "length": streak_len,
        })
        if streak_len > longest_streak_len:
            longest_streak_len = streak_len

    # reverse so most recent streaks come first
    streak_history.reverse()

    return longest_streak_len, streak_history


def _current_streak_from_dates(sorted_dates_desc: list[date], today: date) -> int:
    """Compute current streak from a descending list of dates."""
    streak = 0
    cursor = today
    for d in sorted_dates_desc:
        if d == cursor:
            streak += 1
            cursor -= timedelta(days=1)
        elif d < cursor:
            break
    return streak


@router.get("/overview", response_model=AnalyticsOverview)
async def get_analytics_overview(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Summary card: totals, streaks, avg tasks/day, peak hour, active days."""
    _ensure_owner(user_id, current_user_id)

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")

    today = user_today(user.timezone)
    thirty_days_ago = today - timedelta(days=29)

    # Total tasks completed
    total_completed = (
        await db.execute(
            select(func.count())
            .select_from(DailyTask)
            .join(Goal, DailyTask.goal_id == Goal.id)
            .where(Goal.user_id == user_id, DailyTask.is_completed.is_(True))
        )
    ).scalar() or 0

    # Total goals created & achieved
    goal_stats = (
        await db.execute(
            select(Goal.status, func.count().label("cnt"))
            .where(Goal.user_id == user_id)
            .group_by(Goal.status)
        )
    ).all()
    total_goals_created = sum(row.cnt for row in goal_stats)
    total_goals_achieved = next((row.cnt for row in goal_stats if row.status == "achieved"), 0)

    # Completed dates (all time, descending) for streak computation
    completed_dates_desc = (
        await db.execute(
            select(DailyTask.assigned_date)
            .join(Goal, DailyTask.goal_id == Goal.id)
            .where(
                Goal.user_id == user_id,
                DailyTask.is_completed.is_(True),
                DailyTask.assigned_date <= today,
            )
            .distinct()
            .order_by(DailyTask.assigned_date.desc())
        )
    ).scalars().all()

    current_streak = _current_streak_from_dates(list(completed_dates_desc), today)

    # Longest streak — need ascending list
    sorted_asc = sorted(set(completed_dates_desc))
    longest_streak = 0
    if sorted_asc:
        _, history = _compute_streaks(sorted_asc)
        longest_streak = max((h["length"] for h in history), default=0)

    # Average tasks per day (over days that have at least one task assigned)
    distinct_active_days = (
        await db.execute(
            select(func.count(DailyTask.assigned_date.distinct()))
            .join(Goal, DailyTask.goal_id == Goal.id)
            .where(
                Goal.user_id == user_id,
                DailyTask.is_completed.is_(True),
            )
        )
    ).scalar() or 0

    average_tasks_per_day = round(total_completed / distinct_active_days, 2) if distinct_active_days else 0.0

    # Most active hour (from completed_at timestamps)
    completed_timestamps = (
        await db.execute(
            select(DailyTask.completed_at)
            .join(Goal, DailyTask.goal_id == Goal.id)
            .where(
                Goal.user_id == user_id,
                DailyTask.is_completed.is_(True),
                DailyTask.completed_at.isnot(None),
            )
        )
    ).scalars().all()

    hour_counts: dict[int, int] = defaultdict(int)
    tz = ZoneInfo(user.timezone)
    for ts in completed_timestamps:
        if ts is not None:
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            local_ts = ts.astimezone(tz)
            hour_counts[local_ts.hour] += 1

    most_active_hour = max(hour_counts, key=lambda h: hour_counts[h]) if hour_counts else 0

    # Active days in last 30
    active_days_last_30 = (
        await db.execute(
            select(func.count(DailyTask.assigned_date.distinct()))
            .join(Goal, DailyTask.goal_id == Goal.id)
            .where(
                Goal.user_id == user_id,
                DailyTask.is_completed.is_(True),
                DailyTask.assigned_date >= thirty_days_ago,
                DailyTask.assigned_date <= today,
            )
        )
    ).scalar() or 0

    return AnalyticsOverview(
        total_tasks_completed=total_completed,
        total_goals_created=total_goals_created,
        total_goals_achieved=total_goals_achieved,
        current_streak_days=current_streak,
        longest_streak_days=longest_streak,
        average_tasks_per_day=average_tasks_per_day,
        most_active_hour=most_active_hour,
        active_days_last_30=active_days_last_30,
    )


@router.get("/completion-heatmap", response_model=HeatmapResponse)
async def get_completion_heatmap(
    user_id: str,
    days: int = Query(90, ge=7, le=365),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Daily completion counts with active-goal count for heatmap rendering."""
    _ensure_owner(user_id, current_user_id)

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")

    today = user_today(user.timezone)
    start_date = today - timedelta(days=days - 1)

    # Tasks completed per day
    task_rows = (
        await db.execute(
            select(DailyTask.assigned_date, func.count().label("cnt"))
            .join(Goal, DailyTask.goal_id == Goal.id)
            .where(
                Goal.user_id == user_id,
                DailyTask.is_completed.is_(True),
                DailyTask.assigned_date >= start_date,
                DailyTask.assigned_date <= today,
            )
            .group_by(DailyTask.assigned_date)
        )
    ).all()

    count_by_date: dict[date, int] = {row.assigned_date: row.cnt for row in task_rows}

    # Goals active on each day: goal created_at <= date and (status != abandoned or target_date >= date)
    # Simplified: count goals where created_at.date() <= day and status in ('active','achieved')
    goals_result = (
        await db.execute(
            select(Goal.created_at, Goal.target_date, Goal.status)
            .where(Goal.user_id == user_id)
        )
    ).all()

    data = []
    max_count = 0
    for i in range(days):
        d = start_date + timedelta(days=i)
        count = count_by_date.get(d, 0)
        if count > max_count:
            max_count = count

        # Count goals active on day d
        goals_active = sum(
            1
            for g in goals_result
            if g.created_at.date() <= d and (
                g.status in ("active", "achieved") or
                (hasattr(g, "target_date") and g.target_date is not None and g.target_date >= d)
            )
        )

        data.append({"date": d.isoformat(), "count": count, "goals_active": goals_active})

    return HeatmapResponse(data=data, max_count=max_count)


@router.get("/streak-history", response_model=StreakHistory)
async def get_streak_history(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Current/longest streak and full streak history list."""
    _ensure_owner(user_id, current_user_id)

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")

    today = user_today(user.timezone)

    completed_dates = (
        await db.execute(
            select(DailyTask.assigned_date)
            .join(Goal, DailyTask.goal_id == Goal.id)
            .where(
                Goal.user_id == user_id,
                DailyTask.is_completed.is_(True),
                DailyTask.assigned_date <= today,
            )
            .distinct()
            .order_by(DailyTask.assigned_date.asc())
        )
    ).scalars().all()

    sorted_dates = sorted(set(completed_dates))
    sorted_dates_desc = list(reversed(sorted_dates))

    current_streak = _current_streak_from_dates(sorted_dates_desc, today)
    _, streak_history = _compute_streaks(sorted_dates)
    longest_streak = max((h["length"] for h in streak_history), default=0)

    return StreakHistory(
        current_streak=current_streak,
        longest_streak=longest_streak,
        streak_history=streak_history,
    )


@router.get("/goal-performance", response_model=GoalPerformance)
async def get_goal_performance(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Per-goal metrics: completion rates, milestone progress, days active."""
    _ensure_owner(user_id, current_user_id)

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")

    today = user_today(user.timezone)

    goals_result = (
        await db.execute(
            select(Goal)
            .where(Goal.user_id == user_id)
            .order_by(Goal.created_at.desc())
        )
    ).scalars().all()

    goal_ids = [g.id for g in goals_result]

    if not goal_ids:
        return GoalPerformance(goals=[])

    # Tasks per goal: total and completed
    task_stats = (
        await db.execute(
            select(
                DailyTask.goal_id,
                func.count().label("total"),
                func.sum(
                    func.cast(DailyTask.is_completed, type_=func.count().type)
                ).label("completed"),
            )
            .where(DailyTask.goal_id.in_(goal_ids))
            .group_by(DailyTask.goal_id)
        )
    ).all()

    # Build task stats map
    task_map: dict = {}
    for row in task_stats:
        task_map[str(row.goal_id)] = {
            "total": row.total or 0,
            "completed": int(row.completed or 0),
        }

    # Milestone stats per goal
    milestone_stats = (
        await db.execute(
            select(
                Milestone.goal_id,
                func.count().label("total"),
                func.sum(
                    func.cast(Milestone.is_completed, type_=func.count().type)
                ).label("completed"),
            )
            .where(Milestone.goal_id.in_(goal_ids))
            .group_by(Milestone.goal_id)
        )
    ).all()

    milestone_map: dict = {}
    for row in milestone_stats:
        milestone_map[str(row.goal_id)] = {
            "total": row.total or 0,
            "completed": int(row.completed or 0),
        }

    goals_data = []
    for g in goals_result:
        gid = str(g.id)
        t = task_map.get(gid, {"total": 0, "completed": 0})
        m = milestone_map.get(gid, {"total": 0, "completed": 0})

        tasks_completed = t["completed"]
        tasks_total = t["total"]
        completion_rate = round(tasks_completed / tasks_total, 4) if tasks_total else 0.0

        # Days active: from goal creation date to today (or target_date, whichever is earlier)
        created_date = g.created_at.date() if hasattr(g.created_at, "date") else g.created_at
        end_date = min(today, g.target_date) if g.target_date else today
        days_active = max(0, (end_date - created_date).days + 1)

        goals_data.append({
            "goal_id": gid,
            "smart_title": g.smart_title,
            "goal_type": g.goal_type,
            "status": g.status,
            "tasks_completed": tasks_completed,
            "tasks_total": tasks_total,
            "completion_rate": completion_rate,
            "days_active": days_active,
            "milestones_completed": m["completed"],
            "milestones_total": m["total"],
        })

    return GoalPerformance(goals=goals_data)


@router.get("/activity-by-hour", response_model=ActivityByHour)
async def get_activity_by_hour(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Completion counts grouped by hour of day in user's local timezone."""
    _ensure_owner(user_id, current_user_id)

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")

    completed_timestamps = (
        await db.execute(
            select(DailyTask.completed_at)
            .join(Goal, DailyTask.goal_id == Goal.id)
            .where(
                Goal.user_id == user_id,
                DailyTask.is_completed.is_(True),
                DailyTask.completed_at.isnot(None),
            )
        )
    ).scalars().all()

    hour_counts: dict[int, int] = defaultdict(int)
    tz = ZoneInfo(user.timezone)
    for ts in completed_timestamps:
        if ts is not None:
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            local_ts = ts.astimezone(tz)
            hour_counts[local_ts.hour] += 1

    hourly = [{"hour": h, "count": hour_counts.get(h, 0)} for h in range(24)]
    peak_hour = max(hour_counts, key=lambda h: hour_counts[h]) if hour_counts else 0

    return ActivityByHour(hourly=hourly, peak_hour=peak_hour)


@router.get("/velocity", response_model=VelocityResponse)
async def get_velocity(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Weekly task completion velocity over last 12 weeks with trend."""
    _ensure_owner(user_id, current_user_id)

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")

    today = user_today(user.timezone)
    # Go back 12 full weeks from the start of this week (Monday)
    days_since_monday = today.weekday()  # 0=Mon, 6=Sun
    this_monday = today - timedelta(days=days_since_monday)
    window_start = this_monday - timedelta(weeks=11)

    task_rows = (
        await db.execute(
            select(DailyTask.assigned_date, func.count().label("cnt"))
            .join(Goal, DailyTask.goal_id == Goal.id)
            .where(
                Goal.user_id == user_id,
                DailyTask.is_completed.is_(True),
                DailyTask.assigned_date >= window_start,
                DailyTask.assigned_date <= today,
            )
            .group_by(DailyTask.assigned_date)
        )
    ).all()

    count_by_date: dict[date, int] = {row.assigned_date: row.cnt for row in task_rows}

    weeks = []
    for week_idx in range(12):
        week_start = window_start + timedelta(weeks=week_idx)
        week_end = week_start + timedelta(days=6)
        week_tasks = sum(
            count_by_date.get(week_start + timedelta(days=d), 0)
            for d in range(7)
        )
        iso_year, iso_week, _ = week_start.isocalendar()
        weeks.append({
            "week_start": week_start.isoformat(),
            "tasks_completed": week_tasks,
            "week_number": iso_week,
        })

    # Trend: compare last 4 weeks vs previous 4 weeks
    recent_4 = sum(w["tasks_completed"] for w in weeks[8:])
    prev_4 = sum(w["tasks_completed"] for w in weeks[4:8])

    if prev_4 == 0 and recent_4 == 0:
        trend = "stable"
    elif prev_4 == 0:
        trend = "improving"
    elif recent_4 > prev_4 * 1.05:
        trend = "improving"
    elif recent_4 < prev_4 * 0.95:
        trend = "declining"
    else:
        trend = "stable"

    return VelocityResponse(weeks=weeks, trend=trend)
