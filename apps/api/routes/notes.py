"""Goal notes (journal) CRUD routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user_id
from database import get_db
from deps import _load_goal_with_ownership
from models import Goal, GoalNote
from schemas import (
    GoalNoteCreate,
    GoalNoteUpdate,
    GoalNoteResponse,
    PaginatedGoalNotesResponse,
)

router = APIRouter()


@router.get(
    "/goals/{goal_id}/notes",
    response_model=PaginatedGoalNotesResponse,
    summary="List notes for a goal (newest first, paginated)",
)
async def list_notes(
    goal_id: uuid.UUID,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await _load_goal_with_ownership(goal_id, current_user_id, db)

    total_result = await db.execute(
        select(func.count(GoalNote.id)).where(GoalNote.goal_id == goal_id)
    )
    total = total_result.scalar_one()

    result = await db.execute(
        select(GoalNote)
        .where(GoalNote.goal_id == goal_id)
        .order_by(GoalNote.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = result.scalars().all()

    return PaginatedGoalNotesResponse(items=items, total=total, limit=limit, offset=offset)


@router.post(
    "/goals/{goal_id}/notes",
    response_model=GoalNoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a note for a goal",
)
async def create_note(
    goal_id: uuid.UUID,
    payload: GoalNoteCreate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await _load_goal_with_ownership(goal_id, current_user_id, db)

    note = GoalNote(
        id=uuid.uuid4(),
        goal_id=goal_id,
        user_id=current_user_id,
        content=payload.content,
        mood=payload.mood,
    )
    db.add(note)
    await db.flush()
    await db.refresh(note)
    return note


@router.patch(
    "/notes/{note_id}",
    response_model=GoalNoteResponse,
    summary="Update a note's content and/or mood",
)
async def update_note(
    note_id: uuid.UUID,
    payload: GoalNoteUpdate,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(GoalNote).where(GoalNote.id == note_id))
    note = result.scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    # Verify the user owns the goal this note belongs to
    await _load_goal_with_ownership(note.goal_id, current_user_id, db)

    if payload.content is not None:
        note.content = payload.content
    if payload.mood is not None:
        note.mood = payload.mood

    await db.flush()
    await db.refresh(note)
    return note


@router.delete(
    "/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a note",
)
async def delete_note(
    note_id: uuid.UUID,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(GoalNote).where(GoalNote.id == note_id))
    note = result.scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    # Verify the user owns the goal this note belongs to
    await _load_goal_with_ownership(note.goal_id, current_user_id, db)

    await db.delete(note)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
