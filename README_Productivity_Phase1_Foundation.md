# FinTrack Productivity — Foundation Release

## What this release adds

This is the first implementation release after the source audit. It establishes the integrated Productivity workspace without replacing or redesigning any existing financial feature.

Included:

- A new **Productivity Home** route at `#/productivity`.
- A **Personal Productivity** section in the existing sidebar.
- A dedicated productivity API module and `/api/productivity` backend route.
- Persisted workspace preferences for week start, default calendar view, Pomodoro durations, reminder preference, and focus sound preference.
- Server-side validation for all preference updates.
- Unit tests for defaults, validation, and database-row mapping.
- A MariaDB-compatible, additive SQL migration.

The Tasks, Projects, Calendar, Habits, Focus, Goals, Notes, Countdowns, Reviews, and Insights features are shown as planned areas on Productivity Home. They are not represented as completed functionality in this release; they will be implemented in subsequent stages.

## Audit findings relevant to architecture

- Frontend: React 18, TypeScript, Vite, React Router 6, Material UI 5.
- Backend: Node.js ES modules, Express 5, `mysql2/promise`.
- Existing database pool: `Backend/models/MonthlyBudget.js`; the productivity service reuses this pool and does not create another connection layer.
- Existing app timezone convention: `Africa/Kigali`; this is also the productivity workspace timezone default.
- The current application has no sign-in/session middleware or per-user ownership model. Existing finance settings are also described in the source as shared workspace settings. This release follows that existing single-workspace model. Do not expose it as a multi-user application until authentication and owner-scoped access are implemented throughout the application.
- The source archive did not contain `Backend/.env`, a database dump, or `node_modules`. No live database or production environment was accessed.

## Protected financial modules

The following six feature files were not modified by this release:

- `Frontend/src/features/overview/index.tsx`
- `Frontend/src/features/budget/index.tsx`
- `Frontend/src/features/expenses.tsx`
- `Frontend/src/features/savings/SavingsGoals.tsx`
- `Frontend/src/features/investments/index.tsx`
- `Frontend/src/features/allocations/index.tsx`

No existing financial table, balance, transaction, formula, or financial migration is changed by the new SQL migration.

## Installation

1. Back up the current database and project folder.
2. Copy the files from this ZIP into the matching paths under your existing `~/fintrack` project. Allow replacement only for the files included in this package.
3. Apply the additive migration to the same database configured in `Backend/.env`:

   ```bash
   cd ~/fintrack
   /opt/lampp/bin/mysql -u YOUR_DB_USER -p YOUR_DB_NAME < Backend/migrations/20261102_productivity_foundation.sql
   ```

   Replace `YOUR_DB_USER` and `YOUR_DB_NAME` with the values from your existing `Backend/.env`. Enter the password only at the MySQL prompt. Do not use `db:fresh-install`, `TRUNCATE`, or any reset command.

4. Start/restart the backend:

   ```bash
   cd ~/fintrack/Backend
   npm run dev
   ```

5. In another terminal, start/restart the frontend:

   ```bash
   cd ~/fintrack/Frontend
   npm run dev
   ```

6. Open the app and choose **Productivity Home** under **Personal Productivity**.

## API

- `GET /api/productivity/settings` — retrieves current productivity workspace preferences.
- `PATCH /api/productivity/settings` — validates and updates one or more editable preferences.

Editable fields:

- `weekStartsOn`: `monday` or `sunday`
- `defaultCalendarView`: `day`, `week`, or `month`
- `defaultFocusMinutes`: integer 5–180
- `shortBreakMinutes`: integer 1–60
- `longBreakMinutes`: integer 1–90
- `longBreakAfterSessions`: integer 2–8
- `remindersEnabled`: boolean
- `focusSoundEnabled`: boolean

The timezone is fixed to `Africa/Kigali` in this foundation and is not editable through the API.

## Verification

From `Backend/` run:

```bash
node --check server.js
node --check controllers/productivity/productivitySettingsController.js
node --check services/productivity/productivitySettingsService.js
node --check utils/productivitySettings.js
npm test
```

The frontend dependencies were not included in the supplied ZIP, so a full `npm run build` and browser test require running `npm install` or `npm ci` in `Frontend/` on the target machine.

## Important limitation

The preferences are stored once for the entire current FinTrack workspace, not per person. This matches the current app's lack of sign-in and ownership middleware. Multi-user accounts, isolated user data, cloud calendar synchronization, email reminders, and browser push reminders are outside this foundation release.
