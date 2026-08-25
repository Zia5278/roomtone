from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from getstream import StreamException

from roomtone_api.dependencies import (
    CurrentUser,
    DatabaseSession,
    StreamGatewayDependency,
)
from roomtone_api.gateways.stream import StreamConfigurationError
from roomtone_api.models import Room, User
from roomtone_api.repositories.room import RoomRepository
from roomtone_api.schemas.room import CreateRoomRequest, RoomResponse
from roomtone_api.schemas.session import UserResponse
from roomtone_api.services.room import (
    RoomAuthorizationError,
    RoomNotFoundError,
    RoomService,
    RoomStateError,
)

router = APIRouter(prefix="/v1/rooms", tags=["rooms"])


def create_room_service(
    database_session: DatabaseSession,
    stream_gateway: StreamGatewayDependency,
) -> RoomService:
    return RoomService(RoomRepository(database_session), stream_gateway)


def room_response(room: Room, current_user: User) -> RoomResponse:
    return RoomResponse(
        id=room.id,
        title=room.title,
        status=room.status,
        host=UserResponse.model_validate(room.host),
        is_host=room.host_user_id == current_user.id,
        created_at=room.created_at,
        went_live_at=room.went_live_at,
        ended_at=room.ended_at,
    )


def raise_room_http_error(error: Exception) -> None:
    if isinstance(error, RoomNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found.",
        ) from error
    if isinstance(error, RoomAuthorizationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the host can perform this action.",
        ) from error
    if isinstance(error, RoomStateError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This room has already ended.",
        ) from error
    if isinstance(error, (StreamException, StreamConfigurationError)):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The realtime room service is temporarily unavailable.",
        ) from error
    raise error


@router.post("", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(
    payload: CreateRoomRequest,
    current_user: CurrentUser,
    database_session: DatabaseSession,
    stream_gateway: StreamGatewayDependency,
) -> RoomResponse:
    service = create_room_service(database_session, stream_gateway)
    try:
        room = await service.create(title=payload.title, host=current_user)
    except Exception as error:
        raise_room_http_error(error)
        raise
    return room_response(room, current_user)


@router.get("/{room_id}", response_model=RoomResponse)
async def get_room(
    room_id: UUID,
    current_user: CurrentUser,
    database_session: DatabaseSession,
    stream_gateway: StreamGatewayDependency,
) -> RoomResponse:
    service = create_room_service(database_session, stream_gateway)
    try:
        room = await service.get(room_id)
    except Exception as error:
        raise_room_http_error(error)
        raise
    return room_response(room, current_user)


@router.post("/{room_id}/live", response_model=RoomResponse)
async def go_live(
    room_id: UUID,
    current_user: CurrentUser,
    database_session: DatabaseSession,
    stream_gateway: StreamGatewayDependency,
) -> RoomResponse:
    service = create_room_service(database_session, stream_gateway)
    try:
        room = await service.go_live(room_id=room_id, current_user=current_user)
    except Exception as error:
        raise_room_http_error(error)
        raise
    return room_response(room, current_user)
