from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    app_environment: Literal["development", "test", "staging", "production"] = "development"
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    cors_allow_origin_regex: str | None = r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"
    ai_enabled: bool = True
    ai_requests_per_user_per_minute: int = Field(default=10, ge=1, le=120)
    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-3.5-flash-lite"
    gemini_timeout_seconds: float = Field(default=10.0, gt=0, le=60)
    gemini_max_output_tokens: int = Field(default=1024, ge=64, le=8192)
    gemini_max_retries: int = Field(default=1, ge=0, le=2)
    upload_dir: Path = Path(__file__).resolve().parents[1] / "uploads"
    avatar_max_bytes: int = 2 * 1024 * 1024
    media_url_path: str = "/media"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_deployment_settings(self) -> "Settings":
        if self.app_environment in {"staging", "production"}:
            if not self.cors_origin_list:
                raise ValueError("CORS_ORIGINS must contain the deployed frontend origin")
            if self.jwt_secret_key in {
                "replace-with-a-random-secret",
                "replace-with-at-least-32-random-characters",
            }:
                raise ValueError("JWT_SECRET_KEY must be replaced for staging and production")
            if len(self.jwt_secret_key) < 32:
                raise ValueError("JWT_SECRET_KEY must contain at least 32 characters")

        return self

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
