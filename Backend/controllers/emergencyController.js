import { pool } from "../models/MonthlyBudget.js";

export const getEmergencyFund = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT current_amount FROM EmergencyFund WHERE user_id = 1 LIMIT 1",
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
      "UPDATE EmergencyFund SET current_amount = ? WHERE user_id = 1",
      [current_amount],
    );
    res.json({ message: "Emergency fund updated!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
