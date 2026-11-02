import { pool } from "../../models/MonthlyBudget.js";
import { getKigaliDateString, getKigaliTime } from "../../utils/kigaliTime.js";
import { getActiveProject } from "./productivityProjectsService.js";

const mapTask = (row) => ({
  id: Number(row.id),
  projectId: row.project_id == null ? null : Number(row.project_id),
  projectName: row.project_name || null,
  title: row.title,
  description: row.description || "",
  status: row.status,
  priority: row.priority,
  dueDate: row.due_date || null,
  dueTime: row.due_time || null,
  scheduledDate: row.scheduled_date || null,
  scheduledStartTime: row.scheduled_start_time || null,
  estimatedMinutes: row.estimated_minutes == null ? null : Number(row.estimated_minutes),
  isImportant: Boolean(row.is_important),
  isUrgent: Boolean(row.is_urgent),
  sortOrder: Number(row.sort_order || 0),
  completedAt: row.completed_at || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const TASK_SELECT = `SELECT t.id, t.project_id, p.name AS project_name, t.title, t.description,
                            t.status, t.priority, t.due_date, t.due_time,
                            t.scheduled_date, t.scheduled_start_time, t.estimated_minutes,
                            t.is_important, t.is_urgent, t.sort_order, t.completed_at,
                            t.created_at, t.updated_at
                       FROM ProductivityTasks t
                       LEFT JOIN ProductivityProjects p ON p.id = t.project_id`;

const TASK_COLUMNS = Object.freeze({
  title: "title",
  description: "description",
  projectId: "project_id",
  status: "status",
  priority: "priority",
  dueDate: "due_date",
  dueTime: "due_time",
  scheduledDate: "scheduled_date",
  scheduledStartTime: "scheduled_start_time",
  estimatedMinutes: "estimated_minutes",
  isImportant: "is_important",
  isUrgent: "is_urgent",
  sortOrder: "sort_order",
});

const valuesForSql = (values) => Object.entries(values).map(([key, value]) => {
  if (key === "isImportant" || key === "isUrgent") return value ? 1 : 0;
  return value;
});

const assertProjectAvailable = async (projectId) => {
  if (projectId == null) return;
  const project = await getActiveProject(projectId);
  if (!project) {
    const error = new Error("The selected project does not exist.");
    error.code = "PRODUCTIVITY_PROJECT_NOT_FOUND";
    throw error;
  }
  if (project.status !== "active") {
    const error = new Error("Tasks can only be assigned to active projects.");
    error.code = "PRODUCTIVITY_PROJECT_NOT_ACTIVE";
    throw error;
  }
};

export const listTasks = async (filters = {}) => {
  const where = [];
  const params = [];
  if (filters.status) { where.push("t.status = ?"); params.push(filters.status); }
  else if (!filters.includeCompleted) where.push("t.status NOT IN ('completed', 'cancelled')");
  if (filters.priority) { where.push("t.priority = ?"); params.push(filters.priority); }
  if (filters.projectId) { where.push("t.project_id = ?"); params.push(filters.projectId); }
  if (filters.date) {
    where.push("(t.due_date = ? OR t.scheduled_date = ?)");
    params.push(filters.date, filters.date);
  }
  if (filters.search) {
    where.push("(t.title LIKE ? ESCAPE '\\\\' OR COALESCE(t.description, '') LIKE ? ESCAPE '\\\\')");
    const escaped = `%${String(filters.search).replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
    params.push(escaped, escaped);
  }
  const sqlWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `${TASK_SELECT} ${sqlWhere}
      ORDER BY FIELD(t.status, 'in_progress', 'todo', 'completed', 'cancelled'),
               FIELD(t.priority, 'high', 'medium', 'low', 'none'),
               t.due_date IS NULL, t.due_date ASC,
               t.scheduled_date IS NULL, t.scheduled_date ASC,
               t.sort_order ASC, t.created_at DESC
      LIMIT 500`,
    params,
  );
  return rows.map(mapTask);
};

export const getTaskById = async (id) => {
  const [rows] = await pool.query(`${TASK_SELECT} WHERE t.id = ? LIMIT 1`, [id]);
  if (!rows[0]) return null;
  const task = mapTask(rows[0]);
  task.subtasks = await listSubtasks(id);
  return task;
};

export const createTask = async (values) => {
  await assertProjectAvailable(values.projectId);
  const [result] = await pool.query(
    `INSERT INTO ProductivityTasks (
       project_id, title, description, status, priority, due_date, due_time,
       scheduled_date, scheduled_start_time, estimated_minutes,
       is_important, is_urgent, sort_order, completed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
    [
      values.projectId, values.title, values.description, values.status, values.priority,
      values.dueDate, values.dueTime, values.scheduledDate, values.scheduledStartTime,
      values.estimatedMinutes, values.isImportant ? 1 : 0, values.isUrgent ? 1 : 0,
      values.sortOrder, values.status,
    ],
  );
  return getTaskById(result.insertId);
};

export const updateTask = async (id, values) => {
  if (Object.hasOwn(values, "projectId")) await assertProjectAvailable(values.projectId);
  const entries = Object.entries(values);
  if (entries.length === 0) return getTaskById(id);
  const assignments = entries.map(([key]) => `${TASK_COLUMNS[key]} = ?`);
  const params = valuesForSql(values);
  if (Object.hasOwn(values, "status")) {
    assignments.push("completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE NULL END");
    params.push(values.status);
  }
  await pool.query(
    `UPDATE ProductivityTasks SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [...params, id],
  );
  return getTaskById(id);
};

export const deleteTask = async (id) => {
  const [result] = await pool.query("DELETE FROM ProductivityTasks WHERE id = ?", [id]);
  return result.affectedRows > 0;
};

export const listSubtasks = async (taskId) => {
  const [rows] = await pool.query(
    `SELECT id, task_id, title, is_completed, sort_order, completed_at, created_at, updated_at
       FROM ProductivityTaskSubtasks WHERE task_id = ? ORDER BY sort_order ASC, id ASC`,
    [taskId],
  );
  return rows.map((row) => ({
    id: Number(row.id), taskId: Number(row.task_id), title: row.title,
    isCompleted: Boolean(row.is_completed), sortOrder: Number(row.sort_order),
    completedAt: row.completed_at, createdAt: row.created_at, updatedAt: row.updated_at,
  }));
};

export const createSubtask = async (taskId, values) => {
  const [taskRows] = await pool.query("SELECT id FROM ProductivityTasks WHERE id = ? LIMIT 1", [taskId]);
  if (!taskRows[0]) return null;
  const [result] = await pool.query(
    `INSERT INTO ProductivityTaskSubtasks (task_id, title, is_completed, sort_order, completed_at)
     VALUES (?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END)`,
    [taskId, values.title, values.isCompleted ? 1 : 0, values.sortOrder, values.isCompleted ? 1 : 0],
  );
  const [rows] = await pool.query("SELECT id, task_id, title, is_completed, sort_order, completed_at FROM ProductivityTaskSubtasks WHERE id = ?", [result.insertId]);
  const row = rows[0];
  return { id: Number(row.id), taskId: Number(row.task_id), title: row.title, isCompleted: Boolean(row.is_completed), sortOrder: Number(row.sort_order), completedAt: row.completed_at };
};

export const updateSubtask = async (id, values) => {
  const columns = { title: "title", isCompleted: "is_completed", sortOrder: "sort_order" };
  const entries = Object.entries(values);
  if (!entries.length) return null;
  const sets = entries.map(([key]) => `${columns[key]} = ?`);
  const params = entries.map(([key, value]) => key === "isCompleted" ? (value ? 1 : 0) : value);
  if (Object.hasOwn(values, "isCompleted")) {
    sets.push("completed_at = CASE WHEN ? = 1 THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE NULL END");
    params.push(values.isCompleted ? 1 : 0);
  }
  await pool.query(`UPDATE ProductivityTaskSubtasks SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...params, id]);
  const [rows] = await pool.query("SELECT id, task_id, title, is_completed, sort_order, completed_at FROM ProductivityTaskSubtasks WHERE id = ?", [id]);
  const row = rows[0];
  return row ? { id: Number(row.id), taskId: Number(row.task_id), title: row.title, isCompleted: Boolean(row.is_completed), sortOrder: Number(row.sort_order), completedAt: row.completed_at } : null;
};

export const deleteSubtask = async (id) => {
  const [result] = await pool.query("DELETE FROM ProductivityTaskSubtasks WHERE id = ?", [id]);
  return result.affectedRows > 0;
};

export const getMyDay = async (date = getKigaliDateString()) => {
  const [rows] = await pool.query(
    `${TASK_SELECT}
      WHERE (
        (t.status NOT IN ('completed', 'cancelled') AND
          (t.due_date < ? OR t.due_date = ? OR t.scheduled_date = ?))
        OR (t.status = 'completed' AND DATE(DATE_ADD(t.completed_at, INTERVAL 2 HOUR)) = ?)
      )
      ORDER BY
        CASE
          WHEN t.status = 'completed' THEN 3
          WHEN t.due_date < ? THEN 0
          ELSE 1
        END,
        t.due_time IS NULL, t.due_time ASC,
        t.priority DESC, t.sort_order ASC, t.id ASC`,
    [date, date, date, date, date],
  );
  const tasks = rows.map(mapTask);
  const overdue = tasks.filter((task) => task.status !== "completed" && task.status !== "cancelled" && task.dueDate && task.dueDate < date);
  const completed = tasks.filter((task) => task.status === "completed");
  const today = tasks.filter((task) => task.status !== "completed" && task.status !== "cancelled" && !overdue.includes(task));
  return { date, overdue, today, completed, totals: { overdue: overdue.length, today: today.length, completed: completed.length } };
};

export const getProductivitySummary = async () => {
  const today = getKigaliDateString();
  const [rows] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM ProductivityTasks WHERE status IN ('todo', 'in_progress')) AS open_tasks,
       (SELECT COUNT(*) FROM ProductivityTasks WHERE status IN ('todo', 'in_progress') AND due_date < ?) AS overdue_tasks,
       (SELECT COUNT(*) FROM ProductivityTasks WHERE status IN ('todo', 'in_progress') AND (due_date = ? OR scheduled_date = ?)) AS due_today_tasks,
       (SELECT COUNT(*) FROM ProductivityProjects WHERE status = 'active') AS active_projects,
       (SELECT COUNT(*) FROM ProductivityTasks WHERE status = 'completed') AS completed_tasks`,
    [today, today, today],
  );
  const row = rows[0] || {};
  return {
    openTasks: Number(row.open_tasks || 0),
    overdueTasks: Number(row.overdue_tasks || 0),
    dueTodayTasks: Number(row.due_today_tasks || 0),
    activeProjects: Number(row.active_projects || 0),
    completedTasks: Number(row.completed_tasks || 0),
    asOfDate: getKigaliTime().dateString,
  };
};
