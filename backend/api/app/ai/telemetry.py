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

logger = logging.getLogger(__name__)


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


def summarize_ai_usage(
    db: Session,
    user_id: uuid.UUID,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[AIUsageFeatureSummary]:
    statement = select(
        AIGenerationEvent.feature,
        func.count(AIGenerationEvent.id),
        func.sum(case((AIGenerationEvent.outcome == "success", 1), else_=0)),
        func.sum(case((AIGenerationEvent.outcome == "fallback", 1), else_=0)),
        func.sum(case((AIGenerationEvent.outcome == "failure", 1), else_=0)),
        func.coalesce(func.sum(AIGenerationEvent.total_tokens), 0),
        func.coalesce(func.avg(AIGenerationEvent.latency_ms), 0),
    ).where(AIGenerationEvent.user_id == user_id)
    if start is not None:
        statement = statement.where(AIGenerationEvent.created_at >= start)
    if end is not None:
        statement = statement.where(AIGenerationEvent.created_at < end)

    rows = db.execute(statement.group_by(AIGenerationEvent.feature)).all()
    return [
        AIUsageFeatureSummary(
            feature=feature,
            request_count=request_count,
            success_count=success_count or 0,
            fallback_count=fallback_count or 0,
            failure_count=failure_count or 0,
            total_tokens=total_tokens or 0,
            average_latency_ms=round(float(average_latency_ms or 0), 2),
        )
        for (
            feature,
            request_count,
            success_count,
            fallback_count,
            failure_count,
            total_tokens,
            average_latency_ms,
        ) in rows
    ]
