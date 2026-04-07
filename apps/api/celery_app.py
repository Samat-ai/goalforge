"""Celery application for GoalForge background tasks."""
from celery import Celery
from kombu import Queue


def make_celery(redis_url: str) -> Celery:
    app = Celery(
        "goalforge",
        broker=redis_url,
        backend=redis_url,
        include=[
            "apps.api.tasks.goal_tasks",
            "apps.api.tasks.notification_tasks",
        ],
    )
    app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_queues=[
            Queue("default"),
            Queue("ai_generation"),
            Queue("notifications"),
        ],
        task_default_queue="default",
        task_routes={
            "apps.api.tasks.goal_tasks.*": {"queue": "ai_generation"},
            "apps.api.tasks.notification_tasks.*": {"queue": "notifications"},
        },
        task_acks_late=True,
        worker_prefetch_multiplier=1,
        task_max_retries=3,
        task_retry_backoff=True,
        task_retry_backoff_max=600,
        beat_schedule={
            "daily-reminders": {
                "task": "apps.api.tasks.notification_tasks.send_daily_reminders",
                "schedule": 3600.0,  # every hour
            },
            "weekly-star-log": {
                "task": "apps.api.tasks.notification_tasks.generate_weekly_star_logs",
                "schedule": 604800.0,  # weekly
            },
        },
    )
    return app


# Import settings here to avoid circular imports
from apps.api.config import settings
celery_app = make_celery(settings.redis_url)
