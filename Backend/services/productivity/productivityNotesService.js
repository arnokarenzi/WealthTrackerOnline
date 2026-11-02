import { pool } from "../../models/MonthlyBudget.js";

const mapNote = (row) => ({
  id: Number(row.id),
  title: row.title || "",
  content: row.content,
  category: row.category || "",
  color: row.color,
  isPinned: Boolean(row.is_pinned),
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listNotes = async ({ includeArchived = false, search = "" } = {}) => {
  const conditions = [];
  const params = [];
  if (!includeArchived) conditions.push("status = 'active'");
  if (search) {
    conditions.push("(COALESCE(title, '') LIKE ? OR content LIKE ? OR COALESCE(category, '') LIKE ?)");
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `SELECT id, title, content, category, color, is_pinned, status, created_at, updated_at
       FROM ProductivityNotes ${where}
      ORDER BY is_pinned DESC, updated_at DESC, id DESC`,
    params,
  );
  return rows.map(mapNote);
};

export const getNoteById = async (id) => {
  const [rows] = await pool.query(
    `SELECT id, title, content, category, color, is_pinned, status, created_at, updated_at
       FROM ProductivityNotes WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapNote(rows[0]) : null;
};

export const createNote = async (values) => {
  const [result] = await pool.query(
    `INSERT INTO ProductivityNotes (title, content, category, color, is_pinned, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [values.title, values.content, values.category, values.color, values.isPinned ? 1 : 0, values.status],
  );
  return getNoteById(result.insertId);
};

const NOTE_COLUMNS = Object.freeze({
  title: "title", content: "content", category: "category", color: "color", isPinned: "is_pinned", status: "status",
});

export const updateNote = async (id, values) => {
  const entries = Object.entries(values).map(([key, value]) => [NOTE_COLUMNS[key], key === "isPinned" ? (value ? 1 : 0) : value]);
  if (entries.length) {
    const assignments = entries.map(([column]) => `${column} = ?`);
    await pool.query(
      `UPDATE ProductivityNotes SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...entries.map(([, value]) => value), id],
    );
  }
  return getNoteById(id);
};

export const archiveNote = async (id) => {
  const [result] = await pool.query(
    "UPDATE ProductivityNotes SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status <> 'archived'",
    [id],
  );
  return result.affectedRows > 0;
};
