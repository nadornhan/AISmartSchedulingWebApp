from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.auth.models import User
from app.auth.security import hash_password
from app.database import SessionLocal
from app.projects.models import Project
from app.tasks import service as task_service
from app.tasks.models import Subtask, Task, TaskPriority, TaskStatus
from app.tasks.schemas import TaskCreate

SEED_EMAIL = "demo@example.com"
SEED_PASSWORD = "DemoPassword123"

PROJECTS = [
    {"name": "University", "color": "#22F0B1"},
    {"name": "Internship", "color": "#60A5FA"},
    {"name": "Personal", "color": "#F59E0B"},
    {"name": "Research", "color": "#F472B6"},
    {"name": "Health", "color": "#34D399"},
    {"name": "Creative", "color": "#A78BFA"},
]

TASKS = [
    {
        "title": "Review calculus lecture notes",
        "description": "Summarise the key formulas before tutorial.",
        "project": "University",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (-13, 9, 0),
        "estimated_duration_minutes": 75,
    },
    {
        "title": "Submit database assignment",
        "description": "Review migration notes and upload the final report.",
        "project": "University",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.PENDING,
        "due_at": (-9, 14, 30),
        "estimated_duration_minutes": 120,
    },
    {
        "title": "Prepare systems quiz",
        "description": "Revise process scheduling and memory paging.",
        "project": "University",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.IN_PROGRESS,
        "due_at": (1, 11, 0),
        "estimated_duration_minutes": 90,
    },
    {
        "title": "Group project retrospective",
        "description": "Write notes for the final team reflection.",
        "project": "University",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.DONE,
        "due_at": (-1, 16, 0),
        "estimated_duration_minutes": 45,
    },
    {
        "title": "Update internship timesheet",
        "description": "Log hours and add task summaries for mentor review.",
        "project": "Internship",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.PENDING,
        "due_at": (-12, 17, 0),
        "estimated_duration_minutes": 20,
    },
    {
        "title": "Prepare sprint demo",
        "description": "Polish the task sync flow and collect screenshots.",
        "project": "Internship",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.IN_PROGRESS,
        "due_at": (-5, 10, 30),
        "estimated_duration_minutes": 90,
    },
    {
        "title": "Refactor onboarding notes",
        "description": "Clean up setup instructions for the next intern.",
        "project": "Internship",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (6, 13, 0),
        "estimated_duration_minutes": 60,
    },
    {
        "title": "Book mentor catch-up",
        "description": "Send available times and attach sprint questions.",
        "project": "Internship",
        "priority": TaskPriority.NO_PRIORITY,
        "status": TaskStatus.PENDING,
        "due_at": (13, 9, 30),
        "estimated_duration_minutes": 15,
    },
    {
        "title": "Draft portfolio case study",
        "description": "Outline feature goals, trade-offs, and results.",
        "project": "Internship",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (16, 15, 0),
        "estimated_duration_minutes": 100,
    },
    {
        "title": "Plan weekly groceries",
        "description": "Add recurring essentials and budget notes.",
        "project": "Personal",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.DONE,
        "due_at": (-3, 18, 30),
        "estimated_duration_minutes": 30,
    },
    {
        "title": "Renew transport card",
        "description": "Top up and check concession expiry.",
        "project": "Personal",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (-4, 8, 15),
        "estimated_duration_minutes": 20,
    },
    {
        "title": "Clean apartment desk",
        "description": "Reset workspace before the next study block.",
        "project": "Personal",
        "priority": TaskPriority.NO_PRIORITY,
        "status": TaskStatus.PENDING,
        "due_at": (2, 12, 0),
        "estimated_duration_minutes": 40,
    },
    {
        "title": "Birthday gift research",
        "description": "Shortlist three practical gift ideas.",
        "project": "Personal",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.PENDING,
        "due_at": (10, 20, 0),
        "estimated_duration_minutes": 45,
    },
    {
        "title": "Tax document checklist",
        "description": "Collect receipts and payment summaries.",
        "project": "Personal",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.PENDING,
        "due_at": (14, 19, 0),
        "estimated_duration_minutes": 80,
    },
    {
        "title": "Read scheduling paper",
        "description": "Extract ideas for priority scoring.",
        "project": "Research",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (-10, 11, 30),
        "estimated_duration_minutes": 60,
    },
    {
        "title": "Compare task ranking heuristics",
        "description": "Create a small comparison table for the report.",
        "project": "Research",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.PENDING,
        "due_at": (-2, 14, 0),
        "estimated_duration_minutes": 95,
    },
    {
        "title": "Annotate calendar integration article",
        "description": "Capture notes about schedule-aware interfaces.",
        "project": "Research",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.IN_PROGRESS,
        "due_at": (7, 10, 0),
        "estimated_duration_minutes": 70,
    },
    {
        "title": "Draft survey questions",
        "description": "Prepare five questions for student scheduling habits.",
        "project": "Research",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.PENDING,
        "due_at": (12, 13, 30),
        "estimated_duration_minutes": 50,
    },
    {
        "title": "Summarise experiment results",
        "description": "Turn raw notes into a concise result section.",
        "project": "Research",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.PENDING,
        "due_at": (15, 16, 30),
        "estimated_duration_minutes": 110,
    },
    {
        "title": "Send research update",
        "description": "Email progress summary and blockers.",
        "project": "Research",
        "priority": TaskPriority.NO_PRIORITY,
        "status": TaskStatus.PENDING,
        "due_at": (11, 9, 0),
        "estimated_duration_minutes": 25,
    },
    {
        "title": "Morning run",
        "description": "Easy run and stretch before class.",
        "project": "Health",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.DONE,
        "due_at": (-2, 7, 0),
        "estimated_duration_minutes": 45,
    },
    {
        "title": "Meal prep protein bowls",
        "description": "Cook lunches for the next three days.",
        "project": "Health",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (-1, 17, 30),
        "estimated_duration_minutes": 75,
    },
    {
        "title": "Book dental appointment",
        "description": "Find a slot around classes.",
        "project": "Health",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.PENDING,
        "due_at": (8, 12, 30),
        "estimated_duration_minutes": 15,
    },
    {
        "title": "Review sleep routine",
        "description": "Adjust bedtime target before exam week.",
        "project": "Health",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.PENDING,
        "due_at": (14, 21, 0),
        "estimated_duration_minutes": 30,
    },
    {
        "title": "Sketch dashboard concepts",
        "description": "Explore alternate empty and loading states.",
        "project": "Creative",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (-7, 20, 0),
        "estimated_duration_minutes": 60,
    },
    {
        "title": "Edit project screenshots",
        "description": "Crop dark-theme screenshots for the portfolio.",
        "project": "Creative",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.PENDING,
        "due_at": (3, 18, 0),
        "estimated_duration_minutes": 50,
    },
    {
        "title": "Write UI case study intro",
        "description": "Frame the problem and target user journey.",
        "project": "Creative",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.PENDING,
        "due_at": (9, 15, 30),
        "estimated_duration_minutes": 90,
    },
    {
        "title": "Publish design notes",
        "description": "Post a concise write-up of design decisions.",
        "project": "Creative",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (15, 11, 0),
        "estimated_duration_minutes": 65,
    },
    {
        "title": "Reply to mentor feedback",
        "description": "Send a concise update about yesterday's sprint notes.",
        "project": "Internship",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.DONE,
        "due_at": (0, 9, 10),
        "completed_at": (0, 9, 18),
        "estimated_duration_minutes": 8,
    },
    {
        "title": "Triage project inbox",
        "description": "Sort new tasks into the right project folders.",
        "project": "Personal",
        "priority": TaskPriority.NO_PRIORITY,
        "status": TaskStatus.DONE,
        "due_at": (0, 9, 35),
        "completed_at": (0, 9, 48),
        "estimated_duration_minutes": 12,
    },
    {
        "title": "Fix README setup typo",
        "description": "Patch the Docker command and verify the quickstart.",
        "project": "Internship",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.PENDING,
        "due_at": (0, 10, 20),
        "estimated_duration_minutes": 10,
    },
    {
        "title": "Write database migration notes",
        "description": "Capture rollback steps and schema decisions.",
        "project": "University",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.IN_PROGRESS,
        "due_at": (0, 11, 30),
        "estimated_duration_minutes": 55,
        "subtasks": [
            {"title": "List changed columns", "is_completed": True},
            {"title": "Add downgrade notes", "is_completed": False},
            {"title": "Review with assignment rubric", "is_completed": False},
        ],
    },
    {
        "title": "Email study group agenda",
        "description": "Confirm topics and meeting link.",
        "project": "University",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.PENDING,
        "due_at": (0, 12, 15),
        "estimated_duration_minutes": 7,
    },
    {
        "title": "Review pull request comments",
        "description": "Check requested changes and group them by risk.",
        "project": "Internship",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.IN_PROGRESS,
        "due_at": (0, 14, 0),
        "estimated_duration_minutes": 35,
        "subtasks": [
            {"title": "Read unresolved threads", "is_completed": True},
            {"title": "Reproduce failing path", "is_completed": False},
            {"title": "Draft response summary", "is_completed": False},
        ],
    },
    {
        "title": "Deep work: scheduler scoring prototype",
        "description": "Tune priority, duration, and due-date weights.",
        "project": "Research",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.PENDING,
        "due_at": (0, 16, 30),
        "estimated_duration_minutes": 120,
        "subtasks": [
            {"title": "Create sample task set", "is_completed": True},
            {"title": "Run score comparison", "is_completed": False},
            {"title": "Document chosen weights", "is_completed": False},
            {"title": "Add edge-case notes", "is_completed": False},
        ],
    },
    {
        "title": "Update weekly budget",
        "description": "Log groceries, transport, and coffee spending.",
        "project": "Personal",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (0, 18, 0),
        "estimated_duration_minutes": 18,
    },
    {
        "title": "Stretch after study block",
        "description": "Ten-minute reset before dinner.",
        "project": "Health",
        "priority": TaskPriority.NO_PRIORITY,
        "status": TaskStatus.PENDING,
        "due_at": (0, 19, 15),
        "estimated_duration_minutes": 10,
    },
    {
        "title": "Draft dashboard microcopy",
        "description": "Write labels for empty, loading, and overdue states.",
        "project": "Creative",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (1, 9, 45),
        "estimated_duration_minutes": 40,
        "subtasks": [
            {"title": "Empty state labels", "is_completed": True},
            {"title": "Overdue badge text", "is_completed": False},
            {"title": "Quick win button copy", "is_completed": False},
        ],
    },
    {
        "title": "Send landlord maintenance reply",
        "description": "Confirm preferred repair window.",
        "project": "Personal",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.PENDING,
        "due_at": (1, 10, 30),
        "estimated_duration_minutes": 6,
    },
    {
        "title": "Prepare tutorial questions",
        "description": "Write examples for normalization and indexing.",
        "project": "University",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.PENDING,
        "due_at": (1, 13, 0),
        "estimated_duration_minutes": 50,
        "subtasks": [
            {"title": "Review lecture slides", "is_completed": False},
            {"title": "Write two SQL examples", "is_completed": False},
            {"title": "Add one indexing question", "is_completed": False},
        ],
    },
    {
        "title": "Clean task labels",
        "description": "Merge duplicate labels and remove stale drafts.",
        "project": "Internship",
        "priority": TaskPriority.NO_PRIORITY,
        "status": TaskStatus.PENDING,
        "due_at": (1, 15, 20),
        "estimated_duration_minutes": 9,
    },
    {
        "title": "Read paper abstract set",
        "description": "Skim five abstracts and choose two to read deeply.",
        "project": "Research",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (1, 17, 10),
        "estimated_duration_minutes": 25,
    },
    {
        "title": "Edit portfolio hero screenshot",
        "description": "Crop, sharpen, and export the dashboard image.",
        "project": "Creative",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.PENDING,
        "due_at": (1, 20, 0),
        "estimated_duration_minutes": 30,
    },
]


