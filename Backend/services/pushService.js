import webpush from "web-push";
import { pool } from "../models/MonthlyBudget.js";
import { getFriendPortalShiftPacingStatus } from "./friendPortalPacingService.js";
import {
  ensureDailyLetterTable,
  ensurePacingNotificationLogTable,
  getDailyPacingStatus,
  ensureDailyTargetInitialized,
  lockMidnightPacingTarget,
  markDailyNotificationSent,
  getKigaliTime,
} from "./dailyLetterService.js";

let configured = false;
let pushSchemaReadyPromise = null;
let friendPortalPacingLogReadyPromise = null;

const getConfig = () => ({
  subject: process.env.VAPID_SUBJECT,
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  appUrl: process.env.PUSH_APP_URL || "https://mentorg.github.io/fintrack/#/",
});

const configureWebPush = () => {
  if (configured) return true;

  const { subject, publicKey, privateKey } = getConfig();
  if (!subject || !publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
};

export const ensurePushSubscriptionTable = async () => {
  if (!pushSchemaReadyPromise) {
    pushSchemaReadyPromise = pool
      .query(
        `
        CREATE TABLE IF NOT EXISTS PushSubscriptions (
          id INT NOT NULL AUTO_INCREMENT,
          endpoint TEXT NOT NULL,
          endpoint_hash CHAR(64) NOT NULL,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          user_agent VARCHAR(500) DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY unique_endpoint_hash (endpoint_hash)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `,
      )
      .catch((error) => {
        pushSchemaReadyPromise = null;
        throw error;
      });
  }
  await pushSchemaReadyPromise;
};

export const ensureFriendPortalPacingNotificationLogTable = async () => {
  if (!friendPortalPacingLogReadyPromise) {
    friendPortalPacingLogReadyPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS FriendPortalPacingNotificationLog (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tracking_date DATE NOT NULL,
        trigger_key VARCHAR(24) NOT NULL,
        sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_friend_portal_pacing_trigger (tracking_date, trigger_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch((error) => {
      friendPortalPacingLogReadyPromise = null;
      throw error;
    });
  }
  await friendPortalPacingLogReadyPromise;
};

const hashEndpoint = async (endpoint) => {
  const crypto = await import("node:crypto");
  return crypto.createHash("sha256").update(endpoint).digest("hex");
};

export const getVapidPublicKey = () => {
  const { publicKey } = getConfig();
  if (!publicKey) {
    throw new Error("VAPID_PUBLIC_KEY is not configured on the backend.");
  }
  return publicKey;
};

export const savePushSubscription = async (subscription, userAgent = "") => {
  if (
    !subscription?.endpoint ||
    !subscription?.keys?.p256dh ||
    !subscription?.keys?.auth
  ) {
    throw new Error("Invalid push subscription payload.");
  }

  await ensurePushSubscriptionTable();
  const endpointHash = await hashEndpoint(subscription.endpoint);

  await pool.query(
    `INSERT INTO PushSubscriptions
      (endpoint, endpoint_hash, p256dh, auth, user_agent)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       endpoint = VALUES(endpoint),
       p256dh = VALUES(p256dh),
       auth = VALUES(auth),
       user_agent = VALUES(user_agent),
       updated_at = CURRENT_TIMESTAMP`,
    [
      subscription.endpoint,
      endpointHash,
      subscription.keys.p256dh,
      subscription.keys.auth,
      String(userAgent || "").slice(0, 500),
    ],
  );

  return { endpointHash };
};

export const removePushSubscription = async (endpoint) => {
  if (!endpoint) return;
  await ensurePushSubscriptionTable();
  const endpointHash = await hashEndpoint(endpoint);
  await pool.query("DELETE FROM PushSubscriptions WHERE endpoint_hash = ?", [
    endpointHash,
  ]);
};

const getSubscriptions = async () => {
  await ensurePushSubscriptionTable();
  const [rows] = await pool.query(
    `SELECT id, endpoint, p256dh, auth
     FROM PushSubscriptions`,
  );
  return rows;
};

const sendToSubscriptions = async ({ title, body, tag, ttl = 300 }) => {
  if (!configureWebPush()) {
    console.warn("Web Push skipped: VAPID secrets are not configured.");
    return { configured: false, attempted: 0, sent: 0 };
  }

  const rows = await getSubscriptions();
  if (!rows.length) {
    return { configured: true, attempted: 0, sent: 0 };
  }

  const { appUrl } = getConfig();
  const payload = JSON.stringify({
    type: tag,
    title,
    body,
    url: appUrl,
  });

  let sent = 0;

  for (const row of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth,
          },
        },
        payload,
        {
          TTL: ttl,
          urgency: "high",
        },
      );
      sent += 1;
    } catch (error) {
      const statusCode = Number(error?.statusCode || error?.status || 0);
      if (statusCode === 404 || statusCode === 410) {
        await pool.query("DELETE FROM PushSubscriptions WHERE id = ?", [
          row.id,
        ]);
      } else {
        console.error("Web Push delivery error:", error?.message || error);
      }
    }
  }

  return { configured: true, attempted: rows.length, sent };
};

