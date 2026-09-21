from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.ai.contracts import AIProposalEnvelope
from app.tasks.models import TaskPriority
from app.tasks.schemas import TaskResponse


class TaskDecompositionRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)


class GeneratedSubtaskDraft(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    client_id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=255)


class DecomposedTaskDraft(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=255)
    priority: TaskPriority = TaskPriority.NO_PRIORITY
    due_date: date | None = None
    subtasks: list[GeneratedSubtaskDraft] = Field(min_length=2, max_length=12)


class TaskDecompositionProposal(DecomposedTaskDraft):
    proposal_id: UUID
    proposal_token: str
    expires_at: datetime


class TaskDecompositionPreviewResponse(AIProposalEnvelope[TaskDecompositionProposal]):
    feature: Literal["task_decomposition"] = "task_decomposition"


class ConfirmedDecomposedTaskDraft(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=255)
    priority: TaskPriority = TaskPriority.NO_PRIORITY
    due_date: date | None = None
    subtasks: list[GeneratedSubtaskDraft] = Field(min_length=1, max_length=12)


class TaskDecompositionConfirmRequest(BaseModel):
    proposal_token: str = Field(min_length=1)
    task: ConfirmedDecomposedTaskDraft


class TaskDecompositionConfirmResponse(BaseModel):
    created: TaskResponse
