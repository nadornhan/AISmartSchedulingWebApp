from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ConstraintResult:
    name: str
    passed: bool
    reason: str | None = None
    metadata: dict[str, Any] | None = None


@dataclass(frozen=True)
class ConstraintValidationResult:
    valid: bool
    checks: tuple[ConstraintResult, ...]


@dataclass(frozen=True)
class FactorResult:
    name: str
    score: float
    weight: float
    reason: str | None = None


@dataclass(frozen=True)
class ScoreBreakdown:
    profile_name: str
    scoring_version: str
    factors: tuple[FactorResult, ...]
    weighted_score: float
    focus_bonus: float
    final_score: float


@dataclass(frozen=True)
class ScoredCandidate:
    candidate: Any
    score: float
    breakdown: ScoreBreakdown


@dataclass(frozen=True)
class CandidateScoreBreakdown:
    profile_name: str
    scoring_version: str
    task_importance_score: float
    task_importance_profile: str
    duration_slot_fit_score: float
    required_minutes: int
    window_minutes: int
    focus_slot_fit_score: float = 0.0
    focus_peak_hour: int | None = None
    candidate_hour: int | None = None


@dataclass(frozen=True)
class ScoredWindowCandidate:
    candidate: Any
    task_importance_score: float
    duration_slot_fit_score: float
    breakdown: CandidateScoreBreakdown
    focus_slot_fit_score: float = 0.0
