"""Web push delivery service (foundation).

Current behavior: structured logging stub so push workflows can be validated
before wiring a provider. Integrate pywebpush or provider SDK later.
"""

import logging

from models import WebPushSubscription

logger = logging.getLogger(__name__)


async def send_push_digest(
    subscription: WebPushSubscription,
    title: str,
    body: str,
    url: str = "/dashboard",
) -> None:
    """Stub delivery path for web push notifications.

    This intentionally logs payload metadata in development.
    """
    logger.info(
        "push_digest_stub endpoint=%s title=%s body=%s url=%s",
        subscription.endpoint,
        title,
        body,
        url,
    )
