from datetime import UTC, datetime

from sqlalchemy import select

from app.auth.models import User
from app.auth.security import hash_password
from app.database import SessionLocal
from app.projects.models import Project
from app.tasks import service as task_service
from app.tasks.models import Task, TaskPriority, TaskStatus
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
        "due_at": (7, 8, 9, 0),
        "estimated_duration": 75,
    },
    {
        "title": "Submit database assignment",
        "description": "Review migration notes and upload the final report.",
        "project": "University",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.PENDING,
        "due_at": (7, 19, 14, 30),
        "estimated_duration": 120,
    },
    {
        "title": "Prepare systems quiz",
        "description": "Revise process scheduling and memory paging.",
        "project": "University",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.IN_PROGRESS,
        "due_at": (8, 5, 11, 0),
        "estimated_duration": 90,
    },
    {
        "title": "Group project retrospective",
        "description": "Write notes for the final team reflection.",
        "project": "University",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.DONE,
        "due_at": (9, 12, 16, 0),
        "estimated_duration": 45,
    },
    {
        "title": "Update internship timesheet",
        "description": "Log hours and add task summaries for mentor review.",
        "project": "Internship",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.PENDING,
        "due_at": (7, 10, 17, 0),
        "estimated_duration": 20,
    },
    {
        "title": "Prepare sprint demo",
        "description": "Polish the task sync flow and collect screenshots.",
        "project": "Internship",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.IN_PROGRESS,
        "due_at": (7, 25, 10, 30),
        "estimated_duration": 90,
    },
    {
        "title": "Refactor onboarding notes",
        "description": "Clean up setup instructions for the next intern.",
        "project": "Internship",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (8, 15, 13, 0),
        "estimated_duration": 60,
    },
    {
        "title": "Book mentor catch-up",
        "description": "Send available times and attach sprint questions.",
        "project": "Internship",
        "priority": TaskPriority.NO_PRIORITY,
        "status": TaskStatus.PENDING,
        "due_at": (9, 3, 9, 30),
        "estimated_duration": 15,
    },
    {
        "title": "Draft portfolio case study",
        "description": "Outline feature goals, trade-offs, and results.",
        "project": "Internship",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (9, 21, 15, 0),
        "estimated_duration": 100,
    },
    {
        "title": "Plan weekly groceries",
        "description": "Add recurring essentials and budget notes.",
        "project": "Personal",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.DONE,
        "due_at": (7, 4, 18, 30),
        "estimated_duration": 30,
    },
    {
        "title": "Renew transport card",
        "description": "Top up and check concession expiry.",
        "project": "Personal",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (7, 28, 8, 15),
        "estimated_duration": 20,
    },
    {
        "title": "Clean apartment desk",
        "description": "Reset workspace before the next study block.",
        "project": "Personal",
        "priority": TaskPriority.NO_PRIORITY,
        "status": TaskStatus.PENDING,
        "due_at": (8, 9, 12, 0),
        "estimated_duration": 40,
    },
    {
        "title": "Birthday gift research",
        "description": "Shortlist three practical gift ideas.",
        "project": "Personal",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.PENDING,
        "due_at": (8, 29, 20, 0),
        "estimated_duration": 45,
    },
    {
        "title": "Tax document checklist",
        "description": "Collect receipts and payment summaries.",
        "project": "Personal",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.PENDING,
        "due_at": (9, 8, 19, 0),
        "estimated_duration": 80,
    },
    {
        "title": "Read scheduling paper",
        "description": "Extract ideas for priority scoring.",
        "project": "Research",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (7, 15, 11, 30),
        "estimated_duration": 60,
    },
    {
        "title": "Compare task ranking heuristics",
        "description": "Create a small comparison table for the report.",
        "project": "Research",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.PENDING,
        "due_at": (7, 31, 14, 0),
        "estimated_duration": 95,
    },
    {
        "title": "Annotate calendar integration article",
        "description": "Capture notes about schedule-aware interfaces.",
        "project": "Research",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.IN_PROGRESS,
        "due_at": (8, 18, 10, 0),
        "estimated_duration": 70,
    },
    {
        "title": "Draft survey questions",
        "description": "Prepare five questions for student scheduling habits.",
        "project": "Research",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.PENDING,
        "due_at": (9, 1, 13, 30),
        "estimated_duration": 50,
    },
    {
        "title": "Summarise experiment results",
        "description": "Turn raw notes into a concise result section.",
        "project": "Research",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.PENDING,
        "due_at": (9, 18, 16, 30),
        "estimated_duration": 110,
    },
    {
        "title": "Send research update",
        "description": "Email progress summary and blockers.",
        "project": "Research",
        "priority": TaskPriority.NO_PRIORITY,
        "status": TaskStatus.PENDING,
        "due_at": (9, 27, 9, 0),
        "estimated_duration": 25,
    },
    {
        "title": "Morning run",
        "description": "Easy run and stretch before class.",
        "project": "Health",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.DONE,
        "due_at": (7, 6, 7, 0),
        "estimated_duration": 45,
    },
    {
        "title": "Meal prep protein bowls",
        "description": "Cook lunches for the next three days.",
        "project": "Health",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (8, 3, 17, 30),
        "estimated_duration": 75,
    },
    {
        "title": "Book dental appointment",
        "description": "Find a slot around classes.",
        "project": "Health",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.PENDING,
        "due_at": (8, 20, 12, 30),
        "estimated_duration": 15,
    },
    {
        "title": "Review sleep routine",
        "description": "Adjust bedtime target before exam week.",
        "project": "Health",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.PENDING,
        "due_at": (9, 10, 21, 0),
        "estimated_duration": 30,
    },
    {
        "title": "Sketch dashboard concepts",
        "description": "Explore alternate empty and loading states.",
        "project": "Creative",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (7, 22, 20, 0),
        "estimated_duration": 60,
    },
    {
        "title": "Edit project screenshots",
        "description": "Crop dark-theme screenshots for the portfolio.",
        "project": "Creative",
        "priority": TaskPriority.LOW,
        "status": TaskStatus.PENDING,
        "due_at": (8, 7, 18, 0),
        "estimated_duration": 50,
    },
    {
        "title": "Write UI case study intro",
        "description": "Frame the problem and target user journey.",
        "project": "Creative",
        "priority": TaskPriority.HIGH,
        "status": TaskStatus.PENDING,
        "due_at": (8, 26, 15, 30),
        "estimated_duration": 90,
    },
    {
        "title": "Publish design notes",
        "description": "Post a concise write-up of design decisions.",
        "project": "Creative",
        "priority": TaskPriority.MEDIUM,
        "status": TaskStatus.PENDING,
        "due_at": (9, 24, 11, 0),
        "estimated_duration": 65,
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


def seed_tasks(user: User, projects: dict[str, Project]) -> None:
    seed_year = datetime.now(UTC).year

    with SessionLocal() as db:
        for task_data in TASKS:
            task = db.scalar(
                select(Task).where(
                    Task.user_id == user.id,
                    Task.title == task_data["title"],
                )
            )
            project_name = task_data["project"]
            project_id = projects[project_name].id if project_name is not None else None
            month, day, hour, minute = task_data["due_at"]
            due_date = datetime(seed_year, month, day, hour, minute, tzinfo=UTC)

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
                        estimated_duration=task_data["estimated_duration"],
                    ),
                )

            task.description = task_data["description"]
            task.project_id = project_id
            task.priority = task_data["priority"]
            task.status = task_data["status"]
            task.due_date = due_date
            task.estimated_duration = task_data["estimated_duration"]

        db.commit()


def main() -> None:
    user = get_or_create_user()
    projects = seed_projects(user)
    seed_tasks(user, projects)
    print(f"Seeded demo data for {SEED_EMAIL} / {SEED_PASSWORD}")


if __name__ == "__main__":
    main()
