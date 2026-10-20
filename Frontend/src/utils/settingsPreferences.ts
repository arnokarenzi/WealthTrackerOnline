export type AppDateFormat = "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";

export interface NotificationCategoryPreferences {
  /** Scheduled 08:00, 12:00, and 18:00 Kigali-time push alerts. */
  shiftPacing: boolean;
  /** Push notification sent when the daily letter target is reached. */
  dailyTarget: boolean;
  /** Push notifications when the leaderboard position improves. */
  leaderboard: boolean;
  /** Budget alerts shown in the in-app notification menu. */
  budgetAlerts: boolean;
}

export interface LocalSettingsPreferences {
  dateFormat: AppDateFormat;
  budgetWarningPercent: number;
  budgetCriticalPercent: number;
  notifications: NotificationCategoryPreferences;
}

export const SETTINGS_PREFERENCES_KEY = "fintrack.settings-preferences.v1";
export const SETTINGS_PREFERENCES_UPDATED_EVENT = "fintrack-settings-preferences-updated";
export const PUSH_PREFERENCES_DB = "fintrack-settings";
export const PUSH_PREFERENCES_STORE = "preferences";
export const PUSH_PREFERENCES_KEY = "notificationCategories";

export const DEFAULT_SETTINGS_PREFERENCES: LocalSettingsPreferences = {
  dateFormat: "dd/MM/yyyy",
  budgetWarningPercent: 80,
  budgetCriticalPercent: 100,
  notifications: {
    shiftPacing: true,
    dailyTarget: true,
    leaderboard: true,
    budgetAlerts: true,
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const boundedInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

export const normalizeLocalSettingsPreferences = (
  value: unknown,
): LocalSettingsPreferences => {
  const raw = isRecord(value) ? value : {};
  const rawNotifications = isRecord(raw.notifications) ? raw.notifications : {};
  const dateFormat: AppDateFormat =
    raw.dateFormat === "MM/dd/yyyy" || raw.dateFormat === "yyyy-MM-dd"
      ? raw.dateFormat
      : "dd/MM/yyyy";
  const budgetWarningPercent = boundedInteger(
    raw.budgetWarningPercent,
    DEFAULT_SETTINGS_PREFERENCES.budgetWarningPercent,
    50,
    95,
  );
  let budgetCriticalPercent = boundedInteger(
    raw.budgetCriticalPercent,
    DEFAULT_SETTINGS_PREFERENCES.budgetCriticalPercent,
    60,
    200,
  );
  if (budgetCriticalPercent <= budgetWarningPercent) {
    budgetCriticalPercent = Math.min(200, budgetWarningPercent + 10);
  }

  return {
    dateFormat,
    budgetWarningPercent,
    budgetCriticalPercent,
    notifications: {
      shiftPacing: typeof rawNotifications.shiftPacing === "boolean" ? rawNotifications.shiftPacing : true,
      dailyTarget: typeof rawNotifications.dailyTarget === "boolean" ? rawNotifications.dailyTarget : true,
      leaderboard: typeof rawNotifications.leaderboard === "boolean" ? rawNotifications.leaderboard : true,
      budgetAlerts: typeof rawNotifications.budgetAlerts === "boolean" ? rawNotifications.budgetAlerts : true,
    },
  };
};

export const getLocalSettingsPreferences = (): LocalSettingsPreferences => {
  if (typeof window === "undefined") return DEFAULT_SETTINGS_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(SETTINGS_PREFERENCES_KEY);
    return normalizeLocalSettingsPreferences(raw ? JSON.parse(raw) : DEFAULT_SETTINGS_PREFERENCES);
  } catch {
    return DEFAULT_SETTINGS_PREFERENCES;
  }
};

export const saveLocalSettingsPreferences = (
  preferences: LocalSettingsPreferences,
): LocalSettingsPreferences => {
  if (typeof window === "undefined") {
    throw new Error("Settings preferences can only be saved in a browser.");
  }
  const normalized = normalizeLocalSettingsPreferences(preferences);
  window.localStorage.setItem(SETTINGS_PREFERENCES_KEY, JSON.stringify(normalized));
  window.dispatchEvent(
    new CustomEvent(SETTINGS_PREFERENCES_UPDATED_EVENT, { detail: normalized }),
  );
  return normalized;
};

/**
 * The service worker cannot read localStorage. Mirror push-category choices into
 * IndexedDB so they remain available when a push arrives while the app is closed.
 */
export const syncPushNotificationPreferences = async (
  notifications: NotificationCategoryPreferences,
): Promise<void> => {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    throw new Error("This browser does not support persistent push preference storage.");
  }

  await new Promise<void>((resolve, reject) => {
    const request = window.indexedDB.open(PUSH_PREFERENCES_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PUSH_PREFERENCES_STORE)) {
        db.createObjectStore(PUSH_PREFERENCES_STORE);
      }
    };
    request.onerror = () => reject(request.error || new Error("Could not open settings storage."));
    request.onsuccess = () => {
      const db = request.result;
      let transaction: IDBTransaction;
      try {
        transaction = db.transaction(PUSH_PREFERENCES_STORE, "readwrite");
        transaction.objectStore(PUSH_PREFERENCES_STORE).put(notifications, PUSH_PREFERENCES_KEY);
      } catch (error) {
        db.close();
        reject(error);
        return;
      }
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        const error = transaction.error || new Error("Could not save push notification preferences.");
        db.close();
        reject(error);
      };
      transaction.onabort = () => {
        const error = transaction.error || new Error("Push notification preference save was cancelled.");
        db.close();
        reject(error);
      };
    };
  });
};
