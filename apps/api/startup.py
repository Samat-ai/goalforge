import os
import sys
import logging
from config import settings

logger = logging.getLogger(__name__)

def validate_startup() -> None:
    errors = []
    warnings = []

    # Required for basic operation
    if not getattr(settings, 'database_url', None):
        errors.append("DATABASE_URL — app cannot connect to database")
    if getattr(settings, 'google_genai_use_vertexai', False):
        if not getattr(settings, 'google_cloud_project', None):
            errors.append("GOOGLE_CLOUD_PROJECT — required when GOOGLE_GENAI_USE_VERTEXAI=true")
        creds = getattr(settings, 'google_application_credentials', None)
        if creds and not os.path.isfile(creds):
            errors.append(
                f"GOOGLE_APPLICATION_CREDENTIALS — file not found at '{creds}' "
                "(check the path / docker volume mount)"
            )
        elif not creds and not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            errors.append(
                "GOOGLE_APPLICATION_CREDENTIALS — required when GOOGLE_GENAI_USE_VERTEXAI=true"
            )
    elif not getattr(settings, 'gemini_api_key', None):
        errors.append("GEMINI_API_KEY — AI features will be unavailable")
    if not getattr(settings, 'clerk_jwks_url', None):
        errors.append("CLERK_JWKS_URL — authentication will fail for all users")

    # Optional — warn but don't block
    optional_checks = [
        ('resend_api_key', 'RESEND_API_KEY', 'email notifications disabled'),
        ('vapid_private_key', 'VAPID_PRIVATE_KEY', 'push notifications disabled'),
    ]
    for attr, env_var, consequence in optional_checks:
        if not getattr(settings, attr, None):
            warnings.append(f"{env_var} not set — {consequence}")

    for w in warnings:
        logger.warning("Config: %s", w)

    if errors:
        logger.critical("=" * 60)
        logger.critical("STARTUP FAILED — missing required configuration:")
        for e in errors:
            logger.critical("  ✗ %s", e)
        logger.critical("Set these environment variables and restart the server.")
        logger.critical("=" * 60)
        sys.exit(1)

    logger.info("Config: all required environment variables present ✓")
