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
from app.focus.models import FocusSession
from app.scheduling import service as scheduling_service
from app.settings import service as settings_service
from app.tasks.models import Task, TaskPriority, TaskStatus
from app.timezones import user_timezone

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


def _week_bounds(
    reference: datetime,
    timezone_name: str = "UTC",
) -> tuple[datetime, datetime, datetime, datetime]:
    timezone = user_timezone(timezone_name)
    today = _as_utc(reference).astimezone(timezone).date()
    this_week_start = _start_of_week(today)
    next_week_start = this_week_start + timedelta(days=7)
    last_week_start = this_week_start - timedelta(days=7)

    this_start = datetime.combine(this_week_start, datetime.min.time(), timezone).astimezone(UTC)
    this_end = datetime.combine(next_week_start, datetime.min.time(), timezone).astimezone(UTC)
    last_start = datetime.combine(last_week_start, datetime.min.time(), timezone).astimezone(UTC)
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


def _completion_rate(
    db: Session,
    user_id,
    *,
    start: datetime,
    as_of: datetime,
    completed_count: int,
) -> float:
    total_tasks_count = int(
        db.scalar(
            select(func.count())
            .select_from(Task)
            .where(
                Task.user_id == user_id,
                Task.created_at < as_of,
                (Task.completed_at.is_(None)) | (Task.completed_at >= start),
            )
        )
        or 0
    )
    return completed_count / total_tasks_count if total_tasks_count else 0


def _unfinished_workload_minutes(
    db: Session,
    user_id,
    *,
    period_start: datetime,
    period_end: datetime,
    as_of: datetime,
) -> int:
    return int(
        db.scalar(
            select(func.coalesce(func.sum(Task.estimated_duration_minutes), 0)).where(
                Task.user_id == user_id,
                Task.created_at < as_of,
                (Task.completed_at.is_(None)) | (Task.completed_at >= as_of),
                (
                    ((Task.due_date >= period_start) & (Task.due_date < period_end))
                    | ((Task.scheduled_start >= period_start) & (Task.scheduled_start < period_end))
                    | ((Task.created_at >= period_start) & (Task.created_at < as_of))
                ),
            )
        )
        or 0
    )


def _estimated_work_minutes(
    db: Session,
    user_id,
    *,
    start: datetime,
    end: datetime,
) -> int:
    tasks = list(db.scalars(_completed_tasks_query(user_id, start=start, end=end)).all())

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


def _current_streak_days(
    db: Session, user_id, *, reference: datetime, timezone_name: str = "UTC"
) -> int:
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
        _as_utc(task.completed_at).astimezone(user_timezone(timezone_name)).date()
        for task in tasks
        if task.completed_at is not None and _as_utc(task.completed_at) <= _as_utc(reference)
    }

    if not completed_days:
        return 0

    streak = 0
    cursor = _as_utc(reference).astimezone(user_timezone(timezone_name)).date()

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
    timezone_name: str = "UTC",
) -> list[InsightTrendPoint]:
    timezone = user_timezone(timezone_name)
    end_day = _as_utc(reference).astimezone(timezone).date()
    start_day = end_day - timedelta(days=days - 1)
    start = datetime.combine(start_day, datetime.min.time(), timezone).astimezone(UTC)
    end = datetime.combine(end_day + timedelta(days=1), datetime.min.time(), timezone).astimezone(
        UTC
    )

    tasks = list(db.scalars(_completed_tasks_query(user_id, start=start, end=end)).all())

    counts: dict[date, int] = {start_day + timedelta(days=offset): 0 for offset in range(days)}

    for task in tasks:
        if task.completed_at is None:
            continue

        day = _as_utc(task.completed_at).astimezone(timezone).date()
        if day in counts:
            counts[day] += 1

    return [
        InsightTrendPoint(date=day, completed_count=count) for day, count in sorted(counts.items())
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
            f"You've completed {this_week} tasks this week — great start compared with last week!"
        )

    direction = "more" if change_percent >= 0 else "fewer"
    absolute = abs(change_percent)
    return (
        f"You've completed {this_week} tasks this week, "
        f"that's {absolute}% {direction} than last week!"
    )


