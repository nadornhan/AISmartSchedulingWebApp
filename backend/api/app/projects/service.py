import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.projects.models import Project
from app.projects.schemas import ProjectCreate, ProjectUpdate


def list_projects(
    db: Session,
    user_id: uuid.UUID,
) -> list[Project]:
    statement = (
        select(Project).where(Project.user_id == user_id).order_by(Project.created_at.desc())
    )
    return list(db.scalars(statement).all())


def create_project(
    db: Session,
    user_id: uuid.UUID,
    project_data: ProjectCreate,
) -> Project:
    project = Project(
        user_id=user_id,
        **project_data.model_dump(),
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return project


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
