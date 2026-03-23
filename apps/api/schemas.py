import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field


# ---------------------------------------------------------------------------
# Milestone schemas
# ---------------------------------------------------------------------------

class MilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    goal_id: uuid.UUID
    title: str
    position: int
    is_final: bool
    sprint_theme: str
    sprint_status: str
    is_completed: bool
    completed_at: datetime | None
    generation_started_at: datetime | None = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Daily Task schemas
# ---------------------------------------------------------------------------

class TaskBase(BaseModel):
    description: str
    tip: str
    assigned_date: date
    position: int = 0


class TaskResponse(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    goal_id: uuid.UUID
    milestone_id: uuid.UUID | None
    is_completed: bool
    completed_at: datetime | None


class TaskCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    milestone_id: uuid.UUID | None = None
    assigned_date: date | None = None
    tip: str = ""


class TaskUpdate(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)


class TaskReorderItem(BaseModel):
    id: uuid.UUID
    position: int = Field(..., ge=0)


class TaskReorderRequest(BaseModel):
    tasks: list[TaskReorderItem] = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Goal schemas
# ---------------------------------------------------------------------------

class GoalCreate(BaseModel):
    """Payload sent by the client to create a new goal."""
    raw_input: str = Field(..., min_length=10, max_length=2000)


class GoalStatusUpdate(BaseModel):
    status: Literal["active", "achieved", "abandoned"]


class GoalProgressUpdate(BaseModel):
    progress: int = Field(..., ge=0, le=100)


class GoalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: str
    raw_input: str
    smart_title: str
    smart_description: str
    goal_type: str
    target_date: date
    milestones: list[MilestoneResponse] = []
    status: Literal["active", "achieved", "abandoned"]
    progress: int
    created_at: datetime
    daily_tasks: list[TaskResponse] = []

    @computed_field
    @property
    def completed_days(self) -> list[str]:
        """Unique ISO date strings where at least one task was completed."""
        return sorted({
            task.assigned_date.isoformat()
            for task in self.daily_tasks
            if task.is_completed
        })

    @computed_field
    @property
    def milestones_completed(self) -> int:
        """Count of milestones marked is_completed."""
        return sum(1 for m in self.milestones if m.is_completed)

    @computed_field
    @property
    def milestones_total(self) -> int:
        """Total number of milestones for this goal."""
        return len(self.milestones)


# ---------------------------------------------------------------------------
# User settings schemas
# ---------------------------------------------------------------------------

class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    star_points: int
    timezone: str
    display_name: str | None


class UserSettingsUpdate(BaseModel):
    timezone: str | None = None
    display_name: str | None = Field(default=None, max_length=60)


# ---------------------------------------------------------------------------
# Paginated response wrappers
# ---------------------------------------------------------------------------

class PaginatedGoalsResponse(BaseModel):
    items: list[GoalResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Schemas used internally by the AI layer (not exposed to clients directly)
# ---------------------------------------------------------------------------

class AIMilestoneConfig(BaseModel):
    """One sprint milestone as returned by Gemini during goal creation."""
    title: str = Field(..., description="Sprint title (≤8 words, e.g. 'Setup & Authentication')")
    sprint_theme: str = Field(..., description="Brief phrase describing the focus of this 7-day sprint")
    is_final: bool = Field(..., description="True only for the last milestone in the sequence")


class AITaskOutput(BaseModel):
    description: str = Field(..., description="Clear, actionable task description (≤20 words)")
    tip: str = Field(..., description="Motivational tip or 'why this helps' (≤20 words)")
    assigned_date: date = Field(..., description="ISO-8601 date this task should be completed")


class AISprintOutput(BaseModel):
    """Wrapper Gemini populates when generating tasks for a future sprint."""
    tasks: list[AITaskOutput] = Field(
        ..., min_length=1, max_length=7,
        description="Daily tasks for this 7-day sprint, one per day"
    )


class AIGoalOutput(BaseModel):
    """Strict schema that Gemini must populate — mirrors the Goal + first sprint tasks."""
    smart_title: str = Field(..., max_length=200, description="Concise, motivating SMART goal title (≤12 words)")
    smart_description: str = Field(..., max_length=500, description="2-3 sentence SMART goal description")
    goal_type: str = Field(..., description="Category, e.g. fitness, career, learning, finance, health")
    target_date: date = Field(..., description="Realistic ISO-8601 target completion date")
    milestones: list[AIMilestoneConfig] = Field(
        ..., min_length=3, max_length=5,
        description="3-5 ordered sprint milestones; set is_final=true only on the last one"
    )
    initial_tasks: list[AITaskOutput] = Field(
        ..., min_length=1, max_length=7,
        description="Daily tasks for the FIRST milestone sprint only (7 days)"
    )


class AIRescueTaskItem(BaseModel):
    description: str = Field(..., description="Recovery micro-task (≤70 chars, action-first)")
    tip: str = Field(..., description="Encouraging reason why this small step helps (≤20 words)")


class AIRescueOutput(BaseModel):
    tasks: list[AIRescueTaskItem] = Field(
        ..., min_length=2, max_length=2,
        description="Exactly 2 recovery micro-tasks",
    )
