import pytest
from pydantic import ValidationError

from app.config import Settings


def settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "database_url": "postgresql+psycopg://chrono:chrono@database/chrono",
        "jwt_secret_key": "a-secure-signing-key-with-more-than-32-characters",
        "_env_file": None,
    }
    values.update(overrides)
    return Settings(**values)


def test_cors_origins_are_normalized_from_comma_separated_config() -> None:
    configured = settings(
        cors_origins="https://app.chrono.example/, https://preview.chrono.example",
    )

    assert configured.cors_origin_list == [
        "https://app.chrono.example",
        "https://preview.chrono.example",
    ]


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"cors_origins": ""}, "CORS_ORIGINS"),
        ({"jwt_secret_key": "too-short"}, "at least 32 characters"),
        (
            {"jwt_secret_key": "replace-with-at-least-32-random-characters"},
            "must be replaced",
        ),
    ],
)
def test_production_rejects_unsafe_configuration(
    overrides: dict[str, object],
    message: str,
) -> None:
    with pytest.raises(ValidationError, match=message):
        settings(app_environment="production", **overrides)
