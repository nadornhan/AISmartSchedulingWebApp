import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.dashboard.schemas import (
    AiRecommendationCard,
    DashboardForestSummary,
    DashboardSummaryResponse,
    DashboardTaskSummary,
    FocusGoalSummary,
    NextBestTask,
    ProgressSummary,
    WeeklyActivityPoint,
)
from app.gamification import service as gamification_service
from app.scheduling import service as scheduling_service
from app.tasks.models import Task, TaskPriority, TaskStatus
from app.tasks.overdue import is_task_overdue, task_overdue_condition, utc_now
from app.tasks.schemas import TaskDisplayStatus

QUICK_WINS_LIMIT = 5
WEEKLY_ACTIVITY_DAYS = 7
DAILY_FOCUS_GOAL_MINUTES = 360

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


def _is_between(value: datetime | None, start: datetime, end: datetime) -> bool:
    if value is None:
        return False

    return start <= value.astimezone(UTC) < end


def _open_tasks(db: Session, user_id: uuid.UUID) -> list[Task]:
    return list(
        db.scalars(
            select(Task)
            .options(
                selectinload(Task.project),
                selectinload(Task.subtasks),
            )
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
        subtask_progress=task.subtask_progress,
        is_overdue=overdue,
    )


def _due_sort_value(task: Task) -> datetime:
    return task.due_date or datetime.max.replace(tzinfo=UTC)


def _next_best_sort_key(task: Task, *, now: datetime) -> tuple:
    today_start, today_end = _day_bounds(now.date())
    due_today = _is_between(task.due_date, today_start, today_end)

    return (
        not due_today,
        task.estimated_duration_minutes or 999999,
        PRIORITY_RANK[task.priority],
        _due_sort_value(task),
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

    today_start, today_end = _day_bounds(now.date())

    if _is_between(task.due_date, today_start, today_end):
        reasons.append("Due today")
    elif is_task_overdue(status=task.status, due_date=task.due_date, now=now):
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


def _today_progress(
    db: Session,
    user_id: uuid.UUID,
    *,
    now: datetime,
) -> ProgressSummary:
    start, end = _day_bounds(now.date())

    due_today_ids = set(
        db.scalars(
            select(Task.id).where(
                Task.user_id == user_id,
                Task.due_date.is_not(None),
                Task.due_date >= start,
                Task.due_date < end,
            )
        ).all()
    )
    completed_today_ids = set(
        db.scalars(
            select(Task.id).where(
                Task.user_id == user_id,
                Task.status == TaskStatus.DONE,
                Task.completed_at.is_not(None),
                Task.completed_at >= start,
                Task.completed_at < end,
            )
        ).all()
    )
    total = len(due_today_ids | completed_today_ids)
    completed = len(completed_today_ids)

    return ProgressSummary(
        completed=completed,
        total=total,
        percent=_progress_percent(completed, total),
    )


def _focus_goal(
    db: Session,
    user_id: uuid.UUID,
    *,
    now: datetime,
) -> FocusGoalSummary:
    start, end = _day_bounds(now.date())
    completed_minutes = int(
        db.scalar(
            select(func.coalesce(func.sum(Task.estimated_duration_minutes), 0))
            .where(
                Task.user_id == user_id,
                Task.status == TaskStatus.DONE,
                Task.completed_at.is_not(None),
                Task.completed_at >= start,
                Task.completed_at < end,
            )
        )
        or 0
    )

    return FocusGoalSummary(
        completed_minutes=completed_minutes,
        goal_minutes=DAILY_FOCUS_GOAL_MINUTES,
        percent=min(
            100,
            _progress_percent(completed_minutes, DAILY_FOCUS_GOAL_MINUTES) or 0,
        ),
    )


def _current_streak_days(
    db: Session,
    user_id: uuid.UUID,
    *,
    now: datetime,
) -> int:
    completed_dates = set(
        db.scalars(
            select(func.date(Task.completed_at))
            .where(
                Task.user_id == user_id,
                Task.status == TaskStatus.DONE,
                Task.completed_at.is_not(None),
                Task.completed_at <= now,
            )
        ).all()
    )

    streak = 0
    day = now.date()
    while day in completed_dates:
        streak += 1
        day -= timedelta(days=1)

    return streak


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
    ai_recommendation_response = scheduling_service.get_dashboard_recommendation(
        db,
        user_id,
    )
    ai_recommendation = None
    next_task = None
    if (
        ai_recommendation_response is not None
        and ai_recommendation_response.task is not None
    ):
        ai_recommendation = AiRecommendationCard(
            id=ai_recommendation_response.id,
            task=ai_recommendation_response.task,
            title=ai_recommendation_response.title,
            explanation=ai_recommendation_response.explanation,
            reasons=ai_recommendation_response.reasons,
            based_on=ai_recommendation_response.based_on,
            score=ai_recommendation_response.score,
            footnote="AI based on your patterns",
        )
        next_task = next(
            (
                task
                for task in open_tasks
                if task.id == ai_recommendation_response.task.id
            ),
            None,
        )
    if next_task is None:
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
            .options(
                selectinload(Task.project),
                selectinload(Task.subtasks),
            )
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
        today_progress=_today_progress(db, user_id, now=now),
        focus_goal=_focus_goal(db, user_id, now=now),
        current_streak_days=_current_streak_days(db, user_id, now=now),
        overdue_count=overdue_count,
        ai_recommendation=ai_recommendation
        or (
            AiRecommendationCard(
                id=None,
                task=_task_summary(next_task, now=now),
                title=f"Focus on “{next_task.title}” next",
                explanation=(
                    "Fallback ranking from your open tasks while AI preferences "
                    "are unavailable."
                ),
                reasons=_next_best_reasons(next_task, now=now),
                based_on=["Open tasks", "Due dates", "Priority"],
                score=0,
            )
            if next_task is not None
            else None
        ),
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
        forest=_forest_summary(db, user_id),
    )


def _forest_summary(db: Session, user_id: uuid.UUID) -> DashboardForestSummary:
    widget = gamification_service.get_dashboard_widget(db, user_id)
    return DashboardForestSummary(
        species_name=widget.species_name,
        display_name=widget.display_name,
        growth_stage=widget.growth_stage,
        growth_stage_label=widget.growth_stage_label,
        current_growth_points=widget.current_growth_points,
        next_stage_at=widget.next_stage_at,
        total_trees_grown=widget.total_trees_grown,
        needs_plant_selection=widget.needs_plant_selection,
        supportive_message=widget.supportive_message,
    )
