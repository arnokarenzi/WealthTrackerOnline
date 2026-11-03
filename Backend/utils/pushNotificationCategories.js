/** Resolve legacy Web Push tags to the saved notification-preference category. */
export const getPushNotificationCategory = (tag, explicitCategory) => {
  if (typeof explicitCategory === "string" && explicitCategory.trim()) {
    return explicitCategory.trim();
  }

  const value = String(tag || "");
  if (value.startsWith("shift-pacing-") || value.startsWith("test-shift-pacing-")) return "shiftPacing";
  if (value.startsWith("friend-portal-pacing-") || value.startsWith("test-friend-portal-pacing-")) return "friendPortalPacing";
  if (value.startsWith("daily-target-complete") || value.startsWith("test-daily-target-complete")) return "dailyTarget";
  if (value.startsWith("leaderboard-rank-")) return "leaderboard";
  if (value.startsWith("app-financialActivity-")) return "financialActivity";
  if (value.startsWith("app-incomeReminders-")) return "incomeReminders";
  if (value.startsWith("app-billReminders-")) return "billReminders";
  if (value.startsWith("app-debtReminders-")) return "debtReminders";
  if (value.startsWith("app-taskReminders-")) return "taskReminders";
  if (value.startsWith("app-calendarReminders-")) return "calendarReminders";
  if (value.startsWith("app-habitReminders-")) return "habitReminders";
  if (value.startsWith("app-goalReminders-")) return "goalReminders";
  if (value.startsWith("app-countdownReminders-")) return "countdownReminders";
  if (value.startsWith("app-focusTimer-")) return "focusTimer";
  if (value.startsWith("app-budgetAlerts-")) return "budgetAlerts";
  if (value.startsWith("app-reviewReminders-")) return "reviewReminders";
  return null;
};
