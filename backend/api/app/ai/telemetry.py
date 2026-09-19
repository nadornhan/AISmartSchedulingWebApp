from __future__ import annotations

import hashlib
import json
import logging
import uuid
from collections.abc import Callable, Iterable
from datetime import datetime
from typing import Protocol

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.ai.models import AIGenerationEvent
from app.ai.schemas import AIUsageEvent, AIUsageFeatureSummary
from app.scheduling.models import AiScheduleSuggestion, ScheduleSuggestionStatus

logger = logging.getLogger(__name__)

# Prices are USD per 1M tokens. Fill these from the official model pricing used by the app.
DEFAULT_MODEL_TOKEN_PRICES_USD_PER_1M = {
    "gemini-3.5-flash-lite": {
        "input": 0.0,
        "output": 0.0,
    },
}

SCHEDULING_ACCEPTANCE_FEATURES = {
    "schedule_preview",
    "intelligent_rescheduling",
}


class AITelemetryRecorder(Protocol):
    def record(self, event: AIUsageEvent) -> None: ...


class LoggingAITelemetryRecorder:
    def record(self, event: AIUsageEvent) -> None:
        payload = event.model_dump(mode="json", exclude={"user_key"})
        payload["event"] = "ai_generation"
        payload["user_ref"] = hashlib.sha256(event.user_key.encode()).hexdigest()[:12]
        logger.info("%s", json.dumps(payload, separators=(",", ":"), sort_keys=True))


class CompositeAITelemetryRecorder:
    def __init__(self, recorders: Iterable[AITelemetryRecorder]) -> None:
        self.recorders = tuple(recorders)

    def record(self, event: AIUsageEvent) -> None:
        for recorder in self.recorders:
            recorder.record(event)


