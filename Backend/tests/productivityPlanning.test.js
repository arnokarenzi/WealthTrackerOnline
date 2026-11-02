import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidPlanningDate,
  isValidPlanningId,
  validateCountdownInput,
  validateGoalInput,
  validateMilestoneInput,
  validateNoteInput,
} from "../utils/productivityPlanningValidation.js";
import {
  calculateGoalProgress,
  differenceInCalendarDays,
  getNextCountdownDate,
} from "../utils/productivityPlanningMetrics.js";

test("goal validation accepts milestone-driven goals and applies safe defaults", () => {
  const result = validateGoalInput({ name: "Complete a course", targetDate: "2026-12-31" });
  assert.deepEqual(result.errors, []);
  assert.equal(result.values.status, "active");
  assert.equal(result.values.progressMode, "milestones");
  assert.equal(result.values.manualProgress, 0);
});

test("goal validation rejects reversed dates, invalid progress and unknown fields", () => {
  const result = validateGoalInput({
    name: "Invalid goal", startDate: "2026-12-31", targetDate: "2026-01-01",
    progressMode: "automatic-ish", manualProgress: 120, userId: 5,
  });
  assert.ok(result.errors.some((message) => message.includes("targetDate cannot be earlier")));
  assert.ok(result.errors.some((message) => message.includes("progressMode")));
  assert.ok(result.errors.some((message) => message.includes("manualProgress")));
  assert.ok(result.errors.some((message) => message.includes("Unsupported")));
});

test("milestone validation accepts completion toggles and rejects malformed dates", () => {
  const valid = validateMilestoneInput({ title: "Finish module one", isCompleted: true, dueDate: "2026-11-30" });
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.values.isCompleted, true);
  const invalid = validateMilestoneInput({ title: "Milestone", dueDate: "2026-02-30", isCompleted: "yes" });
  assert.ok(invalid.errors.some((message) => message.includes("dueDate")));
  assert.ok(invalid.errors.some((message) => message.includes("isCompleted")));
});

test("note validation allows title-less quick notes but requires non-empty content", () => {
  const valid = validateNoteInput({ content: "An idea to revisit", isPinned: true });
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.values.title, null);
  assert.equal(valid.values.color, "#fff4cc");
  const invalid = validateNoteInput({ content: " ", color: "yellow" });
  assert.ok(invalid.errors.some((message) => message.includes("content is required")));
  assert.ok(invalid.errors.some((message) => message.includes("hexadecimal")));
});

test("countdown validation accepts annual recurring events and optional event time", () => {
  const valid = validateCountdownInput({ title: "Birthday", eventDate: "2000-02-29", recurrence: "yearly", eventTime: "09:30" });
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.values.recurrence, "yearly");
  const invalid = validateCountdownInput({ title: "Trip", eventDate: "2026-02-30", eventTime: "26:88" });
  assert.ok(invalid.errors.some((message) => message.includes("eventDate")));
  assert.ok(invalid.errors.some((message) => message.includes("eventTime")));
});

test("planning ID and date validation reject unsafe values", () => {
  assert.equal(isValidPlanningId("10"), true);
  assert.equal(isValidPlanningId("-2"), false);
  assert.equal(isValidPlanningDate("2026-11-02"), true);
  assert.equal(isValidPlanningDate("2026-02-30"), false);
});

test("goal progress uses completed milestone proportion or manual percentage", () => {
  assert.equal(calculateGoalProgress({ status: "active", progressMode: "milestones", milestoneCount: 4, completedMilestoneCount: 3 }), 75);
  assert.equal(calculateGoalProgress({ status: "active", progressMode: "milestones", milestoneCount: 0, completedMilestoneCount: 0 }), 0);
  assert.equal(calculateGoalProgress({ status: "active", progressMode: "manual", manualProgress: 63 }), 63);
  assert.equal(calculateGoalProgress({ status: "completed", progressMode: "manual", manualProgress: 10 }), 100);
});

test("countdown calculations handle dates, annual recurrence and leap-day dates", () => {
  assert.equal(differenceInCalendarDays("2026-11-02", "2026-11-05"), 3);
  assert.equal(getNextCountdownDate("2020-12-25", "yearly", "2026-11-02"), "2026-12-25");
  assert.equal(getNextCountdownDate("2020-01-01", "yearly", "2026-11-02"), "2027-01-01");
  assert.equal(getNextCountdownDate("2000-02-29", "yearly", "2025-03-01"), "2026-02-28");
  assert.equal(getNextCountdownDate("2026-11-01", "none", "2026-11-02"), "2026-11-01");
});
