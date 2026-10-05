import { pool } from "../models/MonthlyBudget.js";

const DEFAULT_EMERGENCY_TARGET = 1000000;

const ensureEmergencyTableSchema = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS EmergencyFund (
        id INT PRIMARY KEY AUTO_INCREMENT,
        current_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        target_amount DECIMAL(15, 2) NOT NULL DEFAULT ${DEFAULT_EMERGENCY_TARGET}
      )
    `);

    try {
      await pool.query(
        `ALTER TABLE EmergencyFund ADD COLUMN target_amount DECIMAL(15,2) DEFAULT ${DEFAULT_EMERGENCY_TARGET}`,
      );
    } catch (schemaErr) {
      if (schemaErr.errno !== 1060 && schemaErr.code !== "ER_DUP_FIELDNAME") {
        throw schemaErr;
      }
    }
  } catch (schemaErr) {
    console.warn("EmergencyFund schema notice:", schemaErr.message);
  }
};

const ensurePendingEmergencyTableSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS PendingEmergencySnapshots (
      id INT AUTO_INCREMENT PRIMARY KEY,
      salary_allocation DECIMAL(12,2) DEFAULT 0,
      side_income_allocation DECIMAL(12,2) DEFAULT 0,
      month_label VARCHAR(50),
      earned_date VARCHAR(50),
      is_deposited BOOLEAN DEFAULT FALSE
    )
  `);
};

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getEmergencyFund = async (req, res) => {
  try {
    await ensureEmergencyTableSchema();
    const [rows] = await pool.query(
      "SELECT id, current_amount, target_amount FROM EmergencyFund WHERE id = 1 LIMIT 1",
    );
    if (rows.length === 0) {
      return res.json({
        current_amount: 0,
        target_amount: DEFAULT_EMERGENCY_TARGET,
      });
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
        [number(numCurrent), number(numTarget || DEFAULT_EMERGENCY_TARGET)],
      );
    } else if (numCurrent !== undefined && numTarget !== undefined) {
      await pool.query(
        "UPDATE EmergencyFund SET current_amount = ?, target_amount = ? WHERE id = 1",
        [number(numCurrent), number(numTarget)],
      );
    } else if (numTarget !== undefined) {
      await pool.query(
        "UPDATE EmergencyFund SET target_amount = ? WHERE id = 1",
        [number(numTarget)],
      );
    } else if (numCurrent !== undefined) {
      await pool.query(
        "UPDATE EmergencyFund SET current_amount = ? WHERE id = 1",
        [number(numCurrent)],
      );
    }

    res.json({ message: "Emergency fund updated!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Manual transfer from Wallet -> Emergency Reserve.
// This does NOT consume pending snapshots.
export const depositEmergencyFund = async (req, res) => {
  await ensureEmergencyTableSchema();
  const connection = await pool.getConnection();

  try {
    const depositAmount = number(req.body.amount);
    if (depositAmount <= 0) {
      return res.status(400).json({ error: "Invalid deposit amount." });
    }

    await connection.beginTransaction();

    const [walletRows] = await connection.query(
      "SELECT balance FROM MonthlyBudget WHERE id = 1 LIMIT 1",
    );
    const walletBalance = number(walletRows[0]?.balance);

    if (depositAmount > walletBalance) {
      await connection.rollback();
      return res.status(400).json({
        error: `Insufficient Wallet balance. Available: ${walletBalance.toLocaleString()} RWF`,
      });
    }

    const [emergencyRows] = await connection.query(
      "SELECT id FROM EmergencyFund WHERE id = 1 LIMIT 1",
    );

    if (emergencyRows.length === 0) {
      await connection.query(
        "INSERT INTO EmergencyFund (id, current_amount, target_amount) VALUES (1, ?, ?)",
        [depositAmount, DEFAULT_EMERGENCY_TARGET],
      );
    } else {
      await connection.query(
        "UPDATE EmergencyFund SET current_amount = COALESCE(current_amount, 0) + ? WHERE id = 1",
        [depositAmount],
      );
    }

    await connection.query(
      "UPDATE MonthlyBudget SET balance = GREATEST(0, COALESCE(balance, 0) - ?) WHERE id = 1",
      [depositAmount],
    );

    try {
      await connection.query(
        "UPDATE SavingsGoals SET currentAmount = currentAmount + ? WHERE goalName = 'Emergency Fund'",
        [depositAmount],
      );
    } catch (_) {}

    const [[updated]] = await connection.query(
      "SELECT current_amount FROM EmergencyFund WHERE id = 1",
    );
    const [[walletUpdated]] = await connection.query(
      "SELECT balance FROM MonthlyBudget WHERE id = 1",
    );

    await connection.commit();

    res.json({
      message: `${depositAmount.toLocaleString()} RWF transferred from Wallet to Emergency Reserve.`,
      depositedAmount: depositAmount,
      newTotal: number(updated?.current_amount),
      walletBalance: number(walletUpdated?.balance),
    });
  } catch (err) {
    try { await connection.rollback(); } catch (_) {}
    console.error("Emergency Deposit Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

// Read the frozen emergency allocation created by Reset Month.
export const getPendingEmergency = async (req, res) => {
  try {
    await ensurePendingEmergencyTableSchema();

    const [rows] = await pool.query(`
      SELECT
        id,
        salary_allocation,
        side_income_allocation,
        month_label,
        earned_date,
        is_deposited
      FROM PendingEmergencySnapshots
      WHERE is_deposited = FALSE
      ORDER BY id ASC
    `);

    const salaryPortion = rows.reduce(
      (sum, row) => sum + number(row.salary_allocation),
      0,
    );
    const sideIncomePortion = rows.reduce(
      (sum, row) => sum + number(row.side_income_allocation),
      0,
    );
    const totalAmount = salaryPortion + sideIncomePortion;

    res.json({
      pending: totalAmount > 0,
      snapshotCount: rows.length,
      latestSnapshotId: rows.length ? rows[rows.length - 1].id : null,
      monthLabel:
        rows.length > 0 ? rows[rows.length - 1].month_label || null : null,
      earnedDate:
        rows.length > 0 ? rows[rows.length - 1].earned_date || null : null,
      salaryPortion,
      sideIncomePortion,
      totalAmount,
    });
  } catch (err) {
    console.error("Get Pending Emergency Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Consume the frozen snapshot: Wallet -> Emergency Reserve.
// The amount is always taken from the snapshot itself, never from live allocations.
export const claimPendingEmergency = async (req, res) => {
  await ensureEmergencyTableSchema();
  await ensurePendingEmergencyTableSchema();

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [pendingRows] = await connection.query(`
      SELECT
        id,
        salary_allocation,
        side_income_allocation
      FROM PendingEmergencySnapshots
      WHERE is_deposited = FALSE
      ORDER BY id ASC
      FOR UPDATE
    `);

    const salaryPortion = pendingRows.reduce(
      (sum, row) => sum + number(row.salary_allocation),
      0,
    );
    const sideIncomePortion = pendingRows.reduce(
      (sum, row) => sum + number(row.side_income_allocation),
      0,
    );
    const totalAmount = Math.round((salaryPortion + sideIncomePortion) * 100) / 100;

    if (totalAmount <= 0) {
      await connection.rollback();
      return res.status(404).json({ error: "No pending emergency snapshot is available." });
    }

    const [walletRows] = await connection.query(
      "SELECT balance FROM MonthlyBudget WHERE id = 1 LIMIT 1 FOR UPDATE",
    );
    const walletBalance = number(walletRows[0]?.balance);

    if (walletBalance < totalAmount) {
      await connection.rollback();
      return res.status(400).json({
        error: `Insufficient Wallet balance. Available: ${walletBalance.toLocaleString()} RWF; pending Emergency Reserve transfer: ${totalAmount.toLocaleString()} RWF.`,
      });
    }

    const [emergencyRows] = await connection.query(
      "SELECT id FROM EmergencyFund WHERE id = 1 LIMIT 1 FOR UPDATE",
    );

    if (emergencyRows.length === 0) {
      await connection.query(
        "INSERT INTO EmergencyFund (id, current_amount, target_amount) VALUES (1, ?, ?)",
        [totalAmount, DEFAULT_EMERGENCY_TARGET],
      );
    } else {
      await connection.query(
        "UPDATE EmergencyFund SET current_amount = COALESCE(current_amount, 0) + ? WHERE id = 1",
        [totalAmount],
      );
    }

    await connection.query(
      "UPDATE MonthlyBudget SET balance = GREATEST(0, COALESCE(balance, 0) - ?) WHERE id = 1",
      [totalAmount],
    );

    // Keep the legacy Emergency Fund savings goal in sync when it exists.
    try {
      await connection.query(
        "UPDATE SavingsGoals SET currentAmount = currentAmount + ? WHERE goalName = 'Emergency Fund'",
        [totalAmount],
      );
    } catch (_) {}

    await connection.query(
      "UPDATE PendingEmergencySnapshots SET is_deposited = TRUE WHERE is_deposited = FALSE",
    );

    const [[updatedEmergency]] = await connection.query(
      "SELECT current_amount FROM EmergencyFund WHERE id = 1",
    );
    const [[updatedWallet]] = await connection.query(
      "SELECT balance FROM MonthlyBudget WHERE id = 1",
    );

    await connection.commit();

    res.json({
      message: `${totalAmount.toLocaleString()} RWF transferred from Wallet to Emergency Reserve.`,
      depositedAmount: totalAmount,
      salaryPortion,
      sideIncomePortion,
      newTotal: number(updatedEmergency?.current_amount),
      walletBalance: number(updatedWallet?.balance),
    });
  } catch (err) {
    try { await connection.rollback(); } catch (_) {}
    console.error("Claim Pending Emergency Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

export const deployEmergencyFund = async (req, res) => {
  await ensureEmergencyTableSchema();
  const connection = await pool.getConnection();
  try {
    const deployAmount = number(req.body.amount);
    if (deployAmount <= 0) {
      return res.status(400).json({ error: "Invalid deployment amount." });
    }

    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT id, current_amount FROM EmergencyFund WHERE id = 1 LIMIT 1",
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Emergency fund record not found." });
    }

    const currentBalance = number(rows[0].current_amount);
    if (deployAmount > currentBalance) {
      await connection.rollback();
      return res.status(400).json({ error: "Amount exceeds current emergency reserve balance." });
    }

    await connection.query(
      "UPDATE EmergencyFund SET current_amount = GREATEST(0, COALESCE(current_amount, 0) - ?) WHERE id = 1",
      [deployAmount],
    );

    await connection.query(
      "UPDATE MonthlyBudget SET balance = COALESCE(balance, 0) + ? WHERE id = 1",
      [deployAmount],
    );

    try {
      await connection.query(
        "UPDATE SavingsGoals SET currentAmount = GREATEST(0, currentAmount - ?) WHERE goalName = 'Emergency Fund'",
        [deployAmount],
      );
    } catch (_) {}

    await connection.commit();
    res.json({ message: "Emergency funds deployed to wallet successfully!" });
  } catch (err) {
    try { await connection.rollback(); } catch (_) {}
    console.error("Emergency Deploy Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};
