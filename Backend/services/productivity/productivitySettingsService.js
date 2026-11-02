import { pool } from "../../models/MonthlyBudget.js";
import { mapProductivitySettingsRow } from "../../utils/productivitySettings.js";

const FIELD_COLUMNS = Object.freeze({
  weekStartsOn: "week_starts_on",
  defaultCalendarView: "default_calendar_view",
  defaultFocusMinutes: "default_focus_minutes",
  shortBreakMinutes: "short_break_minutes",
  longBreakMinutes: "long_break_minutes",
  longBreakAfterSessions: "long_break_after_sessions",
  remindersEnabled: "reminders_enabled",
  focusSoundEnabled: "focus_sound_enabled",
});

export const getProductivitySettings = async () => {
  const [rows] = await pool.query(
    `SELECT week_starts_on, default_calendar_view, default_focus_minutes,
            short_break_minutes, long_break_minutes, long_break_after_sessions,
            reminders_enabled, focus_sound_enabled, time_zone, updated_at
       FROM ProductivitySettings
      WHERE id = 1
      LIMIT 1`,
  );

  if (rows.length === 0) {
    const error = new Error("Productivity settings are not initialized.");
    error.code = "PRODUCTIVITY_SETTINGS_NOT_INITIALIZED";
    throw error;
  }

  return mapProductivitySettingsRow(rows[0]);
};

export const updateProductivitySettings = async (values) => {
  const entries = Object.entries(values);
  const assignments = entries.map(([field]) => `${FIELD_COLUMNS[field]} = ?`);
  const parameters = entries.map(([field, value]) =>
    typeof value === "boolean" ? (value ? 1 : 0) : value,
  );

  await pool.query(
    `UPDATE ProductivitySettings
        SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1`,
    parameters,
  );

  return getProductivitySettings();
};