def get_insights_summary(
    db: Session,
    user: User,
    *,
    client_timezone_name: str | None = None,
) -> InsightsSummaryResponse:
    now = _utc_now()
    timezone_name = settings_service.timezone_name_for_user(
        db,
        user.id,
        detected_timezone=client_timezone_name,
    )
    this_start, this_end, last_start, last_end = _week_bounds(now, timezone_name)

    this_week = _count_completed(db, user.id, start=this_start, end=this_end)
    last_week = _count_completed(db, user.id, start=last_start, end=last_end)
    change_percent = _week_over_week_change(this_week, last_week)
    completion_rate = _completion_rate(
        db,
        user.id,
        start=this_start,
        as_of=now,
        completed_count=this_week,
    )
    unfinished_workload_minutes = _unfinished_workload_minutes(
        db,
        user.id,
        period_start=this_start,
        period_end=this_end,
        as_of=now,
    )
    estimated_work_minutes = _estimated_work_minutes(
        db,
        user.id,
        start=this_start,
        end=this_end,
    )
    focus_sessions = list(
        db.scalars(
            select(FocusSession).where(
                FocusSession.user_id == user.id,
                FocusSession.started_at < now,
                FocusSession.actual_duration_seconds > 0,
            )
        ).all()
    )
    focus_duration_minutes = int(
        sum(
            _session_seconds_in_window(session, this_start, now)
            for session in focus_sessions
        )
        / 60
    )
    goal_progress = _goal_progress_percent(
        db,
        user.id,
        start=this_start,
        end=this_end,
    )
    streak_days = _current_streak_days(
        db,
        user.id,
        reference=now,
        timezone_name=timezone_name,
    )
    trend = _trend_points(
        db,
        user.id,
        reference=this_end - timedelta(microseconds=1),
        timezone_name=timezone_name,
    )

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
        period_start=this_start,
        period_end=this_end,
        timezone=timezone_name,
        user_first_name=first_name,
        greeting=greeting,
        weekly_summary_text=_weekly_summary_text(
            this_week=this_week,
            change_percent=change_percent,
        ),
        tasks_completed_this_week=this_week,
        tasks_completed_last_week=last_week,
        week_over_week_change_percent=change_percent,
        completion_rate_this_week=completion_rate,
        unfinished_workload_minutes_this_week=unfinished_workload_minutes,
        estimated_work_minutes_this_week=estimated_work_minutes,
        estimated_work_time_label=_format_estimated_work_label(
            estimated_work_minutes,
        ),
        focus_duration_minutes_this_week=focus_duration_minutes,
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


def _previous_week_bounds(reference: datetime, timezone_name: str) -> tuple[datetime, datetime]:
    timezone = user_timezone(timezone_name)
    end_day = _start_of_week(_as_utc(reference).astimezone(timezone).date())
    start_day = end_day - timedelta(days=7)
    return (
        datetime.combine(start_day, datetime.min.time(), timezone).astimezone(UTC),
        datetime.combine(end_day, datetime.min.time(), timezone).astimezone(UTC),
    )


def _focus_seconds(session: FocusSession) -> int:
    # Zero is an actual measurement, not a missing value or a planned duration.
    return max(0, session.actual_duration_seconds or 0)


def _session_seconds_in_window(session: FocusSession, start: datetime, end: datetime) -> float:
    seconds = _focus_seconds(session)
    session_start = _as_utc(session.started_at)
    session_end = (
        _as_utc(session.ended_at)
        if session.ended_at is not None
        else session_start + timedelta(seconds=seconds)
    )
    elapsed = (session_end - session_start).total_seconds()
    if not seconds or elapsed <= 0:
        return 0.0
    overlap = max(0, (min(end, session_end) - max(start, session_start)).total_seconds())
    # Pause timestamps are unavailable: distribute recorded active time uniformly.
    return seconds * overlap / elapsed


def _duration_comparison(completed_tasks: list[Task], sessions: list[FocusSession]):
    actual_by_task: dict = {}
    ambiguous_tasks: set = set()
    for session in sessions:
        task_ids = {task.id for task in session.tasks}
        if session.task_id is not None:
            task_ids.add(session.task_id)
        if len(task_ids) > 1:
            ambiguous_tasks.update(task_ids)
        elif len(task_ids) == 1:
            task_id = next(iter(task_ids))
            actual_by_task[task_id] = actual_by_task.get(task_id, 0) + _focus_seconds(session)
    eligible = [
        task
        for task in completed_tasks
        if task.estimated_duration_minutes is not None
        and task.estimated_duration_minutes > 0
        and actual_by_task.get(task.id, 0) > 0
        and task.id not in ambiguous_tasks
    ]
    estimated = sum(task.estimated_duration_minutes for task in eligible)
    actual_seconds = sum(actual_by_task[task.id] for task in eligible)
    # Sum per-task absolute errors so over- and under-estimates cannot cancel out.
    absolute_error = sum(
        abs(task.estimated_duration_minutes * 60 - actual_by_task[task.id]) for task in eligible
    )
    accuracy = (
        max(0, round((1 - absolute_error / (estimated * 60)) * 100, 2)) if estimated else None
    )
    return estimated, actual_seconds // 60, accuracy, len(eligible)


