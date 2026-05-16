# Why This Stack

This project uses a full-stack architecture:

```text
Next.js web app
  -> FastAPI backend
  -> SQLAlchemy ORM
  -> PostgreSQL database

Supabase Auth provides user authentication.
```

This stack is more involved than a Supabase-only app, but it gives the project a clear frontend/backend split and creates room for more complex productivity features later.

## Stack Summary

| Layer | Choice | Reason |
| --- | --- | --- |
| Frontend | Next.js | Strong React framework for pages, UI, routing, and future server-side features. |
| Auth | Supabase Auth | Fast account setup with email login and managed user sessions. |
| API | FastAPI | Clean Python backend for HTTP routes, validation, and feature logic. |
| ORM | SQLAlchemy | Structured Python database layer instead of scattered raw SQL. |
| Database | PostgreSQL | Reliable relational database for tasks, folders, deadlines, focus sessions, analytics, and gamification. |
| Local stack | Docker Compose | Repeatable local database, API, and web app setup. |

## Why Not Supabase Only

A Supabase-only app would be simpler:

```text
Next.js
  -> Supabase Auth
  -> Supabase Postgres
```

That can work for an MVP. However, this project includes planned features that can become easier to organize with a dedicated backend:

- task management rules
- folders and inbox behavior
- deadlines and reminders
- Pomodoro/focus session tracking
- productivity analytics
- streaks and tree growth
- future AI prioritization
- future scheduled jobs or notification workflows

Using FastAPI gives the team one backend place to put business rules instead of spreading logic across frontend components, database policies, SQL functions, and client-side code.

## Why FastAPI

FastAPI is useful here because it gives the project:

- explicit API routes such as `GET /tasks`, `POST /tasks`, and `PATCH /tasks/{task_id}`
- request and response validation through Pydantic schemas
- dependency injection for auth and database sessions
- clean integration with Python tooling
- a natural place for future service logic

The frontend does not need to know database details. It calls the API, and the API decides how to validate, authorize, store, and return data.

## Why SQLAlchemy ORM

SQLAlchemy is the backend's database mapping layer. It lets the backend represent database tables as Python classes.

Example:

```python
task = Task(
    user_id=current_user.id,
    title=payload.title,
    description=payload.description,
)

db.add(task)
db.commit()
```

Without an ORM, the backend would need raw SQL in many places:

```sql
insert into tasks (user_id, title, description)
values (...);
```

Raw SQL is sometimes useful, but using it everywhere can become repetitive and harder to maintain as the schema grows.

SQLAlchemy helps because it:

- keeps table definitions in one organized Python layer
- makes CRUD operations easier to read and update
- maps database rows into Python objects
- reduces repeated hand-written SQL
- supports relationships between models
- works well with PostgreSQL
- can pair with Alembic migrations later

For this project, SQLAlchemy models can eventually represent:

```text
Task
Folder
Reminder
FocusSession
UserPreference
ProductivityStat
Streak
TreeProgress
Achievement
```

That matters because the app is not only a simple task list. The planned features create relationships between tasks, time, focus sessions, stats, and gamification records.

## SQLAlchemy Model vs Pydantic Schema

The backend uses two different kinds of data objects:

```text
SQLAlchemy model  -> database table/row representation
Pydantic schema   -> API request/response representation
```

For example:

- `Task` model: how a task is stored in PostgreSQL
- `TaskCreate` schema: what the frontend may send when creating a task
- `TaskRead` schema: what the API returns to the frontend

This separation is useful because the API should not expose every database detail directly.

## Supabase's Role

In this stack, Supabase is used for authentication.

Flow:

```text
User signs in with Supabase Auth
  -> frontend receives a Supabase access token
  -> frontend sends the token to FastAPI
  -> FastAPI verifies the token
  -> FastAPI uses the token subject as the current user id
  -> task data is stored in PostgreSQL through SQLAlchemy
```

Supabase is not the active task-storage layer in this architecture. Task data belongs to the app backend and database.

## When This Stack Is Worth It

This stack is worth keeping if the project wants:

- clear parallel frontend and backend development
- backend API design practice
- database modeling practice
- centralized business logic
- easier future support for scheduled jobs, analytics, and AI features
- less direct coupling between frontend components and database tables

It is also a good fit if different teammates will own different areas:

```text
frontend/web     UI and client behavior
backend/api      API routes, auth checks, database logic
packages/shared  shared TypeScript types
```

## Tradeoffs

The cost of this stack is extra setup and more moving parts:

- FastAPI backend must be maintained
- SQLAlchemy models must stay aligned with the database
- migrations should be added before schema changes become frequent
- frontend and backend contracts need coordination

For a very small app, Supabase-only would be faster. For this project, the current stack gives more structure for a team building multiple features in parallel.

## Near-Term Improvements

To make this stack stronger:

1. Add Alembic migrations.
2. Split backend routes, models, schemas, and services by feature.
3. Add API tests for task CRUD and auth behavior.
4. Keep `docs/STACK.md` updated as architecture changes.
5. Remove or clarify any unused Supabase task-storage migrations if Supabase remains auth-only.
