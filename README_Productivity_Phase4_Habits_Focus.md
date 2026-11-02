# FinTrack Productivity — Phase 4: Habits and Focus Management

## What this release adds

This is an incremental productivity overlay for the existing FinTrack application. It builds on the Phase 1 foundation, Phase 2 Tasks/Projects/My Day, and Phase 3 Calendar/Eisenhower Matrix.

### Habits
- Create, edit and archive habits.
- Schedule a habit every day or on selected weekdays.
- Record completion by date. Saving the same habit/date again updates that record instead of creating a duplicate.
- Review the last seven days, current streak and 30-day completion rate.
- The 30-day rate uses scheduled days since the habit was created, up to the last 30 calendar days.
- Archived habits retain their logs; an archived habit cannot receive new logs until reactivated.

Weekday numbering in the API/database is Sunday=0 through Saturday=6. A habit streak counts consecutive scheduled days; non-scheduled days are skipped. An incomplete habit scheduled for today does not break the streak until the day passes.

### Focus Timer
- Focus, short-break and long-break modes.
- Duration defaults come from the saved Productivity Settings.
- A focus session can be linked to an existing open task.
- Completed sessions and explicitly stopped sessions are stored in MariaDB.
- Focus summary shows completed focus sessions and focused time for the Kigali calendar day.
- Session history includes the session type, linked task, planned duration, actual duration and completion/stopped status.

The timer runs in the browser while active. It writes a session to the backend when it finishes or when the user selects **Stop & save**. An active timer is not persisted as a running server-side session; closing or refreshing the page before saving loses that in-progress timer. Completed/stopped session records remain in the database.

## Important prerequisites

The Phase 4 migration references `ProductivityTasks`; therefore the Phase 1, Phase 2 and Phase 3 migrations must already be installed.

The current source audit found no user login/session middleware or ownership model in this FinTrack installation. Productivity records therefore follow the application's existing shared single-workspace model. Do not expose the app as a multi-user service until authentication and owner scoping are implemented.

## Back up Aiven before migration

Run from a normal Linux terminal, not from the `mysql>` prompt:

```bash
mkdir -p ~/fintrack-backups

mysqldump \
  -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com \
  -P 18926 \
  -u avnadmin \
  -p \
  --single-transaction \
  defaultdb \
  > ~/fintrack-backups/fintrack-before-productivity-phase4.sql

ls -lh ~/fintrack-backups/fintrack-before-productivity-phase4.sql
```

Enter the Aiven password when prompted. Confirm the backup file exists and is not empty before continuing.

## Install the source package

1. Keep a copy/commit of the current `~/fintrack` project.
2. Extract `FinTrack_Productivity_Phase4_Habits_Focus.zip` into the existing project root `~/fintrack`.
3. Preserve the included folder structure and allow replacement only of the included files.
4. This is an overlay, not a fresh application. It does not contain `.env`, database passwords, `node_modules`, or compiled `dist` files.

## Apply Aiven migrations

Apply only migrations that are not already installed.

If Phases 1, 2 and 3 have already been applied successfully, run only Phase 4:

```bash
cd ~/fintrack

mysql \
  -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com \
  -P 18926 \
  -u avnadmin \
  -p \
  defaultdb \
  < Backend/migrations/20261105_productivity_habits_focus.sql
```

If you have not yet installed the earlier productivity migrations, apply them in order, then Phase 4:

```bash
mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb < Backend/migrations/20261102_productivity_foundation.sql

mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb < Backend/migrations/20261103_productivity_tasks_projects.sql

mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb < Backend/migrations/20261104_productivity_calendar_events.sql

mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb < Backend/migrations/20261105_productivity_habits_focus.sql
```

Do not rerun a migration that was already applied unless you have checked the table state. These scripts use `CREATE TABLE IF NOT EXISTS`, but the earlier migrations also contain one-time initial settings inserts. Never run `db:fresh-install`, project initialization/reset commands, `TRUNCATE`, or a database drop for this feature.

