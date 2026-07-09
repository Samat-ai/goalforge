"""
GoalForge API — entry point.

Start with:
    uvicorn main:app --reload --port 8000
"""

import logging
import time
import uuid
from contextlib import asynccontextmanager
from contextvars import ContextVar

from pythonjsonlogger import jsonlogger

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from config import settings
from startup import validate_startup
from database import engine, Base
from rate_limiting import limiter, rate_limit_enabled
from routes import coach, energy, goals, health, jobs, milestones, push, rewards, shop, tasks, users

# ---------------------------------------------------------------------------
# Structured logging
# ---------------------------------------------------------------------------

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


def _configure_logging() -> None:
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    if root.handlers:
        root.handlers.clear()

    handler = logging.StreamHandler()
    handler.addFilter(_RequestIdFilter())

    if settings.environment == "production":
        formatter = jsonlogger.JsonFormatter(
            fmt="%(asctime)s %(levelname)s %(name)s %(request_id)s %(message)s"
        )
    else:
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] %(name)s rid=%(request_id)s — %(message)s",
            datefmt="%H:%M:%S",
        )

    handler.setFormatter(formatter)
    root.addHandler(handler)


_configure_logging()
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_startup()
    if settings.environment != "production":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    logger.info("GoalForge API started.")
    yield


_is_production = settings.environment == "production"

app = FastAPI(
    title="GoalForge API",
    version="0.1.0",
    description="AI-powered goal-tracking backend",
    lifespan=lifespan,
    # No interactive docs / schema in production — they hand out a full map of
    # the API surface.
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request-ID middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    rid = str(uuid.uuid4())
    request_id_var.set(rid)
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = round((time.monotonic() - start) * 1000)
    logger.info(
        "request",
        extra={
            "request_id": rid,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    response.headers["X-Request-ID"] = rid
    return response


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------

async def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Rate limit exceeded. Please slow down your requests.",
            "limit": str(exc.detail),
        },
        headers={"Retry-After": "60"},
    )


if rate_limit_enabled:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(health.router, prefix="")
app.include_router(users.router, tags=["users"])
app.include_router(goals.router, tags=["goals"])
app.include_router(tasks.router, tags=["tasks"])
app.include_router(milestones.router, tags=["milestones"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(rewards.router, tags=["rewards"])
app.include_router(energy.router, tags=["energy"])
app.include_router(push.router, tags=["push"])
app.include_router(shop.router, tags=["shop"])
app.include_router(coach.router, tags=["coach"])
