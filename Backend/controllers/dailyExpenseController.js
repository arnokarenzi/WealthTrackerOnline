import DailyExpense from "../models/DailyExpense.js";
import { MonthlyBudget } from "../models/MonthlyBudget.js";
import { pool } from "../models/MonthlyBudget.js";

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
// 2. ADD EXPENSE (WITH AUTO-WALLET BALANCE DEDUCTION)
// ==========================================
export const addExpense = async (req, res) => {
  try {
    const { expenseDate, description, category, amount, notes } = req.body;
    const numAmount = n(amount);

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

    const finalCategory = validColumns.includes(category)
      ? category
      : "miscellaneous";

    // Capture the MySQL insert result to obtain the auto-incremented ID
    const [result] = await DailyExpense.create({
      expenseDate,
      description,
      category: finalCategory,
      amount: numAmount,
      notes: notes || "",
    });

    // Automatically deduct the expense amount from the active wallet balance
    await pool.query(
      "UPDATE MonthlyBudget SET balance = balance - ? WHERE id = 1",
      [numAmount],
    );

    res.status(201).json({
      message: "Expense saved and Wallet balance updated!",
      id: result.insertId, // 🌟 Return the actual database ID back to the frontend
      expenseDate,
      description,
      category: finalCategory,
      amount: numAmount,
    });
  } catch (err) {
    console.error("Add Expense Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// 3. DELETE EXPENSE (WITH AUTO-WALLET BALANCE RESTORE)
// ==========================================
export const deleteExpense = async (req, res) => {
  try {
    const expenseId = req.params.id;

    const [expenseRows] = await pool.query(
      "SELECT expenseDate, amount FROM DailyExpense WHERE id = ?",
      [expenseId],
    );

    if (expenseRows.length === 0) {
      return res.status(404).json({ error: "Expense not found" });
    }

    const expenseAmount = n(expenseRows[0].amount);

    await DailyExpense.delete(expenseId);

    // Automatically restore the deleted expense amount back to the wallet balance
    await pool.query(
      "UPDATE MonthlyBudget SET balance = balance + ? WHERE id = 1",
      [expenseAmount],
    );

    res.json({ message: "Expense deleted and balance updated!" });
  } catch (err) {
    console.error("Delete Expense Error:", err);
    res.status(500).json({ error: err.message });
  }
};
