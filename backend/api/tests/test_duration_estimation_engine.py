from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.tasks.duration_estimation import engine
from app.tasks.duration_estimation.schemas import DurationHistorySample


def sample(actual=90, estimated=60, title="Write course report", **kwargs):
    return DurationHistorySample(
        task_id=uuid4(),
        title=title,
        description=None,
        project_id=None,
        estimated_minutes=estimated,
        reference_source="user_snapshot",
        actual_minutes=actual,
        session_count=3,
        completed_at=datetime.now(UTC),
        completion_lead_minutes=1000,
        **kwargs,
    )


def summarize(samples):
    return engine.summarize_history(
        title="Write course report", description=None, project_id=None, samples=samples
    )


def test_cold_start_has_no_adjustment_and_low_confidence():
    result = engine.combine_estimate(prior_minutes=60, source="ai_prior", history=summarize([]))
    assert result.suggested_duration_minutes == 60
    assert result.adjustment_factor == 1
    assert result.historical_sample_count == 0
    assert result.confidence <= 0.3


def test_history_adjusts_prior_deterministically():
    history = summarize([sample() for _ in range(3)])
    result = engine.combine_estimate(prior_minutes=60, source="ai_prior", history=history)
    assert result.adjustment_factor == 1.25
    assert result.suggested_duration_minutes == 75
    assert result == engine.combine_estimate(prior_minutes=60, source="ai_prior", history=history)


def test_zero_mad_outlier_is_removed():
    history = summarize([sample() for _ in range(4)] + [sample(actual=1000)])
    assert history.count == 4
    assert history.excluded_count == 1


def test_small_cohorts_and_missing_estimates():
    history = summarize([sample(estimated=None), sample(estimated=None)])
    assert history.count == 2
    assert engine.calculate_adjustment_factor(history) == 1


def test_actual_history_fallback_is_not_adjusted_twice():
    history = summarize([sample() for _ in range(5)])
    result = engine.combine_estimate(prior_minutes=90, source="history", history=history)
    assert result.suggested_duration_minutes == 90
    assert result.adjustment_factor == 1


def test_unrelated_tasks_not_used_as_similar_history():
    history = summarize([sample(title="Grocery shopping") for _ in range(5)])
    assert history.similar is False
    assert engine.calculate_confidence(history, "ai_prior") <= 0.45


def test_factor_has_upper_and_lower_bounds():
    assert engine.calculate_adjustment_factor(summarize([sample(actual=600)] * 30)) == 2
    assert engine.calculate_adjustment_factor(summarize([sample(actual=1)] * 30)) == 0.5


@pytest.mark.parametrize("minutes, expected", [(1, 1), (3, 5), (7, 5), (8, 10), (20000, 10080)])
def test_rounding_bounds(minutes, expected):
    assert engine.round_duration(minutes) == expected
