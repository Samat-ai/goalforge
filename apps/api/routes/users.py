"""User profile, settings, and data control routes."""

import csv
import io
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ai_utils import generate_star_log_narrative, generate_weekly_coach_recommendation
from auth import get_current_user_email, get_current_user_id
from database import get_db
from deps import _ensure_owner, _load_user_with_ownership, get_or_create_user as _get_or_create_user
from exceptions import AIGenerationError
from models import (
    DailyTask, Goal, Reward, ShopReward, StarLog, User,
    WebPushSubscription, WeeklyReflection,
)
from rate_limiting import rate_limit, _user_key
from schemas import (
    BadgeResponse,
    StarLogResponse,
    UserProfileResponse,
    UserSettingsUpdate,
    WeeklyReflectionCreate,
    WeeklyReflectionResponse,
    WeeklyReviewResponse,
)
from utils import user_today

router = APIRouter()



@router.get(
    "/users/{user_id}/profile",
    summary="Get user profile (star_points etc.)",
)
async def get_user_profile(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    current_user_email: str = Depends(get_current_user_email),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)
    user = await _get_or_create_user(user_id, current_user_email, db)
    return {"star_points": user.star_points}


@router.get(
    "/users/{user_id}/settings",
    response_model=UserProfileResponse,
    summary="Get user settings (timezone, display_name)",
)
async def get_user_settings(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    current_user_email: str = Depends(get_current_user_email),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)
    user = await _get_or_create_user(user_id, current_user_email, db)
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
    user = await _load_user_with_ownership(user_id, current_user_id, db)
    if payload.timezone is not None:
        user.timezone = payload.timezone
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.reminder_enabled is not None:
        user.reminder_enabled = payload.reminder_enabled
    if payload.reminder_hour is not None:
        user.reminder_hour = payload.reminder_hour
    await db.commit()
    await db.refresh(user)
    return user