/** Sends a motivation push after the user's leaderboard position improves. */
export const sendLeaderboardOvertakeNotification = async ({
  previousRank,
  newRank,
  positionsGained,
  lettersToOvertake = 0,
  nextCompetitorName,
  nextCompetitorRank,
} = {}) => {
  const previous = Number(previousRank);
  const current = Number(newRank);
  const gained = Math.max(1, Number(positionsGained) || (previous - current));
  if (!Number.isFinite(previous) || !Number.isFinite(current) || current >= previous) {
    return { configured: true, attempted: 0, sent: 0, skipped: true, reason: "rank-did-not-improve" };
  }

  const ordinal = (rank) => {
    const n = Number(rank);
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
    return `${n}${n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"}`;
  };

  let title;
  let body;
  if (current === 1) {
    title = "🏆 You're #1 on the leaderboard!";
    body = `Amazing work! You overtook ${gained} competitor${gained === 1 ? "" : "s"} and reached first place. Keep your lead!`;
  } else {
    title = `🎉 You're now in ${ordinal(current)} place!`;
    const nextName = nextCompetitorName || `the ${ordinal(Math.max(1, current - 1))} place competitor`;
    const count = Math.max(1, Math.ceil(Number(lettersToOvertake) || 1));
    body = `You've overtaken ${gained} competitor${gained === 1 ? "" : "s"}! Log ${count} more letter${count === 1 ? "" : "s"} to overtake ${nextName}${nextCompetitorRank ? ` in ${ordinal(nextCompetitorRank)} place` : ""}. Keep climbing!`;
  }

  const result = await sendToSubscriptions({
    title,
    body,
    tag: `leaderboard-rank-${current}-${Date.now()}`,
    ttl: 300,
  });
  return { ...result, kind: "leaderboard-overtake", previousRank: previous, newRank: current, positionsGained: gained };
};

// Authenticated diagnostic test used by POST /api/cron/test-push.
// It sends a generic test notification to saved subscriptions only; it does
// not update daily-letter progress or consume a scheduled pacing-log slot.
export const sendDiagnosticPushNotification = async () => {
  const result = await sendToSubscriptions({
    title: "WealthTracker Notification Test",
    body: "Your push notification connection is working.",
    tag: `diagnostic-push-${Date.now()}`,
    ttl: 60,
  });

  return {
    ...result,
    kind: "diagnostic-test",
    sentAt: new Date().toISOString(),
  };
};

const validateSubscription = (subscription) => {
  if (
    !subscription?.endpoint ||
    !subscription?.keys?.p256dh ||
    !subscription?.keys?.auth
  ) {
    throw new Error("Invalid push subscription payload.");
  }
};