Verify the new tables:

```bash
mysql \
  -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com \
  -P 18926 \
  -u avnadmin \
  -p \
  defaultdb
```

At the `mysql>` prompt:

```sql
SHOW TABLES LIKE 'ProductivityHabits';
SHOW TABLES LIKE 'ProductivityHabitLogs';
SHOW TABLES LIKE 'ProductivityFocusSessions';

SELECT COUNT(*) FROM ProductivityHabits;
SELECT COUNT(*) FROM ProductivityHabitLogs;
SELECT COUNT(*) FROM ProductivityFocusSessions;
```

The three tables should exist. They should initially contain zero records unless you have already tested the new module.

Exit with `exit;`.

## Run FinTrack

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

The package adds no npm dependencies. The build command is important because the preparation environment used for this package did not have the frontend dependency tree installed; a production build must still be verified locally.

## Pages

- Productivity Home: `/#/productivity`
- Habits: `/#/productivity/habits`
- Focus Timer: `/#/productivity/focus`

The two new pages are also linked from the Productivity section of the sidebar and from Productivity Home.

## API endpoints

### Habits
- `GET /api/productivity/habits`
- `GET /api/productivity/habits?includeArchived=true`
- `POST /api/productivity/habits`
- `PUT /api/productivity/habits/:id`
- `DELETE /api/productivity/habits/:id` — archives, does not hard-delete
- `GET /api/productivity/habits/:id/logs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `POST /api/productivity/habits/:id/logs`
- `DELETE /api/productivity/habits/:id/logs/:date`

Example create request:

```json
{
  "name": "Read for 20 minutes",
  "description": "Read a book before bed",
  "category": "Learning",
  "frequency": "selected_days",
  "daysOfWeek": [1, 2, 3, 4, 5],
  "color": "#1976d2"
}
```

Example completion log:

```json
{
  "logDate": "2026-11-02",
  "isCompleted": true,
  "notes": "Read one chapter"
}
```

The unique key `(habit_id, log_date)` makes repeated saves for the same habit/date an upsert, not a duplicate.

### Focus
- `GET /api/productivity/focus/summary?date=YYYY-MM-DD`
- `GET /api/productivity/focus/sessions?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&limit=50`
- `POST /api/productivity/focus/sessions`

Example completed focus session:

```json
{
  "sessionType": "focus",
  "status": "completed",
  "taskId": 12,
  "plannedMinutes": 25,
  "actualSeconds": 1500,
  "startedAt": "2026-11-02T08:00:00.000Z",
  "endedAt": "2026-11-02T08:25:00.000Z",
  "notes": "Quiet work session"
}
```

Break sessions cannot be linked to tasks. `actualSeconds` cannot exceed the planned duration. Completed sessions must record at least one second.

## Protection of financial modules

This phase adds only:
- `ProductivityHabits`
- `ProductivityHabitLogs`
- `ProductivityFocusSessions`

It does not change financial tables, wallet/budget calculations, expenses, savings, investments, or allocations. Existing financial feature source files are not included for replacement in this overlay.

## Verification performed in the preparation environment

- Backend `node --check`: passed for 75 JavaScript files.
- Backend `npm test`: 48 tests passed, 0 failed.
- TypeScript/TSX syntax parsing: all 7 changed frontend files passed.
- Full frontend `tsc`/Vite build: not verified because the uploaded source package does not include `Frontend/node_modules`; TypeScript reports missing React, MUI and Axios packages/types until `npm ci` is run.
- Live MariaDB/Aiven migration and live API test: not run in this environment. Apply the migration and verify it against your Aiven database before relying on the new pages.

## Known limitations / later improvements

- User authentication and per-user ownership are not available in the existing app; productivity data currently uses the shared workspace.
- An active timer is held in browser memory until completed/stopped; it is not resumed across a page reload.
- Reminder delivery, browser notifications, sounds, and scheduled habit notifications are not introduced in this phase.
- Habit history is recalculated against the habit's current schedule; past schedule changes are not versioned.
