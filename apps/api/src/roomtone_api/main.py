from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from roomtone_api import __version__
from roomtone_api.api.health import router as health_router
from roomtone_api.config import get_settings
from roomtone_api.database import create_database_engine


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    """Own infrastructure that should live exactly as long as the API process."""
    database_engine = create_database_engine()
    application.state.database_engine = database_engine

    try:
        yield
    finally:
        await database_engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version=__version__,
        description="Identity, room lifecycle, and Stream token API for RoomTone.",
        lifespan=lifespan,
    )
    application.include_router(health_router)
    return application


app = create_app()
