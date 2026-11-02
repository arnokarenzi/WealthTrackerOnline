import { pool } from "../../models/MonthlyBudget.js";

const mapEvent = (row) => ({
  id: Number(row.id),
  title: row.title,
  description: row.description || "",
  eventDate: row.event_date,
  startTime: row.start_time || null,
  endTime: row.end_time || null,
  isAllDay: Boolean(row.is_all_day),
  color: row.color,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const EVENT_SELECT = `SELECT id, title, description,
                             DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date,
                             TIME_FORMAT(start_time, '%H:%i:%s') AS start_time,
                             TIME_FORMAT(end_time, '%H:%i:%s') AS end_time,
                             is_all_day, color, created_at, updated_at
                        FROM ProductivityCalendarEvents`;

export const listCalendarEvents = async (startDate, endDate) => {
  const [rows] = await pool.query(
    `${EVENT_SELECT}
      WHERE event_date BETWEEN ? AND ?
      ORDER BY event_date ASC, is_all_day DESC, start_time IS NULL DESC, start_time ASC, title ASC`,
    [startDate, endDate],
  );
  return rows.map(mapEvent);
};

export const getCalendarEventById = async (id) => {
  const [rows] = await pool.query(`${EVENT_SELECT} WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ? mapEvent(rows[0]) : null;
};

export const createCalendarEvent = async (values) => {
  const [result] = await pool.query(
    `INSERT INTO ProductivityCalendarEvents
       (title, description, event_date, start_time, end_time, is_all_day, color)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [values.title, values.description, values.eventDate, values.startTime,
      values.endTime, values.isAllDay ? 1 : 0, values.color],
  );
  return getCalendarEventById(result.insertId);
};

const EVENT_COLUMNS = Object.freeze({
  title: "title",
  description: "description",
  eventDate: "event_date",
  startTime: "start_time",
  endTime: "end_time",
  isAllDay: "is_all_day",
  color: "color",
});

export const updateCalendarEvent = async (id, values) => {
  const entries = Object.entries(values);
  if (!entries.length) return getCalendarEventById(id);
  const assignments = entries.map(([key]) => `${EVENT_COLUMNS[key]} = ?`);
  const parameters = entries.map(([key, value]) => key === "isAllDay" ? (value ? 1 : 0) : value);
  if (values.isAllDay === true) {
    if (!Object.hasOwn(values, "startTime")) {
      assignments.push("start_time = NULL");
    }
    if (!Object.hasOwn(values, "endTime")) {
      assignments.push("end_time = NULL");
    }
  }
  await pool.query(
    `UPDATE ProductivityCalendarEvents
        SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [...parameters, id],
  );
  return getCalendarEventById(id);
};

export const deleteCalendarEvent = async (id) => {
  const [result] = await pool.query("DELETE FROM ProductivityCalendarEvents WHERE id = ?", [id]);
  return result.affectedRows > 0;
};

export const listCalendarTasks = async (startDate, endDate) => {
  const [rows] = await pool.query(
    `SELECT t.id, t.project_id, p.name AS project_name, t.title, t.description,
            t.status, t.priority,
            DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
            TIME_FORMAT(t.due_time, '%H:%i:%s') AS due_time,
            DATE_FORMAT(t.scheduled_date, '%Y-%m-%d') AS scheduled_date,
            TIME_FORMAT(t.scheduled_start_time, '%H:%i:%s') AS scheduled_start_time,
            t.estimated_minutes, t.is_important, t.is_urgent, t.sort_order,
            t.completed_at, t.created_at, t.updated_at
       FROM ProductivityTasks t
       LEFT JOIN ProductivityProjects p ON p.id = t.project_id
      WHERE t.status <> 'cancelled'
        AND (t.scheduled_date BETWEEN ? AND ? OR t.due_date BETWEEN ? AND ?)
      ORDER BY COALESCE(t.scheduled_date, t.due_date) ASC,
               COALESCE(t.scheduled_start_time, t.due_time) IS NULL,
               COALESCE(t.scheduled_start_time, t.due_time) ASC,
               t.sort_order ASC, t.title ASC`,
    [startDate, endDate, startDate, endDate],
  );
  return rows.map((row) => ({
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
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const getCalendarRange = async (startDate, endDate) => {
  const [events, tasks] = await Promise.all([
    listCalendarEvents(startDate, endDate),
    listCalendarTasks(startDate, endDate),
  ]);
  return { startDate, endDate, events, tasks };
};
