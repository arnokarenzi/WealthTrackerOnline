# FinTrack Productivity — Phase 3: Calendar and Eisenhower Matrix

## Scope

This is an incremental source package for the existing FinTrack Productivity Foundation (Phase 1) and Tasks/Projects/My Day stage (Phase 2). It adds:

- A persistent calendar event table and calendar event API.
- Day, week and month calendar views.
- Display of existing task scheduled dates and due dates in the calendar.
- Create, edit and delete operations for calendar events.
- An Eisenhower Matrix built from the existing task `is_urgent` and `is_important` fields.
- Calendar and Matrix navigation links and Productivity Home shortcuts.
- Task search prefill from Calendar links.

The package does not add dependencies and does not modify financial data or calculations.

## Important prerequisites

The current package includes the Phase 1, Phase 2 and Phase 3 productivity migrations and source integrations. It is an overlay for the existing FinTrack project, not a standalone application archive.

Extract it into the existing project root and preserve the included folder structure. If Phase 1 and Phase 2 have already been installed, do not rerun their migrations; apply only the new Phase 3 migration. If they have not yet been installed, apply all three migrations in the order shown below.

## Back up the Aiven database first

From a Linux terminal:

```bash
mkdir -p ~/fintrack-backups
mysqldump \
  -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com \
  -P 18926 \
  -u avnadmin \
  -p \
  --single-transaction \
  defaultdb \
  > ~/fintrack-backups/fintrack-before-productivity-phase3.sql
```

Enter the Aiven password at the prompt. Check that the resulting backup file exists and is not empty before continuing.

## Install source files

Extract `FinTrack_Productivity_Phase3_Complete_Calendar_Eisenhower.zip` into `~/fintrack`, allowing replacement only of the files included in the archive.

No `.env`, database credentials, financial source files, `node_modules`, or built frontend assets are included.

## Apply the Aiven migrations

Run these commands in the normal Linux terminal, not inside the `mysql>` console. They prompt separately for the Aiven password. Apply only migrations that have not already been installed.

Phase 1 — workspace settings:

```bash
cd ~/fintrack
mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb < Backend/migrations/20261102_productivity_foundation.sql
```

Phase 2 — tasks, projects and subtasks:

```bash
mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb < Backend/migrations/20261103_productivity_tasks_projects.sql
```

Phase 3 — calendar events:

```bash
mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb < Backend/migrations/20261104_productivity_calendar_events.sql
```

If Phase 1 and Phase 2 were already applied successfully, run only the Phase 3 command. The Phase 3 migration only creates `ProductivityCalendarEvents`. It does not modify `ProductivitySettings`, `ProductivityProjects`, `ProductivityTasks`, or any financial table.

Verify in the MySQL console:

```sql
SHOW TABLES LIKE 'ProductivityCalendarEvents';
SELECT COUNT(*) FROM ProductivityCalendarEvents;
```

The new table should exist and initially have zero rows.

## Run the application

Backend terminal:

```bash
cd ~/fintrack/Backend
npm test
npm run dev
```

Frontend terminal:

```bash
cd ~/fintrack/Frontend
npm ci
npm run build
npm run dev
```

Use the existing local package-lock and `.env`. Do not run `db:fresh-install`, a project initialization/reset command, or `TRUNCATE`.

## Verify the API

With the backend running, request a date range from the browser or API client:

```text
GET http://localhost:5000/api/productivity/calendar?startDate=2026-11-01&endDate=2026-11-30
```

The response contains `events` and `tasks` arrays. Tasks are sourced from `ProductivityTasks`; the calendar does not create duplicate task records.

Calendar event endpoints:

- `GET /api/productivity/calendar?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `POST /api/productivity/calendar/events`
- `PUT /api/productivity/calendar/events/:id`
- `DELETE /api/productivity/calendar/events/:id`

Example event JSON:

```json
{
  "title": "Doctor appointment",
  "description": "Annual check-up",
  "eventDate": "2026-11-10",
  "startTime": "09:00",
  "endTime": "10:00",
  "isAllDay": false,
  "color": "#1976d2"
}
```

The Calendar page is at `/#/productivity/calendar`; the Eisenhower Matrix is at `/#/productivity/eisenhower`.

## Functionality notes

- Calendar views use the saved week-start and default-view preferences from Phase 1.
- A task with a planned date appears on its scheduled date. A different due date appears separately as a deadline. If scheduled and due dates are the same, one calendar item indicates both.
- Completed tasks remain visible on the calendar with a completed style. Cancelled tasks are excluded.
- Calendar events are independent records and can be created, edited, or deleted.
- The Matrix uses the existing task fields `isUrgent` and `isImportant`. Moving a task updates the original task. Completed and cancelled tasks are excluded.
- The four quadrants are Do first (urgent + important), Schedule (important + not urgent), Delegate (urgent + not important), and Review or remove (neither).
- The Q4 recommendation is guidance only; FinTrack does not automatically delete tasks.

## Current application security boundary

The source audit found no sign-in/session middleware or user ownership model in the current FinTrack project. Productivity records therefore follow the existing shared single-workspace model. Do not expose this application as a multi-user service until authentication and owner scoping are implemented across the application.

## Not included in this phase

- Recurring calendar events.
- External Google Calendar or Outlook synchronization.
- Email, push or scheduled reminders for calendar events.
- Drag-and-drop rescheduling.

These remain later-stage features. Tasks can already be scheduled through the Tasks page and their dates appear in the calendar.

## Verification performed in the preparation environment

- Backend JavaScript syntax checks: passed for productivity controllers, services, utilities and routes.
- Backend automated tests: 37 passed, 0 failed.
- TypeScript/TSX parser: 8 changed frontend source files parsed with no syntax diagnostics.
- Relative local imports: 37 checked; no missing local imports found.
- Protected financial source comparison: 15 files across Overview, Budget, Daily Expenses, Savings Goals, Investments and Allocations remained byte-for-byte unchanged.
- Full frontend TypeScript/Vite build: not verified. Dependency installation timed out in the preparation environment and left an incomplete `node_modules` tree.
- Live Aiven migration and live API/browser journey: not run. Apply and verify the migration on your Aiven database before using the new calendar features.
