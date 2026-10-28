"""Isolated read-path checks: use an in-memory database, never the demo database."""

import unittest
import uuid
from datetime import UTC, datetime
from unittest.mock import patch

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

from app.analytics import service as analytics
from app.auth.models import User
from app.database import Base
from app.focus.models import FocusSession, focus_session_tasks
from app.gamification import service as forest
from app.gamification.models import (
    Achievement,
    PlantSpecies,
    RewardEvent,
    UserAchievement,
    UserGamificationProfile,
    UserPlant,
)
from app.projects.models import Project
from app.scheduling.schemas import SchedulingPlanResponse
from app.settings.models import UserSettings
from app.tasks.models import Subtask, Task, TaskStatus


class FeatureReadTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine, tables=[
            model.__table__ for model in (
                User, UserSettings, Project, Task, Subtask, FocusSession,
                PlantSpecies, UserPlant, UserGamificationProfile, RewardEvent,
                Achievement, UserAchievement,
            )
        ] + [focus_session_tasks])
        self.user_id = uuid.uuid4()
        self.now = datetime.now(UTC)
        with Session(self.engine) as db:
            db.add(User(id=self.user_id, email="read-test@example.com", password_hash="test"))
            db.add(UserSettings(user_id=self.user_id, timezone="UTC"))
            db.add(UserGamificationProfile(user_id=self.user_id))
            db.add(PlantSpecies(
                id="oak", name="Oak", description="Test plant", image_key="oak",
                required_growth_points=100,
                unlock_requirement={"type": "tasks_completed", "value": 1},
            ))
            db.commit()
        self.statements = []
        event.listen(self.engine, "before_cursor_execute", self._record_query)

    def tearDown(self):
        self.engine.dispose()

    def _record_query(self, _connection, _cursor, statement, _parameters, _context, _many):
        self.statements.append(statement)

    def task_count_queries(self):
        return sum("FROM tasks" in query and "count(" in query for query in self.statements)

    def test_many_trees_share_one_unlock_count(self):
        with Session(self.engine) as db:
            db.add_all([
                UserPlant(
                    user_id=self.user_id, species_id="oak", status="completed",
                    growth_stage="mature", current_growth_points=100, completed_at=self.now,
                )
                for _ in range(40)
            ])
            db.commit()
        self.statements.clear()
        with Session(self.engine) as db:
            scene = forest.get_forest_scene(db, self.user_id)
        self.assertEqual(len(scene.trees), 40)
        self.assertEqual(self.task_count_queries(), 1)

    def test_separate_reads_recalculate_unlocks_after_task_changes(self):
        with Session(self.engine) as db:
            self.assertFalse(forest.get_plant_catalog(db, self.user_id).plants[0].unlocked)
            db.add(Task(
                user_id=self.user_id, title="Complete task", status=TaskStatus.DONE,
                completed_at=self.now,
            ))
            db.commit()
            self.assertTrue(forest.get_plant_catalog(db, self.user_id).plants[0].unlocked)

    def test_claimed_achievement_tiers_share_one_count(self):
        with Session(self.engine) as db:
            for index in range(8):
                identifier = f"tasks-{index}"
                db.add(Achievement(
                    id=identifier, name=identifier, description="Test tier", icon="check",
                    requirement_type="tasks_completed", requirement_value=index + 1,
                ))
                db.add(UserAchievement(
                    user_id=self.user_id, achievement_id=identifier, claimed_at=self.now,
                ))
            db.commit()
        self.statements.clear()
        with Session(self.engine) as db:
            response = forest.get_achievements(db, self.user_id)
        self.assertEqual(response.claimed_count, 8)
        self.assertEqual(len(response.achievements), 8)
        self.assertEqual(self.task_count_queries(), 1)

    def test_metrics_only_review_skips_scheduling(self):
        with Session(self.engine) as db, patch.object(
            analytics.scheduling_service, "generate_plan", side_effect=AssertionError("Planner ran")
        ):
            user = db.get(User, self.user_id)
            summary = analytics.get_insights_summary(db, user, include_schedule=False)
        self.assertIsNone(summary.scheduling_plan)
        self.assertEqual(summary.tasks_completed_this_week, 0)

    def test_existing_summary_callers_still_get_a_schedule(self):
        plan = SchedulingPlanResponse(recommendation=None, schedule=[], generated_at=self.now)
        with Session(self.engine) as db, patch.object(
            analytics.scheduling_service, "generate_plan", return_value=plan
        ) as generate:
            summary = analytics.get_insights_summary(db, db.get(User, self.user_id))
        generate.assert_called_once()
        self.assertEqual(summary.scheduling_plan, plan)


if __name__ == "__main__":
    unittest.main()
