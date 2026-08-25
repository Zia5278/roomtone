from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from roomtone_api.models import Room


class RoomRepository:
    def __init__(self, database_session: AsyncSession) -> None:
        self.database_session = database_session

    async def create(self, room: Room) -> Room:
        self.database_session.add(room)
        await self.database_session.commit()
        await self.database_session.refresh(room)
        return room

    async def get(self, room_id: UUID) -> Room | None:
        statement = select(Room).options(selectinload(Room.host)).where(Room.id == room_id)
        return await self.database_session.scalar(statement)

    async def mark_live(self, room: Room) -> Room:
        room.status = "live"
        room.went_live_at = datetime.now(UTC)
        await self.database_session.commit()
        await self.database_session.refresh(room)
        return room
