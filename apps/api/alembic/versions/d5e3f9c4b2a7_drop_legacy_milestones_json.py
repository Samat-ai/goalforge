"""drop_legacy_milestones_json

Revision ID: d5e3f9c4b2a7
Revises: c4d2e8b3f1a6
Create Date: 2026-03-11 00:02:00.000000

Phase 3 of 3 — milestone-gated architecture.
Drops the goals.milestones JSON column now that all data lives in the
milestones table. Run this only after confirming the backfill is complete.

Downgrade reconstructs the JSON array from milestone titles so the column
is not permanently lost if you need to roll back.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd5e3f9c4b2a7'
down_revision: Union[str, None] = 'c4d2e8b3f1a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('goals', 'milestones')


def downgrade() -> None:
    # Restore as nullable first, then backfill, then tighten to not null.
    op.add_column('goals', sa.Column('milestones', sa.JSON(), nullable=True))
    op.execute(sa.text("""
        UPDATE goals g
        SET milestones = (
            SELECT json_agg(m.title ORDER BY m.position)
            FROM milestones m
            WHERE m.goal_id = g.id
        )
        WHERE EXISTS (
            SELECT 1 FROM milestones m WHERE m.goal_id = g.id
        )
    """))
    op.execute(sa.text("UPDATE goals SET milestones = '[]'::json WHERE milestones IS NULL"))
    op.alter_column('goals', 'milestones', nullable=False)