export const sendTestNotificationToSubscription = async ({
  subscription,
  kind = "target",
} = {}) => {
  validateSubscription(subscription);

  if (!configureWebPush()) {
    throw new Error(
      "Web Push is not configured on the backend. Set VAPID_SUBJECT, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.",
    );
  }

  const testKind = String(kind).toLowerCase();
  if (testKind === "friend-portal") {
    const friendStatus = await getFriendPortalShiftPacingStatus();
    const title = friendStatus.targetReached
      ? "🎉 Friend Portal Shift Target Complete!"
      : `🎯 Friend Portal: ${friendStatus.currentRequiredPerDay} Letters/Day Needed`;
    const body = friendStatus.targetReached
      ? `Your shift total is ${friendStatus.shiftLetters}/${friendStatus.target} letters. You reached the target! Estimated payable letters: ${friendStatus.payableLettersAtTarget} (RWF ${friendStatus.estimatedEarningsAtTarget.toLocaleString("en-US")}).`
      : `Shift progress: ${friendStatus.shiftLetters}/${friendStatus.target}. ${friendStatus.remainingShiftLetters} letters remain across ${friendStatus.remainingDaysInShift} days. Today: ${friendStatus.todayLetters} logged; ${friendStatus.todayRemaining} more needed today. At target: ${friendStatus.payableLettersAtTarget} payable letters (about RWF ${friendStatus.estimatedEarningsAtTarget.toLocaleString("en-US")}).`;
    const tag = `test-friend-portal-pacing-${friendStatus.date}`;
    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          type: tag,
          title,
          body,
          url: getConfig().appUrl,
          test: true,
        }),
        { TTL: 60, urgency: "high" },
      );
    } catch (error) {
      const statusCode = Number(error?.statusCode || error?.status || 0);
      if (statusCode === 404 || statusCode === 410) {
        await removePushSubscription(subscription.endpoint);
      }
      throw new Error(
        `Push delivery failed${statusCode ? ` (HTTP ${statusCode})` : ""}: ${error?.message || "unknown error"}`,
      );
    }
    return {
      ok: true,
      test: true,
      kind: testKind,
      title,
      body,
      friendPortalStatus: friendStatus,
    };
  }

  const status = await getDailyPacingStatus();
  let title;
  let body;
  let tag;

  if (testKind === "morning") {
    const required = Number(
      status.dailyTarget || status.currentRequiredPerDay || 0,
    );
    title = `🚨 Shift Pacing Alert: ${required} Letters/Day Required`;
    body = `You have ${status.remainingShiftLetters} letters left across ${status.remainingDaysInShift} days. Complete ${Math.max(0, required - status.dailyLetterCount)} letters today to stay on track for your Gold bonus!`;
    tag = "test-shift-pacing-8";
  } else if (testKind === "midday") {
    const required = Number(status.currentRequiredPerDay || 0);
    title = `🚨 Shift Pacing Alert: ${required} Letters/Day Required`;
    body = `You have ${status.remainingShiftLetters} letters left across ${status.remainingDaysInShift} days. Complete ${Math.max(0, Number(status.dailyTarget || 0) - Number(status.dailyLetterCount || 0))} letters today to stay on track for your Gold bonus!`;
    tag = "test-shift-pacing-12";
  } else if (testKind === "evening") {
    const required = Number(status.currentRequiredPerDay || 0);
    title = `🚨 Shift Pacing Alert: ${required} Letters/Day Required`;
    body = `You have ${status.remainingShiftLetters} letters left across ${status.remainingDaysInShift} days. Complete ${Math.max(0, Number(status.dailyTarget || 0) - Number(status.dailyLetterCount || 0))} letters today to stay on track for your Gold bonus!`;
    tag = "test-shift-pacing-18";
  } else if (testKind === "target") {
    const target = Number(
      status.dailyTarget || status.currentRequiredPerDay || 0,
    );
    title = "Daily Target Complete 🎉";
    body = `You have reached ${target} letters for today. Daily target complete!`;
    tag = "test-daily-target-complete";
  } else {
    throw new Error(
      "Invalid test notification kind. Use morning, midday, evening, or target.",
    );
  }

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        type: tag,
        title,
        body,
        url: getConfig().appUrl,
        test: true,
      }),
      { TTL: 60, urgency: "high" },
    );
  } catch (error) {
    const statusCode = Number(error?.statusCode || error?.status || 0);
    if (statusCode === 404 || statusCode === 410) {
      await removePushSubscription(subscription.endpoint);
    }
    throw new Error(
      `Push delivery failed${statusCode ? ` (HTTP ${statusCode})` : ""}: ${error?.message || "unknown error"}`,
    );
  }

  return {
    ok: true,
    test: true,
    kind: testKind,
    title,
    body,
    dailyStatus: status,
  };
};

