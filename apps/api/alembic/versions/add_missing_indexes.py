"""Add missing indexes for common query patterns

Revision ID: a4b5c6d7e8f9
Revises: b7c8d9e0f1a2
Create Date: 2026-04-09

Indexes added
-------------
goals.status
    Every goals-list query that separates active from achieved/abandoned goals
    hits this column in Python-side filtering or direct WHERE clauses.
    Low-cardinality but the table will be large per user and this avoids
    full-scans when combined with the existing user_id index.

coach_sessions.forged_goal_id
    FK to goals.id with no index.  SQLAlchemy loads the `forged_goal`
    relationship via a SELECT WHERE forged_goal_id = ?, which becomes a
    sequential scan without this index.

milestones.sprint_status
    tasks.py explicitly queries:
        WHERE goal_id = ? AND sprint_status = 'active'
    goals.py checks sprint_status in ('active', 'ready') in Python after a
    full selectinload, but a partial index on the milestones subset that are
    active/ready cuts I/O during sprint resolution and rescue-sprint lookups.

Note on CONCURRENTLY:
    CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
    We use op.get_context().autocommit_block() (Alembic ≥ 1.10) to switch the
    connection to autocommit mode for the duration of the index creation.
    On SQLite (CI / dev sqlite backend), the postgresql_concurrently flag is
    silently ignored, so the migration runs without error in both environments.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "a4b5c6d7e8f9"
down_revision: Union[str, None] = "b7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # CREATE INDEX CONCURRENTLY requires autocommit (no active transaction).
    with op.get_context().autocommit_block():
        # goals.status — simple B-tree; small cardinality but used as a filter
        # alongside user_id scans.  CONCURRENTLY avoids locking production traffic.
        op.create_index(
            "ix_goals_status",
            "goals",
            ["status"],
            unique=False,
            postgresql_concurrently=True,
            if_not_exists=True,
        )

        # coach_sessions.forged_goal_id — FK without an index; needed for the
        # forged_goal relationship load (SELECT … WHERE forged_goal_id = ?).
        op.create_index(
            "ix_coach_sessions_forged_goal_id",
            "coach_sessions",
            ["forged_goal_id"],
            unique=False,
            postgresql_concurrently=True,
            if_not_exists=True,
        )

        # milestones.sprint_status — filtered directly in task-creation and
        # rescue-sprint routes (sprint_status = 'active').
        op.create_index(
            "ix_milestones_sprint_status",
            "milestones",
            ["sprint_status"],
            unique=False,
            postgresql_concurrently=True,
            if_not_exists=True,
        )


def downgrade() -> None:
    op.drop_index(
        "ix_milestones_sprint_status",
        table_name="milestones",
        if_exists=True,
    )
    op.drop_index(
        "ix_coach_sessions_forged_goal_id",
        table_name="coach_sessions",
        if_exists=True,
    )
    op.drop_index(
        "ix_goals_status",
        table_name="goals",
        if_exists=True,
    )
