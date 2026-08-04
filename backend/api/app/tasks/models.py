import enum
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.projects.models import Project


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class TaskPriority(str, enum.Enum):
    NO_PRIORITY = "no_priority"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[TaskStatus] = mapped_column(
        Enum(
            TaskStatus,
            name="task_status",
            values_callable=lambda enum_class: [
                item.value for item in enum_class
            ],
        ),
        default=TaskStatus.PENDING,
        server_default=TaskStatus.PENDING.value,
        nullable=False,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(
            TaskPriority,
            name="task_priority",
            values_callable=lambda enum_class: [
                item.value for item in enum_class
            ],
        ),
        default=TaskPriority.NO_PRIORITY,
        server_default=TaskPriority.NO_PRIORITY.value,
        nullable=False,
    )
    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    estimated_duration_minutes: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    scheduled_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    scheduled_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    project: Mapped["Project | None"] = relationship(
        back_populates="tasks",
    )
    @property
    def display_status(self) -> str:
        if self.due_date is None or self.status == TaskStatus.DONE:
            return self.status.value

        due_date = self.due_date
        if due_date.tzinfo is None:
            due_date = due_date.replace(tzinfo=UTC)

        if due_date < datetime.now(UTC):
            return "overdue"

        return self.status.value
