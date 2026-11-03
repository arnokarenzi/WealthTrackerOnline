# Friend Portal iPhone Pacing — Implementation Audit

## Requirement

Reuse FinTrack's existing personal Shift Pacing Web Push pipeline to send an independent 450-letter Friend Portal pacing notification to the user's already subscribed iPhone. Keep the personal 750-letter target separate. Show shift total, remaining letters, remaining days, dynamic daily pace and estimated payable amount at target.

## Findings from the supplied FinTrack source

- The backend already uses `web-push` with VAPID credentials and stores browser/iPhone subscriptions in `PushSubscriptions`.
- Existing daily scheduler is `POST /api/cron/shift-pacing`, authenticated with `X-Cron-Secret`.
- `runScheduledPacingNotification()` already executes the personal notification logic at Kigali 08:00, 12:00 and 18:00, with a separate midnight target snapshot.
- `Frontend/public/sw.js` already filters push categories using preferences in IndexedDB.
- The existing settings UI persists notification categories and syncs them to the service worker.
- Friend Portal records use `FriendPortalDailyLetters`; finalized shifts are represented in `FriendPortalShiftPayouts`.

## Changes made

1. Added `friendPortalPacingMath.js` for 450 target pacing on the current first-half or second-half calendar shift.
2. Added `friendPortalPacingService.js` to read current shift and daily totals from the actual Friend Portal records and check for finalized shifts.
3. Extended `pushService.js` to issue Friend Portal 08:00, 12:00 and 18:00 pushes through the same subscriptions and scheduler as the personal alerts. The friend alert is isolated with its own deduplication table/category and an error boundary so a Friend Portal failure does not suppress the personal alert.
4. Added an immediate shift-target-complete push when saving a Friend Portal daily total reaches 450. Push failure does not roll back the saved letter entry.
5. Added independent `friendPortalPacing` preference defaulting to true in frontend settings and backend normalization.
6. Added Service Worker category filtering for `friend-portal-pacing-*` and `test-friend-portal-pacing-*` tags.
7. Added a device-specific test button to the existing Shift Pacing Notifications panel.
8. Added an additive migration for `FriendPortalPacingNotificationLog`.

## Mathematical rule

- Shift target: 450 total Friend Portal letters.
- Shift windows: 1st–15th and 16th–last day of each month.
- Planning pace from the start of a 15-day shift: 450 / 15 = 30 letters/day.
- Dynamic required pace: ceiling of remaining shift letters / remaining calendar days, counting today.
- Existing allowance remains 150 letters per shift; at exactly 450 letters, payable letters = 300 and estimated amount = 300 × RWF 245 = RWF 73,500.

## Protected scope

The six protected financial feature components are not modified by this overlay. No wallet balance, income, letter counts or payout records are written by the notification logic. `financeFeaturesController.js` receives only the new preference normalization property.

## Validation actually run

- `node --check` for:
  - `Backend/services/pushService.js`
  - `Backend/services/friendPortalPacingService.js`
  - `Backend/utils/friendPortalPacingMath.js`
  - `Backend/controllers/friendPortalLettersController.js`
  - `Backend/controllers/financeFeaturesController.js`
- `node --test Backend/tests/friendPortalPacing.test.js`: 7 passed, 0 failed.

Not run here:
- Full backend npm test suite (dependencies not installed in this preparation workspace).
- Frontend full TypeScript/Vite build.
- Live Aiven migration.
- Live cron endpoint invocation.
- Real push delivery to the user's iPhone.

## Known integration assumption

This patch is based on the latest supplied `fintrack(3).zip` source, which includes the current Friend Portal payout module and personal Shift Pacing Push subsystem. It assumes the user's deployed backend still runs the same `/api/cron/shift-pacing` endpoint and the external scheduler already triggers the existing personal alerts. The current settings and push-subscription design is shared-workspace, consistent with the existing application; it does not implement multi-user subscription ownership.
