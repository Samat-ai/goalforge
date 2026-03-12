"""add_milestones_table

Revision ID: b3e1f9a2d8c5
Revises: a2f4e6c8b1d3
Create Date: 2026-03-11 00:00:00.000000

Phase 1 of 3 — milestone-gated architecture.
Creates the milestones table and adds a nullable milestone_id FK to daily_tasks.
The goals.milestones JSON column is left untouched here; it is backfilled in
migration c4d2e8b3f1a6 and dropped in d5e3f9c4b2a7.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3e1f9a2d8c5'
down_revision: Union[str, None] = 'a2f4e6c8b1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'milestones',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('goal_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('is_final', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('sprint_theme', sa.String(), nullable=False),
        sa.Column('sprint_status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('is_completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['goal_id'], ['goals.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_milestones_goal_id'), 'milestones', ['goal_id'], unique=False)

    op.add_column('daily_tasks', sa.Column('milestone_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_daily_tasks_milestone_id', 'daily_tasks', 'milestones',
        ['milestone_id'], ['id'], ondelete='SET NULL',
    )
    op.create_index(op.f('ix_daily_tasks_milestone_id'), 'daily_tasks', ['milestone_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_daily_tasks_milestone_id'), table_name='daily_tasks')
    op.drop_constraint('fk_daily_tasks_milestone_id', 'daily_tasks', type_='foreignkey')
    op.drop_column('daily_tasks', 'milestone_id')
    op.drop_index(op.f('ix_milestones_goal_id'), table_name='milestones')
    op.drop_table('milestones')
