"""Web push delivery service.

Uses pywebpush to send encrypted push notifications via the Web Push protocol.
Dead subscriptions (410 Gone / 404 Not Found) are hard-deleted for database
hygiene and privacy.
"""

import asyncio
import json
import logging

from pywebpush import WebPushException, webpush
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models import WebPushSubscription

logger = logging.getLogger(__name__)


async def send_push_digest(
    subscription: WebPushSubscription,
    title: str,
    body: str,
    db: AsyncSession,
    url: str = "/dashboard",
) -> None:
    """Send a push notification to a single subscription.

    On 410/404 responses the subscription row is hard-deleted from the DB.
    """
    if not settings.vapid_private_key:
        logger.info(
            "push_stub (no VAPID key) endpoint=%s title=%s",
            subscription.endpoint,
            title,
        )
        return

    subscription_info = {
        "endpoint": subscription.endpoint,
        "keys": {
            "p256dh": subscription.p256dh,
            "auth": subscription.auth,
        },
    }

    payload = json.dumps({"title": title, "body": body, "url": url})

    vapid_claims = {
        "sub": settings.vapid_subject,
    }

    try:
        await asyncio.to_thread(
            webpush,
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=settings.vapid_private_key,
            vapid_claims=vapid_claims,
        )
        logger.info(
            "push_sent endpoint=%s title=%s",
            subscription.endpoint,
            title,
        )
    except WebPushException as e:
        status_code = e.response.status_code if e.response is not None else None

        if status_code in (410, 404):
            logger.warning(
                "push_subscription_dead status=%s endpoint=%s — deleting row",
                status_code,
                subscription.endpoint,
            )
            await db.execute(
                delete(WebPushSubscription).where(
                    WebPushSubscription.id == subscription.id
                )
            )
            await db.flush()
        else:
            logger.error(
                "push_failed status=%s endpoint=%s error=%s",
                status_code,
                subscription.endpoint,
                str(e),
            )
