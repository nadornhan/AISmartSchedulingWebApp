FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/api/pyproject.toml ./
RUN pip install --no-cache-dir .

COPY backend/api/alembic.ini ./
COPY backend/api/alembic ./alembic
COPY backend/api/app ./app
COPY backend/api/scripts/start_render.sh ./start_render.sh

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
