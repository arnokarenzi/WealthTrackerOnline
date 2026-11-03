# FinTrack — Unified Real-Time iPhone Notifications

## Scope

This update extends the existing FinTrack Web Push system. It reuses the current `PushSubscriptions` table, VAPID keys, service worker, and iPhone Home Screen web-app subscription. It does not create a second push provider or require a new iPhone subscription.

### Included notifications

**Existing pacing notifications**
- Personal portal shift pacing and daily target completion.
- Friend Portal 450-letter shift pacing and target completion.
- Leaderboard position improvements.

**Immediate event-triggered notifications**
- Expenses recorded or removed.
- Extra income recorded.
- Bill payment and debt repayment activity (existing financial feature push flows, now category-filtered server-side).
- Savings-goal contributions and target completion.
- Emergency-fund transfers.
- Investment/reserve activity.
- School-fee progress activity.
- Personal and Friend Portal payout deposits.
- Productivity task completion, goal/milestone completion, and saved focus sessions.

Push sends are best-effort and occur after the associated database write/transaction succeeds. Push failure is logged but does not undo or misreport a successful financial action. A push-provider acceptance is not proof that iOS displayed the notification.

**Scheduled notifications**
- Timed task/calendar reminders: approximately 15 minutes before, using a five-minute scheduler and a small late-delivery window.
- Morning My Day/habit digest, bills/debt reminders, countdowns and milestone reminders.
- Expected personal portal salary reminders around the 13th/14th and 28th/29th; these refer to pay for the previous work shift.
- Friend Portal transfer reminders around the following day (14th/15th and 29th/30th). These ask the user to verify actual receipt; they do not record income or deposit money.
- Daily and weekly review reminders.
- Budget threshold checks.

The active focus timer runs in the browser. A focus notification is emitted only after the session is saved. If the user closes the browser before the session is saved, no completion push can be guaranteed.

## Notification categories

The existing Settings page contains independent category toggles for:
- Personal portal shift pacing
- Friend Portal shift pacing
- Personal daily target completion
- Leaderboard
- Financial activity
- Expected income reminders
- Bills
- Debt
- Tasks
- Calendar
- Habits
- Goals
- Countdowns
- Focus timer
- Budget alerts
- Daily/weekly reviews

Category preferences are checked on the backend before dispatch and mirrored to IndexedDB for service-worker filtering while the app is closed. Legacy notification tags are mapped to the correct category so old push paths also respect saved preferences.

## Files included

The overlay includes the push services, cron route/controller, event trigger integrations, settings preference normalization, service worker, push test controls, Friend Portal pacing implementation, two earlier Vercel TypeScript fixes, and notification tests. It deliberately does not include protected financial page components for Overview, Budget, Daily Expenses, Savings Goals, Investments, or Allocations.

Some financial backend controllers are included solely to send a push after their existing successful operation. Their financial calculations and transaction rules are not intentionally changed. Back up and review the overlay before replacing local files, especially if you have made edits since the source archive used for this package.

## Installation

1. Back up the current `~/fintrack` project and Aiven database.
2. Extract this ZIP into `~/fintrack`, preserving the folder structure. Replace only the files included in the ZIP. Do not delete files that are not in the ZIP.
3. The package assumes the existing FinTrack application, financial feature migration, Friend Portal daily/payout tables, and Productivity Phases 1–6 are already installed. Do not run `db:fresh-install` or any database reset.
4. Apply the Friend Portal pacing notification migration if it has not already been applied:

   ```bash
   cd ~/fintrack
   mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb < Backend/migrations/20261108_friend_portal_pacing_notifications.sql
   ```

5. Apply the unified delivery/idempotency migration:

   ```bash
   cd ~/fintrack
   mysql -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com -P 18926 -u avnadmin -p defaultdb < Backend/migrations/20261109_unified_push_notifications.sql
   ```

   Enter the password at the prompt. Never put it in the command or commit it.

6. Verify tables:

   ```sql
   SHOW TABLES LIKE 'PushSubscriptions';
   SHOW TABLES LIKE 'FriendPortalPacingNotificationLog';
   SHOW TABLES LIKE 'PushNotificationDeliveryLog';
   ```

   `PushSubscriptions` is created by the existing push service if missing; the two log tables are ensured by their migrations/services. Existing subscriptions remain intact.

