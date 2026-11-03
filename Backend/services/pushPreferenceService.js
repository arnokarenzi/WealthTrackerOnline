import { pool } from "../models/MonthlyBudget.js";

/**
 * Server-side category switch. The service worker applies the same preference
 * locally as a second guard when the app is closed. Missing legacy AppSettings
 * tables retain the historical default-allow behavior.
 */
export const isPushNotificationCategoryEnabled = async (category) => {
  if (!category) return true;

  try {
    const [[row]] = await pool.query(
      "SELECT preferences FROM AppSettings WHERE id = 1 LIMIT 1",
    );
    let preferences = row?.preferences;
    if (typeof preferences === "string") {
      try {
        preferences = JSON.parse(preferences);
      } catch {
        preferences = {};
      }
    }
    const value = preferences?.notifications?.[category];
    return typeof value === "boolean" ? value : true;
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return true;
    throw error;
  }
};
