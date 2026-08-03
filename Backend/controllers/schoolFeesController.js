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
