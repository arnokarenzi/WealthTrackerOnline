import { pool } from "../models/MonthlyBudget.js";
import { getKigaliTime, getKigaliDateRangeUtc } from "../utils/kigaliTime.js";
import { calculateDebtPayment, calculateNetWorthTotals, calculateRatioPercent, getBudgetAlertLevel, roundMoney } from "../utils/featureMath.js";
import { getDailyPacingStatus } from "../services/dailyLetterService.js";

const DEFAULT_PREFERENCES = {
  dateFormat: "dd/MM/yyyy",
  budgetWarningPercent: 80,
  budgetCriticalPercent: 100,
  notifications: {
    shiftPacing: true,
    dailyTarget: true,
    leaderboard: true,
    budgetAlerts: true,
  },
};
const MONEY_EPSILON = 0.00001;
const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value) => {
  if (typeof value !== "string" || !isoDatePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const asDate = (value, fallback) => (isDate(value) ? value : fallback);
const likeValue = (value) => `%${String(value).replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
const normalizeCategory = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const monthStart = (year, month) => `${year}-${String(month).padStart(2, "0")}-01`;
const getRecentMonths = (count = 12) => {
  const { year, month } = getKigaliTime();
  const result = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    result.push({
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleString("en", { month: "short", timeZone: "UTC" }),
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
    });
  }
  return result;
};
const plusDays = (iso, days) => {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const sendServerError = (res, error, feature) => {
  console.error(`${feature} error:`, error);
  if (error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_FIELD_ERROR") {
    return res.status(503).json({ error: "Feature storage is not initialized. Apply Backend/migrations/20261020_financial_features.sql and verify the existing schema." });
  }
  return res.status(500).json({ error: `${feature} request failed.` });
};

function normalizedPreferences(value) {
  const raw = isRecord(value) ? value : {};
  const rawNotifications = isRecord(raw.notifications) ? raw.notifications : {};
  const dateFormat = ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"].includes(raw.dateFormat)
    ? raw.dateFormat
    : DEFAULT_PREFERENCES.dateFormat;
  const warning = Number(raw.budgetWarningPercent);
  const critical = Number(raw.budgetCriticalPercent);
  const budgetWarningPercent = Number.isFinite(warning) ? Math.round(warning) : DEFAULT_PREFERENCES.budgetWarningPercent;
  const budgetCriticalPercent = Number.isFinite(critical) ? Math.round(critical) : DEFAULT_PREFERENCES.budgetCriticalPercent;
  return {
    dateFormat,
    budgetWarningPercent,
    budgetCriticalPercent,
    notifications: {
      shiftPacing: typeof rawNotifications.shiftPacing === "boolean" ? rawNotifications.shiftPacing : true,
      dailyTarget: typeof rawNotifications.dailyTarget === "boolean" ? rawNotifications.dailyTarget : true,
      leaderboard: typeof rawNotifications.leaderboard === "boolean" ? rawNotifications.leaderboard : true,
      budgetAlerts: typeof rawNotifications.budgetAlerts === "boolean" ? rawNotifications.budgetAlerts : true,
    },
  };
}

async function readSettings(connection = pool, forUpdate = false) {
  const [rows] = await connection.query(`SELECT id, display_name, theme_mode, preferences, updated_at FROM AppSettings WHERE id = 1${forUpdate ? " FOR UPDATE" : ""}`);
  const row = rows[0];
  if (!row) throw new Error("AppSettings singleton row is missing; apply the FinTrack migration.");
  let preferences = row.preferences;
  if (typeof preferences === "string") {
    try { preferences = JSON.parse(preferences); } catch { preferences = {}; }
  }
  return {
    displayName: row.display_name || "",
    themeMode: row.theme_mode === "dark" ? "dark" : "light",
    preferences: normalizedPreferences(preferences),
    updatedAt: row.updated_at,
  };
}

const billView = (row) => ({
  id: Number(row.id),
  billName: row.bill_name,
  vendor: row.vendor || "",
  status: row.status === "paid" ? "Paid" : "Unpaid",
  paymentDate: row.payment_date || null,
  dueDate: row.due_date,
  amount: num(row.amount),
  frequency: row.frequency || "Monthly",
  paymentMethod: row.payment_method || "",
  category: row.category || "Other",
  notes: row.notes || "",
  notification: Boolean(row.notify_enabled),
  autoPay: Boolean(row.auto_pay),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const debtView = (row) => ({
  id: Number(row.id),
  creditor: row.creditor,
  debtType: row.debt_type,
  originalBalance: num(row.original_balance),
  balance: num(row.current_balance),
  interestRate: row.interest_rate == null ? null : num(row.interest_rate),
  minimumPayment: row.minimum_payment == null ? null : num(row.minimum_payment),
  dueDate: row.due_date || null,
  remainingTerm: row.loan_term || "",
  loanTerm: row.loan_term || "",
  frequency: row.frequency || "Monthly",
  paymentMethod: row.payment_method || "",
  status: row.status === "paid_off" ? "Paid off" : "Active",
  progress: num(row.original_balance) > 0 ? Math.round((1 - num(row.current_balance) / num(row.original_balance)) * 100) : 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ---------------------------------------------------------------------------
// Search — parameterized search across persisted records used by the existing UI.
// ---------------------------------------------------------------------------
export const searchRecords = async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const allowedTypes = new Set(["all", "expense", "bill", "debt", "savings-goal", "investment"]);
  const type = typeof req.query.type === "string" ? req.query.type : "all";
  const limit = Math.min(50, Math.max(1, Math.trunc(num(req.query.limit) || 10)));
  const offset = Math.min(5000, Math.max(0, Math.trunc(num(req.query.offset) || 0)));
  if (query.length < 2 || query.length > 100) return res.status(400).json({ error: "Search text must contain between 2 and 100 characters." });
  if (!allowedTypes.has(type)) return res.status(400).json({ error: "Invalid search type." });

  const like = likeValue(query);
  try {
    const [rows] = await pool.query(
      `SELECT * FROM (
        SELECT id, 'expense' AS recordType, description AS title, category AS detail, amount, DATE_FORMAT(expenseDate, '%Y-%m-%d') AS eventDate, '/expenses' AS route
          FROM DailyExpense WHERE COALESCE(is_archived, 0) = 0 AND (description LIKE ? ESCAPE '\\\\' OR category LIKE ? ESCAPE '\\\\' OR COALESCE(notes, '') LIKE ? ESCAPE '\\\\')
        UNION ALL
        SELECT id, 'bill' AS recordType, bill_name AS title, vendor AS detail, amount, DATE_FORMAT(COALESCE(payment_date, due_date), '%Y-%m-%d') AS eventDate, '/bills' AS route
          FROM Bills WHERE is_archived = 0 AND (bill_name LIKE ? ESCAPE '\\\\' OR vendor LIKE ? ESCAPE '\\\\' OR category LIKE ? ESCAPE '\\\\' OR notes LIKE ? ESCAPE '\\\\')
        UNION ALL
        SELECT id, 'debt' AS recordType, creditor AS title, debt_type AS detail, current_balance AS amount, DATE_FORMAT(due_date, '%Y-%m-%d') AS eventDate, '/debt' AS route
          FROM Debts WHERE is_archived = 0 AND (creditor LIKE ? ESCAPE '\\\\' OR debt_type LIKE ? ESCAPE '\\\\' OR status LIKE ? ESCAPE '\\\\')
        UNION ALL
        SELECT id, 'savings-goal' AS recordType, goalName AS title, CONCAT('Target ', CAST(targetAmount AS CHAR)) AS detail, currentAmount AS amount, NULL AS eventDate, '/savings' AS route
          FROM SavingsGoals WHERE goalName LIKE ?
        UNION ALL
        SELECT id, 'investment' AS recordType, asset_name AS title, asset_type AS detail, current_value AS amount, CONCAT(year, '-', LPAD(month, 2, '0'), '-01') AS eventDate, '/investments' AS route
          FROM ActualInvestments WHERE asset_name LIKE ? OR asset_type LIKE ?
      ) AS records
      WHERE (? = 'all' OR recordType = ?)
      ORDER BY eventDate DESC, title ASC
      LIMIT ? OFFSET ?`,
      [like, like, like, like, like, like, like, like, like, like, like, like, like, type, type, limit + 1, offset],
    );
    const visibleRows = rows.slice(0, limit).map((row) => ({
      id: `${row.recordType}-${row.id}`,
      recordId: Number(row.id),
      type: row.recordType,
      title: row.title,
      detail: row.detail || "",
      amount: row.amount == null ? null : num(row.amount),
      date: row.eventDate || null,
      route: row.route,
    }));
    return res.json({ query, type, limit, offset, hasMore: rows.length > limit, results: visibleRows });
  } catch (error) {
    return sendServerError(res, error, "Search");
  }
};

// ---------------------------------------------------------------------------
// Bills — records and payment history are persisted; recording a payment does
// not create a DailyExpense transaction, because no existing rule establishes
// that relationship in this application.
// ---------------------------------------------------------------------------
export const getBills = async (req, res) => {
  const limit = Math.min(200, Math.max(1, Math.trunc(num(req.query.limit) || 100)));
  const offset = Math.min(5000, Math.max(0, Math.trunc(num(req.query.offset) || 0)));
  const status = typeof req.query.status === "string" ? req.query.status.toLowerCase() : "all";
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const includeArchived = req.query.includeArchived === "true";
  if (!["all", "paid", "unpaid"].includes(status)) return res.status(400).json({ error: "Invalid bill status filter." });
  try {
    const where = includeArchived ? [] : ["is_archived = 0"];
    const values = [];
    if (status !== "all") { where.push("status = ?"); values.push(status); }
    if (q) { where.push("(bill_name LIKE ? OR vendor LIKE ? OR category LIKE ? OR notes LIKE ?)"); values.push(likeValue(q), likeValue(q), likeValue(q), likeValue(q)); }
    values.push(limit, offset);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [rows] = await pool.query(`SELECT * FROM Bills ${whereSql} ORDER BY due_date ASC, id DESC LIMIT ? OFFSET ?`, values);
    return res.json(rows.map(billView));
  } catch (error) { return sendServerError(res, error, "Bills retrieval"); }
};

export const createBill = async (req, res) => {
  const body = isRecord(req.body) ? req.body : {};
  const billName = String(body.billName || "").trim();
  const vendor = String(body.vendor || "").trim();
  const amount = Number(body.amount);
  const dueDate = body.dueDate;
  const frequency = String(body.frequency ?? "Monthly").trim();
  const paymentMethod = String(body.paymentMethod ?? "").trim();
  const category = String(body.category ?? "Other").trim();
  const notes = String(body.notes ?? "").trim();
  if (!billName || billName.length > 160) return res.status(400).json({ error: "Bill name is required and must be 160 characters or fewer." });
  if (vendor.length > 160 || frequency.length > 32 || paymentMethod.length > 80 || category.length > 100 || notes.length > 500) return res.status(400).json({ error: "One or more bill fields exceed the allowed length." });
  if (body.notification !== undefined && typeof body.notification !== "boolean") return res.status(400).json({ error: "notification must be a boolean." });
  if (body.autoPay !== undefined && typeof body.autoPay !== "boolean") return res.status(400).json({ error: "autoPay must be a boolean." });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99) return res.status(400).json({ error: "Bill amount must be a positive valid number." });
  if (!isDate(dueDate)) return res.status(400).json({ error: "A valid dueDate in YYYY-MM-DD format is required." });
  try {
    const [result] = await pool.query(
      `INSERT INTO Bills (bill_name, vendor, due_date, amount, frequency, payment_method, category, notes, notify_enabled, auto_pay)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [billName, vendor, dueDate, roundMoney(amount), frequency || "Monthly", paymentMethod, category || "Other", notes, body.notification === true ? 1 : 0, body.autoPay === true ? 1 : 0],
    );
    const [[row]] = await pool.query("SELECT * FROM Bills WHERE id = ?", [result.insertId]);
    return res.status(201).json({ message: "Bill created.", bill: billView(row) });
  } catch (error) { return sendServerError(res, error, "Bill creation"); }
};

