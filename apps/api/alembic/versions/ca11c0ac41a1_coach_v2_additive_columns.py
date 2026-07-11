"""coach v2 additive columns

Revision ID: ca11c0ac41a1
Revises: c1d2e3f4a5b6
Create Date: 2026-07-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'ca11c0ac41a1'
down_revision: Union[str, None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('coach_sessions', sa.Column('title', sa.String(length=120), nullable=True))
    op.add_column('coach_messages', sa.Column('chips', sa.JSON(), nullable=True))
    op.add_column('coach_messages', sa.Column('forged_goal_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_coach_messages_forged_goal_id', 'coach_messages', 'goals',
        ['forged_goal_id'], ['id'], ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_coach_messages_forged_goal_id', 'coach_messages', type_='foreignkey')
    op.drop_column('coach_messages', 'forged_goal_id')
    op.drop_column('coach_messages', 'chips')
    op.drop_column('coach_sessions', 'title')
