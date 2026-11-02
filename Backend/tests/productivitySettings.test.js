import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PRODUCTIVITY_SETTINGS,
  mapProductivitySettingsRow,
  normalizeProductivitySettingsPatch,
} from "../utils/productivitySettings.js";

test("productivity settings defaults use the FinTrack Kigali workspace defaults", () => {
  assert.equal(DEFAULT_PRODUCTIVITY_SETTINGS.weekStartsOn, "monday");
  assert.equal(DEFAULT_PRODUCTIVITY_SETTINGS.defaultFocusMinutes, 25);
  assert.equal(DEFAULT_PRODUCTIVITY_SETTINGS.timeZone, "Africa/Kigali");
});

test("valid productivity preference changes are accepted", () => {
  const result = normalizeProductivitySettingsPatch({
    weekStartsOn: "sunday",
    defaultFocusMinutes: 30,
    remindersEnabled: false,
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.values, {
    weekStartsOn: "sunday",
    defaultFocusMinutes: 30,
    remindersEnabled: false,
  });
});

test("invalid, unknown, and empty preference changes are rejected", () => {
  assert.equal(
    normalizeProductivitySettingsPatch({ defaultFocusMinutes: 0 }).values,
    null,
  );
  assert.equal(
    normalizeProductivitySettingsPatch({ arbitrarySqlField: "x" }).values,
    null,
  );
  assert.equal(normalizeProductivitySettingsPatch({}).values, null);
  assert.equal(normalizeProductivitySettingsPatch(null).values, null);
});

test("database preference rows are mapped to the API response shape", () => {
  const result = mapProductivitySettingsRow({
    week_starts_on: "monday",
    default_calendar_view: "week",
    default_focus_minutes: 25,
    short_break_minutes: 5,
    long_break_minutes: 15,
    long_break_after_sessions: 4,
    reminders_enabled: 1,
    focus_sound_enabled: 0,
    time_zone: "Africa/Kigali",
    updated_at: "2026-11-02 12:00:00",
  });
  assert.equal(result.defaultFocusMinutes, 25);
  assert.equal(result.remindersEnabled, true);
  assert.equal(result.focusSoundEnabled, false);
  assert.equal(result.timeZone, "Africa/Kigali");
});
