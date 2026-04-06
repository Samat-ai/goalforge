"""add notification_logs table

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-04-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f3a4b5c6d7e8"
down_revision: Union[str, None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notification_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("sent_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "type IN ('streak_saver', 'inactivity_nudge')",
            name="ck_notification_log_type",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "type", "sent_date",
            name="uq_notification_log_user_type_date",
        ),
    )
    op.create_index(
        "ix_notification_logs_user_id",
        "notification_logs",
        ["user_id"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_notification_logs_user_id", table_name="notification_logs", if_exists=True)
    op.drop_table("notification_logs")
