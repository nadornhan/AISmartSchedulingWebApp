from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth.router import router as auth_router
from app.config import get_settings
from app.notifications.router import router as notifications_router
from app.projects.router import router as projects_router
from app.tasks.router import router as tasks_router

settings = get_settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="AI Smart Scheduling API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(tasks_router)
app.include_router(notifications_router)
app.mount(
    settings.media_url_path,
    StaticFiles(directory=settings.upload_dir),
    name="media",
)
