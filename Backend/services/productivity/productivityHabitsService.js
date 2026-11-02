import { pool } from "../../models/MonthlyBudget.js";
import { getKigaliDateString } from "../../utils/kigaliTime.js";
import { calculateHabitMetrics } from "../../utils/productivityHabitMetrics.js";

const shiftDate = (dateString, offset) => {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const storedDate = (value) => value instanceof Date
  ? getKigaliDateString(value)
  : String(value).slice(0, 10);
const parseDays = (value) => value
  ? String(value).split(",").map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  : [];

const mapHabit = (row, logs = [], today = getKigaliDateString()) => ({
  id: Number(row.id),
  name: row.name,
  description: row.description || "",
  category: row.category || "",
  frequency: row.frequency,
  daysOfWeek: parseDays(row.days_of_week),
  color: row.color,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  ...calculateHabitMetrics(row, logs, today),
});

const HABIT_COLUMNS = Object.freeze({
  name: "name", description: "description", category: "category",
  frequency: "frequency", daysOfWeek: "days_of_week", color: "color", status: "status",
});
const valuesForSql = (values) => Object.entries(values).map(([key, value]) =>
  key === "daysOfWeek" ? (value.length ? value.join(",") : null) : value,
);

export const listHabits = async ({ includeArchived = false } = {}) => {
  const today = getKigaliDateString();
  const where = includeArchived ? "" : "WHERE status = 'active'";
  const [habits] = await pool.query(
    `SELECT id, name, description, category, frequency, days_of_week, color, status, created_at, updated_at
       FROM ProductivityHabits ${where}
      ORDER BY FIELD(status, 'active', 'archived'), name ASC`,
  );
  if (!habits.length) return [];
  const oldestCreatedDate = habits
    .map((habit) => storedDate(habit.created_at))
    .sort()[0] || today;
  const ids = habits.map((habit) => Number(habit.id));
  const placeholders = ids.map(() => "?").join(",");
  const [logs] = await pool.query(
    `SELECT habit_id, log_date, is_completed, notes
       FROM ProductivityHabitLogs
      WHERE habit_id IN (${placeholders}) AND log_date >= ? AND log_date <= ?
      ORDER BY log_date DESC`,
    [...ids, oldestCreatedDate, today],
  );
  const grouped = new Map(ids.map((id) => [id, []]));
  for (const log of logs) grouped.get(Number(log.habit_id))?.push(log);
  return habits.map((habit) => mapHabit(habit, grouped.get(Number(habit.id)) || [], today));
};

export const getHabitById = async (id) => {
  const [rows] = await pool.query(
    `SELECT id, name, description, category, frequency, days_of_week, color, status, created_at, updated_at
       FROM ProductivityHabits WHERE id = ? LIMIT 1`, [id],
  );
  if (!rows[0]) return null;
  const today = getKigaliDateString();
  const [logs] = await pool.query(
    `SELECT habit_id, log_date, is_completed, notes FROM ProductivityHabitLogs
      WHERE habit_id = ? AND log_date >= ? AND log_date <= ? ORDER BY log_date DESC`,
    [id, storedDate(rows[0].created_at), today],
  );
  return mapHabit(rows[0], logs, today);
};

export const createHabit = async (values) => {
  const [result] = await pool.query(
    `INSERT INTO ProductivityHabits (name, description, category, frequency, days_of_week, color, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
    [values.name, values.description, values.category, values.frequency, values.daysOfWeek.length ? values.daysOfWeek.join(",") : null, values.color],
  );
  return getHabitById(result.insertId);
};

export const updateHabit = async (id, values) => {
  const entries = Object.entries(values);
  if (!entries.length) return getHabitById(id);
  const assignments = entries.map(([key]) => `${HABIT_COLUMNS[key]} = ?`);
  await pool.query(
    `UPDATE ProductivityHabits SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [...valuesForSql(values), id],
  );
  return getHabitById(id);
};

export const archiveHabit = async (id) => {
  const [result] = await pool.query(
    `UPDATE ProductivityHabits SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status <> 'archived'`,
    [id],
  );
  return result.affectedRows > 0;
};

export const listHabitLogs = async (habitId, startDate, endDate) => {
  const [habits] = await pool.query("SELECT id FROM ProductivityHabits WHERE id = ? LIMIT 1", [habitId]);
  if (!habits[0]) return null;
  const [rows] = await pool.query(
    `SELECT id, habit_id, log_date, is_completed, notes, created_at, updated_at
       FROM ProductivityHabitLogs WHERE habit_id = ? AND log_date BETWEEN ? AND ?
      ORDER BY log_date DESC`, [habitId, startDate, endDate],
  );
  return rows.map((row) => ({
    id: Number(row.id), habitId: Number(row.habit_id), date: String(row.log_date).slice(0, 10),
    isCompleted: Boolean(row.is_completed), notes: row.notes || "", createdAt: row.created_at, updatedAt: row.updated_at,
  }));
};

export const saveHabitLog = async (habitId, values) => {
  const [habits] = await pool.query("SELECT id, status FROM ProductivityHabits WHERE id = ? LIMIT 1", [habitId]);
  if (!habits[0]) return null;
  if (habits[0].status !== "active") {
    const error = new Error("Archived habits cannot receive new completion logs.");
    error.code = "PRODUCTIVITY_HABIT_ARCHIVED";
    throw error;
  }
  await pool.query(
    `INSERT INTO ProductivityHabitLogs (habit_id, log_date, is_completed, notes)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE is_completed = VALUES(is_completed), notes = VALUES(notes), updated_at = CURRENT_TIMESTAMP`,
    [habitId, values.logDate, values.isCompleted ? 1 : 0, values.notes],
  );
  const [rows] = await pool.query(
    `SELECT id, habit_id, log_date, is_completed, notes, created_at, updated_at
       FROM ProductivityHabitLogs WHERE habit_id = ? AND log_date = ? LIMIT 1`,
    [habitId, values.logDate],
  );
  const row = rows[0];
  return { id: Number(row.id), habitId: Number(row.habit_id), date: String(row.log_date).slice(0, 10), isCompleted: Boolean(row.is_completed), notes: row.notes || "", createdAt: row.created_at, updatedAt: row.updated_at };
};

export const deleteHabitLog = async (habitId, logDate) => {
  const [result] = await pool.query("DELETE FROM ProductivityHabitLogs WHERE habit_id = ? AND log_date = ?", [habitId, logDate]);
  return result.affectedRows > 0;
};
