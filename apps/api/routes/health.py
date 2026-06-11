"""
Health check and readiness probe endpoints.

/health        — liveness: always returns 200 quickly (no DB touch)
/health/ready  — readiness: checks DB connectivity with a 2-second timeout
/health/info   — build info: version, python, environment
"""

import asyncio
import sys

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from config import settings
from database import AsyncSessionLocal

router = APIRouter(tags=["health"])


@router.get("/health")
async def liveness():
    """Liveness probe — no DB touch, responds immediately."""
    return {"status": "ok", "version": "0.1.0"}


@router.get("/health/ready")
async def readiness():
    """Readiness probe — verifies the database is reachable."""
    try:
        async with asyncio.timeout(2.0):
            async with AsyncSessionLocal() as session:
                await session.execute(text("SELECT 1"))
        return {"status": "ready", "checks": {"database": "ok"}}
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "checks": {"database": "error", "detail": str(exc)},
            },
        )


@router.get("/health/info")
async def info():
    """Build info — version, python runtime, environment."""
    return {
        "version": "0.1.0",
        "python_version": (
            f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        ),
        "environment": settings.environment,
    }
