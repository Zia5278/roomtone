import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from roomtone_api.models import User
from roomtone_api.repositories.session import SessionRepository
from roomtone_api.schemas.session import AvatarColor

AVATAR_COLORS: tuple[AvatarColor, ...] = (
    "coral",
    "blue",
    "green",
    "purple",
    "gold",
)


def hash_session_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class CreatedSession:
    raw_token: str
    user: User


class SessionService:
    def __init__(self, repository: SessionRepository, *, ttl_days: int) -> None:
        self.repository = repository
        self.ttl = timedelta(days=ttl_days)

    async def create(self, *, display_name: str) -> CreatedSession:
        user_id = uuid4()
        raw_token = secrets.token_urlsafe(32)
        now = datetime.now(UTC)
        avatar_color = AVATAR_COLORS[user_id.int % len(AVATAR_COLORS)]
        user = await self.repository.create(
            user_id=user_id,
            display_name=display_name,
            avatar_color=avatar_color,
            token_hash=hash_session_token(raw_token),
            expires_at=now + self.ttl,
        )
        return CreatedSession(raw_token=raw_token, user=user)

    async def resolve_user(self, *, raw_token: str) -> User | None:
        return await self.repository.find_active_user(
            token_hash=hash_session_token(raw_token),
            now=datetime.now(UTC),
        )
