export const DEFAULT_PRODUCTIVITY_SETTINGS = Object.freeze({
  weekStartsOn: "monday",
  defaultCalendarView: "week",
  defaultFocusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakAfterSessions: 4,
  remindersEnabled: true,
  focusSoundEnabled: false,
  timeZone: "Africa/Kigali",
});

const FIELD_RULES = Object.freeze({
  weekStartsOn: {
    column: "week_starts_on",
    validate: (value) => value === "monday" || value === "sunday",
    message: "weekStartsOn must be 'monday' or 'sunday'.",
  },
  defaultCalendarView: {
    column: "default_calendar_view",
    validate: (value) => ["day", "week", "month"].includes(value),
    message: "defaultCalendarView must be 'day', 'week', or 'month'.",
  },
  defaultFocusMinutes: {
    column: "default_focus_minutes",
    validate: (value) => Number.isInteger(value) && value >= 5 && value <= 180,
    message: "defaultFocusMinutes must be a whole number from 5 to 180.",
  },
  shortBreakMinutes: {
    column: "short_break_minutes",
    validate: (value) => Number.isInteger(value) && value >= 1 && value <= 60,
    message: "shortBreakMinutes must be a whole number from 1 to 60.",
  },
  longBreakMinutes: {
    column: "long_break_minutes",
    validate: (value) => Number.isInteger(value) && value >= 1 && value <= 90,
    message: "longBreakMinutes must be a whole number from 1 to 90.",
  },
  longBreakAfterSessions: {
    column: "long_break_after_sessions",
    validate: (value) => Number.isInteger(value) && value >= 2 && value <= 8,
    message: "longBreakAfterSessions must be a whole number from 2 to 8.",
  },
  remindersEnabled: {
    column: "reminders_enabled",
    validate: (value) => typeof value === "boolean",
    message: "remindersEnabled must be true or false.",
  },
  focusSoundEnabled: {
    column: "focus_sound_enabled",
    validate: (value) => typeof value === "boolean",
    message: "focusSoundEnabled must be true or false.",
  },
});

export const normalizeProductivitySettingsPatch = (input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      values: null,
      errors: ["Request body must be a JSON object."],
    };
  }

  const entries = Object.entries(input);
  if (entries.length === 0) {
    return { values: null, errors: ["Provide at least one setting to update."] };
  }

  const values = {};
  const errors = [];

  for (const [field, value] of entries) {
    const rule = FIELD_RULES[field];
    if (!rule) {
      errors.push(`Unknown productivity setting: ${field}.`);
      continue;
    }
    if (!rule.validate(value)) {
      errors.push(rule.message);
      continue;
    }
    values[field] = value;
  }

  return {
    values: errors.length === 0 ? values : null,
    errors,
  };
};

export const mapProductivitySettingsRow = (row) => ({
  weekStartsOn: row.week_starts_on,
  defaultCalendarView: row.default_calendar_view,
  defaultFocusMinutes: Number(row.default_focus_minutes),
  shortBreakMinutes: Number(row.short_break_minutes),
  longBreakMinutes: Number(row.long_break_minutes),
  longBreakAfterSessions: Number(row.long_break_after_sessions),
  remindersEnabled: Boolean(row.reminders_enabled),
  focusSoundEnabled: Boolean(row.focus_sound_enabled),
  timeZone: row.time_zone || DEFAULT_PRODUCTIVITY_SETTINGS.timeZone,
  updatedAt: row.updated_at,
});
