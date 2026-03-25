"""Email service — sends daily digest via Resend, falls back to logging."""

from __future__ import annotations

import asyncio
import html as html_lib
import logging
from dataclasses import dataclass

import resend

from config import settings

logger = logging.getLogger(__name__)

# Configure Resend API key once at module level
if settings.resend_api_key:
    resend.api_key = settings.resend_api_key


@dataclass(frozen=True, slots=True)
class TaskDigestItem:
    description: str
    tip: str
    goal_title: str


def _build_digest_html(display_name: str | None, tasks: list[TaskDigestItem]) -> str:
    """Build the HTML body for a daily reminder digest."""
    greeting = html_lib.escape(display_name or "Star Forger")
    task_rows = ""
    for t in tasks:
        desc = html_lib.escape(t.description)
        tip = html_lib.escape(t.tip)
        goal = html_lib.escape(t.goal_title)
        task_rows += (
            "<tr>"
            f'<td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;">{desc}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#94a3b8;font-style:italic;">{tip}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #2a2a3a;color:#a78bfa;">{goal}</td>'
            "</tr>"
        )

    return f"""\
<div style="background:#0f0f1a;color:#e2e8f0;font-family:'Plus Jakarta Sans',sans-serif;padding:32px;max-width:600px;margin:0 auto;">
  <h1 style="font-size:22px;margin:0 0 4px;">Keep your star glowing, {greeting}!</h1>
  <p style="color:#94a3b8;margin:0 0 24px;">You have {len(tasks)} pending task{"s" if len(tasks) != 1 else ""} today.</p>

  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead>
      <tr style="text-align:left;">
        <th style="padding:8px 12px;border-bottom:2px solid #a78bfa;color:#a78bfa;">Task</th>
        <th style="padding:8px 12px;border-bottom:2px solid #a78bfa;color:#a78bfa;">Tip</th>
        <th style="padding:8px 12px;border-bottom:2px solid #a78bfa;color:#a78bfa;">Goal</th>
      </tr>
    </thead>
    <tbody>
      {task_rows}
    </tbody>
  </table>

  <a href="https://goalforge.app/dashboard?energy=low"
     style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6366f1);
            color:#fff;font-weight:600;font-size:14px;padding:12px 24px;
            border-radius:8px;text-decoration:none;margin-top:20px;">
    Low energy today? Simplify everything &rarr;
  </a>

  <p style="margin:24px 0 0;font-size:13px;color:#64748b;">
    Every task you complete earns +10 ⭐ — keep the momentum going!
  </p>
</div>"""


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

    html = _build_digest_html(display_name, tasks)
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
                "html": html,
            },
        )
        logger.info("Reminder digest sent to=%s tasks=%d", recipient, count)
    except Exception:
        logger.exception("Failed to send reminder digest to=%s", email)


def _build_rescue_html(display_name: str | None) -> str:
    """Build the HTML body for a rescue email."""
    greeting = html_lib.escape(display_name or "Star Forger")
    app_url = "https://goalforge.app/dashboard"
    return f"""\
<div style="background:#0f0f1a;color:#e2e8f0;font-family:'Plus Jakarta Sans',sans-serif;padding:32px;max-width:600px;margin:0 auto;">
  <h1 style="font-size:22px;margin:0 0 8px;">Let's make today easy, {greeting}.</h1>
  <p style="color:#94a3b8;margin:0 0 24px;line-height:1.6;">
    It looks like you've been busy. We went ahead and paused your schedule, and set up two quick 2-minute tasks for you whenever you're ready.
    No pressure, no catching up. Just open the app when you feel like it.
  </p>
  <a href="{app_url}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6366f1);color:#fff;font-weight:600;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none;">
    Open Easy Mode &rarr;
  </a>
  <p style="margin:24px 0 0;font-size:12px;color:#475569;">
    No catch-up required &mdash; just one small step.
  </p>
</div>"""


async def send_rescue_email(email: str, display_name: str | None) -> None:
    """Send a rescue (Easy Mode) email to a user who has been inactive 48h+.

    Falls back to logging when RESEND_API_KEY is not configured.
    Never raises — logs errors and returns on failure.
    """
    if not settings.resend_api_key:
        logger.info("Rescue email (mock) to=%s", email)
        return

    html = _build_rescue_html(display_name)
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
                "subject": "Let's make today easy.",
                "html": html,
            },
        )
        logger.info("Rescue email sent to=%s", recipient)
    except Exception:
        logger.exception("Failed to send rescue email to=%s", email)
