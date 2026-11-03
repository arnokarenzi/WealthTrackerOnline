const strictDate = /^\d{4}-\d{2}-\d{2}$/;
const strictTime = /^\d{2}:\d{2}(?::\d{2})?$/;

/** Return target-local minutes from now, or null when the target is outside the send window. */
export const getMinutesUntilNotification = (
  now,
  targetDate,
  targetTime,
  { earlyMinutes = 15, lateMinutes = 5 } = {},
) => {
  if (!now || !strictDate.test(String(now.dateString || ""))) return null;
  if (!strictDate.test(String(targetDate || "")) || !strictTime.test(String(targetTime || ""))) return null;
  const [year, month, day] = now.dateString.split("-").map(Number);
  const [hour, minute, second = 0] = String(targetTime).split(":").map(Number);
  const [targetYear, targetMonth, targetDay] = targetDate.split("-").map(Number);
  const [nowHour, nowMinute, nowSecond = 0] = [Number(now.hour), Number(now.minute), Number(now.second || 0)];
  if ([year, month, day, targetYear, targetMonth, targetDay, hour, minute, second, nowHour, nowMinute, nowSecond].some((part) => !Number.isInteger(part))) return null;
  const targetCheck = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay));
  const nowCheck = new Date(Date.UTC(year, month - 1, day));
  if (targetCheck.toISOString().slice(0, 10) !== targetDate || nowCheck.toISOString().slice(0, 10) !== now.dateString) return null;
  if (hour > 23 || minute > 59 || second > 59 || nowHour < 0 || nowHour > 23 || nowMinute < 0 || nowMinute > 59 || nowSecond < 0 || nowSecond > 59) return null;
  const currentMs = Date.UTC(year, month - 1, day, nowHour, nowMinute, nowSecond);
  const targetMs = Date.UTC(targetYear, targetMonth - 1, targetDay, hour, minute, second);
  const delta = Math.round((targetMs - currentMs) / 60000);
  return delta >= -Math.max(0, lateMinutes) && delta <= Math.max(0, earlyMinutes) ? delta : null;
};

export const describeNotificationTiming = (minutes) => {
  if (!Number.isFinite(minutes)) return "soon";
  if (minutes > 1) return `in ${minutes} minutes`;
  if (minutes >= 0) return "now";
  return `${Math.abs(minutes)} minutes ago`;
};
