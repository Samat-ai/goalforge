"""coach v2 switchover: move forged_goal_id to messages, drop stage

Revision ID: cb22d1be52b2
Revises: ca11c0ac41a1
Create Date: 2026-07-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'cb22d1be52b2'
down_revision: Union[str, None] = 'ca11c0ac41a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Copy each legacy session's forged_goal_id onto its LAST coach message so
    # historical plan cards keep rendering at the right spot in the thread.
    op.execute("""
        UPDATE coach_messages cm
        SET forged_goal_id = cs.forged_goal_id
        FROM coach_sessions cs
        WHERE cm.session_id = cs.id
          AND cs.forged_goal_id IS NOT NULL
          AND cm.role = 'coach'
          AND cm.created_at = (
              SELECT MAX(cm2.created_at) FROM coach_messages cm2
              WHERE cm2.session_id = cs.id AND cm2.role = 'coach'
          )
    """)
    op.drop_column('coach_sessions', 'forged_goal_id')
    op.drop_column('coach_sessions', 'stage')


def downgrade() -> None:
    op.add_column('coach_sessions', sa.Column('stage', sa.Integer(), server_default='0', nullable=False))
    op.add_column('coach_sessions', sa.Column('forged_goal_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'coach_sessions_forged_goal_id_fkey', 'coach_sessions', 'goals',
        ['forged_goal_id'], ['id'], ondelete='SET NULL',
    )
    op.execute("""
        UPDATE coach_sessions cs
        SET forged_goal_id = sub.fg
        FROM (
            SELECT session_id, MAX(forged_goal_id::text)::uuid AS fg
            FROM coach_messages WHERE forged_goal_id IS NOT NULL GROUP BY session_id
        ) sub
        WHERE cs.id = sub.session_id
    """)
