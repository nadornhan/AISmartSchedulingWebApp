import uuid
from datetime import datetime

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.tasks.models import Task, TaskPriority, TaskStatus
from app.tasks.schemas import (
    SortOrder,
    TaskCreate,
    TaskDisplayStatus,
    TaskSortBy,
    TaskUpdate,
)


def list_tasks(
    db: Session,
    user_id: uuid.UUID,
    *,
    search: str | None = None,
    task_status: TaskDisplayStatus | None = None,
    priority: TaskPriority | None = None,
    project_id: uuid.UUID | None = None,
    due_from: datetime | None = None,
    due_to: datetime | None = None,
    sort_by: TaskSortBy = TaskSortBy.CREATED_AT,
    sort_order: SortOrder = SortOrder.DESC,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Task], int]:
    conditions = [Task.user_id == user_id]

    if search is not None and search.strip():
        search_pattern = f"%{search.strip()}%"

        conditions.append(
            or_(
                Task.title.ilike(search_pattern),
                Task.description.ilike(search_pattern),
            )
        )

    if task_status == TaskDisplayStatus.OVERDUE:
        conditions.extend(
            [
                Task.status != TaskStatus.DONE,
                Task.due_date.is_not(None),
                Task.due_date < func.now(),
            ]
        )
    elif task_status is not None:
        conditions.append(
            Task.status == TaskStatus(task_status.value)
        )

    if priority is not None:
        conditions.append(Task.priority == priority)

    if project_id is not None:
        conditions.append(Task.project_id == project_id)

    if due_from is not None:
        conditions.append(Task.due_date >= due_from)

    if due_to is not None:
        conditions.append(Task.due_date <= due_to)

    total_statement = (
        select(func.count())
        .select_from(Task)
        .where(*conditions)
    )
    total = db.scalar(total_statement) or 0

    priority_order = case(
        (Task.priority == TaskPriority.HIGH, 1),
        (Task.priority == TaskPriority.MEDIUM, 2),
        (Task.priority == TaskPriority.LOW, 3),
        (Task.priority == TaskPriority.NO_PRIORITY, 4),
        else_=5,
    )

    sort_columns = {
        TaskSortBy.CREATED_AT: Task.created_at,
        TaskSortBy.UPDATED_AT: Task.updated_at,
        TaskSortBy.TITLE: Task.title,
        TaskSortBy.DUE_DATE: Task.due_date,
        TaskSortBy.PRIORITY: priority_order,
    }
    sort_column = sort_columns[sort_by]

    if sort_order == SortOrder.ASC:
        order_expression = sort_column.asc().nullslast()
    else:
        order_expression = sort_column.desc().nullslast()

    offset = (page - 1) * page_size

    statement = (
        select(Task)
        .options(selectinload(Task.project))
        .where(*conditions)
        .order_by(order_expression, Task.id.asc())
        .offset(offset)
        .limit(page_size)
    )

    tasks = list(db.scalars(statement).all())

    return tasks, total


def create_task(
    db: Session,
    user_id: uuid.UUID,
    task_data: TaskCreate,
) -> Task:
    task = Task(
        user_id=user_id,
        **task_data.model_dump(),
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return get_task_by_id(db, task.id, user_id) or task


def get_task_by_id(
    db: Session,
    task_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Task | None:
    statement = (
        select(Task)
        .options(selectinload(Task.project))
        .where(
            Task.id == task_id,
            Task.user_id == user_id,
        )
    )

    return db.scalar(statement)


def update_task(
    db: Session,
    task: Task,
    task_data: TaskUpdate,
) -> Task:
    update_data = task_data.model_dump(exclude_unset=True)

    scheduled_start = update_data.get(
        "scheduled_start",
        task.scheduled_start,
    )
    scheduled_end = update_data.get(
        "scheduled_end",
        task.scheduled_end,
    )

    if (
        scheduled_start is not None
        and scheduled_end is not None
        and scheduled_end <= scheduled_start
    ):
        raise ValueError(
            "scheduled_end must be later than scheduled_start"
        )

    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    return get_task_by_id(db, task.id, task.user_id) or task


def delete_task(db: Session, task: Task) -> None:
    db.delete(task)
    db.commit()
