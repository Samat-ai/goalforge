import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    # Maps directly to Clerk's user_id (e.g. "user_2abc...")
    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    star_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    timezone: Mapped[str] = mapped_column(String, default="UTC", nullable=False, server_default="UTC")
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    goals: Mapped[list["Goal"]] = relationship("Goal", back_populates="user", cascade="all, delete-orphan")


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

    goal: Mapped["Goal"] = relationship("Goal", back_populates="daily_tasks")
    milestone: Mapped["Milestone | None"] = relationship("Milestone", back_populates="daily_tasks")
