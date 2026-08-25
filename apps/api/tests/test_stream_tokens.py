from collections.abc import AsyncIterator, Iterator
from typing import cast
from uuid import uuid4

import pytest
from getstream import AsyncStream
from getstream.models import UserRequest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from roomtone_api.config import Settings
from roomtone_api.dependencies import get_current_user, get_database_session
from roomtone_api.gateways.stream import StreamGateway
from roomtone_api.main import app
from roomtone_api.models import User


class FakeStreamClient:
    def __init__(self) -> None:
        self.upserted_user: UserRequest | None = None
        self.token_user_id: str | None = None
        self.token_expiration: int | None = None

    async def upsert_users(self, user: UserRequest) -> None:
        self.upserted_user = user

    def create_token(self, *, user_id: str, expiration: int) -> str:
        self.token_user_id = user_id
        self.token_expiration = expiration
        return "test-stream-token"

    async def aclose(self) -> None:
        pass


class FakeStreamGateway:
    api_key = "public-stream-key"
    token_ttl_seconds = 3600

    async def upsert_user_and_create_token(self, user: User) -> str:
        assert user.display_name == "Zia Haq"
        return "test-stream-token"


async def override_database_session() -> AsyncIterator[AsyncSession]:
    yield cast(AsyncSession, object())


@pytest.fixture
def current_user() -> User:
    return User(
        id=uuid4(),
        display_name="Zia Haq",
        avatar_color="coral",
    )


@pytest.fixture(autouse=True)
def configure_app(current_user: User) -> Iterator[None]:
    async def override_current_user() -> User:
        return current_user

    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[get_current_user] = override_current_user
    app.state.stream_gateway = FakeStreamGateway()
    yield
    app.dependency_overrides.clear()
    app.state.stream_gateway = None


@pytest.mark.anyio
async def test_stream_gateway_upserts_the_same_user_before_minting_a_token(
    current_user: User,
) -> None:
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

    token = await gateway.upsert_user_and_create_token(current_user)

    assert token == "test-stream-token"
    assert fake_client.upserted_user is not None
    assert fake_client.upserted_user.id == str(current_user.id)
    assert fake_client.upserted_user.name == current_user.display_name
    assert fake_client.upserted_user.custom == {"avatar_color": "coral"}
    assert fake_client.token_user_id == str(current_user.id)
    assert fake_client.token_expiration == 3600


@pytest.mark.anyio
async def test_stream_token_endpoint_returns_browser_safe_credentials(
    current_user: User,
) -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post("/v1/stream-token")

    assert response.status_code == 200
    assert response.json() == {
        "api_key": "public-stream-key",
        "token": "test-stream-token",
        "expires_in": 3600,
        "user": {
            "id": str(current_user.id),
            "display_name": "Zia Haq",
            "avatar_color": "coral",
        },
    }


@pytest.mark.anyio
async def test_stream_token_endpoint_reports_missing_configuration() -> None:
    app.state.stream_gateway = None

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post("/v1/stream-token")

    assert response.status_code == 503
    assert response.json() == {"detail": "Stream is not configured."}
