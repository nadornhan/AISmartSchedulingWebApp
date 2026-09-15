from __future__ import annotations

import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from app.ai.contracts import candidate_score_evidence
from app.scoring import (
    SchedulingProfileV7,
    calculate_capacity_aware_task_importance,
    score_window_candidate,
    window_candidate_sort_key_v6,
)
from app.scoring.constraints import normalize_schedule_datetime, validate_schedule_candidate
from app.scoring.schemas import ScoredWindowCandidate
from app.settings.models import UserSettings
from app.tasks.models import Task, TaskStatus

from .detection import ReschedulingDetectionResult
from .engine import (
    SchedulingIssue,
    free_windows_for_current_state,
    planning_horizon_for_scheduling,
)
from .schemas import RescheduleMove, RescheduleOption, ReschedulingChangeCode
from .windows import (
    CandidateWindow,
    TaskWindowCandidate,
    allocate_from_window,
    build_task_window_candidates,
    candidate_windows_before_deadline,
    summarize_task_capacity,
)

MAX_RESCHEDULE_OPTIONS = 3
OPTION_ID_NAMESPACE = uuid.UUID("89f87541-e225-41c2-9ccc-320856632f4e")
ReschedulingOptionStyle = Literal[
    "minimal_disruption",
    "earlier_completion",
    "best_v7_fit",
]


@dataclass(frozen=True)
class RescheduleGenerationResult:
    options: tuple[RescheduleOption, ...]
    issues: tuple[SchedulingIssue, ...]


@dataclass(frozen=True)
class _CandidateChoice:
    scored: ScoredWindowCandidate
    previous_start: datetime | None
    previous_end: datetime | None


def _task_id_key(task_id: uuid.UUID) -> str:
    return str(task_id)


def _normalized_task_interval(task: Task) -> tuple[datetime, datetime] | None:
    if task.scheduled_start is None or task.scheduled_end is None:
        return None
    return (
        normalize_schedule_datetime(task.scheduled_start),
        normalize_schedule_datetime(task.scheduled_end),
    )


def _displacement_minutes(choice: _CandidateChoice) -> int:
    if choice.previous_start is None:
        return 0
    return int(
        abs((choice.scored.candidate.proposed_start - choice.previous_start).total_seconds()) // 60
    )


def _choice_key(
    choice: _CandidateChoice,
    *,
    style: ReschedulingOptionStyle,
    timezone_name: str,
) -> tuple:
    scored = choice.scored
    candidate = scored.candidate
    v7_key = window_candidate_sort_key_v6(
        scored,
        timezone_name=timezone_name,
    )
    if style == "minimal_disruption":
        return (
            choice.previous_start is None,
            _displacement_minutes(choice),
            *v7_key,
        )
    if style == "earlier_completion":
        return (
            candidate.proposed_end,
            candidate.proposed_start,
            *v7_key,
        )
    return v7_key


def _candidate_choices(
    *,
    remaining_tasks: list[Task],
    blockers: list[Task],
    accepted: list[tuple[uuid.UUID, datetime, datetime]],
    windows: list[CandidateWindow],
    settings: UserSettings,
    now: datetime,
    preferred_focus_hours: Counter[int],
) -> list[_CandidateChoice]:
    profile = SchedulingProfileV7.from_settings(settings)
    choices: list[_CandidateChoice] = []
    for task in remaining_tasks:
        previous_interval = _normalized_task_interval(task)
        capacity = summarize_task_capacity(
            task=task,
            windows=windows,
            settings=settings,
        )
        importance = calculate_capacity_aware_task_importance(
            task,
            profile,
            now=now,
            capacity=capacity,
        )
        for window in candidate_windows_before_deadline(task=task, windows=windows):
            for candidate in build_task_window_candidates(
                task=task,
                window=window,
                settings=settings,
            ):
                validation = validate_schedule_candidate(
                    task=task,
                    start=candidate.proposed_start,
                    end=candidate.proposed_end,
                    settings=settings,
                    existing_tasks=blockers,
                    existing_candidates=accepted,
                )
                if not validation.valid:
                    continue
                choices.append(
                    _CandidateChoice(
                        scored=score_window_candidate(
                            candidate,
                            profile,
                            task_importance_score=importance.score,
                            preferred_focus_hours=preferred_focus_hours,
                            timezone_name=settings.timezone,
                        ),
                        previous_start=(
                            previous_interval[0] if previous_interval is not None else None
                        ),
                        previous_end=(
                            previous_interval[1] if previous_interval is not None else None
                        ),
                    )
                )
    return choices


