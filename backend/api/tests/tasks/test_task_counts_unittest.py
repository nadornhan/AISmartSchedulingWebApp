"""Task summary regression checks using an isolated SQLite database only."""

import unittest
import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

import app.main  # noqa: F401 - Register ORM relationships without connecting to PostgreSQL.
from app.auth.models import User
from app.projects.models import Project
from app.tasks.models import Subtask, Task, TaskStatus
from app.tasks.router import router, task_counts
from app.tasks.schemas import TaskDisplayStatus
from app.tasks.service import count_tasks, list_tasks


class TaskCountTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        for model in [User, Project, Task, Subtask]:
            model.__table__.create(self.engine)
        self.db = Session(self.engine)
        self.user = uuid.uuid4()
        self.project = uuid.uuid4()
        now = datetime.now(UTC)
        rows = [
            (
                self.user,
                self.project,
                "Course overdue",
                None,
                TaskStatus.PENDING,
                now - timedelta(days=1),
            ),
            (
                self.user,
                uuid.uuid4(),
                "Course active overdue",
                None,
                TaskStatus.IN_PROGRESS,
                now - timedelta(days=1),
            ),
            (
                self.user,
                self.project,
                "Course upcoming",
                None,
                TaskStatus.PENDING,
                now + timedelta(days=1),
            ),
            (self.user, None, "Course active", None, TaskStatus.IN_PROGRESS, None),
            (
                self.user,
                self.project,
                "Course finished",
                None,
                TaskStatus.DONE,
                now - timedelta(days=1),
            ),
            (self.user, None, "Unscheduled", "revision topic", TaskStatus.PENDING, None),
            (
                uuid.uuid4(),
                self.project,
                "Course other user",
                "revision topic",
                TaskStatus.PENDING,
                None,
            ),
        ]
        self.db.execute(
            Task.__table__.insert(),
            [
                dict(
                    id=uuid.uuid4(),
                    user_id=user,
                    project_id=project,
                    title=title,
                    description=description,
                    status=status,
                    due_date=due,
                )
                for user, project, title, description, status, due in rows
            ],
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_counts_match_existing_status_filters_and_exclude_other_users(self):
        counts = count_tasks(self.db, self.user)
        self.assertEqual(counts, dict(total=6, pending=2, in_progress=1, done=1, overdue=2))
        for status in TaskDisplayStatus:
            _, total = list_tasks(self.db, self.user, task_status=status)
            self.assertEqual(counts[status.value], total)
        self.assertEqual(
            sum(counts[k] for k in ["pending", "in_progress", "done", "overdue"]), counts["total"]
        )

    def test_search_project_and_inbox_scopes_match_list_endpoint(self):
        for scope in [
            dict(search="Course"),
            dict(search=" revision "),
            dict(project_id=self.project),
            dict(inbox_only=True),
            dict(project_id=self.project, search="upcoming"),
        ]:
            counts = count_tasks(self.db, self.user, **scope)
            self.assertEqual(counts["total"], list_tasks(self.db, self.user, **scope)[1])
            for status in TaskDisplayStatus:
                self.assertEqual(
                    counts[status.value],
                    list_tasks(self.db, self.user, task_status=status, **scope)[1],
                )

    def test_empty_results_and_single_query(self):
        statements = []

        def record(_connection, _cursor, statement, *_args):
            statements.append(statement)

        event.listen(self.engine, "before_cursor_execute", record)
        result = count_tasks(self.db, uuid.uuid4())
        self.assertEqual(result, dict(total=0, pending=0, in_progress=0, done=0, overdue=0))
        self.assertEqual(len(statements), 1)

    def test_endpoint_checks_project_ownership_before_counting(self):
        with patch(
            "app.tasks.router._ensure_project", side_effect=HTTPException(404, "Project not found")
        ):
            with self.assertRaises(HTTPException) as error:
                task_counts(
                    self.db,
                    SimpleNamespace(id=self.user),
                    search=None,
                    project_id=uuid.uuid4(),
                    inbox_only=False,
                )
        self.assertEqual(error.exception.status_code, 404)

    def test_static_counts_route_precedes_task_id(self):
        paths = [route.path for route in router.routes if hasattr(route, "path")]
        self.assertLess(paths.index("/tasks/counts"), paths.index("/tasks/{task_id}"))


if __name__ == "__main__":
    unittest.main()
