"""add_progress_to_goals

Revision ID: a2f4e6c8b1d3
Revises: daf533cac4d3
Create Date: 2026-03-10 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a2f4e6c8b1d3'
down_revision: Union[str, None] = 'daf533cac4d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'goals',
        sa.Column('progress', sa.Integer(), nullable=False, server_default='0'),
    )
    # Rename legacy "completed" status to "achieved" (the 3 A's: active/achieved/abandoned)
    op.execute("UPDATE goals SET status = 'achieved' WHERE status = 'completed'")


def downgrade() -> None:
    op.execute("UPDATE goals SET status = 'completed' WHERE status = 'achieved'")
    op.drop_column('goals', 'progress')
