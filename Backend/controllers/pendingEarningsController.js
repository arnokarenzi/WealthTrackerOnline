// pendingEarningsController.js
import { pool } from "../models/MonthlyBudget.js";

// Fetch all uncollected shift earnings
export const getPendingEarnings = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM PendingEarnings WHERE is_collected = FALSE ORDER BY earned_date DESC",
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Get Pending Earnings Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Check off / Claim a pending payout and move it directly to the wallet balance
export const claimPendingEarning = async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch the target pending earning
    const [items] = await connection.query(
      "SELECT * FROM PendingEarnings WHERE id = ? AND is_collected = FALSE",
      [id],
    );

    if (items.length === 0) {
      await connection.release();
      return res
        .status(404)
        .json({ error: "Pending payout not found or already collected." });
    }

    const earning = items[0];
    const payoutAmount = Number(earning.amount);

    // 2. Add amount to active wallet balance in MonthlyBudget
    await connection.query(
      "UPDATE MonthlyBudget SET balance = balance + ? WHERE id = 1",
      [payoutAmount],
    );

    // 3. Mark the pending earning as collected
    await connection.query(
      "UPDATE PendingEarnings SET is_collected = TRUE WHERE id = ?",
      [id],
    );

    await connection.commit();
    connection.release();

    res.status(200).json({
      message: "Payout checked off successfully and added to wallet balance!",
      collectedAmount: payoutAmount,
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error("Claim Payout Transaction Error:", err);
    res.status(500).json({ error: err.message });
  }
};
