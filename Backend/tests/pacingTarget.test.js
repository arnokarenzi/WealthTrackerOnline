import test from "node:test";
import assert from "node:assert/strict";
import { calculateMidnightPacingTarget, calculateTargetFromMidnightShiftTotal } from "../utils/pacingTarget.js";

test("midnight snapshot freezes the target from the start-of-day shift total", () => {
  // At midnight, the shift has 120 letters and 13 days (including today) remain.
  assert.equal(calculateTargetFromMidnightShiftTotal(120, 13), 49);
});

test("letters logged after midnight do not change the reconstructed snapshot", () => {
  // 40 letters entered today: current shift total 160 minus today's 40 = 120 at midnight.
  assert.equal(calculateMidnightPacingTarget({
    shiftLetters: 160,
    dailyLetterCount: 40,
    remainingDaysInShift: 13,
  }), 49);
});

test("target is zero after the shift cap is already reached", () => {
  assert.equal(calculateTargetFromMidnightShiftTotal(750, 13), 0);
});
