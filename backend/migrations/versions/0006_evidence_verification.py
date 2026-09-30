"""evidence verification

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-30
"""
from alembic import op
import sqlalchemy as sa


revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('evidence', schema=None) as batch_op:
        batch_op.add_column(sa.Column('status', sa.String(length=20), nullable=False, server_default='unverified'))
        batch_op.add_column(sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('method', sa.String(length=200), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('evidence', schema=None) as batch_op:
        batch_op.drop_column('method')
        batch_op.drop_column('verified_at')
        batch_op.drop_column('status')
