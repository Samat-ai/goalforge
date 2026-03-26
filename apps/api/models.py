import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("reminder_hour >= 0 AND reminder_hour <= 23", name="ck_user_reminder_hour"),
    )

    # Maps directly to Clerk's user_id (e.g. "user_2abc...")
    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    star_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    timezone: Mapped[str] = mapped_column(String, default="UTC", nullable=False, server_default="UTC")
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    reminder_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, server_default=sa.true()
    )
    reminder_hour: Mapped[int] = mapped_column(
        Integer, default=9, nullable=False, server_default="9"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    goals: Mapped[list["Goal"]] = relationship("Goal", back_populates="user", cascade="all, delete-orphan")
    weekly_reflections: Mapped[list["WeeklyReflection"]] = relationship(
        "WeeklyReflection", back_populates="user", cascade="all, delete-orphan"
    )
    shop_rewards: Mapped[list["ShopReward"]] = relationship(
        "ShopReward", back_populates="user", cascade="all, delete-orphan"
    )
    rewards: Mapped[list["Reward"]] = relationship(
        "Reward", back_populates="user", cascade="all, delete-orphan"
    )
    web_push_subscriptions: Mapped[list["WebPushSubscription"]] = relationship(
        "WebPushSubscription", back_populates="user", cascade="all, delete-orphan"
    )
    star_logs: Mapped[list["StarLog"]] = relationship(
        "StarLog", back_populates="user", cascade="all, delete-orphan"
    )


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'achieved', 'abandoned')", name="ck_goal_status"),
        Index("idx_goal_user_created", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    raw_input: Mapped[str] = mapped_column(String, nullable=False)
    smart_title: Mapped[str] = mapped_column(String, nullable=False)
    smart_description: Mapped[str] = mapped_column(Text, nullable=False)
    goal_type: Mapped[str] = mapped_column(String, nullable=False)
    target_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="goals")
    milestones: Mapped[list["Milestone"]] = relationship(
        "Milestone", back_populates="goal",
        order_by="Milestone.position",
        cascade="all, delete-orphan",
    )
    daily_tasks: Mapped[list["DailyTask"]] = relationship(
        "DailyTask", back_populates="goal", cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Milestone(Base):
    __tablename__ = "milestones"
    __table_args__ = (
        CheckConstraint(
            "sprint_status IN ('pending', 'generating', 'ready', 'active', 'completed', 'failed')",
            name="ck_milestone_sprint_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    # True only for the last milestone — gates the "Ascend to Achieved" button
    is_final: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Context string passed to Gemini when generating this sprint's tasks
    sprint_theme: Mapped[str] = mapped_column(String, nullable=False)
    # Lifecycle: pending → generating → ready → active → completed | failed
    sprint_status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    generation_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    goal: Mapped["Goal"] = relationship("Goal", back_populates="milestones")
    daily_tasks: Mapped[list["DailyTask"]] = relationship(
        "DailyTask", back_populates="milestone"
    )


class DailyTask(Base):
    __tablename__ = "daily_tasks"
    __table_args__ = (
        Index("idx_task_goal_assigned", "goal_id", "assigned_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    milestone_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("milestones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    description: Mapped[str] = mapped_column(String, nullable=False)
    tip: Mapped[str] = mapped_column(String, nullable=False)
    assigned_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_rescue_task: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=sa.false()
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    original_description: Mapped[str | None] = mapped_column(String, nullable=True)
    original_tip: Mapped[str | None] = mapped_column(String, nullable=True)

    goal: Mapped["Goal"] = relationship("Goal", back_populates="daily_tasks")
    milestone: Mapped["Milestone | None"] = relationship("Milestone", back_populates="daily_tasks")


class Reward(Base):
    __tablename__ = "rewards"
    __table_args__ = (
        UniqueConstraint("user_id", "reward_key", name="uq_rewards_user_key"),
        CheckConstraint(
            "reward_type IN ('theme', 'title', 'lore')",
            name="ck_rewards_type",
        ),
        Index("ix_rewards_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reward_type: Mapped[str] = mapped_column(String(10), nullable=False)
    reward_key: Mapped[str] = mapped_column(String(60), nullable=False)
    is_equipped: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    acquired_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="rewards")


class WebPushSubscription(Base):
    __tablename__ = "web_push_subscriptions"
    __table_args__ = (
        UniqueConstraint("endpoint", name="uq_web_push_endpoint"),
        Index("ix_web_push_user", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    p256dh: Mapped[str] = mapped_column(String(512), nullable=False)
    auth: Mapped[str] = mapped_column(String(512), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=sa.true()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="web_push_subscriptions")


class WeeklyReflection(Base):
    __tablename__ = "weekly_reflections"
    __table_args__ = (
        CheckConstraint("week_rating >= 1 AND week_rating <= 5", name="ck_weekly_reflection_rating"),
        Index("ix_weekly_reflections_user_created", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    went_well: Mapped[str] = mapped_column(Text, nullable=False)
    blockers: Mapped[str] = mapped_column(Text, nullable=False)
    week_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    coach_recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="weekly_reflections")


class StarLog(Base):
    __tablename__ = "star_logs"
    __table_args__ = (
        UniqueConstraint("user_id", "start_date", "end_date", name="uq_star_log_user_period"),
        Index("ix_star_logs_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    completed_tasks: Mapped[int] = mapped_column(Integer, nullable=False)
    completed_days: Mapped[int] = mapped_column(Integer, nullable=False)
    chapter_title: Mapped[str] = mapped_column(String(200), nullable=False)
    chapter_body: Mapped[str] = mapped_column(Text, nullable=False)
    highlights: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    is_fallback: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=sa.false()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="star_logs")


class ShopReward(Base):
    __tablename__ = "shop_rewards"
    __table_args__ = (
        CheckConstraint("cost > 0", name="ck_shop_reward_cost_positive"),
        CheckConstraint("redemption_count >= 0", name="ck_shop_reward_redemption_nonnegative"),
        Index("ix_shop_rewards_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    cost: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=sa.true()
    )
    redemption_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="shop_rewards")
