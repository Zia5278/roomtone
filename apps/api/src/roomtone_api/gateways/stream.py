from getstream import AsyncStream
from getstream.models import CallRequest, MemberRequest, UserRequest

from roomtone_api.config import Settings
from roomtone_api.models import User


class StreamGateway:
    """Keep Stream SDK details out of HTTP routes and application services."""

    def __init__(self, settings: Settings, *, client: AsyncStream | None = None) -> None:
        self.api_key = settings.stream_api_key
        self.token_ttl_seconds = settings.stream_token_ttl_seconds
        self.client = client or AsyncStream(
            api_key=settings.stream_api_key,
            api_secret=settings.stream_api_secret.get_secret_value(),
        )

    async def upsert_user(self, user: User) -> None:
        await self.client.upsert_users(
            UserRequest(
                id=str(user.id),
                name=user.display_name,
                role="user",
                custom={"avatar_color": user.avatar_color},
            )
        )

    async def upsert_user_and_create_token(self, user: User) -> str:
        await self.upsert_user(user)
        return self.client.create_token(
            user_id=str(user.id),
            expiration=self.token_ttl_seconds,
        )

    async def create_audio_room(self, *, room_id: str, title: str, host: User) -> None:
        await self.upsert_user(host)
        response = await self.client.video.call("audio_room", room_id).get_or_create(
            data=CallRequest(
                created_by_id=str(host.id),
                members=[MemberRequest(user_id=str(host.id), role="host")],
                custom={"title": title},
            )
        )

        host_member = next(
            (member for member in response.data.members if member.user_id == str(host.id)),
            None,
        )
        if not response.data.call.backstage or host_member is None or host_member.role != "host":
            raise StreamConfigurationError(
                "The audio_room call type does not match RoomTone's required defaults."
            )

    async def go_live(self, *, room_id: str) -> None:
        await self.client.video.call("audio_room", room_id).go_live()

    async def delete_audio_room(self, *, room_id: str) -> None:
        await self.client.video.call("audio_room", room_id).delete(hard=True)

    async def close(self) -> None:
        await self.client.aclose()


class StreamConfigurationError(RuntimeError):
    """Raised when dashboard behavior no longer matches RoomTone's assumptions."""
