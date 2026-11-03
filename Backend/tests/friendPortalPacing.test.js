import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateFriendPortalPacing,
  getFriendPortalShiftBounds,
  FRIEND_PORTAL_SHIFT_TARGET_LETTERS,
} from "../utils/friendPortalPacingMath.js";

test("Friend Portal shift target defaults to 450 total letters", () => {
  assert.equal(FRIEND_PORTAL_SHIFT_TARGET_LETTERS, 450);
});

test("first shift uses days 1 through 15", () => {
  const bounds = getFriendPortalShiftBounds({
    year: 2026, month: 11, day: 3, lastDayOfMonth: 30,
  });
  assert.deepEqual(bounds, {
    shiftStart: "2026-11-01",
    shiftEnd: "2026-11-15",
    shiftDay: 3,
    totalDaysInShift: 15,
    remainingDaysInShift: 13,
  });
});

test("second shift includes all dates through the end of the month", () => {
  const bounds = getFriendPortalShiftBounds({
    year: 2026, month: 1, day: 31, lastDayOfMonth: 31,
  });
  assert.deepEqual(bounds, {
    shiftStart: "2026-01-16",
    shiftEnd: "2026-01-31",
    shiftDay: 16,
    totalDaysInShift: 16,
    remainingDaysInShift: 1,
  });
});

test("450-letter starting target requires 30 letters daily in a 15-day shift", () => {
  const result = calculateFriendPortalPacing({
    shiftLetters: 0,
    todayLetters: 0,
    shiftDay: 1,
    totalDaysInShift: 15,
    remainingDaysInShift: 15,
  });
  assert.equal(result.currentRequiredPerDay, 30);
  assert.equal(result.todayRemaining, 30);
  assert.equal(result.remainingShiftLetters, 450);
  assert.equal(result.targetReached, false);
});

test("required daily pace adapts to shift progress", () => {
  const result = calculateFriendPortalPacing({
    shiftLetters: 180,
    todayLetters: 20,
    shiftDay: 7,
    totalDaysInShift: 15,
    remainingDaysInShift: 9,
  });
  assert.equal(result.remainingShiftLetters, 270);
  assert.equal(result.currentRequiredPerDay, 30);
  assert.equal(result.todayRemaining, 10);
});

test("progress already ahead of required pace does not ask for extra letters today", () => {
  const result = calculateFriendPortalPacing({
    shiftLetters: 220,
    todayLetters: 50,
    shiftDay: 7,
    totalDaysInShift: 15,
    remainingDaysInShift: 9,
  });
  assert.equal(result.currentRequiredPerDay, 26);
  assert.equal(result.todayRemaining, 0);
});

test("target completion shows 300 payable letters and RWF 73,500 at the configured rate", () => {
  const result = calculateFriendPortalPacing({
    shiftLetters: 450,
    todayLetters: 30,
    shiftDay: 15,
    totalDaysInShift: 15,
    remainingDaysInShift: 1,
  });
  assert.equal(result.targetReached, true);
  assert.equal(result.payableLettersAtTarget, 300);
  assert.equal(result.estimatedEarningsAtTarget, 73500);
  assert.equal(result.progressPercent, 100);
});
