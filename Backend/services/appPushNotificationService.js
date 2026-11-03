import crypto from "node:crypto";
import { pool } from "../models/MonthlyBudget.js";
import { sendPushToAllSubscriptions } from "./pushService.js";

export const APP_PUSH_CATEGORIES = Object.freeze([
  "financialActivity",
  "incomeReminders",
  "billReminders",
  "debtReminders",
  "taskReminders",
  "calendarReminders",
  "habitReminders",
  "goalReminders",
  "countdownReminders",
  "focusTimer",
  "budgetAlerts",
  "reviewReminders",
]);

let schemaPromise = null;

export const ensureAppPushNotificationLogTable = async () => {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS PushNotificationDeliveryLog (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        event_key_hash CHAR(64) NOT NULL,
        category VARCHAR(40) NOT NULL,
        event_key VARCHAR(240) NOT NULL,
        title VARCHAR(180) NOT NULL,
        status ENUM('sending', 'accepted', 'no_subscriptions', 'failed') NOT NULL DEFAULT 'sending',
        attempted_count INT UNSIGNED NOT NULL DEFAULT 0,
        accepted_count INT UNSIGNED NOT NULL DEFAULT 0,
        last_error VARCHAR(500) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP NULL DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_push_notification_event (event_key_hash),
        KEY idx_push_notification_category_date (category, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
};

const safeText = (value, max) => String(value ?? "").trim().slice(0, max);

/**
 * Sends a category-aware Web Push notification using the existing VAPID keys
 * and PushSubscriptions table. eventKey provides idempotency across cron
 * retries and duplicate API requests. `sent` means accepted by the push
 * provider, not confirmed display on the physical device.
 */
export const sendCategoryPushNotification = async ({
  category,
  eventKey,
  title,
  body,
  route = "/",
  ttl = 300,
  renotify = false,
} = {}) => {
  if (!APP_PUSH_CATEGORIES.includes(category)) {
    throw new Error(`Unsupported FinTrack notification category: ${category}`);
  }
  const normalizedEventKey = safeText(eventKey, 240);
  const normalizedTitle = safeText(title, 180);
  const normalizedBody = safeText(body, 1200);
  const normalizedRoute = safeText(route, 180);
  if (!normalizedEventKey || !normalizedTitle || !normalizedBody) {
    throw new Error("eventKey, title and body are required for a push notification.");
  }
  await ensureAppPushNotificationLogTable();
  const eventHash = crypto.createHash("sha256").update(`${category}:${normalizedEventKey}`).digest("hex");
  const [claim] = await pool.query(
    `INSERT IGNORE INTO PushNotificationDeliveryLog
      (event_key_hash, category, event_key, title, status)
     VALUES (?, ?, ?, ?, 'sending')`,
    [eventHash, category, normalizedEventKey, normalizedTitle],
  );
  if (!claim.affectedRows) {
    return { configured: true, attempted: 0, sent: 0, skipped: "duplicate-event" };
  }

  try {
    const result = await sendPushToAllSubscriptions({
      title: normalizedTitle,
      body: normalizedBody,
      tag: `app-${category}-${eventHash.slice(0, 24)}`,
      ttl: Math.max(60, Math.min(86400, Number(ttl) || 300)),
      route: normalizedRoute,
      category,
      data: { route: normalizedRoute, renotify: Boolean(renotify) },
    });

    if (Number(result.sent || 0) > 0) {
      await pool.query(
        `UPDATE PushNotificationDeliveryLog
            SET status='accepted', attempted_count=?, accepted_count=?, sent_at=CURRENT_TIMESTAMP,
                last_error=NULL
          WHERE event_key_hash=?`,
        [Number(result.attempted || 0), Number(result.sent || 0), eventHash],
      );
    } else {
      // No configured provider or no subscriptions: keep no permanent claim,
      // allowing the next scheduled retry after subscription/config recovery.
      await pool.query("DELETE FROM PushNotificationDeliveryLog WHERE event_key_hash=?", [eventHash]);
    }
    return { ...result, category, eventKey: normalizedEventKey };
  } catch (error) {
    await pool.query("DELETE FROM PushNotificationDeliveryLog WHERE event_key_hash=?", [eventHash]);
    throw error;
  }
};
