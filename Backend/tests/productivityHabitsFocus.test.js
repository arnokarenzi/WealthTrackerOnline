import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidFocusDateRange,
  isValidHabitDateRange,
  validateFocusSessionInput,
  validateHabitInput,
  validateHabitLogInput,
} from "../utils/productivityHabitsValidation.js";
import { calculateHabitMetrics } from "../utils/productivityHabitMetrics.js";

test("habit validator accepts a daily habit with safe defaults", () => {
  const result = validateHabitInput({ name: "Read for 20 minutes" });
  assert.deepEqual(result.errors, []);
  assert.equal(result.values.frequency, "daily");
  assert.deepEqual(result.values.daysOfWeek, []);
  assert.equal(result.values.status, "active");
});

test("habit validator accepts selected weekdays and normalizes duplicates", () => {
  const result = validateHabitInput({
    name: "Exercise", frequency: "selected_days", daysOfWeek: [1, 3, 3, 5], color: "#123abc",
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.values.daysOfWeek, [1, 3, 5]);
});

test("habit validator rejects selected-days habits without days and rejects invalid colours", () => {
  const result = validateHabitInput({ name: "Study", frequency: "selected_days", daysOfWeek: [], color: "green" });
  assert.ok(result.errors.some((message) => message.includes("at least one day")));
  assert.ok(result.errors.some((message) => message.includes("hexadecimal")));
});

test("habit partial update rejects unsupported fields and invalid status", () => {
  const result = validateHabitInput({ status: "deleted", userId: 8 }, { partial: true });
  assert.ok(result.errors.some((message) => message.includes("Unsupported")));
  assert.ok(result.errors.some((message) => message.includes("status")));
});

test("habit log validator requires a real date and boolean completion", () => {
  const valid = validateHabitLogInput({ logDate: "2026-11-02", isCompleted: true, notes: "Morning" });
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.values.isCompleted, true);
  const invalid = validateHabitLogInput({ logDate: "2026-02-30", isCompleted: "yes" });
  assert.ok(invalid.errors.some((message) => message.includes("logDate")));
  assert.ok(invalid.errors.some((message) => message.includes("true or false")));
});

test("habit and focus date ranges are bounded", () => {
  assert.equal(isValidHabitDateRange("2026-01-01", "2026-12-31"), true);
  assert.equal(isValidHabitDateRange("2026-01-01", "2027-01-10"), false);
  assert.equal(isValidFocusDateRange("2026-11-01", "2026-11-30"), true);
  assert.equal(isValidFocusDateRange("2026-11-01", "2026-12-10"), false);
});

test("focus session validator accepts a completed task-linked session", () => {
  const result = validateFocusSessionInput({
    sessionType: "focus", status: "completed", taskId: 12, plannedMinutes: 25, actualSeconds: 1500,
    startedAt: "2026-11-02T08:00:00.000Z", endedAt: "2026-11-02T08:25:00.000Z",
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.values.taskId, 12);
  assert.equal(result.values.actualSeconds, 1500);
});

test("focus session validator rejects reversed times, invalid task IDs and out-of-range durations", () => {
  const result = validateFocusSessionInput({
    sessionType: "focus", status: "completed", taskId: "abc", plannedMinutes: 300, actualSeconds: 0,
    startedAt: "2026-11-02T09:00:00.000Z", endedAt: "2026-11-02T08:59:00.000Z",
  });
  assert.ok(result.errors.some((message) => message.includes("taskId")));
  assert.ok(result.errors.some((message) => message.includes("plannedMinutes")));
  assert.ok(result.errors.some((message) => message.includes("endedAt")));
  assert.ok(result.errors.some((message) => message.includes("at least one actual second")));
});

test("selected-days streak skips unscheduled dates but stops at an incomplete scheduled date", () => {
  const habit = { frequency: "selected_days", days_of_week: "1,3,5" }; // Mon, Wed, Fri
  const logs = [
    { log_date: "2026-11-02", is_completed: 1 }, // Monday
    { log_date: "2026-10-30", is_completed: 1 }, // Friday
    { log_date: "2026-10-28", is_completed: 1 }, // Wednesday
    { log_date: "2026-10-26", is_completed: 0 }, // Monday breaks streak
  ];
  const metrics = calculateHabitMetrics(habit, logs, "2026-11-02");
  assert.equal(metrics.currentStreak, 3);
  assert.equal(metrics.todayStatus, "completed");
  assert.ok(metrics.completionRate30Days > 0);
});

test("today incomplete is not counted as a broken streak before the day ends", () => {
  const habit = { frequency: "daily", days_of_week: null };
  const logs = [
    { log_date: "2026-11-01", is_completed: 1 },
    { log_date: "2026-10-31", is_completed: 1 },
  ];
  const metrics = calculateHabitMetrics(habit, logs, "2026-11-02");
  assert.equal(metrics.currentStreak, 2);
  assert.equal(metrics.todayStatus, "pending");
});


test("focus validator rejects impossible date-times, excessive elapsed time and task-linked breaks", () => {
  const invalidDate = validateFocusSessionInput({
    sessionType: "focus", status: "completed", plannedMinutes: 1, actualSeconds: 60,
    startedAt: "2026-02-30T09:00:00.000Z", endedAt: "2026-02-30T09:01:00.000Z",
  });
  assert.ok(invalidDate.errors.some((message) => message.includes("startedAt")));

  const tooLong = validateFocusSessionInput({
    sessionType: "focus", status: "cancelled", plannedMinutes: 10, actualSeconds: 700,
    startedAt: "2026-11-02T09:00:00.000Z", endedAt: "2026-11-02T09:12:00.000Z",
  });
  assert.ok(tooLong.errors.some((message) => message.includes("planned session duration")));

  const linkedBreak = validateFocusSessionInput({
    sessionType: "short_break", status: "completed", taskId: 2, plannedMinutes: 5, actualSeconds: 300,
    startedAt: "2026-11-02T09:00:00.000Z", endedAt: "2026-11-02T09:05:00.000Z",
  });
  assert.ok(linkedBreak.errors.some((message) => message.includes("Break sessions")));
});
