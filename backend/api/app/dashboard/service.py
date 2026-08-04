import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.dashboard.schemas import (
    DashboardSummaryResponse,
    DashboardTaskSummary,
    NextBestTask,
    ProgressSummary,
    WeeklyActivityPoint,
)
from app.tasks.models import Task, TaskPriority, TaskStatus
from app.tasks.overdue import is_task_overdue, task_overdue_condition, utc_now
from app.tasks.schemas import TaskDisplayStatus

QUICK_WINS_LIMIT = 5
WEEKLY_ACTIVITY_DAYS = 7

PRIORITY_RANK = {
    TaskPriority.HIGH: 0,
    TaskPriority.MEDIUM: 1,
    TaskPriority.LOW: 2,
    TaskPriority.NO_PRIORITY: 3,
}


def _progress_percent(completed: int, total: int) -> int | None:
    if total == 0:
        return None

    return round((completed / total) * 100)


def _start_of_week(day: date) -> date:
    return day - timedelta(days=day.weekday())


def _day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, datetime.min.time(), tzinfo=UTC)
    end = start + timedelta(days=1)
    return start, end


def _open_tasks(db: Session, user_id: uuid.UUID) -> list[Task]:
    return list(
        db.scalars(
            select(Task)
            .options(selectinload(Task.project))
            .where(
                Task.user_id == user_id,
                Task.status != TaskStatus.DONE,
            )
        ).all()
    )


def _task_summary(task: Task, *, now: datetime) -> DashboardTaskSummary:
    overdue = is_task_overdue(
        status=task.status,
        due_date=task.due_date,
        now=now,
    )

    return DashboardTaskSummary(
        id=task.id,
        title=task.title,
        description=task.description,
        project_id=task.project_id,
        project=task.project,
        priority=task.priority,
        status=(
            TaskDisplayStatus.OVERDUE
            if overdue
            else TaskDisplayStatus(task.status.value)
        ),
        stored_status=task.status,
        due_date=task.due_date,
        estimated_duration_minutes=task.estimated_duration_minutes,
        is_overdue=overdue,
    )


def _due_sort_value(task: Task) -> datetime:
    return task.due_date or datetime.max.replace(tzinfo=UTC)


def _next_best_sort_key(task: Task, *, now: datetime) -> tuple:
    return (
        not is_task_overdue(status=task.status, due_date=task.due_date, now=now),
        _due_sort_value(task),
        PRIORITY_RANK[task.priority],
        task.estimated_duration_minutes or 999999,
        str(task.id),
    )


def _quick_win_sort_key(task: Task) -> tuple:
    return (
        _due_sort_value(task),
        PRIORITY_RANK[task.priority],
        task.estimated_duration_minutes or 999999,
        str(task.id),
    )


def _next_best_reasons(task: Task, *, now: datetime) -> list[str]:
    reasons: list[str] = []

    if is_task_overdue(status=task.status, due_date=task.due_date, now=now):
        reasons.append("Overdue")
    elif task.due_date is not None:
        reasons.append("Due soon")

    if task.priority == TaskPriority.HIGH:
        reasons.append("High priority")

    if (
        task.estimated_duration_minutes is not None
        and task.estimated_duration_minutes <= 10
    ):
        reasons.append("Short estimated duration")

    return reasons


def _weekly_activity(
    db: Session,
    user_id: uuid.UUID,
    *,
    now: datetime,
) -> list[WeeklyActivityPoint]:
    week_start = _start_of_week(now.date())
    days = [
        week_start + timedelta(days=offset)
        for offset in range(WEEKLY_ACTIVITY_DAYS)
    ]
    counts = {
        day: {"done": 0, "overdue": 0}
        for day in days
    }
    start, _first_end = _day_bounds(days[0])
    _last_start, end = _day_bounds(days[-1])

    completed_tasks = list(
        db.scalars(
            select(Task)
            .where(
                Task.user_id == user_id,
                Task.status == TaskStatus.DONE,
                Task.completed_at.is_not(None),
                Task.completed_at >= start,
                Task.completed_at < end,
            )
        ).all()
    )
    overdue_tasks = list(
        db.scalars(
            select(Task)
            .where(
                Task.user_id == user_id,
                Task.status != TaskStatus.DONE,
                Task.due_date.is_not(None),
                Task.due_date >= start,
                Task.due_date < end,
                Task.due_date < now,
            )
        ).all()
    )

    for task in completed_tasks:
        if task.completed_at is None:
            continue

        completed_day = task.completed_at.astimezone(UTC).date()
        if completed_day in counts:
            counts[completed_day]["done"] += 1

    for task in overdue_tasks:
        if task.due_date is None:
            continue

        due_day = task.due_date.astimezone(UTC).date()
        if due_day in counts:
            counts[due_day]["overdue"] += 1

    return [
        WeeklyActivityPoint(
            date=day,
            day=day.strftime("%a"),
            done=counts[day]["done"],
            overdue=counts[day]["overdue"],
        )
        for day in days
    ]


def get_dashboard_summary(
    db: Session,
    user_id: uuid.UUID,
) -> DashboardSummaryResponse:
    now = utc_now()

    completed_count = int(
        db.scalar(
            select(func.count())
            .select_from(Task)
            .where(
                Task.user_id == user_id,
                Task.status == TaskStatus.DONE,
            )
        )
        or 0
    )
    total_count = int(
        db.scalar(
            select(func.count())
            .select_from(Task)
            .where(Task.user_id == user_id)
        )
        or 0
    )
    overdue_count = int(
        db.scalar(
            select(func.count())
            .select_from(Task)
            .where(
                Task.user_id == user_id,
                task_overdue_condition(Task),
            )
        )
        or 0
    )

    open_tasks = _open_tasks(db, user_id)
    next_task = min(
        open_tasks,
        key=lambda task: _next_best_sort_key(task, now=now),
        default=None,
    )
    quick_wins = sorted(
        (
            task
            for task in open_tasks
            if task.estimated_duration_minutes is not None
            and task.estimated_duration_minutes <= 10
        ),
        key=_quick_win_sort_key,
    )[:QUICK_WINS_LIMIT]

    status_order = case(
        (Task.priority == TaskPriority.HIGH, 0),
        (Task.priority == TaskPriority.MEDIUM, 1),
        (Task.priority == TaskPriority.LOW, 2),
        else_=3,
    )
    in_progress = list(
        db.scalars(
            select(Task)
            .options(selectinload(Task.project))
            .where(
                Task.user_id == user_id,
                Task.status == TaskStatus.IN_PROGRESS,
            )
            .order_by(Task.due_date.asc().nullslast(), status_order, Task.id.asc())
        ).all()
    )

    return DashboardSummaryResponse(
        task_progress=ProgressSummary(
            completed=completed_count,
            total=total_count,
            percent=_progress_percent(completed_count, total_count),
        ),
        overdue_count=overdue_count,
        next_best_task=(
            NextBestTask(
                task=_task_summary(next_task, now=now),
                reasons=_next_best_reasons(next_task, now=now),
            )
            if next_task is not None
            else None
        ),
        quick_wins=[
            _task_summary(task, now=now)
            for task in quick_wins
        ],
        in_progress=[
            _task_summary(task, now=now)
            for task in in_progress
        ],
        weekly_activity=_weekly_activity(db, user_id, now=now),
    )
