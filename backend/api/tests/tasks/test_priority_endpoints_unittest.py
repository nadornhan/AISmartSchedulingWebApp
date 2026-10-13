"""Executable without pytest; uses fake AI and mocked persistence only."""
import unittest
import uuid
from datetime import UTC, datetime, timedelta, time
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app.main import app  # load ORM relationships
from app.ai import AIService
from app.ai.fake import FakeAIProvider
from app.ai.limiter import AIRequestLimiter
from app.tasks.models import Task, TaskPriority, TaskStatus
from app.tasks.priority_router import build_preview, confirm_priority
from app.tasks.priority_schemas import PriorityPreviewRequest, PriorityConfirmRequest


class PriorityFlowTests(unittest.TestCase):
    def setUp(self):
        self.user = SimpleNamespace(id=uuid.uuid4())
        self.task = Task(id=uuid.uuid4(), user_id=self.user.id, title="Task",
                         priority=TaskPriority.LOW, status=TaskStatus.PENDING,
                         due_date=datetime.now(UTC) + timedelta(hours=2),
                         estimated_duration_minutes=30, updated_at=datetime.now(UTC))
        self.db = MagicMock()
        self.db.scalars.return_value = []
        self.settings = SimpleNamespace(work_start=time(9), work_end=time(17), timezone="Australia/Sydney",
                                        pomodoro_minutes=25, ai_assistant_enabled=True,
                                        ai_deadline_urgency_weight=80, ai_priority_weight=70)

    def preview(self, responses=None):
        provider = FakeAIProvider(responses)
        ai = AIService(provider, AIRequestLimiter(10))
        with patch('app.tasks.priority_router._preview_settings', return_value=self.settings), \
             patch('app.tasks.priority_router.get_ai_service', return_value=ai):
            result = build_preview(self.db, self.user.id, self.task, PriorityPreviewRequest(), saved=True)
        self.db.commit.assert_not_called()
        self.assertEqual(self.task.priority, TaskPriority.LOW)
        return result

    def payload(self, preview, **changes):
        values = dict(expected_updated_at=preview.expected_updated_at,
                      confirmation_token=preview.confirmation_token,
                      selected_priority=preview.proposal.suggested_priority,
                      action="accept")
        values.update(changes)
        return PriorityConfirmRequest(**values)

    def test_preview_uses_fake_ai_and_never_writes(self):
        result = self.preview([{"importance_level": "high", "confidence": .9, "reason": "Major assessed deliverable."}])
        self.assertEqual(result.proposal.importance_level, "high")
        self.assertEqual(result.proposal.importance_source, "ai")
        self.assertEqual(result.proposal.importance_confidence, .9)
        self.assertEqual(result.metadata.source, "fake")

    def test_insufficient_information_does_not_default_medium(self):
        result = self.preview([{"importance_level": None, "confidence": 0, "reason": "Impact is not specified."}])
        self.assertIsNone(result.proposal.importance_level)
        self.assertIn("importance_level", result.proposal.missing_inputs)

    def test_ai_can_suggest_low_without_default_medium(self):
        self.task.due_date = None
        result = self.preview([{"importance_level": "low", "confidence": .8, "reason": "Optional cosmetic task."}])
        self.assertEqual(result.proposal.suggested_priority, TaskPriority.LOW)

    def test_one_ai_call_receives_task_description(self):
        self.task.description = "Worth 40 percent of the final grade"
        provider = FakeAIProvider([{"importance_level": "high", "confidence": .9, "reason": "Major grade impact."}])
        with patch('app.tasks.priority_router._preview_settings', return_value=self.settings), \
             patch('app.tasks.priority_router.get_ai_service', return_value=AIService(provider, AIRequestLimiter(10))):
            build_preview(self.db, self.user.id, self.task, PriorityPreviewRequest())
        self.assertEqual(len(provider.calls), 1)
        self.assertIn(self.task.description, provider.calls[0]['prompt'])
        self.assertEqual(provider.calls[0]['prompt_version'], 'priority-suggestion-v3')

    def test_invalid_ai_output_falls_back(self):
        result = self.preview([{"explanation": "Override", "priority": "low"}])
        self.assertEqual(result.metadata.source, "deterministic_fallback")
        self.assertIsNone(result.proposal.ai_explanation)
        self.assertIsNone(result.proposal.importance_level)

    def test_confirm_and_duplicate_rejection(self):
        preview = self.preview()
        payload = self.payload(preview)
        self.db.scalar.return_value = self.task
        with patch('app.tasks.priority_router.invalidate_pending_plan'), \
             patch('app.tasks.priority_router.service.get_task_by_id', return_value=self.task):
            confirm_priority(self.task.id, payload, self.db, self.user)
            self.db.commit.assert_called_once()
            self.assertEqual(self.task.priority, payload.selected_priority)
            with self.assertRaises(HTTPException) as ctx:
                confirm_priority(self.task.id, payload, self.db, self.user)
            self.assertEqual(ctx.exception.status_code, 409)

    def test_stale_preview_preserves_manual_choice(self):
        preview = self.preview()
        self.task.updated_at += timedelta(seconds=1)
        self.task.priority = TaskPriority.MEDIUM
        self.db.scalar.return_value = self.task
        with self.assertRaises(HTTPException) as ctx:
            confirm_priority(self.task.id, self.payload(preview), self.db, self.user)
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(self.task.priority, TaskPriority.MEDIUM)
        self.db.commit.assert_not_called()

    def test_other_user_cannot_confirm(self):
        preview = self.preview()
        with self.assertRaises(HTTPException) as ctx:
            confirm_priority(self.task.id, self.payload(preview), self.db, SimpleNamespace(id=uuid.uuid4()))
        self.assertEqual(ctx.exception.status_code, 403)

    def test_dependencies_must_belong_to_user(self):
        with patch('app.tasks.priority_router._preview_settings', return_value=self.settings), \
             patch('app.tasks.priority_router.service.get_tasks_by_ids', return_value=[]):
            with self.assertRaises(HTTPException) as ctx:
                build_preview(self.db, self.user.id, self.task,
                              PriorityPreviewRequest(dependency_ids=[uuid.uuid4()]))
        self.assertEqual(ctx.exception.status_code, 404)


if __name__ == '__main__':
    unittest.main()