export const updateBill = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid bill id." });
  const body = isRecord(req.body) ? req.body : {};
  const connection = await pool.getConnection();
  let committed = false;
  try {
    await connection.beginTransaction();
    const [[existing]] = await connection.query("SELECT * FROM Bills WHERE id = ? AND is_archived = 0 FOR UPDATE", [id]);
    if (!existing) return res.status(404).json({ error: "Bill not found." });
    const billName = body.billName === undefined ? existing.bill_name : String(body.billName).trim();
    const vendor = body.vendor === undefined ? existing.vendor : String(body.vendor).trim();
    const amount = body.amount === undefined ? num(existing.amount) : Number(body.amount);
    const dueDate = body.dueDate === undefined ? existing.due_date : body.dueDate;
    if (!billName || billName.length > 160) return res.status(400).json({ error: "Bill name is required and must be 160 characters or fewer." });
    if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99) return res.status(400).json({ error: "Bill amount must be a positive valid number." });
    if (existing.status === "paid" && roundMoney(amount) !== roundMoney(existing.amount)) return res.status(409).json({ error: "A paid bill's amount cannot be changed because its saved payment history must remain consistent." });
    if (!isDate(dueDate)) return res.status(400).json({ error: "A valid dueDate in YYYY-MM-DD format is required." });
    if (body.notification !== undefined && typeof body.notification !== "boolean") return res.status(400).json({ error: "notification must be a boolean." });
    if (body.autoPay !== undefined && typeof body.autoPay !== "boolean") return res.status(400).json({ error: "autoPay must be a boolean." });
    const frequency = String(body.frequency ?? existing.frequency).trim();
    const paymentMethod = String(body.paymentMethod ?? existing.payment_method).trim();
    const category = String(body.category ?? existing.category).trim();
    const notes = String(body.notes ?? existing.notes).trim();
    if (frequency.length > 32 || paymentMethod.length > 80 || category.length > 100 || notes.length > 500 || vendor.length > 160) return res.status(400).json({ error: "One or more bill fields exceed the allowed length." });
    await connection.query(
      `UPDATE Bills SET bill_name=?, vendor=?, due_date=?, amount=?, frequency=?, payment_method=?, category=?, notes=?, notify_enabled=?, auto_pay=?
       WHERE id=? AND is_archived=0`,
      [billName, vendor, dueDate, roundMoney(amount), frequency || "Monthly", paymentMethod, category || "Other", notes, (body.notification ?? Boolean(existing.notify_enabled)) ? 1 : 0, (body.autoPay ?? Boolean(existing.auto_pay)) ? 1 : 0, id],
    );
    const [[row]] = await connection.query("SELECT * FROM Bills WHERE id = ?", [id]);
    await connection.commit();
    committed = true;
    return res.json({ message: "Bill updated.", bill: billView(row) });
  } catch (error) {
    return sendServerError(res, error, "Bill update");
  } finally {
    if (!committed) { try { await connection.rollback(); } catch { /* transaction may already have rolled back */ } }
    connection.release();
  }
};

