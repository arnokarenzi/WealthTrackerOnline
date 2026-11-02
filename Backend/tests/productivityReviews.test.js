import test from "node:test";
import assert from "node:assert/strict";
import {
  getReviewWeekEnd,
  isValidInsightsRange,
  isValidReviewDate,
  validateDailyReviewInput,
  validateWeeklyReviewInput,
} from "../utils/productivityReviewsValidation.js";

test("review dates require real YYYY-MM-DD calendar dates", () => {
  assert.equal(isValidReviewDate("2026-11-02"), true);
  assert.equal(isValidReviewDate("2026-02-29"), false);
  assert.equal(isValidReviewDate("2026-13-01"), false);
  assert.equal(isValidReviewDate("02-11-2026"), false);
});

test("weekly review end date is six days after selected start", () => {
  assert.equal(getReviewWeekEnd("2026-11-02"), "2026-11-08");
  assert.equal(getReviewWeekEnd("2026-12-28"), "2027-01-03");
  assert.equal(getReviewWeekEnd("bad-date"), null);
});

test("daily review accepts bounded text and optional one-to-five ratings", () => {
  const result = validateDailyReviewInput({
    reviewDate: "2026-11-02", moodRating: 4, energyRating: null,
    wins: "Completed the important task", gratitude: "Family",
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.values.moodRating, 4);
  assert.equal(result.values.energyRating, null);
  assert.equal(result.values.wins, "Completed the important task");
});

test("daily review rejects invalid ratings, unsupported fields and oversized text", () => {
  const result = validateDailyReviewInput({
    reviewDate: "2026-11-02", moodRating: 6, unexpected: true, wins: "x".repeat(4001),
  });
  assert.equal(result.errors.length, 3);
});

test("weekly review validates rating and allows text fields", () => {
  const result = validateWeeklyReviewInput({
    weekStart: "2026-11-02", overallRating: 5, wins: "A good week", nextWeekPriorities: "Plan ahead",
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.values.overallRating, 5);
});

test("weekly review rejects an invalid week start and rating", () => {
  const result = validateWeeklyReviewInput({ weekStart: "2026-11-31", overallRating: 0 });
  assert.equal(result.errors.length, 2);
});

test("insights range is inclusive and limited to 92 valid days", () => {
  assert.equal(isValidInsightsRange("2026-10-01", "2026-10-30"), true);
  assert.equal(isValidInsightsRange("2026-08-03", "2026-11-02"), true);
  assert.equal(isValidInsightsRange("2026-08-02", "2026-11-02"), false);
  assert.equal(isValidInsightsRange("2026-11-03", "2026-11-02"), false);
});
