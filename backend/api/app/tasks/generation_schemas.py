from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.ai.contracts import AIProposalEnvelope
from app.tasks.models import TaskPriority
from app.tasks.schemas import TaskCreate, TaskResponse


class TaskGenerationRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)


class GeneratedTaskDraft(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    client_id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=255)
    priority: TaskPriority = TaskPriority.NO_PRIORITY
    due_date: date | None = None
    due_time: str | None = Field(default=None, pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")


class GeneratedTaskSet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tasks: list[GeneratedTaskDraft] = Field(min_length=1, max_length=10)


class TaskGenerationProposal(GeneratedTaskSet):
    proposal_id: UUID
    proposal_token: str
    expires_at: datetime
    route_reason: str


class TaskGenerationPreviewResponse(AIProposalEnvelope[TaskGenerationProposal]):
    feature: Literal["task_understanding"] = "task_understanding"


class TaskGenerationConfirmRequest(BaseModel):
    proposal_token: str = Field(min_length=1)
    tasks: list[GeneratedTaskDraft] = Field(min_length=1, max_length=10)
    task_details: list[TaskCreate] | None = Field(default=None, min_length=1, max_length=10)

    @model_validator(mode="after")
    def validate_task_details(self) -> "TaskGenerationConfirmRequest":
        if self.task_details is not None and len(self.task_details) != len(self.tasks):
            raise ValueError("Each generated task must have one set of task details")
        return self


class TaskGenerationConfirmResponse(BaseModel):
    created: list[TaskResponse]
