import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.notifications.models import Notification
from app.tasks.models import Task


@dataclass(frozen=True)
class NotificationTaskSummary:
    id: uuid.UUID
    title: str
    project_id: uuid.UUID | None
    project_name: str | None
    priority: str
    status: str


@dataclass(frozen=True)
class NotificationWithTask:
    id: uuid.UUID
    task_id: uuid.UUID | None
    title: str
    message: str | None
    read_at: datetime | None
    created_at: datetime
    task: NotificationTaskSummary | None

    @property
    def is_read(self) -> bool:
        return self.read_at is not None


def create_task_notification(
    db: Session,
    *,
    user_id: uuid.UUID,
    task: Task,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        task_id=task.id,
        title="Task created",
        message=task.title,
        created_at=datetime.now(UTC),
    )
    db.add(notification)
    return notification


def list_notifications(
    db: Session,
    user_id: uuid.UUID,
    *,
    limit: int = 5,
) -> tuple[list[NotificationWithTask], int]:
    unread_count = db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.read_at.is_(None),
        )
    ) or 0

    statement = (
        select(Notification)
        .options(
            selectinload(Notification.task).selectinload(Task.project),
        )
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
    )
    notifications = list(db.scalars(statement).all())

    return [
        NotificationWithTask(
            id=notification.id,
            task_id=notification.task_id,
            title=notification.title,
            message=notification.message,
            read_at=notification.read_at,
            created_at=notification.created_at,
            task=(
                NotificationTaskSummary(
                    id=notification.task.id,
                    title=notification.task.title,
                    project_id=notification.task.project_id,
                    project_name=(
                        notification.task.project.name
                        if notification.task.project is not None
                        else None
                    ),
                    priority=notification.task.priority.value,
                    status=notification.task.display_status,
                )
                if notification.task is not None
                else None
            ),
        )
        for notification in notifications
    ], unread_count


def mark_notifications_read(
    db: Session,
    user_id: uuid.UUID,
    notification_ids: list[uuid.UUID],
) -> int:
    if not notification_ids:
        return 0

    statement = select(Notification).where(
        Notification.user_id == user_id,
        Notification.id.in_(notification_ids),
        Notification.read_at.is_(None),
    )
    notifications = list(db.scalars(statement).all())
    read_at = datetime.now(UTC)

    for notification in notifications:
        notification.read_at = read_at

    db.commit()
    return len(notifications)
