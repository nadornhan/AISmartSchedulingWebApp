"""Generated tasks retain the details edited in the shared task form."""

import unittest
from datetime import datetime
from unittest.mock import patch
from uuid import uuid4

from pydantic import ValidationError

from app.tasks import generation_service
from app.tasks.generation_schemas import GeneratedTaskDraft, TaskGenerationConfirmRequest
from app.tasks.schemas import SubtaskInput, TaskCreate
from app.timezones import user_timezone


class GeneratedTaskFormTests(unittest.TestCase):
    def setUp(self):
        self.user_id = uuid4()
        self.draft = GeneratedTaskDraft(client_id="task-1", title="Generated title")

    def payload(self, details):
        return TaskGenerationConfirmRequest(
            proposal_token="test-proposal",
            tasks=[self.draft],
            task_details=details,
        )

    def test_confirmation_preserves_full_form_details(self):
        project_id = uuid4()
        task = TaskCreate(
            title="Edited title",
            description="Bring a shopping bag",
            project_id=project_id,
            priority="high",
            due_date=datetime.fromisoformat("2026-11-02T11:00:00+00:00"),
            estimated_duration_minutes=45,
            subtasks=[SubtaskInput(title="Make shopping list", position=0)],
        )
        payload = self.payload([task])
        with (
            patch.object(generation_service, "verify_token") as verify,
            patch.object(
                generation_service.project_service, "get_project_by_id", return_value=object()
            ) as project,
            patch.object(
                generation_service.task_service, "create_tasks_atomic", return_value=[]
            ) as create,
        ):
            generation_service.confirm(None, user_id=self.user_id, payload=payload)
        verify.assert_called_once_with("test-proposal", user_id=self.user_id)
        project.assert_called_once_with(None, project_id, self.user_id)
        create.assert_called_once_with(None, self.user_id, payload.task_details)
        saved = create.call_args.args[2][0]
        self.assertEqual(saved.model_dump(), task.model_dump())

    def test_clearing_due_date_is_preserved(self):
        payload = self.payload([TaskCreate(title="No deadline", due_date=None)])
        with (
            patch.object(generation_service, "verify_token"),
            patch.object(
                generation_service.task_service, "create_tasks_atomic", return_value=[]
            ) as create,
        ):
            generation_service.confirm(None, user_id=self.user_id, payload=payload)
        self.assertIsNone(create.call_args.args[2][0].due_date)

    def test_mismatched_detail_count_is_rejected(self):
        with self.assertRaises(ValidationError):
            self.payload([TaskCreate(title="First"), TaskCreate(title="Unexpected second")])

    def test_another_users_folder_is_rejected_before_writing(self):
        payload = self.payload([TaskCreate(title="Task", project_id=uuid4())])
        with (
            patch.object(generation_service, "verify_token"),
            patch.object(
                generation_service.project_service, "get_project_by_id", return_value=None
            ),
            patch.object(generation_service.task_service, "create_tasks_atomic") as create,
        ):
            with self.assertRaisesRegex(LookupError, "Project not found"):
                generation_service.confirm(None, user_id=self.user_id, payload=payload)
        create.assert_not_called()

    def test_invalid_proposal_cannot_write_full_form_details(self):
        with (
            patch.object(generation_service, "verify_token", side_effect=LookupError("Invalid")),
            patch.object(generation_service.task_service, "create_tasks_atomic") as create,
        ):
            with self.assertRaises(LookupError):
                generation_service.confirm(
                    None,
                    user_id=self.user_id,
                    payload=self.payload([TaskCreate(title="Task")]),
                )
        create.assert_not_called()

    def test_existing_confirmation_payload_remains_supported(self):
        payload = TaskGenerationConfirmRequest(
            proposal_token="test-proposal",
            tasks=[self.draft.model_copy(update={"due_date": datetime(2026, 11, 2).date()})],
        )
        with (
            patch.object(generation_service, "verify_token"),
            patch.object(
                generation_service.settings_service,
                "timezone_name_for_user",
                return_value="Australia/Sydney",
            ),
            patch.object(
                generation_service.task_service, "create_tasks_atomic", return_value=[]
            ) as create,
        ):
            generation_service.confirm(None, user_id=self.user_id, payload=payload)
        saved = create.call_args.args[2][0]
        local_due = saved.due_date.astimezone(user_timezone("Australia/Sydney"))
        self.assertEqual((local_due.hour, local_due.minute), (23, 59))
        self.assertEqual(saved.title, self.draft.title)


if __name__ == "__main__":
    unittest.main()
