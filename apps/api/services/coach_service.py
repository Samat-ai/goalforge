"""Coach v2 service: user-context assembly, validated plan edits, goal forging,
canned in-character lines, and the daily message cap counter.

The responder model only PROPOSES actions; every function here treats model
output as untrusted input and validates ownership server-side.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai_utils import generate_smart_goal
from models import CoachMessage, CoachSession, DailyTask, Goal, Milestone, User
from schemas import AIPlanEdit
from utils import user_today

logger = logging.getLogger(__name__)

GREETING = (
    "I'm Solly. Tell me what you're reaching for and I'll help you forge it "
    "into a real plan. You can also ask me about the goals you already have."
)

DEFLECTIONS = [
    "That's outside what I forge. Goals are my whole sky. Got one for me?",
    "I can't help with that one. Bring me a goal, a stuck habit, or a plan that needs heat.",
    "Not my orbit. I work on your goals. Want to point me at one?",
]

SUPPORT_MESSAGE = (
    "That sounds heavy, and I'm glad you said it. I'm a goal coach, so I'm the "
    "wrong star for this one. Please reach out to someone you trust or a "
    "professional near you. When you want to work on a small, kind goal "
    "together, I'm right here."
)

CAP_MESSAGE = (
    "My forge needs to cool until tomorrow. We covered real ground today. "
    "Come back and we'll pick it up."
)

FORGE_FAILURE_MESSAGE = (
    "The forge sputtered while shaping your plan. Tell me to try again and "
    "I'll take another pass."
)

EDIT_DROPPED_SUFFIX = " (Some of that I couldn't touch: completed tasks and other people's plans are locked.)"

# Server-side caps per edit target — the model's max_length is not trusted.
_EDIT_CAPS = {
    "task_description": 300,
    "task_tip": 300,
    "milestone_theme": 300,
    "goal_title": 200,
    "goal_description": 500,
}


async def count_user_messages_today(user_id: str, tz_name: str, db: AsyncSession) -> int:
    """Count today's user-authored coach messages across all sessions.

    'Today' is the user's local calendar date. Rows are pre-filtered to the
    last 48h in SQL, then bucketed exactly in Python (cross-dialect safe:
    SQLite returns naive datetimes, Postgres returns aware — same
    normalization goals.py uses for generation_started_at).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=2)
    rows = (
        await db.execute(
            select(CoachMessage.created_at)
            .join(CoachSession, CoachSession.id == CoachMessage.session_id)
            .where(
                CoachSession.user_id == user_id,
                CoachMessage.role == "user",
                CoachMessage.created_at >= cutoff,
            )
        )
    ).all()
    today_local = user_today(tz_name)
    from zoneinfo import ZoneInfo
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = timezone.utc
    count = 0
    for (ts,) in rows:
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts.astimezone(tz).date() == today_local:
            count += 1
    return count


