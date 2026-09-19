"""Versioned heuristics: no database, network, or framework side effects."""

import math
import re
from dataclasses import dataclass
from statistics import median

from app.tasks.duration_estimation.schemas import (
    MAX_DURATION_MINUTES,
    DurationEstimate,
    DurationHistorySample,
    DurationSource,
)

MIN_SIMILAR_HISTORY = 4
SHRINKAGE_SAMPLES = 3
MIN_FACTOR = 0.5
MAX_FACTOR = 2.0
STOP_WORDS = {"the", "a", "an", "and", "for", "to", "of", "my", "in", "on", "with"}


@dataclass(frozen=True)
class HistorySummary:
    samples: tuple[DurationHistorySample, ...]
    similar: bool
    excluded_count: int

    @property
    def count(self) -> int:
        return len(self.samples)

    @property
    def actual_median(self) -> float:
        return median(s.actual_minutes for s in self.samples)


def tokens(text: str) -> set[str]:
    return {
        word
        for word in re.findall(r"[^\W\d_]+", text.casefold())
        if len(word) > 2 and word not in STOP_WORDS
    }


def similarity(title: str, description: str | None, project_id, sample) -> float:
    left = tokens(title + " " + (description or ""))
    right = tokens(sample.title + " " + (sample.description or ""))
    overlap = len(left & right) / len(left | right) if left | right else 0.0
    # A shared project alone never qualifies a task as similar.
    project_bonus = 0.1 if overlap > 0 and project_id and project_id == sample.project_id else 0
    return overlap + project_bonus


def summarize_history(*, title, description, project_id, samples) -> HistorySummary:
    valid = [
        s
        for s in samples
        if math.isfinite(s.actual_minutes)
        and 0 < s.actual_minutes <= MAX_DURATION_MINUTES
        and s.session_count > 0
        and s.completion_lead_minutes > 0
    ]
    similar = [s for s in valid if similarity(title, description, project_id, s) >= 0.25]
    selected = similar or valid
    # Log-ratio MAD rejects both extreme under- and overestimates. With no estimate,
    # use actual minutes only within a similar-task cohort (different work has different sizes).
    values = {
        s.task_id: math.log(s.actual_minutes / s.estimated_minutes)
        for s in selected
        if s.estimated_minutes and s.estimated_minutes > 0
    }
    if similar:
        actual_values = {s.task_id: math.log(s.actual_minutes) for s in selected}
        actual_inliers = _inliers(actual_values)
    else:
        actual_inliers = {s.task_id for s in selected}
    ratio_inliers = _inliers(values)
    cleaned = [
        s
        for s in selected
        if s.task_id in actual_inliers and (s.task_id not in values or s.task_id in ratio_inliers)
    ]
    return HistorySummary(tuple(cleaned), bool(similar), len(selected) - len(cleaned))


def _inliers(values: dict) -> set:
    if len(values) < 4:
        return set(values)
    center = median(values.values())
    mad = median(abs(v - center) for v in values.values())
    # Zero-MAD cohorts still reject a lone extreme value without dropping equal samples.
    radius = max(3 * 1.4826 * mad, math.log(2))
    return {key for key, value in values.items() if abs(value - center) <= radius}


def calculate_adjustment_factor(history: HistorySummary) -> float:
    ratios = [
        s.actual_minutes / s.estimated_minutes
        for s in history.samples
        if s.estimated_minutes and s.estimated_minutes > 0
    ]
    if not ratios:
        return 1.0
    weight = len(ratios) / (len(ratios) + SHRINKAGE_SAMPLES)
    return round(max(MIN_FACTOR, min(MAX_FACTOR, 1 + weight * (median(ratios) - 1))), 4)


def round_duration(minutes: float) -> int:
    return max(1, min(MAX_DURATION_MINUTES, math.floor(minutes / 5 + 0.5) * 5))


def calculate_confidence(history: HistorySummary, source: DurationSource) -> float:
    if history.count == 0:
        return 0.3 if source == "ai_prior" else 0.15
    middle = history.actual_median
    spread = median(abs(s.actual_minutes - middle) for s in history.samples) / middle
    sample_weight = history.count / (history.count + 5)
    confidence = 0.25 + 0.6 * sample_weight / (1 + spread)
    if not history.similar:
        confidence = min(confidence, 0.45)
    if any(s.reference_source == "legacy_current" for s in history.samples):
        confidence = min(confidence, 0.6)
    if source == "default":
        confidence = min(confidence, 0.2)
    return round(confidence, 2)


def combine_estimate(
    *, prior_minutes: int, source: DurationSource, history: HistorySummary
) -> DurationEstimate:
    # Actual-history fallback is already personalized. Never multiply it again.
    factor = (
        calculate_adjustment_factor(history) if source in {"ai_prior", "current_estimate"} else 1.0
    )
    minutes = round_duration(prior_minutes * factor)
    if source == "history":
        explanation = f"Based on recorded focus time from {history.count} similar completed tasks."
    elif source == "default":
        explanation = (
            "Not enough comparable history. Using your focus-session default as a starting point."
        )
    elif source == "current_estimate":
        explanation = f"Using your saved estimate of {prior_minutes} minutes as the starting point."
    else:
        explanation = f"AI suggested a starting estimate of {prior_minutes} minutes."
    if source in {"ai_prior", "current_estimate"} and history.count:
        explanation += (
            f" Personal history ({history.count} tasks) gives an adjustment of {factor:g}x."
        )
    if history.count == 0:
        explanation += " No reliable personal history yet; confidence is low."
    if history.excluded_count:
        explanation += f" Excluded {history.excluded_count} unusual historical samples."
    explanation += " This is total active work time, not time remaining or a scheduled slot."
    return DurationEstimate(
        suggested_duration_minutes=minutes,
        confidence=calculate_confidence(history, source),
        historical_sample_count=history.count,
        adjustment_factor=factor,
        explanation=explanation,
        source=source,
        prior_minutes=prior_minutes,
    )
