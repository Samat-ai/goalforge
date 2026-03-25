"""add accountability partners table

Revision ID: a9b8c7d6e5f4
Revises: ab3ab8b88a85
Create Date: 2026-03-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a9b8c7d6e5f4"
down_revision: Union[str, None] = "ab3ab8b88a85"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "accountability_partners",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("partner_user_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["partner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "partner_user_id", name="uq_partner_pair"),
        sa.CheckConstraint("status IN ('pending', 'accepted')", name="ck_partner_status"),
    )
    op.create_index("ix_partner_user", "accountability_partners", ["user_id"])
    op.create_index("ix_partner_partner_user", "accountability_partners", ["partner_user_id"])


def downgrade() -> None:
    op.drop_index("ix_partner_partner_user", table_name="accountability_partners")
    op.drop_index("ix_partner_user", table_name="accountability_partners")
    op.drop_table("accountability_partners")
