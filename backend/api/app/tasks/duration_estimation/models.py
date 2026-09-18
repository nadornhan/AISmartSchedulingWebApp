import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DurationEstimateDecision(Base):
    __tablename__ = "duration_estimate_decisions"
    __table_args__ = (
        CheckConstraint("action IN ('accepted', 'changed', 'ignored')", name="ck_duration_action"),
        CheckConstraint(
            "(action = 'ignored' AND applied_duration_minutes IS NULL) OR "
            "(action IN ('accepted', 'changed') AND applied_duration_minutes BETWEEN 1 AND 10080)",
            name="ck_duration_applied_minutes",
        ),
        Index("ix_duration_decisions_user_task", "user_id", "task_id", "resolved_at"),
    )

    proposal_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    action: Mapped[str] = mapped_column(String(16))
    applied_duration_minutes: Mapped[int | None] = mapped_column(Integer)
    request_fingerprint: Mapped[str] = mapped_column(String(64))
    task_snapshot_after: Mapped[str] = mapped_column(String(64))
    estimate: Mapped[dict] = mapped_column(JSONB)
    response: Mapped[dict] = mapped_column(JSONB)
    resolved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class TaskDurationBaseline(Base):
    """Frozen once, before the first recorded focus session for a task."""

    __tablename__ = "task_duration_baselines"
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    estimated_minutes: Mapped[int | None] = mapped_column(Integer)
    reference_source: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
