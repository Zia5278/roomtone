from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from roomtone_api.models import AppSession, User


class SessionRepository:
    def __init__(self, database_session: AsyncSession) -> None:
        self.database_session = database_session

    async def create(
        self,
        *,
        user_id: UUID,
        display_name: str,
        avatar_color: str,
        token_hash: str,
        expires_at: datetime,
    ) -> User:
        user = User(
            id=user_id,
            display_name=display_name,
            avatar_color=avatar_color,
        )
        application_session = AppSession(
            user=user,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self.database_session.add_all((user, application_session))
        await self.database_session.commit()
        return user

    async def find_active_user(self, *, token_hash: str, now: datetime) -> User | None:
        statement = (
            select(User)
            .join(AppSession)
            .where(
                AppSession.token_hash == token_hash,
                AppSession.expires_at > now,
            )
        )
        return await self.database_session.scalar(statement)
