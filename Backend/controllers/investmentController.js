import ActualInvestments from "../models/ActualInvestments.js";
import { pool } from "../models/MonthlyBudget.js";

export const getInvestments = async (req, res) => {
  try {
    const data = await ActualInvestments.getAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createInvestment = async (req, res) => {
  const { asset_name, principal_invested, month, year } = req.body;
  try {
    const result = await ActualInvestments.addInvestment(
      asset_name,
      principal_invested,
      month,
      year,
    );
    res.status(201).json({
      message: "Investment recorded successfully!",
      id: result.insertId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateValuation = async (req, res) => {
  const { id } = req.params;
  const { current_value } = req.body;
  try {
    await ActualInvestments.updateValue(id, current_value);
    res.json({ message: "Asset valuation updated successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteInvestment = async (req, res) => {
  const { id } = req.params;
  try {
    await ActualInvestments.deleteInvestment(id);
    res.json({ message: "Asset record deleted successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// DEDUCT FROM RESERVE & DEPLOY TO ASSET
// ==========================================
export const deployReserve = async (req, res) => {
  // 0. Auto-patch schema: ensure table & asset_type column exist
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ActualInvestments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        asset_name VARCHAR(255) NOT NULL,
        asset_type VARCHAR(100) DEFAULT 'Bond',
        principal_invested DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        current_value DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        month INT,
        year INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Safely add missing asset_type column to existing table
    await pool.query(`
      ALTER TABLE ActualInvestments 
      ADD COLUMN asset_type VARCHAR(100) DEFAULT 'Bond'
    `);
  } catch (schemaErr) {
    // ER_DUP_FIELDNAME (errno 1060 / sqlState 42S21) means column already exists
    if (schemaErr.errno !== 1060 && schemaErr.code !== "ER_DUP_FIELDNAME") {
      console.warn("Schema patch notice:", schemaErr.message);
    }
  }

  const connection = await pool.getConnection();

  try {
    const { asset_name, asset_type, amount } = req.body;
    const numAmount = Number(amount);

    if (!asset_name || isNaN(numAmount) || numAmount <= 0) {
      connection.release();
      return res
        .status(400)
        .json({
          error: "Please provide a valid asset name and numeric amount.",
        });
    }

    await connection.beginTransaction();

    // 1. Fetch current Investment Reserve balance
    const [reserveRows] = await connection.query(
      "SELECT amount FROM InvestmentReserve WHERE id = 1",
    );
    const currentReserve = Number(reserveRows[0]?.amount || 0);

    if (currentReserve < numAmount) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        error: `Insufficient Investment Reserve balance. Available: ${currentReserve.toLocaleString()} RWF`,
      });
    }

    // 2. Deduct specified amount from InvestmentReserve
    await connection.query(
      "UPDATE InvestmentReserve SET amount = GREATEST(0, COALESCE(amount, 0) - ?) WHERE id = 1",
      [numAmount],
    );

    // 3. Create new holding record in ActualInvestments
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [result] = await connection.query(
      "INSERT INTO ActualInvestments (asset_name, asset_type, principal_invested, current_value, month, year) VALUES (?, ?, ?, ?, ?, ?)",
      [asset_name, asset_type || "Bond", numAmount, numAmount, month, year],
    );

    await connection.commit();

    res.status(201).json({
      message:
        "Deducted from Investment Reserve and asset deployed successfully!",
      id: result.insertId,
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (rbErr) {
      // Ignore rollback failure if connection/transaction closed
    }
    console.error("Deploy Reserve Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};
