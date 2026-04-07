"""Celery tasks for AI goal and sprint generation."""
import asyncio
import logging
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


def _run_async(coro):
    """Run an async coroutine from a sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@shared_task(
    bind=True,
    name="apps.api.tasks.goal_tasks.generate_smart_goal",
    max_retries=3,
    queue="ai_generation",
)
def generate_smart_goal_task(self, goal_id: str, raw_input: str) -> dict:
    """
    Generate SMART goal via Gemini AI.
    Replaces the FastAPI BackgroundTask in routes/goals.py Phase 2.
    Retries up to 3 times with exponential backoff on failure.
    """
    try:
        from apps.api.services.goal_service import _phase2_generate
        _run_async(_phase2_generate(goal_id, raw_input))
        logger.info("Smart goal generated: goal_id=%s", goal_id)
        return {"status": "success", "goal_id": goal_id}
    except Exception as exc:
        logger.error("Smart goal generation failed: goal_id=%s error=%s", goal_id, exc)
        countdown = 2 ** self.request.retries * 30  # 30s, 60s, 120s
        raise self.retry(exc=exc, countdown=countdown)


@shared_task(
    bind=True,
    name="apps.api.tasks.goal_tasks.generate_sprint_tasks",
    max_retries=3,
    queue="ai_generation",
)
def generate_sprint_tasks_task(self, milestone_id: str, goal_id: str) -> dict:
    """
    Pre-generate sprint tasks for next milestone.
    Replaces _pre_generate_sprint BackgroundTask in task_service.py.
    """
    try:
        from apps.api.services.task_service import _pre_generate_sprint
        _run_async(_pre_generate_sprint(milestone_id, goal_id))
        logger.info("Sprint tasks generated: milestone_id=%s", milestone_id)
        return {"status": "success", "milestone_id": milestone_id}
    except Exception as exc:
        logger.error("Sprint generation failed: milestone_id=%s error=%s", milestone_id, exc)
        countdown = 2 ** self.request.retries * 60  # 60s, 120s, 240s
        raise self.retry(exc=exc, countdown=countdown)


@shared_task(
    bind=True,
    name="apps.api.tasks.goal_tasks.execute_rescue_sprint",
    max_retries=2,
    queue="ai_generation",
)
def execute_rescue_sprint_task(self, goal_id: str, user_id: str) -> dict:
    """Execute rescue sprint for users inactive 48h+."""
    try:
        from apps.api.services.rescue_service import execute_rescue_sprint
        _run_async(execute_rescue_sprint(goal_id, user_id))
        return {"status": "success", "goal_id": goal_id}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)