export const archiveBill = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid bill id." });
  try {
    const [result] = await pool.query("UPDATE Bills SET is_archived=1 WHERE id=? AND is_archived=0", [id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Bill not found." });
    return res.json({ message: "Bill archived. Payment history has been retained." });
  } catch (error) { return sendServerError(res, error, "Bill archive"); }
};

export const recordBillPayment = async (req, res) => {
  const id = Number(req.params.id);
  const body = isRecord(req.body) ? req.body : {};
  const requestId = String(body.requestId || "").trim();
  const paymentMethod = String(body.paymentMethod || "").trim().slice(0, 80);
  const paymentDate = asDate(body.paymentDate, getKigaliTime().dateString);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid bill id." });
  if (!requestId || requestId.length > 100) return res.status(400).json({ error: "requestId is required to protect against duplicate payment submissions." });
  if (body.paymentDate !== undefined && !isDate(body.paymentDate)) return res.status(400).json({ error: "paymentDate must be YYYY-MM-DD." });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[bill]] = await connection.query("SELECT * FROM Bills WHERE id=? AND is_archived=0 FOR UPDATE", [id]);
    if (!bill) { await connection.rollback(); return res.status(404).json({ error: "Bill not found." }); }
    const [[prior]] = await connection.query("SELECT * FROM BillPayments WHERE request_id=?", [requestId]);
    if (prior) {
      if (Number(prior.bill_id) !== id) { await connection.rollback(); return res.status(409).json({ error: "requestId has already been used for a different bill payment." }); }
      await connection.commit();
      return res.json({ message: "Payment was already recorded; duplicate request ignored.", bill: billView(bill), payment: { id: Number(prior.id), amount: num(prior.amount), paymentDate: prior.payment_date } });
    }
    if (bill.status === "paid") { await connection.rollback(); return res.status(409).json({ error: "This bill is already marked paid. Create or update the next bill occurrence instead." }); }
    await connection.query(
      "INSERT INTO BillPayments (bill_id, request_id, amount, payment_date, payment_method, notes) VALUES (?, ?, ?, ?, ?, ?)",
      [id, requestId, roundMoney(bill.amount), paymentDate, paymentMethod || bill.payment_method || "", String(body.notes || "").trim().slice(0, 500)],
    );
    await connection.query("UPDATE Bills SET status='paid', payment_date=?, payment_method=? WHERE id=?", [paymentDate, paymentMethod || bill.payment_method || "", id]);
    await connection.commit();
    const [[updated]] = await pool.query("SELECT * FROM Bills WHERE id=?", [id]);
    return res.status(201).json({ message: "Bill payment recorded.", bill: billView(updated) });
  } catch (error) {
    try { await connection.rollback(); } catch { /* preserve original error */ }
    return sendServerError(res, error, "Bill payment");
  } finally { connection.release(); }
};

export const getBillPayments = async (req, res) => {
  const id = req.params.id === undefined ? null : Number(req.params.id);
  if (id !== null && (!Number.isInteger(id) || id <= 0)) return res.status(400).json({ error: "Invalid bill id." });
  try {
    const sql = `SELECT p.id, p.bill_id, p.amount, p.payment_date, p.payment_method, p.notes, p.created_at, b.bill_name, b.category
      FROM BillPayments p JOIN Bills b ON b.id=p.bill_id ${id === null ? "" : "WHERE p.bill_id=?"}
      ORDER BY p.payment_date DESC, p.id DESC LIMIT 500`;
    const [rows] = id === null ? await pool.query(sql) : await pool.query(sql, [id]);
    return res.json(rows.map((row) => ({ id: Number(row.id), billId: Number(row.bill_id), billName: row.bill_name, category: row.category, amount: num(row.amount), paymentDate: row.payment_date, paymentMethod: row.payment_method || "", notes: row.notes || "", createdAt: row.created_at })));
  } catch (error) { return sendServerError(res, error, "Bill payment history"); }
};

export const getBillPaymentTrends = async (_req, res) => {
  try {
    const months = getRecentMonths(12);
    const startDate = `${months[0].key}-01`;
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(p.payment_date, '%Y-%m') AS month_key, b.category, SUM(p.amount) AS amount
       FROM BillPayments p JOIN Bills b ON b.id=p.bill_id
       WHERE p.payment_date >= ? GROUP BY month_key, b.category ORDER BY month_key, b.category`,
      [startDate],
    );
    const totals = new Map();
    rows.forEach((row) => totals.set(row.category, (totals.get(row.category) || 0) + num(row.amount)));
    const categories = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([category]) => category);
    const data = categories.map((category) => ({
      id: category,
      data: months.map((month) => ({ x: month.label, y: roundMoney(rows.find((row) => row.category === category && row.month_key === month.key)?.amount) })),
    }));
    return res.json({ data, hasPayments: rows.length > 0, months: months.map((month) => ({ key: month.key, label: month.label })) });
  } catch (error) { return sendServerError(res, error, "Bill payment trends"); }
};

// ---------------------------------------------------------------------------
// Debts — balance updates and payment ledger entries commit atomically.
// ---------------------------------------------------------------------------
export const getDebts = async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === "true";
    const [rows] = await pool.query(`SELECT * FROM Debts ${includeArchived ? "" : "WHERE is_archived=0"} ORDER BY (status='active') DESC, due_date ASC, id DESC`);
    return res.json(rows.map(debtView));
  } catch (error) { return sendServerError(res, error, "Debts retrieval"); }
};

export const createDebt = async (req, res) => {
  const body = isRecord(req.body) ? req.body : {};
  const creditor = String(body.creditor || "").trim();
  const debtType = String(body.debtType || "").trim();
  const balance = Number(body.balance ?? body.currentBalance);
  const interestRate = body.interestRate === "" || body.interestRate === undefined || body.interestRate === null ? null : Number(body.interestRate);
  const minimumPayment = body.minimumPayment === "" || body.minimumPayment === undefined || body.minimumPayment === null ? null : Number(body.minimumPayment);
  const dueDate = body.dueDate === "" || body.dueDate == null ? null : body.dueDate;
  if (!creditor || creditor.length > 160 || !debtType || debtType.length > 100) return res.status(400).json({ error: "Creditor and debt type are required." });
  if (!Number.isFinite(balance) || balance <= 0 || balance > 9999999999.99) return res.status(400).json({ error: "Debt balance must be a positive valid number." });
  if (interestRate !== null && (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 1000)) return res.status(400).json({ error: "Interest rate must be between 0 and 1000%, or omitted if unknown." });
  if (minimumPayment !== null && (!Number.isFinite(minimumPayment) || minimumPayment < 0 || minimumPayment > balance)) return res.status(400).json({ error: "Minimum payment must be zero or greater and may not exceed the current balance." });
  if (dueDate !== null && !isDate(dueDate)) return res.status(400).json({ error: "dueDate must be YYYY-MM-DD or empty." });
  const loanTerm = String(body.loanTerm || "").trim();
  const frequency = String(body.frequency || "Monthly").trim();
  const paymentMethod = String(body.paymentMethod || "").trim();
  if (loanTerm.length > 100 || frequency.length > 32 || paymentMethod.length > 80) return res.status(400).json({ error: "One or more debt fields exceed the allowed length." });
  try {
    const [result] = await pool.query(
      `INSERT INTO Debts (creditor, debt_type, original_balance, current_balance, interest_rate, minimum_payment, due_date, loan_term, frequency, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [creditor, debtType, roundMoney(balance), roundMoney(balance), interestRate, minimumPayment === null ? null : roundMoney(minimumPayment), dueDate, loanTerm, frequency || "Monthly", paymentMethod],
    );
    const [[row]] = await pool.query("SELECT * FROM Debts WHERE id=?", [result.insertId]);
    return res.status(201).json({ message: "Debt created.", debt: debtView(row) });
  } catch (error) { return sendServerError(res, error, "Debt creation"); }
};