export const sendDailyTargetReachedNotification = async ({
  dailyTarget,
  letterCount,
  date,
} = {}) => {
  await ensureDailyLetterTable();

  const status = await getDailyPacingStatus();
  const trackingDate = date || status.date;
  const target = Number(dailyTarget ?? status.dailyTarget);
  const count = Number(letterCount ?? status.dailyLetterCount);

  if (!target || count < target) {
    return { configured: true, attempted: 0, sent: 0, skipped: "not-reached" };
  }

  const subscriptions = await getSubscriptions();
  if (!subscriptions.length) {
    return {
      configured: true,
      attempted: 0,
      sent: 0,
      skipped: "no-subscriptions",
    };
  }

  // Claim the one-per-day completion notification slot atomically.
  const [claim] = await pool.query(
    `UPDATE DailyLetterProgress
     SET notification_sent = 1
     WHERE tracking_date = ? AND target_reached = 1 AND notification_sent = 0`,
    [trackingDate],
  );

  if (!claim.affectedRows) {
    return { configured: true, attempted: 0, sent: 0, skipped: "already-sent" };
  }

  const result = await sendToSubscriptions({
    title: "Daily Target Complete 🎉",
    body: `You have reached ${target} letters for today. Daily target complete!`,
    tag: `daily-target-complete-${trackingDate}`,
    ttl: 60 * 60,
  });

  if (result.sent === 0) {
    // No device accepted the message; allow a later retry after the user
    // reopens/subscribes again.
    await pool.query(
      `UPDATE DailyLetterProgress
       SET notification_sent = 0
       WHERE tracking_date = ?`,
      [trackingDate],
    );
  }

  return result;
};

export const maybeNotifyCurrentDailyTarget = async () => {
  const status = await getDailyPacingStatus();
  if (!status.targetReached || status.notificationSent) {
    return { sent: false, status };
  }

  const result = await sendDailyTargetReachedNotification({
    dailyTarget: status.dailyTarget,
    letterCount: status.dailyLetterCount,
    date: status.date,
  });

  return { sent: result.sent > 0, status };
};

export const sendShiftPacingAlertNotification = async ({
  triggerHour,
  date,
  force = false,
} = {}) => {
  await ensureDailyLetterTable();
  await ensurePacingNotificationLogTable();
  await ensureDailyTargetInitialized();

  const pacing = await getDailyPacingStatus();
  const trackingDate = date || pacing.date;
  const hour = Number(triggerHour);

  if (![8, 12, 18].includes(hour)) {
    throw new Error(
      "Pacing notification trigger must be 8, 12, or 18 Kigali time.",
    );
  }

  if (!force && pacing.targetReached) {
    return {
      configured: true,
      attempted: 0,
      sent: 0,
      skipped: "daily-target-reached",
      pacing,
    };
  }

  if (pacing.remainingShiftLetters <= 0) {
    return {
      configured: true,
      attempted: 0,
      sent: 0,
      skipped: "shift-complete",
      pacing,
    };
  }

  const rows = await getSubscriptions();
  if (!rows.length) {
    return {
      configured: true,
      attempted: 0,
      sent: 0,
      skipped: "no-subscriptions",
      pacing,
    };
  }

  // Prevent duplicate notifications if the scheduler retries the same slot.
  const [claim] = await pool.query(
    `INSERT IGNORE INTO ShiftPacingNotificationLog
      (tracking_date, trigger_hour)
     VALUES (?, ?)`,
    [trackingDate, hour],
  );

  if (!claim.affectedRows) {
    return {
      configured: true,
      attempted: 0,
      sent: 0,
      skipped: "already-sent",
      pacing,
    };
  }

  const dailyRemaining = Math.max(
    0,
    Number(pacing.dailyTarget) - Number(pacing.dailyLetterCount),
  );

  const title = `🚨 Shift Pacing Alert: ${pacing.currentRequiredPerDay} Letters/Day Required`;
  const body = `You have ${pacing.remainingShiftLetters} letters left across ${pacing.remainingDaysInShift} days. Complete ${dailyRemaining} letters today to stay on track for your Gold bonus!`;

  const result = await sendToSubscriptions({
    title,
    body,
    tag: `shift-pacing-${trackingDate}-${hour}`,
    ttl: 5 * 60,
  });

  if (result.sent === 0) {
    // No device accepted the alert; remove the log entry so a scheduler retry
    // can make another attempt rather than permanently consuming the time slot.
    await pool.query(
      `DELETE FROM ShiftPacingNotificationLog
       WHERE tracking_date = ? AND trigger_hour = ?`,
      [trackingDate, hour],
    );
  }

  return { ...result, pacing, title, body };
};

