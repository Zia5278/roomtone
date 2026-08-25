from collections.abc import AsyncIterator, Iterator
from typing import cast
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from roomtone_api import dependencies as dependencies_module
from roomtone_api.api import sessions as sessions_api
from roomtone_api.config import get_settings
from roomtone_api.dependencies import get_database_session
from roomtone_api.main import app
from roomtone_api.models import User
from roomtone_api.schemas.session import CreateSessionRequest
from roomtone_api.services.session import CreatedSession, hash_session_token


class FakeSessionService:
    def __init__(self) -> None:
        self.user = User(
            id=uuid4(),
            display_name="Zia Haq",
            avatar_color="coral",
        )

    async def create(self, *, display_name: str) -> CreatedSession:
        assert display_name == "Zia Haq"
        return CreatedSession(raw_token="test-session-token", user=self.user)

    async def resolve_user(self, *, raw_token: str) -> User | None:
        assert raw_token == "test-session-token"
        return self.user


async def override_database_session() -> AsyncIterator[AsyncSession]:
    yield cast(AsyncSession, object())


@pytest.fixture
def fake_session_service(monkeypatch: pytest.MonkeyPatch) -> FakeSessionService:
    service = FakeSessionService()
    app.dependency_overrides[get_database_session] = override_database_session
    monkeypatch.setattr(sessions_api, "create_session_service", lambda _: service)
    monkeypatch.setattr(dependencies_module, "SessionService", lambda *_args, **_kwargs: service)
    return service


@pytest.fixture(autouse=True)
def clear_dependency_overrides() -> Iterator[None]:
    yield
    app.dependency_overrides.clear()


def test_display_name_is_normalized_before_validation() -> None:
    request = CreateSessionRequest(display_name="  Zia   Haq  ")
    assert request.display_name == "Zia Haq"

    with pytest.raises(ValidationError):
        CreateSessionRequest(display_name=" x ")


def test_session_token_is_hashed_deterministically() -> None:
    first_hash = hash_session_token("raw-session-token")
    second_hash = hash_session_token("raw-session-token")

    assert first_hash == second_hash
    assert first_hash != "raw-session-token"
    assert len(first_hash) == 64


@pytest.mark.anyio
async def test_create_session_sets_an_http_only_cookie(
    fake_session_service: FakeSessionService,
) -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/v1/sessions",
            json={"display_name": "  Zia   Haq  "},
        )

    assert response.status_code == 201
    assert response.json()["user"] == {
        "id": str(fake_session_service.user.id),
        "display_name": "Zia Haq",
        "avatar_color": "coral",
    }
    cookie = response.headers["set-cookie"]
    assert f"{get_settings().session_cookie_name}=test-session-token" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Path=/" in cookie


@pytest.mark.anyio
async def test_current_session_restores_the_cookie_user(
    fake_session_service: FakeSessionService,
) -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={get_settings().session_cookie_name: "test-session-token"},
    ) as client:
        response = await client.get("/v1/sessions/me")

    assert response.status_code == 200
    assert response.json()["user"]["id"] == str(fake_session_service.user.id)


@pytest.mark.anyio
async def test_current_session_rejects_a_missing_cookie(
    fake_session_service: FakeSessionService,
) -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/v1/sessions/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "No active session."}