export const updateDebt = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid debt id." });
  const body = isRecord(req.body) ? req.body : {};
  const connection = await pool.getConnection();
  let committed = false;
  try {
    await connection.beginTransaction();
    const [[row]] = await connection.query("SELECT * FROM Debts WHERE id=? AND is_archived=0 FOR UPDATE", [id]);
    if (!row) return res.status(404).json({ error: "Debt not found." });
    const creditor = body.creditor === undefined ? row.creditor : String(body.creditor).trim();
    const debtType = body.debtType === undefined ? row.debt_type : String(body.debtType).trim();
    const interestRate = body.interestRate === undefined ? (row.interest_rate == null ? null : num(row.interest_rate)) : (body.interestRate === "" || body.interestRate === null ? null : Number(body.interestRate));
    const minimumPayment = body.minimumPayment === undefined ? (row.minimum_payment == null ? null : num(row.minimum_payment)) : (body.minimumPayment === "" || body.minimumPayment === null ? null : Number(body.minimumPayment));
    const dueDate = body.dueDate === undefined ? row.due_date : (body.dueDate === "" ? null : body.dueDate);
    if (!creditor || creditor.length > 160 || !debtType || debtType.length > 100) return res.status(400).json({ error: "Creditor and debt type are required and must fit the allowed lengths." });
    if (interestRate !== null && (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 1000)) return res.status(400).json({ error: "Invalid interest rate." });
    if (minimumPayment !== null && (!Number.isFinite(minimumPayment) || minimumPayment < 0 || minimumPayment > num(row.current_balance))) return res.status(400).json({ error: "Minimum payment must be zero or greater and may not exceed the current outstanding balance." });
    if (dueDate !== null && !isDate(dueDate)) return res.status(400).json({ error: "dueDate must be YYYY-MM-DD or empty." });
    const loanTerm = String(body.loanTerm ?? row.loan_term).trim();
    const frequency = String(body.frequency ?? row.frequency).trim();
    const paymentMethod = String(body.paymentMethod ?? row.payment_method).trim();
    if (loanTerm.length > 100 || frequency.length > 32 || paymentMethod.length > 80) return res.status(400).json({ error: "One or more debt fields exceed the allowed length." });
    await connection.query(
      `UPDATE Debts SET creditor=?, debt_type=?, interest_rate=?, minimum_payment=?, due_date=?, loan_term=?, frequency=?, payment_method=? WHERE id=? AND is_archived=0`,
      [creditor, debtType, interestRate, minimumPayment, dueDate, loanTerm, frequency || "Monthly", paymentMethod, id],
    );
    const [[updated]] = await connection.query("SELECT * FROM Debts WHERE id=?", [id]);
    await connection.commit();
    committed = true;
    return res.json({ message: "Debt terms updated.", debt: debtView(updated) });
  } catch (error) {
    return sendServerError(res, error, "Debt update");
  } finally {
    if (!committed) { try { await connection.rollback(); } catch { /* transaction may already have rolled back */ } }
    connection.release();
  }
};

export const archiveDebt = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid debt id." });
  try {
    const [[row]] = await pool.query("SELECT current_balance FROM Debts WHERE id=? AND is_archived=0", [id]);
    if (!row) return res.status(404).json({ error: "Debt not found." });
    if (num(row.current_balance) > MONEY_EPSILON) return res.status(409).json({ error: "An outstanding debt cannot be archived. Record repayments until the balance is zero first." });
    await pool.query("UPDATE Debts SET is_archived=1 WHERE id=?", [id]);
    return res.json({ message: "Paid-off debt archived. Payment history has been retained." });
  } catch (error) { return sendServerError(res, error, "Debt archive"); }
};

export const recordDebtPayment = async (req, res) => {
  const id = Number(req.params.id);
  const body = isRecord(req.body) ? req.body : {};
  const requestId = String(body.requestId || "").trim();
  const amount = Number(body.amount);
  const paymentDate = body.paymentDate === undefined ? getKigaliTime().dateString : body.paymentDate;
  const paymentMethod = String(body.paymentMethod || "").trim().slice(0, 80);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid debt id." });
  if (!requestId || requestId.length > 100) return res.status(400).json({ error: "requestId is required to protect against duplicate payment submissions." });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Payment amount must be positive." });
  if (!isDate(paymentDate)) return res.status(400).json({ error: "paymentDate must be YYYY-MM-DD." });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[debt]] = await connection.query("SELECT * FROM Debts WHERE id=? AND is_archived=0 FOR UPDATE", [id]);
    if (!debt) { await connection.rollback(); return res.status(404).json({ error: "Debt not found." }); }
    const [[prior]] = await connection.query("SELECT * FROM DebtPayments WHERE request_id=?", [requestId]);
    if (prior) {
      if (Number(prior.debt_id) !== id) { await connection.rollback(); return res.status(409).json({ error: "requestId has already been used for a different debt payment." }); }
      await connection.commit();
      const [[current]] = await pool.query("SELECT * FROM Debts WHERE id=?", [id]);
      return res.json({ message: "Payment was already recorded; duplicate request ignored.", debt: debtView(current), payment: { id: Number(prior.id), amount: num(prior.amount), balanceBefore: num(prior.balance_before), balanceAfter: num(prior.balance_after) } });
    }
    const currentBalance = roundMoney(debt.current_balance);
    if (debt.status === "paid_off" || currentBalance <= MONEY_EPSILON) { await connection.rollback(); return res.status(409).json({ error: "This debt is already paid off." }); }
    const repayment = calculateDebtPayment(currentBalance, amount, MONEY_EPSILON);
    if (!repayment.ok) { await connection.rollback(); return res.status(400).json({ error: repayment.error }); }
    const { paymentAmount, balanceBefore, balanceAfter: newBalance } = repayment;
    await connection.query(
      `INSERT INTO DebtPayments (debt_id, request_id, amount, balance_before, balance_after, payment_date, payment_method, reference)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, requestId, paymentAmount, balanceBefore, newBalance, paymentDate, paymentMethod || debt.payment_method || "", String(body.reference || "").trim().slice(0, 120)],
    );
    await connection.query("UPDATE Debts SET current_balance=?, status=? WHERE id=?", [newBalance, newBalance <= MONEY_EPSILON ? "paid_off" : "active", id]);
    await connection.commit();
    const [[updated]] = await pool.query("SELECT * FROM Debts WHERE id=?", [id]);
    return res.status(201).json({ message: "Debt payment recorded.", debt: debtView(updated), payment: { amount: paymentAmount, balanceBefore, balanceAfter: newBalance } });
  } catch (error) {
    try { await connection.rollback(); } catch { /* preserve original error */ }
    return sendServerError(res, error, "Debt payment");
  } finally { connection.release(); }
};

export const getDebtPayments = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.debt_id, p.amount, p.balance_before, p.balance_after, p.payment_date, p.payment_method, p.reference, p.created_at, d.creditor, d.debt_type
       FROM DebtPayments p JOIN Debts d ON d.id=p.debt_id ORDER BY p.payment_date DESC, p.id DESC LIMIT 500`,
    );
    return res.json(rows.map((row) => ({ id: Number(row.id), debtId: Number(row.debt_id), date: row.payment_date, description: `${row.creditor} repayment`, type: "Debt Repayment", category: row.debt_type, amount: num(row.amount), paymentMethod: row.payment_method || "", status: "Paid", reference: row.reference || `PAY-${row.id}`, balanceBefore: num(row.balance_before), balanceAfter: num(row.balance_after), createdAt: row.created_at })));
  } catch (error) { return sendServerError(res, error, "Debt payment history"); }
};

