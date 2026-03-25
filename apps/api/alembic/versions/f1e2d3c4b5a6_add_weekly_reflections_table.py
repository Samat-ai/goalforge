"""add weekly reflections table

Revision ID: f1e2d3c4b5a6
Revises: ab3ab8b88a85
Create Date: 2026-03-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f1e2d3c4b5a6"
down_revision: Union[str, None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "weekly_reflections",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("went_well", sa.Text(), nullable=False),
        sa.Column("blockers", sa.Text(), nullable=False),
        sa.Column("week_rating", sa.Integer(), nullable=False),
        sa.Column("coach_recommendation", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("week_rating >= 1 AND week_rating <= 5", name="ck_weekly_reflection_rating"),
    )
    op.create_index(
        "ix_weekly_reflections_user_created",
        "weekly_reflections",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_weekly_reflections_user_created", table_name="weekly_reflections")
    op.drop_table("weekly_reflections")