def get_or_create_user() -> User:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == SEED_EMAIL))

        if user is not None:
            return user

        user = User(
            email=SEED_EMAIL,
            first_name="Chrono",
            last_name="Demo",
            role="student",
            password_hash=hash_password(SEED_PASSWORD),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def seed_projects(user: User) -> dict[str, Project]:
    with SessionLocal() as db:
        projects: dict[str, Project] = {}

        for project_data in PROJECTS:
            project = db.scalar(
                select(Project).where(
                    Project.user_id == user.id,
                    Project.name == project_data["name"],
                )
            )

            if project is None:
                project = Project(
                    user_id=user.id,
                    name=project_data["name"],
                    color=project_data["color"],
                )
                db.add(project)
            else:
                project.color = project_data["color"]

            projects[project_data["name"]] = project

        db.commit()

        for project in projects.values():
            db.refresh(project)

        return projects


def task_datetime(anchor: datetime, value: tuple[int, int, int]) -> datetime:
    day_offset, hour, minute = value
    target_date = (anchor + timedelta(days=day_offset)).date()
    return datetime(
        target_date.year,
        target_date.month,
        target_date.day,
        hour,
        minute,
        tzinfo=UTC,
    )


def sync_subtasks(task: Task, subtasks: list[dict] | None) -> None:
    task.subtasks.clear()

    if not subtasks:
        return

    task.subtasks.extend(
        Subtask(
            title=subtask["title"],
            is_completed=subtask.get("is_completed", False),
            position=position,
        )
        for position, subtask in enumerate(subtasks)
    )


def seed_tasks(user: User, projects: dict[str, Project]) -> None:
    anchor = datetime.now(UTC)

    with SessionLocal() as db:
        for task_data in TASKS:
            task = db.scalar(
                select(Task)
                .options(selectinload(Task.subtasks))
                .where(
                    Task.user_id == user.id,
                    Task.title == task_data["title"],
                )
            )
            project_name = task_data["project"]
            project_id = projects[project_name].id if project_name is not None else None
            due_date = task_datetime(anchor, task_data["due_at"])
            completed_at = (
                task_datetime(anchor, task_data["completed_at"])
                if "completed_at" in task_data
                else due_date + timedelta(minutes=task_data["estimated_duration_minutes"])
            )

            if task is None:
                task = task_service.create_task(
                    db,
                    user.id,
                    TaskCreate(
                        title=task_data["title"],
                        description=task_data["description"],
                        project_id=project_id,
                        priority=task_data["priority"],
                        due_date=due_date,
                        estimated_duration_minutes=task_data["estimated_duration_minutes"],
                        subtasks=task_data.get("subtasks", []),
                    ),
                )
                task = db.scalar(
                    select(Task)
                    .options(selectinload(Task.subtasks))
                    .where(Task.id == task.id)
                )

            if task is None:
                continue

            task.description = task_data["description"]
            task.project_id = project_id
            task.priority = task_data["priority"]
            task.status = task_data["status"]
            task.due_date = due_date
            task.estimated_duration_minutes = task_data["estimated_duration_minutes"]
            task.completed_at = (
                completed_at
                if task_data["status"] == TaskStatus.DONE
                else None
            )
            sync_subtasks(task, task_data.get("subtasks"))

        db.commit()


def main() -> None:
    user = get_or_create_user()
    projects = seed_projects(user)
    seed_tasks(user, projects)
    print(f"Seeded demo data for {SEED_EMAIL} / {SEED_PASSWORD}")


if __name__ == "__main__":
    main()
