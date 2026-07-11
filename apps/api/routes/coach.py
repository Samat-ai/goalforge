"""Coach v2: guarded conversational goal-coach sessions (ChatGPT-style threads).

Turn pipeline: cap check → guard → responder → validated actions → reply.
The model proposes; deterministic code validates and applies. See
docs/superpowers/specs/2026-07-11-chat-agent-ai-harness-design.md (local-only).
"""

import logging
import random
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

import ai_utils
from ai_utils import classify_user_input, generate_coach_reply
from auth import get_current_user_email, get_current_user_id
from config import settings
from database import get_db
from deps import _ensure_owner, get_or_create_user, load_full_goal
from exceptions import AIGenerationError
from models import CoachMessage, CoachSession, User
from rate_limiting import _user_key, rate_limit
from schemas import (
    CoachMessageCreate,
    CoachSendMessageResponse,
    CoachSessionResponse,
    PaginatedCoachSessionsResponse,
)
from services import coach_service

logger = logging.getLogger(__name__)

router = APIRouter()

_TRANSCRIPT_WINDOW = 20  # last N messages sent to the responder


def _format_transcript(messages: list[CoachMessage]) -> str:
    return "\n".join(f"{m.role.upper()}: {m.content.strip()}" for m in messages)


async def _load_session(session_id: uuid.UUID, db: AsyncSession, *, for_update: bool = False) -> CoachSession:
    stmt = (
        select(CoachSession)
        .options(selectinload(CoachSession.messages))
        .where(CoachSession.id == session_id)
    )
    if for_update:
        stmt = stmt.with_for_update()
    session = (await db.execute(stmt)).scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach session not found")
    return session


def _coach_message(session_id: uuid.UUID, content: str, *, chips: list[str] | None = None,
                   forged_goal_id: uuid.UUID | None = None) -> CoachMessage:
    return CoachMessage(
        id=uuid.uuid4(), session_id=session_id, role="coach", content=content,
        chips=chips, forged_goal_id=forged_goal_id,
    )


@router.post(
    "/users/{user_id}/coach/sessions",
    response_model=CoachSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new coach chat session",
)
@rate_limit("5/minute", key_func=_user_key)
async def create_coach_session(
    request: Request,
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    current_user_email: str = Depends(get_current_user_email),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)
    await get_or_create_user(user_id, current_user_email, db)

    session = CoachSession(id=uuid.uuid4(), user_id=user_id, is_completed=False)
    db.add(session)
    await db.flush()
    db.add(_coach_message(session.id, coach_service.GREETING))
    await db.flush()
    return await _load_session(session.id, db)


