"""add playtest support

Revision ID: a1b2c3d4e5f6
Revises: 896d92c79979
Create Date: 2026-11-13 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '896d92c79979'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Make competition_id and group_id nullable on game_sessions (for playtest sessions)
    with op.batch_alter_table('game_sessions', schema=None) as batch_op:
        batch_op.alter_column('competition_id', existing_type=sa.Integer(), nullable=True)
        batch_op.alter_column('group_id', existing_type=sa.Integer(), nullable=True)
        batch_op.add_column(sa.Column('puzzle_set_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('player_name', sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column('playtest_token_hash', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('playtest_csrf_token_hash', sa.String(length=64), nullable=True))
        batch_op.create_foreign_key(
            'fk_game_sessions_puzzle_set_id',
            'puzzle_sets',
            ['puzzle_set_id'],
            ['id'],
        )

    # Create playtest_links table for shareable puzzle links
    op.create_table(
        'playtest_links',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('teacher_id', sa.Integer(), nullable=False),
        sa.Column('puzzle_set_id', sa.Integer(), nullable=False),
        sa.Column('share_code', sa.String(length=20), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['teacher_id'], ['teachers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['puzzle_set_id'], ['puzzle_sets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('share_code', name='uq_playtest_link_share_code'),
    )
    op.create_index('ix_playtest_links_teacher_id', 'playtest_links', ['teacher_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_playtest_links_teacher_id', table_name='playtest_links')
    op.drop_table('playtest_links')

    with op.batch_alter_table('game_sessions', schema=None) as batch_op:
        batch_op.drop_constraint('fk_game_sessions_puzzle_set_id', type_='foreignkey')
        batch_op.drop_column('playtest_csrf_token_hash')
        batch_op.drop_column('playtest_token_hash')
        batch_op.drop_column('player_name')
        batch_op.drop_column('puzzle_set_id')
        batch_op.alter_column('group_id', existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column('competition_id', existing_type=sa.Integer(), nullable=False)
