import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidProductivityDate,
  isValidProductivityId,
  validateProjectInput,
  validateSubtaskInput,
  validateTaskInput,
} from "../utils/productivityValidation.js";

test("productivity task creation accepts valid task fields and applies defaults", () => {
  const result = validateTaskInput({ title: "Prepare weekly plan", priority: "high", dueDate: "2026-11-05" });
  assert.deepEqual(result.errors, []);
  assert.equal(result.values.title, "Prepare weekly plan");
  assert.equal(result.values.status, "todo");
  assert.equal(result.values.projectId, null);
  assert.equal(result.values.isImportant, false);
  assert.equal(result.values.isUrgent, false);
});

test("productivity task validation rejects invalid dates, time and unknown fields", () => {
  const result = validateTaskInput({ title: "Review", dueDate: "2026-02-30", dueTime: "29:90", unexpected: true });
  assert.ok(result.errors.some((message) => message.includes("dueDate")));
  assert.ok(result.errors.some((message) => message.includes("dueTime")));
  assert.ok(result.errors.some((message) => message.includes("Unsupported task field")));
});

test("partial task updates require at least one valid supported value at controller layer", () => {
  const result = validateTaskInput({ status: "completed", isImportant: true }, { partial: true });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.values, { status: "completed", isImportant: true });
});

test("project validation supports safe archive status and validates color/date", () => {
  const valid = validateProjectInput({ name: "Learning", color: "#336699", targetDate: "2026-12-01" });
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.values.status, "active");
  const invalid = validateProjectInput({ name: "Bad", color: "red", targetDate: "2026-13-01" });
  assert.ok(invalid.errors.some((message) => message.includes("color")));
  assert.ok(invalid.errors.some((message) => message.includes("targetDate")));
});

test("subtask validation accepts completion toggles and rejects non-boolean values", () => {
  const valid = validateSubtaskInput({ title: "Read the specification", isCompleted: true });
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.values.isCompleted, true);
  const invalid = validateSubtaskInput({ isCompleted: "yes" }, { partial: true });
  assert.ok(invalid.errors.some((message) => message.includes("true or false")));
});

test("productivity date and ID validators reject unsafe values", () => {
  assert.equal(isValidProductivityDate("2026-11-02"), true);
  assert.equal(isValidProductivityDate("2026-02-30"), false);
  assert.equal(isValidProductivityId("12"), true);
  assert.equal(isValidProductivityId("0"), false);
  assert.equal(isValidProductivityId("abc"), false);
});
