"""add task position column

Revision ID: c3a7d2e1f9b4
Revises: 54c2246897ae
Create Date: 2026-03-20
"""

import sqlalchemy as sa
from alembic import op

revision = "c3a7d2e1f9b4"
down_revision = "54c2246897ae"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "daily_tasks",
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("daily_tasks", "position")
