import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidCalendarDateRange,
  isValidCalendarId,
  validateCalendarEventInput,
} from "../utils/productivityCalendarValidation.js";

test("calendar event validator accepts a valid timed event", () => {
  const result = validateCalendarEventInput({
    title: "Dentist appointment",
    description: "Routine check-up",
    eventDate: "2026-11-10",
    startTime: "09:00",
    endTime: "10:00",
    isAllDay: false,
    color: "#1976d2",
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.values.title, "Dentist appointment");
  assert.equal(result.values.startTime, "09:00");
});

test("calendar event validator accepts an all-day event and clears times", () => {
  const result = validateCalendarEventInput({
    title: "Public holiday",
    eventDate: "2026-11-17",
    startTime: "08:00",
    endTime: "09:00",
    isAllDay: true,
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.values.startTime, null);
  assert.equal(result.values.endTime, null);
});

test("calendar event validator rejects invalid dates and reversed times", () => {
  const invalidDate = validateCalendarEventInput({ title: "Invalid", eventDate: "2026-02-30" });
  assert.ok(invalidDate.errors.some((message) => message.includes("eventDate")));
  const reversed = validateCalendarEventInput({
    title: "Bad time",
    eventDate: "2026-11-10",
    startTime: "11:00",
    endTime: "10:00",
  });
  assert.ok(reversed.errors.some((message) => message.includes("end time")));
});

test("calendar event validator rejects unknown fields and bad colors", () => {
  const result = validateCalendarEventInput({ title: "Test", eventDate: "2026-11-10", color: "red", accountId: 3 });
  assert.ok(result.errors.some((message) => message.includes("Unsupported")));
  assert.ok(result.errors.some((message) => message.includes("hexadecimal")));
});

test("calendar date range is valid and capped at 94 days", () => {
  assert.equal(isValidCalendarDateRange("2026-11-01", "2026-11-30"), true);
  assert.equal(isValidCalendarDateRange("2026-11-30", "2026-11-01"), false);
  assert.equal(isValidCalendarDateRange("2026-01-01", "2026-05-01"), false);
});

test("calendar IDs must be positive safe integers", () => {
  assert.equal(isValidCalendarId("12"), true);
  assert.equal(isValidCalendarId("0"), false);
  assert.equal(isValidCalendarId("not-an-id"), false);
});