def get_weekly_productivity_metrics(
    db: Session,
    user_id,
    *,
    period_start: datetime,
    period_end: datetime,
    timezone_name: str = "UTC",
) -> WeeklyMetrics:
    timezone = user_timezone(timezone_name)
    completed_tasks = list(
        db.scalars(_completed_tasks_query(user_id, start=period_start, end=period_end)).all()
    )
    completion_rate = _completion_rate(
        db,
        user_id,
        start=period_start,
        as_of=period_end,
        completed_count=len(completed_tasks),
    )
    # Include full history for matched-task estimates, and sessions crossing week boundaries.
    sessions = list(
        db.scalars(
            select(FocusSession).where(
                FocusSession.user_id == user_id,
                FocusSession.started_at < period_end,
                FocusSession.actual_duration_seconds > 0,
            )
        ).all()
    )
    focus_seconds = sum(
        _session_seconds_in_window(session, period_start, period_end) for session in sessions
    )
    workload_minutes = _unfinished_workload_minutes(
        db,
        user_id,
        period_start=period_start,
        period_end=period_end,
        as_of=period_end,
    )
    # Only finished sessions available by the report end may enter the comparison.
    history = [
        session
        for session in sessions
        if (
            _as_utc(session.ended_at)
            if session.ended_at is not None
            else _as_utc(session.started_at) + timedelta(seconds=_focus_seconds(session))
        )
        <= period_end
    ]
    estimated, actual, accuracy, compared_count = _duration_comparison(completed_tasks, history)
    days = {}
    start_day = period_start.astimezone(timezone).date()
    end_day = period_end.astimezone(timezone).date()
    for offset in range((end_day - start_day).days):
        day = start_day + timedelta(days=offset)
        start = datetime.combine(day, datetime.min.time(), timezone).astimezone(UTC)
        end = datetime.combine(day + timedelta(days=1), datetime.min.time(), timezone).astimezone(
            UTC
        )
        days[day] = DailyProductivityPoint(
            date=day,
            completed_count=sum(
                _as_utc(task.completed_at).astimezone(timezone).date() == day
                for task in completed_tasks
            ),
            focus_minutes=int(
                sum(_session_seconds_in_window(s, start, end) for s in sessions) / 60
            ),
        )
    hours = {hour: {"completed_count": 0, "seconds": 0.0} for hour in range(24)}
    for task in completed_tasks:
        hours[_as_utc(task.completed_at).astimezone(timezone).hour]["completed_count"] += 1
    # Walk real instants in minute buckets: repeated/skipped DST hours and half-hour
    # timezone offsets are assigned to the correct local hour.
    for session in sessions:
        session_start = _as_utc(session.started_at)
        session_end = (
            _as_utc(session.ended_at)
            if session.ended_at is not None
            else session_start + timedelta(seconds=_focus_seconds(session))
        )
        cursor = max(period_start, session_start)
        stop = min(period_end, session_end)
        while cursor < stop and _focus_seconds(session):
            # Align to minute boundaries even when the session starts mid-minute.
            end = min(cursor.replace(second=0, microsecond=0) + timedelta(minutes=1), stop)
            hours[cursor.astimezone(timezone).hour]["seconds"] += _session_seconds_in_window(
                session,
                cursor,
                end,
            )
            cursor = end
    return WeeklyMetrics(
        period_start=period_start,
        period_end=period_end,
        timezone=timezone_name,
        focus_time_attribution=(
            "Active time distributed across session elapsed time; pause intervals unavailable."
        ),
        completion_rate=completion_rate,
        completed_task_count=len(completed_tasks),
        focus_duration_minutes=int(focus_seconds / 60),
        workload_minutes=workload_minutes,
        current_streak_days=_current_streak_days(
            db,
            user_id,
            reference=period_end - timedelta(microseconds=1),
            timezone_name=timezone_name,
        ),
        estimated_minutes=estimated,
        actual_minutes=actual,
        estimate_accuracy_percent=accuracy,
        duration_comparison_task_count=compared_count,
        duration_comparison_excluded_task_count=len(completed_tasks) - compared_count,
        productivity_trend=list(days.values()),
        productive_hours=[
            HourlyProductivityPoint(
                hour=hour,
                completed_count=values["completed_count"],
                focus_minutes=int(values["seconds"] / 60),
            )
            for hour, values in hours.items()
            if values["completed_count"] or values["seconds"]
        ],
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
    client_timezone_name: str | None = None,
) -> WeeklyInsightResponse:
    # Serialize generation across API workers. NO KEY UPDATE permits telemetry's
    # foreign-key checks against this user while the AI call is in progress.
    try:
        db.execute(
            select(User.id).where(User.id == user.id).with_for_update(key_share=True)
        ).scalar_one()
        response = _get_or_create_locked_weekly_insight(
            db,
            user,
            ai_service=ai_service,
            reference=reference,
            client_timezone_name=client_timezone_name,
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
    client_timezone_name: str | None = None,
) -> WeeklyInsightResponse:
    now = reference or _utc_now()
    timezone_name = settings_service.timezone_name_for_user(
        db,
        user.id,
        detected_timezone=client_timezone_name,
    )
    period_start, period_end = _previous_week_bounds(now, timezone_name)
    cache_week_start = _start_of_week(
        _as_utc(now).astimezone(user_timezone(timezone_name)).date()
    )

    # Cache first: page refreshes and repeated logins must reuse this week's row
    existing = db.scalar(
        select(WeeklyAIInsight).where(
            WeeklyAIInsight.user_id == user.id,
            WeeklyAIInsight.cache_week_start == cache_week_start,
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
        timezone_name=timezone_name,
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
        cache_week_start=cache_week_start,
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
                WeeklyAIInsight.cache_week_start == cache_week_start,
            )
        )
        if existing is None:
            raise
        return _weekly_insight_response(existing, cached=True)

    db.refresh(insight)
    return _weekly_insight_response(insight, cached=False)
