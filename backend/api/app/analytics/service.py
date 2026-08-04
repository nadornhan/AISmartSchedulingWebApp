from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.analytics.schemas import (
    InsightRecommendation,
    InsightsSummaryResponse,
    InsightTrendPoint,
)
from app.auth.models import User
from app.tasks.models import Task, TaskPriority, TaskStatus

TREND_DAYS = 7


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _start_of_week(day: date) -> date:
    return day - timedelta(days=day.weekday())


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _week_bounds(reference: datetime) -> tuple[datetime, datetime, datetime, datetime]:
    today = reference.date()
    this_week_start = _start_of_week(today)
    next_week_start = this_week_start + timedelta(days=7)
    last_week_start = this_week_start - timedelta(days=7)

    this_start = datetime.combine(
        this_week_start,
        datetime.min.time(),
        tzinfo=UTC,
    )
    this_end = datetime.combine(
        next_week_start,
        datetime.min.time(),
        tzinfo=UTC,
    )
    last_start = datetime.combine(
        last_week_start,
        datetime.min.time(),
        tzinfo=UTC,
    )
    last_end = this_start

    return this_start, this_end, last_start, last_end


def _completed_tasks_query(
    user_id,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
) -> Select[tuple[Task]]:
    statement = select(Task).where(
        Task.user_id == user_id,
        Task.status == TaskStatus.DONE,
    )

    if start is not None:
        statement = statement.where(Task.updated_at >= start)
    if end is not None:
        statement = statement.where(Task.updated_at < end)

    return statement


def _count_completed(
    db: Session,
    user_id,
    *,
    start: datetime,
    end: datetime,
) -> int:
    statement = (
        select(func.count())
        .select_from(Task)
        .where(
            Task.user_id == user_id,
            Task.status == TaskStatus.DONE,
            Task.updated_at >= start,
            Task.updated_at < end,
        )
    )
    return int(db.scalar(statement) or 0)


def _estimated_work_minutes(
    db: Session,
    user_id,
    *,
    start: datetime,
    end: datetime,
) -> int:
    tasks = list(
        db.scalars(
            _completed_tasks_query(user_id, start=start, end=end)
        ).all()
    )

    total = 0
    for task in tasks:
        if task.estimated_duration_minutes is not None:
            total += task.estimated_duration_minutes

    return total


def _format_estimated_work_label(minutes: int) -> str:
    hours, remaining = divmod(max(minutes, 0), 60)
    if hours == 0:
        return f"{remaining}m"
    if remaining == 0:
        return f"{hours}h"
    return f"{hours}h {remaining}m"


def _goal_progress_percent(
    db: Session,
    user_id,
    *,
    start: datetime,
    end: datetime,
) -> int:
    completed = _count_completed(db, user_id, start=start, end=end)

    open_count = int(
        db.scalar(
            select(func.count())
            .select_from(Task)
            .where(
                Task.user_id == user_id,
                Task.status != TaskStatus.DONE,
                Task.created_at >= start,
                Task.created_at < end,
            )
        )
        or 0
    )

    # Also count unfinished tasks due in the current week.
    due_open = int(
        db.scalar(
            select(func.count())
            .select_from(Task)
            .where(
                Task.user_id == user_id,
                Task.status != TaskStatus.DONE,
                Task.due_date.is_not(None),
                Task.due_date >= start,
                Task.due_date < end,
            )
        )
        or 0
    )

    denominator = completed + max(open_count, due_open)
    if denominator == 0:
        return 0

    return min(100, round((completed / denominator) * 100))


def _current_streak_days(db: Session, user_id, *, reference: datetime) -> int:
    tasks = list(
        db.scalars(
            select(Task)
            .where(
                Task.user_id == user_id,
                Task.status == TaskStatus.DONE,
            )
            .order_by(Task.updated_at.desc())
        ).all()
    )

    completed_days = {
        _as_utc(task.updated_at).date()
        for task in tasks
    }

    if not completed_days:
        return 0

    streak = 0
    cursor = reference.date()

    # Allow streak to continue if the user hasn't completed anything today yet.
    if cursor not in completed_days:
        cursor = cursor - timedelta(days=1)

    while cursor in completed_days:
        streak += 1
        cursor = cursor - timedelta(days=1)

    return streak


def _trend_points(
    db: Session,
    user_id,
    *,
    reference: datetime,
    days: int = TREND_DAYS,
) -> list[InsightTrendPoint]:
    end_day = reference.date()
    start_day = end_day - timedelta(days=days - 1)
    start = datetime.combine(start_day, datetime.min.time(), tzinfo=UTC)
    end = datetime.combine(
        end_day + timedelta(days=1),
        datetime.min.time(),
        tzinfo=UTC,
    )

    tasks = list(
        db.scalars(
            _completed_tasks_query(user_id, start=start, end=end)
        ).all()
    )

    counts: dict[date, int] = {
        start_day + timedelta(days=offset): 0
        for offset in range(days)
    }

    for task in tasks:
        day = _as_utc(task.updated_at).date()
        if day in counts:
            counts[day] += 1

    return [
        InsightTrendPoint(date=day, completed_count=count)
        for day, count in sorted(counts.items())
    ]


