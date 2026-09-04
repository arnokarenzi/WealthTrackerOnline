import { pool } from "../models/MonthlyBudget.js";

// Helper utility to clean up numeric values
const n = (val) => {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
};

const v = (val) => Number(val) || 0;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const getBudget = async (req, res) => {
  if (req.query.action === "cron") {
    return res.status(200).send("ok");
  }

  try {
    const [rows] = await pool.query("SELECT * FROM MonthlyBudget LIMIT 1");
    if (rows.length === 0) {
      return res.status(404).json({ message: "No budget entries discovered." });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateBudget = async (req, res) => {
  const {
    salary, rent, schoolSaving, phoneInternet, electricityWater, food,
    miscellaneous, medical, familySupport, emergencyFund, investment,
    balance, month, year, translatedLetters, recommendedEssentials,
    recommendedEmergency, recommendedInvest, recommendedDiscretionary,
    shiftLetters,
  } = req.body;

  try {
    const sql = `
      UPDATE MonthlyBudget 
      SET salary = ?, rent = ?, schoolSaving = ?, phoneInternet = ?,
          electricityWater = ?, food = ?, miscellaneous = ?, medical = ?, familySupport = ?,
          emergencyFund = ?, investment = ?, balance = ?, month = ?, year = ?, translatedLetters = ?,
          recommendedEssentials = ?, recommendedEmergency = ?, recommendedInvest = ?,
          recommendedDiscretionary = ?, shiftLetters = ?
      WHERE id = 1
    `;
    await pool.query(sql, [
      n(salary), n(rent), n(schoolSaving), n(phoneInternet),
      n(electricityWater), n(food), n(miscellaneous), n(medical), n(familySupport),
      n(emergencyFund), n(investment), n(balance), n(month), n(year), n(translatedLetters),
      n(recommendedEssentials), n(recommendedEmergency), n(recommendedInvest),
      n(recommendedDiscretionary), n(shiftLetters),
    ]);
    res.json({ message: "Budget records saved successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const addExtraIncome = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { amount, description } = req.body;
    const numAmount = Number(amount);
    const incomeDesc = description || "Side Hustle / Extra Income";

    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount provided." });
    }

    await connection.beginTransaction();

    await connection.query(
      "UPDATE MonthlyBudget SET balance = balance + ? WHERE id = 1",
      [numAmount],
    );

    // Record incoming wallet ledger entry
    await connection.query(
      "INSERT INTO WalletIncome (amount, description, source_type) VALUES (?, ?, 'side_income')",
      [numAmount, incomeDesc]
    );

    await connection.commit();
    res.status(200).json({
      message: "Extra income successfully added to wallet balance!",
      amount: numAmount,
      description: incomeDesc,
    });
  } catch (err) {
    await connection.rollback();
    console.error("Add Extra Income Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

export const initializeProject = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Delete all expenses (both active and archived)
    await connection.query("DELETE FROM DailyExpense");

    // 2. Clear all actual growth holdings / investments
    await connection.query("DELETE FROM ActualInvestments");

    // 3. Reset Investment Reserve balance pool
    await connection.query("UPDATE InvestmentReserve SET amount = 0 WHERE id = 1");

    // 4. Clear extra income history
    await connection.query("DELETE FROM WalletIncome");

    // 5. Clear School Fees history
    await connection.query("DELETE FROM SchoolFees");

    // 6. Reset Emergency Fund balance
    await connection.query("UPDATE EmergencyFund SET current_amount = 0 WHERE id = 1");

    // 7. Reset Savings Goals balances
    await connection.query("UPDATE SavingsGoals SET currentAmount = 0");

    // 8. Reset MonthlyBudget active metrics & wallet balance
    // (Note: PendingEarnings table is left untouched to keep Shift Salary Rollover intact)
    await connection.query(
      `
      UPDATE MonthlyBudget 
      SET salary = 0, otherIncome = 0, rent = 0, schoolSaving = 0, 
          phoneInternet = 0, electricityWater = 0, food = 0, miscellaneous = 0, 
          medical = 0, familySupport = 0, emergencyFund = 0, investment = 0, 
          balance = 0, month = ?, year = ?, translatedLetters = 0, 
          shiftLetters = 0
      WHERE id = 1
    `,
      [new Date().getMonth() + 1, new Date().getFullYear()],
    );

    await connection.commit();
    res.json({
      message: "Master reset successful. All history, reserves, and expenses cleared except Pending Earnings.",
    });
  } catch (err) {
    await connection.rollback();
    console.error("Reset failed:", err);
    res.status(500).json({ error: "Failed to reset: " + err.message });
  } finally {
    connection.release();
  }
};

// 🔄 CLEAN RESET: Only rolls salary into PendingEarnings. No auto-transfers to Emergency, School, or Investments.
export const resetMonth = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch current budget state
    const [budgetRows] = await connection.query(
      "SELECT * FROM MonthlyBudget WHERE id = 1"
    );

    if (budgetRows.length > 0) {
      const b = budgetRows[0];
      const expectedSalary = v(b.salary);

      const now = new Date();
      const monthName = MONTH_NAMES[now.getMonth()];
      const yearNum = now.getFullYear();
      
      // Dynamic description format: "Shift Payment: August 2026"
      const shiftRolloverDesc = `Shift Payment: ${monthName} ${yearNum}`;

      // Stage earned salary to pending earnings
      if (expectedSalary > 0) {
        await connection.query(
          `INSERT INTO PendingEarnings (amount, description, earned_date, is_collected) 
           VALUES (?, ?, NOW(), FALSE)`,
          [expectedSalary, shiftRolloverDesc]
        );
      }

      const currentRealMonth = now.getMonth() + 1;
      const currentRealYear = now.getFullYear();
      const currentWalletBalance = v(b.balance);

      // Reset active budget counters for the new shift cycle
      await connection.query(
        `UPDATE MonthlyBudget 
         SET 
           month = ?, year = ?, salary = 0, schoolSaving = 0, 
           emergencyFund = 0, investment = 0, balance = ?,
           translatedLetters = 0, shiftLetters = 0
         WHERE id = 1`,
        [currentRealMonth, currentRealYear, currentWalletBalance]
      );
    }

    // 2. Archive active expenses instead of deleting them
    await connection.query(
      "UPDATE DailyExpense SET is_archived = 1 WHERE is_archived = 0"
    );

    await connection.commit();

    return res.status(200).json({
      message: "Shift reset successful! Expenses moved to archive.",
    });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

export const getWalletIncomeHistory = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = "SELECT * FROM WalletIncome";
    let params = [];

    if (startDate && endDate) {
      query += " WHERE DATE(created_at) BETWEEN ? AND ?";
      params = [startDate, endDate];
    }

    query += " ORDER BY created_at DESC";

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
