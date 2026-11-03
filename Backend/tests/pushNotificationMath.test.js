import test from "node:test";
import assert from "node:assert/strict";
import { describeNotificationTiming, getMinutesUntilNotification } from "../utils/pushNotificationMath.js";

test("notification lead window includes a task 15 minutes ahead", () => {
  assert.equal(getMinutesUntilNotification(
    { dateString: "2026-11-03", hour: 8, minute: 0, second: 0 },
    "2026-11-03",
    "08:15:00",
  ), 15);
});

test("notification lead window permits a five-minute-late scheduler run", () => {
  assert.equal(getMinutesUntilNotification(
    { dateString: "2026-11-03", hour: 8, minute: 20, second: 0 },
    "2026-11-03",
    "08:15:00",
  ), -5);
});

test("notification lead window excludes events outside the window", () => {
  assert.equal(getMinutesUntilNotification(
    { dateString: "2026-11-03", hour: 8, minute: 0, second: 0 },
    "2026-11-03",
    "08:16:00",
  ), null);
});

test("notification time window handles midnight rollover", () => {
  assert.equal(getMinutesUntilNotification(
    { dateString: "2026-11-03", hour: 23, minute: 55, second: 0 },
    "2026-11-04",
    "00:05:00",
  ), 10);
});

test("notification timing labels are clear", () => {
  assert.equal(describeNotificationTiming(12), "in 12 minutes");
  assert.equal(describeNotificationTiming(0), "now");
  assert.equal(describeNotificationTiming(-3), "3 minutes ago");
});
