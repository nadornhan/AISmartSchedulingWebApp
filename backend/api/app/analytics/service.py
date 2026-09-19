from __future__ import annotations

import json
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.ai import AIFeature, AIService, get_ai_service
from app.analytics.models import WeeklyAIInsight
from app.analytics.schemas import (
    DailyProductivityPoint,
    HourlyProductivityPoint,
    InsightRecommendation,
    InsightsSummaryResponse,
    InsightTrendPoint,
    WeeklyInsightNarrative,
    WeeklyInsightResponse,
    WeeklyMetrics,
)
from app.auth.models import User
from app.focus.models import FocusSession, FocusSessionStatus
from app.scheduling import service as scheduling_service
from app.tasks.models import Task, TaskPriority, TaskStatus

TREND_DAYS = 7
WEEKLY_INSIGHTS_PROMPT_VERSION = "weekly-insights-v1"


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
        Task.completed_at.is_not(None),
    )

    if start is not None:
        statement = statement.where(Task.completed_at >= start)
    if end is not None:
        statement = statement.where(Task.completed_at < end)

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
            Task.completed_at.is_not(None),
            Task.completed_at >= start,
            Task.completed_at < end,
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
        _as_utc(task.completed_at).date()
        for task in tasks
        if task.completed_at is not None
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
        if task.completed_at is None:
            continue

        day = _as_utc(task.completed_at).date()
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
    scheduling_plan = scheduling_service.generate_plan(db, user.id, force=False)
    recommendations = _build_recommendations(
        streak_days=streak_days,
        this_week_completed=this_week,
        high_priority_open=high_priority_open,
        estimated_work_minutes=estimated_work_minutes,
    )
    if scheduling_plan.recommendation is not None:
        recommendations.insert(
            0,
            InsightRecommendation(
                id=str(scheduling_plan.recommendation.id),
                category="schedule",
                title=scheduling_plan.recommendation.title,
                description=scheduling_plan.recommendation.explanation,
                cta_label="Review schedule",
            ),
        )

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
        recommendations=recommendations[:4],
        scheduling_plan=scheduling_plan,
        motivational_quote="Discipline today, success tomorrow. — Keep it up!",
        footer_message=(
            "Small steps every day lead to amazing results. "
            "Trust the process. You're building a better you."
        ),
        footnote="AI based on your patterns",
    )