## Render backend configuration

Keep the existing values for:
- `VAPID_SUBJECT`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `CRON_SECRET`

Do not rotate these keys just for this update.

**Set or correct `PUSH_APP_URL` to your actual Vercel frontend origin with the hash-router base**, for example:

```dotenv
PUSH_APP_URL=https://YOUR-FINTRACK-PROJECT.vercel.app/#/
```

Replace the example with your real Vercel domain. Without this, notification clicks may still open the old GitHub Pages address configured as the legacy default.

The backend also needs its existing database TLS, database connection and frontend CORS settings to remain correct. Do not expose VAPID private keys or `CRON_SECRET` in the frontend or repository.

## External scheduler configuration

Keep your existing scheduler job that calls:

`POST https://YOUR-RENDER-BACKEND.onrender.com/api/cron/shift-pacing`

at its existing times (midnight, 08:00, 12:00 and 18:00 Kigali time). This job serves the original personal and Friend Portal pacing alerts. Do not remove or replace it.

Add a second external scheduler job:

- Method: `POST`
- URL: `https://YOUR-RENDER-BACKEND.onrender.com/api/cron/notifications`
- Frequency: every 5 minutes
- Header: `X-Cron-Secret: YOUR_EXISTING_CRON_SECRET`
- Optional header: `Content-Type: application/json`
- Body: none required

Use the exact backend service URL and the same existing `CRON_SECRET`. This endpoint is protected; a request without the correct header returns HTTP 401. Vercel Hobby Cron is not a replacement for this five-minute schedule. The scheduler is needed for reminders; event-triggered pushes are sent directly by the backend after successful operations.

## iPhone activation

1. On the iPhone, open the deployed FinTrack site in Safari.
2. If not already installed, use Share → Add to Home Screen and open FinTrack from its Home Screen icon.
3. Allow notifications when prompted. If permission was previously denied, enable it in iOS Settings → Notifications → FinTrack (where shown by iOS).
4. After the new deployment, open the Home Screen FinTrack app once to let the updated service worker activate.
5. In FinTrack Settings, enable the notification categories you want and save. The current implementation defaults categories to on unless explicitly disabled.
6. Visit Shift Pacing Notifications and use **Test General FinTrack Push** and **Test Friend Portal Alert**. The test endpoint sends to the device subscription that pressed the button.
7. Check iOS Focus modes, Scheduled Summary, notification previews, and network connectivity if delivery is accepted by the push service but not displayed promptly.

## Deploy order

1. Install source overlay.
2. Apply migrations to Aiven.
3. Run `npm --prefix Backend test` and `npm run dev` locally.
4. In `Frontend`, run `npm ci` and `npm run build`.
5. Deploy backend to Render.
6. Set/verify `PUSH_APP_URL` and existing secret settings in Render, then redeploy.
7. Deploy frontend to Vercel.
8. Add the five-minute external scheduler job.
9. Test on the iPhone Home Screen app.

## Verification status in the preparation environment

- `node --check` over all Backend JavaScript files: passed.
- Backend automated tests: 81 passed, 0 failed.
- Relative Backend imports: 193 checked, 0 missing.
- TypeScript/TSX syntax parsing: 7 changed files, 0 syntax diagnostics.
- Protected frontend source comparison: 15 files checked, 0 changed.
- Full Vite/TypeScript production build: not run; `Frontend/node_modules` is absent in this environment.
- Live Aiven migration, Render deployment, external scheduler and physical iPhone delivery: not run and must be verified in the user's environment.

## Important limitations

- Push provider acceptance does not guarantee the iPhone immediately displays a notification. iOS settings, Focus, network conditions, and APNs delivery affect display timing.
- The application currently has no authentication/per-user ownership model. Existing subscriptions and records use the current shared workspace model. This change does not make the app multi-user safe.
- The app uses VAPID and existing Web Push subscriptions. It does not require a native iOS app.
- Expected salary and friend-transfer notifications are reminders only. They do not create wallet income or confirm actual payment.
