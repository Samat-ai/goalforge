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

# Sender requires the goalforge.me domain to stay verified in Resend
# (DNS: MX+SPF on send.goalforge.me, DKIM on resend._domainkey).
_FROM = "GoalForge <notifications@goalforge.me>"
_APP_URL = "https://goalforge.me"


@dataclass(frozen=True, slots=True)
class TaskDigestItem:
    description: str
    tip: str
    goal_title: str


# Deep-space palette from the 2026-07 app redesign (src/index.css tokens).
# Voice: Solly the sun mascot, deadpan guilt-trip wrapped in star-forge lore
# (chosen 2026-07-10 over "hype friend" / pure-Duolingo variants).
_FONT = "'Segoe UI',system-ui,-apple-system,Helvetica,Arial,sans-serif"


def _digest_subject(count: int) -> str:
    """Count-aware subject line for the daily digest (no emoji prefix)."""
    if count == 1:
        return "One task stands between you and a brighter star"
    return f"Your star noticed you haven't shown up ({count} tasks waiting)"


def _build_digest_html(display_name: str | None, tasks: list[TaskDigestItem]) -> str:
    """Build the HTML body for a daily reminder digest."""
    greeting = html_lib.escape(display_name or "Star Forger")
    n = len(tasks)
    task_rows = ""
    for t in tasks:
        desc = html_lib.escape(t.description)
        tip = html_lib.escape(t.tip)
        goal = html_lib.escape(t.goal_title)
        task_rows += (
            '<div style="background:#121220;border:1px solid #26263a;border-radius:10px;'
            'padding:12px 16px;margin:0 0 8px;">'
            f'<div style="font-size:14.5px;color:#f1f1f7;">'
            f'<span style="color:#ff6a3d;">&#9670;</span>&nbsp; {desc}</div>'
            f'<div style="font-size:12.5px;color:#6b6c84;margin-top:4px;font-style:italic;">{tip}'
            f' &mdash; {goal}</div>'
            "</div>"
        )

    if n == 1:
        waiting_line = (
            "One task is waiting to feed the forge. Just one. "
            "It has been rehearsing all morning."
        )
    else:
        waiting_line = f"{n} tasks are waiting to feed the forge:"

    return f"""\
<div style="background:#08080f;color:#f1f1f7;font-family:{_FONT};padding:36px 28px 30px;max-width:600px;margin:0 auto;border-radius:14px;">
  <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.02em;margin:0 0 10px;">Hi {greeting}. It's Solly.</h1>
  <p style="color:#c9cad8;font-size:15px;margin:0 0 14px;">
    Your star dimmed a little overnight. Not dramatically &mdash; just enough for me to mention it.
    {waiting_line}
  </p>

  <div style="margin:20px 0 22px;">
    {task_rows}
  </div>

  <p style="color:#c9cad8;font-size:15px;margin:0 0 18px;">
    Do one. Even the tiny one. The forge doesn't judge. I do, a little.
  </p>

  <a href="{_APP_URL}/dashboard"
     style="display:inline-block;background:#ff6a3d;color:#ffffff;font-weight:700;font-size:14.5px;
            padding:13px 26px;border-radius:99px;text-decoration:none;">
    Fine, I'll stoke the forge &rarr;
  </a>

  <p style="margin:18px 0 0;font-size:13px;">
    <a href="{_APP_URL}/dashboard?energy=low" style="color:#8a8ca0;">Rough day? Simplify everything to 2-minute versions</a>
  </p>

  <p style="margin:26px 0 0;font-size:13px;color:#6b6c84;">
    This email gets 4% more dramatic every day you skip.
    Dim the reminders any time in <a href="{_APP_URL}/settings" style="color:#8a8ca0;">Settings</a>.
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
    subject = _digest_subject(count)

    recipient = email
    if settings.dev_email_override:
        recipient = settings.dev_email_override
        logger.info("DEV_EMAIL_OVERRIDE active: routing %s → %s", email, recipient)

    try:
        await asyncio.to_thread(
            resend.Emails.send,
            {
                "from": _FROM,
                "to": [recipient],
                "subject": subject,
                "html": html,
            },
        )
        logger.info("Reminder digest sent to=%s tasks=%d", recipient, count)
    except Exception:
        logger.exception("Failed to send reminder digest to=%s", email)


async def send_feedback_notification(category: str, message: str, from_email: str) -> None:
    """Notify the owner inbox about a new feedback submission.

    Falls back to logging when RESEND_API_KEY or FEEDBACK_NOTIFY_EMAIL is not
    configured. Never raises — feedback must be stored even if notification fails.
    """
    if not settings.resend_api_key or not settings.feedback_notify_email:
        logger.info("Feedback (mock notify) category=%s from=%s: %s", category, from_email, message)
        return

    body = html_lib.escape(message).replace("\n", "<br />")
    html = (
        f'<div style="font-family:sans-serif;max-width:600px;">'
        f"<h2>New {html_lib.escape(category)} feedback</h2>"
        f"<p><b>From:</b> {html_lib.escape(from_email)}</p>"
        f'<p style="white-space:pre-wrap;border-left:3px solid #7c3aed;padding-left:12px;">{body}</p>'
        f"</div>"
    )
    try:
        await asyncio.to_thread(
            resend.Emails.send,
            {
                "from": _FROM,
                "to": [settings.feedback_notify_email],
                "subject": f"[GoalForge feedback] {category} from {from_email}",
                "html": html,
            },
        )
        logger.info("Feedback notification sent category=%s", category)
    except Exception:
        logger.exception("Failed to send feedback notification")


def _build_rescue_html(display_name: str | None) -> str:
    """Build the HTML body for a rescue email.

    Deliberately gentler than the digest — rescue mode is a no-pressure
    feature, so the guilt-trip humor stays out of this one.
    """
    greeting = html_lib.escape(display_name or "Star Forger")
    app_url = f"{_APP_URL}/dashboard"
    return f"""\
<div style="background:#08080f;color:#f1f1f7;font-family:{_FONT};padding:36px 28px 30px;max-width:600px;margin:0 auto;border-radius:14px;">
  <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.02em;margin:0 0 10px;">Your star is on standby, {greeting}. That's fine.</h1>
  <p style="color:#c9cad8;font-size:15px;margin:0 0 14px;line-height:1.6;">
    Life got loud &mdash; it happens to every star. So we paused your schedule and set out
    two 2-minute tasks for whenever you're ready. No catching up. No backlog waiting to
    ambush you. Stars are patient.
  </p>
  <a href="{app_url}" style="display:inline-block;background:#ff6a3d;color:#ffffff;font-weight:700;font-size:14.5px;padding:13px 26px;border-radius:99px;text-decoration:none;">
    Open Easy Mode &rarr;
  </a>
  <p style="margin:26px 0 0;font-size:13px;color:#6b6c84;">
    One small spark is all it takes.
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
                "from": _FROM,
                "to": [recipient],
                "subject": "Your star is on standby. No pressure.",
                "html": html,
            },
        )
        logger.info("Rescue email sent to=%s", recipient)
    except Exception:
        logger.exception("Failed to send rescue email to=%s", email)
