import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ai_utils import generate_coach_turn, generate_smart_goal
from auth import get_current_user_email, get_current_user_id
from database import get_db
from exceptions import AIGenerationError
from models import CoachMessage, CoachSession, DailyTask, Goal, Milestone, User
from rate_limiting import _user_key, rate_limit
from deps import get_or_create_user
from schemas import (
    CoachMessageCreate,
    CoachSendMessageResponse,
    CoachSessionResponse,
)
from utils import user_today

router = APIRouter()


_COACH_QUESTION_FLOW: list[dict[str, str]] = [
    {
        "focus": "exact transformation outcome",
        "question": "What exact transformation do you want in 90 days, in one sentence?",
    },
    {
        "focus": "identity and motivation",
        "question": "Why does this matter right now, and who do you become if you follow through?",
    },
    {
        "focus": "time and energy constraints",
        "question": "Realistically, how many minutes per day and days per week can you commit?",
    },
    {
        "focus": "friction and obstacle mapping",
        "question": "What usually derails you, and what support or environment change could prevent that?",
    },
    {
        "focus": "starting point and confidence",
        "question": "What is your true starting level today, and what feels like a confident first week?",
    },
]


def _format_transcript(messages: list[CoachMessage]) -> str:
    return "\n".join(
        f"{msg.role.upper()}: {msg.content.strip()}"
        for msg in messages
    )


def _build_goal_raw_input(messages: list[CoachMessage]) -> str:
    answers = [m.content.strip() for m in messages if m.role == "user"]
    compact_answers = "\n".join(f"- {answer}" for answer in answers)
    return (
        "Personalized coaching intake answers:\n"
        f"{compact_answers}\n\n"
        "Forge one realistic SMART goal with clear milestones and practical daily tasks."
    )


async def _load_session_for_response(session_id: uuid.UUID, db: AsyncSession) -> CoachSession:
    result = await db.execute(
        select(CoachSession)
        .options(
            selectinload(CoachSession.messages),
            selectinload(CoachSession.forged_goal).selectinload(Goal.milestones),
            # GoalResponse (used in CoachSendMessageResponse.forged_goal) serializes
            # goal.daily_tasks. Without eager loading SQLAlchemy raises MissingGreenlet
            # in the async context. In practice forged_goal is None during the first
            # four turns so this load is a no-op until the forge response.
            selectinload(CoachSession.forged_goal).selectinload(Goal.daily_tasks),
        )
        .where(CoachSession.id == session_id)
    )
    return result.scalar_one()