export const getDebtSummary = async (_req, res) => {
  try {
    const { year, month } = getKigaliTime();
    const start = monthStart(year, month);
    const [incomeStartUtc, incomeEndUtc] = getKigaliDateRangeUtc(start, getKigaliTime().dateString);
    const [[incomeRow]] = await pool.query("SELECT COALESCE(SUM(amount),0) AS income FROM WalletIncome WHERE created_at >= ? AND created_at < ?", [incomeStartUtc, incomeEndUtc]);
    const monthlyIncome = roundMoney(incomeRow?.income);
    const [rows] = await pool.query("SELECT debt_type, COALESCE(SUM(current_balance),0) AS balance, COALESCE(SUM(minimum_payment),0) AS minimum_payment FROM Debts WHERE is_archived=0 AND status='active' GROUP BY debt_type ORDER BY debt_type");
    const [totalsRows] = await pool.query("SELECT COALESCE(SUM(current_balance),0) AS balance, COALESCE(SUM(minimum_payment),0) AS minimum_payment FROM Debts WHERE is_archived=0 AND status='active'");
    const totalBalance = roundMoney(totalsRows[0]?.balance);
    const totalMinimumPayments = roundMoney(totalsRows[0]?.minimum_payment);
    const dtiPct = calculateRatioPercent(totalMinimumPayments, monthlyIncome);
    return res.json({
      totalBalance,
      totalMinimumPayments,
      recordedIncomeThisMonth: monthlyIncome,
      debtToIncomePercent: dtiPct,
      ratioBasis: "Debt minimum payments divided by income recorded in WalletIncome during the current Kigali calendar month. A ratio is omitted when no income is recorded.",
      debtToIncomeRatio: dtiPct === null ? [] : [{ year: "Current month", income: 100, debt: dtiPct }],
      debtBurdenRatio: monthlyIncome <= 0 ? [] : rows.map((row) => ({ category: row.debt_type, value: calculateRatioPercent(num(row.minimum_payment), monthlyIncome) ?? 0 })).filter((row) => row.value > 0),
    });
  } catch (error) { return sendServerError(res, error, "Debt summary"); }
};

// ---------------------------------------------------------------------------
// Reports — calculations use persisted expenses, recorded income and the saved
// current-month budget. No demo rows are used to fill an empty report.
// ---------------------------------------------------------------------------
export const getReports = async (req, res) => {
  const months = getRecentMonths(12);
  const startDefault = `${months[0].key}-01`;
  const { dateString: today } = getKigaliTime();
  const startDate = req.query.startDate === undefined ? startDefault : req.query.startDate;
  const endDate = req.query.endDate === undefined ? today : req.query.endDate;
  if (!isDate(startDate) || !isDate(endDate) || startDate > endDate) return res.status(400).json({ error: "startDate and endDate must be valid YYYY-MM-DD dates, with startDate no later than endDate." });
  const startParts = startDate.slice(0, 7).split("-").map(Number);
  const endParts = endDate.slice(0, 7).split("-").map(Number);
  const reportMonthSpan = (endParts[0] - startParts[0]) * 12 + endParts[1] - startParts[1];
  if (reportMonthSpan >= 120) return res.status(400).json({ error: "Report ranges may span at most 120 calendar months." });
  try {
    const [expenseRows] = await pool.query(
      `SELECT DATE_FORMAT(expenseDate, '%Y-%m') AS month_key, category, SUM(amount) AS amount
       FROM DailyExpense WHERE COALESCE(is_archived,0)=0 AND expenseDate >= ? AND expenseDate <= ?
       GROUP BY month_key, category ORDER BY month_key, category`,
      [startDate, endDate],
    );
    const [incomeStartUtc, incomeEndUtc] = getKigaliDateRangeUtc(startDate, endDate);
    const [incomeRows] = await pool.query(
      `SELECT DATE_FORMAT(DATE_ADD(created_at, INTERVAL 2 HOUR), '%Y-%m') AS month_key, SUM(amount) AS amount
       FROM WalletIncome WHERE created_at >= ? AND created_at < ?
       GROUP BY month_key ORDER BY month_key`,
      [incomeStartUtc, incomeEndUtc],
    );

    const monthSet = new Set();
    const cursor = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);
    while (cursor <= end && monthSet.size < 120) {
      monthSet.add(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
      cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    }
    const monthKeys = [...monthSet].sort();
    const monthLabels = monthKeys.map((key) => ({ key, label: new Date(`${key}-01T00:00:00.000Z`).toLocaleString("en", { month: "short", year: "2-digit", timeZone: "UTC" }) }));
    const byCategoryTotal = new Map();
    expenseRows.forEach((row) => byCategoryTotal.set(row.category, (byCategoryTotal.get(row.category) || 0) + num(row.amount)));
    const topCategories = [...byCategoryTotal.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([category]) => category);
    const trendAnalysis = topCategories.map((category) => ({
      id: category,
      data: monthLabels.map((month) => ({ x: month.label, y: roundMoney(expenseRows.find((row) => row.category === category && row.month_key === month.key)?.amount) })),
    }));
    const financialOverview = [
      { id: "Recorded income", data: monthLabels.map((month) => ({ x: month.label, y: roundMoney(incomeRows.find((row) => row.month_key === month.key)?.amount) })) },
      { id: "Logged expenses", data: monthLabels.map((month) => ({ x: month.label, y: roundMoney(expenseRows.filter((row) => row.month_key === month.key).reduce((sum, row) => sum + num(row.amount), 0)) })) },
    ];

    const { year, month } = getKigaliTime();
    const currentMonthStart = monthStart(year, month);
    const nextMonthStart = month === 12 ? `${year + 1}-01-01` : monthStart(year, month + 1);
    const [weekdayRows] = await pool.query(
      `SELECT DAYOFWEEK(expenseDate) AS weekday, category, SUM(amount) AS amount
       FROM DailyExpense WHERE COALESCE(is_archived,0)=0 AND expenseDate >= ? AND expenseDate < ?
       GROUP BY weekday, category ORDER BY weekday, category`,
      [currentMonthStart, nextMonthStart],
    );
    const [currentMonthExpenseRows] = await pool.query(
      `SELECT category, SUM(amount) AS amount FROM DailyExpense
       WHERE COALESCE(is_archived,0)=0 AND expenseDate >= ? AND expenseDate < ? GROUP BY category`,
      [currentMonthStart, nextMonthStart],
    );
    const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekTotals = new Map();
    weekdayRows.forEach((row) => weekTotals.set(row.category, (weekTotals.get(row.category) || 0) + num(row.amount)));
    const spendingBreakdownKeys = [...weekTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([category]) => category);
    const spendingBreakdown = weekdayRows.length ? weekdayNames.map((day, index) => {
      const record = { day };
      spendingBreakdownKeys.forEach((category) => {
        record[category] = roundMoney(weekdayRows.find((row) => Number(row.weekday) === (index + 1 || 7) && row.category === category)?.amount);
      });
      // MySQL DAYOFWEEK: Sunday=1, Monday=2 ... Saturday=7; convert from weekdayNames.
      return record;
    }) : [];
    // Remap weekday indexing from MySQL's Sunday-first numbering to labels in the same order.
    spendingBreakdown.forEach((record, index) => {
      const mysqlWeekday = index === 0 ? 1 : index + 1;
      spendingBreakdownKeys.forEach((category) => {
        record[category] = roundMoney(weekdayRows.find((row) => Number(row.weekday) === mysqlWeekday && row.category === category)?.amount);
      });
    });

    const [[budget]] = await pool.query("SELECT * FROM MonthlyBudget WHERE month=? AND year=? ORDER BY id DESC LIMIT 1", [month, year]);
    const budgetFields = [
      ["rent", "Rent"], ["phoneInternet", "Phone / Internet"], ["electricityWater", "Electricity / Water"],
      ["food", "Food"], ["miscellaneous", "Miscellaneous"], ["medical", "Medical"], ["familySupport", "Family support"],
    ];
    const budgetComparison = budget ? budgetFields.map(([field, label]) => {
      const actual = currentMonthExpenseRows.filter((row) => normalizeCategory(row.category) === normalizeCategory(field)).reduce((sum, row) => sum + num(row.amount), 0);
      return { category: label, budget: roundMoney(budget[field]), actual: roundMoney(actual) };
    }) : [];

    return res.json({
      period: { startDate, endDate },
      definitions: {
        trendAnalysis: "Logged, non-archived DailyExpense amounts grouped by expense category and calendar month.",
        financialOverview: "Income actually recorded in WalletIncome compared with non-archived DailyExpense entries; budgeted salary is not treated as received income.",
        spendingBreakdown: "Logged, non-archived expenses grouped by weekday of the current Kigali calendar month.",
        budgetComparison: "Saved current-month MonthlyBudget categories compared with matching logged DailyExpense categories. Only explicitly mapped categories are compared.",
      },
      trendAnalysis,
      financialOverview: expenseRows.length || incomeRows.length ? financialOverview : [],
      spendingBreakdown,
      spendingBreakdownKeys,
      budgetComparison,
    });
  } catch (error) { return sendServerError(res, error, "Reports"); }
};

