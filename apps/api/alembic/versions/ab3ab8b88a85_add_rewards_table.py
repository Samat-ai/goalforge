"""add rewards table

Revision ID: ab3ab8b88a85
Revises: 749ac4eda4cf
Create Date: 2026-03-23 23:44:52.534229

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'ab3ab8b88a85'
down_revision: Union[str, None] = '749ac4eda4cf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "rewards",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("reward_type", sa.String(10), nullable=False),
        sa.Column("reward_key", sa.String(60), nullable=False),
        sa.Column("is_equipped", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "acquired_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "reward_key", name="uq_rewards_user_key"),
        sa.CheckConstraint(
            "reward_type IN ('theme', 'title', 'lore')", name="ck_rewards_type"
        ),
    )
    op.create_index("ix_rewards_user_id", "rewards", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_rewards_user_id", table_name="rewards")
    op.drop_table("rewards")