async def build_user_context(user_id: str, session: CoachSession, db: AsyncSession) -> str:
    """Compact text block: date, stars, session title state, active goals with
    ids + current-sprint tasks (ids/dates/status) + 14-day completion counts."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    tz_name = user.timezone if user else "UTC"
    today = user_today(tz_name)
    star_points = user.star_points if user else 0

    lines = [
        f"Today: {today.isoformat()} (user timezone: {tz_name})",
        f"Star points: {star_points}",
        f"Session: {'untitled' if session.title is None else f'titled \"{session.title}\"'}",
    ]

    goals = (
        await db.execute(
            select(Goal).where(Goal.user_id == user_id, Goal.status == "active")
            .order_by(Goal.created_at.desc()).limit(5)
        )
    ).scalars().all()

    if not goals:
        lines.append("Active goals: none")
        return "\n".join(lines)

    lines.append("Active goals:")
    window_start = today - timedelta(days=13)
    for goal in goals:
        lines.append(
            f'- Goal {goal.id}: "{goal.smart_title}" [{goal.goal_type}] target {goal.target_date.isoformat()}'
        )
        active_ms = (
            await db.execute(
                select(Milestone)
                .where(Milestone.goal_id == goal.id, Milestone.sprint_status == "active")
                .order_by(Milestone.position).limit(1)
            )
        ).scalar_one_or_none()
        if active_ms is not None:
            lines.append(
                f'  milestone {active_ms.id}: "{active_ms.title}" theme "{active_ms.sprint_theme}"'
            )
        tasks = (
            await db.execute(
                select(DailyTask)
                .where(DailyTask.goal_id == goal.id)
                .order_by(DailyTask.assigned_date.desc()).limit(14)
            )
        ).scalars().all()
        recent = [t for t in tasks if t.assigned_date >= window_start]
        done = sum(1 for t in recent if t.is_completed)
        lines.append(f"  14-day completion: {done}/{len(recent)} tasks")
        current = active_ms.id if active_ms else None
        sprint_tasks = sorted(
            (t for t in tasks if current is None or t.milestone_id == current),
            key=lambda t: t.assigned_date,
        )
        if sprint_tasks:
            lines.append("  current sprint tasks:")
            for t in sprint_tasks:
                status = "done" if t.is_completed else "pending"
                lines.append(f'  * {t.id} {t.assigned_date.isoformat()} [{status}] "{t.description}"')
    return "\n".join(lines)


async def apply_plan_edits(
    edits: list[AIPlanEdit], user_id: str, db: AsyncSession
) -> tuple[int, int]:
    """Apply model-proposed edits with server-side validation. Returns (applied, dropped)."""
    applied = 0
    dropped = 0
    for edit in edits:
        new_value = edit.new_value.strip()
        cap = _EDIT_CAPS[edit.target]
        try:
            target_id = uuid.UUID(edit.target_id)
        except (ValueError, AttributeError):
            logger.warning("coach edit dropped: bad id %r (user %s)", edit.target_id, user_id)
            dropped += 1
            continue
        if not new_value or len(new_value) > cap:
            logger.warning("coach edit dropped: length %d > %d (user %s)", len(new_value), cap, user_id)
            dropped += 1
            continue

        if edit.target in ("task_description", "task_tip"):
            row = (
                await db.execute(
                    select(DailyTask, Goal)
                    .join(Goal, Goal.id == DailyTask.goal_id)
                    .where(DailyTask.id == target_id)
                )
            ).first()
            if row is None or row[1].user_id != user_id or row[0].is_completed:
                logger.warning("coach edit dropped: task %s invalid for user %s", target_id, user_id)
                dropped += 1
                continue
            task = row[0]
            if edit.target == "task_description":
                task.description = new_value
            else:
                task.tip = new_value
            applied += 1
        elif edit.target == "milestone_theme":
            row = (
                await db.execute(
                    select(Milestone, Goal)
                    .join(Goal, Goal.id == Milestone.goal_id)
                    .where(Milestone.id == target_id)
                )
            ).first()
            if row is None or row[1].user_id != user_id:
                logger.warning("coach edit dropped: milestone %s invalid for user %s", target_id, user_id)
                dropped += 1
                continue
            row[0].sprint_theme = new_value
            applied += 1
        else:  # goal_title | goal_description
            goal = (
                await db.execute(select(Goal).where(Goal.id == target_id))
            ).scalar_one_or_none()
            if goal is None or goal.user_id != user_id:
                logger.warning("coach edit dropped: goal %s invalid for user %s", target_id, user_id)
                dropped += 1
                continue
            if edit.target == "goal_title":
                goal.smart_title = new_value
            else:
                goal.smart_description = new_value
            applied += 1
    return applied, dropped


async def forge_goal_from_brief(brief: str, user_id: str, db: AsyncSession) -> Goal:
    """Forge a goal from the responder's distilled brief via the untouched
    generate_smart_goal specialist. Synchronous (no background task) — the
    coach turn waits for it, same as the old intake forge. Flushes; caller
    commits via get_db."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    today = user_today(user.timezone if user else "UTC")
    ai_goal = await generate_smart_goal(brief, today=today)

    goal = Goal(
        id=uuid.uuid4(),
        user_id=user_id,
        raw_input=brief,
        smart_title=ai_goal.smart_title,
        smart_description=ai_goal.smart_description,
        goal_type=ai_goal.goal_type,
        target_date=ai_goal.target_date,
        status="active",
        progress=0,
    )
    db.add(goal)
    await db.flush()

    milestone_rows: list[Milestone] = []
    for i, ms in enumerate(ai_goal.milestones):
        row = Milestone(
            id=uuid.uuid4(),
            goal_id=goal.id,
            title=ms.title,
            position=i + 1,
            is_final=ms.is_final,
            sprint_theme=ms.sprint_theme,
            sprint_status="active" if i == 0 else "pending",
        )
        db.add(row)
        milestone_rows.append(row)
    await db.flush()

    first_milestone = milestone_rows[0]
    for task in ai_goal.initial_tasks:
        db.add(DailyTask(
            id=uuid.uuid4(),
            goal_id=goal.id,
            milestone_id=first_milestone.id,
            description=task.description,
            tip=task.tip,
            assigned_date=task.assigned_date,
        ))
    await db.flush()
    return goal
