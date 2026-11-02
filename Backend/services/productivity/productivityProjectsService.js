import { pool } from "../../models/MonthlyBudget.js";

const mapProject = (row) => ({
  id: Number(row.id),
  name: row.name,
  description: row.description || "",
  color: row.color,
  status: row.status,
  targetDate: row.target_date || null,
  taskCount: Number(row.task_count || 0),
  completedTaskCount: Number(row.completed_task_count || 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listProjects = async ({ includeArchived = false } = {}) => {
  const where = includeArchived ? "" : "WHERE p.status <> 'archived'";
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.description, p.color, p.status, p.target_date,
            p.created_at, p.updated_at,
            COALESCE(t.task_count, 0) AS task_count,
            COALESCE(t.completed_task_count, 0) AS completed_task_count
       FROM ProductivityProjects p
       LEFT JOIN (
         SELECT project_id,
                COUNT(*) AS task_count,
                SUM(status = 'completed') AS completed_task_count
           FROM ProductivityTasks
          WHERE status <> 'cancelled'
          GROUP BY project_id
       ) t ON t.project_id = p.id
       ${where}
      ORDER BY FIELD(p.status, 'active', 'completed', 'archived'),
               p.target_date IS NULL, p.target_date ASC, p.name ASC`,
  );
  return rows.map(mapProject);
};

export const getProjectById = async (id) => {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.description, p.color, p.status, p.target_date,
            p.created_at, p.updated_at,
            (SELECT COUNT(*) FROM ProductivityTasks t WHERE t.project_id = p.id AND t.status <> 'cancelled') AS task_count,
            (SELECT COUNT(*) FROM ProductivityTasks t WHERE t.project_id = p.id AND t.status = 'completed') AS completed_task_count
       FROM ProductivityProjects p WHERE p.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapProject(rows[0]) : null;
};

export const createProject = async (values) => {
  const [result] = await pool.query(
    `INSERT INTO ProductivityProjects (name, description, color, status, target_date)
     VALUES (?, ?, ?, ?, ?)`,
    [values.name, values.description, values.color, values.status, values.targetDate],
  );
  return getProjectById(result.insertId);
};

const PROJECT_COLUMNS = Object.freeze({
  name: "name",
  description: "description",
  color: "color",
  status: "status",
  targetDate: "target_date",
});

export const updateProject = async (id, values) => {
  const entries = Object.entries(values);
  if (entries.length === 0) return getProjectById(id);
  const assignments = entries.map(([key]) => `${PROJECT_COLUMNS[key]} = ?`);
  const parameters = entries.map(([, value]) => value);
  await pool.query(
    `UPDATE ProductivityProjects SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [...parameters, id],
  );
  return getProjectById(id);
};

export const archiveProject = async (id) => {
  const [result] = await pool.query(
    `UPDATE ProductivityProjects SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status <> 'archived'`,
    [id],
  );
  return result.affectedRows > 0;
};

export const getActiveProject = async (id) => {
  const [rows] = await pool.query(
    "SELECT id, status FROM ProductivityProjects WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] || null;
};
