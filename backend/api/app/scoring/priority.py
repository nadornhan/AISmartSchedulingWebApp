"""Pure priority proposal rules. No persistence, model calls, or task mutation.

V1 uses existing deadline evidence rather than feeding the user's current priority
back into a recommendation. Confidence describes input coverage, not probability.
Workload and dependency counts must come from ownership-checked backend queries.
"""

from app.ai.contracts import task_score_evidence
from app.scoring.schemas import ScoreBreakdown
from app.tasks.models import TaskPriority
from app.tasks.priority_schemas import PriorityProposal


def suggest_priority(
    *,
    breakdown: ScoreBreakdown,
    has_deadline: bool,
    importance_level: str | None,
    workload_ratio: float | None,
    unresolved_dependencies: int | None,
    dependent_task_count: int | None,
) -> PriorityProposal:
    """Map evidence to tiers; preserve original scoring totals without recalculation.

    Deadline pressure >= .8 means high; >= .5 means medium. Explicit importance
    establishes a minimum tier. Over-capacity workload raises a deadline-backed
    low proposal to medium. Tasks blocking others receive at least medium.
    Unresolved prerequisites are reported; they do not imply executable work.
    """
    if importance_level not in (None, "low", "medium", "high"):
        raise ValueError("Invalid importance level")
    if workload_ratio is not None and not 0 <= workload_ratio < float("inf"):
        raise ValueError("Workload ratio must be finite and nonnegative")
    if any(value is not None and value < 0 for value in
           (unresolved_dependencies, dependent_task_count)):
        raise ValueError("Dependency counts must be nonnegative")

    tiers = {"low": 0, "medium": 1, "high": 2}
    tier = 0
    reasons = []
    missing = []
    deadline = next((f for f in breakdown.factors if f.name == "deadline_urgency"), None)
    if has_deadline and deadline is not None:
        tier = 2 if deadline.score >= .8 else 1 if deadline.score >= .5 else 0
        reasons.append(deadline.reason or "Deadline pressure from the scoring engine")
    else:
        missing.append("deadline")
    if importance_level is not None:
        tier = max(tier, tiers[importance_level])
        reasons.append(f"User-described importance: {importance_level}")
    else:
        missing.append("importance_level")
    if workload_ratio is None:
        missing.append("workload")
    else:
        reasons.append(f"Workload is {workload_ratio:.0%} of available capacity")
        if workload_ratio > 1 and has_deadline and deadline is not None:
            tier = max(tier, 1)
    if unresolved_dependencies is None or dependent_task_count is None:
        missing.append("dependencies")
    if unresolved_dependencies:
        reasons.append(f"Blocked by {unresolved_dependencies} unfinished prerequisite(s)")
    if dependent_task_count:
        tier = max(tier, 1)
        reasons.append(f"Blocks {dependent_task_count} other task(s)")
    elif unresolved_dependencies == 0 and dependent_task_count == 0:
        reasons.append("No dependency constraints")
    # No evidence of urgency is not evidence that the task is unimportant.
    suggested = (TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH)[tier]
    if len(missing) == 4:
        suggested = TaskPriority.NO_PRIORITY
    return PriorityProposal(
        suggested_priority=suggested,
        confidence=(4 - len(missing)) / 4,
        reasons=reasons or ["Insufficient evidence to recommend a priority"],
        missing_inputs=missing,
        scoring=task_score_evidence(breakdown),
    )
