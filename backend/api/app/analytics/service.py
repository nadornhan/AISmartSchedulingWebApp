from __future__ import annotations

import json
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.ai import AIFeature, AIService, get_ai_service

# Re-export existing service helpers for callers and regression coverage.
from app.analytics.metrics import (  # noqa: F401
    TREND_DAYS,
    _as_utc,
    _completed_tasks_query,
    _completion_rate,
    _count_completed,
    _current_streak_days,
    _duration_comparison,
    _estimated_work_minutes,
    _focus_seconds,
    _format_estimated_work_label,
    _goal_progress_percent,
    _previous_week_bounds,
    _session_seconds_in_window,
    _start_of_week,
    _trend_points,
    _unfinished_workload_minutes,
    _utc_now,
    _week_bounds,
    _week_over_week_change,
    get_weekly_productivity_metrics,
)
from app.analytics.models import WeeklyAIInsight
from app.analytics.schemas import (
    InsightRecommendation,
    InsightsSummaryResponse,
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

WEEKLY_INSIGHTS_PROMPT_VERSION = "weekly-insights-v1"


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
    include_schedule: bool = True,
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
    # The review page only displays metrics; avoid rebuilding a full schedule
    # unless the caller actually needs the optional scheduling payload.
    scheduling_plan = (
        scheduling_service.generate_plan(db, user.id, force=False) if include_schedule else None
    )
    recommendations = _build_recommendations(
        streak_days=streak_days,
        this_week_completed=this_week,
        high_priority_open=high_priority_open,
        estimated_work_minutes=estimated_work_minutes,
    )
    if scheduling_plan is not None and scheduling_plan.recommendation is not None:
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
