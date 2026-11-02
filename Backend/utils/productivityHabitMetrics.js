import { getKigaliDateString } from "./kigaliTime.js";

const toDateString = (date) => date.toISOString().slice(0, 10);
const shiftDate = (dateString, offset) => {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return toDateString(date);
};
const parseDays = (value) => value ? String(value).split(",").map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6) : [];
const isScheduledOn = (habit, dateString) => {
  if (habit.frequency === "daily") return true;
  const day = new Date(`${dateString}T00:00:00.000Z`).getUTCDay();
  return parseDays(habit.days_of_week).includes(day);
};

export const calculateHabitMetrics = (habit, logs, today = getKigaliDateString()) => {
  const createdDate = habit.created_at
    ? (habit.created_at instanceof Date ? getKigaliDateString(habit.created_at) : String(habit.created_at).slice(0, 10))
    : shiftDate(today, -29);
  const isDueOn = (dateString) => dateString >= createdDate && isScheduledOn(habit, dateString);
  const logMap = new Map(logs.map((log) => [String(log.log_date).slice(0, 10), Boolean(log.is_completed)]));
  const todayCompleted = logMap.get(today) === true;
  const todayScheduled = isDueOn(today);
  let currentStreak = 0;
  let cursor = today;
  if (todayScheduled && !todayCompleted) cursor = shiftDate(today, -1);
  for (let count = 0; count < 36600; count += 1) {
    if (cursor < createdDate) break;
    if (!isDueOn(cursor)) {
      cursor = shiftDate(cursor, -1);
      continue;
    }
    if (logMap.get(cursor) !== true) break;
    currentStreak += 1;
    cursor = shiftDate(cursor, -1);
  }
  let scheduledDays = 0;
  let completedDays = 0;
  for (let offset = 0; offset < 30; offset += 1) {
    const date = shiftDate(today, -offset);
    if (!isDueOn(date)) continue;
    scheduledDays += 1;
    if (logMap.get(date) === true) completedDays += 1;
  }
  const recentLogs = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = shiftDate(today, -offset);
    recentLogs.push({ date, isScheduled: isDueOn(date), isCompleted: logMap.get(date) === true });
  }
  return {
    todayStatus: !todayScheduled ? "not_scheduled" : todayCompleted ? "completed" : "pending",
    currentStreak,
    completionRate30Days: scheduledDays ? Math.round((completedDays / scheduledDays) * 100) : 0,
    completedDays30Days: completedDays,
    scheduledDays30Days: scheduledDays,
    recentLogs,
  };
};
