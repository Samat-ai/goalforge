"""add energy resize columns to daily_tasks

Revision ID: b2c3d4e5f6a1
Revises: ab3ab8b88a85
Create Date: 2026-03-25
"""
from alembic import op

revision = "b2c3d4e5f6a1"
down_revision = "ab3ab8b88a85"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS original_description VARCHAR"
    )
    op.execute(
        "ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS original_tip VARCHAR"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE daily_tasks DROP COLUMN IF EXISTS original_description"
    )
    op.execute(
        "ALTER TABLE daily_tasks DROP COLUMN IF EXISTS original_tip"
    )
