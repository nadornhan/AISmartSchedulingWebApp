import pytest
from pydantic import ValidationError

from app.scoring.priority import suggest_priority
from app.scoring.schemas import FactorResult, ScoreBreakdown
from app.tasks.models import TaskPriority
from app.tasks.priority_schemas import PriorityAIExplanation, PriorityPreviewRequest


def propose(deadline_score=.3, **overrides):
    breakdown = ScoreBreakdown(
        profile_name="scheduling", scoring_version="v7",
        factors=(FactorResult("deadline_urgency", deadline_score, .8, "Deadline evidence"),
                 FactorResult("priority", 1, .7)),
        weighted_score=.99, focus_bonus=0, final_score=.99,
    )
    args = dict(breakdown=breakdown, has_deadline=True, importance_level=None,
                workload_ratio=0.5, unresolved_dependencies=0, dependent_task_count=0)
    args.update(overrides)
    result = suggest_priority(**args)
    assert breakdown.final_score == .99
    assert result.scoring.final_score == .99
    return result


@pytest.mark.parametrize("score,expected", [(.49, "low"), (.5, "medium"), (.8, "high")])
def test_deadline_tiers_ignore_existing_priority_factor(score, expected):
    assert propose(score).suggested_priority.value == expected


def test_missing_evidence_does_not_invent_priority():
    result = propose(has_deadline=False, workload_ratio=None,
                     unresolved_dependencies=None, dependent_task_count=None)
    assert result.suggested_priority == TaskPriority.NO_PRIORITY
    assert result.confidence == 0


def test_user_importance_and_workload():
    assert propose(importance_level="high").suggested_priority == TaskPriority.HIGH
    assert propose(workload_ratio=1.1).suggested_priority == TaskPriority.MEDIUM
    assert propose(has_deadline=False, workload_ratio=1.1).suggested_priority == TaskPriority.LOW


def test_dependency_direction_matters():
    assert propose(dependent_task_count=2).suggested_priority == TaskPriority.MEDIUM
    result = propose(unresolved_dependencies=2)
    assert result.suggested_priority == TaskPriority.LOW
    assert any("Blocked by 2" in reason for reason in result.reasons)


def test_missing_dependency_data_reduces_coverage():
    assert propose(unresolved_dependencies=None).confidence < propose().confidence


@pytest.mark.parametrize("ratio", [-1, float("nan"), float("inf")])
def test_invalid_workload_rejected(ratio):
    with pytest.raises(ValueError):
        propose(workload_ratio=ratio)


def test_client_cannot_supply_score_and_ai_cannot_choose_priority():
    with pytest.raises(ValidationError):
        PriorityPreviewRequest.model_validate({"final_score": 1})
    with pytest.raises(ValidationError):
        PriorityAIExplanation.model_validate({"explanation": "Soon", "priority": "high"})
