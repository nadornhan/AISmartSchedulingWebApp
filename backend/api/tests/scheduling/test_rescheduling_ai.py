import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.ai.exceptions import (
    AIConfigurationError,
    AIDisabledError,
    AIInvalidResponseError,
    AIQuotaError,
    AITimeoutError,
)
from app.ai.fake import FakeAIProvider
from app.ai.limiter import AIRequestLimiter
from app.ai.service import AIService
from app.scheduling import lifecycle
from app.scheduling.lifecycle import (
    persist_reschedule_ai_result,
    serialize_reschedule_proposal,
)
from app.scheduling.models import RescheduleProposal
from app.scheduling.rescheduling_ai import (
    build_reschedule_explanation_prompt,
    generate_reschedule_explanations,
)
from app.scheduling.schemas import (
    PersistedRescheduleAIResult,
    PersistedRescheduleContext,
    RescheduleMove,
    RescheduleOption,
    RescheduleProposalContext,
)


class _FailingProvider:
    source_name = "failing"
    model_name = "none"

    def __init__(self, error: Exception) -> None:
        self.error = error

    def generate_structured(self, **_kwargs):
        raise self.error


def _context_and_options() -> tuple[RescheduleProposalContext, list[RescheduleOption]]:
    now = datetime.now(UTC)
    task_id = uuid.uuid4()
    context = RescheduleProposalContext(
        timezone="Australia/Sydney",
        changes=[
            {
                "code": "SCHEDULE_CONFLICT",
                "reason": "Task overlaps a locked calendar block",
                "task_id": task_id,
            }
        ],
        affected_task_ids=[task_id],
    )
    options = [
        RescheduleOption(
            id=uuid.uuid4(),
            style="minimal_disruption",
            deterministic_rank=1,
            moves=[
                RescheduleMove(
                    task_id=task_id,
                    task_title="Prepare report",
                    previous_start=now,
                    previous_end=now + timedelta(minutes=30),
                    proposed_start=now + timedelta(hours=1),
                    proposed_end=now + timedelta(hours=1, minutes=30),
                )
            ],
            moved_task_count=1,
            total_displacement_minutes=60,
            completion_at=now + timedelta(hours=1, minutes=30),
            deterministic_reasons=["Moves one task by the smallest amount"],
        )
    ]
    return context, options


def _service(provider) -> AIService:
    return AIService(provider, AIRequestLimiter(100))


def test_prompt_contains_only_explanation_authority() -> None:
    context, options = _context_and_options()

    prompt = build_reschedule_explanation_prompt(
        context=context,
        options=options,
        requested_at=datetime.now(UTC),
    )

    assert str(options[0].id) in prompt
    assert options[0].moves[0].proposed_start.isoformat() in prompt
    assert "Do not propose or alter timestamps, ranks, scores" in prompt
    assert "user_id" not in prompt


def test_valid_ai_explanation_uses_registered_policy_and_round_trips() -> None:
    context, options = _context_and_options()
    provider = FakeAIProvider(
        [
            {
                "explanations": [
                    {
                        "option_id": str(options[0].id),
                        "explanation": "This option minimizes disruption by moving one task.",
                    }
                ]
            }
        ]
    )

    result = generate_reschedule_explanations(
        ai_service=_service(provider),
        user_id=uuid.uuid4(),
        context=context,
        options=options,
    )

    assert result.payload.explanations[0].option_id == options[0].id
    assert result.metadata.source == "fake"
    assert provider.calls[0]["feature"] == "intelligent_rescheduling"
    assert provider.calls[0]["prompt_version"] == "rescheduling-explanation-v1"


@pytest.mark.parametrize(
    "response",
    [
        {"explanations": [{"option_id": str(uuid.uuid4()), "explanation": "Unknown"}]},
        {"explanations": []},
        {
            "explanations": [
                {
                    "option_id": str(uuid.uuid4()),
                    "explanation": "Attempts to modify authority",
                    "proposed_start": "2099-01-01T09:00:00Z",
                }
            ]
        },
    ],
)
def test_invalid_ai_payload_falls_back_without_explanations(response: object) -> None:
    context, options = _context_and_options()

    result = generate_reschedule_explanations(
        ai_service=_service(FakeAIProvider([response])),
        user_id=uuid.uuid4(),
        context=context,
        options=options,
    )

    assert result.payload.explanations == []
    assert result.metadata.source == "deterministic_fallback"
    assert result.metadata.fallback_reason in {
        "ai_invalid_option_ids",
        "ai_invalid_response",
    }