// ---------------------------------------------------------------------------
// Net worth — only values stored as separate, non-overlapping buckets are
// included. SavingsGoals are excluded because they may earmark money already
// included in wallet/reserve balances. Unpaid bills are excluded pending an
// established accounting relationship; outstanding Debts are included.
// Historical points are actual, explicitly saved snapshots only.
// ---------------------------------------------------------------------------
async function calculateNetWorth(connection = pool) {
  const [budgetRows] = await connection.query("SELECT balance FROM MonthlyBudget WHERE id=1 LIMIT 1");
  const [emergencyRows] = await connection.query("SELECT current_amount FROM EmergencyFund ORDER BY id DESC LIMIT 1");
  const [reserveRows] = await connection.query("SELECT amount FROM InvestmentReserve ORDER BY id DESC LIMIT 1");
  const [investmentRows] = await connection.query("SELECT id, asset_name, asset_type, principal_invested, current_value, month, year FROM ActualInvestments ORDER BY year DESC, month DESC, id DESC");
  const [manualRows] = await connection.query("SELECT * FROM NetWorthAssets WHERE is_archived=0 ORDER BY id DESC");
  const [debtRows] = await connection.query("SELECT * FROM Debts WHERE is_archived=0 AND current_balance > 0 ORDER BY due_date ASC, id DESC");

  const wallet = roundMoney(budgetRows[0]?.balance);
  const emergency = roundMoney(emergencyRows[0]?.current_amount);
  const reserve = roundMoney(reserveRows[0]?.amount);
  const assets = [];
  if (wallet !== 0) assets.push({ id: "wallet-balance", source: "wallet", assetName: "Wallet balance", assetType: "Cash", currentValue: wallet, currency: "RWF", acquisitionDate: null, description: "MonthlyBudget.balance" });
  if (emergency !== 0) assets.push({ id: "emergency-fund", source: "emergency-fund", assetName: "Emergency fund", assetType: "Cash reserve", currentValue: emergency, currency: "RWF", acquisitionDate: null, description: "EmergencyFund.current_amount" });
  if (reserve !== 0) assets.push({ id: "investment-reserve", source: "investment-reserve", assetName: "Investment reserve", assetType: "Investment reserve", currentValue: reserve, currency: "RWF", acquisitionDate: null, description: "InvestmentReserve.amount" });
  investmentRows.forEach((row) => assets.push({ id: `investment-${row.id}`, source: "actual-investment", sourceId: Number(row.id), assetName: row.asset_name, assetType: row.asset_type || "Investment", currentValue: roundMoney(row.current_value), currency: "RWF", acquisitionDate: `${row.year}-${String(row.month).padStart(2, "0")}-01`, description: `Principal invested: ${roundMoney(row.principal_invested)}` }));
  manualRows.forEach((row) => assets.push({ id: `manual-asset-${row.id}`, source: "manual", sourceId: Number(row.id), assetName: row.asset_name, assetType: row.asset_type, currentValue: roundMoney(row.current_value), currency: row.currency || "RWF", acquisitionDate: row.acquisition_date || null, description: row.description || "" }));

  const liabilities = debtRows.map((row) => ({
    id: Number(row.id), name: row.creditor, type: row.debt_type, amount: roundMoney(row.current_balance),
    interestRate: row.interest_rate == null ? null : num(row.interest_rate),
    minimumPayment: row.minimum_payment == null ? null : num(row.minimum_payment), dueDate: row.due_date || null,
    loanTerm: row.loan_term || "", status: row.status === "paid_off" ? "Paid off" : "Active",
  }));
  const { totalAssets, totalLiabilities, netWorth } = calculateNetWorthTotals(assets, liabilities);
  const buckets = {
    cash: roundMoney(wallet + emergency + reserve),
    investments: roundMoney(investmentRows.reduce((sum, row) => sum + num(row.current_value), 0)),
    loans: 0,
    creditCardDebt: 0,
    property: 0,
    other: 0,
  };
  debtRows.forEach((row) => {
    const type = String(row.debt_type || "").toLowerCase();
    if (type.includes("credit") || type.includes("card")) buckets.creditCardDebt -= num(row.current_balance);
    else buckets.loans -= num(row.current_balance);
  });
  manualRows.forEach((row) => {
    if (String(row.asset_type || "").toLowerCase().includes("property")) buckets.property += num(row.current_value);
    else buckets.other += num(row.current_value);
  });
  const { dateString } = getKigaliTime();
  return { assets, liabilities, totalAssets, totalLiabilities, netWorth, asOfDate: dateString, breakdown: Object.fromEntries(Object.entries(buckets).map(([key, value]) => [key, roundMoney(value)])) };
}

export const getNetWorth = async (_req, res) => {
  try {
    const summary = await calculateNetWorth();
    const [snapshotRows] = await pool.query("SELECT id, snapshot_date, total_assets, total_liabilities, net_worth FROM NetWorthSnapshots ORDER BY snapshot_date DESC LIMIT 365");
    return res.json({
      ...summary,
      history: snapshotRows.slice().reverse().map((row) => ({ id: Number(row.id), date: row.snapshot_date, totalAssets: num(row.total_assets), totalLiabilities: num(row.total_liabilities), netWorth: num(row.net_worth) })),
      historyIsSnapshotBased: true,
      assetRules: ["MonthlyBudget.balance", "EmergencyFund.current_amount", "InvestmentReserve.amount", "ActualInvestments.current_value", "and manually tracked NetWorthAssets are included as separate asset buckets.", "SavingsGoals are excluded to avoid double-counting earmarked funds.", "Only outstanding Debts are included as liabilities; unpaid Bills are excluded until an accounting relationship is defined."],
    });
  } catch (error) { return sendServerError(res, error, "Net worth"); }
};

export const createNetWorthAsset = async (req, res) => {
  const body = isRecord(req.body) ? req.body : {};
  const assetName = String(body.assetName || "").trim();
  const assetType = String(body.assetType || "").trim();
  const currentValue = Number(body.currentValue);
  const currency = String(body.currency || "RWF").trim().toUpperCase();
  const acquisitionDate = body.acquisitionDate === "" || body.acquisitionDate == null ? null : body.acquisitionDate;
  if (!assetName || assetName.length > 160 || !assetType || assetType.length > 100) return res.status(400).json({ error: "Asset name and type are required." });
  if (!Number.isFinite(currentValue) || currentValue < 0 || currentValue > 999999999999.99) return res.status(400).json({ error: "Current value must be zero or greater." });
  if (currency !== "RWF") return res.status(400).json({ error: "FinTrack financial balances are stored in RWF. Convert the value yourself before recording it; automatic currency conversion is not configured." });
  if (acquisitionDate !== null && !isDate(acquisitionDate)) return res.status(400).json({ error: "acquisitionDate must be YYYY-MM-DD or empty." });
  try {
    const [result] = await pool.query(
      "INSERT INTO NetWorthAssets (asset_name, asset_type, current_value, currency, acquisition_date, description) VALUES (?, ?, ?, ?, ?, ?)",
      [assetName, assetType, roundMoney(currentValue), currency, acquisitionDate, String(body.description || "").trim().slice(0, 500)],
    );
    return res.status(201).json({ message: "Asset added.", id: Number(result.insertId) });
  } catch (error) { return sendServerError(res, error, "Net worth asset creation"); }
};

