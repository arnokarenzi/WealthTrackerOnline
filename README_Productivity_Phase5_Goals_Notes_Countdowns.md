# FinTrack Productivity — Phase 5: Goals, Notes and Countdowns

## What this release adds

Phase 5 extends the Productivity workspace with three persisted modules and milestone management. It builds on Phases 1–4 and does not modify financial calculations, financial tables, or the six protected financial feature modules.

### Personal goals and milestones

- Create, edit and archive goals.
- Set an optional category, description, start date and target date.
- Track progress either by milestone completion or a manual percentage.
- Add, edit, complete and delete milestones.
- Goal progress is 100% for a goal marked completed; for milestone-driven goals it is the rounded proportion of completed milestones; a goal with no milestones is 0%; manual mode uses the saved percentage.
- Archiving a goal preserves its milestone history. A milestone can be added only to an active goal.
- Archived goals can be reactivated by editing their status.

### Notes / Quick Capture

- Create notes with an optional title, content, category and card colour.
- Pin and unpin notes.
- Search note titles, content and categories.
- Archive notes without deleting their content; archived notes can be restored.
- Notes require non-empty content; a title is optional.

### Countdowns

- Create, edit and archive upcoming or past events.
- Store event name, date, optional time, category, description and colour.
- Support one-time events and yearly recurrence (birthdays, anniversaries, annual dates).
- Days remaining are calculated using the `Africa/Kigali` business date.
- For annual events on 29 February, the occurrence is observed on 28 February in non-leap years.
- Archived countdowns can be restored.
- A past one-time event remains visible as an elapsed event; its days remaining is negative.

## Current application model and important limitation

The current FinTrack source has no login/session middleware or per-user ownership model. Productivity data therefore follows the application's existing shared single-workspace model. These records are not isolated between multiple users. Do not expose this installation as a multi-user service until authentication and owner scoping are implemented for both productivity and existing financial APIs.

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
  > ~/fintrack-backups/fintrack-before-productivity-phase5.sql

ls -lh ~/fintrack-backups/fintrack-before-productivity-phase5.sql
```

Enter the Aiven password when prompted. Confirm the backup file exists and is not empty before continuing.

## Install the source package

1. Keep a copy/commit of your current `~/fintrack` project.
2. Extract `FinTrack_Productivity_Phase5_Goals_Notes_Countdowns.zip` into the existing project root `~/fintrack`.
3. Preserve the included folder structure and replace only the files included in this overlay.
4. This is not a fresh application. It does not contain `.env`, database passwords, `node_modules`, compiled `dist` files, or the protected financial feature source folders.

## Apply Aiven migrations

**If Phases 1–4 have already been installed successfully**, apply only the Phase 5 migration:

```bash
cd ~/fintrack

mysql \
  -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com \
  -P 18926 \
  -u avnadmin \
  -p \
  defaultdb \
  < Backend/migrations/20261106_productivity_goals_notes_countdowns.sql
```

If you are unsure which phases were installed, first connect to Aiven and check for these tables:

```sql
SHOW TABLES LIKE 'ProductivitySettings';
SHOW TABLES LIKE 'ProductivityTasks';
SHOW TABLES LIKE 'ProductivityCalendarEvents';
SHOW TABLES LIKE 'ProductivityHabits';
SHOW TABLES LIKE 'ProductivityFocusSessions';
```

Do not rerun an earlier migration just because the current page is not visible. Verify which tables already exist before applying anything. If Phases 1–4 are not installed, apply only the missing migrations in chronological order from `20261102` through `20261105`, then apply `20261106`.

Never run `db:fresh-install`, project initialization/reset commands, `TRUNCATE`, or database drop commands to install this release.

## Verify Phase 5 tables

Connect:

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
SHOW TABLES LIKE 'ProductivityGoals';
SHOW TABLES LIKE 'ProductivityGoalMilestones';
SHOW TABLES LIKE 'ProductivityNotes';
SHOW TABLES LIKE 'ProductivityCountdowns';

SELECT COUNT(*) FROM ProductivityGoals;
SELECT COUNT(*) FROM ProductivityGoalMilestones;
SELECT COUNT(*) FROM ProductivityNotes;
SELECT COUNT(*) FROM ProductivityCountdowns;
```

The four tables should exist. They should initially contain zero records unless you already created test data. Exit with `exit;`.

## Run FinTrack

Backend terminal:

```bash
cd ~/fintrack/Backend
npm ci
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

No new npm dependencies are introduced by this release. Run the production build locally before deploying.

## Pages

- Productivity Home: `/#/productivity`
- Personal Goals: `/#/productivity/goals`
- Notes: `/#/productivity/notes`
- Countdowns: `/#/productivity/countdowns`

The new pages are also linked from the Productivity sidebar and Productivity Home.

## API endpoints

### Goals
- `GET /api/productivity/goals?includeArchived=true&search=...`
- `POST /api/productivity/goals`
- `GET /api/productivity/goals/:id` (includes milestones)
- `PUT /api/productivity/goals/:id`
- `DELETE /api/productivity/goals/:id` (archives)

### Goal milestones
- `GET /api/productivity/goals/:id/milestones`
- `POST /api/productivity/goals/:id/milestones`
- `PUT /api/productivity/milestones/:id`
- `DELETE /api/productivity/milestones/:id`

### Notes
- `GET /api/productivity/notes?includeArchived=true&search=...`
- `POST /api/productivity/notes`
- `PUT /api/productivity/notes/:id`
- `DELETE /api/productivity/notes/:id` (archives)

### Countdowns
- `GET /api/productivity/countdowns?includeArchived=true&search=...`
- `POST /api/productivity/countdowns`
- `PUT /api/productivity/countdowns/:id`
- `DELETE /api/productivity/countdowns/:id` (archives)

All request bodies are validated and parameterized SQL is used. The endpoints follow the current single-workspace app model; they do not add user authentication.

## Database changes

The migration creates only four new tables:
- `ProductivityGoals`
- `ProductivityGoalMilestones`
- `ProductivityNotes`
- `ProductivityCountdowns`

`ProductivityGoalMilestones.goal_id` has a foreign key to `ProductivityGoals.id` with cascade delete. The app archives goals instead of hard deleting them, so normal archive operations preserve their milestones. No existing financial or productivity table is altered.

## Verification performed in the preparation environment

- Backend JavaScript syntax: passed for all backend JavaScript files.
- Backend automated tests: 56 passed, 0 failed (includes the prior finance/friend portal/productivity suites and eight new Phase 5 validation/metrics tests).
- TypeScript/TSX syntax transpilation: passed for all changed frontend files.
- Relative frontend import resolution: passed for the changed frontend files.
- Protected feature comparison: Overview, Budget, Daily Expenses, Savings Goals, Investments and Allocations were byte-for-byte unchanged compared with the uploaded source package.
- Full frontend production build: not run; `Frontend/node_modules` is not included in the supplied source archive. Run `npm ci` and `npm run build` locally.
- Live MariaDB/Aiven migration, live API calls and browser interaction: not run in this environment. Apply and verify the migration on your Aiven database before relying on the new modules.

## Not included in Phase 5

- Email, push or scheduled countdown reminders.
- Note attachments or file uploads.
- Collaboration or multi-user sharing.
- Per-user data ownership/authentication.
- Recurring goals or recurring milestone schedules.
