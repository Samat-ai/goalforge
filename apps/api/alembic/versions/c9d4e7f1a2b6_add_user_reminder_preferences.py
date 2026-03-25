"""add user reminder preferences

Revision ID: c9d4e7f1a2b6
Revises: b2c3d4e5f6a1
Create Date: 2026-03-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9d4e7f1a2b6"
down_revision: Union[str, None] = "b2c3d4e5f6a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("reminder_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "users",
        sa.Column("reminder_hour", sa.Integer(), nullable=False, server_default="9"),
    )
    op.create_check_constraint(
        "ck_user_reminder_hour",
        "users",
        "reminder_hour >= 0 AND reminder_hour <= 23",
    )


def downgrade() -> None:
    op.drop_constraint("ck_user_reminder_hour", "users", type_="check")
    op.drop_column("users", "reminder_hour")
    op.drop_column("users", "reminder_enabled")