export const archiveNetWorthAsset = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid asset id." });
  try {
    const [result] = await pool.query("UPDATE NetWorthAssets SET is_archived=1 WHERE id=? AND is_archived=0", [id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Manually tracked asset not found." });
    return res.json({ message: "Asset archived." });
  } catch (error) { return sendServerError(res, error, "Net worth asset archive"); }
};

export const saveNetWorthSnapshot = async (_req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const summary = await calculateNetWorth(connection);
    const breakdown = JSON.stringify({ assets: summary.assets, liabilities: summary.liabilities, values: summary.breakdown });
    await connection.query(
      `INSERT INTO NetWorthSnapshots (snapshot_date, total_assets, total_liabilities, net_worth, breakdown_json)
       VALUES (?, ?, ?, ?, CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE total_assets=VALUES(total_assets), total_liabilities=VALUES(total_liabilities), net_worth=VALUES(net_worth), breakdown_json=VALUES(breakdown_json)`,
      [summary.asOfDate, summary.totalAssets, summary.totalLiabilities, summary.netWorth, breakdown],
    );
    await connection.commit();
    return res.status(201).json({ message: "Today's net-worth snapshot saved from current persisted records.", date: summary.asOfDate, totalAssets: summary.totalAssets, totalLiabilities: summary.totalLiabilities, netWorth: summary.netWorth });
  } catch (error) {
    try { await connection.rollback(); } catch { /* preserve original error */ }
    return sendServerError(res, error, "Net worth snapshot");
  } finally { connection.release(); }
};

// ---------------------------------------------------------------------------
// Settings — persisted server-side. The current application has no sign-in or
// session model, so this remains one shared settings profile, not per-user auth.
// ---------------------------------------------------------------------------
export const getSettings = async (_req, res) => {
  try { return res.json(await readSettings()); }
  catch (error) { return sendServerError(res, error, "Settings retrieval"); }
};

export const updateSettings = async (req, res) => {
  const body = isRecord(req.body) ? req.body : {};
  const allowed = new Set(["displayName", "themeMode", "preferences"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ error: "Settings payload contains unsupported fields." });
  const connection = await pool.getConnection();
  let committed = false;
  try {
    await connection.beginTransaction();
    const current = await readSettings(connection, true);
    let displayName = current.displayName;
    if (body.displayName !== undefined) {
      if (typeof body.displayName !== "string" || body.displayName.trim().length > 50) return res.status(400).json({ error: "displayName must be a string of 50 characters or fewer." });
      displayName = body.displayName.trim();
    }
    let themeMode = current.themeMode;
    if (body.themeMode !== undefined) {
      if (!["light", "dark"].includes(body.themeMode)) return res.status(400).json({ error: "themeMode must be light or dark." });
      themeMode = body.themeMode;
    }
    let preferences = current.preferences;
    if (body.preferences !== undefined) {
      if (!isRecord(body.preferences)) return res.status(400).json({ error: "preferences must be an object." });
      const allowedPreferenceKeys = new Set(["dateFormat", "budgetWarningPercent", "budgetCriticalPercent", "notifications"]);
      if (Object.keys(body.preferences).some((key) => !allowedPreferenceKeys.has(key))) return res.status(400).json({ error: "Settings preferences contain unsupported fields." });
      if (body.preferences.notifications !== undefined && !isRecord(body.preferences.notifications)) return res.status(400).json({ error: "preferences.notifications must be an object." });
      const allowedNotificationKeys = new Set(Object.keys(DEFAULT_PREFERENCES.notifications));
      if (isRecord(body.preferences.notifications) && Object.keys(body.preferences.notifications).some((key) => !allowedNotificationKeys.has(key))) return res.status(400).json({ error: "Unknown notification preference." });
      const merged = {
        ...current.preferences,
        ...body.preferences,
        notifications: { ...current.preferences.notifications, ...(isRecord(body.preferences.notifications) ? body.preferences.notifications : {}) },
      };
      const next = normalizedPreferences(merged);
      const rawWarning = Number(merged.budgetWarningPercent);
      const rawCritical = Number(merged.budgetCriticalPercent);
      if (!Number.isFinite(rawWarning) || rawWarning < 50 || rawWarning > 95) return res.status(400).json({ error: "budgetWarningPercent must be between 50 and 95." });
      if (!Number.isFinite(rawCritical) || rawCritical < 60 || rawCritical > 200 || rawCritical <= rawWarning) return res.status(400).json({ error: "budgetCriticalPercent must be between 60 and 200 and greater than the warning threshold." });
      if (!["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"].includes(merged.dateFormat)) return res.status(400).json({ error: "Unsupported dateFormat." });
      for (const key of allowedNotificationKeys) {
        if (typeof merged.notifications[key] !== "boolean") return res.status(400).json({ error: `notifications.${key} must be boolean.` });
      }
      preferences = next;
    }
    await connection.query("UPDATE AppSettings SET display_name=?, theme_mode=?, preferences=CAST(? AS JSON) WHERE id=1", [displayName, themeMode, JSON.stringify(preferences)]);
    const saved = await readSettings(connection);
    await connection.commit();
    committed = true;
    return res.json({ ...saved, message: "Settings saved." });
  } catch (error) {
    return sendServerError(res, error, "Settings update");
  } finally {
    if (!committed) { try { await connection.rollback(); } catch { /* transaction may already have rolled back */ } }
    connection.release();
  }
};

// ---------------------------------------------------------------------------
// In-app notifications: stable keys deduplicate daily progress / monthly budget
// updates. Read state is stored in MySQL, not browser-only storage. This is
// separate from Web Push delivery and makes no claim about push display.
// ---------------------------------------------------------------------------
async function upsertNotification(notification) {
  // Atomic upsert avoids duplicate-key races when multiple clients open the menu
  // at the same time. Read status is reset only when the notification's content
  // changes or an inactive notification becomes active again.
  await pool.query(
    `INSERT INTO AppNotifications (notification_key, title, message, level, route, is_read, is_active)
     VALUES (?, ?, ?, ?, ?, 0, 1)
     ON DUPLICATE KEY UPDATE
       is_read=IF(title<>VALUES(title) OR message<>VALUES(message) OR level<>VALUES(level) OR route<>VALUES(route) OR is_active=0, 0, is_read),
       title=VALUES(title), message=VALUES(message), level=VALUES(level), route=VALUES(route), is_active=1`,
    [notification.key, notification.title, notification.message, notification.level, notification.route],
  );
}

