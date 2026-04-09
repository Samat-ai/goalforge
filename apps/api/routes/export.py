"""Data-export routes — Pro-gated JSON and CSV (ZIP) downloads."""

import csv
import io
import json
import zipfile
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user_id
from database import get_db
from deps import _ensure_owner, _load_user_with_ownership
from models import DailyTask, Goal, Milestone
from services.subscription_service import require_pro

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _isoformat(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt is not None else None


# ---------------------------------------------------------------------------
# GET /users/{user_id}/export
# ---------------------------------------------------------------------------


@router.get(
    "/users/{user_id}/export",
    summary="Export user data as JSON or CSV ZIP (Pro only)",
)
async def export_user_data(
    user_id: str,
    format: str = Query("json", pattern="^(json|csv)$"),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Export goals, tasks and milestones for a user.

    * ``format=json`` — single JSON file (``application/json``)
    * ``format=csv``  — ZIP archive containing ``goals.csv``, ``tasks.csv``
      and ``milestones.csv`` (``application/zip``)

    Requires the caller to be the owner of *user_id* and to hold a Pro
    subscription.  Returns HTTP 402 when the subscription check fails.
    """
    _ensure_owner(user_id, current_user_id)
    await require_pro(user_id, db, "export")

    # ------------------------------------------------------------------ data
    goals_result = await db.execute(
        select(Goal)
        .options(
            selectinload(Goal.milestones),
            selectinload(Goal.daily_tasks),
        )
        .where(Goal.user_id == user_id)
        .order_by(Goal.created_at.asc())
    )
    goals: list[Goal] = goals_result.scalars().all()

    exported_at = datetime.now(timezone.utc).isoformat()
    date_slug = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # ------------------------------------------------------------------ JSON
    if format == "json":
        payload = {
            "exported_at": exported_at,
            "goals": [
                {
                    "id": str(g.id),
                    "raw_input": g.raw_input,
                    "smart_title": g.smart_title,
                    "smart_description": g.smart_description,
                    "goal_type": g.goal_type,
                    "target_date": _isoformat(g.target_date),
                    "status": g.status,
                    "progress": g.progress,
                    "created_at": _isoformat(g.created_at),
                }
                for g in goals
            ],
            "tasks": [
                {
                    "id": str(t.id),
                    "goal_id": str(t.goal_id),
                    "milestone_id": str(t.milestone_id) if t.milestone_id else None,
                    "description": t.description,
                    "tip": t.tip,
                    "assigned_date": _isoformat(t.assigned_date),
                    "position": t.position,
                    "is_completed": t.is_completed,
                    "is_rescue_task": t.is_rescue_task,
                    "is_user_added": t.is_user_added,
                    "completed_at": _isoformat(t.completed_at),
                }
                for g in goals
                for t in g.daily_tasks
            ],
            "milestones": [
                {
                    "id": str(ms.id),
                    "goal_id": str(ms.goal_id),
                    "title": ms.title,
                    "position": ms.position,
                    "is_final": ms.is_final,
                    "sprint_theme": ms.sprint_theme,
                    "sprint_status": ms.sprint_status,
                    "is_completed": ms.is_completed,
                    "completed_at": _isoformat(ms.completed_at),
                    "created_at": _isoformat(ms.created_at),
                }
                for g in goals
                for ms in g.milestones
            ],
        }

        body = json.dumps(payload, indent=2).encode("utf-8")

        return StreamingResponse(
            content=iter([body]),
            media_type="application/json",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="goalforge-export-{date_slug}.json"'
                ),
                "Content-Length": str(len(body)),
            },
        )

    # ------------------------------------------------------------------ CSV
    # Build three in-memory CSV buffers then zip them.
    def _make_goals_csv() -> str:
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(
            ["id", "smart_title", "goal_type", "status", "progress",
             "target_date", "created_at"]
        )
        for g in goals:
            w.writerow(
                [str(g.id), g.smart_title, g.goal_type, g.status, g.progress,
                 _isoformat(g.target_date), _isoformat(g.created_at)]
            )
        return buf.getvalue()

    def _make_tasks_csv() -> str:
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(
            ["id", "goal_id", "milestone_id", "description", "assigned_date",
             "position", "is_completed", "is_rescue_task", "completed_at"]
        )
        for g in goals:
            for t in g.daily_tasks:
                w.writerow(
                    [str(t.id), str(t.goal_id),
                     str(t.milestone_id) if t.milestone_id else "",
                     t.description, _isoformat(t.assigned_date),
                     t.position, t.is_completed, t.is_rescue_task,
                     _isoformat(t.completed_at)]
                )
        return buf.getvalue()

    def _make_milestones_csv() -> str:
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(
            ["id", "goal_id", "title", "position", "is_final",
             "sprint_status", "is_completed", "completed_at", "created_at"]
        )
        for g in goals:
            for ms in g.milestones:
                w.writerow(
                    [str(ms.id), str(ms.goal_id), ms.title, ms.position,
                     ms.is_final, ms.sprint_status, ms.is_completed,
                     _isoformat(ms.completed_at), _isoformat(ms.created_at)]
                )
        return buf.getvalue()

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("goals.csv", _make_goals_csv())
        zf.writestr("tasks.csv", _make_tasks_csv())
        zf.writestr("milestones.csv", _make_milestones_csv())
    zip_bytes = zip_buf.getvalue()

    return StreamingResponse(
        content=iter([zip_bytes]),
        media_type="application/zip",
        headers={
            "Content-Disposition": (
                f'attachment; filename="goalforge-export-{date_slug}.zip"'
            ),
            "Content-Length": str(len(zip_bytes)),
        },
    )
