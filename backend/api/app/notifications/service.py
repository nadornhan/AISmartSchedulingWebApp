import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.notifications.models import Notification
from app.settings import service as settings_service
from app.tasks.models import Task, TaskStatus
from app.tasks.overdue import normalize_due_datetime, utc_now

UPCOMING_DEADLINE_WINDOW = timedelta(hours=24)
ACTIONABLE_TASK_NOTIFICATION_TYPES = ("task_reminder", "overdue_alert")


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
    type: str
    title: str
    message: str | None
    metadata: dict[str, object] | None
    scheduled_for: datetime | None
    dedupe_key: str | None
    target_url: str
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
        type="task_created",
        title="Task created",
        message=task.title,
        data={"task_title": task.title},
        dedupe_key=f"task_created:{task.id}",
        created_at=datetime.now(UTC),
    )
    db.add(notification)
    return notification


def create_notification_once(
    db: Session,
    *,
    user_id: uuid.UUID,
    notification_type: str,
    title: str,
    message: str | None = None,
    task: Task | None = None,
    metadata: dict[str, object] | None = None,
    scheduled_for: datetime | None = None,
    dedupe_key: str,
) -> Notification | None:
    existing = db.scalar(
        select(Notification).where(Notification.dedupe_key == dedupe_key)
    )

    if existing is not None:
        return None

    notification = Notification(
        user_id=user_id,
        task_id=task.id if task is not None else None,
        type=notification_type,
        title=title,
        message=message,
        data=metadata,
        scheduled_for=scheduled_for,
        dedupe_key=dedupe_key,
        created_at=utc_now(),
    )
    db.add(notification)
    return notification


def _due_date_key(due_date: datetime) -> str:
    return normalize_due_datetime(due_date).isoformat()


def delete_task_notifications(
    db: Session,
    *,
    user_id: uuid.UUID,
    task_id: uuid.UUID,
    notification_types: tuple[str, ...] | None = None,
) -> int:
    conditions = [
        Notification.user_id == user_id,
        Notification.task_id == task_id,
    ]
    if notification_types is not None:
        conditions.append(Notification.type.in_(notification_types))

    result = db.execute(delete(Notification).where(*conditions))
    return result.rowcount or 0


def delete_actionable_task_notifications(
    db: Session,
    *,
    user_id: uuid.UUID,
    task_id: uuid.UUID,
) -> int:
    return delete_task_notifications(
        db,
        user_id=user_id,
        task_id=task_id,
        notification_types=ACTIONABLE_TASK_NOTIFICATION_TYPES,
    )


def notification_target_url(notification: Notification) -> str:
    if notification.task_id is not None:
        return f"/tasks?task_id={notification.task_id}"

    return "/tasks"


def sync_user_reminders(
    db: Session,
    user_id: uuid.UUID,
    *,
    now: datetime | None = None,
) -> int:
    reference = now or utc_now()
    settings = settings_service.get_or_create_user_settings(db, user_id)
    created_count = 0

    if settings.notify_task_reminders:
        created_count += create_upcoming_deadline_reminders(
            db,
            user_id,
            reference,
        )

    if settings.notify_overdue_alerts:
        created_count += create_overdue_alerts(db, user_id, reference)

    if (
        settings.notify_productivity_reminders
        and get_unread_actionable_count(db, user_id) == 0
    ):
        created_count += create_productivity_message(db, user_id, reference)

    if created_count > 0:
        db.commit()

    return created_count


def get_unread_count(db: Session, user_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.read_at.is_(None),
        )
    ) or 0


def get_unread_actionable_count(db: Session, user_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.read_at.is_(None),
            Notification.type.in_(ACTIONABLE_TASK_NOTIFICATION_TYPES),
        )
    ) or 0


def create_upcoming_deadline_reminders(
    db: Session,
    user_id: uuid.UUID,
    now: datetime,
) -> int:
    window_end = now + UPCOMING_DEADLINE_WINDOW
    statement = (
        select(Task)
        .where(
            Task.user_id == user_id,
            Task.status != TaskStatus.DONE,
            Task.due_date.is_not(None),
            Task.due_date >= now,
            Task.due_date <= window_end,
        )
        .order_by(Task.due_date.asc(), Task.id.asc())
    )
    tasks = list(db.scalars(statement).all())
    created_count = 0

    for task in tasks:
        due_date = normalize_due_datetime(task.due_date)
        notification = create_notification_once(
            db,
            user_id=user_id,
            task=task,
            notification_type="task_reminder",
            title="Task deadline soon",
            message=f"{task.title} is due soon.",
            metadata={
                "task_title": task.title,
                "due_date": due_date.isoformat(),
            },
            scheduled_for=due_date,
            dedupe_key=f"task_reminder:{task.id}:{_due_date_key(due_date)}",
        )
        if notification is not None:
            created_count += 1

    return created_count


def create_overdue_alerts(
    db: Session,
    user_id: uuid.UUID,
    now: datetime,
) -> int:
    statement = (
        select(Task)
        .where(
            Task.user_id == user_id,
            Task.status != TaskStatus.DONE,
            Task.due_date.is_not(None),
            Task.due_date < now,
        )
        .order_by(Task.due_date.asc(), Task.id.asc())
    )
    tasks = list(db.scalars(statement).all())
    created_count = 0

    for task in tasks:
        due_date = normalize_due_datetime(task.due_date)
        notification = create_notification_once(
            db,
            user_id=user_id,
            task=task,
            notification_type="overdue_alert",
            title="Gentle overdue reset",
            message=f"{task.title} slipped past its due time. Reset it when you are ready.",
            metadata={
                "task_title": task.title,
                "due_date": due_date.isoformat(),
                "suggested_action": "reschedule",
            },
            scheduled_for=due_date,
            dedupe_key=f"overdue_alert:{task.id}:{_due_date_key(due_date)}",
        )
        if notification is not None:
            created_count += 1

    return created_count


def create_productivity_message(
    db: Session,
    user_id: uuid.UUID,
    now: datetime,
) -> int:
    day_key = now.date().isoformat()
    notification = create_notification_once(
        db,
        user_id=user_id,
        notification_type="productivity_reminder",
        title="Momentum check",
        message="Pick one focused task for your next work block, or reset anything that slipped.",
        metadata={"date": day_key, "suggested_action": "choose_next_task"},
        scheduled_for=now,
        dedupe_key=f"productivity_reminder:{user_id}:{day_key}",
    )

    return 1 if notification is not None else 0


def list_notifications(
    db: Session,
    user_id: uuid.UUID,
    *,
    limit: int = 5,
    sync_reminders: bool = True,
) -> tuple[list[NotificationWithTask], int]:
    if sync_reminders:
        sync_user_reminders(db, user_id)

    unread_count = get_unread_count(db, user_id)

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
            type=notification.type,
            title=notification.title,
            message=notification.message,
            metadata=notification.data,
            scheduled_for=notification.scheduled_for,
            dedupe_key=notification.dedupe_key,
            target_url=notification_target_url(notification),
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


def mark_all_notifications_read(
    db: Session,
    user_id: uuid.UUID,
) -> int:
    statement = select(Notification).where(
        Notification.user_id == user_id,
        Notification.read_at.is_(None),
    )
    notifications = list(db.scalars(statement).all())
    read_at = utc_now()

    for notification in notifications:
        notification.read_at = read_at

    db.commit()
    return len(notifications)
