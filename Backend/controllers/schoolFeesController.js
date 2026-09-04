import SchoolFees from "../models/SchoolFees.js";
import { pool } from "../models/MonthlyBudget.js";

export const getFeesHistory = async (req, res) => {
  try {
    const [rows] = await SchoolFees.getAll();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const resetSchoolFeesOnly = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Clear the School Fees history table
    await connection.query("DELETE FROM SchoolFees");

    // 2. Reset only the School Fees Buffer goal using the correct currentAmount column
    await connection.query(`
      UPDATE SavingsGoals 
      SET currentAmount = 0 
      WHERE goalName = 'School Fees Buffer'
    `);

    await connection.commit();
    res.json({ message: "School fees history and progress have been reset." });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

export const addSchoolFees = async (req, res) => {
  const { amountSaved } = req.body;
  // Use numeric month (1-12) to match MySQL INT column definition
  const currentMonth = new Date().getMonth() + 1;

  try {
    const numAmount = Number(amountSaved);
    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ error: "Invalid amount provided." });
    }

    // Check if an entry exists for the current month
    const [existing] = await pool.query(
      "SELECT id FROM SchoolFees WHERE month = ? ORDER BY id DESC LIMIT 1",
      [currentMonth],
    );

    if (existing.length > 0) {
      // Overwrite the balance directly for the current month
      await pool.query(
        "UPDATE SchoolFees SET amountSaved = ?, cumulative = ? WHERE id = ?",
        [numAmount, numAmount, existing[0].id],
      );
    } else {
      // Insert a new baseline record with the specified balance
      await pool.query(
        "INSERT INTO SchoolFees (month, amountSaved, cumulative) VALUES (?, ?, ?)",
        [currentMonth, numAmount, numAmount],
      );
    }

    res
      .status(200)
      .json({ message: "School fees balance updated successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET active term target configuration
export const getActiveTermConfig = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, term_name, target_amount FROM TermConfig WHERE is_active = TRUE LIMIT 1"
    );

    if (rows.length === 0) {
      return res.json({ id: null, term_name: "Current Term", target_amount: 500000 });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT active term target configuration
export const updateTermConfig = async (req, res) => {
  const { targetAmount, termName } = req.body;

  const numTarget = Number(targetAmount);
  if (isNaN(numTarget) || numTarget <= 0) {
    return res.status(400).json({ error: "Valid targetAmount is required." });
  }

  try {
    const [existing] = await pool.query(
      "SELECT id FROM TermConfig WHERE is_active = TRUE LIMIT 1"
    );

    if (existing.length > 0) {
      await pool.query(
        "UPDATE TermConfig SET target_amount = ?, term_name = COALESCE(?, term_name) WHERE is_active = TRUE",
        [numTarget, termName || null]
      );
    } else {
      await pool.query(
        "INSERT INTO TermConfig (term_name, target_amount, is_active) VALUES (?, ?, TRUE)",
        [termName || "Current Term", numTarget]
      );
    }

    res.json({ message: "Term target updated successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
