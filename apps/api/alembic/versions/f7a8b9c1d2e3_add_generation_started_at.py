"""add generation_started_at to milestones

Revision ID: f7a8b9c1d2e3
Revises: c3a7d2e1f9b4
Create Date: 2026-03-23

"""
from alembic import op
import sqlalchemy as sa

revision = "f7a8b9c1d2e3"
down_revision = "c3a7d2e1f9b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "milestones",
        sa.Column("generation_started_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("milestones", "generation_started_at")
