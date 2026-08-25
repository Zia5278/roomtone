from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from roomtone_api.config import get_settings
from roomtone_api.gateways.stream import StreamGateway
from roomtone_api.models import User
from roomtone_api.repositories.session import SessionRepository
from roomtone_api.services.session import SessionService


async def get_database_session(request: Request) -> AsyncIterator[AsyncSession]:
    """Give one database session to a request and always close it afterward."""
    factory: async_sessionmaker[AsyncSession] = request.app.state.database_session_factory

    async with factory() as database_session:
        try:
            yield database_session
        except Exception:
            await database_session.rollback()
            raise


DatabaseSession = Annotated[AsyncSession, Depends(get_database_session)]


async def get_current_user(
    request: Request,
    database_session: DatabaseSession,
) -> User:
    settings = get_settings()
    raw_token = request.cookies.get(settings.session_cookie_name)
    if raw_token:
        service = SessionService(
            SessionRepository(database_session),
            ttl_days=settings.session_ttl_days,
        )
        user = await service.resolve_user(raw_token=raw_token)
        if user is not None:
            return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No active session.",
    )


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_stream_gateway(request: Request) -> StreamGateway:
    gateway: StreamGateway | None = request.app.state.stream_gateway
    if gateway is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stream is not configured.",
        )
    return gateway


StreamGatewayDependency = Annotated[StreamGateway, Depends(get_stream_gateway)]
