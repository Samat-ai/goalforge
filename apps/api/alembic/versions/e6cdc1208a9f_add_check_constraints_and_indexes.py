"""Add check constraints and indexes

Revision ID: e6cdc1208a9f
Revises: 2f0f06807e03
Create Date: 2026-03-14 23:08:28.249517

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e6cdc1208a9f'
down_revision: Union[str, None] = '2f0f06807e03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('idx_task_goal_assigned', 'daily_tasks', ['goal_id', 'assigned_date'], unique=False, if_not_exists=True)
    op.create_index('idx_goal_user_created', 'goals', ['user_id', 'created_at'], unique=False, if_not_exists=True)
    op.create_check_constraint('ck_goal_status', 'goals', "status IN ('active', 'achieved', 'abandoned')")
    op.create_check_constraint(
        'ck_milestone_sprint_status', 'milestones',
        "sprint_status IN ('pending', 'generating', 'ready', 'active', 'completed', 'failed')",
    )


def downgrade() -> None:
    op.drop_constraint('ck_milestone_sprint_status', 'milestones', type_='check')
    op.drop_constraint('ck_goal_status', 'goals', type_='check')
    op.drop_index('idx_goal_user_created', table_name='goals')
    op.drop_index('idx_task_goal_assigned', table_name='daily_tasks')
