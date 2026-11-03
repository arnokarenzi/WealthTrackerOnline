# Friend Portal iPhone Shift-Pacing Notifications

## Purpose

Adds Friend Portal pacing alerts to FinTrack's **existing Web Push pipeline** used by the current personal Shift Pacing Notifications. It does not create a second push subscription, a new notification provider, a new cron endpoint, or any financial transaction.

The Friend Portal target is **450 total letters per FinTrack 15-day shift** (days 1–15, and day 16 through month-end). The first 150 letters remain excluded from payable letters under the existing Friend Portal rule. At 450 total letters, the existing rate yields 300 payable letters and estimated earnings of RWF 73,500.

The target is independent of the user's personal portal target of 750 letters.

## What the notification contains

At the same scheduled Kigali-time checks used by personal Shift Pacing Notifications (08:00, 12:00 and 18:00), the Friend Portal alert includes:

- Current Friend Portal shift total and target (for example, `210/450`).
- Letters remaining to reach 450.
- Calendar days remaining in the current shift.
- Required average letters per day from today to the end of the shift.
- Today's logged letters and the additional amount needed today to stay on pace.
- At-target payable letters and indicative earnings (300 letters / RWF 73,500 at the current configured values).

If the shift reaches 450 when a daily entry is saved, a separate target-complete push is sent immediately, subject to device notification permissions and delivery availability.

The new alert is skipped after the shift has been finalized/reset into receivables. This avoids continuing to remind about a locked shift.

## Files in this overlay

### Backend

- `Backend/services/pushService.js` — uses the existing VAPID configuration, saved `PushSubscriptions`, and scheduled pacing execution to send Friend Portal alerts. Existing personal alerts remain in the same scheduler.
- `Backend/services/friendPortalPacingService.js` — reads the live Friend Portal total for the current Kigali shift and checks whether the shift is closed.
- `Backend/utils/friendPortalPacingMath.js` — computes the 450-letter pacing target and progress.
- `Backend/controllers/friendPortalLettersController.js` — sends target-complete push after a saved daily entry reaches target. Push failures do not undo a successful letter save.
- `Backend/controllers/financeFeaturesController.js` — adds the independent Friend Portal notification preference to the existing settings normalization.
- `Backend/migrations/20261108_friend_portal_pacing_notifications.sql` — creates the unique-send log table. The service also creates this table automatically as a fallback.
- `Backend/tests/friendPortalPacing.test.js` — pure pacing and date-window unit tests.

### Frontend

- `Frontend/public/sw.js` — maps Friend Portal push tags to their independent notification category.
- `Frontend/src/features/settings/index.tsx` — adds an enable/disable preference for Friend Portal pacing notifications.
- `Frontend/src/utils/settingsPreferences.ts` — defaults and normalizes the new category; persists it in the existing service-worker IndexedDB preference store.
- `Frontend/src/types/api.ts` — adds the preference to the settings response type.
- `Frontend/src/components/DailyLetterNotificationSettings.tsx` — adds a device-specific “Test Friend Portal Alert” button.
- `Frontend/src/services/api.ts` — allows the new test-notification kind.

No new npm dependency or environment secret is required.

## Installation

1. Back up the current project and Aiven database.
2. Extract this ZIP into the existing `~/fintrack` project, preserving folders. Replace only the files included in the archive. Do not remove unrelated files.
3. Confirm that the existing Friend Portal tables are present:

   ```sql
   SHOW TABLES LIKE 'FriendPortalDailyLetters';
   SHOW TABLES LIKE 'FriendPortalShiftPayouts';
   ```

4. Apply the additive notification-log migration to Aiven from `~/fintrack`:

   ```bash
   mysql \
     -h mysql-22ba951b-arnokarenzi1.a.aivencloud.com \
     -P 18926 \
     -u avnadmin \
     -p \
     defaultdb \
     < Backend/migrations/20261108_friend_portal_pacing_notifications.sql
   ```

   Enter the password at the prompt; do not place it in the command. The migration only creates `FriendPortalPacingNotificationLog`.