export const getNotifications = async (_req, res) => {
  try {
    const [settings, daily, budget] = await Promise.all([
      readSettings(),
      getDailyPacingStatus(),
      (async () => {
        const { year, month } = getKigaliTime();
        const start = monthStart(year, month);
        const [expenseRows] = await pool.query(
          "SELECT category, SUM(amount) AS spent FROM DailyExpense WHERE COALESCE(is_archived,0)=0 AND expenseDate >= ? GROUP BY category",
          [start],
        );
        const categories = new Set(["food", "rent", "miscellaneous", "phoneinternet", "electricitywater", "medical", "familysupport"]);
        const essentialsSpent = expenseRows.reduce((sum, row) => sum + (categories.has(normalizeCategory(row.category)) ? num(row.spent) : 0), 0);
        const [[budgetRow]] = await pool.query("SELECT recommendedEssentials FROM MonthlyBudget WHERE id=1");
        return { year, month, essentialsSpent: roundMoney(essentialsSpent), recommended: roundMoney(budgetRow?.recommendedEssentials) };
      })(),
    ]);

    const date = daily.date || getKigaliTime().dateString;
    const dailyNotificationKey = `daily-progress-${date}`;
    // Keep only today's progress reminder active; older records remain stored as history.
    await pool.query("UPDATE AppNotifications SET is_active=0 WHERE notification_key LIKE 'daily-progress-%'");
    if (settings.preferences.notifications.dailyTarget) {
      const noTarget = num(daily.dailyTarget) <= 0;
      const reached = !noTarget && Boolean(daily.targetReached);
      await upsertNotification({
        key: dailyNotificationKey,
        title: noTarget ? "Daily target not set" : reached ? "Daily letter target reached" : "Daily letter progress",
        message: noTarget
          ? "No active daily letter target is configured. Review shift setup on Overview."
          : reached
            ? `You have completed ${daily.dailyLetterCount} of ${daily.dailyTarget} letters for today.`
            : `${daily.dailyLetterCount} of ${daily.dailyTarget} letters completed; ${daily.dailyRemaining} remaining today. Current shift pace: ${daily.currentRequiredPerDay} letters/day.`,
        level: noTarget ? "info" : reached ? "success" : "info",
        route: "/",
      });
    }
    const dueThrough = plusDays(date, 7);
    const [dueBills] = await pool.query(
      `SELECT id, bill_name, amount, due_date FROM Bills
       WHERE is_archived=0 AND status='unpaid' AND notify_enabled=1 AND due_date <= ?
       ORDER BY due_date ASC LIMIT 100`,
      [dueThrough],
    );
    await pool.query(
      `UPDATE AppNotifications AS n SET is_active=0
       WHERE n.notification_key LIKE 'bill-due-%'
         AND NOT EXISTS (
           SELECT 1 FROM Bills b
           WHERE n.notification_key=CONCAT('bill-due-', b.id, '-', DATE_FORMAT(b.due_date, '%Y-%m-%d'))
             AND b.is_archived=0 AND b.status='unpaid' AND b.notify_enabled=1 AND b.due_date <= ?
         )`,
      [dueThrough],
    );
    for (const bill of dueBills) {
      const overdue = bill.due_date < date;
      await upsertNotification({
        key: `bill-due-${bill.id}-${bill.due_date}`,
        title: overdue ? `Overdue bill: ${bill.bill_name}` : `Bill due soon: ${bill.bill_name}`,
        message: `${roundMoney(bill.amount).toLocaleString()} RWF due ${bill.due_date}. Open Bills to review or record payment.`,
        level: overdue ? "critical" : "warning",
        route: "/bills",
      });
    }

    const budgetPct = budget.recommended > 0 ? Math.round((budget.essentialsSpent / budget.recommended) * 100) : 0;
    const budgetNotificationKey = `budget-${budget.year}-${String(budget.month).padStart(2, "0")}`;
    // Preserve older budget records but show only the latest month's live status.
    await pool.query("UPDATE AppNotifications SET is_active=0 WHERE notification_key LIKE 'budget-%'");
    if (settings.preferences.notifications.budgetAlerts && budget.recommended > 0) {
      const level = getBudgetAlertLevel(budgetPct, settings.preferences.budgetWarningPercent, settings.preferences.budgetCriticalPercent);
      await upsertNotification({
        key: budgetNotificationKey,
        title: level === "critical" ? "Budget alert" : level === "warning" ? "Spending warning" : "Essentials spending",
        message: `Essentials spending is ${budgetPct}% of the planned budget (${Math.round(budget.essentialsSpent).toLocaleString()} of ${Math.round(budget.recommended).toLocaleString()}). Thresholds: warning ${settings.preferences.budgetWarningPercent}%, critical ${settings.preferences.budgetCriticalPercent}%.`,
        level,
        route: "/expenses",
      });
    }
    const [rows] = await pool.query("SELECT id, notification_key, title, message, level, route, is_read, created_at, updated_at FROM AppNotifications WHERE is_active=1 ORDER BY updated_at DESC, id DESC LIMIT 50");
    return res.json(rows.map((row) => ({ id: Number(row.id), key: row.notification_key, title: row.title, message: row.message, level: row.level, route: row.route, isRead: Boolean(row.is_read), createdAt: row.created_at, updatedAt: row.updated_at })));
  } catch (error) { return sendServerError(res, error, "Notifications"); }
};

export const markNotificationRead = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid notification id." });
  try {
    const [[row]] = await pool.query("SELECT id FROM AppNotifications WHERE id=?", [id]);
    if (!row) return res.status(404).json({ error: "Notification not found." });
    await pool.query("UPDATE AppNotifications SET is_read=1 WHERE id=?", [id]);
    return res.json({ message: "Notification marked as read." });
  } catch (error) { return sendServerError(res, error, "Notification update"); }
};

export const markAllNotificationsRead = async (_req, res) => {
  try {
    const [result] = await pool.query("UPDATE AppNotifications SET is_read=1 WHERE is_read=0");
    return res.json({ message: "Notifications marked as read.", updatedCount: result.affectedRows });
  } catch (error) { return sendServerError(res, error, "Mark all notifications read"); }
};

// ---------------------------------------------------------------------------
// Action Center — computed, stable records from due bills and contractual debt
// dates. There is no Action Center page/component in the supplied frontend;
// this endpoint is ready for that UI without modifying a protected module.
// ---------------------------------------------------------------------------
export const getActionCenter = async (_req, res) => {
  const { dateString: today } = getKigaliTime();
  const dueThrough = plusDays(today, 7);
  try {
    const [bills] = await pool.query(
      `SELECT id, bill_name, amount, due_date, status FROM Bills
       WHERE is_archived=0 AND status='unpaid' AND due_date <= ? ORDER BY due_date ASC LIMIT 100`,
      [dueThrough],
    );
    const [debts] = await pool.query(
      `SELECT id, creditor, debt_type, current_balance, minimum_payment, due_date FROM Debts
       WHERE is_archived=0 AND status='active' AND current_balance > 0 AND due_date IS NOT NULL AND due_date <= ? ORDER BY due_date ASC LIMIT 100`,
      [dueThrough],
    );
    const items = [
      ...bills.map((row) => ({ id: `bill-${row.id}`, entityType: "bill", entityId: Number(row.id), title: row.due_date < today ? `Overdue bill: ${row.bill_name}` : `Bill due: ${row.bill_name}`, message: `${roundMoney(row.amount).toLocaleString()} RWF due ${row.due_date}.`, dueDate: row.due_date, severity: row.due_date < today ? "critical" : "warning", actionLabel: "Open bill", route: "/bills" })),
      ...debts.map((row) => ({ id: `debt-${row.id}`, entityType: "debt", entityId: Number(row.id), title: `Debt payment due: ${row.creditor}`, message: `Outstanding balance ${roundMoney(row.current_balance).toLocaleString()} RWF${row.minimum_payment == null ? "" : `; stated minimum payment ${roundMoney(row.minimum_payment).toLocaleString()} RWF`} due ${row.due_date}.`, dueDate: row.due_date, severity: row.due_date < today ? "critical" : "warning", actionLabel: "Review debt", route: "/debt" })),
    ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return res.json({ asOfDate: today, dueThrough, count: items.length, items });
  } catch (error) { return sendServerError(res, error, "Action Center"); }
};
