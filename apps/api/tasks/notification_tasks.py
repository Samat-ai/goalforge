"""Celery tasks for notifications (email, push)."""
import asyncio
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@shared_task(name="apps.api.tasks.notification_tasks.send_daily_reminders", queue="notifications")
def send_daily_reminders() -> dict:
    """
    Send daily reminders to all users.
    Replaces the /api/jobs/trigger-reminders HTTP endpoint trigger.
    Logic: rescue check → streak-saver push → inactivity nudge → digest email.
    """
    # Import here to avoid circular imports at module load time
    from apps.api.routes.jobs import _run_reminder_logic
    _run_async(_run_reminder_logic())
    logger.info("Daily reminders sent")
    return {"status": "success"}


@shared_task(name="apps.api.tasks.notification_tasks.generate_weekly_star_logs", queue="notifications")
def generate_weekly_star_logs() -> dict:
    """Generate weekly narrative star logs for all active users."""
    from apps.api.routes.jobs import _run_weekly_star_log_logic
    _run_async(_run_weekly_star_log_logic())
    logger.info("Weekly star logs generated")
    return {"status": "success"}
