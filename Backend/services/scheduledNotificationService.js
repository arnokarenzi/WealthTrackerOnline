import { pool } from "../models/MonthlyBudget.js";
import { getKigaliTime } from "../utils/kigaliTime.js";
import { getNextCountdownDate, differenceInCalendarDays } from "../utils/productivityPlanningMetrics.js";
import { getBudgetAlertLevel } from "../utils/featureMath.js";
import { describeNotificationTiming, getMinutesUntilNotification } from "../utils/pushNotificationMath.js";
import { sendCategoryPushNotification } from "./appPushNotificationService.js";

const pad = (value) => String(value).padStart(2, "0");
const dateText = (value) => value instanceof Date
  ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  : String(value || "").slice(0, 10);
const addDays = (date, amount) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
};
const weekdaySundayZero = (date) => new Date(`${date}T00:00:00.000Z`).getUTCDay();
const asMoney = (value) => Math.round(Number(value || 0)).toLocaleString("en-US");
const safeSend = async (result, payload) => {
  try {
    const response = await sendCategoryPushNotification(payload);
    result.push({ category: payload.category, sent: Number(response.sent || 0), skipped: response.skipped || null });
  } catch (error) {
    console.error(`[APP PUSH] ${payload.category} failed:`, error?.message || error);
    result.push({ category: payload.category, sent: 0, error: error?.message || "delivery-failed" });
  }
};

