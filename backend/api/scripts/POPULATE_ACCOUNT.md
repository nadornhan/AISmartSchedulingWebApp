# Populate an existing deployed account

`populate_account.py` adds the included realistic sample dataset through the
deployed website's cookie-authenticated API. It never connects to a database,
creates an account, or changes settings. It needs Python 3.12+ and timezone data
(available in the backend environment).

From `backend/api`, preview the dataset without logging in:

```powershell
.venv/Scripts/python.exe scripts/populate_account.py --preview-fixtures
```

Preview missing records for an existing account, then apply:

```powershell
.venv/Scripts/python.exe scripts/populate_account.py --email your-account@example.com
.venv/Scripts/python.exe scripts/populate_account.py --email your-account@example.com --apply
```

The script prompts for a password without echoing it. For automation,
`--password-env VARIABLE_NAME` reads a password from a named environment
variable. Credentials and session cookies stay in memory. `--site` selects a
different HTTPS deployment origin; it defaults to `https://chronow.org`.

The dataset contains 6 projects, 46 tasks and 35 subtasks. Dates are relative to
the import date in Australia/Sydney. Completed samples are completed through the
normal API at import time; their historical completion timestamps are not
backdated. This does not create historical focus sessions or forest data.

Projects with matching names and tasks with matching titles are skipped, so a
repeat run does not overwrite existing work. The importer checks the signed-in
email before writing and verifies new records after writing. It preserves the
API's normal validation and task-completion rewards.

API writes are sequential and are not one database transaction. If an import
fails, earlier records can remain saved. Review the printed IDs and run preview
again before resuming. If a task was created but its status update failed, it
will be skipped on a repeat run; correct its status in the app. Do not run
multiple imports for the same account concurrently.
