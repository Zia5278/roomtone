from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
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
    session_cookie_name: str = "roomtone_session"
    session_ttl_days: int = Field(default=7, ge=1, le=30)
    cookie_secure: bool = False
    stream_api_key: str = ""
    stream_api_secret: SecretStr = SecretStr("")
    stream_token_ttl_seconds: int = Field(default=3600, ge=300, le=86400)

    @property
    def stream_is_configured(self) -> bool:
        return bool(self.stream_api_key and self.stream_api_secret.get_secret_value())


@lru_cache
def get_settings() -> Settings:
    return Settings()
