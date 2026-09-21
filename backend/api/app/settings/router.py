from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.auth.dependencies import CurrentUser, DatabaseSession
from app.settings import service
from app.settings.schemas import UserSettingsResponse, UserSettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


class DetectedTimezone(BaseModel):
    timezone: str


@router.get("", response_model=UserSettingsResponse)
def get_settings(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> UserSettingsResponse:
    settings = service.get_or_create_user_settings(db, current_user.id)
    return service.serialize_user_settings(settings)


@router.post("/timezone/detect", response_model=UserSettingsResponse)
def detect_timezone(
    payload: DetectedTimezone,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> UserSettingsResponse:
    try:
        settings = service.detect_user_timezone(db, current_user.id, payload.timezone)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return service.serialize_user_settings(settings)


@router.patch("", response_model=UserSettingsResponse)
def update_settings(
    update: UserSettingsUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> UserSettingsResponse:
    try:
        settings = service.update_user_settings(
            db,
            user_id=current_user.id,
            update=update,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error

    return service.serialize_user_settings(settings)
