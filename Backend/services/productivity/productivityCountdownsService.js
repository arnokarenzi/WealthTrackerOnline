import { pool } from "../../models/MonthlyBudget.js";
import { getKigaliDateString } from "../../utils/kigaliTime.js";
import { differenceInCalendarDays, getNextCountdownDate } from "../../utils/productivityPlanningMetrics.js";

const mapCountdown = (row, today) => {
  const nextEventDate = getNextCountdownDate(row.event_date, row.recurrence, today);
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description || "",
    eventDate: row.event_date,
    nextEventDate,
    eventTime: row.event_time || null,
    category: row.category || "",
    color: row.color,
    recurrence: row.recurrence,
    status: row.status,
    daysRemaining: differenceInCalendarDays(today, nextEventDate),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const listCountdowns = async ({ includeArchived = false, search = "" } = {}) => {
  const conditions = [];
  const params = [];
  if (!includeArchived) conditions.push("status = 'active'");
  if (search) {
    conditions.push("(title LIKE ? OR COALESCE(description, '') LIKE ? OR COALESCE(category, '') LIKE ?)");
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `SELECT id, title, description, event_date, event_time, category, color, recurrence,
            status, created_at, updated_at
       FROM ProductivityCountdowns ${where}
      ORDER BY status ASC, event_date ASC, title ASC`,
    params,
  );
  const today = getKigaliDateString();
  return rows.map((row) => mapCountdown(row, today)).sort((a, b) => {
    const aPast = a.daysRemaining < 0;
    const bPast = b.daysRemaining < 0;
    if (aPast !== bPast) return aPast ? 1 : -1;
    const dayOrder = aPast ? b.daysRemaining - a.daysRemaining : a.daysRemaining - b.daysRemaining;
    return dayOrder || a.title.localeCompare(b.title);
  });
};

export const getCountdownById = async (id) => {
  const [rows] = await pool.query(
    `SELECT id, title, description, event_date, event_time, category, color, recurrence,
            status, created_at, updated_at
       FROM ProductivityCountdowns WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapCountdown(rows[0], getKigaliDateString()) : null;
};

export const createCountdown = async (values) => {
  const [result] = await pool.query(
    `INSERT INTO ProductivityCountdowns (title, description, event_date, event_time, category, color, recurrence, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [values.title, values.description, values.eventDate, values.eventTime, values.category,
      values.color, values.recurrence, values.status],
  );
  return getCountdownById(result.insertId);
};

const COUNTDOWN_COLUMNS = Object.freeze({
  title: "title", description: "description", eventDate: "event_date", eventTime: "event_time",
  category: "category", color: "color", recurrence: "recurrence", status: "status",
});

export const updateCountdown = async (id, values) => {
  const entries = Object.entries(values).map(([key, value]) => [COUNTDOWN_COLUMNS[key], value]);
  if (entries.length) {
    const assignments = entries.map(([column]) => `${column} = ?`);
    await pool.query(
      `UPDATE ProductivityCountdowns SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...entries.map(([, value]) => value), id],
    );
  }
  return getCountdownById(id);
};

export const archiveCountdown = async (id) => {
  const [result] = await pool.query(
    "UPDATE ProductivityCountdowns SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status <> 'archived'",
    [id],
  );
  return result.affectedRows > 0;
};
