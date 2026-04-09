"""add archived_at to goals

Revision ID: a1b2c3d4e5f6
Revises: f7a8b9c1d2e3
Create Date: 2026-04-09

"""
from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "f7a8b9c1d2e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "goals",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("goals", "archived_at")
