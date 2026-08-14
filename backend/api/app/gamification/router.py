import uuid

from fastapi import APIRouter, HTTPException, status

from app.auth.dependencies import CurrentUser, DatabaseSession
from app.gamification import service
from app.gamification.schemas import (
    AchievementsResponse,
    ForestResponse,
    ForestSceneResponse,
    GamificationProfileResponse,
    PlacePlantRequest,
    PlantCatalogResponse,
    SelectPlantRequest,
    UpdateForestRequest,
    UpdatePlantRequest,
    UserPlantResponse,
)

router = APIRouter(prefix="/gamification", tags=["gamification"])


@router.get("/profile", response_model=GamificationProfileResponse)
def get_profile(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> GamificationProfileResponse:
    return service.get_profile(db, current_user.id)


@router.get("/forest", response_model=ForestResponse)
def get_forest(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> ForestResponse:
    return service.get_forest(db, current_user.id)


@router.get("/forest/scene", response_model=ForestSceneResponse)
def get_forest_scene(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> ForestSceneResponse:
    return service.get_forest_scene(db, current_user.id)


@router.patch("/forest", response_model=ForestSceneResponse)
def update_forest(
    payload: UpdateForestRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> ForestSceneResponse:
    try:
        return service.update_forest_name(db, current_user.id, payload)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


@router.get("/plants", response_model=PlantCatalogResponse)
def get_plants(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> PlantCatalogResponse:
    return service.get_plant_catalog(db, current_user.id)


@router.post("/plants/select", response_model=GamificationProfileResponse)
def select_plant(
    payload: SelectPlantRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> GamificationProfileResponse:
    try:
        return service.select_plant(db, current_user.id, payload.species_id)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.patch("/plants/{plant_id}", response_model=UserPlantResponse)
def update_plant(
    plant_id: uuid.UUID,
    payload: UpdatePlantRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> UserPlantResponse:
    try:
        return service.update_plant(db, current_user.id, plant_id, payload)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


@router.patch("/forest/{plant_id}/position", response_model=UserPlantResponse)
def place_plant(
    plant_id: uuid.UUID,
    payload: PlacePlantRequest,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> UserPlantResponse:
    try:
        return service.place_plant(db, current_user.id, plant_id, payload)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


@router.get("/achievements", response_model=AchievementsResponse)
def get_achievements(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> AchievementsResponse:
    return service.get_achievements(db, current_user.id)
