import { pool } from "../../models/MonthlyBudget.js";
import { calculateGoalProgress } from "../../utils/productivityPlanningMetrics.js";

const mapMilestone = (row) => ({
  id: Number(row.id),
  goalId: Number(row.goal_id),
  title: row.title,
  description: row.description || "",
  dueDate: row.due_date || null,
  isCompleted: Boolean(row.is_completed),
  sortOrder: Number(row.sort_order || 0),
  completedAt: row.completed_at || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapGoal = (row) => {
  const milestoneCount = Number(row.milestone_count || 0);
  const completedMilestoneCount = Number(row.completed_milestone_count || 0);
  const progress = calculateGoalProgress({
    status: row.status,
    progressMode: row.progress_mode,
    manualProgress: row.manual_progress,
    milestoneCount,
    completedMilestoneCount,
  });
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description || "",
    category: row.category || "",
    status: row.status,
    startDate: row.start_date || null,
    targetDate: row.target_date || null,
    progressMode: row.progress_mode,
    manualProgress: Number(row.manual_progress || 0),
    progress,
    milestoneCount,
    completedMilestoneCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const GOAL_SELECT = `SELECT g.id, g.name, g.description, g.category, g.status, g.start_date,
                            g.target_date, g.progress_mode, g.manual_progress, g.created_at,
                            g.updated_at, COALESCE(m.milestone_count, 0) AS milestone_count,
                            COALESCE(m.completed_milestone_count, 0) AS completed_milestone_count
                       FROM ProductivityGoals g
                       LEFT JOIN (
                         SELECT goal_id, COUNT(*) AS milestone_count,
                                SUM(is_completed = 1) AS completed_milestone_count
                           FROM ProductivityGoalMilestones GROUP BY goal_id
                       ) m ON m.goal_id = g.id`;

const GOAL_COLUMNS = Object.freeze({
  name: "name", description: "description", category: "category", status: "status",
  startDate: "start_date", targetDate: "target_date", progressMode: "progress_mode",
  manualProgress: "manual_progress",
});

const mapGoalValues = (values) => Object.entries(values).map(([key, value]) => [
  GOAL_COLUMNS[key], value,
]);

export const listGoals = async ({ includeArchived = false, search = "" } = {}) => {
  const conditions = [];
  const params = [];
  if (!includeArchived) conditions.push("g.status <> 'archived'");
  if (search) {
    conditions.push("(g.name LIKE ? OR COALESCE(g.description, '') LIKE ? OR COALESCE(g.category, '') LIKE ?)");
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `${GOAL_SELECT} ${where} ORDER BY FIELD(g.status, 'active', 'completed', 'archived'),
       g.target_date IS NULL, g.target_date ASC, g.updated_at DESC`,
    params,
  );
  return rows.map(mapGoal);
};

export const getGoalById = async (id) => {
  const [rows] = await pool.query(`${GOAL_SELECT} WHERE g.id = ? LIMIT 1`, [id]);
  return rows[0] ? mapGoal(rows[0]) : null;
};

export const createGoal = async (values) => {
  const [result] = await pool.query(
    `INSERT INTO ProductivityGoals (name, description, category, status, start_date, target_date,
                                    progress_mode, manual_progress)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [values.name, values.description, values.category, values.status, values.startDate,
      values.targetDate, values.progressMode, values.manualProgress],
  );
  return getGoalById(result.insertId);
};

export const updateGoal = async (id, values) => {
  const entries = mapGoalValues(values);
  if (entries.length) {
    const assignments = entries.map(([column]) => `${column} = ?`);
    await pool.query(
      `UPDATE ProductivityGoals SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...entries.map(([, value]) => value), id],
    );
  }
  return getGoalById(id);
};

export const archiveGoal = async (id) => {
  const [result] = await pool.query(
    "UPDATE ProductivityGoals SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status <> 'archived'",
    [id],
  );
  return result.affectedRows > 0;
};

export const listGoalMilestones = async (goalId) => {
  const [rows] = await pool.query(
    `SELECT id, goal_id, title, description, due_date, is_completed, sort_order,
            completed_at, created_at, updated_at
       FROM ProductivityGoalMilestones WHERE goal_id = ?
      ORDER BY is_completed ASC, due_date IS NULL, due_date ASC, sort_order ASC, id ASC`,
    [goalId],
  );
  return rows.map(mapMilestone);
};

export const getMilestoneById = async (id) => {
  const [rows] = await pool.query(
    `SELECT id, goal_id, title, description, due_date, is_completed, sort_order,
            completed_at, created_at, updated_at
       FROM ProductivityGoalMilestones WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapMilestone(rows[0]) : null;
};

export const createGoalMilestone = async (goalId, values) => {
  const goal = await getGoalById(goalId);
  if (!goal || goal.status !== "active") return null;
  const [result] = await pool.query(
    `INSERT INTO ProductivityGoalMilestones
      (goal_id, title, description, due_date, is_completed, sort_order, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)` ,
    [goalId, values.title, values.description, values.dueDate, values.isCompleted ? 1 : 0,
      values.sortOrder, values.isCompleted ? new Date() : null],
  );
  return getMilestoneById(result.insertId);
};

const MILESTONE_COLUMNS = Object.freeze({
  title: "title", description: "description", dueDate: "due_date", isCompleted: "is_completed", sortOrder: "sort_order",
});

export const updateGoalMilestone = async (id, values) => {
  const entries = Object.entries(values).map(([key, value]) => [MILESTONE_COLUMNS[key], key === "isCompleted" ? (value ? 1 : 0) : value]);
  if (values.isCompleted === true) entries.push(["completed_at", new Date()]);
  else if (values.isCompleted === false) entries.push(["completed_at", null]);
  if (entries.length) {
    const assignments = entries.map(([column]) => `${column} = ?`);
    await pool.query(
      `UPDATE ProductivityGoalMilestones SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...entries.map(([, value]) => value), id],
    );
  }
  return getMilestoneById(id);
};

export const deleteGoalMilestone = async (id) => {
  const [result] = await pool.query("DELETE FROM ProductivityGoalMilestones WHERE id = ?", [id]);
  return result.affectedRows > 0;
};
