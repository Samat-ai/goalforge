"""Background job trigger routes."""

import secrets
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from config import settings
from database import get_db
from models import Goal, NotificationLog, User, WebPushSubscription
from services.email_service import TaskDigestItem, send_reminder_digest, send_rescue_email
from services.push_service import send_push_digest
from services.rescue_service import goal_is_rescue_mode
from services.star_log_service import get_or_create_star_log
from utils import user_now, user_today

router = APIRouter()


def _verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Require X-Api-Key header. Always enforced — no dev bypass."""
    api_key = settings.jobs_api_key
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jobs API key is not configured on this server",
        )
    if x_api_key is None or not secrets.compare_digest(x_api_key, api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )


async def _already_notified(
    db: AsyncSession,
    user_id: str,
    notif_type: str,
    sent_date: date,
) -> bool:
    """Return True if a notification of this type was already sent to this user today (local date)."""
    result = await db.execute(
        select(NotificationLog.id).where(
            NotificationLog.user_id == user_id,
            NotificationLog.type == notif_type,
            NotificationLog.sent_date == sent_date,
        )
    )
    return result.scalar_one_or_none() is not None


@router.post(
    "/trigger-reminders",
    summary="Send daily reminder digest or rescue email per user",
    dependencies=[Depends(_verify_api_key)],
)
async def trigger_reminders(db: AsyncSession = Depends(get_db)) -> dict:
    # Load users with active goals, eagerly loading milestones + tasks for rescue detection
    result = await db.execute(
        select(User)
        .join(Goal, Goal.user_id == User.id)
        .where(Goal.status == "active")
        .options(
            selectinload(User.goals).selectinload(Goal.milestones),
            selectinload(User.goals).selectinload(Goal.daily_tasks),
        )
        .distinct()
    )
    users = result.scalars().all()

    rescue_count = 0
    digest_count = 0
    push_count = 0
    streak_saver_count = 0
    inactivity_count = 0
    star_log_count = 0

    for user in users:
        active_goals = [g for g in user.goals if g.status == "active"]
        in_rescue = any(goal_is_rescue_mode(g) for g in active_goals)

        # ── Rescue (existing, unchanged) ───────────────────────────────────
        if in_rescue:
            await send_rescue_email(user.email, user.display_name)
            rescue_count += 1
            continue

        # ── Consent gate ───────────────────────────────────────────────────
        if not user.reminder_enabled:
            continue

        now_utc = datetime.now(timezone.utc)
        today_local = user_today(user.timezone)
        yesterday_local = today_local - timedelta(days=1)
        now_local = user_now(user.timezone)

        # Derive engagement signals from already-loaded task data — no extra queries
        all_tasks = [t for g in active_goals for t in g.daily_tasks]
        completed_today = any(
            t.assigned_date == today_local and t.is_completed for t in all_tasks
        )
        completed_yesterday = any(
            t.assigned_date == yesterday_local and t.is_completed for t in all_tasks
        )
        last_completion_at = max(
            (t.completed_at for t in all_tasks if t.completed_at is not None),
            default=None,
        )
        # Normalize naive datetimes from SQLite (PostgreSQL always returns tz-aware)
        if last_completion_at is not None and last_completion_at.tzinfo is None:
            last_completion_at = last_completion_at.replace(tzinfo=timezone.utc)

        # Load push subscriptions once per user (shared by all push branches)
        push_subs = (
            await db.execute(
                select(WebPushSubscription).where(
                    WebPushSubscription.user_id == user.id,
                    WebPushSubscription.is_active == True,  # noqa: E712
                )
            )
        ).scalars().all()

        # ── Streak-Saver ───────────────────────────────────────────────────
        if (
            completed_yesterday
            and not completed_today
            and now_local.hour >= 18
            and push_subs
            and not await _already_notified(db, user.id, "streak_saver", today_local)
        ):
            for sub in push_subs:
                await send_push_digest(
                    sub,
                    title="Your streak is at risk 🔥",
                    body="You haven't completed a task today — keep your streak alive before midnight",
                    db=db,
                )
            db.add(NotificationLog(user_id=user.id, type="streak_saver", sent_date=today_local))
            streak_saver_count += 1
            continue  # overrides regular digest for today

        # ── Inactivity Nudge ───────────────────────────────────────────────
        cutoff_24h = now_utc - timedelta(hours=24)
        cutoff_48h = now_utc - timedelta(hours=48)

        if (
            last_completion_at is not None
            and cutoff_48h <= last_completion_at < cutoff_24h
            and push_subs
            and not await _already_notified(db, user.id, "inactivity_nudge", today_local)
        ):
            for sub in push_subs:
                await send_push_digest(
                    sub,
                    title="Your Companion misses you ✨",
                    body="It's been a while. Come back for just one small win today.",
                    db=db,
                )
            db.add(NotificationLog(user_id=user.id, type="inactivity_nudge", sent_date=today_local))
            inactivity_count += 1
            continue  # skip regular digest for disengaged users

        # ── Sunday Star Log ───────────────────────────────────────────────
        if (
            today_local.weekday() == 6
            and now_local.hour == user.reminder_hour
            and push_subs
            and not await _already_notified(db, user.id, "weekly_star_log", today_local)
        ):
            star_log = await get_or_create_star_log(
                user_id=user.id,
                timezone=user.timezone,
                db=db,
            )
            highlight = star_log.highlights[0] if star_log.highlights else "Your week awaits"
            body = f"{star_log.chapter_title} — {highlight}. Tap to read your Companion's journey."
            if len(body) > 150:
                body = body[:147] + "..."
            for sub in push_subs:
                await send_push_digest(
                    sub,
                    title="Your new Star Log is ready ✨",
                    body=body,
                    db=db,
                    url="/stars",
                )
            db.add(NotificationLog(user_id=user.id, type="weekly_star_log", sent_date=today_local))
            star_log_count += 1
            continue  # Sunday star log replaces daily digest

        # ── Regular digest (existing) ──────────────────────────────────────
        if now_local.hour != user.reminder_hour:
            continue

        tasks = [
            TaskDigestItem(
                description=t.description,
                tip=t.tip,
                goal_title=next(
                    (g.smart_title for g in active_goals if g.id == t.goal_id),
                    "Your Goal",
                ),
            )
            for g in active_goals
            for t in g.daily_tasks
            if t.assigned_date == today_local and not t.is_completed
        ]
        if tasks:
            await send_reminder_digest(user.email, user.display_name, tasks)
            digest_count += 1

            for sub in push_subs:
                await send_push_digest(
                    sub,
                    title="GoalForge reminder",
                    body=f"You have {len(tasks)} pending task{'s' if len(tasks) != 1 else ''} today.",
                    db=db,
                )
                push_count += 1

    return {
        "rescue_emails": rescue_count,
        "digest_emails": digest_count,
        "push_notifications": push_count,
        "streak_saver_pushes": streak_saver_count,
        "inactivity_nudges": inactivity_count,
        "star_log_pushes": star_log_count,
    }
