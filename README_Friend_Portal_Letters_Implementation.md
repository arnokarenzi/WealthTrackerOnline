# FinTrack — Friend Portal Letters module

## Business rule implemented

This module tracks letters from the friend's portal separately from the user's existing personal translation/shift tracker.

- Letter rate: **245 RWF per payable letter**.
- Friend's allowance: **first 150 letters per FinTrack shift**.
- Shift 1: days 1–15 of each calendar month.
- Shift 2: day 16 through the last day of each calendar month.
- The allowance carries across daily records within a shift and resets at the beginning of the next shift.
- The earliest dates in a shift consume the 150-letter allowance first. If an earlier date is added or corrected later, the server recalculates the shift's daily allocation chronologically.
- A record stores the complete total for one work date. Saving that date again **replaces** the previous total; it does not increment it.

Example: 350 letters in one shift = 350 − 150 = 200 payable letters; 200 × 245 = **49,000 RWF**.

## Important separation

The module has its own `FriendPortalDailyLetters` table and API. It does not modify `MonthlyBudget`, personal translated-letter totals, the existing 750-letter shift cap, `DailyLetterProgress`, personal salary, wallet balance, or pending earnings. It reports estimated earnings separately; it does not automatically deposit them into the FinTrack wallet.

## Files in this replacement bundle

### Backend — changed
- `Backend/server.js` — mounts `/api/friend-portal-letters`.

### Backend — new
- `Backend/controllers/friendPortalLettersController.js`
- `Backend/routes/friendPortalLettersRoutes.js`
- `Backend/services/friendPortalLettersService.js`
- `Backend/utils/friendPortalLettersMath.js`
- `Backend/migrations/20261101_friend_portal_daily_letters.sql`
- `Backend/tests/friendPortalLetters.test.js`

### Frontend — changed
- `Frontend/src/main.tsx` — registers the new route.
- `Frontend/src/layouts/Sidebar.tsx` — adds the sidebar link.
- `Frontend/src/services/api.ts` — adds API functions.
- `Frontend/src/types/api.ts` — adds response types.

### Frontend — new
- `Frontend/src/features/friendportalletters/index.tsx` — complete module page.

No new npm dependencies are required. Existing protected feature pages/components are not changed.

## Install

1. Make a backup/commit of your current `~/fintrack` work.
2. Extract this ZIP into the **project root** (`~/fintrack`) and allow the listed files to be replaced. The archive contains only the files listed above plus this README.
3. Start the backend:

   ```bash
   cd ~/fintrack/Backend
   npm install
   npm run dev
   ```

4. Start the frontend in a second terminal:

   ```bash
   cd ~/fintrack/Frontend
   npm install
   npm run dev
   ```

5. Open FinTrack and choose **Friend Portal Letters** in the sidebar.

The backend automatically creates `FriendPortalDailyLetters` on the first API request. To apply the migration manually instead, from the project root use your existing MySQL credentials and database name:

```bash
mysql -u YOUR_DB_USER -p YOUR_DB_NAME < Backend/migrations/20261101_friend_portal_daily_letters.sql
```

Do not put the actual password in the command line; enter it at the prompt.

## Optional configuration

The defaults work without additional environment variables. To override them, add these to `Backend/.env` and restart the backend:

```env
FRIEND_PORTAL_FREE_LETTERS_PER_SHIFT=150
FRIEND_PORTAL_RATE_PER_LETTER=245
```

## API

- `GET /api/friend-portal-letters?month=YYYY-MM` — records and month totals.
- `POST /api/friend-portal-letters` — save/replace the total for a work date (`workDate`, `lettersCount`, optional `notes`).
- `DELETE /api/friend-portal-letters/:id` — delete a daily record.

## Test

```bash
cd ~/fintrack/Backend
npm test
```

The new automated tests cover the 350 → 200 → 49,000 RWF example, allowance carry-over within a shift, reset on day 16, chronological allocation, and invalid inputs.

## Verification limitation

Backend syntax checks and backend unit tests were executed in the preparation environment. Frontend TS/TSX syntax parsing was executed, but a full TypeScript build was not completed because the frontend dependency installation did not finish in that environment. Run `npm install` and `npm run build` locally before deploying.
