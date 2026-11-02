# FinTrack Productivity — Phase 2: Tasks, Projects and My Day

## What this release adds

This release builds on the Productivity Foundation (Phase 1). It introduces persistent task and project management in the existing FinTrack single-workspace application.

Included:

- Task create, read, update, complete, cancel and delete operations.
- Task priority, status, due date/time, planned date/time, estimate, importance and urgency fields.
- Project create, edit and archive operations.
- Project task/completion counts and progress display.
- Task checklists/subtasks with add, complete, edit and delete API/UI support.
- My Day view combining overdue tasks, tasks due or planned for the selected Kigali date, and tasks completed that day.
- Summary counts for open tasks, overdue tasks, due/planned today, active projects and completed tasks.
- Sidebar routes for Productivity Home, My Day, Tasks and Projects.
- Server-side validation and parameterized SQL queries.
- Additive database migration creating only new productivity tables.

No task or project examples are seeded. Empty database tables produce empty task/project views.

## Important architecture boundary

The audited FinTrack application does not currently implement sign-in/session middleware or user-owned records. Productivity records are therefore stored in the current single shared workspace, consistent with the existing app model. Do not expose this installation as a multi-user application until authentication and ownership checks are implemented across productivity and existing finance endpoints.

The implementation does not change financial balances, bills, expenses, savings goals, investments, allocations, or wallet records. It does not connect task completion to financial transactions.

## Database migrations (Aiven MySQL)

The uploaded source is not connected to Aiven and does not contain database credentials. Run these commands from your own Linux terminal where you can enter your Aiven password.

Connection details:

- Host: `mysql-22ba951b-arnokarenzi1.a.aivencloud.com`
- Port: `18926`
- User: `avnadmin`
- Database: `defaultdb`

### 1. Back up the database first

```bash
mkdir -p ~/fintrack-backups

mysqldump \
  -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com \
  -P 18926 \
  -u avnadmin \
  -p \
  --single-transaction \
  defaultdb \
  > ~/fintrack-backups/fintrack-before-productivity.sql

ls -lh ~/fintrack-backups/fintrack-before-productivity.sql
```

Enter the Aiven password when prompted. Confirm that the backup file exists and is not empty before continuing.

### 2. Apply Phase 1 foundation migration

From the FinTrack project root:

```bash
cd ~/fintrack

mysql \
  -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com \
  -P 18926 \
  -u avnadmin \
  -p \
  defaultdb \
  < Backend/migrations/20261102_productivity_foundation.sql
```

Verify Phase 1:

```bash
mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb
```

At the `mysql>` prompt:

```sql
SHOW TABLES LIKE 'ProductivitySettings';
SELECT * FROM ProductivitySettings WHERE id = 1;
exit;
```

### 3. Apply Phase 2 tasks/projects migration

Run this from your normal terminal (not the interactive `mysql>` prompt):

```bash
cd ~/fintrack

mysql \
  -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com \
  -P 18926 \
  -u avnadmin \
  -p \
  defaultdb \
  < Backend/migrations/20261103_productivity_tasks_projects.sql
```

Verify Phase 2:

```bash
mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb
```

At the `mysql>` prompt:

```sql
SHOW TABLES LIKE 'Productivity%';
SELECT COUNT(*) AS project_count FROM ProductivityProjects;
SELECT COUNT(*) AS task_count FROM ProductivityTasks;
SELECT COUNT(*) AS subtask_count FROM ProductivityTaskSubtasks;
exit;
```

Expected initial counts are zero. Existing ProductivitySettings should contain its one defaults row. If a migration reports an error or a table already exists with a different shape, stop and inspect the table before attempting any repair.

Aiven's documented MySQL command-line pattern uses the host/port/user/database values with `-p` prompting for the password. Aiven encrypts traffic with TLS; for explicit certificate verification, download the project CA certificate from Aiven and configure the MySQL client according to the SSL mode supported by your installed client.

## Install the source files

1. Back up the current `~/fintrack` project folder or commit the working tree.
2. Extract this ZIP into `~/fintrack`, preserving the folder structure and allowing replacement only for the listed files.
3. Apply both migrations above in order if Phase 1 has not already been applied.
4. Restart the backend:

```bash
cd ~/fintrack/Backend
npm run dev
```

5. In a second terminal, restart the frontend:

```bash
cd ~/fintrack/Frontend
npm run dev
```

6. Open FinTrack and use **Personal Productivity → Productivity Home**, **My Day**, **Tasks**, and **Projects**.

Do not run `db:fresh-install`, a project initialization/reset command, `TRUNCATE`, or any reset endpoint to install this feature.

## API endpoints

All endpoints are mounted under `/api/productivity`.

### Foundation

- `GET /settings`
- `PATCH /settings`

### Dashboard and My Day

- `GET /summary`
- `GET /my-day?date=YYYY-MM-DD` (date is interpreted as a Kigali calendar date)

### Projects

- `GET /projects?includeArchived=true|false`
- `POST /projects`
- `PUT /projects/:id`
- `DELETE /projects/:id` (archives the project; its tasks remain in the database)

### Tasks

- `GET /tasks` (optional filters: `search`, `status`, `priority`, `projectId`, `date`, `includeCompleted`)
- `GET /tasks/:id` (includes subtasks)
- `POST /tasks`
- `PUT /tasks/:id`
- `DELETE /tasks/:id` (permanently deletes the task and its subtasks)
- `POST /tasks/:id/subtasks`
- `PUT /subtasks/:id`
- `DELETE /subtasks/:id`

## Validation performed

- `node --check` passed for all backend JavaScript files in the package workspace.
- `npm test` passed: 31 tests, 0 failures (the existing backend suite plus new productivity validation tests).
- TypeScript/TSX syntax parsing passed for all changed TS/TSX files: 0 syntax diagnostics.
- The exact source hashes of these six protected modules were unchanged: Overview, Budget, Daily Expenses, Savings Goals, Investments and Allocations.

A full frontend TypeScript/Vite build could not be completed because the frontend dependency installation did not finish in the preparation environment. Run `npm ci` and `npm run build` locally to complete this check. A live Aiven migration/API test was not run because no Aiven password or database session was available in the preparation environment.

## Known limitations

- Productivity records currently belong to the whole existing workspace; there is no per-user ownership until authentication is implemented.
- Recurring tasks, task tags, reminders delivery, calendar views, habits, focus sessions, goals, notes, countdowns, reviews and productivity insights are future phases.
- My Day is based on task due/planned dates and task completion timestamps. It does not yet include calendar events or habits.
