from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from roomtone_api.config import get_settings


class Base(DeclarativeBase):
    """Base class whose metadata Alembic uses for migrations."""


def create_database_engine() -> AsyncEngine:
    """Create the shared async PostgreSQL engine when the app needs it."""
    return create_async_engine(get_settings().database_url, pool_pre_ping=True)
