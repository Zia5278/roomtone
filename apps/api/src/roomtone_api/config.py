from functools import lru_cache
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Server-only configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=("../../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "RoomTone API"
    app_environment: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+psycopg://roomtone:roomtone@localhost:5432/roomtone"
    web_origin: str = "http://localhost:3000"
    stream_api_key: str = ""
    stream_api_secret: SecretStr = SecretStr("")


@lru_cache
def get_settings() -> Settings:
    return Settings()
