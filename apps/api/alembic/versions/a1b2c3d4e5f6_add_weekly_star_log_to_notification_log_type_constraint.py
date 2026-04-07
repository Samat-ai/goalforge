"""Add weekly_star_log to notification_log type constraint.

Revision ID: a1b2c3d4e5f6
Revises: f3a4b5c6d7e8
Create Date: 2026-04-07
"""
from alembic import op

revision = "a1b2c3d4e5f6"
down_revision = "f3a4b5c6d7e8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_notification_log_type", "notification_logs", type_="check")
    op.create_check_constraint(
        "ck_notification_log_type",
        "notification_logs",
        "type IN ('streak_saver', 'inactivity_nudge', 'weekly_star_log')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_notification_log_type", "notification_logs", type_="check")
    op.create_check_constraint(
        "ck_notification_log_type",
        "notification_logs",
        "type IN ('streak_saver', 'inactivity_nudge')",
    )
