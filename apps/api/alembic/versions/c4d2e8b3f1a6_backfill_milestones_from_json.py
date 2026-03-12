"""backfill_milestones_from_json

Revision ID: c4d2e8b3f1a6
Revises: b3e1f9a2d8c5
Create Date: 2026-03-11 00:01:00.000000

Phase 2 of 3 — milestone-gated architecture.
Reads the goals.milestones JSON array and inserts one Milestone row per element.
Sprint 1 is set to 'active'; all others start as 'pending'.
All existing daily_tasks for a goal are linked to that goal's first milestone.
No data is lost — the JSON column is still present after this migration.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4d2e8b3f1a6'
down_revision: Union[str, None] = 'b3e1f9a2d8c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Insert one Milestone row per element of the goals.milestones JSON array.
    # gen_random_uuid() requires PostgreSQL 13+.
    # json_array_elements_text + WITH ORDINALITY gives us position (1-indexed).
    op.execute(sa.text("""
        INSERT INTO milestones (
            id, goal_id, title, position, is_final,
            sprint_theme, sprint_status, is_completed
        )
        SELECT
            gen_random_uuid(),
            g.id,
            elem.value,
            elem.ordinality::int,
            (elem.ordinality = json_array_length(g.milestones))::boolean,
            elem.value,
            CASE WHEN elem.ordinality = 1 THEN 'active' ELSE 'pending' END,
            false
        FROM goals g
        CROSS JOIN LATERAL json_array_elements_text(g.milestones)
            WITH ORDINALITY AS elem(value, ordinality)
        WHERE g.milestones IS NOT NULL
          AND json_array_length(g.milestones) > 0
    """))

    # Link all existing daily_tasks to their goal's first milestone (sprint 1).
    op.execute(sa.text("""
        UPDATE daily_tasks dt
        SET milestone_id = m.id
        FROM milestones m
        WHERE m.goal_id = dt.goal_id
          AND m.position = 1
    """))


def downgrade() -> None:
    op.execute(sa.text("UPDATE daily_tasks SET milestone_id = NULL"))
    op.execute(sa.text("DELETE FROM milestones"))
