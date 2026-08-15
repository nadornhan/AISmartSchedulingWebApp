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

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> list[service.ProjectWithCounts]:
    return service.list_projects(db, current_user.id)


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    project_data: ProjectCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> service.ProjectWithCounts:
    return service.create_project(
        db,
        current_user.id,
        project_data,
    )


@router.patch(
    "/{project_id}",
    response_model=ProjectResponse,
)
def update_project(
    project_id: uuid.UUID,
    project_data: ProjectUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> Project:
    project = service.get_project_by_id(
        db,
        project_id,
        current_user.id,
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return service.update_project(db, project, project_data)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project(
    project_id: uuid.UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> Response:
    project = service.get_project_by_id(
        db,
        project_id,
        current_user.id,
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    service.delete_project(db, project)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
