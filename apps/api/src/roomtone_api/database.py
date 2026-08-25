from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from roomtone_api.config import get_settings


class Base(DeclarativeBase):
    """Base class whose metadata Alembic uses for migrations."""


def create_database_engine() -> AsyncEngine:
    """Create the shared async PostgreSQL engine when the app needs it."""
    return create_async_engine(get_settings().database_url, pool_pre_ping=True)


def create_database_session_factory(
    engine: AsyncEngine,
) -> async_sessionmaker[AsyncSession]:
    """Create request-scoped sessions backed by the shared engine."""
    return async_sessionmaker(engine, expire_on_commit=False)
