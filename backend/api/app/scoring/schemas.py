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
