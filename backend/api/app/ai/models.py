from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AIGenerationEvent(Base):
    __tablename__ = "ai_generation_events"
    __table_args__ = (
        CheckConstraint(
            "outcome IN ('success', 'fallback', 'failure')",
            name="ck_ai_generation_events_outcome_allowed",
        ),
        CheckConstraint(
            "input_tokens >= 0 AND output_tokens >= 0 AND "
            "thinking_tokens >= 0 AND total_tokens >= 0 AND latency_ms >= 0",
            name="ck_ai_generation_events_metrics_nonnegative",
        ),
        Index(
            "ix_ai_generation_events_user_created_at",
            "user_id",
            "created_at",
        ),
        Index(
            "ix_ai_generation_events_feature_created_at",
            "feature",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    feature: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(64), nullable=False)
    outcome: Mapped[str] = mapped_column(String(16), nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(128), nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    thinking_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
