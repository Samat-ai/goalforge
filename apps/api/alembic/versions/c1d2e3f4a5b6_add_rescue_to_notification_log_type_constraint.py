"""Add rescue to notification_log type constraint.

Rescue emails now dedup via notification_logs (one per user per local day),
so 'rescue' must be a valid type.

Revision ID: c1d2e3f4a5b6
Revises: 9436181edf93
Create Date: 2026-07-10
"""
from alembic import op

revision = "c1d2e3f4a5b6"
down_revision = "9436181edf93"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_notification_log_type", "notification_logs", type_="check")
    op.create_check_constraint(
        "ck_notification_log_type",
        "notification_logs",
        "type IN ('streak_saver', 'inactivity_nudge', 'weekly_star_log', 'rescue')",
    )


def downgrade() -> None:
    op.execute("DELETE FROM notification_logs WHERE type = 'rescue'")
    op.drop_constraint("ck_notification_log_type", "notification_logs", type_="check")
    op.create_check_constraint(
        "ck_notification_log_type",
        "notification_logs",
        "type IN ('streak_saver', 'inactivity_nudge', 'weekly_star_log')",
    )
