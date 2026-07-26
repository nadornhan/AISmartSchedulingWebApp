import math
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.auth.dependencies import CurrentUser, DatabaseSession
from app.projects import service as project_service
from app.tasks import service
from app.tasks.models import Task, TaskPriority
from app.tasks.schemas import (
    SortOrder,
    TaskCreate,
    TaskDisplayStatus,
    TaskListResponse,
    TaskResponse,
    TaskSortBy,
    TaskUpdate,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=TaskListResponse)
def list_tasks(
    db: DatabaseSession,
    current_user: CurrentUser,
    search: str | None = Query(
        default=None,
        min_length=1,
        max_length=255,
    ),
    task_status: TaskDisplayStatus | None = Query(
        default=None,
        alias="status",
    ),
    priority: TaskPriority | None = None,
    project_id: uuid.UUID | None = None,
    due_from: datetime | None = None,
    due_to: datetime | None = None,
    sort_by: TaskSortBy = TaskSortBy.CREATED_AT,
    sort_order: SortOrder = SortOrder.DESC,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> TaskListResponse:
    if due_from is not None and due_to is not None and due_to < due_from:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="due_to must be later than or equal to due_from",
        )

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

    tasks, total = service.list_tasks(
        db,
        current_user.id,
        search=search,
        task_status=task_status,
        priority=priority,
        project_id=project_id,
        due_from=due_from,
        due_to=due_to,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )

    return TaskListResponse(
        items=tasks,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=math.ceil(total / page_size),
    )


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
