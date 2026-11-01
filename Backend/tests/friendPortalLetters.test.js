import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateFriendPortalEntryEarnings,
  calculateShiftAdjustedFriendPortalEntries,
  FRIEND_PORTAL_FREE_LETTERS_PER_SHIFT,
  FRIEND_PORTAL_RATE_PER_LETTER,
} from "../utils/friendPortalLettersMath.js";

test("friend-portal defaults to a 150-letter shift deduction and 245 RWF rate", () => {
  assert.equal(FRIEND_PORTAL_FREE_LETTERS_PER_SHIFT, 150);
  assert.equal(FRIEND_PORTAL_RATE_PER_LETTER, 245);
});

test("350 letters in one shift produce 200 payable letters and 49,000 RWF", () => {
  const [entry] = calculateShiftAdjustedFriendPortalEntries([
    { workDate: "2026-11-04", lettersCount: 350 },
  ]);
  assert.equal(entry.excludedLetters, 150);
  assert.equal(entry.payableLetters, 200);
  assert.equal(entry.earnings, 49000);
});

test("the 150-letter allowance carries forward across dates in one shift", () => {
  const entries = calculateShiftAdjustedFriendPortalEntries([
    { workDate: "2026-11-02", lettersCount: 100 },
    { workDate: "2026-11-03", lettersCount: 250 },
  ]);
  const secondDay = entries.find((entry) => entry.workDate === "2026-11-03");
  assert.equal(secondDay.excludedLetters, 50);
  assert.equal(secondDay.payableLetters, 200);
  assert.equal(secondDay.earnings, 49000);
});

test("the allowance resets at the start of the second shift (day 16)", () => {
  const entries = calculateShiftAdjustedFriendPortalEntries([
    { workDate: "2026-11-15", lettersCount: 200 },
    { workDate: "2026-11-16", lettersCount: 200 },
  ]);
  const day15 = entries.find((entry) => entry.workDate === "2026-11-15");
  const day16 = entries.find((entry) => entry.workDate === "2026-11-16");
  assert.equal(day15.payableLetters, 50);
  assert.equal(day16.payableLetters, 50);
  assert.equal(day15.earnings + day16.earnings, 24500);
});

test("allowance allocation is chronological even if entries arrive out of order", () => {
  const entries = calculateShiftAdjustedFriendPortalEntries([
    { workDate: "2026-11-05", lettersCount: 100 },
    { workDate: "2026-11-02", lettersCount: 100 },
  ]);
  const early = entries.find((entry) => entry.workDate === "2026-11-02");
  const late = entries.find((entry) => entry.workDate === "2026-11-05");
  assert.equal(early.excludedLetters, 100);
  assert.equal(late.excludedLetters, 50);
  assert.equal(late.payableLetters, 50);
});

test("entry calculation returns no earnings when letters or remaining allowance are invalid", () => {
  assert.equal(calculateFriendPortalEntryEarnings(-1, 150).earnings, 0);
  assert.equal(calculateFriendPortalEntryEarnings(200, -10).earnings, 49000);
});
