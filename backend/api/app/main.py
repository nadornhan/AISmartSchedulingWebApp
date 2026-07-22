from fastapi import FastAPI

from app.auth.router import router as auth_router
from app.tasks.router import router as tasks_router

app = FastAPI(title="CSIT321 AI Smart Scheduling API")

app.include_router(auth_router)
app.include_router(tasks_router)