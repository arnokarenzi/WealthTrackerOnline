import { pool } from "../../models/MonthlyBudget.js";
import { getKigaliDateString, getKigaliDateRangeUtc } from "../../utils/kigaliTime.js";

const toUtcIso = (value) => value instanceof Date
  ? value.toISOString()
  : `${String(value).replace(" ", "T")}Z`;

const mapSession = (row) => ({
  id: Number(row.id),
  sessionType: row.session_type,
  status: row.status,
  taskId: row.task_id == null ? null : Number(row.task_id),
  taskTitle: row.task_title || null,
  plannedMinutes: Number(row.planned_minutes),
  actualSeconds: Number(row.actual_seconds),
  startedAt: toUtcIso(row.started_at),
  endedAt: toUtcIso(row.ended_at),
  notes: row.notes || "",
  createdAt: row.created_at,
});

export const createFocusSession = async (values) => {
  if (values.taskId != null) {
    const [tasks] = await pool.query("SELECT id FROM ProductivityTasks WHERE id = ? LIMIT 1", [values.taskId]);
    if (!tasks[0]) {
      const error = new Error("The selected task does not exist.");
      error.code = "PRODUCTIVITY_TASK_NOT_FOUND";
      throw error;
    }
  }
  const [result] = await pool.query(
    `INSERT INTO ProductivityFocusSessions
      (session_type, status, task_id, planned_minutes, actual_seconds, started_at, ended_at, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [values.sessionType, values.status, values.taskId, values.plannedMinutes, values.actualSeconds, values.startedAt, values.endedAt, values.notes],
  );
  const [rows] = await pool.query(
    `SELECT f.*, t.title AS task_title FROM ProductivityFocusSessions f
      LEFT JOIN ProductivityTasks t ON t.id = f.task_id WHERE f.id = ? LIMIT 1`, [result.insertId],
  );
  return mapSession(rows[0]);
};

export const listFocusSessions = async ({ startDate, endDate, limit = 50 }) => {
  const [startUtc, endUtc] = getKigaliDateRangeUtc(startDate, endDate);
  const [rows] = await pool.query(
    `SELECT f.*, t.title AS task_title FROM ProductivityFocusSessions f
      LEFT JOIN ProductivityTasks t ON t.id = f.task_id
     WHERE f.started_at >= ? AND f.started_at < ?
     ORDER BY f.started_at DESC, f.id DESC LIMIT ?`,
    [startUtc, endUtc, limit],
  );
  return rows.map(mapSession);
};

export const getFocusSummary = async (date = getKigaliDateString()) => {
  const [startUtc, endUtc] = getKigaliDateRangeUtc(date, date);
  const [rows] = await pool.query(
    `SELECT
       COUNT(*) AS session_count,
       SUM(session_type = 'focus' AND status = 'completed') AS completed_focus_sessions,
       SUM(session_type = 'focus' AND status = 'cancelled') AS cancelled_focus_sessions,
       COALESCE(SUM(CASE WHEN session_type = 'focus' AND status = 'completed' THEN actual_seconds ELSE 0 END), 0) AS focus_seconds,
       COALESCE(SUM(CASE WHEN session_type <> 'focus' AND status = 'completed' THEN actual_seconds ELSE 0 END), 0) AS break_seconds
     FROM ProductivityFocusSessions WHERE started_at >= ? AND started_at < ?`,
    [startUtc, endUtc],
  );
  const row = rows[0];
  return {
    date,
    sessionCount: Number(row.session_count || 0),
    completedFocusSessions: Number(row.completed_focus_sessions || 0),
    cancelledFocusSessions: Number(row.cancelled_focus_sessions || 0),
    focusSeconds: Number(row.focus_seconds || 0),
    focusMinutes: Math.round(Number(row.focus_seconds || 0) / 60),
    breakSeconds: Number(row.break_seconds || 0),
  };
};
