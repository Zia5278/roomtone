from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast
from uuid import UUID, uuid4

import pytest
from getstream import AsyncStream
from getstream.models import CallRequest, UserRequest

from roomtone_api.config import Settings
from roomtone_api.gateways.stream import StreamGateway
from roomtone_api.models import Room, User
from roomtone_api.repositories.room import RoomRepository
from roomtone_api.schemas.room import CreateRoomRequest
from roomtone_api.services.room import (
    RoomAuthorizationError,
    RoomService,
    RoomStateError,
)


class FakeRoomRepository:
    def __init__(self, room: Room | None = None, *, fail_create: bool = False) -> None:
        self.room = room
        self.fail_create = fail_create
        self.mark_live_calls = 0

    async def create(self, room: Room) -> Room:
        if self.fail_create:
            raise RuntimeError("database unavailable")
        self.room = room
        return room

    async def get(self, room_id: UUID) -> Room | None:
        if self.room is not None and self.room.id == room_id:
            return self.room
        return None

    async def mark_live(self, room: Room) -> Room:
        self.mark_live_calls += 1
        room.status = "live"
        room.went_live_at = datetime.now(UTC)
        return room


class FakeStreamGateway:
    def __init__(self) -> None:
        self.created_room: tuple[str, str, UUID] | None = None
        self.deleted_room_id: str | None = None
        self.go_live_calls: list[str] = []

    async def create_audio_room(self, *, room_id: str, title: str, host: User) -> None:
        self.created_room = (room_id, title, host.id)

    async def delete_audio_room(self, *, room_id: str) -> None:
        self.deleted_room_id = room_id

    async def go_live(self, *, room_id: str) -> None:
        self.go_live_calls.append(room_id)


class FakeStreamCall:
    def __init__(self) -> None:
        self.data: CallRequest | None = None

    async def get_or_create(self, *, data: CallRequest) -> SimpleNamespace:
        self.data = data
        host_member = data.members[0]
        return SimpleNamespace(
            data=SimpleNamespace(
                call=SimpleNamespace(backstage=True),
                members=[SimpleNamespace(user_id=host_member.user_id, role=host_member.role)],
            )
        )


class FakeStreamVideo:
    def __init__(self, call: FakeStreamCall) -> None:
        self.stream_call = call
        self.call_type: str | None = None
        self.call_id: str | None = None

    def call(self, call_type: str, call_id: str) -> FakeStreamCall:
        self.call_type = call_type
        self.call_id = call_id
        return self.stream_call


class FakeStreamClient:
    def __init__(self) -> None:
        self.stream_call = FakeStreamCall()
        self.video = FakeStreamVideo(self.stream_call)
        self.upserted_user: UserRequest | None = None

    async def upsert_users(self, user: UserRequest) -> None:
        self.upserted_user = user


def make_user(*, display_name: str) -> User:
    return User(
        id=uuid4(),
        display_name=display_name,
        avatar_color="coral",
    )


def make_room(*, host: User, status: str = "backstage") -> Room:
    return Room(
        id=uuid4(),
        title="Engineering after hours",
        host_user_id=host.id,
        host=host,
        status=status,
    )


def make_service(
    repository: FakeRoomRepository,
    gateway: FakeStreamGateway,
) -> RoomService:
    return RoomService(
        cast(RoomRepository, repository),
        cast(StreamGateway, gateway),
    )


def test_room_title_is_normalized_before_validation() -> None:
    request = CreateRoomRequest(title="  Engineering   after hours  ")
    assert request.title == "Engineering after hours"


@pytest.mark.anyio
async def test_create_room_uses_one_id_for_postgres_and_stream() -> None:
    host = make_user(display_name="Host")
    repository = FakeRoomRepository()
    gateway = FakeStreamGateway()
    service = make_service(repository, gateway)

    room = await service.create(title="Engineering after hours", host=host)

    assert room.status == "backstage"
    assert room.host_user_id == host.id
    assert gateway.created_room == (str(room.id), room.title, host.id)


@pytest.mark.anyio
async def test_create_room_cleans_up_stream_when_postgres_fails() -> None:
    host = make_user(display_name="Host")
    repository = FakeRoomRepository(fail_create=True)
    gateway = FakeStreamGateway()
    service = make_service(repository, gateway)

    with pytest.raises(RuntimeError, match="database unavailable"):
        await service.create(title="Engineering after hours", host=host)

    assert gateway.created_room is not None
    assert gateway.deleted_room_id == gateway.created_room[0]


@pytest.mark.anyio
async def test_guest_cannot_move_a_room_live() -> None:
    host = make_user(display_name="Host")
    guest = make_user(display_name="Guest")
    room = make_room(host=host)
    repository = FakeRoomRepository(room)
    gateway = FakeStreamGateway()
    service = make_service(repository, gateway)

    with pytest.raises(RoomAuthorizationError):
        await service.go_live(room_id=room.id, current_user=guest)

    assert gateway.go_live_calls == []
    assert repository.mark_live_calls == 0


@pytest.mark.anyio
async def test_go_live_is_idempotent() -> None:
    host = make_user(display_name="Host")
    room = make_room(host=host)
    repository = FakeRoomRepository(room)
    gateway = FakeStreamGateway()
    service = make_service(repository, gateway)

    first_result = await service.go_live(room_id=room.id, current_user=host)
    second_result = await service.go_live(room_id=room.id, current_user=host)

    assert first_result.status == "live"
    assert second_result.status == "live"
    assert gateway.go_live_calls == [str(room.id)]
    assert repository.mark_live_calls == 1


@pytest.mark.anyio
async def test_ended_room_cannot_go_live_again() -> None:
    host = make_user(display_name="Host")
    room = make_room(host=host, status="ended")
    repository = FakeRoomRepository(room)
    gateway = FakeStreamGateway()
    service = make_service(repository, gateway)

    with pytest.raises(RoomStateError):
        await service.go_live(room_id=room.id, current_user=host)


@pytest.mark.anyio
async def test_stream_gateway_assigns_the_authoritative_host_role() -> None:
    host = make_user(display_name="Host")
    fake_client = FakeStreamClient()
    settings = Settings(
        _env_file=None,
        stream_api_key="public-stream-key",
        stream_api_secret="server-only-secret",
    )
    gateway = StreamGateway(
        settings,
        client=cast(AsyncStream, fake_client),
    )
    room_id = str(uuid4())

    await gateway.create_audio_room(
        room_id=room_id,
        title="Engineering after hours",
        host=host,
    )

    assert fake_client.video.call_type == "audio_room"
    assert fake_client.video.call_id == room_id
    assert fake_client.stream_call.data is not None
    assert fake_client.stream_call.data.created_by_id == str(host.id)
    assert fake_client.stream_call.data.members is not None
    assert fake_client.stream_call.data.members[0].user_id == str(host.id)
    assert fake_client.stream_call.data.members[0].role == "host"