/** Send a Friend Portal pacing alert to the same subscribed devices as the
 * personal Shift Pacing Notifications. The service worker can suppress this
 * category independently using the device's Friend Portal notification toggle.
 */
export const sendFriendPortalShiftPacingAlertNotification = async ({
  triggerHour,
  date,
} = {}) => {
  await ensureFriendPortalPacingNotificationLogTable();
  const hour = Number(triggerHour);
  if (![8, 12, 18].includes(hour)) {
    throw new Error("Friend Portal pacing trigger must be 8, 12, or 18 Kigali time.");
  }

  const pacing = await getFriendPortalShiftPacingStatus();
  const trackingDate = date || pacing.date;
  if (pacing.shiftClosed) {
    return { configured: true, attempted: 0, sent: 0, skipped: "shift-closed", pacing };
  }

  if (pacing.targetReached) {
    const completion = await sendFriendPortalShiftTargetReachedNotification({ status: pacing });
    return { ...completion, skipped: completion.sent > 0 ? undefined : "target-reached", pacing };
  }

  const rows = await getSubscriptions();
  if (!rows.length) {
    return { configured: true, attempted: 0, sent: 0, skipped: "no-subscriptions", pacing };
  }

  const triggerKey = String(hour).padStart(2, "0");
  const [claim] = await pool.query(
    `INSERT IGNORE INTO FriendPortalPacingNotificationLog (tracking_date, trigger_key)
     VALUES (?, ?)`,
    [trackingDate, triggerKey],
  );
  if (!claim.affectedRows) {
    return { configured: true, attempted: 0, sent: 0, skipped: "already-sent", pacing };
  }

  const title = `🎯 Friend Portal: ${pacing.currentRequiredPerDay} Letters/Day Needed`;
  const todayMessage = pacing.todayRemaining > 0
    ? `Log ${pacing.todayRemaining} more today.`
    : `Today's pace is already met (${pacing.todayLetters} logged).`;
  const body = `Shift progress ${pacing.shiftLetters}/${pacing.target}. ${pacing.remainingShiftLetters} letters left across ${pacing.remainingDaysInShift} days. ${todayMessage} At target: ${pacing.payableLettersAtTarget} payable letters, about RWF ${pacing.estimatedEarningsAtTarget.toLocaleString("en-US")}.`;

  const result = await sendToSubscriptions({
    title,
    body,
    tag: `friend-portal-pacing-${trackingDate}-${hour}`,
    ttl: 5 * 60,
  });

  if (result.sent === 0) {
    await pool.query(
      `DELETE FROM FriendPortalPacingNotificationLog WHERE tracking_date = ? AND trigger_key = ?`,
      [trackingDate, triggerKey],
    );
  }

  return { ...result, pacing, title, body };
};

