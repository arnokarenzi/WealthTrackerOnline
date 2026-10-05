import SchoolFees from "../models/SchoolFees.js";
import { pool } from "../models/MonthlyBudget.js";

// Helper utility to convert current system time to Africa/Kigali timezone (CAT / UTC+2)
const getKigaliMonth = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Kigali",
    month: "numeric",
  });
  return parseInt(formatter.format(now), 10);
};

const ensureSchoolFeesSchema = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS SchoolFees (
        id INT PRIMARY KEY AUTO_INCREMENT,
        month INT NOT NULL,
        amountSaved DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        cumulative DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.warn("SchoolFees schema notice:", err.message);
  }
};

const ensureTermConfigSchema = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS TermConfig (
        id INT PRIMARY KEY AUTO_INCREMENT,
        term_name VARCHAR(255) DEFAULT 'Current Term',
        target_amount DECIMAL(15, 2) NOT NULL DEFAULT 500000.00,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);
  } catch (err) {
    console.warn("TermConfig schema notice:", err.message);
  }
};

export const getFeesHistory = async (req, res) => {
  try {
    await ensureSchoolFeesSchema();
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

    await connection.query("DELETE FROM SchoolFees");
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
  const currentMonth = getKigaliMonth();

  try {
    await ensureSchoolFeesSchema();
    const numAmount = Number(amountSaved);
    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ error: "Invalid amount provided." });
    }

    const [existing] = await pool.query(
      "SELECT id FROM SchoolFees WHERE month = ? ORDER BY id DESC LIMIT 1",
      [currentMonth],
    );

    if (existing.length > 0) {
      await pool.query(
        "UPDATE SchoolFees SET amountSaved = ?, cumulative = ? WHERE id = ?",
        [numAmount, numAmount, existing[0].id],
      );
    } else {
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
    await ensureTermConfigSchema();
    const [rows] = await pool.query(
      "SELECT id, term_name, target_amount FROM TermConfig WHERE is_active = TRUE LIMIT 1",
    );

    if (rows.length === 0) {
      return res.json({
        id: null,
        term_name: "Current Term",
        target_amount: 500000,
      });
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
    await ensureTermConfigSchema();
    const [existing] = await pool.query(
      "SELECT id FROM TermConfig WHERE is_active = TRUE LIMIT 1",
    );

    if (existing.length > 0) {
      await pool.query(
        "UPDATE TermConfig SET target_amount = ?, term_name = COALESCE(?, term_name) WHERE is_active = TRUE",
        [numTarget, termName || null],
      );
    } else {
      await pool.query(
        "INSERT INTO TermConfig (term_name, target_amount, is_active) VALUES (?, ?, TRUE)",
        [termName || "Current Term", numTarget],
      );
    }

    res.json({ message: "Term target updated successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
