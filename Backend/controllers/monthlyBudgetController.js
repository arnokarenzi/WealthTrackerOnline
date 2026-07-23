import { pool } from "../models/MonthlyBudget.js";

// Helper utility to clean up numeric values (fixed isNaN case sensitivity)
const n = (val) => {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
};

const v = (val) => Number(val) || 0;

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
    salary,
    otherIncome,
    rent,
    schoolSaving,
    phoneInternet,
    electricityWater,
    food,
    miscellaneous,
    medical,
    familySupport,
    emergencyFund,
    investment,
    balance,
    month,
    year,
    translatedLetters,
    recommendedEssentials,
    recommendedEmergency,
    recommendedInvest,
    recommendedDiscretionary,
    shiftLetters,
  } = req.body;

  try {
    const sql = `
      UPDATE MonthlyBudget 
      SET salary = ?, otherIncome = ?, rent = ?, schoolSaving = ?, phoneInternet = ?,
          electricityWater = ?, food = ?, miscellaneous = ?, medical = ?, familySupport = ?,
          emergencyFund = ?, investment = ?, balance = ?, month = ?, year = ?, translatedLetters = ?,
          recommendedEssentials = ?, recommendedEmergency = ?, recommendedInvest = ?,
          recommendedDiscretionary = ?, shiftLetters = ?
      WHERE id = 1
    `;
    await pool.query(sql, [
      n(salary),
      n(otherIncome),
      n(rent),
      n(schoolSaving),
      n(phoneInternet),
      n(electricityWater),
      n(food),
      n(miscellaneous),
      n(medical),
      n(familySupport),
      n(emergencyFund),
      n(investment),
      n(balance),
      n(month),
      n(year),
      n(translatedLetters),
      n(recommendedEssentials),
      n(recommendedEmergency),
      n(recommendedInvest),
      n(recommendedDiscretionary),
      n(shiftLetters),
    ]);
    res.json({ message: "Budget records saved successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add this controller function in your backend
export const addExtraIncome = async (req, res) => {
  try {
    const { amount, description } = req.body;
    const numAmount = Number(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount provided." });
    }

    // Directly increase the active wallet balance in MySQL
    await pool.query(
      "UPDATE MonthlyBudget SET balance = balance + ? WHERE id = 1",
      [numAmount],
    );

    res.status(200).json({
      message: "Extra income successfully added to wallet balance!",
      amount: numAmount,
      description: description || "Side Hustle / Extra Income",
    });
  } catch (err) {
    console.error("Add Extra Income Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const initializeProject = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query("DELETE FROM DailyExpense");
    await connection.query("DELETE FROM ActualInvestments");
    await connection.query("DELETE FROM SchoolFees");
    await connection.query(
      "UPDATE EmergencyFund SET current_amount = 0 WHERE user_id = 1",
    );

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
      message: "Master reset successful. All history and dependencies cleared.",
    });
  } catch (err) {
    await connection.rollback();
    console.error("Reset failed:", err);
    res.status(500).json({ error: "Failed to reset: " + err.message });
  } finally {
    connection.release();
  }
};

export const resetMonth = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [budgetRows] = await connection.query(
      "SELECT * FROM MonthlyBudget WHERE id = 1",
    );

    if (budgetRows.length > 0) {
      const b = budgetRows[0];
      const investmentCapital = v(b.investment);

      // 1. Investments (Specialized Table Only)
      if (investmentCapital > 0) {
        await connection.query(
          `INSERT INTO ActualInvestments (asset_name, principal_invested, current_value, month, year) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            "Shift Rollover Portfolio",
            investmentCapital,
            investmentCapital,
            b.month,
            b.year,
          ],
        );
      }

      // 2. School Fees (Specialized Table Only)
      const schoolFeesSaving = v(b.schoolSaving);
      if (schoolFeesSaving > 0) {
        await connection.query(
          `INSERT INTO SchoolFees (month, amountSaved, cumulative) 
           VALUES (?, ?, (SELECT IFNULL(SUM(amountSaved), 0) + ? FROM SchoolFees AS tmp))`,
          [String(b.month), schoolFeesSaving, schoolFeesSaving],
        );
      }

      // 3. Emergency Fund (Specialized Table Only)
      const emergencySaving = v(b.emergencyFund);
      if (emergencySaving > 0) {
        await connection.query(
          `UPDATE EmergencyFund 
           SET current_amount = current_amount + ? 
           WHERE user_id = 1`,
          [emergencySaving],
        );
      }

      // NOTE: The loop updating `SavingsGoals` has been completely removed here.
      // This ensures Emergency, School Fees, and Investments never spill over
      // into the generic Savings Goals page.

      // --- PENDING EARNINGS ROLLOVER ---
      const expectedSalary = v(b.salary);
      const otherIncome = v(b.otherIncome);

      if (expectedSalary > 0) {
        await connection.query(
          `INSERT INTO PendingEarnings (amount, description, earned_date, is_collected) 
           VALUES (?, ?, NOW(), FALSE)`,
          [expectedSalary, "Shift Salary Rollover"],
        );
      }

      if (otherIncome > 0) {
        await connection.query(
          `INSERT INTO PendingEarnings (amount, description, earned_date, is_collected) 
           VALUES (?, ?, NOW(), FALSE)`,
          [otherIncome, "Other Income / Auxiliary Rollover"],
        );
      }

      const currentRealMonth = new Date().getMonth() + 1;
      const currentRealYear = new Date().getFullYear();
      const currentWalletBalance = v(b.balance);

      await connection.query(
        `UPDATE MonthlyBudget 
         SET 
           month = ?, 
           year = ?,
           salary = 0,
           otherIncome = 0,
           schoolSaving = 0, 
           emergencyFund = 0, 
           investment = 0, 
           balance = ?,
           translatedLetters = 0, 
           shiftLetters = 0
         WHERE id = 1`,
        [currentRealMonth, currentRealYear, currentWalletBalance],
      );
    }

    await connection.query("DELETE FROM DailyExpense");

    await connection.commit();
    res.json({
      message:
        "Shift cycle processed successfully! Specialized funds routed to dedicated tables without mixing into savings goals.",
    });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};
