import uuid
from datetime import datetime

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.notifications import service as notification_service
from app.tasks.models import Subtask, Task, TaskPriority, TaskStatus
from app.tasks.overdue import task_overdue_condition, utc_now
from app.tasks.schemas import (
    SortOrder,
    SubtaskInput,
    TaskBulkUpdate,
    TaskCreate,
    TaskDisplayStatus,
    TaskDuplicate,
    TaskReschedule,
    TaskSortBy,
    TaskUpdate,
)


def _replace_subtasks(task: Task, subtasks: list[SubtaskInput]) -> None:
    ordered_subtasks = sorted(
        enumerate(subtasks),
        key=lambda item: (
            item[1].position if item[1].position is not None else item[0],
            item[0],
        ),
    )

    task.subtasks.clear()
    task.subtasks.extend(
        Subtask(
            title=subtask.title.strip(),
            is_completed=subtask.is_completed,
            position=position,
        )
        for position, (_original_index, subtask) in enumerate(ordered_subtasks)
        if subtask.title.strip()
    )


def list_tasks(
    db: Session,
    user_id: uuid.UUID,
    *,
    search: str | None = None,
    task_status: TaskDisplayStatus | None = None,
    priority: TaskPriority | None = None,
    project_id: uuid.UUID | None = None,
    inbox_only: bool = False,
    due_from: datetime | None = None,
    due_to: datetime | None = None,
    sort_by: TaskSortBy = TaskSortBy.CREATED_AT,
    sort_order: SortOrder = SortOrder.DESC,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Task], int]:
    conditions = [Task.user_id == user_id]
    overdue = task_overdue_condition(Task)

    if search is not None and search.strip():
        search_pattern = f"%{search.strip()}%"

        conditions.append(
            or_(
                Task.title.ilike(search_pattern),
                Task.description.ilike(search_pattern),
            )
        )

    if task_status == TaskDisplayStatus.OVERDUE:
        conditions.append(overdue)
    elif task_status is not None:
        # Keep Pending / In Progress tabs free of computed overdue rows.
        conditions.append(Task.status == TaskStatus(task_status.value))
        if task_status in {
            TaskDisplayStatus.PENDING,
            TaskDisplayStatus.IN_PROGRESS,
        }:
            conditions.append(~overdue)

    if priority is not None:
        conditions.append(Task.priority == priority)

    if inbox_only:
        conditions.append(Task.project_id.is_(None))
    elif project_id is not None:
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
        .options(
            selectinload(Task.project),
            selectinload(Task.subtasks),
        )
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
    create_data = task_data.model_dump(exclude={"subtasks"})
    task = Task(
        user_id=user_id,
        status=TaskStatus.PENDING,
        **create_data,
    )

    db.add(task)
    db.flush()
    _replace_subtasks(task, task_data.subtasks)
    notification_service.create_task_notification(
        db,
        user_id=user_id,
        task=task,
    )
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
        .options(
            selectinload(Task.project),
            selectinload(Task.subtasks),
        )
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
    update_data = task_data.model_dump(
        exclude={"subtasks"},
        exclude_unset=True,
    )
    subtasks = (
        task_data.subtasks
        if "subtasks" in task_data.model_fields_set
        else None
    )
    previous_status = task.status
    previous_due_date = task.due_date

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

    if subtasks is not None:
        _replace_subtasks(task, subtasks)

    next_status = update_data.get("status", previous_status)
    if next_status == TaskStatus.DONE and previous_status != TaskStatus.DONE:
        task.completed_at = utc_now()
    elif next_status != TaskStatus.DONE:
        task.completed_at = None
    elif task.completed_at is None:
        task.completed_at = utc_now()

    if "due_date" in update_data and update_data["due_date"] != previous_due_date:
        notification_service.create_notification_once(
            db,
            user_id=task.user_id,
            notification_type="task_rescheduled",
            title="Task rescheduled",
            message=task.title,
            task=task,
            metadata={"task_title": task.title},
            dedupe_key=f"task_rescheduled:{task.id}:{utc_now().isoformat()}",
        )

    db.commit()
    db.refresh(task)

    return get_task_by_id(db, task.id, task.user_id) or task