def _week_over_week_change(this_week: int, last_week: int) -> int | None:
    if last_week == 0:
        if this_week == 0:
            return 0
        return None

    return round(((this_week - last_week) / last_week) * 100)


def _build_recommendations(
    *,
    streak_days: int,
    this_week_completed: int,
    high_priority_open: int,
    estimated_work_minutes: int,
) -> list[InsightRecommendation]:
    recommendations: list[InsightRecommendation] = [
        InsightRecommendation(
            id="deep_focus",
            category="deep_focus",
            title="Start your day with deep focus",
            description=(
                "Tackle your most important tasks in the morning when "
                "your energy and attention are highest."
                if high_priority_open > 0
                else "Block 45–60 minutes tomorrow morning for one important task before checking messages."
            ),
        ),
        InsightRecommendation(
            id="consistency",
            category="consistency",
            title="Stay consistent, see bigger results",
            description=(
                f"You're on a {streak_days}-day streak. Keep the chain going with one small win today."
                if streak_days > 0
                else "Complete at least one task today to start a consistency streak."
            ),
        ),
        InsightRecommendation(
            id="breaks",
            category="breaks",
            title="Take breaks to stay sharp",
            description=(
                f"You've completed about {_format_estimated_work_label(estimated_work_minutes)} "
                "of estimated work this week. Short breaks help you recharge."
                if estimated_work_minutes >= 60
                else (
                    f"Nice pace — {this_week_completed} tasks done this week. "
                    "Add short breaks between sessions to stay sharp."
                    if this_week_completed > 0
                    else "When you start focusing, take a 5-minute break every 25–50 minutes."
                )
            ),
        ),
    ]

    return recommendations


def _weekly_summary_text(
    *,
    this_week: int,
    change_percent: int | None,
) -> str:
    if this_week == 0:
        return "No completed tasks yet this week — finish one today to kick off your momentum."

    if change_percent is None:
        return (
            f"You've completed {this_week} tasks this week — "
            "great start compared with last week!"
        )

    direction = "more" if change_percent >= 0 else "fewer"
    absolute = abs(change_percent)
    return (
        f"You've completed {this_week} tasks this week, "
        f"that's {absolute}% {direction} than last week!"
    )


def get_insights_summary(db: Session, user: User) -> InsightsSummaryResponse:
    now = _utc_now()
    this_start, this_end, last_start, last_end = _week_bounds(now)

    this_week = _count_completed(db, user.id, start=this_start, end=this_end)
    last_week = _count_completed(db, user.id, start=last_start, end=last_end)
    change_percent = _week_over_week_change(this_week, last_week)
    estimated_work_minutes = _estimated_work_minutes(
        db,
        user.id,
        start=this_start,
        end=this_end,
    )
    goal_progress = _goal_progress_percent(
        db,
        user.id,
        start=this_start,
        end=this_end,
    )
    streak_days = _current_streak_days(db, user.id, reference=now)
    trend = _trend_points(db, user.id, reference=now)

    high_priority_open = int(
        db.scalar(
            select(func.count())
            .select_from(Task)
            .where(
                Task.user_id == user.id,
                Task.status != TaskStatus.DONE,
                Task.priority == TaskPriority.HIGH,
            )
        )
        or 0
    )

    first_name = (user.first_name or "").strip() or "there"
    greeting = f"You're doing great, {first_name}!"

    return InsightsSummaryResponse(
        user_first_name=first_name,
        greeting=greeting,
        weekly_summary_text=_weekly_summary_text(
            this_week=this_week,
            change_percent=change_percent,
        ),
        tasks_completed_this_week=this_week,
        tasks_completed_last_week=last_week,
        week_over_week_change_percent=change_percent,
        estimated_work_minutes_this_week=estimated_work_minutes,
        estimated_work_time_label=_format_estimated_work_label(
            estimated_work_minutes,
        ),
        goal_progress_percent=goal_progress,
        current_streak_days=streak_days,
        trend=trend,
        recommendations=_build_recommendations(
            streak_days=streak_days,
            this_week_completed=this_week,
            high_priority_open=high_priority_open,
            estimated_work_minutes=estimated_work_minutes,
        ),
        motivational_quote="Discipline today, success tomorrow. — Keep it up!",
        footer_message=(
            "Small steps every day lead to amazing results. "
            "Trust the process. You're building a better you."
        ),
    )
