"""add shop rewards table

Revision ID: e1f2a3b4c5d6
Revises: ab3ab8b88a85
Create Date: 2026-03-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "ab3ab8b88a85"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "shop_rewards",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("cost", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("redemption_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("cost > 0", name="ck_shop_reward_cost_positive"),
        sa.CheckConstraint(
            "redemption_count >= 0", name="ck_shop_reward_redemption_nonnegative"
        ),
    )
    op.create_index("ix_shop_rewards_user_id", "shop_rewards", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_shop_rewards_user_id", table_name="shop_rewards")
    op.drop_table("shop_rewards")
