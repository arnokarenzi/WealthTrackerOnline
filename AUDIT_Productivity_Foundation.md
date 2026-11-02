# FinTrack Source Audit — Productivity Foundation

**Audit basis:** `fintrack(3).zip` supplied on 2 November 2026.

## 1. Current application architecture

| Layer | Observed implementation |
|---|---|
| Frontend | React 18, TypeScript, Vite 4, React Router 6, Material UI 5 |
| Navigation | `react-pro-sidebar`; main routes registered with `createHashRouter` in `Frontend/src/main.tsx` |
| API client | Axios services under `Frontend/src/services/`; API base selected from localhost, `VITE_API_BASE_URL`, or the existing Render fallback |
| Backend | Node.js ES modules, Express 5 |
| Database driver | `mysql2/promise` |
| Database pool | Exported by `Backend/models/MonthlyBudget.js`; reused by existing controllers/services |
| Time convention | Backend process timezone and database date rules use `Africa/Kigali` for business-date interpretation; pool stores instants in UTC |
| Migration pattern | SQL files under `Backend/migrations/`; additive `CREATE TABLE IF NOT EXISTS` pattern is present |

## 2. Relevant existing financial modules

The six protected source files requested in the project requirements are present:

- `Frontend/src/features/overview/index.tsx`
- `Frontend/src/features/budget/index.tsx`
- `Frontend/src/features/expenses.tsx`
- `Frontend/src/features/savings/SavingsGoals.tsx`
- `Frontend/src/features/investments/index.tsx`
- `Frontend/src/features/allocations/index.tsx`

Their SHA-256 values before and after this foundation implementation were identical:

| Protected file | SHA-256 |
|---|---|
| Overview | `b8af441b679f2df8a2d47b88fc70491da7d1eddcfd7fbec6e51348626bedbf42` |
| Budget | `b1b4e500a0c04cf86a2a4cc9eee23ac6f6ff463b3143ffc8206ed912dd4ba237` |
| Daily Expenses | `311bd5a37053bdcd70624eaf85726f2393ca315999971ed34b09555fd124d02d` |
| Savings Goals | `4934e21a88dcefd7a1627631c5bf49b8cf2aed7967aec75d101776db970627ae` |
| Investments | `968420ee6eb962d35bca7435762cfebc7a17135acf55367c069d04f2ca3ec96a` |
| Allocations | `3d189aa1fbb025cf265bd8820fcb98230bed391be077dd7e2a50b2cbed9e3c85` |

## 3. Authentication and tenancy finding

The source explicitly confirms that there is currently no login/session middleware, no authenticated user identity in requests, and no per-user profile or ownership model. Existing Settings UI also describes its saved display name/preferences as server-wide values. The existing financial schema migration contains the same single-tenant warning.

Consequences for the productivity design:

- The foundation preference table is a single-workspace singleton, consistent with the current application model.
- This release does not pretend to provide multi-user privacy or account isolation.
- Task, goal, note and other user records must not be treated as multi-user safe until authentication and owner scoping are introduced. This must be solved before the product is exposed to multiple unrelated users.

## 4. Current integration points

- `Backend/server.js` is the central Express route mount.
- `Backend/models/MonthlyBudget.js` exports the current shared database pool. The new productivity service reuses it.
- `Frontend/src/main.tsx` registers hash-router pages.
- `Frontend/src/layouts/Sidebar.tsx` defines the sidebar.
- `Frontend/src/data/navigationItems.ts` supplies the page-search navigation catalogue.
- `Frontend/src/services/api.ts` is the existing financial API service; a separate productivity API service was chosen to keep new functionality isolated.

## 5. First implementation stage delivered

- New Productivity Home page at `#/productivity`.
- New Personal Productivity sidebar section and discoverable navigation item.
- New `/api/productivity` backend route.
- New `GET /settings` and `PATCH /settings` endpoints.
- New `ProductivitySettings` table, with Kigali timezone and initial planner/focus defaults.
- Server-side validation with whitelisted fields and allowed ranges.
- Unit tests for defaults, accepted updates, rejected inputs and row mapping.

The planned task, project, calendar, habit, focus-session, goal, note, countdown, review and insights workflows are not yet implemented. They are deliberately not represented as working features in this foundation release.

## 6. Files changed

### Modified

- `Backend/server.js` — mounts the isolated productivity router.
- `Frontend/src/main.tsx` — registers Productivity Home.
- `Frontend/src/layouts/Sidebar.tsx` — adds the Personal Productivity section.
- `Frontend/src/data/navigationItems.ts` — makes Productivity Home discoverable through navigation search.

### Added

- `Backend/controllers/productivity/productivitySettingsController.js`
- `Backend/routes/productivity/productivityRoutes.js`
- `Backend/services/productivity/productivitySettingsService.js`
- `Backend/utils/productivitySettings.js`
- `Backend/migrations/20261102_productivity_foundation.sql`
- `Backend/tests/productivitySettings.test.js`
- `Frontend/src/features/productivity/home/index.tsx`
- `Frontend/src/services/productivityApi.ts`
- `README_Productivity_Phase1_Foundation.md`

No package dependencies or lockfiles were changed.

## 7. Verification completed

| Check | Result |
|---|---|
| `node --check` for all backend JavaScript files | Passed |
| Backend `npm test` | Passed — 25 tests, 0 failures |
| TypeScript/TSX syntax transpilation for all changed frontend TypeScript files | Passed — no syntax diagnostics |
| Protected financial module SHA-256 comparison | Passed — all six hashes unchanged |
| Live database migration | Not run — no `.env` or database dump was included in the supplied archive |
| Live API/database integration | Not run — no live database credentials or connection were supplied |
| Full frontend `tsc` / Vite build | Blocked — frontend `node_modules` are absent from the archive; TypeScript reports missing React, MUI, Axios and other dependency declarations |
| Browser/visual test | Not run — frontend dependencies are absent in the inspection workspace |

## 8. Database and deployment safety

The new SQL migration creates only `ProductivitySettings` and inserts its initial singleton row with `INSERT IGNORE`. It does not alter or reset any existing table. It uses `utf8mb4_unicode_ci` and InnoDB for compatibility with the MariaDB installations used by this project.

The migration has not been applied to any database. Back up the live database before applying it. Do not run a fresh-install, reset, truncate or database-recreation command for this feature.