@pytest.mark.parametrize(
    "error",
    [
        AIDisabledError("disabled"),
        AIConfigurationError("misconfigured"),
        AITimeoutError("timeout"),
        AIQuotaError("quota"),
        AIInvalidResponseError("invalid json"),
    ],
)
def test_ai_failures_keep_deterministic_options(error: Exception) -> None:
    context, options = _context_and_options()

    result = generate_reschedule_explanations(
        ai_service=_service(_FailingProvider(error)),
        user_id=uuid.uuid4(),
        context=context,
        options=options,
    )

    assert result.payload.explanations == []
    assert result.metadata.source == "deterministic_fallback"
    assert result.metadata.fallback_reason == error.code


def test_serializer_merges_only_persisted_explanation_copy() -> None:
    context, options = _context_and_options()
    now = datetime.now(UTC)
    generated = generate_reschedule_explanations(
        ai_service=_service(
            FakeAIProvider(
                [
                    {
                        "explanations": [
                            {
                                "option_id": str(options[0].id),
                                "explanation": "Keeps the rest of the schedule unchanged.",
                            }
                        ]
                    }
                ]
            )
        ),
        user_id=uuid.uuid4(),
        context=context,
        options=options,
    )
    proposal = RescheduleProposal(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        status="preview",
        state_fingerprint="b" * 64,
        detected_context=PersistedRescheduleContext(context=context).model_dump(mode="json"),
        state_snapshot={},
        alternatives=[option.model_dump(mode="json") for option in options],
        ai_explanations=PersistedRescheduleAIResult.model_validate(generated).model_dump(
            mode="json"
        ),
        expires_at=now + timedelta(minutes=30),
        created_at=now,
    )

    response = serialize_reschedule_proposal(proposal)

    assert response.options[0].explanation == "Keeps the rest of the schedule unchanged."
    assert response.options[0].deterministic_rank == options[0].deterministic_rank
    assert response.options[0].moves == options[0].moves
    assert response.ai_metadata is not None
    assert response.ai_metadata.source == "fake"


def test_ai_result_persistence_is_user_scoped_and_committed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    context, options = _context_and_options()
    now = datetime.now(UTC)
    user_id = uuid.uuid4()
    proposal = RescheduleProposal(
        id=uuid.uuid4(),
        user_id=user_id,
        status="preview",
        state_fingerprint="c" * 64,
        detected_context=PersistedRescheduleContext(context=context).model_dump(mode="json"),
        state_snapshot={},
        alternatives=[option.model_dump(mode="json") for option in options],
        expires_at=now + timedelta(minutes=30),
        created_at=now,
    )
    generated = generate_reschedule_explanations(
        ai_service=_service(_FailingProvider(AIDisabledError("disabled"))),
        user_id=user_id,
        context=context,
        options=options,
    )
    seen: dict[str, object] = {}

    class _Db:
        commits = 0
        rollbacks = 0

        def commit(self) -> None:
            self.commits += 1

        def rollback(self) -> None:
            self.rollbacks += 1

        def refresh(self, value) -> None:
            seen["refreshed"] = value

    def load(_db, scoped_user_id, scoped_proposal_id):
        seen["scope"] = (scoped_user_id, scoped_proposal_id)
        return proposal

    monkeypatch.setattr(lifecycle, "_load_proposal_for_update", load)
    db = _Db()

    stored = persist_reschedule_ai_result(db, user_id, proposal.id, generated)

    assert seen["scope"] == (user_id, proposal.id)
    assert seen["refreshed"] is proposal
    assert stored.ai_explanations == generated.model_dump(mode="json")
    assert db.commits == 1
    assert db.rollbacks == 0
