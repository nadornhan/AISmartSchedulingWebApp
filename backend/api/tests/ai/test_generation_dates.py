"""Explicit dates and times survive AI generation, fallback and confirmation."""

import unittest
from datetime import UTC, date, datetime
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from pydantic import ValidationError

from app.ai.fake import FakeAIProvider
from app.ai.limiter import AIRequestLimiter
from app.ai.service import AIService
from app.tasks import generation_service
from app.tasks.generation_schemas import GeneratedTaskDraft, TaskGenerationConfirmRequest
from app.tasks.generation_temporal import resolve_schedule
from app.timezones import user_timezone


class FixedDateTime(datetime):
    @classmethod
    def now(cls, tz=None):
        # Already Tuesday in Sydney, while the UTC server is still on Monday.
        instant = cls(2026, 10, 26, 13, 30, tzinfo=UTC)
        return instant.astimezone(tz) if tz else instant.replace(tzinfo=None)


class GeneratedScheduleTests(unittest.TestCase):
    def setUp(self):
        self.today = date(2026, 10, 27)
        self.user_id = uuid4()

    def preview(self, prompt, responses=None, *, ai_enabled=True):
        provider = FakeAIProvider(responses)
        with (
            patch.object(generation_service, "datetime", FixedDateTime),
            patch.object(
                generation_service, "get_settings",
                return_value=SimpleNamespace(ai_enabled=ai_enabled),
            ),
            patch.object(
                generation_service.settings_service, "timezone_name_for_user",
                return_value="Australia/Sydney",
            ),
        ):
            result = generation_service.preview(
                None, user_id=self.user_id, prompt=prompt,
                ai_service=AIService(provider, AIRequestLimiter(100)),
            )
        return result, provider

    def test_hospital_sunday_fallback_returns_november_first_at_five_pm(self):
        result, _ = self.preview("Go to hospital 5pm on Sunday")
        task = result.proposal.tasks[0]
        self.assertEqual(result.metadata.source, "deterministic_fallback")
        self.assertEqual(task.title, "Go to hospital")
        self.assertEqual(task.due_date, date(2026, 11, 1))
        self.assertEqual(task.due_time, "17:00")

    def test_explicit_schedule_corrects_an_ai_date_or_time_mistake(self):
        result, provider = self.preview("Go to hospital 5pm on Sunday", [{"tasks": [{
            "client_id": "task-1", "title": "Go to hospital",
            "due_date": "2026-10-27", "due_time": "05:00",
        }]}])
        self.assertEqual(result.metadata.source, "fake")
        self.assertEqual(result.proposal.tasks[0].due_date, date(2026, 11, 1))
        self.assertEqual(result.proposal.tasks[0].due_time, "17:00")
        self.assertIn('"today":"2026-10-27"', provider.calls[0]["prompt"])
        self.assertIn('"due_date":"2026-11-01"', provider.calls[0]["prompt"])

    def test_weekdays_use_the_users_local_day_across_month_boundaries(self):
        for weekday, expected in [
            ("Monday", date(2026, 11, 2)), ("Tuesday", date(2026, 10, 27)),
            ("Wednesday", date(2026, 10, 28)), ("Thursday", date(2026, 10, 29)),
            ("Friday", date(2026, 10, 30)), ("Saturday", date(2026, 10, 31)),
            ("Sunday", date(2026, 11, 1)),
        ]:
            with self.subTest(weekday=weekday):
                self.assertEqual(
                    resolve_schedule(f"Appointment on {weekday}", today=self.today).due_date,
                    expected,
                )

    def test_next_same_weekday_moves_forward_seven_days(self):
        self.assertEqual(
            resolve_schedule("Appointment next Tuesday", today=self.today).due_date,
            date(2026, 11, 3),
        )
        self.assertEqual(
            resolve_schedule("Appointment this Tuesday", today=self.today).due_date, self.today,
        )

    def test_relative_dates_cross_the_year_boundary(self):
        for phrase, expected in [
            ("today", date(2026, 12, 31)), ("tomorrow", date(2027, 1, 1)),
            ("day after tomorrow", date(2027, 1, 2)),
        ]:
            with self.subTest(phrase=phrase):
                self.assertEqual(
                    resolve_schedule(f"Appointment {phrase}", today=date(2026, 12, 31)).due_date,
                    expected,
                )

    def test_explicit_iso_date_is_preserved(self):
        schedule = resolve_schedule("Appointment on 2026-11-08 at 17:30", today=self.today)
        self.assertEqual(schedule.due_date, date(2026, 11, 8))
        self.assertEqual(schedule.due_time, "17:30")

    def test_noon_midnight_and_minutes_are_not_confused(self):
        for value, expected in [("12am", "00:00"), ("12pm", "12:00"), ("5:30 PM", "17:30")]:
            with self.subTest(value=value):
                self.assertEqual(resolve_schedule(value, today=self.today).due_time, expected)

    def test_fallback_batch_keeps_each_tasks_own_schedule(self):
        result, _ = self.preview(
            "Go to hospital 5pm on Sunday; Review slides 9am on Monday", ai_enabled=False,
        )
        self.assertEqual(
            [(task.due_date, task.due_time) for task in result.proposal.tasks],
            [(date(2026, 11, 1), "17:00"), (date(2026, 11, 2), "09:00")],
        )

    def test_multiple_ai_tasks_do_not_inherit_the_first_tasks_schedule(self):
        result, _ = self.preview("Hospital Sunday and review slides Monday", [{"tasks": [
            {"client_id": "task-1", "title": "Hospital", "due_date": "2026-11-01"},
            {"client_id": "task-2", "title": "Review slides", "due_date": "2026-11-02"},
        ]}])
        self.assertEqual(
            [task.due_date for task in result.proposal.tasks],
            [date(2026, 11, 1), date(2026, 11, 2)],
        )

    def test_confirmation_converts_five_pm_sydney_to_utc(self):
        payload = TaskGenerationConfirmRequest(proposal_token="test-proposal", tasks=[
            GeneratedTaskDraft(
                client_id="task-1", title="Hospital", due_date=date(2026, 11, 1),
                due_time="17:00",
            ),
        ])
        with (
            patch.object(generation_service, "verify_token"),
            patch.object(
                generation_service.settings_service, "timezone_name_for_user",
                return_value="Australia/Sydney",
            ),
            patch.object(
                generation_service.task_service, "create_tasks_atomic", return_value=[],
            ) as create,
        ):
            generation_service.confirm(None, user_id=self.user_id, payload=payload)
        saved = create.call_args.args[2][0]
        self.assertEqual(saved.due_date, datetime(2026, 11, 1, 6, 0, tzinfo=UTC))
        self.assertEqual(saved.due_date.astimezone(user_timezone("Australia/Sydney")).hour, 17)

    def test_invalid_generated_times_are_rejected(self):
        for value in ["25:00", "12:60", "5pm"]:
            with self.subTest(value=value), self.assertRaises(ValidationError):
                GeneratedTaskDraft(client_id="task-1", title="Task", due_time=value)


if __name__ == "__main__":
    unittest.main()
