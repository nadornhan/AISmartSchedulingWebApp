"""Add demo projects/tasks to an existing account through the deployed web API.

Preview is the default. Credentials stay in memory; settings and existing records
are never updated. Uses only the Python standard library.
"""

import argparse
import getpass
import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

FIXTURES = json.loads(Path(__file__).with_name("demo_account_data.json").read_text(encoding="utf-8"))
PROJECTS = FIXTURES["projects"]
TASKS = FIXTURES["tasks"]


def task_datetime(anchor: datetime, value: list[int]) -> datetime:
    day_offset, hour, minute = value
    return (anchor + timedelta(days=day_offset)).replace(
        hour=hour, minute=minute, second=0, microsecond=0,
    ).astimezone(UTC)


class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError("Unexpected redirect; check --site before retrying")


class WebApi:
    def __init__(self, site: str):
        parsed = urllib.parse.urlsplit(site)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("--site must be an HTTPS origin, such as https://chronow.org")
        self.site = site.rstrip("/")
        self.opener = urllib.request.build_opener(
            NoRedirects(),
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()),
        )

    def request(self, method: str, path: str, payload=None):
        request = urllib.request.Request(
            f"{self.site}/api/{path}",
            method=method,
            data=json.dumps(payload).encode() if payload is not None else None,
            headers={
                "Content-Type": "application/json",
                "Origin": self.site,
                "X-Chrono-CSRF": "1",
            },
        )
        # Never retry writes automatically: a timeout can follow a committed insert.
        with self.opener.open(request, timeout=75) as response:
            return json.load(response) if response.status != 204 else None

    def tasks(self):
        tasks = []
        page = 1
        while True:
            result = self.request("GET", f"tasks?page={page}&page_size=100")
            tasks.extend(result["items"])
            if page >= result["total_pages"]:
                return tasks
            page += 1


def populate(api, email: str, *, apply: bool, anchor: datetime):
    me = api.request("GET", "auth/me")
    if me["email"].casefold() != email.casefold():
        raise ValueError("Authenticated account does not match the requested email")

    projects = api.request("GET", "projects")
    project_ids = {project["name"]: project["id"] for project in projects}
    existing_titles = {task["title"] for task in api.tasks()}
    missing_projects = [project for project in PROJECTS if project["name"] not in project_ids]
    missing_tasks = [task for task in TASKS if task["title"] not in existing_titles]
    print(json.dumps({
        "site": api.site,
        "account": {"email": me["email"], "id": me["id"]},
        "mode": "apply" if apply else "preview",
        "anchor_date": anchor.date().isoformat(),
        "projects_to_add": [project["name"] for project in missing_projects],
        "tasks_to_add": [task["title"] for task in missing_tasks],
        "existing_fixture_titles_skipped": len(TASKS) - len(missing_tasks),
    }, indent=2), flush=True)
    if not apply:
        return

    for project in missing_projects:
        result = api.request("POST", "projects", project)
        project_ids[project["name"]] = result["id"]
        print(f"Created project {result['id']}: {project['name']}", flush=True)

    for task in missing_tasks:
        payload = {
            "title": task["title"],
            "description": task["description"],
            "project_id": project_ids[task["project"]] if task["project"] else None,
            "priority": task["priority"],
            "due_date": task_datetime(anchor, task["due_at"]).isoformat(),
            "estimated_duration_minutes": task["estimated_duration_minutes"],
            "subtasks": task.get("subtasks", []),
        }
        created = api.request("POST", "tasks", payload)
        print(f"Created task {created['id']}: {task['title']}", flush=True)
        if task["status"] != "pending":
            api.request("PATCH", f"tasks/{created['id']}", {"status": task["status"]})

    final_projects = api.request("GET", "projects")
    final_tasks = api.tasks()
    if not {p["name"] for p in PROJECTS}.issubset({p["name"] for p in final_projects}):
        raise RuntimeError("Project verification failed")
    by_title = {task["title"]: task for task in final_tasks}
    for task in missing_tasks:
        saved = by_title.get(task["title"])
        if (
            saved is None
            or saved["user_id"] != me["id"]
            or saved.get("workflow_status", saved["status"]) != task["status"]
            or saved["project_id"] != (project_ids[task["project"]] if task["project"] else None)
            or saved["priority"] != task["priority"]
            or saved["estimated_duration_minutes"] != task["estimated_duration_minutes"]
            or [(s["title"], s["is_completed"]) for s in saved["subtasks"]]
            != [(s["title"], s.get("is_completed", False)) for s in task.get("subtasks", [])]
        ):
            raise RuntimeError(f"Task verification failed: {task['title']}")
    print(json.dumps({"verified": True, "counts": api.request("GET", "tasks/counts")}), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", default="https://chronow.org")
    parser.add_argument("--email", default="demo@example.com")
    parser.add_argument("--apply", action="store_true", help="Write missing fixtures")
    parser.add_argument("--preview-fixtures", action="store_true", help="Offline dataset preview")
    parser.add_argument("--password-env", help="Environment variable containing the password")
    args = parser.parse_args()
    if args.preview_fixtures:
        print(json.dumps({"projects": PROJECTS, "tasks": TASKS}, indent=2))
        return

    api = WebApi(args.site)
    password = os.environ.get(args.password_env) if args.password_env else None
    if args.password_env and not password:
        parser.error("The password environment variable is empty")
    if password is None:
        password = getpass.getpass(f"Password for {args.email}: ")
    try:
        api.request("POST", "auth/login", {"email": args.email, "password": password})
        populate(api, args.email, apply=args.apply, anchor=datetime.now(ZoneInfo("Australia/Sydney")))
    except urllib.error.HTTPError as error:
        print(
            f"API returned HTTP {error.code}. Import stopped; prior writes may have succeeded.",
            file=sys.stderr,
        )
        return 1
    except (ValueError, RuntimeError, urllib.error.URLError, TimeoutError) as error:
        print(f"Import stopped: {error}. Prior writes may have succeeded.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
