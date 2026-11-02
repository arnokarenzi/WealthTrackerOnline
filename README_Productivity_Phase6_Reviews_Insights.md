# FinTrack Productivity — Phase 6

## Scope

Phase 6 completes the planned review and analytics layer for the productivity workspace:

- Daily reviews with optional mood and energy ratings, wins, challenges, lessons, gratitude, tomorrow's priorities and additional notes.
- Weekly reviews with optional overall rating, wins, challenges, lessons, next-week priorities and notes.
- Review history lists for the most recent daily and weekly entries.
- Productivity Insights calculated from the saved task, habit-log, focus-session, project and goal tables.
- Navigation, navigation search and Productivity Home shortcuts for the new pages.

New routes:

- `/#/productivity/reviews`
- `/#/productivity/insights`

## Data model

New migration: `Backend/migrations/20261107_productivity_reviews_insights.sql`

It creates only:

- `ProductivityDailyReviews` — one editable review per calendar date.
- `ProductivityWeeklyReviews` — one editable review per selected week-start date, with a calculated six-day offset for the week end.

Insights are not stored as a second set of numbers. They are calculated from existing productivity records when requested.

The daily/weekly review save endpoints use an upsert. Saving the same date/week edits that review record; it does not create a revision history. The history panel shows previous date/week records, not every edit made to a record.

## Productivity Insights definitions

The endpoint is `GET /api/productivity/insights?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`.
The requested inclusive range must be 1 to 92 calendar days. If omitted, the API uses the last 30 days ending today in Africa/Kigali.

- **Due tasks:** non-cancelled tasks whose `due_date` is inside the selected range. Tasks without a due date are excluded.
- **Due-task completion rate:** completed tasks divided by due tasks in that range. It is `null` when there are no due tasks.
- **Tasks completed in period:** tasks marked completed whose `completed_at` falls within the selected Kigali date range.
- **Currently overdue due tasks:** still-open tasks whose due date falls inside the selected range and is before today's Kigali date.
- **Logged habit entry completion rate:** completed habit logs divided by all saved habit logs in the range. Unlogged scheduled days are not treated as misses and are not in the denominator.
- **Focus minutes:** actual seconds from completed focus sessions whose start time falls in the selected period, rounded to minutes.
- **Average active goal progress:** current snapshot of active-goal progress using each goal's saved milestone/manual progress mode. It is not historical progress.
- **Projects:** active and completed status counts from current project records.
- **Review counts:** saved daily reviews in the date range and saved weekly reviews whose week overlaps that range.

Trend series are returned per calendar date and the UI displays the last 14 dates in the selected range. The focus bar is scaled relative to the busiest focus day shown.

## API endpoints added

- `GET /api/productivity/reviews/daily?date=YYYY-MM-DD`
- `PUT /api/productivity/reviews/daily`
- `GET /api/productivity/reviews/daily/history?limit=30`
- `GET /api/productivity/reviews/weekly?weekStart=YYYY-MM-DD`
- `PUT /api/productivity/reviews/weekly`
- `GET /api/productivity/reviews/weekly/history?limit=20`
- `GET /api/productivity/insights?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

All review inputs are validated server-side. Ratings are optional integers from 1 to 5. Text fields have explicit maximum lengths. Unknown request fields and invalid dates are rejected.

## Installation

This is an overlay for the existing `~/fintrack` project. It is not a standalone app.

1. Back up the current project and Aiven database.
2. Extract this ZIP into `~/fintrack`, preserving its folder structure. Replace only the files included in the package. Do not remove files that are not in the ZIP.
3. Confirm that the previous productivity migrations have been applied:
   - `20261102_productivity_foundation.sql`
   - `20261103_productivity_tasks_projects.sql`
   - `20261104_productivity_calendar_events.sql`
   - `20261105_productivity_habits_focus.sql`
   - `20261106_productivity_goals_notes_countdowns.sql`
4. Apply only the Phase 6 migration if the previous phases are already installed:

   ```bash
   cd ~/fintrack
   mysql \
     -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com \
     -P 18926 \
     -u avnadmin \
     -p \
     defaultdb \
     < Backend/migrations/20261107_productivity_reviews_insights.sql
   ```

   Enter the Aiven password at the prompt. Do not put the password in the command or a file included in the ZIP.
5. Verify the new tables in the `defaultdb` schema:

   ```sql
   SHOW TABLES LIKE 'ProductivityDailyReviews';
   SHOW TABLES LIKE 'ProductivityWeeklyReviews';
   SELECT COUNT(*) FROM ProductivityDailyReviews;
   SELECT COUNT(*) FROM ProductivityWeeklyReviews;
   ```
6. Run the backend checks and start the backend:

   ```bash
   cd ~/fintrack/Backend
   npm test
   npm run dev
   ```
7. In a second terminal, install frontend dependencies if needed, build and start:

   ```bash
   cd ~/fintrack/Frontend
   npm ci
   npm run build
   npm run dev
   ```

Do not run `db:fresh-install`, database initialization, `TRUNCATE`, or reset commands. The migration is additive and does not alter financial tables.

## Testing and limitations

In the preparation environment:

- Backend syntax checks passed for productivity controllers, services, utilities, tests and routes.
- `npm test`: 63 tests passed, 0 failed.
- TypeScript/TSX syntax parser passed for 7 changed frontend files.
- Relative imports for the changed frontend files resolved.
- The six protected financial feature areas (Overview, Budget, Daily Expenses, Savings Goals, Investments and Allocations) were compared with the uploaded source; all 15 files checked were byte-for-byte unchanged.

Not verified in the preparation environment:

- Full Vite/TypeScript production build: frontend dependency installation timed out, so this is not reported as passed.
- Live Aiven migration, API integration and browser workflows: these must be run from the user's environment.

## Important architecture note

The inspected FinTrack source does not currently provide login/session middleware or a user ownership model. Productivity records continue to follow the existing single-workspace/shared-data design. They are not isolated between multiple users. Do not expose the application as a multi-user service until authentication and owner scoping are implemented for existing financial APIs and productivity APIs.
