import { pool } from "../models/MonthlyBudget.js";

export const getEmergencyFund = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT current_amount FROM EmergencyFund WHERE id = 1 LIMIT 1",
    );
    res.json(rows[0] || { current_amount: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateEmergencyFund = async (req, res) => {
  const { current_amount } = req.body;
  try {
    await pool.query(
      "UPDATE EmergencyFund SET current_amount = ? WHERE id = 1",
      [current_amount],
    );
    res.json({ message: "Emergency fund updated!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deployEmergencyFund = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { amount } = req.body;
    const deployAmount = Number(amount);

    if (isNaN(deployAmount) || deployAmount <= 0) {
      connection.release();
      return res.status(400).json({ error: "Invalid deployment amount." });
    }

    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT id, current_amount FROM EmergencyFund WHERE id = 1 LIMIT 1"
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ error: "Emergency fund record not found." });
    }

    const currentBalance = Number(rows[0].current_amount || 0);
    if (deployAmount > currentBalance) {
      connection.release();
      return res.status(400).json({ error: "Amount exceeds current emergency reserve balance." });
    }

    // 1. Deduct from Emergency Fund pool using primary key `id`
    await connection.query(
      "UPDATE EmergencyFund SET current_amount = current_amount - ? WHERE id = 1",
      [deployAmount]
    );

    // 2. Return/add funds back to the main MonthlyBudget wallet balance
    const [mbRows] = await connection.query(
      "SELECT id FROM MonthlyBudget WHERE id = 1"
    );
    if (mbRows.length > 0) {
      await connection.query(
        "UPDATE MonthlyBudget SET balance = balance + ? WHERE id = ?",
        [deployAmount, mbRows[0].id]
      );
    }

    await connection.commit();
    res.json({ message: "Emergency funds deployed to wallet successfully!" });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (rbErr) {}
    console.error("Emergency Deploy Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};
