from uuid import UUID, uuid4

from roomtone_api.gateways.stream import StreamGateway
from roomtone_api.models import Room, User
from roomtone_api.repositories.room import RoomRepository


class RoomNotFoundError(LookupError):
    pass


class RoomAuthorizationError(PermissionError):
    pass


class RoomStateError(RuntimeError):
    pass


class RoomService:
    def __init__(
        self,
        repository: RoomRepository,
        stream_gateway: StreamGateway,
    ) -> None:
        self.repository = repository
        self.stream_gateway = stream_gateway

    async def create(self, *, title: str, host: User) -> Room:
        room = Room(
            id=uuid4(),
            title=title,
            host_user_id=host.id,
            host=host,
            status="backstage",
        )
        await self.stream_gateway.create_audio_room(
            room_id=str(room.id),
            title=room.title,
            host=host,
        )

        try:
            return await self.repository.create(room)
        except Exception as persistence_error:
            try:
                await self.stream_gateway.delete_audio_room(room_id=str(room.id))
            except Exception as cleanup_error:
                raise ExceptionGroup(
                    "Room persistence and Stream cleanup both failed.",
                    [persistence_error, cleanup_error],
                ) from persistence_error
            raise

    async def get(self, room_id: UUID) -> Room:
        room = await self.repository.get(room_id)
        if room is None:
            raise RoomNotFoundError
        return room

    async def go_live(self, *, room_id: UUID, current_user: User) -> Room:
        room = await self.get(room_id)
        if room.host_user_id != current_user.id:
            raise RoomAuthorizationError
        if room.status == "ended":
            raise RoomStateError
        if room.status == "live":
            return room

        await self.stream_gateway.go_live(room_id=str(room.id))
        return await self.repository.mark_live(room)
