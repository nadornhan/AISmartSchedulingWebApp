import uuid

from fastapi import APIRouter, HTTPException, Response, status

from app.auth.dependencies import CurrentUser, DatabaseSession
from app.tasks import service
from app.tasks.models import Task
from app.tasks.schemas import TaskCreate, TaskResponse, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskResponse])
def list_tasks(
    db: DatabaseSession,
    current_user: CurrentUser,
) -> list[Task]:
    return service.list_tasks(db, current_user.id)


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

    return service.update_task(db, task, task_data)


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