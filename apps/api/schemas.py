import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Daily Task schemas
# ---------------------------------------------------------------------------

class TaskBase(BaseModel):
    description: str
    tip: str
    assigned_date: date


class TaskResponse(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    goal_id: uuid.UUID
    is_completed: bool
    completed_at: datetime | None


# ---------------------------------------------------------------------------
# Goal schemas
# ---------------------------------------------------------------------------

class GoalCreate(BaseModel):
    """Payload sent by the client to create a new goal."""
    raw_input: str = Field(..., min_length=10, max_length=2000)


class GoalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: str
    raw_input: str
    smart_title: str
    smart_description: str
    goal_type: str
    target_date: date
    milestones: list[str]
    status: Literal["active", "completed", "abandoned"]
    current_streak: int
    best_streak: int
    vitality: int
    created_at: datetime
    daily_tasks: list[TaskResponse] = []


# ---------------------------------------------------------------------------
# Schemas used internally by the AI layer (not exposed to clients directly)
# ---------------------------------------------------------------------------

class AIGoalOutput(BaseModel):
    """Strict schema that Gemini must populate — mirrors the Goal + first DailyTask."""
    smart_title: str = Field(..., description="Concise, motivating SMART goal title (≤12 words)")
    smart_description: str = Field(..., description="2-3 sentence SMART goal description")
    goal_type: str = Field(..., description="Category, e.g. fitness, career, learning, finance, health")
    target_date: date = Field(..., description="Realistic ISO-8601 target completion date")
    milestones: list[str] = Field(..., min_length=3, max_length=7, description="3-7 ordered milestone strings")
    initial_tasks: list["AITaskOutput"] = Field(
        ..., min_length=1, max_length=7,
        description="Daily tasks for the first 7 days"
    )


class AITaskOutput(BaseModel):
    description: str = Field(..., description="Clear, actionable task description (≤20 words)")
    tip: str = Field(..., description="Motivational tip or 'why this helps' (≤20 words)")
    assigned_date: date = Field(..., description="ISO-8601 date this task should be completed")


AIGoalOutput.model_rebuild()
