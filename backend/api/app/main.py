import uuid
from collections.abc import Sequence

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import CurrentUser, get_current_user
from .config import get_settings
from .database import Base, engine, get_db
from .models import Task
from .schemas import TaskCreate, TaskRead, TaskUpdate

settings = get_settings()

app = FastAPI(title="Todo List API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/tasks", response_model=list[TaskRead])
def list_tasks(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Sequence[Task]:
    statement = (
        select(Task)
        .where(Task.user_id == current_user.id)
        .order_by(Task.created_at.desc(), Task.id.desc())
    )
    return db.scalars(statement).all()


@app.post("/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Task:
    task = Task(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.patch("/tasks/{task_id}", response_model=TaskRead)
def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Task:
    task = get_user_task(db, task_id, current_user.id)
    update_data = payload.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)
    return task


@app.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    task = get_user_task(db, task_id, current_user.id)
    db.delete(task)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def get_user_task(db: Session, task_id: uuid.UUID, user_id: uuid.UUID) -> Task:
    statement = select(Task).where(Task.id == task_id, Task.user_id == user_id)
    task = db.scalar(statement)

    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    return task
