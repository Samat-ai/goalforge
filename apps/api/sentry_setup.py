"""Sentry initialization for the GoalForge API."""
import logging
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.asyncio import AsyncioIntegration
from sentry_sdk.integrations.logging import LoggingIntegration


def init_sentry(dsn: str, environment: str, traces_sample_rate: float = 0.1) -> None:
    if not dsn:
        return
    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        traces_sample_rate=traces_sample_rate,
        profiles_sample_rate=0.1,
        send_default_pii=False,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
            AsyncioIntegration(),
            LoggingIntegration(level=logging.WARNING, event_level=logging.ERROR),
        ],
        before_send=_filter_event,
    )


def _filter_event(event, hint):
    if "exc_info" in hint:
        _, exc_value, _ = hint["exc_info"]
        if hasattr(exc_value, "status_code") and exc_value.status_code in (401, 403, 404):
            return None
    return event


def capture_ai_error(error: Exception, context: dict) -> None:
    with sentry_sdk.new_scope() as scope:
        scope.set_tag("error_type", "ai_generation")
        for key, value in context.items():
            scope.set_extra(key, value)
        sentry_sdk.capture_exception(error)
