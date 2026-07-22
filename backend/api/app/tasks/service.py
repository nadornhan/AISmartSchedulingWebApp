import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.tasks.models import Task
from app.tasks.schemas import TaskCreate, TaskUpdate


def list_tasks(
    db: Session,
    user_id: uuid.UUID,
    project_id: uuid.UUID | None = None,
) -> list[Task]:
    statement = select(Task).where(Task.user_id == user_id)

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

    return task


def get_task_by_id(
    db: Session,
    task_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Task | None:
    statement = select(Task).where(
        Task.id == task_id,
        Task.user_id == user_id,
    )
    return db.scalar(statement)


def update_task(
    db: Session,
    task: Task,
    task_data: TaskUpdate,
) -> Task:
    update_data = task_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    return task


def delete_task(db: Session, task: Task) -> None:
    db.delete(task)
    db.commit()
