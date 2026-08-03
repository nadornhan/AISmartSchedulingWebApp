import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.projects.models import Project
from app.projects.schemas import ProjectCreate, ProjectUpdate
from app.tasks.models import Task, TaskStatus


@dataclass(frozen=True)
class ProjectWithCounts:
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    color: str
    created_at: datetime
    updated_at: datetime
    task_count: int
    completed_task_count: int


def list_projects(
    db: Session,
    user_id: uuid.UUID,
) -> list[ProjectWithCounts]:
    count_subquery = (
        select(
            Task.project_id.label("project_id"),
            func.count(Task.id).label("task_count"),
            func.coalesce(
                func.sum(
                    case(
                        (Task.status == TaskStatus.DONE, 1),
                        else_=0,
                    )
                ),
                0,
            ).label("completed_task_count"),
        )
        .where(
            Task.user_id == user_id,
            Task.project_id.is_not(None),
        )
        .group_by(Task.project_id)
        .subquery()
    )

    statement = (
        select(
            Project,
            func.coalesce(count_subquery.c.task_count, 0),
            func.coalesce(count_subquery.c.completed_task_count, 0),
        )
        .outerjoin(
            count_subquery,
            count_subquery.c.project_id == Project.id,
        )
        .where(Project.user_id == user_id)
        .order_by(Project.created_at.asc(), Project.id.asc())
    )
    rows = db.execute(statement).all()

    return [
        ProjectWithCounts(
            id=project.id,
            user_id=project.user_id,
            name=project.name,
            color=project.color,
            created_at=project.created_at,
            updated_at=project.updated_at,
            task_count=int(task_count),
            completed_task_count=int(completed_task_count),
        )
        for project, task_count, completed_task_count in rows
    ]


def create_project(
    db: Session,
    user_id: uuid.UUID,
    project_data: ProjectCreate,
) -> ProjectWithCounts:
    project = Project(
        user_id=user_id,
        **project_data.model_dump(),
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return ProjectWithCounts(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        color=project.color,
        created_at=project.created_at,
        updated_at=project.updated_at,
        task_count=0,
        completed_task_count=0,
    )


def get_project_by_id(
    db: Session,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Project | None:
    statement = select(Project).where(
        Project.id == project_id,
        Project.user_id == user_id,
    )
    return db.scalar(statement)


def update_project(
    db: Session,
    project: Project,
    project_data: ProjectUpdate,
) -> Project:
    update_data = project_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)

    return project


def delete_project(
    db: Session,
    project: Project,
) -> None:
    db.delete(project)
    db.commit()
