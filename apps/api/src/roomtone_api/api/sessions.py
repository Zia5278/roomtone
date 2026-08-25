from fastapi import APIRouter, Response, status

from roomtone_api.config import get_settings
from roomtone_api.dependencies import CurrentUser, DatabaseSession
from roomtone_api.repositories.session import SessionRepository
from roomtone_api.schemas.session import CreateSessionRequest, SessionResponse, UserResponse
from roomtone_api.services.session import SessionService

router = APIRouter(prefix="/v1/sessions", tags=["sessions"])


def create_session_service(database_session: DatabaseSession) -> SessionService:
    settings = get_settings()
    return SessionService(
        SessionRepository(database_session),
        ttl_days=settings.session_ttl_days,
    )


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: CreateSessionRequest,
    response: Response,
    database_session: DatabaseSession,
) -> SessionResponse:
    settings = get_settings()
    session_service = create_session_service(database_session)
    created_session = await session_service.create(display_name=payload.display_name)

    response.set_cookie(
        key=settings.session_cookie_name,
        value=created_session.raw_token,
        max_age=settings.session_ttl_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    return SessionResponse(user=UserResponse.model_validate(created_session.user))


@router.get("/me", response_model=SessionResponse)
async def get_current_session(
    current_user: CurrentUser,
) -> SessionResponse:
    return SessionResponse(user=UserResponse.model_validate(current_user))