@router.post(
    "/users/{user_id}/weekly-reflection",
    response_model=WeeklyReflectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit weekly reflection and get AI coaching recommendation",
)
@rate_limit("3/day", key_func=_user_key)
async def create_weekly_reflection(
    request: Request,
    user_id: str,
    payload: WeeklyReflectionCreate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    end_date = user_today(user.timezone)
    start_date = end_date - timedelta(days=6)
    rows = (
        await db.execute(
            select(DailyTask.assigned_date, DailyTask.is_completed)
            .join(Goal, DailyTask.goal_id == Goal.id)
            .where(
                Goal.user_id == user_id,
                DailyTask.assigned_date >= start_date,
                DailyTask.assigned_date <= end_date,
            )
        )
    ).all()
    total = len(rows)
    completed = sum(1 for row in rows if row.is_completed)
    completion_rate = (completed / total) if total else 0.0
    overdue = sum(1 for row in rows if (not row.is_completed) and row.assigned_date < end_date)

    try:
        recommendation = await generate_weekly_coach_recommendation(
            payload.went_well,
            payload.blockers,
            payload.week_rating,
            completion_rate,
            overdue,
        )
    except AIGenerationError:
        if completion_rate < 0.5:
            recommendation = "Pick one 10-minute anchor task for the same time each day this week, and complete it before anything else."
        else:
            recommendation = "Keep your strongest routine block and remove one recurring blocker by pre-planning tomorrow's first task tonight."

    reflection = WeeklyReflection(
        user_id=user_id,
        went_well=payload.went_well,
        blockers=payload.blockers,
        week_rating=payload.week_rating,
        coach_recommendation=recommendation,
    )
    db.add(reflection)
    await db.flush()
    await db.refresh(reflection)
    return reflection


@router.get(
    "/users/{user_id}/weekly-reflection/latest",
    response_model=WeeklyReflectionResponse,
    summary="Get latest weekly reflection",
)
async def get_latest_weekly_reflection(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)

    reflection = (
        await db.execute(
            select(WeeklyReflection)
            .where(WeeklyReflection.user_id == user_id)
            .order_by(WeeklyReflection.created_at.desc())
        )
    ).scalars().first()

    if reflection is None:
        raise HTTPException(status_code=404, detail="No weekly reflection found")
    return reflection


@router.get(
    "/users/{user_id}/weekly-review",
    response_model=WeeklyReviewResponse,
    summary="Get weekly review metrics and recommendation",
)
async def get_weekly_review(
    user_id: str,
    days: int = Query(7, ge=3, le=14),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    end_date = user_today(user.timezone)
    start_date = end_date - timedelta(days=days - 1)

    tasks_result = await db.execute(
        select(DailyTask.assigned_date, DailyTask.is_completed)
        .join(Goal, DailyTask.goal_id == Goal.id)
        .where(
            Goal.user_id == user_id,
            DailyTask.assigned_date >= start_date,
            DailyTask.assigned_date <= end_date,
        )
    )
    rows = tasks_result.all()

    total_tasks = len(rows)
    completed_tasks = sum(1 for row in rows if row.is_completed)
    completed_days = len({row.assigned_date for row in rows if row.is_completed})
    overdue_tasks = sum(1 for row in rows if (not row.is_completed) and row.assigned_date < end_date)
    completion_rate = (completed_tasks / total_tasks) if total_tasks > 0 else 0.0

    if total_tasks == 0:
        risk_level = "medium"
        recommendation = "Start with one tiny task today to kick off a fresh weekly arc."
    elif completion_rate >= 0.8 and overdue_tasks == 0:
        risk_level = "low"
        recommendation = "Great consistency this week. Keep difficulty balanced and protect your routine."
    elif completion_rate >= 0.5:
        risk_level = "medium"
        recommendation = "Solid momentum. Clear one overdue task first, then lock in one focus task for today."
    else:
        risk_level = "high"
        recommendation = "Shrink today to one 2-minute action and rebuild confidence with a guaranteed win."

    return WeeklyReviewResponse(
        start_date=start_date,
        end_date=end_date,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        completion_rate=round(completion_rate, 4),
        completed_days=completed_days,
        overdue_tasks=overdue_tasks,
        risk_level=risk_level,
        recommendation=recommendation,
    )


@router.get(
    "/users/{user_id}/star-log",
    response_model=StarLogResponse,
    summary="Get narrative Star Log chapter (lazy compute & cache)",
)
@rate_limit("10/hour", key_func=_user_key)
async def get_star_log(
    request: Request,
    user_id: str,
    days: int = Query(7, ge=3, le=14),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    end_date = user_today(user.timezone)
    start_date = end_date - timedelta(days=days - 1)

    # --- Lazy cache: return existing star log if one exists for this period ---
    existing = (
        await db.execute(
            select(StarLog).where(
                StarLog.user_id == user_id,
                StarLog.start_date == start_date,
                StarLog.end_date == end_date,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    # --- Compute metrics ---
    rows = (
        await db.execute(
            select(DailyTask.description, DailyTask.assigned_date)
            .join(Goal, DailyTask.goal_id == Goal.id)
            .where(
                Goal.user_id == user_id,
                DailyTask.is_completed.is_(True),
                DailyTask.assigned_date >= start_date,
                DailyTask.assigned_date <= end_date,
            )
            .order_by(DailyTask.assigned_date.asc())
        )
    ).all()
    completed_tasks = len(rows)
    completed_days = len({row.assigned_date for row in rows})

    # --- No completed tasks: deterministic fallback, no AI call ---
    if completed_tasks == 0:
        star_log = StarLog(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            completed_tasks=0,
            completed_days=0,
            chapter_title="Quiet Orbit",
            chapter_body=(
                "This chapter stayed calm, but your journey is still active. "
                "Pick one tiny action today to relight momentum."
            ),
            highlights=["No completed tasks in this window", "Next step: complete one 2-minute action today"],
            is_fallback=True,
        )
        db.add(star_log)
        await db.flush()
        await db.refresh(star_log)
        return star_log

    # --- Generate via Gemini, fallback on failure ---
    task_snippets = [row.description for row in rows]
    try:
        narrative = await generate_star_log_narrative(
            start_date=start_date,
            end_date=end_date,
            completed_tasks=completed_tasks,
            completed_days=completed_days,
            task_snippets=task_snippets,
        )
        star_log = StarLog(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            completed_tasks=completed_tasks,
            completed_days=completed_days,
            chapter_title=narrative.chapter_title,
            chapter_body=narrative.chapter_body,
            highlights=narrative.highlights,
            is_fallback=False,
        )
    except AIGenerationError:
        star_log = StarLog(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            completed_tasks=completed_tasks,
            completed_days=completed_days,
            chapter_title="Momentum Recorded",
            chapter_body=(
                f"You completed {completed_tasks} tasks across {completed_days} days this week. "
                "Your consistency is real progress, and your next small action keeps that arc moving."
            ),
            highlights=task_snippets[:3],
            is_fallback=True,
        )

    db.add(star_log)
    await db.flush()
    await db.refresh(star_log)
    return star_log


# ---------------------------------------------------------------------------
# Achievement badges (computed, stateless)
# ---------------------------------------------------------------------------


@router.get(
    "/users/{user_id}/badges",
    response_model=list[BadgeResponse],
    summary="Get achievement badge progress",
)
@rate_limit("10/minute", key_func=_user_key)
async def get_user_badges(
    request: Request,
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Optimised SQL aggregations — no ORM hydration
    completed_tasks = (
        await db.execute(
            select(func.count())
            .select_from(DailyTask)
            .join(Goal, DailyTask.goal_id == Goal.id)
            .where(Goal.user_id == user_id, DailyTask.is_completed.is_(True))
        )
    ).scalar() or 0

    achieved_goals = (
        await db.execute(
            select(func.count())
            .select_from(Goal)
            .where(Goal.user_id == user_id, Goal.status == "achieved")
        )
    ).scalar() or 0

    # Streak anchored to user's local date
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
            .order_by(DailyTask.assigned_date.desc())
        )
    ).scalars().all()

    streak = 0
    cursor = today
    for d in completed_dates:
        if d == cursor:
            streak += 1
            cursor -= timedelta(days=1)
        else:
            break

    return [
        BadgeResponse(
            key="first_light",
            title="First Light",
            description="Complete your first task.",
            unlocked=completed_tasks >= 1,
            current=min(completed_tasks, 1),
            target=1,
        ),
        BadgeResponse(
            key="streak_spark",
            title="Streak Spark",
            description="Maintain a 3-day streak.",
            unlocked=streak >= 3,
            current=min(streak, 3),
            target=3,
        ),
        BadgeResponse(
            key="goal_master",
            title="Goal Master",
            description="Achieve your first full goal.",
            unlocked=achieved_goals >= 1,
            current=min(achieved_goals, 1),
            target=1,
        ),
        BadgeResponse(
            key="consistency_forge",
            title="Consistency Forge",
            description="Complete 20 tasks.",
            unlocked=completed_tasks >= 20,
            current=min(completed_tasks, 20),
            target=20,
        ),
    ]


# ---------------------------------------------------------------------------
# Data export & deletion
# ---------------------------------------------------------------------------


@router.get(
    "/users/{user_id}/export",
    summary="Export user data as JSON or CSV",
)
@rate_limit("3/hour", key_func=_user_key)
async def export_user_data(
    request: Request,
    user_id: str,
    format: str = Query("json", pattern="^(json|csv)$"),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await _load_user_with_ownership(user_id, current_user_id, db)

    goals_result = await db.execute(
        select(Goal)
        .options(selectinload(Goal.milestones), selectinload(Goal.daily_tasks))
        .where(Goal.user_id == user_id)
        .order_by(Goal.created_at.asc())
    )
    goals = goals_result.scalars().all()

    rewards_result = await db.execute(
        select(Reward).where(Reward.user_id == user_id).order_by(Reward.acquired_at.asc())
    )
    rewards = rewards_result.scalars().all()

    star_logs_result = await db.execute(
        select(StarLog).where(StarLog.user_id == user_id).order_by(StarLog.start_date.asc())
    )
    star_logs = star_logs_result.scalars().all()

    reflections_result = await db.execute(
        select(WeeklyReflection).where(WeeklyReflection.user_id == user_id)
        .order_by(WeeklyReflection.created_at.asc())
    )
    reflections = reflections_result.scalars().all()

    shop_rewards_result = await db.execute(
        select(ShopReward).where(ShopReward.user_id == user_id)
        .order_by(ShopReward.created_at.asc())
    )
    shop_rewards = shop_rewards_result.scalars().all()

    push_subs_result = await db.execute(
        select(WebPushSubscription).where(WebPushSubscription.user_id == user_id)
        .order_by(WebPushSubscription.created_at.asc())
    )
    push_subs = push_subs_result.scalars().all()

    exported_at = datetime.now(timezone.utc).isoformat()

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["section", "key", "value"])
        writer.writerow(["user", "id", user.id])
        writer.writerow(["user", "email", user.email])
        writer.writerow(["user", "star_points", user.star_points])
        writer.writerow(["user", "timezone", user.timezone])
        writer.writerow(["user", "display_name", user.display_name or ""])

        writer.writerow([])
        writer.writerow(["goals", "goal_id", "title", "status", "progress", "target_date", "created_at"])
        for g in goals:
            writer.writerow(["goals", str(g.id), g.smart_title, g.status, g.progress,
                             g.target_date.isoformat(), g.created_at.isoformat()])

        writer.writerow([])
        writer.writerow(["daily_tasks", "task_id", "goal_id", "description", "assigned_date",
                         "is_completed", "is_rescue_task"])
        for g in goals:
            for t in g.daily_tasks:
                writer.writerow(["daily_tasks", str(t.id), str(g.id), t.description,
                                 t.assigned_date.isoformat(), t.is_completed, t.is_rescue_task])

        writer.writerow([])
        writer.writerow(["rewards", "reward_id", "reward_type", "reward_key", "is_equipped", "acquired_at"])
        for r in rewards:
            writer.writerow(["rewards", str(r.id), r.reward_type, r.reward_key,
                             r.is_equipped, r.acquired_at.isoformat()])

        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="goalforge-export.csv"'},
        )

    # JSON format
    return {
        "exported_at": exported_at,
        "user": {
            "id": user.id,
            "email": user.email,
            "star_points": user.star_points,
            "timezone": user.timezone,
            "display_name": user.display_name,
            "created_at": user.created_at.isoformat(),
        },
        "goals": [
            {
                "id": str(g.id),
                "raw_input": g.raw_input,
                "smart_title": g.smart_title,
                "smart_description": g.smart_description,
                "goal_type": g.goal_type,
                "target_date": g.target_date.isoformat(),
                "status": g.status,
                "progress": g.progress,
                "created_at": g.created_at.isoformat(),
                "milestones": [
                    {
                        "id": str(ms.id),
                        "title": ms.title,
                        "position": ms.position,
                        "is_final": ms.is_final,
                        "sprint_theme": ms.sprint_theme,
                        "sprint_status": ms.sprint_status,
                        "is_completed": ms.is_completed,
                        "completed_at": ms.completed_at.isoformat() if ms.completed_at else None,
                    }
                    for ms in g.milestones
                ],
                "daily_tasks": [
                    {
                        "id": str(t.id),
                        "description": t.description,
                        "tip": t.tip,
                        "assigned_date": t.assigned_date.isoformat(),
                        "position": t.position,
                        "is_completed": t.is_completed,
                        "is_rescue_task": t.is_rescue_task,
                        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                    }
                    for t in g.daily_tasks
                ],
            }
            for g in goals
        ],
        "rewards": [
            {
                "id": str(r.id),
                "reward_type": r.reward_type,
                "reward_key": r.reward_key,
                "is_equipped": r.is_equipped,
                "acquired_at": r.acquired_at.isoformat(),
            }
            for r in rewards
        ],
        "star_logs": [
            {
                "id": str(sl.id),
                "start_date": sl.start_date.isoformat(),
                "end_date": sl.end_date.isoformat(),
                "completed_tasks": sl.completed_tasks,
                "completed_days": sl.completed_days,
                "chapter_title": sl.chapter_title,
                "is_fallback": sl.is_fallback,
                "created_at": sl.created_at.isoformat(),
            }
            for sl in star_logs
        ],
        "weekly_reflections": [
            {
                "id": str(ref.id),
                "went_well": ref.went_well,
                "blockers": ref.blockers,
                "week_rating": ref.week_rating,
                "coach_recommendation": ref.coach_recommendation,
                "created_at": ref.created_at.isoformat(),
            }
            for ref in reflections
        ],
        "shop_rewards": [
            {
                "id": str(sr.id),
                "title": sr.title,
                "cost": sr.cost,
                "is_active": sr.is_active,
                "redemption_count": sr.redemption_count,
                "created_at": sr.created_at.isoformat(),
            }
            for sr in shop_rewards
        ],
        "push_subscriptions": [
            {
                "id": str(ps.id),
                "endpoint": ps.endpoint,
                "is_active": ps.is_active,
                "created_at": ps.created_at.isoformat(),
            }
            for ps in push_subs
        ],
    }


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete user account data (goals, tasks, milestones, rewards, etc.)",
)
@rate_limit("1/hour", key_func=_user_key)
async def delete_user_data(
    request: Request,
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await _load_user_with_ownership(user_id, current_user_id, db)
    await db.delete(user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
