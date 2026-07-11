import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator


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
    is_rescue_task: bool = False
    is_user_added: bool = False
    original_description: str | None = None
    original_tip: str | None = None


class RewardDrop(BaseModel):
    tier: Literal['bonus', 'crit', 'jackpot']
    points_awarded: int
    collectible_type: str | None   # 'theme' | 'title' | 'lore' | None
    collectible_key: str | None
    collectible_display_name: str | None
    collectible_body: str | None   # lore text only; None for theme/title


class TaskCompleteResponse(TaskResponse):
    # Always present in JSON output — never omitted via exclude_none.
    # Standard tier sets this to None; bonus/crit/jackpot populate it.
    reward_drop: RewardDrop | None = None
    # Actual points awarded — 0 for user-added tasks, 10+ for AI-generated tasks.
    # Frontend uses this to correct the optimistic +10 applied in onMutate.
    points_awarded: int = 10


class EnergyResizeResponse(BaseModel):
    tasks_resized: int
    tasks: list[TaskResponse]


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

GoalType = Literal["health", "career", "learning", "finance", "relationships", "personal"]


class GoalCreate(BaseModel):
    """Payload sent by the client to create a new goal."""
    raw_input: str = Field(..., min_length=10, max_length=2000)


class GoalStatusUpdate(BaseModel):
    status: Literal["active", "achieved", "abandoned"]


class GoalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: str
    raw_input: str
    smart_title: str
    smart_description: str
    goal_type: GoalType
    target_date: date
    milestones: list[MilestoneResponse] = []
    status: Literal["active", "achieved", "abandoned"]

    @field_validator('goal_type', mode='before')
    @classmethod
    def normalise_goal_type(cls, v: str) -> str:
        _map = {
            'fitness': 'health', 'wellness': 'health', 'wellbeing': 'health',
            'creative': 'personal', 'creativity': 'personal', 'mindset': 'personal',
            'financial': 'finance', 'money': 'finance',
            'education': 'learning', 'skills': 'learning',
            'work': 'career', 'professional': 'career',
            'social': 'relationships', 'family': 'relationships',
        }
        normalised = v.lower().strip()
        return _map.get(normalised, normalised)
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

    @computed_field
    @property
    def rescue_mode(self) -> bool:
        """True when:
        - goal is active
        - has at least one milestone with sprint_status in ('active', 'ready') — 'ready' included
          because tasks are generated but user hasn't engaged yet
        - no rescue task already created today (idempotency guard)
        - 48h+ elapsed since last task completion (or since created_at if no completions ever)

        Note: uses the UTC calendar date for the today check — a known limitation
        since this runs in a Pydantic model without access to user.timezone.
        The server-side goal_is_rescue_mode() in rescue_service.py uses user_today() instead.
        """
        if self.status != "active":
            return False

        active_milestone = next(
            (m for m in self.milestones if m.sprint_status in ("active", "ready")),
            None,
        )
        if not active_milestone:
            return False

        today = datetime.now(timezone.utc).date()
        rescue_task_today = any(
            t.is_rescue_task and t.assigned_date == today
            for t in self.daily_tasks
        )
        if rescue_task_today:
            return False

        completed_times = [
            t.completed_at
            for t in self.daily_tasks
            if t.is_completed and t.completed_at is not None
        ]
        if completed_times:
            last_completed = max(completed_times)
        else:
            last_completed = self.created_at

        # Normalize to UTC-aware for comparison (ORM datetimes may be naive but are UTC)
        if last_completed.tzinfo is None:
            last_completed = last_completed.replace(tzinfo=timezone.utc)

        return (datetime.now(timezone.utc) - last_completed) >= timedelta(hours=48)


class CoachMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class CoachMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    role: Literal["coach", "user"]
    content: str
    chips: list[str] | None = None
    forged_goal_id: uuid.UUID | None = None
    created_at: datetime


class CoachSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: str
    title: str | None = None
    is_completed: bool
    created_at: datetime
    updated_at: datetime
    messages: list[CoachMessageResponse] = []


class CoachSendMessageResponse(BaseModel):
    session: CoachSessionResponse
    forged_goal: GoalResponse | None = None


class CoachSessionListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str | None
    updated_at: datetime


class PaginatedCoachSessionsResponse(BaseModel):
    items: list[CoachSessionListItem]
    total: int
    limit: int
    offset: int


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
    reminder_enabled: bool
    reminder_hour: int


class UserSettingsUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=60)
    reminder_enabled: bool | None = None
    reminder_hour: int | None = Field(default=None, ge=0, le=23)


class WeeklyReflectionCreate(BaseModel):
    went_well: str = Field(..., min_length=5, max_length=1200)
    blockers: str = Field(..., min_length=5, max_length=1200)
    week_rating: int = Field(..., ge=1, le=5)


class WeeklyReflectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: str
    went_well: str
    blockers: str
    week_rating: int
    coach_recommendation: str
    created_at: datetime


class RewardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reward_type: str
    reward_key: str
    display_name: str
    body: str | None
    is_equipped: bool
    acquired_at: datetime


class ShopRewardCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    cost: int = Field(..., ge=1, le=100000)


class ShopRewardUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    cost: int | None = Field(default=None, ge=1, le=100000)
    is_active: bool | None = None


class ShopRewardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: str
    title: str
    cost: int
    is_active: bool
    redemption_count: int
    created_at: datetime


class ShopRewardRedeemResponse(BaseModel):
    reward: ShopRewardResponse
    remaining_star_points: int


class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(..., min_length=10, max_length=512)
    auth: str = Field(..., min_length=5, max_length=512)


class PushSubscriptionCreate(BaseModel):
    endpoint: str = Field(..., min_length=10, max_length=4000)
    keys: PushSubscriptionKeys


class PushSubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: str
    endpoint: str
    is_active: bool
    created_at: datetime


class FeedbackCreate(BaseModel):
    category: Literal["bug", "idea", "other"]
    message: str = Field(..., min_length=1, max_length=2000)

    @field_validator("message")
    @classmethod
    def _strip_and_require_content(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("message must not be blank")
        return stripped


class FeedbackResponse(BaseModel):
    id: uuid.UUID
    status: Literal["received"] = "received"


class BadgeResponse(BaseModel):
    key: str
    title: str
    description: str
    unlocked: bool
    current: int
    target: int


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


class AIGuardVerdict(BaseModel):
    """Input-guard classifier output. Applies to chat messages and goal raw_input."""
    verdict: Literal["allow", "deflect", "support"]
    category: str = Field(..., max_length=40, description="Short lowercase tag, e.g. on_topic, injection, off_topic, harmful, self_harm")


class AIPlanEdit(BaseModel):
    """One plan edit proposed by the coach. target_id stays a string — the
    service parses it and drops invalid ids instead of failing the turn."""
    target: Literal["task_description", "task_tip", "milestone_theme", "goal_title", "goal_description"]
    target_id: str
    new_value: str = Field(..., min_length=1, max_length=500)


class AICoachTurnV2(BaseModel):
    """Router-responder output for one coach turn."""
    reply: str = Field(..., min_length=1, max_length=900)
    intent: Literal["chat", "forge_goal", "edit_plan"]
    chips: list[str] = Field(default_factory=list, description="0-4 short next-message suggestions from the user's perspective")
    forge_brief: str | None = Field(None, description="Distilled goal description; required when intent=forge_goal")
    edits: list[AIPlanEdit] | None = Field(None, description="Proposed edits; required when intent=edit_plan")
    session_title: str | None = Field(None, max_length=120, description="Set once when the session is untitled")


class AIGoalOutput(BaseModel):
    """Strict schema that Gemini must populate — mirrors the Goal + first sprint tasks."""
    smart_title: str = Field(..., max_length=200, description="Concise, motivating SMART goal title (≤12 words)")
    smart_description: str = Field(..., max_length=500, description="2-3 sentence SMART goal description")
    goal_type: GoalType = Field(..., description="Classify into exactly one of: health, career, learning, finance, relationships, personal")
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


class AIWeeklyCoachOutput(BaseModel):
    recommendation: str = Field(
        ...,
        min_length=20,
        max_length=800,
        description="Practical coaching recommendation for next week",
    )


class AIStarLogOutput(BaseModel):
    chapter_title: str = Field(..., max_length=200)
    chapter_body: str = Field(..., max_length=1200)
    highlights: list[str] = Field(..., min_length=2, max_length=3)


class StarLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: str
    start_date: date
    end_date: date
    completed_tasks: int
    completed_days: int
    chapter_title: str
    chapter_body: str
    highlights: list[str]
    is_fallback: bool
    created_at: datetime
