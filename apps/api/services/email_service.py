"""Email service — sends daily digest via Resend, falls back to logging."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

import resend

from config import settings
from services.email_renderer import render_daily_digest, render_rescue_email, render_weekly_star_log

logger = logging.getLogger(__name__)

# Configure Resend API key once at module level
if settings.resend_api_key:
    resend.api_key = settings.resend_api_key


@dataclass(frozen=True, slots=True)
class TaskDigestItem:
    description: str
    tip: str
    goal_title: str


async def send_reminder_digest(
    email: str,
    display_name: str | None,
    tasks: list[TaskDigestItem],
) -> None:
    """Send a daily reminder digest to one user.

    Falls back to logging when RESEND_API_KEY is not configured.
    Never raises — logs errors and returns on failure.
    """
    if not tasks:
        return

    task_summaries = [t.description for t in tasks]

    if not settings.resend_api_key:
        logger.info(
            "Reminder digest (mock) to=%s tasks=%r",
            email,
            task_summaries,
        )
        return

    # Group tasks by goal for the template
    goals: dict[str, list[str]] = {}
    for t in tasks:
        goals.setdefault(t.goal_title, []).append(t.description)
    tasks_by_goal = [{"goal_title": g, "tasks": ts} for g, ts in goals.items()]

    name = display_name or "Star Forger"
    html_body, plain_body = render_daily_digest(
        display_name=name,
        tasks_by_goal=tasks_by_goal,
        star_points=0,  # star balance not available at digest send time
    )

    count = len(tasks)
    subject = f"🌟 You have {count} pending task{'s' if count != 1 else ''} today — keep going!"

    recipient = email
    if settings.dev_email_override:
        recipient = settings.dev_email_override
        logger.info("DEV_EMAIL_OVERRIDE active: routing %s → %s", email, recipient)

    try:
        await asyncio.to_thread(
            resend.Emails.send,
            {
                "from": "GoalForge <onboarding@resend.dev>",
                "to": [recipient],
                "subject": subject,
                "html": html_body,
                "text": plain_body,
            },
        )
        logger.info("Reminder digest sent to=%s tasks=%d", recipient, count)
    except Exception:
        logger.exception("Failed to send reminder digest to=%s", email)


async def send_rescue_email(
    email: str,
    display_name: str | None,
    goal_title: str = "",
    rescue_tasks: list[str] | None = None,
) -> None:
    """Send a rescue (Easy Mode) email to a user who has been inactive 48h+.

    Falls back to logging when RESEND_API_KEY is not configured.
    Never raises — logs errors and returns on failure.
    """
    if not settings.resend_api_key:
        logger.info("Rescue email (mock) to=%s", email)
        return

    name = display_name or "Star Forger"
    html_body, plain_body = render_rescue_email(
        display_name=name,
        goal_title=goal_title or "your goal",
        rescue_tasks=rescue_tasks or [],
    )

    recipient = email
    if settings.dev_email_override:
        recipient = settings.dev_email_override
        logger.info("DEV_EMAIL_OVERRIDE active: routing %s → %s", email, recipient)

    try:
        await asyncio.to_thread(
            resend.Emails.send,
            {
                "from": "GoalForge <onboarding@resend.dev>",
                "to": [recipient],
                "subject": "We've prepared a fresh start for you 🔥",
                "html": html_body,
                "text": plain_body,
            },
        )
        logger.info("Rescue email sent to=%s", recipient)
    except Exception:
        logger.exception("Failed to send rescue email to=%s", email)


async def send_weekly_star_log(
    email: str,
    display_name: str | None,
    week_number: int,
    narrative: str,
    stats: dict,
) -> None:
    """Send a weekly star log narrative email.

    Falls back to logging when RESEND_API_KEY is not configured.
    Never raises — logs errors and returns on failure.
    """
    if not settings.resend_api_key:
        logger.info("Weekly star log (mock) to=%s week=%d", email, week_number)
        return

    name = display_name or "Star Forger"
    html_body, plain_body = render_weekly_star_log(
        display_name=name,
        week_number=week_number,
        narrative=narrative,
        stats=stats,
    )

    recipient = email
    if settings.dev_email_override:
        recipient = settings.dev_email_override
        logger.info("DEV_EMAIL_OVERRIDE active: routing %s → %s", email, recipient)

    try:
        await asyncio.to_thread(
            resend.Emails.send,
            {
                "from": "GoalForge <onboarding@resend.dev>",
                "to": [recipient],
                "subject": f"Your Week {week_number} Star Log ⭐",
                "html": html_body,
                "text": plain_body,
            },
        )
        logger.info("Weekly star log sent to=%s week=%d", recipient, week_number)
    except Exception:
        logger.exception("Failed to send weekly star log to=%s", email)