const sendTimedTaskAndCalendarReminders = async (now, results) => {
  const today = now.dateString;
  let tasks = [];
  let events = [];
  try {
    const [rows] = await pool.query(
      `SELECT id, title,
              DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date,
              TIME_FORMAT(due_time, '%H:%i:%s') AS due_time,
              DATE_FORMAT(scheduled_date, '%Y-%m-%d') AS scheduled_date,
              TIME_FORMAT(scheduled_start_time, '%H:%i:%s') AS scheduled_start_time
         FROM ProductivityTasks
        WHERE status NOT IN ('completed', 'cancelled')
          AND ((due_date >= ? AND due_date <= ?) OR (scheduled_date >= ? AND scheduled_date <= ?))
          AND (due_time IS NOT NULL OR scheduled_start_time IS NOT NULL)
        ORDER BY COALESCE(scheduled_date, due_date), COALESCE(scheduled_start_time, due_time)
        LIMIT 300`,
      [today, addDays(today, 1), today, addDays(today, 1)],
    );
    tasks = rows;
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") throw error;
  }

  for (const task of tasks) {
    const scheduleDate = dateText(task.scheduled_date);
    const scheduleTime = task.scheduled_start_time ? String(task.scheduled_start_time).slice(0, 8) : null;
    const dueDate = dateText(task.due_date);
    const dueTime = task.due_time ? String(task.due_time).slice(0, 8) : null;
    const targets = [];
    if (scheduleDate && scheduleTime) targets.push({ kind: "scheduled", date: scheduleDate, time: scheduleTime });
    if (dueDate && dueTime && !(dueDate === scheduleDate && dueTime === scheduleTime)) targets.push({ kind: "due", date: dueDate, time: dueTime });
    for (const target of targets) {
      const minutes = getMinutesUntilNotification(now, target.date, target.time);
      if (minutes === null) continue;
      const timing = describeNotificationTiming(minutes);
      await safeSend(results, {
        category: "taskReminders",
        eventKey: `task-${task.id}-${target.kind}-${target.date}-${target.time}`,
        title: target.kind === "scheduled" ? "Task starting soon" : "Task deadline approaching",
        body: `“${task.title}” is ${timing}. Open FinTrack to review your task.`,
        route: "/productivity/tasks",
        ttl: 15 * 60,
      });
    }
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, title, DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date,
              TIME_FORMAT(start_time, '%H:%i:%s') AS start_time
         FROM ProductivityCalendarEvents
        WHERE event_date BETWEEN ? AND ? AND is_all_day = 0 AND start_time IS NOT NULL
        ORDER BY event_date, start_time LIMIT 200`,
      [today, addDays(today, 1)],
    );
    events = rows;
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") throw error;
  }

  for (const event of events) {
    const eventDate = dateText(event.event_date);
    const startTime = String(event.start_time).slice(0, 8);
    const minutes = getMinutesUntilNotification(now, eventDate, startTime);
    if (minutes === null) continue;
    const timing = describeNotificationTiming(minutes);
    await safeSend(results, {
      category: "calendarReminders",
      eventKey: `calendar-${event.id}-${eventDate}-${startTime}`,
      title: "Calendar event coming up",
      body: `“${event.title}” starts ${timing}.`,
      route: "/productivity/calendar",
      ttl: 15 * 60,
    });
  }
};

const sendMorningDigest = async (now, results) => {
  const today = now.dateString;
  const weekday = weekdaySundayZero(today);
  let tasks = [];
  let events = [];
  let habits = [];
  try {
    const [rows] = await pool.query(
      `SELECT id, title FROM ProductivityTasks
        WHERE status NOT IN ('completed', 'cancelled')
          AND (due_date = ? OR scheduled_date = ? OR due_date < ?)
        ORDER BY FIELD(priority, 'high', 'medium', 'low', 'none'), due_date ASC LIMIT 100`,
      [today, today, today],
    );
    tasks = rows;
  } catch (error) { if (error?.code !== "ER_NO_SUCH_TABLE") throw error; }

  try {
    const [rows] = await pool.query(
      `SELECT id, title FROM ProductivityCalendarEvents
        WHERE event_date = ? ORDER BY is_all_day DESC, start_time ASC LIMIT 100`,
      [today],
    );
    events = rows;
  } catch (error) { if (error?.code !== "ER_NO_SUCH_TABLE") throw error; }

  try {
    const [rows] = await pool.query(
      `SELECT h.id, h.name
         FROM ProductivityHabits h
         LEFT JOIN ProductivityHabitLogs l
           ON l.habit_id = h.id AND l.log_date = ? AND l.is_completed = 1
        WHERE h.status = 'active'
          AND (h.frequency = 'daily' OR FIND_IN_SET(?, h.days_of_week) > 0)
          AND l.id IS NULL
        ORDER BY h.name LIMIT 100`,
      [today, String(weekday)],
    );
    habits = rows;
  } catch (error) { if (error?.code !== "ER_NO_SUCH_TABLE") throw error; }

  if (tasks.length || events.length) {
    const taskText = tasks.length ? `${tasks.length} open task${tasks.length === 1 ? "" : "s"}` : "no open tasks";
    const eventText = events.length ? `${events.length} calendar event${events.length === 1 ? "" : "s"}` : "no calendar events";
    await safeSend(results, {
      category: "taskReminders",
      eventKey: `my-day-digest-${today}`,
      title: "Your FinTrack day is ready",
      body: `Today: ${taskText} and ${eventText}. Open My Day to plan your priorities.`,
      route: "/productivity/my-day",
      ttl: 12 * 60 * 60,
    });
  }

  if (habits.length) {
    const names = habits.slice(0, 3).map((habit) => habit.name).join(", ");
    const more = habits.length > 3 ? ` and ${habits.length - 3} more` : "";
    await safeSend(results, {
      category: "habitReminders",
      eventKey: `habits-due-${today}`,
      title: `${habits.length} habit${habits.length === 1 ? "" : "s"} to complete today`,
      body: `${names}${more}. Record your progress in FinTrack Habits.`,
      route: "/productivity/habits",
      ttl: 12 * 60 * 60,
    });
  }
};

const sendBillsAndDebtReminders = async (today, results) => {
  const through = addDays(today, 7);
  try {
    const [bills] = await pool.query(
      `SELECT id, bill_name, amount, DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date
         FROM Bills
        WHERE is_archived = 0 AND status = 'unpaid' AND notify_enabled = 1 AND due_date <= ?
        ORDER BY due_date ASC LIMIT 100`,
      [through],
    );
    for (const bill of bills) {
      const days = differenceInCalendarDays(today, bill.due_date);
      const state = days < 0 ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue` : days === 0 ? "due today" : `due in ${days} days`;
      await safeSend(results, {
        category: "billReminders",
        eventKey: `bill-${bill.id}-${today}`,
        title: days < 0 ? `Overdue bill: ${bill.bill_name}` : `Bill reminder: ${bill.bill_name}`,
        body: `${asMoney(bill.amount)} RWF is ${state}. Open FinTrack Bills to review payment.`,
        route: "/bills",
        ttl: 24 * 60 * 60,
      });
    }
  } catch (error) { if (error?.code !== "ER_NO_SUCH_TABLE") throw error; }

  try {
    const [debts] = await pool.query(
      `SELECT id, creditor, current_balance, DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date
         FROM Debts
        WHERE is_archived = 0 AND status = 'active' AND due_date IS NOT NULL AND due_date <= ?
        ORDER BY due_date ASC LIMIT 100`,
      [through],
    );
    for (const debt of debts) {
      const days = differenceInCalendarDays(today, debt.due_date);
      const state = days < 0 ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue` : days === 0 ? "due today" : `due in ${days} days`;
      await safeSend(results, {
        category: "debtReminders",
        eventKey: `debt-${debt.id}-${today}`,
        title: days < 0 ? `Debt payment overdue: ${debt.creditor}` : `Debt payment reminder: ${debt.creditor}`,
        body: `Outstanding balance ${asMoney(debt.current_balance)} RWF; due ${state}. Open FinTrack Debt to review.`,
        route: "/debt",
        ttl: 24 * 60 * 60,
      });
    }
  } catch (error) { if (error?.code !== "ER_NO_SUCH_TABLE") throw error; }
};

const sendCountdownReminders = async (today, results) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date, recurrence
         FROM ProductivityCountdowns WHERE status = 'active' LIMIT 500`,
    );
    for (const item of rows) {
      const nextDate = getNextCountdownDate(item.event_date, item.recurrence, today);
      const remaining = differenceInCalendarDays(today, nextDate);
      if (![7, 1, 0].includes(remaining)) continue;
      const message = remaining === 0 ? "is today" : `is in ${remaining} day${remaining === 1 ? "" : "s"}`;
      await safeSend(results, {
        category: "countdownReminders",
        eventKey: `countdown-${item.id}-${nextDate}-${remaining}`,
        title: remaining === 0 ? `Today: ${item.title}` : `Countdown: ${item.title}`,
        body: `“${item.title}” ${message}.`,
        route: "/productivity/countdowns",
        ttl: 24 * 60 * 60,
      });
    }
  } catch (error) { if (error?.code !== "ER_NO_SUCH_TABLE") throw error; }
};

