import DailyExpense from "../models/DailyExpense.js";
import { pool } from "../models/MonthlyBudget.js";

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

// 1. GET ALL ACTIVE (UNARCHIVED) EXPENSES
export const getExpenses = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM DailyExpense WHERE is_archived = 0 ORDER BY expenseDate DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. GET ARCHIVED EXPENSE HISTORY BY DATE RANGE
export const getExpenseHistory = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "startDate and endDate parameters are required." });
    }

    const [rows] = await pool.query(
      `SELECT * FROM DailyExpense 
       WHERE is_archived = 1 
         AND expenseDate BETWEEN ? AND ? 
       ORDER BY expenseDate DESC`,
      [startDate, endDate]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. ADD EXPENSE
export const addExpense = async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS InvestmentReserve (
        id INT PRIMARY KEY AUTO_INCREMENT,
        amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00
      )
    `);
  } catch (tblErr) {
    console.warn("InvestmentReserve table check warning:", tblErr.message);
  }

  const connection = await pool.getConnection();

  try {
    const { expenseDate, description, category, amount, notes } = req.body;
    const numAmount = n(amount);

    const catInput = (category || "").toString().toLowerCase().trim();
    let finalCategory = "miscellaneous";

    if (catInput.includes("emergency")) finalCategory = "emergencyFund";
    else if (catInput.includes("school")) finalCategory = "schoolSaving";
    else if (catInput.includes("invest")) finalCategory = "investment";
    else finalCategory = category || "miscellaneous";

    await connection.beginTransaction();

    const [result] = await connection.query(
      "INSERT INTO DailyExpense (expenseDate, description, category, amount, notes, is_archived) VALUES (?, ?, ?, ?, ?, 0)",
      [
        expenseDate || new Date().toISOString().split("T")[0],
        description || "",
        finalCategory,
        numAmount,
        notes || "",
      ]
    );

    const [mbRows] = await connection.query(
      "SELECT id FROM MonthlyBudget WHERE id = 1"
    );
    if (mbRows.length > 0) {
      await connection.query(
        "UPDATE MonthlyBudget SET balance = balance - ? WHERE id = 1",
        [numAmount]
      );
    }

    if (finalCategory === "emergencyFund") {
      const [emRows] = await connection.query(
        "SELECT id FROM EmergencyFund ORDER BY id DESC LIMIT 1"
      );
      if (emRows.length > 0) {
        await connection.query(
          "UPDATE EmergencyFund SET current_amount = COALESCE(current_amount, 0) + ? WHERE id = ?",
          [numAmount, emRows[0].id]
        );
      } else {
        await connection.query(
          "INSERT INTO EmergencyFund (id, current_amount) VALUES (1, ?)",
          [numAmount]
        );
      }
    } else if (finalCategory === "schoolSaving") {
      const currentMonthInt = new Date().getMonth() + 1;
      const [existing] = await connection.query(
        "SELECT id FROM SchoolFees ORDER BY id DESC LIMIT 1"
      );

      if (existing.length > 0) {
        await connection.query(
          "UPDATE SchoolFees SET amountSaved = COALESCE(amountSaved, 0) + ?, cumulative = COALESCE(cumulative, 0) + ? WHERE id = ?",
          [numAmount, numAmount, existing[0].id]
        );
      } else {
        await connection.query(
          "INSERT INTO SchoolFees (month, amountSaved, cumulative) VALUES (?, ?, ?)",
          [currentMonthInt, numAmount, numAmount]
        );
      }
    } else if (finalCategory === "investment") {
      const [invRows] = await connection.query(
        "SELECT id FROM InvestmentReserve ORDER BY id DESC LIMIT 1"
      );
      if (invRows.length > 0) {
        await connection.query(
          "UPDATE InvestmentReserve SET amount = COALESCE(amount, 0) + ? WHERE id = ?",
          [numAmount, invRows[0].id]
        );
      } else {
        await connection.query(
          "INSERT INTO InvestmentReserve (id, amount) VALUES (1, ?)",
          [numAmount]
        );
      }
    }

    await connection.commit();

    res.status(201).json({
      message: "Expense saved!",
      id: result.insertId,
      expenseDate,
      description,
      category: finalCategory,
      amount: numAmount,
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (rbErr) {}
    console.error("Add Expense Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

// 4. DELETE EXPENSE
export const deleteExpense = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const expenseId = req.params.id;

    const [expenseRows] = await connection.query(
      "SELECT expenseDate, category, amount FROM DailyExpense WHERE id = ?",
      [expenseId]
    );

    if (expenseRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "Expense not found" });
    }

    const { category, amount } = expenseRows[0];
    const expenseAmount = n(amount);

    await connection.beginTransaction();

    await connection.query("DELETE FROM DailyExpense WHERE id = ?", [
      expenseId,
    ]);

    await connection.query(
      "UPDATE MonthlyBudget SET balance = balance + ? WHERE id = 1",
      [expenseAmount]
    );

    const catLower = (category || "").toLowerCase();

    if (catLower.includes("emergency")) {
      const [emRows] = await connection.query(
        "SELECT id FROM EmergencyFund ORDER BY id DESC LIMIT 1"
      );
      if (emRows.length > 0) {
        await connection.query(
          "UPDATE EmergencyFund SET current_amount = GREATEST(0, COALESCE(current_amount, 0) - ?) WHERE id = ?",
          [expenseAmount, emRows[0].id]
        );
      }
    } else if (catLower.includes("school")) {
      const [existing] = await connection.query(
        "SELECT id FROM SchoolFees ORDER BY id DESC LIMIT 1"
      );

      if (existing.length > 0) {
        await connection.query(
          "UPDATE SchoolFees SET amountSaved = GREATEST(0, COALESCE(amountSaved, 0) - ?), cumulative = GREATEST(0, COALESCE(cumulative, 0) - ?) WHERE id = ?",
          [expenseAmount, expenseAmount, existing[0].id]
        );
      }
    } else if (catLower.includes("invest")) {
      const [invRows] = await connection.query(
        "SELECT id FROM InvestmentReserve ORDER BY id DESC LIMIT 1"
      );
      if (invRows.length > 0) {
        await connection.query(
          "UPDATE InvestmentReserve SET amount = GREATEST(0, COALESCE(amount, 0) - ?) WHERE id = ?",
          [expenseAmount, invRows[0].id]
        );
      }
    }

    await connection.commit();

    res.json({ message: "Expense deleted successfully!" });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (rbErr) {}
    console.error("Delete Expense Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};