5. (Optional) Set this environment variable on the backend host if you want to explicitly declare the target:

   ```env
   FRIEND_PORTAL_SHIFT_TARGET_LETTERS=450
   ```

   The default is already 450, so this variable is not required. Existing `FRIEND_PORTAL_FREE_LETTERS_PER_SHIFT=150`, `FRIEND_PORTAL_RATE_PER_LETTER=245`, VAPID values, and `CRON_SECRET` remain unchanged.

6. Deploy/restart the backend (Render or the backend host already serving the app).
7. Deploy the frontend to its existing host (Vercel/Pages). This deployment must include the updated `Frontend/public/sw.js` as well as the TypeScript files.
8. Keep the **existing** external scheduler calling `POST /api/cron/shift-pacing` at the configured 00:00, 08:00, 12:00 and 18:00 Kigali-time schedule. The 00:00 snapshot remains personal-only; the existing 08:00, 12:00 and 18:00 calls now also send Friend Portal pacing messages. Do not add a second cron schedule for Friend Portal.

The scheduler endpoint continues to require the existing `X-Cron-Secret` header. Do not expose the secret in frontend code.

## iPhone setup and testing

Because the user's personal Shift Pacing push already arrives on their iPhone, the existing iPhone push subscription should be reused; do not unsubscribe or create a second subscription.

1. Deploy the backend and frontend changes.
2. On the iPhone, open the installed FinTrack Home Screen web app and leave/reopen it once so Safari can activate the updated service worker.
3. In FinTrack **Settings → Notification categories**, enable **Friend Portal shift pacing reminders**, then save preferences. This is separate from the existing personal **Shift pacing reminders** switch.
4. In the existing **Shift Pacing Notifications** settings card, use **Test Friend Portal Alert**. The test goes only to the device that presses the button and displays the current Friend Portal totals read from the database.
5. Confirm the notification appears on iPhone. Check iOS Settings → Notifications → FinTrack (or the installed app's chosen Home Screen name) to ensure alerts are allowed.

For iPhone Web Push, the site must be installed as a Home Screen web app and notification permission must have been granted from a direct user action. iOS/iPadOS 16.4 or later supports Web Push for Home Screen web apps. See Apple's official documentation and WebKit's explanation:

- https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- https://webkit.org/blog/13878/

## Scheduling note

This feature deliberately reuses the existing cron endpoint and scheduler. If the scheduler is Vercel Cron on the Hobby plan, it cannot reliably run the existing three-times-daily schedule: current Vercel documentation limits Hobby cron to once per day and ±59-minute timing. Keep using the existing external scheduler (for example, the already configured cron-job.org/Render mechanism) for 08:00, 12:00 and 18:00 Kigali-time requests.

See https://vercel.com/docs/cron-jobs/usage-and-pricing

## Tests and limitations

- `node --check` passed for the changed backend JS files.
- `node --test Backend/tests/friendPortalPacing.test.js`: 7 passed, 0 failed.
- The source bundle used for this overlay has no `node_modules`, so a full backend suite with external dependencies and frontend TypeScript/Vite production build were not run here. Run `cd Backend && npm test` and `cd Frontend && npm ci && npm run build` on the project machine.
- Live Aiven migration, Render scheduler invocation, push provider acceptance, and actual iPhone display have not been executed from this environment.
- A push send accepted by the browser push service does not guarantee display: iOS notification permission, Focus settings, app state and connectivity still apply.

## Important accounting behavior

This feature only reads Friend Portal daily letters and writes a deduplication log. It does not change `FriendPortalDailyLetters`, `FriendPortalShiftPayouts`, `WalletIncome`, `MonthlyBudget`, personal letter counts or salary. Reaching 450 is a progress notification, not an automatic payout or wallet deposit.
