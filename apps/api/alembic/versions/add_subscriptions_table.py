"""add subscriptions table

Revision ID: b7c8d9e0f1a2
Revises: 2f0f06807e03
Create Date: 2026-04-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "b7c8d9e0f1a2"
down_revision: Union[str, None] = "2f0f06807e03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column("stripe_customer_id", sa.String(), unique=True, nullable=True),
        sa.Column("stripe_subscription_id", sa.String(), unique=True, nullable=True),
        sa.Column(
            "plan",
            sa.String(),
            nullable=False,
            server_default="free",
        ),
        sa.Column(
            "status",
            sa.String(),
            nullable=False,
            server_default="active",
        ),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("plan IN ('free', 'pro')", name="ck_subscription_plan"),
        sa.CheckConstraint(
            "status IN ('active', 'canceled', 'past_due')",
            name="ck_subscription_status",
        ),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_subscriptions_user_id", table_name="subscriptions")
    op.drop_table("subscriptions")
