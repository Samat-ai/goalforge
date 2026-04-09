"""add notification preference columns to users

Revision ID: a1b2c3d4e5f7
Revises: b7c8d9e0f1a2
Create Date: 2026-04-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "b7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("reminder_time", sa.String(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "reminder_days",
            sa.String(),
            nullable=False,
            server_default='["mon","tue","wed","thu","fri","sat","sun"]',
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "email_digest_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "push_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "push_enabled")
    op.drop_column("users", "email_digest_enabled")
    op.drop_column("users", "reminder_days")
    op.drop_column("users", "reminder_time")
