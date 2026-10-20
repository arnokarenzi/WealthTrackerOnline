import test from "node:test";
import assert from "node:assert/strict";
import { getKigaliTime, getKigaliDateRangeUtc } from "../utils/kigaliTime.js";

test("Kigali daily boundary is midnight, not 08:00", () => {
  const beforeMidnight = getKigaliTime(new Date("2026-10-18T21:59:59.000Z"));
  assert.equal(beforeMidnight.dateString, "2026-10-18");
  assert.equal(beforeMidnight.dateTimeString, "2026-10-18 23:59:59");

  const atMidnight = getKigaliTime(new Date("2026-10-18T22:00:00.000Z"));
  assert.equal(atMidnight.dateString, "2026-10-19");
  assert.equal(atMidnight.dateTimeString, "2026-10-19 00:00:00");
});

test("Kigali date-range filter converts local date boundaries to UTC", () => {
  assert.deepEqual(
    getKigaliDateRangeUtc("2026-10-19", "2026-10-19"),
    ["2026-10-18 22:00:00", "2026-10-19 22:00:00"],
  );
});

test("Kigali month length calculation is independent of host timezone", () => {
  assert.equal(getKigaliTime(new Date("2026-02-01T00:00:00.000Z")).lastDayOfMonth, 28);
  assert.equal(getKigaliTime(new Date("2026-10-19T20:00:00.000Z")).lastDayOfMonth, 31);
});
