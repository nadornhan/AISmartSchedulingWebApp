import uuid

from fastapi import APIRouter, HTTPException, Response, status

from app.auth.dependencies import CurrentUser, DatabaseSession
from app.tasks import service
from app.tasks.models import Task
from app.tasks.schemas import TaskCreate, TaskResponse, TaskUpdate
from app.projects import service as project_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskResponse])
def list_tasks(
    db: DatabaseSession,
    current_user: CurrentUser,
    project_id: uuid.UUID | None = None,
) -> list[Task]:
    if project_id is not None:
        project = project_service.get_project_by_id(
            db,
            project_id,
            current_user.id,
        )

        if project is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

    return service.list_tasks(db, current_user.id, project_id)


@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    task_data: TaskCreate,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> Task:
    if task_data.project_id is not None:
        project = project_service.get_project_by_id(
            db,
            task_data.project_id,
            current_user.id,
        )

        if project is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )
    return service.create_task(db, current_user.id, task_data)


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: uuid.UUID,
    task_data: TaskUpdate,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> Task:
    task = service.get_task_by_id(db, task_id, current_user.id)

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    if task_data.project_id is not None:
        project = project_service.get_project_by_id(
            db,
            task_data.project_id,
            current_user.id,
        )

        if project is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

    try:
        return service.update_task(db, task, task_data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_task(
    task_id: uuid.UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> Response:
    task = service.get_task_by_id(db, task_id, current_user.id)

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    service.delete_task(db, task)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
