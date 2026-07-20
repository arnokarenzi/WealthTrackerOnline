import SchoolFees from "../models/SchoolFees.js";

export const getFeesHistory = async (req, res) => {
  try {
    const [rows] = await SchoolFees.getAll();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

import { pool } from "../models/MonthlyBudget.js";

export const resetSchoolFeesOnly = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Clear the School Fees history table
    await connection.query("DELETE FROM SchoolFees");

    // 2. Reset only the School Fees Buffer goal in the SavingsGoal table
    await connection.query(`
      UPDATE SavingsGoal 
      SET currentSaved = 0, 
          remaining = targetAmount, 
          progress = 0, 
          status = 'In progress'
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