def _focus_session_minutes(session: FocusSession) -> int:
    # Prefer the actual timer result; Go back to the planned duration for older rows
    if session.actual_duration_seconds:
        return max(0, session.actual_duration_seconds // 60)

    return max(0, session.duration_minutes)

def _productivity_trend_points(
        completed_tasks: list[Task],
        focus_sessions: list[FocusSession],
        *,
        period_start: datetime,
        period_end: datetime,
) -> list[DailyProductivityPoint]:
    # Build a day-by-day series so charts still show days with no activity
    day_count = (period_end.date() - period_start.date()).days

    points_by_day: dict[date, dict[str, int]] = {
        period_start.date() + timedelta(days=offset): {
            "completed_count": 0,
            "focus_minutes": 0
        }
        for offset in range(day_count)
    }

    for task in completed_tasks:
        if task.completed_at is None:
            continue

        completed_day = _as_utc(task.completed_at).date()

        if completed_day in points_by_day:
            points_by_day[completed_day]["completed_count"] += 1

    for session in focus_sessions:
        session_day = _as_utc(session.started_at).date()

        if session_day in points_by_day:
            points_by_day[session_day]["focus_minutes"] += _focus_session_minutes(session)

    return [
        DailyProductivityPoint(
            date=day,
            completed_count=values["completed_count"],
            focus_minutes=values["focus_minutes"]
        )
        for day, values in sorted(points_by_day.items())
    ]

def _productive_hour_points(
    completed_tasks: list[Task],
    focus_sessions: list[FocusSession],
) -> list[HourlyProductivityPoint]:
    # Group completed tasks and focus time by UTC hour to identify productive hours
    points_by_hour: dict[int, dict[str, int]] = {
        hour: {
            "completed_count": 0,
            "focus_minutes": 0,
        }
        for hour in range(24)
    }

    for task in completed_tasks:
        if task.completed_at is None:
            continue

        completed_hour = _as_utc(task.completed_at).hour
        points_by_hour[completed_hour]["completed_count"] += 1

    for session in focus_sessions:
        started_hour = _as_utc(session.started_at).hour
        points_by_hour[started_hour]["focus_minutes"] += _focus_session_minutes(session)

    return [
        HourlyProductivityPoint(
            hour=hour,
            completed_count=values["completed_count"],
            focus_minutes=values["focus_minutes"],
        )
        for hour, values in sorted(points_by_hour.items())

        # If you want frontend chart to always show all 24 hours, remove the following line:
        if values["completed_count"] > 0 or values["focus_minutes"] > 0
    ]

def get_weekly_productivity_metrics(
    db: Session,
    user_id,
    *,
    period_start: datetime,
    period_end: datetime,
) -> WeeklyMetrics:
    # Completed tasks are the base for completion count, estimates, and trends
    completed_tasks = list(
        db.scalars(
            _completed_tasks_query(user_id, start=period_start, end=period_end)
        ).all()
    )
    completed_tasks_count = len(completed_tasks)

    # Count tasks active in the period so completion rate is bounded to this week
    total_tasks_count = db.scalar(
        select(func.count())
        .select_from(Task)
        .where(
            Task.user_id == user_id,
            Task.created_at < period_end,
            (Task.completed_at.is_(None)) | (Task.completed_at >= period_start),
        )
    ) or 0

    if total_tasks_count:
        completion_rate = completed_tasks_count / total_tasks_count
    else:
        completion_rate = 0

    # Only completed focus sessions count toward productive focus time
    focus_sessions = list(
        db.scalars(
            select(FocusSession).where(
                FocusSession.user_id == user_id,
                FocusSession.started_at >= period_start,
                FocusSession.started_at < period_end,
                FocusSession.status == FocusSessionStatus.COMPLETED.value,
            )
        ).all()
    )

    focus_duration_minutes = sum(
        _focus_session_minutes(session)
        for session in focus_sessions
    )

    # Weekly workload is open estimated work that is due, scheduled, or created this week.
    workload_minutes = db.scalar(
        select(func.coalesce(func.sum(Task.estimated_duration_minutes), 0))
        .where(
            Task.user_id == user_id,
            Task.status != TaskStatus.DONE,
            (
                (
                    Task.due_date.is_not(None)
                    & (Task.due_date >= period_start)
                    & (Task.due_date < period_end)
                )
                | (
                    Task.scheduled_start.is_not(None)
                    & (Task.scheduled_start >= period_start)
                    & (Task.scheduled_start < period_end)
                )
                | (
                    (Task.created_at >= period_start)
                    & (Task.created_at < period_end)
                )
            ),
        )
    ) or 0

    current_streak_days = _current_streak_days(db, user_id, reference=_utc_now())
    estimated_minutes = _estimated_work_minutes(db, user_id, start=period_start, end=period_end)

    completed_task_ids = {task.id for task in completed_tasks}

    # Compare estimates only against focus sessions linked to tasks completed this week
    actual_minutes = sum(
        _focus_session_minutes(session)
        for session in focus_sessions
        if session.task_id in completed_task_ids
    )

    estimate_accuracy_percent = None
    if estimated_minutes > 0 and actual_minutes > 0:
        difference = abs(estimated_minutes - actual_minutes)
        estimate_accuracy_percent = max(0, round((1 - difference / estimated_minutes)*100, 2))

    productivity_trend = _productivity_trend_points(
        completed_tasks,
        focus_sessions,
        period_start=period_start,
        period_end=period_end
    )

    productive_hours = _productive_hour_points(
        completed_tasks,
        focus_sessions,
    )

    return WeeklyMetrics(
        period_start=period_start,
        period_end=period_end,
        completion_rate=completion_rate,
        completed_task_count=completed_tasks_count,
        focus_duration_minutes=focus_duration_minutes,
        workload_minutes=workload_minutes,
        current_streak_days=current_streak_days,
        estimated_minutes=estimated_minutes,
        actual_minutes=actual_minutes,
        estimate_accuracy_percent=estimate_accuracy_percent,
        productivity_trend=productivity_trend,
        productive_hours=productive_hours,
    )


def _weekly_insight_response(
    insight: WeeklyAIInsight,
    *,
    cached: bool,
) -> WeeklyInsightResponse:
    # Return the stored metrics response so the UI shows exactly what Gemini saw.
    return WeeklyInsightResponse(
        period_start=insight.period_start,
        period_end=insight.period_end,
        metrics=WeeklyMetrics.model_validate(insight.metrics),
        narrative=insight.narrative,
        generated_at=insight.created_at,
        model=insight.model,
        prompt_version=insight.prompt_version,
        cached=cached,
    )


def _build_weekly_insight_prompt(metrics: WeeklyMetrics) -> str:
    # Gemini receives aggregated metrics, never raw task titles/descriptions
    metrics_json = json.dumps(
        metrics.model_dump(mode="json"),
        sort_keys=True,
        separators=(",", ":"),
    )
    return (
        "Write one concise weekly productivity insight for a student. "
        "Use only the aggregated metrics JSON below. Do not infer task titles, "
        "project names, descriptions, or private personal details. Mention one "
        "positive pattern and one practical next step. Return JSON matching the "
        "response schema.\n\n"
        f"Aggregated metrics JSON: {metrics_json}"
    )


def _fallback_weekly_narrative(metrics: WeeklyMetrics) -> WeeklyInsightNarrative:
    # Keep the endpoint when Gemini is disabled, unavailable, or rate-limited.
    if metrics.completed_task_count == 0 and metrics.focus_duration_minutes == 0:
        narrative = (
            "No completed tasks or focus time were recorded for this period yet. "
            "Start with one short focus block and finish one small task to build momentum!"
        )
    elif metrics.estimate_accuracy_percent is not None:
        narrative = (
            f"You completed {metrics.completed_task_count} tasks and logged "
            f"{metrics.focus_duration_minutes} minutes of focus time. Your estimate "
            f"accuracy was about {metrics.estimate_accuracy_percent:.0f}%, so use that "
            "as a guide when planning next week."
        )
    else:
        narrative = (
            f"You completed {metrics.completed_task_count} tasks and logged "
            f"{metrics.focus_duration_minutes} minutes of focus time. Keep your momentum "
            "by placing the highest workload into your strongest productive hours."
        )
    return WeeklyInsightNarrative(narrative=narrative)


def get_or_create_weekly_insight(
    db: Session,
    user: User,
    *,
    ai_service: AIService | None = None,
    reference: datetime | None = None,
) -> WeeklyInsightResponse:
    # Serialize generation across API workers. NO KEY UPDATE permits telemetry's
    # foreign-key checks against this user while the AI call is in progress.
    try:
        db.execute(
            select(User.id).where(User.id == user.id).with_for_update(key_share=True)
        ).scalar_one()
        response = _get_or_create_locked_weekly_insight(
            db, user, ai_service=ai_service, reference=reference
        )
        # Cached reads also need to release the transaction's row lock.
        db.commit()
        return response
    except Exception:
        db.rollback()
        raise


def _get_or_create_locked_weekly_insight(
    db: Session,
    user: User,
    *,
    ai_service: AIService | None = None,
    reference: datetime | None = None,
) -> WeeklyInsightResponse:
    now = reference or _utc_now()
    period_start, period_end, _last_start, _last_end = _week_bounds(now)

    # Cache first: page refreshes and repeated logins must reuse this week's row
    existing = db.scalar(
        select(WeeklyAIInsight).where(
            WeeklyAIInsight.user_id == user.id,
            WeeklyAIInsight.period_start == period_start,
            WeeklyAIInsight.period_end == period_end,
        )
    )
    if existing is not None:
        return _weekly_insight_response(existing, cached=True)

    # No cache exists yet, so calculate metrics and generate one narrative
    metrics = get_weekly_productivity_metrics(
        db,
        user.id,
        period_start=period_start,
        period_end=period_end,
    )

    result = (ai_service or get_ai_service()).generate_structured(
        user_key=str(user.id),
        prompt=_build_weekly_insight_prompt(metrics),
        response_schema=WeeklyInsightNarrative,
        feature=AIFeature.WEEKLY_INSIGHTS,
        prompt_version=WEEKLY_INSIGHTS_PROMPT_VERSION,
        fallback=lambda: _fallback_weekly_narrative(metrics),
    )

    insight = WeeklyAIInsight(
        user_id=user.id,
        period_start=period_start,
        period_end=period_end,
        metrics=metrics.model_dump(mode="json"),
        narrative=result.data.narrative,
        model=result.metadata.model,
        prompt_version=result.metadata.prompt_version,
    )

    db.add(insight)

    try:
        db.commit()
    except IntegrityError:
        # If two requests generate at once, the unique constraint lets one win
        db.rollback()
        existing = db.scalar(
            select(WeeklyAIInsight).where(
                WeeklyAIInsight.user_id == user.id,
                WeeklyAIInsight.period_start == period_start,
                WeeklyAIInsight.period_end == period_end,
            )
        )
        if existing is None:
            raise
        return _weekly_insight_response(existing, cached=True)

    db.refresh(insight)
    return _weekly_insight_response(insight, cached=False)
