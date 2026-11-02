import { pool } from "../../models/MonthlyBudget.js";
import { getKigaliDateRangeUtc, getKigaliDateString } from "../../utils/kigaliTime.js";
import { calculateGoalProgress } from "../../utils/productivityPlanningMetrics.js";

const toDate = (value) => value instanceof Date ? getKigaliDateString(value) : String(value).slice(0, 10);
const shiftDate = (value, amount) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};
const toNumber = (value) => Number(value || 0);
const byDate = (rows) => new Map(rows.map((row) => [toDate(row.metric_date), row]));

export const getProductivityInsights = async (startDate, endDate) => {
  const [startUtc, endUtc] = getKigaliDateRangeUtc(startDate, endDate);
  const today = getKigaliDateString();

  const [taskRows, completedTaskRows, habitRows, focusRows, dueTrendRows, completedTrendRows,
    habitTrendRows, focusTrendRows, goalRows, projectRows, reviewRows] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS due_tasks,
              SUM(status = 'completed') AS completed_due_tasks,
              SUM(status IN ('todo', 'in_progress')) AS pending_due_tasks,
              SUM(status = 'cancelled') AS cancelled_due_tasks,
              SUM(status IN ('todo', 'in_progress') AND due_date < ?) AS currently_overdue_due_tasks
         FROM ProductivityTasks
        WHERE due_date BETWEEN ? AND ? AND status <> 'cancelled'`,
      [today, startDate, endDate],
    ),
    pool.query(
      `SELECT COUNT(*) AS completed_tasks
         FROM ProductivityTasks
        WHERE status = 'completed' AND completed_at >= ? AND completed_at < ?`,
      [startUtc, endUtc],
    ),
    pool.query(
      `SELECT COUNT(*) AS logged_entries,
              SUM(is_completed = 1) AS completed_entries,
              COUNT(DISTINCT habit_id) AS tracked_habits
         FROM ProductivityHabitLogs WHERE log_date BETWEEN ? AND ?`,
      [startDate, endDate],
    ),
    pool.query(
      `SELECT COUNT(*) AS focus_sessions,
              SUM(status = 'completed') AS completed_focus_sessions,
              COALESCE(SUM(CASE WHEN status = 'completed' THEN actual_seconds ELSE 0 END), 0) AS focus_seconds,
              COALESCE(AVG(CASE WHEN status = 'completed' THEN actual_seconds END), 0) AS average_focus_seconds
         FROM ProductivityFocusSessions
        WHERE session_type = 'focus' AND started_at >= ? AND started_at < ?`,
      [startUtc, endUtc],
    ),
    pool.query(
      `SELECT due_date AS metric_date, COUNT(*) AS due_count,
              SUM(status = 'completed') AS completed_due_count
         FROM ProductivityTasks
        WHERE due_date BETWEEN ? AND ? AND status <> 'cancelled'
        GROUP BY due_date`,
      [startDate, endDate],
    ),
    pool.query(
      `SELECT DATE(DATE_ADD(completed_at, INTERVAL 2 HOUR)) AS metric_date, COUNT(*) AS completed_count
         FROM ProductivityTasks
        WHERE status = 'completed' AND completed_at >= ? AND completed_at < ?
        GROUP BY DATE(DATE_ADD(completed_at, INTERVAL 2 HOUR))`,
      [startUtc, endUtc],
    ),
    pool.query(
      `SELECT log_date AS metric_date, COUNT(*) AS logged_count, SUM(is_completed = 1) AS completed_count
         FROM ProductivityHabitLogs WHERE log_date BETWEEN ? AND ? GROUP BY log_date`,
      [startDate, endDate],
    ),
    pool.query(
      `SELECT DATE(DATE_ADD(started_at, INTERVAL 2 HOUR)) AS metric_date,
              COUNT(*) AS session_count,
              COALESCE(SUM(CASE WHEN status = 'completed' THEN actual_seconds ELSE 0 END), 0) AS focus_seconds
         FROM ProductivityFocusSessions
        WHERE session_type = 'focus' AND started_at >= ? AND started_at < ?
        GROUP BY DATE(DATE_ADD(started_at, INTERVAL 2 HOUR))`,
      [startUtc, endUtc],
    ),
    pool.query(
      `SELECT g.id, g.status, g.progress_mode, g.manual_progress,
              COALESCE(m.milestone_count, 0) AS milestone_count,
              COALESCE(m.completed_milestone_count, 0) AS completed_milestone_count,
              g.target_date, g.updated_at
         FROM ProductivityGoals g
         LEFT JOIN (
           SELECT goal_id, COUNT(*) AS milestone_count,
                  SUM(is_completed = 1) AS completed_milestone_count
             FROM ProductivityGoalMilestones GROUP BY goal_id
         ) m ON m.goal_id = g.id
        WHERE g.status <> 'archived'`,
    ),
    pool.query(
      `SELECT COUNT(*) AS active_projects,
              SUM(status = 'completed') AS completed_projects
         FROM ProductivityProjects WHERE status <> 'archived'`,
    ),
    pool.query(
      `SELECT
         (SELECT COUNT(*) FROM ProductivityDailyReviews WHERE review_date BETWEEN ? AND ?) AS daily_reviews,
         (SELECT COUNT(*) FROM ProductivityWeeklyReviews WHERE week_start <= ? AND week_end >= ?) AS weekly_reviews`,
      [startDate, endDate, endDate, startDate],
    ),
  ]);

  const task = taskRows[0][0] || {};
  const completedTask = completedTaskRows[0][0] || {};
  const habit = habitRows[0][0] || {};
  const focus = focusRows[0][0] || {};
  const project = projectRows[0][0] || {};
  const reviews = reviewRows[0][0] || {};
  const goals = goalRows[0].map((row) => ({
    status: row.status,
    targetDate: row.target_date ? toDate(row.target_date) : null,
    updatedAt: row.updated_at,
    progress: calculateGoalProgress({
      status: row.status,
      progressMode: row.progress_mode,
      manualProgress: row.manual_progress,
      milestoneCount: row.milestone_count,
      completedMilestoneCount: row.completed_milestone_count,
    }),
  }));
  const activeGoals = goals.filter((goal) => goal.status === "active");
  const averageGoalProgress = activeGoals.length
    ? Math.round(activeGoals.reduce((total, goal) => total + goal.progress, 0) / activeGoals.length)
    : null;

  const dueByDate = byDate(dueTrendRows[0]);
  const completedByDate = byDate(completedTrendRows[0]);
  const habitsByDate = byDate(habitTrendRows[0]);
  const focusByDate = byDate(focusTrendRows[0]);
  const trend = [];
  for (let cursor = startDate; cursor <= endDate; cursor = shiftDate(cursor, 1)) {
    const due = dueByDate.get(cursor) || {};
    const completed = completedByDate.get(cursor) || {};
    const habits = habitsByDate.get(cursor) || {};
    const sessions = focusByDate.get(cursor) || {};
    trend.push({
      date: cursor,
      dueTasks: toNumber(due.due_count),
      completedDueTasks: toNumber(due.completed_due_count),
      tasksCompleted: toNumber(completed.completed_count),
      habitEntries: toNumber(habits.logged_count),
      habitsCompleted: toNumber(habits.completed_count),
      focusSessions: toNumber(sessions.session_count),
      focusMinutes: Math.round(toNumber(sessions.focus_seconds) / 60),
    });
  }

  const dueTasks = toNumber(task.due_tasks);
  const completedDueTasks = toNumber(task.completed_due_tasks);
  const loggedHabitEntries = toNumber(habit.logged_entries);
  const completedHabitEntries = toNumber(habit.completed_entries);
  const focusSeconds = toNumber(focus.focus_seconds);

  return {
    startDate,
    endDate,
    generatedAt: new Date().toISOString(),
    metrics: {
      dueTasks,
      completedDueTasks,
      pendingDueTasks: toNumber(task.pending_due_tasks),
      currentlyOverdueDueTasks: toNumber(task.currently_overdue_due_tasks),
      dueTaskCompletionRate: dueTasks ? Math.round((completedDueTasks / dueTasks) * 100) : null,
      tasksCompletedInPeriod: toNumber(completedTask.completed_tasks),
      loggedHabitEntries,
      completedHabitEntries,
      habitLoggedEntryCompletionRate: loggedHabitEntries ? Math.round((completedHabitEntries / loggedHabitEntries) * 100) : null,
      trackedHabits: toNumber(habit.tracked_habits),
      completedFocusSessions: toNumber(focus.completed_focus_sessions),
      focusMinutes: Math.round(focusSeconds / 60),
      averageFocusMinutes: Math.round(toNumber(focus.average_focus_seconds) / 60),
      activeGoals: activeGoals.length,
      averageActiveGoalProgress: averageGoalProgress,
      goalsWithTargetInPeriod: goals.filter((goal) => goal.status === "active" && goal.targetDate && goal.targetDate >= startDate && goal.targetDate <= endDate).length,
      activeProjects: toNumber(project.active_projects) - toNumber(project.completed_projects),
      completedProjects: toNumber(project.completed_projects),
      dailyReviewsSaved: toNumber(reviews.daily_reviews),
      weeklyReviewsOverlappingPeriod: toNumber(reviews.weekly_reviews),
    },
    trend,
    definitions: {
      dueTaskCompletionRate: "Completed tasks divided by non-cancelled tasks whose due date falls inside the selected period. Tasks without a due date are excluded.",
      tasksCompletedInPeriod: "Tasks with status completed and a completed_at timestamp inside the selected Kigali date range.",
      habitLoggedEntryCompletionRate: "Completed habit logs divided by all saved habit logs in the selected period. Unlogged scheduled days are not included.",
      focusMinutes: "Sum of actual_seconds for completed focus sessions whose start time falls inside the selected period, rounded to minutes.",
      activeGoalProgress: "Average progress of goals currently marked active, using each goal's configured progress mode. This is a current snapshot, not historical progress.",
      overdueTasks: "Tasks with a due date before today's Kigali date that are still todo or in progress, limited to the selected due-date period.",
      reviews: "Counts of saved review records, not a rating of productivity or completion quality.",
    },
  };
};
