"""drop zombie columns vitality current_streak best_streak

Revision ID: 54c2246897ae
Revises: b791b5f8c525
Create Date: 2026-03-16
"""

from alembic import op

revision = "54c2246897ae"
down_revision = "b791b5f8c525"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("goals", "vitality")
    op.drop_column("goals", "current_streak")
    op.drop_column("goals", "best_streak")


def downgrade() -> None:
    import sqlalchemy as sa

    op.add_column("goals", sa.Column("best_streak", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("goals", sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("goals", sa.Column("vitality", sa.Integer(), nullable=False, server_default="50"))
