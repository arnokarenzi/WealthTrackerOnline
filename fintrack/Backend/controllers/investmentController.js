import ActualInvestments from "../models/ActualInvestments.js";
import { pool } from "../models/MonthlyBudget.js";

// Helper utility to convert current system time to Africa/Kigali timezone (CAT / UTC+2)
const getKigaliDateParts = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "numeric",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((p) => [p.type, p.value]),
  );

  return {
    month: parseInt(parts.month, 10),
    year: parseInt(parts.year, 10),
  };
};

const ensureInvestmentReserveSchema = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS InvestmentReserve (
        id INT PRIMARY KEY AUTO_INCREMENT,
        amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        target_amount DECIMAL(15, 2) NOT NULL DEFAULT 2000000.00
      )
    `);

    await pool.query(`
      ALTER TABLE InvestmentReserve 
      ADD COLUMN target_amount DECIMAL(15, 2) DEFAULT 2000000.00
    `);
  } catch (schemaErr) {
    if (schemaErr.errno !== 1060 && schemaErr.code !== "ER_DUP_FIELDNAME") {
      console.warn("InvestmentReserve schema notice:", schemaErr.message);
    }
  }
};

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

// =========================================================================
// OPTION 1: DELETE INVESTMENT ASSET & REFUND PRINCIPAL TO INVESTMENT RESERVE
// =========================================================================
export const deleteInvestment = async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Retrieve principal amount before deleting asset record
    const [rows] = await connection.query(
      "SELECT principal_invested FROM ActualInvestments WHERE id = ?",
      [id],
    );

    if (rows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: "Investment asset not found." });
    }

    const refundedAmount = Number(rows[0].principal_invested || 0);

    // 2. Delete asset record
    await connection.query("DELETE FROM ActualInvestments WHERE id = ?", [id]);

    // 3. Refund principal amount back to InvestmentReserve
    if (refundedAmount > 0) {
      await ensureInvestmentReserveSchema();
      const [reserveRows] = await connection.query(
        "SELECT id FROM InvestmentReserve ORDER BY id DESC LIMIT 1",
      );

      if (reserveRows.length > 0) {
        await connection.query(
          "UPDATE InvestmentReserve SET amount = COALESCE(amount, 0) + ? WHERE id = ?",
          [refundedAmount, reserveRows[0].id],
        );
      } else {
        await connection.query(
          "INSERT INTO InvestmentReserve (id, amount, target_amount) VALUES (1, ?, 2000000.00)",
          [refundedAmount],
        );
      }
    }

    await connection.commit();

    res.json({
      message:
        "Asset record deleted and principal refunded to Investment Reserve!",
      refundedAmount,
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (rbErr) {}
    console.error("Delete Investment Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

// ==========================================
// INVESTMENT RESERVE ENDPOINTS (GET & UPDATE)
// ==========================================
export const getInvestmentReserve = async (req, res) => {
  try {
    await ensureInvestmentReserveSchema();
    const [rows] = await pool.query(
      "SELECT amount, target_amount FROM InvestmentReserve WHERE id = 1 LIMIT 1",
    );
    if (rows.length === 0) {
      return res.json({ amount: 0, target_amount: 2000000 });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateInvestmentReserve = async (req, res) => {
  const { amount, current_amount, currentAmount, targetAmount, target_amount } =
    req.body;
  const numAmount = amount ?? current_amount ?? currentAmount;
  const numTarget = targetAmount ?? target_amount;

  try {
    await ensureInvestmentReserveSchema();
    const [rows] = await pool.query(
      "SELECT id FROM InvestmentReserve WHERE id = 1 LIMIT 1",
    );

    if (rows.length === 0) {
      await pool.query(
        "INSERT INTO InvestmentReserve (id, amount, target_amount) VALUES (1, ?, ?)",
        [Number(numAmount || 0), Number(numTarget || 2000000)],
      );
    } else {
      if (numAmount !== undefined && numTarget !== undefined) {
        await pool.query(
          "UPDATE InvestmentReserve SET amount = ?, target_amount = ? WHERE id = 1",
          [Number(numAmount), Number(numTarget)],
        );
      } else if (numTarget !== undefined) {
        await pool.query(
          "UPDATE InvestmentReserve SET target_amount = ? WHERE id = 1",
          [Number(numTarget)],
        );
      } else if (numAmount !== undefined) {
        await pool.query(
          "UPDATE InvestmentReserve SET amount = ? WHERE id = 1",
          [Number(numAmount)],
        );
      }
    }

    res.json({ message: "Investment reserve updated successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==========================================
// DEDUCT FROM RESERVE & DEPLOY TO ASSET
// ==========================================
export const deployReserve = async (req, res) => {
  await ensureInvestmentReserveSchema();

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

    await pool.query(`
      ALTER TABLE ActualInvestments 
      ADD COLUMN asset_type VARCHAR(100) DEFAULT 'Bond'
    `);
  } catch (schemaErr) {
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
      return res.status(400).json({
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

    // 3. Create new holding record in ActualInvestments using Kigali month/year
    const { month, year } = getKigaliDateParts();

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
    } catch (rbErr) {}
    console.error("Deploy Reserve Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};
