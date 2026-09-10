"""Folder routes are a frontend-facing alias for projects."""

import uuid

from fastapi import APIRouter, HTTPException, Response, status

from app.auth.dependencies import CurrentUser, DatabaseSession
from app.projects import service
from app.projects.models import Project
from app.projects.schemas import (
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
)

router = APIRouter(prefix="/folders", tags=["folders"])


@router.get("", response_model=list[ProjectResponse])
def list_folders(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> list[service.ProjectWithCounts]:
    return service.list_projects(db, current_user.id)


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_folder(
    folder_data: ProjectCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> service.ProjectWithCounts:
    return service.create_project(
        db,
        current_user.id,
        folder_data,
    )


@router.patch(
    "/{folder_id}",
    response_model=ProjectResponse,
)
def update_folder(
    folder_id: uuid.UUID,
    folder_data: ProjectUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> Project:
    folder = service.get_project_by_id(
        db,
        folder_id,
        current_user.id,
    )

    if folder is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found",
        )

    return service.update_project(db, folder, folder_data)


@router.delete(
    "/{folder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_folder(
    folder_id: uuid.UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> Response:
    folder = service.get_project_by_id(
        db,
        folder_id,
        current_user.id,
    )

    if folder is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found",
        )

    service.delete_project(db, folder)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