@router.post(
    "/users/{user_id}/coach/sessions/start",
    response_model=CoachSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start (or resume) a personalized AI coach intake conversation",
)
@rate_limit("5/minute", key_func=_user_key)
async def start_coach_session(
    request: Request,
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    current_user_email: str = Depends(get_current_user_email),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await get_or_create_user(user_id, current_user_email, db)

    existing_result = await db.execute(
        select(CoachSession)
        .options(selectinload(CoachSession.messages))
        .where(CoachSession.user_id == user_id, CoachSession.is_completed == False)  # noqa: E712
        .order_by(CoachSession.created_at.desc())
        .limit(1)
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        return existing

    session = CoachSession(
        id=uuid.uuid4(),
        user_id=user_id,
        stage=0,
        is_completed=False,
    )
    db.add(session)
    await db.flush()

    db.add(CoachMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        role="coach",
        content=(
            "I am your GoalForge Coach. I will ask five sharp questions, then forge "
            "a personalized SMART goal and starter sprint for you.\n\n"
            f"{_COACH_QUESTION_FLOW[0]['question']}"
        ),
    ))
    await db.flush()

    return await _load_session_for_response(session.id, db)


@router.get(
    "/users/{user_id}/coach/sessions/active",
    response_model=CoachSessionResponse | None,
    summary="Get the user's latest active coach session",
)
async def get_active_coach_session(
    user_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(CoachSession)
        .options(selectinload(CoachSession.messages))
        .where(CoachSession.user_id == user_id, CoachSession.is_completed == False)  # noqa: E712
        .order_by(CoachSession.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


@router.post(
    "/coach/sessions/{session_id}/messages",
    response_model=CoachSendMessageResponse,
    summary="Send a user message to AI coach and receive next turn or forged goal",
)
@rate_limit("15/minute", key_func=_user_key)
async def send_coach_message(
    request: Request,
    session_id: uuid.UUID,
    payload: CoachMessageCreate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    session_result = await db.execute(
        select(CoachSession)
        .options(selectinload(CoachSession.messages))
        .where(CoachSession.id == session_id)
        .with_for_update()
    )
    session = session_result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach session not found")
    if session.user_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if session.is_completed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Coach session already completed")

    user_message = CoachMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        role="user",
        content=payload.content.strip(),
    )
    db.add(user_message)
    await db.flush()

    all_messages = [*session.messages, user_message]
    answer_count = sum(1 for m in all_messages if m.role == "user")

    if answer_count < len(_COACH_QUESTION_FLOW):
        question_cfg = _COACH_QUESTION_FLOW[answer_count]
        transcript = _format_transcript(all_messages[-8:])

        try:
            turn = await generate_coach_turn(transcript, question_cfg["focus"])
            acknowledgement = turn.acknowledgement
        except AIGenerationError:
            acknowledgement = "Strong detail. That gives us real signal to personalize your plan."

        db.add(CoachMessage(
            id=uuid.uuid4(),
            session_id=session.id,
            role="coach",
            content=f"{acknowledgement}\n\n{question_cfg['question']}",
        ))
        session.stage = answer_count
        await db.flush()

        refreshed = await _load_session_for_response(session.id, db)
        return CoachSendMessageResponse(session=refreshed, forged_goal=None)

    transcript = _format_transcript(all_messages)
    user_row = (await db.execute(select(User).where(User.id == current_user_id))).scalar_one_or_none()
    today = user_today(user_row.timezone if user_row else "UTC")

    try:
        ai_goal = await generate_smart_goal(_build_goal_raw_input(all_messages), today=today)
    except AIGenerationError:
        db.add(CoachMessage(
            id=uuid.uuid4(),
            session_id=session.id,
            role="coach",
            content=(
                "I hit a generation timeout while forging your plan. Reply with 'retry forge' "
                "and I will generate it from the same answers."
            ),
        ))
        session.stage = len(_COACH_QUESTION_FLOW)
        await db.flush()
        refreshed = await _load_session_for_response(session.id, db)
        return CoachSendMessageResponse(session=refreshed, forged_goal=None)

    goal = Goal(
        id=uuid.uuid4(),
        user_id=current_user_id,
        raw_input=transcript,
        smart_title=ai_goal.smart_title,
        smart_description=ai_goal.smart_description,
        goal_type=ai_goal.goal_type,
        target_date=ai_goal.target_date,
        status="active",
        progress=0,
    )
    db.add(goal)
    await db.flush()

    milestone_rows: list[Milestone] = []
    for i, ms in enumerate(ai_goal.milestones):
        row = Milestone(
            id=uuid.uuid4(),
            goal_id=goal.id,
            title=ms.title,
            position=i + 1,
            is_final=ms.is_final,
            sprint_theme=ms.sprint_theme,
            sprint_status="active" if i == 0 else "pending",
        )
        db.add(row)
        milestone_rows.append(row)

    await db.flush()

    first_milestone = milestone_rows[0]
    for task in ai_goal.initial_tasks:
        db.add(DailyTask(
            id=uuid.uuid4(),
            goal_id=goal.id,
            milestone_id=first_milestone.id,
            description=task.description,
            tip=task.tip,
            assigned_date=task.assigned_date,
        ))

    session.stage = len(_COACH_QUESTION_FLOW)
    session.is_completed = True
    session.forged_goal_id = goal.id

    db.add(CoachMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        role="coach",
        content=(
            f"Plan forged: {ai_goal.smart_title}. I translated your answers into a SMART goal "
            "with sprint milestones and your first 7-day task sequence."
        ),
    ))

    await db.flush()

    refreshed = await _load_session_for_response(session.id, db)
    return CoachSendMessageResponse(session=refreshed, forged_goal=refreshed.forged_goal)
