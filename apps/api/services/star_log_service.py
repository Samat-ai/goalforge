"""Star log generation and caching service."""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai_utils import generate_star_log_narrative
from exceptions import AIGenerationError
from models import DailyTask, Goal, StarLog
from utils import user_today


async def get_or_create_star_log(
    user_id: str,
    timezone: str,
    db: AsyncSession,
    days: int = 7,
) -> StarLog:
    """Return cached star log or generate a new one via Gemini.

    Persists the result to the star_logs table for future cache hits.
    """
    end_date = user_today(timezone)
    start_date = end_date - timedelta(days=days - 1)

    # --- Cache check ---
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

    # --- No completed tasks: deterministic fallback ---
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