def _option_signature(moves: list[RescheduleMove]) -> str:
    return "|".join(
        f"{move.task_id}:{move.proposed_start.isoformat()}:{move.proposed_end.isoformat()}"
        for move in sorted(moves, key=lambda item: _task_id_key(item.task_id))
    )


def _build_option(
    *,
    style: ReschedulingOptionStyle,
    rank: int,
    targets: list[Task],
    blockers: list[Task],
    all_open_tasks: list[Task],
    settings: UserSettings,
    now: datetime,
    preferred_focus_hours: Counter[int],
    resolved_change_codes: list[ReschedulingChangeCode],
    additional_fixed_candidates: list[tuple[uuid.UUID, datetime, datetime]],
) -> RescheduleOption | None:
    windows = free_windows_for_current_state(
        settings=settings,
        now=now,
        existing_tasks=blockers,
        existing_candidates=additional_fixed_candidates,
    )
    remaining = list(targets)
    accepted: list[tuple[uuid.UUID, datetime, datetime]] = list(additional_fixed_candidates)
    moves: list[RescheduleMove] = []

    while remaining:
        choices = _candidate_choices(
            remaining_tasks=remaining,
            blockers=blockers,
            accepted=accepted,
            windows=windows,
            settings=settings,
            now=now,
            preferred_focus_hours=preferred_focus_hours,
        )
        if not choices:
            return None

        choice = min(
            choices,
            key=lambda item: _choice_key(
                item,
                style=style,
                timezone_name=settings.timezone,
            ),
        )
        scored = choice.scored
        candidate: TaskWindowCandidate = scored.candidate
        moves.append(
            RescheduleMove(
                task_id=candidate.task.id,
                task_title=candidate.task.title,
                previous_start=choice.previous_start,
                previous_end=choice.previous_end,
                proposed_start=candidate.proposed_start,
                proposed_end=candidate.proposed_end,
                scoring=candidate_score_evidence(scored.breakdown),
            )
        )
        accepted.append(
            (
                candidate.task.id,
                candidate.proposed_start,
                candidate.proposed_end,
            )
        )
        windows = allocate_from_window(
            windows=windows,
            used_window=candidate.window,
            candidate=candidate,
        )
        remaining = [task for task in remaining if task.id != candidate.task.id]

    signature = _option_signature(moves)
    moved_ids = {move.task_id for move in moves}
    displacement = sum(
        int(abs((move.proposed_start - move.previous_start).total_seconds()) // 60)
        for move in moves
        if move.previous_start is not None
    )
    reasons = {
        "minimal_disruption": ["Minimizes changes from existing task start times."],
        "earlier_completion": ["Places affected tasks at the earliest feasible times."],
        "best_v7_fit": ["Uses the existing V7 candidate scoring order."],
    }
    return RescheduleOption(
        id=uuid.uuid5(OPTION_ID_NAMESPACE, signature),
        style=style,
        deterministic_rank=rank,
        moves=moves,
        preserved_task_ids=sorted(
            (task.id for task in all_open_tasks if task.id not in moved_ids),
            key=_task_id_key,
        ),
        moved_task_count=len(moves),
        total_displacement_minutes=displacement,
        completion_at=max(move.proposed_end for move in moves),
        deterministic_reasons=reasons[style],
        resolved_change_codes=resolved_change_codes,
    )


def _locked_state_issues(
    *,
    detection: ReschedulingDetectionResult,
    task_by_id: dict[uuid.UUID, Task],
) -> list[SchedulingIssue]:
    affected_fixed_ids = set(detection.affected_task_ids) & set(detection.fixed_task_ids)
    issues: list[SchedulingIssue] = []
    for task_id in sorted(affected_fixed_ids, key=_task_id_key):
        related_changes = [
            change
            for change in detection.changes
            if change.task_id == task_id or task_id in change.related_task_ids
        ]
        has_unresolvable_change = any(
            change.code not in {"SCHEDULE_CONFLICT", "TASK_OVERRUN"}
            or all(
                participant_id in affected_fixed_ids
                for participant_id in (
                    *((change.task_id,) if change.task_id is not None else ()),
                    *change.related_task_ids,
                )
            )
            for change in related_changes
        )
        if not has_unresolvable_change:
            continue
        task = task_by_id[task_id]
        issues.append(
            SchedulingIssue(
                task_id=task.id,
                task_title=task.title,
                code="LOCKED_TASK_REQUIRES_MANUAL_ACTION",
                severity="critical",
                reason="A locked task has an invalid schedule that cannot be moved.",
                metadata={"fixed_task_id": str(task.id)},
            )
        )
    return issues


def _no_option_issues(
    *,
    targets: list[Task],
    blockers: list[Task],
    settings: UserSettings,
    now: datetime,
    additional_fixed_candidates: list[tuple[uuid.UUID, datetime, datetime]],
) -> list[SchedulingIssue]:
    windows = free_windows_for_current_state(
        settings=settings,
        now=now,
        existing_tasks=blockers,
        existing_candidates=additional_fixed_candidates,
    )
    horizon = planning_horizon_for_scheduling(now)
    issues: list[SchedulingIssue] = []
    for task in targets:
        capacity = summarize_task_capacity(task=task, windows=windows, settings=settings)
        if task.due_date is not None:
            code = (
                "NO_WINDOW_BEFORE_DEADLINE"
                if capacity.total_available_minutes <= 0
                else "NO_CONTIGUOUS_WINDOW_BEFORE_DEADLINE"
            )
            severity = "critical"
        else:
            code = (
                "NO_CAPACITY_IN_HORIZON"
                if capacity.total_available_minutes <= 0
                else "NO_CONTIGUOUS_WINDOW_IN_HORIZON"
            )
            severity = "warning"
        if capacity.has_contiguous_capacity:
            code = "NO_VALID_RESCHEDULE_OPTION"
            severity = "critical"
        issues.append(
            SchedulingIssue(
                task_id=task.id,
                task_title=task.title,
                code=code,
                severity=severity,
                reason=(
                    f"No valid contiguous {capacity.required_minutes}-minute window "
                    "is available for this reschedule."
                ),
                metadata={
                    "required_minutes": capacity.required_minutes,
                    "total_available_minutes": capacity.total_available_minutes,
                    "largest_available_block_minutes": capacity.largest_window_minutes,
                    "feasible_window_count": capacity.feasible_window_count,
                    "due_date": task.due_date.isoformat() if task.due_date else None,
                    "planning_horizon_end": horizon.end.isoformat(),
                },
            )
        )
    return issues


def generate_rescheduling_options(
    *,
    tasks: list[Task],
    settings: UserSettings,
    detection: ReschedulingDetectionResult,
    now: datetime,
    preferred_focus_hours: Counter[int] | None = None,
    max_options: int = MAX_RESCHEDULE_OPTIONS,
) -> RescheduleGenerationResult:
    """Generate unique, validated alternatives without mutating ORM state."""

    if max_options < 1 or max_options > MAX_RESCHEDULE_OPTIONS:
        raise ValueError(f"max_options must be between 1 and {MAX_RESCHEDULE_OPTIONS}")

    normalized_now = normalize_schedule_datetime(now)
    open_tasks = sorted(
        (task for task in tasks if task.status != TaskStatus.DONE),
        key=lambda task: _task_id_key(task.id),
    )
    task_by_id = {task.id: task for task in open_tasks}
    target_ids = set(detection.affected_task_ids) & set(detection.movable_task_ids)
    active_overrun_task_ids = {
        change.task_id
        for change in detection.changes
        if change.code == "TASK_OVERRUN" and change.task_id is not None
    }
    target_ids -= active_overrun_task_ids
    targets = [task for task in open_tasks if task.id in target_ids]
    blockers = [task for task in open_tasks if task.id not in target_ids]
    additional_fixed_candidates = [
        (interval.source_id, interval.start, interval.end)
        for interval in detection.additional_fixed_intervals
    ]

    locked_issues = _locked_state_issues(detection=detection, task_by_id=task_by_id)
    if locked_issues:
        return RescheduleGenerationResult(options=(), issues=tuple(locked_issues))
    if not targets:
        return RescheduleGenerationResult(options=(), issues=())

    options: list[RescheduleOption] = []
    seen_signatures: set[str] = set()
    styles: tuple[ReschedulingOptionStyle, ...] = (
        "minimal_disruption",
        "earlier_completion",
        "best_v7_fit",
    )
    resolved_change_codes = sorted({change.code for change in detection.changes})
    for style in styles:
        option = _build_option(
            style=style,
            rank=len(options) + 1,
            targets=targets,
            blockers=blockers,
            all_open_tasks=open_tasks,
            settings=settings,
            now=normalized_now,
            preferred_focus_hours=preferred_focus_hours or Counter(),
            resolved_change_codes=resolved_change_codes,
            additional_fixed_candidates=additional_fixed_candidates,
        )
        if option is None:
            continue
        signature = _option_signature(option.moves)
        if signature in seen_signatures:
            continue
        seen_signatures.add(signature)
        options.append(option)
        if len(options) >= max_options:
            break

    issues = (
        []
        if options
        else _no_option_issues(
            targets=targets,
            blockers=blockers,
            settings=settings,
            now=normalized_now,
            additional_fixed_candidates=additional_fixed_candidates,
        )
    )
    return RescheduleGenerationResult(options=tuple(options), issues=tuple(issues))