@router.get(
    "/users/{user_id}/coach/sessions",
    response_model=PaginatedCoachSessionsResponse,
    summary="List coach sessions, most recently active first",
)
async def list_coach_sessions(
    user_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    _ensure_owner(user_id, current_user_id)
    total = (
        await db.execute(select(func.count(CoachSession.id)).where(CoachSession.user_id == user_id))
    ).scalar_one()
    items = (
        await db.execute(
            select(CoachSession)
            .where(CoachSession.user_id == user_id)
            .order_by(CoachSession.updated_at.desc())
            .limit(limit).offset(offset)
        )
    ).scalars().all()
    return PaginatedCoachSessionsResponse(items=items, total=total, limit=limit, offset=offset)


@router.get(
    "/coach/sessions/{session_id}",
    response_model=CoachSessionResponse,
    summary="Get a coach session with its full transcript",
)
async def get_coach_session(
    session_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    session = await _load_session(session_id, db)
    _ensure_owner(session.user_id, current_user_id)
    return session


@router.delete(
    "/coach/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a coach session and its messages (goals are untouched)",
)
async def delete_coach_session(
    session_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    session = await _load_session(session_id, db)
    _ensure_owner(session.user_id, current_user_id)
    await db.delete(session)


@router.post(
    "/coach/sessions/{session_id}/messages",
    response_model=CoachSendMessageResponse,
    summary="Send a message to the coach and receive the next turn",
)
@rate_limit("15/minute", key_func=_user_key)
async def send_coach_message(
    request: Request,
    session_id: uuid.UUID,
    payload: CoachMessageCreate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    session = await _load_session(session_id, db, for_update=True)
    _ensure_owner(session.user_id, current_user_id)

    user_row = (await db.execute(select(User).where(User.id == current_user_id))).scalar_one_or_none()
    tz_name = user_row.timezone if user_row else "UTC"

    # [1] daily cap — checked before this message is stored, so the limit is
    # "N user messages get coached per day"; over-cap messages are still
    # persisted for an honest transcript, with a canned reply and no AI calls.
    used_today = await coach_service.count_user_messages_today(current_user_id, tz_name, db)

    user_message = CoachMessage(
        id=uuid.uuid4(), session_id=session.id, role="user", content=payload.content.strip(),
    )
    db.add(user_message)
    await db.flush()
    session.updated_at = datetime.now(timezone.utc)

    if used_today >= settings.coach_daily_message_limit:
        db.add(_coach_message(session.id, coach_service.CAP_MESSAGE))
        await db.flush()
        await db.refresh(session, attribute_names=["messages"])  # identity map caches old collection; reload before response
        refreshed = await _load_session(session.id, db)
        return CoachSendMessageResponse(session=refreshed, forged_goal=None)

    # [2] guard — sees only the previous coach message + the new user message
    last_coach = next((m for m in reversed(session.messages) if m.role == "coach"), None)
    try:
        verdict = await classify_user_input(
            last_coach.content if last_coach else coach_service.GREETING,
            payload.content,
        )
    except AIGenerationError:
        logger.warning("coach guard fail-open for user %s", current_user_id)
        verdict = None

    if verdict is not None and verdict.verdict == "deflect":
        logger.info("coach deflect user=%s category=%s", current_user_id, verdict.category)
        db.add(_coach_message(session.id, random.choice(coach_service.DEFLECTIONS)))
        await db.flush()
        await db.refresh(session, attribute_names=["messages"])  # identity map caches old collection; reload before response
        refreshed = await _load_session(session.id, db)
        return CoachSendMessageResponse(session=refreshed, forged_goal=None)
    if verdict is not None and verdict.verdict == "support":
        logger.info("coach support-redirect user=%s category=%s", current_user_id, verdict.category)
        db.add(_coach_message(session.id, coach_service.SUPPORT_MESSAGE))
        await db.flush()
        await db.refresh(session, attribute_names=["messages"])  # identity map caches old collection; reload before response
        refreshed = await _load_session(session.id, db)
        return CoachSendMessageResponse(session=refreshed, forged_goal=None)

    # [3] responder
    context_block = await coach_service.build_user_context(current_user_id, session, db)
    transcript = _format_transcript([*session.messages, user_message][-_TRANSCRIPT_WINDOW:])
    try:
        turn = await generate_coach_reply(context_block, transcript)
    except AIGenerationError:
        # roll back the whole turn: get_db rolls back on raise, the user
        # message is never persisted, and the client restores the draft.
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="Coach is unavailable right now. Please retry.")

    reply = turn.reply
    chips = [c.strip()[:32] for c in turn.chips[:4] if c.strip()]
    forged_goal_id: uuid.UUID | None = None

    # canary scan — a leaked system prompt would carry the marker
    if ai_utils._CANARY in reply:
        logger.critical("coach canary leak blocked for user %s", current_user_id)
        reply = random.choice(coach_service.DEFLECTIONS)
        chips = []
        turn = turn.model_copy(update={"intent": "chat", "session_title": None})

    # [4] actions — model proposes, code validates + applies
    if turn.intent == "forge_goal":
        if not turn.forge_brief:
            logger.warning("coach forge intent without brief (user %s) — degraded to chat", current_user_id)
        else:
            try:
                goal = await coach_service.forge_goal_from_brief(turn.forge_brief, current_user_id, db)
                forged_goal_id = goal.id
            except AIGenerationError:
                reply = coach_service.FORGE_FAILURE_MESSAGE
                chips = []
    elif turn.intent == "edit_plan":
        if not turn.edits:
            logger.warning("coach edit intent without edits (user %s) — degraded to chat", current_user_id)
        else:
            applied, dropped = await coach_service.apply_plan_edits(turn.edits, current_user_id, db)
            if dropped:
                reply = f"{reply}{coach_service.EDIT_DROPPED_SUFFIX}"

    if turn.session_title and session.title is None:
        session.title = turn.session_title.strip()[:120]

    db.add(_coach_message(session.id, reply, chips=chips or None, forged_goal_id=forged_goal_id))
    await db.flush()

    await db.refresh(session, attribute_names=["messages"])  # identity map caches old collection; reload before response
    refreshed = await _load_session(session.id, db)
    forged_goal = await load_full_goal(forged_goal_id, db) if forged_goal_id else None
    return CoachSendMessageResponse(session=refreshed, forged_goal=forged_goal)
