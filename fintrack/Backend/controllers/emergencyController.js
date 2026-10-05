import { pool } from "../models/MonthlyBudget.js";

const ensureEmergencyTableSchema = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS EmergencyFund (
        id INT PRIMARY KEY AUTO_INCREMENT,
        current_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        target_amount DECIMAL(15, 2) NOT NULL DEFAULT 1000000.00
      )
    `);
    await pool.query(`
      ALTER TABLE EmergencyFund 
      ADD COLUMN target_amount DECIMAL(15, 2) DEFAULT 1000000.00
    `);
  } catch (schemaErr) {
    if (schemaErr.errno !== 1060 && schemaErr.code !== "ER_DUP_FIELDNAME") {
      console.warn("EmergencyFund schema notice:", schemaErr.message);
    }
  }
};

export const getEmergencyFund = async (req, res) => {
  try {
    await ensureEmergencyTableSchema();
    const [rows] = await pool.query(
      "SELECT id, current_amount, target_amount FROM EmergencyFund WHERE id = 1 LIMIT 1",
    );
    if (rows.length === 0) {
      return res.json({ current_amount: 0, target_amount: 1000000 });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateEmergencyFund = async (req, res) => {
  const { current_amount, currentAmount, target_amount, targetAmount } =
    req.body;
  const numCurrent = current_amount ?? currentAmount;
  const numTarget = target_amount ?? targetAmount;

  try {
    await ensureEmergencyTableSchema();
    const [rows] = await pool.query(
      "SELECT id FROM EmergencyFund WHERE id = 1 LIMIT 1",
    );

    if (rows.length === 0) {
      await pool.query(
        "INSERT INTO EmergencyFund (id, current_amount, target_amount) VALUES (1, ?, ?)",
        [Number(numCurrent || 0), Number(numTarget || 1000000)],
      );
    } else {
      if (numCurrent !== undefined && numTarget !== undefined) {
        await pool.query(
          "UPDATE EmergencyFund SET current_amount = ?, target_amount = ? WHERE id = 1",
          [Number(numCurrent), Number(numTarget)],
        );
      } else if (numTarget !== undefined) {
        await pool.query(
          "UPDATE EmergencyFund SET target_amount = ? WHERE id = 1",
          [Number(numTarget)],
        );
      } else if (numCurrent !== undefined) {
        await pool.query(
          "UPDATE EmergencyFund SET current_amount = ? WHERE id = 1",
          [Number(numCurrent)],
        );
      }
    }

    res.json({ message: "Emergency fund updated!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const depositEmergencyFund = async (req, res) => {
  await ensureEmergencyTableSchema();
  const connection = await pool.getConnection();
  try {
    const { amount } = req.body;
    const depositAmount = Number(amount);

    if (isNaN(depositAmount) || depositAmount <= 0) {
      connection.release();
      return res.status(400).json({ error: "Invalid deposit amount." });
    }

    await connection.beginTransaction();

    // 1. Deposit into EmergencyFund balance table
    const [rows] = await connection.query(
      "SELECT id, current_amount FROM EmergencyFund WHERE id = 1 LIMIT 1",
    );

    if (rows.length === 0) {
      await connection.query(
        "INSERT INTO EmergencyFund (id, current_amount, target_amount) VALUES (1, ?, 1000000.00)",
        [depositAmount],
      );
    } else {
      await connection.query(
        "UPDATE EmergencyFund SET current_amount = current_amount + ? WHERE id = 1",
        [depositAmount],
      );
    }

    // 1b. Update MonthlyBudget.emergencyFund so Dashboard reflects accumulated funds
    await connection.query(
      "UPDATE MonthlyBudget SET emergencyFund = COALESCE(emergencyFund, 0) + ? WHERE id = 1",
      [depositAmount],
    );

    // 1c. Sync SavingsGoals if table exists
    try {
      await connection.query(
        "UPDATE SavingsGoals SET currentAmount = currentAmount + ? WHERE goalName = 'Emergency Fund'",
        [depositAmount],
      );
    } catch (e) {}

    // 2. Mark static snapshots as deposited so widget sum drops to 0 and disappears
    await connection.query(
      "UPDATE PendingEmergencySnapshots SET is_deposited = 1 WHERE is_deposited = 0",
    );

    const [[updated]] = await connection.query(
      "SELECT current_amount FROM EmergencyFund WHERE id = 1",
    );

    await connection.commit();

    res.json({
      message: `${depositAmount.toLocaleString()} RWF successfully deposited to Emergency Reserve! Pending target cleared.`,
      depositedAmount: depositAmount,
      newTotal: Number(updated?.current_amount || 0),
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (rbErr) {}
    console.error("Emergency Deposit Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

export const deployEmergencyFund = async (req, res) => {
  await ensureEmergencyTableSchema();
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
      "SELECT id, current_amount FROM EmergencyFund WHERE id = 1 LIMIT 1",
    );

    if (rows.length === 0) {
      connection.release();
      return res
        .status(404)
        .json({ error: "Emergency fund record not found." });
    }

    const currentBalance = Number(rows[0].current_amount || 0);
    if (deployAmount > currentBalance) {
      connection.release();
      return res
        .status(400)
        .json({ error: "Amount exceeds current emergency reserve balance." });
    }

    await connection.query(
      "UPDATE EmergencyFund SET current_amount = GREATEST(0, COALESCE(current_amount, 0) - ?) WHERE id = 1",
      [deployAmount],
    );

    const [mbRows] = await connection.query(
      "SELECT id FROM MonthlyBudget WHERE id = 1",
    );
    if (mbRows.length > 0) {
      await connection.query(
        "UPDATE MonthlyBudget SET balance = balance + ? WHERE id = ?",
        [deployAmount, mbRows[0].id],
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
