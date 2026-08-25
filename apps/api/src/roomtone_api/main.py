from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from roomtone_api import __version__
from roomtone_api.api.health import router as health_router
from roomtone_api.api.rooms import router as rooms_router
from roomtone_api.api.sessions import router as sessions_router
from roomtone_api.api.stream_tokens import router as stream_tokens_router
from roomtone_api.config import get_settings
from roomtone_api.database import create_database_engine, create_database_session_factory
from roomtone_api.gateways.stream import StreamGateway


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    """Own infrastructure that should live exactly as long as the API process."""
    settings = get_settings()
    database_engine = create_database_engine()
    stream_gateway = StreamGateway(settings) if settings.stream_is_configured else None
    application.state.database_engine = database_engine
    application.state.database_session_factory = create_database_session_factory(database_engine)
    application.state.stream_gateway = stream_gateway

    try:
        yield
    finally:
        if stream_gateway is not None:
            await stream_gateway.close()
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
    application.include_router(sessions_router)
    application.include_router(stream_tokens_router)
    application.include_router(rooms_router)
    return application


app = create_app()