/** Send one target-complete push when the friend's shift reaches 450 letters. */
export const sendFriendPortalShiftTargetReachedNotification = async ({ status } = {}) => {
  await ensureFriendPortalPacingNotificationLogTable();
  const pacing = status || await getFriendPortalShiftPacingStatus();
  if (!pacing.targetReached || pacing.shiftClosed) {
    return { configured: true, attempted: 0, sent: 0, skipped: "not-reached-or-closed", pacing };
  }

  const rows = await getSubscriptions();
  if (!rows.length) {
    return { configured: true, attempted: 0, sent: 0, skipped: "no-subscriptions", pacing };
  }

  const [claim] = await pool.query(
    `INSERT IGNORE INTO FriendPortalPacingNotificationLog (tracking_date, trigger_key)
     VALUES (?, 'target-complete')`,
    [pacing.date],
  );
  if (!claim.affectedRows) {
    return { configured: true, attempted: 0, sent: 0, skipped: "already-sent", pacing };
  }

  const title = "🎉 Friend Portal Shift Target Complete!";
  const body = `You reached ${pacing.shiftLetters}/${pacing.target} letters this shift. That's ${pacing.payableLettersAtTarget} payable letters and an estimated RWF ${pacing.estimatedEarningsAtTarget.toLocaleString("en-US")}. Great work!`;
  const result = await sendToSubscriptions({
    title,
    body,
    tag: `friend-portal-pacing-target-complete-${pacing.date}`,
    ttl: 60 * 60,
  });
  if (result.sent === 0) {
    await pool.query(
      `DELETE FROM FriendPortalPacingNotificationLog WHERE tracking_date = ? AND trigger_key = 'target-complete'`,
      [pacing.date],
    );
  }
  return { ...result, pacing, title, body };
};

// Called by the existing Render/cron-job.org scheduler. Friend Portal pacing
// uses the same 08:00/12:00/18:00 calls and the same iPhone Web Push subscription.
// The 00:00 personal target snapshot remains unchanged.
export const runScheduledPacingNotification = async () => {
  const kigali = getKigaliTime();

  if (![0, 8, 12, 18].includes(kigali.hour)) {
    return {
      skipped: true,
      reason: "not-a-scheduled-kigali-hour",
      kigali,
    };
  }

  await ensureDailyLetterTable();

  if (kigali.hour === 0) {
    const status = await lockMidnightPacingTarget();
    return {
      scheduledHour: 0,
      action: "midnight-target-snapshot",
      status,
    };
  }

  // Safety-initialize only when the midnight job was missed. If a snapshot
  // exists, this preserves it and never recalculates it at 08:00.
  const status = await ensureDailyTargetInitialized();

  // The friend-portal alert must still be considered even if the personal
  // portal's own daily target has already been reached. A Friend Portal push
  // failure must not suppress the existing personal pacing notifications.
  let friendPortalPacing;
  try {
    friendPortalPacing = await sendFriendPortalShiftPacingAlertNotification({
      triggerHour: kigali.hour,
      date: status.date,
    });
  } catch (error) {
    console.error("Friend Portal pacing notification failed:", error?.message || error);
    friendPortalPacing = { configured: false, attempted: 0, sent: 0, error: "friend-portal-push-failed" };
  }

  if (kigali.hour === 8 && status.targetReached) {
    const completion = await sendDailyTargetReachedNotification({
      dailyTarget: status.dailyTarget,
      letterCount: status.dailyLetterCount,
      date: status.date,
    });
    return { scheduledHour: 8, status, completion, friendPortalPacing };
  }

  if (status.targetReached) {
    return {
      scheduledHour: kigali.hour,
      status,
      skipped: "personal-daily-target-reached",
      friendPortalPacing,
    };
  }

  const pacing = await sendShiftPacingAlertNotification({
    triggerHour: kigali.hour,
    date: status.date,
  });

  return { scheduledHour: kigali.hour, status, pacing, friendPortalPacing };
};