const sendMilestoneReminders = async (today, results) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.id, m.title, DATE_FORMAT(m.due_date, '%Y-%m-%d') AS due_date,
              g.name AS goal_name
         FROM ProductivityGoalMilestones m
         JOIN ProductivityGoals g ON g.id = m.goal_id
        WHERE m.is_completed = 0 AND g.status = 'active'
          AND m.due_date IS NOT NULL AND m.due_date <= ?
        ORDER BY m.due_date ASC LIMIT 100`,
      [today],
    );
    for (const item of rows) {
      const dueDate = dateText(item.due_date);
      const overdue = dueDate < today;
      await safeSend(results, {
        category: "goalReminders",
        eventKey: `milestone-due-${item.id}-${today}`,
        title: overdue ? "Goal milestone overdue" : "Goal milestone due today",
        body: `${item.title} for “${item.goal_name}” ${overdue ? `was due ${dueDate}` : "is due today"}.`,
        route: "/productivity/goals",
        ttl: 24 * 60 * 60,
      });
    }
  } catch (error) { if (error?.code !== "ER_NO_SUCH_TABLE") throw error; }
};

const sendBudgetThresholdReminder = async (now, results) => {
  try {
    const [[settings]] = await pool.query("SELECT preferences FROM AppSettings WHERE id = 1 LIMIT 1");
    let preferences = settings?.preferences;
    if (typeof preferences === "string") {
      try { preferences = JSON.parse(preferences); } catch { preferences = {}; }
    }
    const warning = Number(preferences?.budgetWarningPercent ?? 80);
    const critical = Number(preferences?.budgetCriticalPercent ?? 100);
    const yearMonth = `${now.year}-${pad(now.month)}`;
    const [expenses] = await pool.query(
      `SELECT category, SUM(amount) AS spent FROM DailyExpense
        WHERE COALESCE(is_archived, 0) = 0
          AND expenseDate >= CONCAT(?, '-01')
          AND expenseDate < DATE_ADD(CONCAT(?, '-01'), INTERVAL 1 MONTH)
        GROUP BY category`,
      [yearMonth, yearMonth],
    );
    const essentialsCategories = new Set(["food", "rent", "miscellaneous", "phoneinternet", "electricitywater", "medical", "familysupport"]);
    const normalized = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const spent = expenses.reduce((sum, row) => sum + (essentialsCategories.has(normalized(row.category)) ? Number(row.spent || 0) : 0), 0);
    const [[budget]] = await pool.query("SELECT recommendedEssentials FROM MonthlyBudget WHERE id = 1 LIMIT 1");
    const recommended = Number(budget?.recommendedEssentials || 0);
    if (recommended <= 0) return;
    const pct = Math.round((spent / recommended) * 100);
    const level = getBudgetAlertLevel(pct, warning, critical);
    if (level === "success") return;
    await safeSend(results, {
      category: "budgetAlerts",
      eventKey: `essentials-${yearMonth}-${level}`,
      title: level === "critical" ? "Essentials budget limit reached" : "Essentials budget warning",
      body: `Essentials spending is ${pct}% of the planned amount (${asMoney(spent)} of ${asMoney(recommended)} RWF). Review your budget in FinTrack.`,
      route: "/expenses",
      ttl: 24 * 60 * 60,
    });
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") throw error;
  }
};


const sendExpectedIncomeReminders = async (now, results) => {
  const day = Number(now.day);
  const firstHalfShift = day >= 13 && day <= 15;
  const secondHalfShift = day >= 28 && day <= 30;
  if (!firstHalfShift && !secondHalfShift) return;

  const personalPaydayWindow = firstHalfShift ? "13th/14th" : "28th/29th";
  if ((firstHalfShift && [13, 14].includes(day)) || (secondHalfShift && [28, 29].includes(day))) {
    await safeSend(results, {
      category: "incomeReminders",
      eventKey: `personal-shift-salary-window-${now.dateString}`,
      title: "Personal portal salary window",
      body: `Your personal portal salary for the previous work shift is normally received around the ${personalPaydayWindow} of the month. Check whether it has arrived and record only the amount actually received.`,
      route: "/",
      ttl: 24 * 60 * 60,
    });
  }

  const friendTransferWindow = firstHalfShift ? [14, 15].includes(day) : [29, 30].includes(day);
  if (friendTransferWindow) {
    await safeSend(results, {
      category: "incomeReminders",
      eventKey: `friend-portal-transfer-window-${now.dateString}`,
      title: "Friend Portal transfer reminder",
      body: `Your friend receives his portal salary on the same payday as you and transfers the Friend Portal earnings the following day. Check whether the transfer has arrived; record it only after the money reaches you.`,
      route: "/friend-portal-letters",
      ttl: 24 * 60 * 60,
    });
  }
};

const sendReviewReminders = async (now, results) => {
  const today = now.dateString;
  if (now.hour === 20 && now.minute < 10) {
    try {
      const [[review]] = await pool.query("SELECT id FROM ProductivityDailyReviews WHERE review_date = ? LIMIT 1", [today]);
      if (!review) {
        await safeSend(results, {
          category: "reviewReminders",
          eventKey: `daily-review-${today}`,
          title: "Take a moment for your daily review",
          body: "Record today's wins, challenges and priorities for tomorrow in FinTrack.",
          route: "/productivity/reviews",
          ttl: 12 * 60 * 60,
        });
      }
    } catch (error) { if (error?.code !== "ER_NO_SUCH_TABLE") throw error; }
  }

  if (weekdaySundayZero(today) === 0 && now.hour === 19 && now.minute < 10) {
    const weekStartDate = new Date(`${today}T00:00:00.000Z`);
    weekStartDate.setUTCDate(weekStartDate.getUTCDate() - 6);
    const weekStart = weekStartDate.toISOString().slice(0, 10);
    try {
      const [[review]] = await pool.query("SELECT id FROM ProductivityWeeklyReviews WHERE week_start = ? LIMIT 1", [weekStart]);
      if (!review) {
        await safeSend(results, {
          category: "reviewReminders",
          eventKey: `weekly-review-${weekStart}`,
          title: "Your weekly FinTrack review is ready",
          body: "Review this week's progress and set priorities for the week ahead.",
          route: "/productivity/reviews",
          ttl: 24 * 60 * 60,
        });
      }
    } catch (error) { if (error?.code !== "ER_NO_SUCH_TABLE") throw error; }
  }
};

/**
 * Called by an external scheduler every five minutes. Timed task/calendar
 * reminders use a 15-minute lead window; idempotency prevents duplicate sends.
 * Morning and evening digests run only during their configured Kigali windows.
 */
export const runScheduledAppNotifications = async (instant = new Date()) => {
  const now = getKigaliTime(instant);
  const results = [];

  await sendTimedTaskAndCalendarReminders(now, results);

  if (now.hour === 8 && now.minute < 10) {
    await sendMorningDigest(now, results);
    await sendBillsAndDebtReminders(now.dateString, results);
    await sendCountdownReminders(now.dateString, results);
    await sendMilestoneReminders(now.dateString, results);
    await sendExpectedIncomeReminders(now, results);
  }

  // Budget thresholds are checked every scheduler run, so a newly recorded
  // expense can trigger a push within the external scheduler's five-minute cadence.
  await sendBudgetThresholdReminder(now, results);
  await sendReviewReminders(now, results);
  return {
    runAtKigali: now.dateTimeString,
    checked: true,
    sent: results.reduce((sum, item) => sum + Number(item.sent || 0), 0),
    notifications: results,
  };
};
