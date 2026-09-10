from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    ai_enabled: bool = False
    ai_requests_per_user_per_minute: int = Field(default=10, ge=1, le=120)
    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-3.5-flash-lite"
    gemini_timeout_seconds: float = Field(default=10.0, gt=0, le=60)
    gemini_max_output_tokens: int = Field(default=1024, ge=64, le=8192)
    gemini_max_retries: int = Field(default=1, ge=0, le=2)
    upload_dir: Path = Path(__file__).resolve().parents[1] / "uploads"
    avatar_max_bytes: int = 2 * 1024 * 1024
    media_url_path: str = "/media"

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
