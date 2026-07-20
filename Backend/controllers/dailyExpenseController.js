import DailyExpense from "../models/DailyExpense.js";
import { MonthlyBudget } from "../models/MonthlyBudget.js";
import { pool } from "../models/MonthlyBudget.js";

/**
 * Helper: safe number parse
 */
const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

// ==========================================
// 1. GET ALL EXPENSES
// ==========================================
export const getExpenses = async (req, res) => {
  try {
    const [rows] = await DailyExpense.getAll();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// 2. ADD EXPENSE (WITH AUTO-BALANCE RECALC)
// ==========================================
export const addExpense = async (req, res) => {
  try {
    const { expenseDate, description, category, amount, notes } = req.body;
    const numAmount = n(amount);

    // List of valid categories to prevent database garbage entries
    const validColumns = [
      "phoneInternet",
      "electricityWater",
      "medical",
      "familySupport",
      "miscellaneous",
      "food",
      "rent",
      "schoolSaving",
      "emergencyFund",
      "investment",
    ];

    // Check category validity, fallback to miscellaneous if missing
    const finalCategory = validColumns.includes(category)
      ? category
      : "miscellaneous";

    // A. Save to DailyExpense Table
    await DailyExpense.create({
      expenseDate,
      description,
      category: finalCategory,
      amount: numAmount,
      notes: notes || "",
    });

    // B. Extract numeric month and year directly from the YYYY-MM-DD input string
    // This string-split method avoids nasty timezone shift bugs (e.g. UTC shifting July 1st to June 30th)
    const [yearStr, monthStr] = expenseDate.split("-");
    const month = Number(monthStr);
    const year = Number(yearStr);

    // C. Re-calculate actual remaining cash balance dynamically
    if (month && year) {
      await MonthlyBudget.recalculateBalance(month, year);
    }

    res
      .status(201)
      .json({ message: "Expense saved and Budget balance updated!" });
  } catch (err) {
    console.error("Add Expense Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// 3. DELETE EXPENSE (WITH AUTO-BALANCE RECALC)
// ==========================================
export const deleteExpense = async (req, res) => {
  try {
    const expenseId = req.params.id;

    // A. Find the expense date BEFORE deleting it, so we know which month to recalculate
    const [expenseRows] = await pool.query(
      "SELECT expenseDate FROM DailyExpense WHERE id = ?",
      [expenseId],
    );

    if (expenseRows.length === 0) {
      return res.status(404).json({ error: "Expense not found" });
    }

    const rawDate = expenseRows[0].expenseDate;

    // B. Delete the expense record
    await DailyExpense.delete(expenseId);

    // C. Extract numeric month and year safely from the retrieved MySQL DATE object
    const dateObj = new Date(rawDate);
    // Using UTC methods prevents local timezone offsets from changing the day/month
    const month = dateObj.getUTCMonth() + 1;
    const year = dateObj.getUTCFullYear();

    // D. Re-calculate the budget balance (this essentially "refunds" the cash back to you)
    if (month && year) {
      await MonthlyBudget.recalculateBalance(month, year);
    }

    res.json({ message: "Expense deleted and balance updated!" });
  } catch (err) {
    console.error("Delete Expense Error:", err);
    res.status(500).json({ error: err.message });
  }
};
