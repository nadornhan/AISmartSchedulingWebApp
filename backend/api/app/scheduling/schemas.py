import uuid
from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from app.ai.contracts import AICandidateScoreEvidence
from app.ai.schemas import AIGenerationMetadata
from app.dashboard.schemas import DashboardTaskSummary
from app.tasks.models import TaskPriority, TaskStatus


class AiWeightsSnapshot(BaseModel):
    deadline_urgency: int = Field(ge=0, le=100)
    priority: int = Field(ge=0, le=100)
    estimated_duration: int = Field(ge=0, le=100)
    ai_assistant_enabled: bool = True
    work_start: str
    work_end: str
    timezone: str = "UTC"
    pomodoro_minutes: int


class AiRecommendationResponse(BaseModel):
    id: uuid.UUID
    task: DashboardTaskSummary | None = None
    title: str
    explanation: str
    reasons: list[str]
    based_on: list[str]
    score: float
    status: str
    weights: AiWeightsSnapshot
    generated_at: datetime


class ScheduleSuggestionResponse(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    task_title: str
    project_name: str | None = None
    suggested_start: datetime
    suggested_end: datetime
    explanation: str
    status: str
    position: int


class SchedulingIssueMetadata(BaseModel):
    required_minutes: int
    total_available_minutes: int
    largest_available_block_minutes: int
    feasible_window_count: int
    due_date: str | None = None
    planning_horizon_end: str


class ReschedulingIssueMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fixed_task_id: uuid.UUID | None = None
    required_minutes: int | None = None
    total_available_minutes: int | None = None
    largest_available_block_minutes: int | None = None
    feasible_window_count: int | None = None
    due_date: str | None = None
    planning_horizon_end: str | None = None


class SchedulingIssueResponse(BaseModel):
    task_id: uuid.UUID
    task_title: str
    code: Literal[
        "NO_WINDOW_BEFORE_DEADLINE",
        "NO_CONTIGUOUS_WINDOW_BEFORE_DEADLINE",
        "NO_CAPACITY_IN_HORIZON",
        "NO_CONTIGUOUS_WINDOW_IN_HORIZON",
        "LOCKED_TASK_REQUIRES_MANUAL_ACTION",
        "NO_VALID_RESCHEDULE_OPTION",
    ]
    severity: Literal["warning", "critical"]
    reason: str
    metadata: SchedulingIssueMetadata | ReschedulingIssueMetadata


class SchedulingPlanResponse(BaseModel):
    recommendation: AiRecommendationResponse | None
    schedule: list[ScheduleSuggestionResponse]
    issues: list[SchedulingIssueResponse] = Field(default_factory=list)
    generated_at: datetime
    footnote: str = "AI based on your patterns"


class ScheduleAdjustRequest(BaseModel):
    suggested_start: datetime
    suggested_end: datetime


class ApplyScheduleRequest(BaseModel):
    suggestion_ids: list[uuid.UUID] | None = None


class ReschedulePreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    include_ai_explanations: bool = True


class RescheduleApplyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    option_id: uuid.UUID


class RescheduleTaskSnapshot(BaseModel):
    """Scheduling-relevant task state used to detect stale proposals."""

    model_config = ConfigDict(extra="forbid")

    task_id: uuid.UUID
    updated_at: AwareDatetime
    status: TaskStatus
    priority: TaskPriority
    estimated_duration_minutes: int | None = Field(default=None, gt=0)
    due_date: AwareDatetime | None = None
    scheduled_start: AwareDatetime | None = None
    scheduled_end: AwareDatetime | None = None
    schedule_locked: bool = False

    @model_validator(mode="after")
    def validate_schedule(self) -> "RescheduleTaskSnapshot":
        if (self.scheduled_start is None) != (self.scheduled_end is None):
            raise ValueError("Schedule snapshots require both start and end")
        if (
            self.scheduled_start is not None
            and self.scheduled_end is not None
            and self.scheduled_end <= self.scheduled_start
        ):
            raise ValueError("Schedule snapshot end must be later than start")
        if self.schedule_locked and self.scheduled_start is None:
            raise ValueError("Locked task snapshots require a schedule interval")
        return self


class RescheduleSettingsSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    updated_at: AwareDatetime
    work_start: str
    work_end: str
    timezone: str
    pomodoro_minutes: int = Field(gt=0)
    deadline_urgency_weight: int = Field(ge=0, le=100)
    priority_weight: int = Field(ge=0, le=100)
    estimated_duration_weight: int = Field(ge=0, le=100)


class RescheduleFocusSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: uuid.UUID
    task_id: uuid.UUID | None = None
    status: Literal["active", "paused"]
    started_at: AwareDatetime
    planned_duration_minutes: int = Field(gt=0)
    actual_duration_seconds: int = Field(ge=0)
    updated_at: AwareDatetime


class RescheduleStateSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    revision: int = Field(ge=0)
    settings: RescheduleSettingsSnapshot
    tasks: list[RescheduleTaskSnapshot]
    focus_sessions: list[RescheduleFocusSnapshot] = Field(default_factory=list)

    @model_validator(mode="after")
    def reject_duplicate_tasks(self) -> "RescheduleStateSnapshot":
        task_ids = [task.task_id for task in self.tasks]
        if len(task_ids) != len(set(task_ids)):
            raise ValueError("State snapshot contains duplicate task IDs")
        return self


class PersistedRescheduleContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    context: "RescheduleProposalContext"
    issues: list[SchedulingIssueResponse] = Field(default_factory=list)


ReschedulingChangeCode = Literal[
    "INVALID_SCHEDULE_INTERVAL",
    "SCHEDULE_CONFLICT",
    "SCHEDULE_DELAYED",
    "TASK_OVERRUN",
    "DURATION_NO_LONGER_FITS",
    "OUTSIDE_WORKING_HOURS",
    "ENDS_AFTER_DEADLINE",
    "CAPACITY_PRESSURE",
]


class RescheduleDetectedChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: ReschedulingChangeCode
    reason: str = Field(min_length=1, max_length=500)
    task_id: uuid.UUID | None = None
    related_task_ids: list[uuid.UUID] = Field(default_factory=list)


class RescheduleProposalContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timezone: str
    changes: list[RescheduleDetectedChange]
    affected_task_ids: list[uuid.UUID]
    fixed_task_ids: list[uuid.UUID] = Field(default_factory=list)


class RescheduleMove(BaseModel):
    model_config = ConfigDict(extra="forbid")

    task_id: uuid.UUID
    task_title: str = Field(min_length=1, max_length=255)
    previous_start: AwareDatetime | None = None
    previous_end: AwareDatetime | None = None
    proposed_start: AwareDatetime
    proposed_end: AwareDatetime
    scoring: AICandidateScoreEvidence | None = None

    @model_validator(mode="after")
    def validate_intervals(self) -> "RescheduleMove":
        if (self.previous_start is None) != (self.previous_end is None):
            raise ValueError("Previous schedule requires both start and end")
        if self.proposed_end <= self.proposed_start:
            raise ValueError("Proposed schedule end must be later than start")
        return self


class RescheduleOption(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    style: Literal[
        "minimal_disruption",
        "earlier_completion",
        "best_v7_fit",
    ]
    deterministic_rank: int = Field(ge=1, le=3)
    moves: list[RescheduleMove] = Field(min_length=1)
    preserved_task_ids: list[uuid.UUID] = Field(default_factory=list)
    moved_task_count: int = Field(ge=1)
    total_displacement_minutes: int = Field(ge=0)
    completion_at: AwareDatetime
    deterministic_reasons: list[str] = Field(default_factory=list)
    resolved_change_codes: list[ReschedulingChangeCode] = Field(default_factory=list)
    explanation: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_move_summary(self) -> "RescheduleOption":
        move_ids = [move.task_id for move in self.moves]
        if len(move_ids) != len(set(move_ids)):
            raise ValueError("Reschedule option contains duplicate task moves")
        if self.moved_task_count != len(self.moves):
            raise ValueError("moved_task_count must match the number of moves")
        if self.completion_at < max(move.proposed_end for move in self.moves):
            raise ValueError("completion_at cannot be before a proposed task end")
        return self


class RescheduleProposalResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    status: Literal["preview", "applied", "undone", "superseded", "expired"]
    context: RescheduleProposalContext
    options: list[RescheduleOption] = Field(default_factory=list, max_length=3)
    issues: list[SchedulingIssueResponse] = Field(default_factory=list)
    selected_option_id: uuid.UUID | None = None
    generated_at: AwareDatetime
    expires_at: AwareDatetime
    applied_at: AwareDatetime | None = None
    undone_at: AwareDatetime | None = None
    idempotent: bool = False
    ai_metadata: AIGenerationMetadata | None = None


class RescheduleOptionAIExplanation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    option_id: uuid.UUID
    explanation: str = Field(min_length=1, max_length=1000)


class RescheduleAIExplanationPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    explanations: list[RescheduleOptionAIExplanation] = Field(
        default_factory=list,
        max_length=3,
    )

    @model_validator(mode="after")
    def reject_duplicate_option_ids(self) -> "RescheduleAIExplanationPayload":
        option_ids = [item.option_id for item in self.explanations]
        if len(option_ids) != len(set(option_ids)):
            raise ValueError("AI explanations contain duplicate option IDs")
        return self


class PersistedRescheduleAIResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    payload: RescheduleAIExplanationPayload
    metadata: AIGenerationMetadata


RescheduleConflictCode = Literal[
    "OPTION_NOT_FOUND",
    "ALREADY_APPLIED",
    "INVALID_PROPOSAL_STATE",
    "EXPIRED_PROPOSAL",
    "STALE_PROPOSAL",
    "LOCKED_TASK",
    "INVALID_OPTION",
    "STALE_UNDO",
]


class RescheduleErrorDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: RescheduleConflictCode
    message: str = Field(min_length=1, max_length=500)


class RescheduleConflictResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    detail: RescheduleErrorDetail


class AiPreviewRequest(BaseModel):
    task_ids: list[uuid.UUID] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def reject_duplicate_task_ids(self) -> "AiPreviewRequest":
        if len(set(self.task_ids)) != len(self.task_ids):
            raise ValueError("task_ids must not contain duplicates")

        return self


class GeminiScheduleSlot(BaseModel):
    task_id: uuid.UUID
    suggested_start: datetime
    suggested_end: datetime
    explanation: str = Field(min_length=1, max_length=500)


class GeminiSchedulePreview(BaseModel):
    schedule: list[GeminiScheduleSlot] = Field(min_length=1, max_length=5)


class AiPreviewSlotResponse(BaseModel):
    task_id: uuid.UUID
    task_title: str
    project_name: str | None = None
    suggested_start: datetime
    suggested_end: datetime
    explanation: str
    position: int


class AiPreviewResponse(BaseModel):
    schedule: list[AiPreviewSlotResponse]
    generated_at: datetime
    model: str
    footnote: str = (
        "Gemini preview only. Review before applying; no database changes were made."
    )
