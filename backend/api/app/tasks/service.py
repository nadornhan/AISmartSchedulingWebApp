import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.tasks.models import Task
from app.tasks.schemas import TaskCreate, TaskUpdate


def list_tasks(
    db: Session,
    user_id: uuid.UUID,
    project_id: uuid.UUID | None = None,
) -> list[Task]:
    statement = (
        select(Task)
        .options(selectinload(Task.project))
        .where(Task.user_id == user_id)
    )

    if project_id is not None:
        statement = statement.where(Task.project_id == project_id)

    statement = statement.order_by(Task.created_at.desc())

    return list(db.scalars(statement).all())


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
