import express from "express";
import {
  getInvestments,
  createInvestment,
  updateValuation,
  deleteInvestment,
  deployReserve, // 1. Import deployReserve
} from "../controllers/investmentController.js";
import { pool } from "../models/MonthlyBudget.js";

const router = express.Router();

// Helper to ensure InvestmentReserve table exists
const ensureTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS InvestmentReserve (
      id INT PRIMARY KEY AUTO_INCREMENT,
      amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00
    )
  `);
};

// Reserve Pool Endpoints
router.get("/reserve", async (req, res) => {
  try {
    await ensureTable();
    const [rows] = await pool.query(
      "SELECT amount FROM InvestmentReserve ORDER BY id DESC LIMIT 1",
    );
    res.json(rows[0] || { amount: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const handleReserveUpdate = async (req, res) => {
  const { amount } = req.body;
  const numAmount = Number(amount) || 0;

  try {
    await ensureTable();
    const [existing] = await pool.query(
      "SELECT id FROM InvestmentReserve ORDER BY id DESC LIMIT 1",
    );

    if (existing.length > 0) {
      await pool.query(
        "UPDATE InvestmentReserve SET amount = COALESCE(amount, 0) + ? WHERE id = ?",
        [numAmount, existing[0].id],
      );
    } else {
      await pool.query(
        "INSERT INTO InvestmentReserve (id, amount) VALUES (1, ?)",
        [numAmount],
      );
    }

    res.json({ message: "Investment reserve updated successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

router.put("/reserve", handleReserveUpdate);
router.post("/reserve", handleReserveUpdate);

// Asset Holdings Endpoints
router.get("/", getInvestments);
router.post("/", createInvestment);
router.put("/:id", updateValuation);
router.delete("/:id", deleteInvestment);
router.post("/deploy", deployReserve);

export default router;
