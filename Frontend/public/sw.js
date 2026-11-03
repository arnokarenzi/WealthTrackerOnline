/* FinTrack service worker: supports both legacy and declarative Web Push. */

const SETTINGS_DB_NAME = "fintrack-settings";
const SETTINGS_DB_VERSION = 1;
const SETTINGS_STORE = "preferences";
const NOTIFICATION_PREFERENCES_KEY = "notificationCategories";

function notificationCategoryForTag(tag, explicitCategory) {
  if (typeof explicitCategory === "string" && explicitCategory) return explicitCategory;
  if (tag.startsWith("shift-pacing-") || tag.startsWith("test-shift-pacing-")) return "shiftPacing";
  if (tag.startsWith("friend-portal-pacing-") || tag.startsWith("test-friend-portal-pacing-")) return "friendPortalPacing";
  if (tag.startsWith("daily-target-complete") || tag.startsWith("test-daily-target-complete")) return "dailyTarget";
  if (tag.startsWith("leaderboard-rank-")) return "leaderboard";
  if (tag.startsWith("app-financialActivity-")) return "financialActivity";
  if (tag.startsWith("app-incomeReminders-")) return "incomeReminders";
  if (tag.startsWith("app-billReminders-")) return "billReminders";
  if (tag.startsWith("app-debtReminders-")) return "debtReminders";
  if (tag.startsWith("app-taskReminders-")) return "taskReminders";
  if (tag.startsWith("app-calendarReminders-")) return "calendarReminders";
  if (tag.startsWith("app-habitReminders-")) return "habitReminders";
  if (tag.startsWith("app-goalReminders-")) return "goalReminders";
  if (tag.startsWith("app-countdownReminders-")) return "countdownReminders";
  if (tag.startsWith("app-focusTimer-")) return "focusTimer";
  if (tag.startsWith("app-budgetAlerts-")) return "budgetAlerts";
  if (tag.startsWith("app-reviewReminders-")) return "reviewReminders";
  return null;
}

function readNotificationPreferences() {
  return new Promise((resolve) => {
    let request;
    try {
      request = indexedDB.open(SETTINGS_DB_NAME, SETTINGS_DB_VERSION);
    } catch (_error) {
      resolve(null);
      return;
    }
    request.onerror = () => resolve(null);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.close();
        resolve(null);
        return;
      }
      let transaction;
      try {
        transaction = db.transaction(SETTINGS_STORE, "readonly");
        const getRequest = transaction.objectStore(SETTINGS_STORE).get(NOTIFICATION_PREFERENCES_KEY);
        getRequest.onsuccess = () => {
          const value = getRequest.result;
          db.close();
          resolve(value && typeof value === "object" ? value : null);
        };
        getRequest.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch (_error) {
        db.close();
        resolve(null);
      }
    };
  });
}

async function shouldShowPushForTag(tag, explicitCategory) {
  const category = notificationCategoryForTag(tag, explicitCategory);
  if (!category) return true;
  const preferences = await readNotificationPreferences();
  // Do not suppress notifications merely because IndexedDB is unavailable or
  // this device has not saved preferences yet.
  return !preferences || preferences[category] !== false;
}


self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data = {};

      try {
        if (event.data) {
          const parsed = event.data.json();
          if (parsed && typeof parsed === "object") data = parsed;
        }
      } catch (_error) {
        data = {
          title: "FinTrack",
          body: event.data?.text?.() || "You have a new FinTrack notification.",
        };
      }

      const declared =
        data.notification && typeof data.notification === "object"
          ? data.notification
          : {};

      const title = data.title || declared.title || "FinTrack";
      const body =
        data.body || declared.body || "You have a new FinTrack notification.";
      const targetUrl =
        data.url || declared.navigate || data.navigate || self.registration.scope;
      const tag = data.type || declared.tag || data.tag || "fintrack-notification";
      const category = data.category || declared.category || null;

      if (!(await shouldShowPushForTag(String(tag), category))) return;

      const options = {
        body,
        tag,
        renotify: Boolean(data.renotify ?? declared.renotify ?? data.data?.renotify ?? false),
        data: {
          ...(declared.data && typeof declared.data === "object"
            ? declared.data
            : {}),
          ...(data.data && typeof data.data === "object" ? data.data : {}),
          url: targetUrl,
        },
      };

      const icon = data.icon || declared.icon;
      const badge = data.badge || declared.badge;
      const image = data.image || declared.image;
      if (icon) options.icon = icon;
      if (badge) options.badge = badge;
      if (image) options.image = image;

      try {
        await self.registration.showNotification(title, options);
      } catch (error) {
        // Retry with basic options if an optional field was rejected on a device.
        console.error("FinTrack showNotification failed; retrying basic notification:", error);
        await self.registration.showNotification(title || "FinTrack", { body });
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      let targetUrl;
      try {
        targetUrl = new URL(
          event.notification.data?.url || self.registration.scope,
          self.registration.scope,
        ).href;
      } catch (_error) {
        targetUrl = self.registration.scope;
      }

      const targetOrigin = new URL(targetUrl).origin;
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clients) {
        try {
          if (new URL(client.url).origin === targetOrigin) {
            if ("navigate" in client) await client.navigate(targetUrl);
            return await client.focus();
          }
        } catch (_error) {
          // Try the next open client, then open a new one below.
        }
      }

      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })(),
  );
});
