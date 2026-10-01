"""user auth: name, password hash, sessions (#32)

Revision ID: 0007
Revises: 855d14dfed73
Create Date: 2026-10-01
"""
from alembic import op
import sqlalchemy as sa


revision = '0007'
down_revision = '855d14dfed73'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('name', sa.String(length=80), nullable=False, server_default=''))
        batch_op.add_column(sa.Column('password_hash', sa.String(length=255), nullable=True))

    op.create_table(
        'user_session',
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('user_id', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('token_hash'),
    )
    with op.batch_alter_table('user_session', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_user_session_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('user_session', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_user_session_user_id'))
    op.drop_table('user_session')
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('password_hash')
        batch_op.drop_column('name')