class DatabaseAITelemetryRecorder:
    """Persist telemetry in an independent transaction from feature mutations."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self.session_factory = session_factory

    def record(self, event: AIUsageEvent) -> None:
        with self.session_factory() as session:
            persist_ai_usage_event(session, event)
            session.commit()


def persist_ai_usage_event(db: Session, event: AIUsageEvent) -> AIGenerationEvent:
    record = AIGenerationEvent(
        user_id=uuid.UUID(event.user_key),
        feature=event.feature,
        prompt_version=event.prompt_version,
        outcome=event.outcome,
        source=event.source,
        model=event.model,
        latency_ms=event.latency_ms,
        input_tokens=event.usage.input_tokens,
        output_tokens=event.usage.output_tokens,
        thinking_tokens=event.usage.thinking_tokens,
        total_tokens=event.usage.total_tokens,
        error_code=event.error_code,
        created_at=event.created_at,
    )
    db.add(record)
    db.flush()
    return record


def _estimated_model_cost_usd(
    *,
    model: str,
    input_tokens: int,
    output_tokens: int,
    thinking_tokens: int,
    model_token_prices_usd_per_1m: dict[str, dict[str, float]],
) -> float:
    prices = model_token_prices_usd_per_1m.get(model, {})
    billable_output_tokens = output_tokens + thinking_tokens
    return (
        (input_tokens / 1_000_000) * prices.get("input", 0.0)
        + (billable_output_tokens / 1_000_000) * prices.get("output", 0.0)
    )


def _scheduling_acceptance_rate(
    db: Session,
    user_id: uuid.UUID,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
) -> float | None:
    accepted_statuses = {
        ScheduleSuggestionStatus.ACCEPTED.value,
        ScheduleSuggestionStatus.APPLIED.value,
    }
    decided_statuses = {
        *accepted_statuses,
        ScheduleSuggestionStatus.DISMISSED.value,
    }

    statement = select(
        func.sum(case((AiScheduleSuggestion.status.in_(accepted_statuses), 1), else_=0)),
        func.sum(case((AiScheduleSuggestion.status.in_(decided_statuses), 1), else_=0)),
    ).where(AiScheduleSuggestion.user_id == user_id)
    if start is not None:
        statement = statement.where(AiScheduleSuggestion.generated_at >= start)
    if end is not None:
        statement = statement.where(AiScheduleSuggestion.generated_at < end)

    accepted_count, decided_count = db.execute(statement).one()
    accepted_count = accepted_count or 0
    decided_count = decided_count or 0
    if decided_count == 0:
        return None

    return round(accepted_count / decided_count, 4)


def summarize_ai_usage(
    db: Session,
    user_id: uuid.UUID,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    model_token_prices_usd_per_1m: dict[str, dict[str, float]] | None = None,
) -> list[AIUsageFeatureSummary]:
    model_prices = model_token_prices_usd_per_1m or DEFAULT_MODEL_TOKEN_PRICES_USD_PER_1M
    acceptance_rate = _scheduling_acceptance_rate(
        db,
        user_id,
        start=start,
        end=end,
    )
    statement = select(
        AIGenerationEvent.feature,
        AIGenerationEvent.model,
        func.count(AIGenerationEvent.id),
        func.sum(case((AIGenerationEvent.outcome == "success", 1), else_=0)),
        func.sum(case((AIGenerationEvent.outcome == "fallback", 1), else_=0)),
        func.sum(case((AIGenerationEvent.outcome == "failure", 1), else_=0)),
        func.coalesce(func.sum(AIGenerationEvent.input_tokens), 0),
        func.coalesce(func.sum(AIGenerationEvent.output_tokens), 0),
        func.coalesce(func.sum(AIGenerationEvent.thinking_tokens), 0),
        func.coalesce(func.sum(AIGenerationEvent.total_tokens), 0),
        func.coalesce(func.avg(AIGenerationEvent.latency_ms), 0),
    ).where(AIGenerationEvent.user_id == user_id)
    if start is not None:
        statement = statement.where(AIGenerationEvent.created_at >= start)
    if end is not None:
        statement = statement.where(AIGenerationEvent.created_at < end)

    rows = db.execute(
        statement.group_by(AIGenerationEvent.feature, AIGenerationEvent.model)
    ).all()
    by_feature: dict[str, dict[str, float | int]] = {}
    for (
        feature,
        model,
        request_count,
        success_count,
        fallback_count,
        failure_count,
        input_tokens,
        output_tokens,
        thinking_tokens,
        total_tokens,
        average_latency_ms,
    ) in rows:
        request_count = request_count or 0
        fallback_count = fallback_count or 0
        failure_count = failure_count or 0
        feature_totals = by_feature.setdefault(
            feature,
            {
                "request_count": 0,
                "success_count": 0,
                "fallback_count": 0,
                "failure_count": 0,
                "total_tokens": 0,
                "latency_total_ms": 0.0,
                "estimated_cost_usd": 0.0,
            },
        )
        feature_totals["request_count"] += request_count
        feature_totals["success_count"] += success_count or 0
        feature_totals["fallback_count"] += fallback_count
        feature_totals["failure_count"] += failure_count
        feature_totals["total_tokens"] += total_tokens or 0
        feature_totals["latency_total_ms"] += float(average_latency_ms or 0) * request_count
        feature_totals["estimated_cost_usd"] += _estimated_model_cost_usd(
            model=model,
            input_tokens=input_tokens or 0,
            output_tokens=output_tokens or 0,
            thinking_tokens=thinking_tokens or 0,
            model_token_prices_usd_per_1m=model_prices,
        )

    summaries: list[AIUsageFeatureSummary] = []
    for feature, totals in by_feature.items():
        request_count = int(totals["request_count"])
        fallback_count = int(totals["fallback_count"])
        failure_count = int(totals["failure_count"])
        feature_acceptance_rate = (
            acceptance_rate
            if feature in SCHEDULING_ACCEPTANCE_FEATURES
            else None
        )
        summaries.append(
            AIUsageFeatureSummary(
                feature=feature,
                request_count=request_count,
                success_count=int(totals["success_count"]),
                fallback_count=fallback_count,
                failure_count=failure_count,
                total_tokens=int(totals["total_tokens"]),
                average_latency_ms=round(
                    float(totals["latency_total_ms"]) / request_count,
                    2,
                )
                if request_count
                else 0,
                fallback_rate=round(fallback_count / request_count, 4)
                if request_count
                else 0,
                failure_rate=round(failure_count / request_count, 4)
                if request_count
                else 0,
                estimated_cost_usd=round(float(totals["estimated_cost_usd"]), 6),
                acceptance_rate=feature_acceptance_rate,
            )
        )

    return summaries
