import { pool } from "../models/MonthlyBudget.js";

// Helper utility to clean up numeric values (fixed isNaN case sensitivity)
const n = (val) => {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
};

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

const v = (val) => Number(val) || 0;

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

      const schoolFeesSaving = v(b.schoolSaving);
      if (schoolFeesSaving > 0) {
        await connection.query(
          `INSERT INTO SchoolFees (month, amountSaved, cumulative) 
           VALUES (?, ?, (SELECT IFNULL(SUM(amountSaved), 0) + ? FROM SchoolFees AS tmp))`,
          [String(b.month), schoolFeesSaving, schoolFeesSaving],
        );
      }

      const emergencySaving = v(b.emergencyFund);
      if (emergencySaving > 0) {
        await connection.query(
          `UPDATE EmergencyFund 
           SET current_amount = current_amount + ? 
           WHERE user_id = 1`,
          [emergencySaving],
        );
      }

      const goalsToUpdate = [
        { amount: schoolFeesSaving, name: "School Fees Buffer" },
        { amount: emergencySaving, name: "Emergency Fund" },
        { amount: investmentCapital, name: "Business Capital" },
      ];

      for (const goal of goalsToUpdate) {
        if (goal.amount > 0) {
          await connection.query(
            `UPDATE SavingsGoals
             SET currentAmount = currentAmount + ?
             WHERE goalName = ?`,
            [goal.amount, goal.name],
          );
        }
      }

      // PAYDAY ROLLOVER LOGIC:
      // Shift expected salary and otherIncome into the actual liquid Wallet Balance.
      const expectedSalary = v(b.salary);
      const otherIncome = v(b.otherIncome);
      const currentWalletBalance = v(b.balance);
      const newWalletBalance =
        currentWalletBalance + expectedSalary + otherIncome;

      const currentRealMonth = new Date().getMonth() + 1;
      const currentRealYear = new Date().getFullYear();

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
        [currentRealMonth, currentRealYear, newWalletBalance],
      );
    }

    await connection.query("DELETE FROM DailyExpense");

    await connection.commit();
    res.json({
      message:
        "Shift cycle processed successfully! Expected earnings rolled over into your Wallet Balance, and placeholders reset for your next runtime slate.",
    });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
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