def delete_task(db: Session, task: Task) -> None:
    db.delete(task)
    db.commit()


def get_tasks_by_ids(
    db: Session,
    user_id: uuid.UUID,
    task_ids: list[uuid.UUID],
) -> list[Task]:
    if not task_ids:
        return []

    statement = (
        select(Task)
        .options(
            selectinload(Task.project),
            selectinload(Task.subtasks),
        )
        .where(
            Task.user_id == user_id,
            Task.id.in_(task_ids),
        )
    )
    tasks = list(db.scalars(statement).all())
    by_id = {task.id: task for task in tasks}
    return [by_id[task_id] for task_id in task_ids if task_id in by_id]


def bulk_update_tasks(
    db: Session,
    user_id: uuid.UUID,
    payload: TaskBulkUpdate,
) -> list[Task]:
    unique_ids = list(dict.fromkeys(payload.task_ids))
    tasks = get_tasks_by_ids(db, user_id, unique_ids)
    if len(tasks) != len(unique_ids):
        raise LookupError("One or more tasks were not found")

    fields: dict[str, object] = {}
    if payload.status is not None:
        fields["status"] = payload.status
    if "project_id" in payload.model_fields_set:
        fields["project_id"] = payload.project_id
    if payload.priority is not None:
        fields["priority"] = payload.priority
    if "due_date" in payload.model_fields_set:
        fields["due_date"] = payload.due_date

    update = TaskUpdate.model_validate(fields)
    updated: list[Task] = []
    for task in tasks:
        updated.append(update_task(db, task, update))
    return updated


def bulk_delete_tasks(
    db: Session,
    user_id: uuid.UUID,
    task_ids: list[uuid.UUID],
) -> int:
    unique_ids = list(dict.fromkeys(task_ids))
    tasks = get_tasks_by_ids(db, user_id, unique_ids)
    if len(tasks) != len(unique_ids):
        raise LookupError("One or more tasks were not found")

    for task in tasks:
        db.delete(task)
    db.commit()
    return len(tasks)


def duplicate_task(
    db: Session,
    user_id: uuid.UUID,
    task: Task,
    options: TaskDuplicate | None = None,
) -> Task:
    options = options or TaskDuplicate()
    title = (options.title or f"{task.title} (Copy)").strip()
    subtasks = (
        [
            SubtaskInput(
                title=subtask.title,
                is_completed=False if options.reset_status else subtask.is_completed,
                position=subtask.position,
            )
            for subtask in task.subtasks
        ]
        if options.include_subtasks
        else []
    )

    create_data = TaskCreate(
        title=title,
        description=task.description,
        project_id=task.project_id,
        priority=task.priority,
        due_date=task.due_date,
        estimated_duration_minutes=task.estimated_duration_minutes,
        scheduled_start=task.scheduled_start,
        scheduled_end=task.scheduled_end,
        subtasks=subtasks,
    )
    duplicated = create_task(db, user_id, create_data)

    if not options.reset_status and task.status != TaskStatus.PENDING:
        return update_task(
            db,
            duplicated,
            TaskUpdate(status=task.status),
        )

    return duplicated


def reschedule_task(
    db: Session,
    task: Task,
    payload: TaskReschedule,
) -> Task:
    update_fields: dict[str, object] = {}
    if "due_date" in payload.model_fields_set:
        update_fields["due_date"] = payload.due_date
    if "scheduled_start" in payload.model_fields_set:
        update_fields["scheduled_start"] = payload.scheduled_start
    if "scheduled_end" in payload.model_fields_set:
        update_fields["scheduled_end"] = payload.scheduled_end

    return update_task(db, task, TaskUpdate.model_validate(update_fields))
