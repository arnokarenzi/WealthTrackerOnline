# Friend Portal Letters — Pending Receivables and Wallet Deposit

This update adds a separate payout lifecycle to the Friend Portal Letters module. It does not reuse or modify the personal `PendingEarnings` records, personal shift counters, or personal shift reset controller.

## Business flow

1. Record daily friend-portal letter totals as before.
2. In the selected month, choose the 1st–15th shift or the 16th–month-end shift and click **Reset & move to receivables**.
3. The backend calculates that shift's full totals using the existing rule: the first 150 letters in the shift are excluded and every additional letter earns 245 RWF.
4. The backend creates exactly one `FriendPortalShiftPayouts` record for that shift. The daily records remain in the database and become locked against edits/deletions. Repeated reset attempts do not create duplicate receivables.
5. The amount appears in **Pending Friend Portal Payouts** on Overview. It is not added to the wallet at reset time.
6. After the friend has actually sent the money, click **Confirm Received & Deposit** in that card and confirm the prompt. The backend credits `MonthlyBudget.balance`, marks the payout collected, and records the receipt in `WalletIncome` in one database transaction. Repeated claims cannot credit it twice.

Shifts with no payable earnings are still finalized and locked, but do not create a zero-value receivable card.

## Files in the replacement package

### Backend

- `Backend/services/friendPortalLettersService.js` — complete replacement; shift finalization, receivables, locking, wallet deposit, and duplicate protection.
- `Backend/controllers/friendPortalLettersController.js` — complete replacement; reset, pending payout, and claim endpoints plus validation.
- `Backend/routes/friendPortalLettersRoutes.js` — complete replacement; adds reset and payout routes.
- `Backend/migrations/20261101_friend_portal_shift_payouts.sql` — creates the separate payout table.

### Frontend

- `Frontend/src/features/friendportalletters/index.tsx` — complete replacement; shift summaries and reset controls.
- `Frontend/src/components/PendingFriendPortalPayoutsWidget.tsx` — new Overview receivables card.
- `Frontend/src/features/overview/index.tsx` — complete replacement; adds the new card next to existing pending receivables.
- `Frontend/src/services/api.ts` — complete replacement; friend payout API methods.
- `Frontend/src/types/api.ts` — complete replacement; payout response types.
- `Frontend/src/features/expenses.tsx` — complete replacement; labels received friend-portal money as Friend Portal Payout in wallet income history.

`Backend/server.js` does not need changing because it already mounts `/api/friend-portal-letters`.

## Installation

1. Back up your current `~/fintrack` folder (or at minimum the files listed above).
2. Extract the replacement ZIP into `~/fintrack`, preserving the folder structure. Allow it to replace the listed files only.
3. The backend service creates `FriendPortalShiftPayouts` automatically on its first API request, using `CREATE TABLE IF NOT EXISTS`. You can also apply the included migration manually before starting the app:

   ```bash
   cd ~/fintrack
   mysql -u YOUR_DB_USER -p YOUR_DB_NAME < Backend/migrations/20261101_friend_portal_shift_payouts.sql
   ```

4. Test and restart the backend:

   ```bash
   cd ~/fintrack/Backend
   npm test
   npm run dev
   ```

5. In another terminal, restart the frontend:

   ```bash
   cd ~/fintrack/Frontend
   npm run dev
   ```

## API routes added

- `POST /api/friend-portal-letters/reset` — body: `{ "shiftStart": "YYYY-MM-01" }` or `{ "shiftStart": "YYYY-MM-16" }`.
- `GET /api/friend-portal-letters/payouts/pending` — lists uncollected friend-portal receivables.
- `POST /api/friend-portal-letters/payouts/claim/:id` — confirms actual receipt and deposits the amount into the wallet.

Existing routes for listing, creating/updating daily totals, and deleting daily records remain available. After a shift has been reset, attempts to edit/delete its daily records return HTTP 409.

## Persistence and accounting details

- New table: `FriendPortalShiftPayouts`.
- Personal `PendingEarnings` is untouched.
- Wallet deposits update `MonthlyBudget.balance` for row `id = 1` and write `WalletIncome` with `source_type = 'side_income'`. The description starts with `Friend Portal Payout:` so the Wallet Income History screen labels it distinctly. This reuses the existing enum value and does not require an enum alteration.
- The balance update, payout collected flag, and `WalletIncome` insert are committed together. If one write fails, the transaction rolls back.
- The current app's existing single-wallet structure (`MonthlyBudget.id = 1`) is reused.

## Verification

- Backend JavaScript syntax checks passed for the changed service, controller, and route.
- Existing backend suite: 21 tests passed.
- The existing friend-portal calculation tests continue to verify 350 letters in a shift = 150 excluded + 200 payable = 49,000 RWF.
- Frontend TypeScript build could not be completed in this environment because `Frontend/node_modules` is absent (React, MUI and Axios types/packages are not installed here). Run `npm ci` in `Frontend` on your machine, followed by `npm run build`, to complete the local production build check.
- Live database transaction and browser tests were not run in this environment. Verify reset, pending card display, and claim using a test amount before relying on the feature for actual payment.
