from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import app.focus.models
import app.gamification.models
import app.scheduling.models
from app.analytics.router import router as analytics_router
from app.auth.router import router as auth_router
from app.config import get_settings
from app.dashboard.router import router as dashboard_router
from app.focus.router import router as focus_router
from app.folders.router import router as folders_router
from app.gamification.router import router as gamification_router
from app.notifications.router import router as notifications_router
from app.projects.router import router as projects_router
from app.scheduling.router import router as scheduling_router
from app.settings.router import router as settings_router
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
    # Next.js may fall back to 3001+ when 3000 is busy.
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(folders_router)
app.include_router(tasks_router)
app.include_router(notifications_router)
app.include_router(settings_router)
app.include_router(analytics_router)
app.include_router(scheduling_router)
app.include_router(focus_router)
app.include_router(dashboard_router)
app.include_router(gamification_router)
app.mount(
    settings.media_url_path,
    StaticFiles(directory=settings.upload_dir),
    name="media",
)
