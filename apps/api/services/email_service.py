"""Mock email service — logs instead of sending real emails."""

import logging

logger = logging.getLogger(__name__)


async def send_reminder_email(email: str, task_title: str) -> None:
    """Simulate sending a daily reminder email by logging."""
    logger.info("Reminder email sent to=%s task=%r", email, task_title)
