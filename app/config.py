from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    jwt_secret: str = Field(min_length=32)
    database_url: str = "sqlite:///./data/blog.db"
    cors_origins: list[str] = []
    access_token_minutes: int = Field(default=60, ge=5, le=1440)
    openapi_enabled: bool = True
    upload_dir: Path = Path("data/uploads")

    @field_validator("jwt_secret")
    @classmethod
    def valid_secret(cls, value: str) -> str:
        if value.lower().startswith(("change", "your", "example")) or len(set(value)) < 12:
            raise ValueError("JWT_SECRET must be a randomly generated secret")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
