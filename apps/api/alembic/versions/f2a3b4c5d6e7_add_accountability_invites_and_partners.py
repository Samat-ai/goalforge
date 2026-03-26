"""add accountability invites and partnerships

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-03-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "accountability_invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("inviter_user_id", sa.String(), nullable=False),
        sa.Column("invitee_user_id", sa.String(), nullable=True),
        sa.Column("target_email", sa.String(length=320), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["inviter_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invitee_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'declined')",
            name="ck_accountability_invite_status",
        ),
    )
    op.create_index(
        "ix_accountability_invites_target_email",
        "accountability_invites",
        ["target_email"],
    )
    op.create_index(
        "ix_accountability_invites_inviter_status",
        "accountability_invites",
        ["inviter_user_id", "status"],
    )
    op.create_index(
        "ix_accountability_invites_invitee_status",
        "accountability_invites",
        ["invitee_user_id", "status"],
    )

    op.create_table(
        "accountability_partnerships",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("partner_user_id", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["partner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "partner_user_id",
            name="uq_accountability_partnership_pair",
        ),
        sa.CheckConstraint("user_id <> partner_user_id", name="ck_accountability_partners_not_self"),
    )
    op.create_index(
        "ix_accountability_partnerships_user_id",
        "accountability_partnerships",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_accountability_partnerships_user_id", table_name="accountability_partnerships")
    op.drop_table("accountability_partnerships")

    op.drop_index("ix_accountability_invites_invitee_status", table_name="accountability_invites")
    op.drop_index("ix_accountability_invites_inviter_status", table_name="accountability_invites")
    op.drop_index("ix_accountability_invites_target_email", table_name="accountability_invites")
    op.drop_table("accountability_invites")
