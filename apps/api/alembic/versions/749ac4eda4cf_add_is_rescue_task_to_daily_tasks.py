"""add is_rescue_task to daily_tasks

Revision ID: 749ac4eda4cf
Revises: f7a8b9c1d2e3
Create Date: 2026-03-23
"""
from alembic import op
import sqlalchemy as sa

revision = "749ac4eda4cf"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use IF NOT EXISTS — column may already exist if a1b2c3d4e5f6 was applied
    op.execute(
        "ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS"
        " is_rescue_task BOOLEAN NOT NULL DEFAULT FALSE"
    )


def downgrade() -> None:
    op.drop_column("daily_tasks", "is_rescue_task")
