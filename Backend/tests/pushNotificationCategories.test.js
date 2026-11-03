import test from "node:test";
import assert from "node:assert/strict";
import { getPushNotificationCategory } from "../utils/pushNotificationCategories.js";

test("explicit notification category takes precedence over legacy tag inference", () => {
  assert.equal(getPushNotificationCategory("shift-pacing-2026-11-03-8", "customCategory"), "customCategory");
});

test("legacy personal shift pacing tags map to personal category", () => {
  assert.equal(getPushNotificationCategory("shift-pacing-2026-11-03-8"), "shiftPacing");
  assert.equal(getPushNotificationCategory("test-shift-pacing-8"), "shiftPacing");
});

test("friend portal pacing and completion tags map independently", () => {
  assert.equal(getPushNotificationCategory("friend-portal-pacing-2026-11-03-8"), "friendPortalPacing");
  assert.equal(getPushNotificationCategory("friend-portal-pacing-target-complete-2026-11-03"), "friendPortalPacing");
  assert.equal(getPushNotificationCategory("test-friend-portal-pacing-2026-11-03"), "friendPortalPacing");
});

test("personal target and leaderboard tags map to their own categories", () => {
  assert.equal(getPushNotificationCategory("daily-target-complete-2026-11-03"), "dailyTarget");
  assert.equal(getPushNotificationCategory("leaderboard-rank-2-12345"), "leaderboard");
});

test("all unified scheduled categories are inferred from service tags", () => {
  const mappings = [
    ["app-financialActivity-abc", "financialActivity"],
    ["app-incomeReminders-abc", "incomeReminders"],
    ["app-billReminders-abc", "billReminders"],
    ["app-debtReminders-abc", "debtReminders"],
    ["app-taskReminders-abc", "taskReminders"],
    ["app-calendarReminders-abc", "calendarReminders"],
    ["app-habitReminders-abc", "habitReminders"],
    ["app-goalReminders-abc", "goalReminders"],
    ["app-countdownReminders-abc", "countdownReminders"],
    ["app-focusTimer-abc", "focusTimer"],
    ["app-budgetAlerts-abc", "budgetAlerts"],
    ["app-reviewReminders-abc", "reviewReminders"],
  ];
  for (const [tag, expected] of mappings) {
    assert.equal(getPushNotificationCategory(tag), expected, tag);
  }
});

test("unknown tags do not accidentally suppress unrelated notifications", () => {
  assert.equal(getPushNotificationCategory("fintrack-general-test-123"), null);
  assert.equal(getPushNotificationCategory("unclassified-event"), null);
});
