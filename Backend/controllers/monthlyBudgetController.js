import { pool } from "../models/MonthlyBudget.js";

// Helper utility to convert current system time to Africa/Kigali timezone (CAT / UTC+2)
const getKigaliTime = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((p) => [p.type, p.value]),
  );

  const year = parseInt(parts.year, 10);
  const month = parseInt(parts.month, 10);
  const day = parseInt(parts.day, 10);
  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(parts.minute, 10);
  const second = parseInt(parts.second, 10);

  const pad = (num) => String(num).padStart(2, "0");
  const dateString = `${year}-${pad(month)}-${pad(day)}`;
  const dateTimeString = `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;

  return { year, month, day, hour, minute, second, dateString, dateTimeString };
};

const n = (val) => {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
};

const v = (val) => Number(val) || 0;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
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
      "UPDATE MonthlyBudget SET balance = balance + ?, otherIncome = otherIncome + ? WHERE id = 1",
      [numAmount, numAmount],
    );

    await connection.query(
      "INSERT INTO WalletIncome (amount, description, source_type) VALUES (?, ?, 'side_income')",
      [numAmount, incomeDesc],
    );

    await connection.commit();
    res.status(200).json({
      message: "Extra income added! Allocations updated live.",
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
    const kigali = getKigaliTime();
    await connection.beginTransaction();

    await connection.query("DELETE FROM DailyExpense");
    await connection.query("DELETE FROM ActualInvestments");
    await connection.query(
      "UPDATE InvestmentReserve SET amount = 0 WHERE id = 1",
    );
    await connection.query("DELETE FROM WalletIncome");
    await connection.query("DELETE FROM SchoolFees");
    await connection.query("DELETE FROM PendingEmergencySnapshots");
    await connection.query(
      "UPDATE EmergencyFund SET current_amount = 0 WHERE id = 1",
    );
    await connection.query("UPDATE SavingsGoals SET currentAmount = 0");

    await connection.query(
      `
      UPDATE MonthlyBudget 
      SET salary = 0, otherIncome = 0, rent = 0, schoolSaving = 0, 
          phoneInternet = 0, electricityWater = 0, food = 0, miscellaneous = 0, 
          medical = 0, familySupport = 0, emergencyFund = 0, investment = 0, 
          balance = 0, month = ?, year = ?, translatedLetters = 0, 
          shiftLetters = 0, recommendedEssentials = 0, recommendedEmergency = 0,
          recommendedInvest = 0, recommendedDiscretionary = 0
      WHERE id = 1
    `,
      [kigali.month, kigali.year],
    );

    await connection.commit();
    res.json({
      message:
        "Master reset successful. All history, reserves, and expenses cleared except Pending Earnings.",
    });
  } catch (err) {
    await connection.rollback();
    console.error("Reset failed:", err);
    res.status(500).json({ error: "Failed to reset: " + err.message });
  } finally {
    connection.release();
  }
};

// 🔄 RESET MONTH: Snapshots allocations, calculates target emergency amounts from salary & side income, stages them for widget deposit, and resets active counters.
export const resetMonth = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const kigali = getKigaliTime();
    await connection.beginTransaction();

    const [budgetRows] = await connection.query(
      "SELECT * FROM MonthlyBudget WHERE id = 1",
    );

    if (budgetRows.length > 0) {
      const b = budgetRows[0];
      const expectedSalary = v(b.salary);
      const otherIncomeVal = v(b.otherIncome);

      const monthName = MONTH_NAMES[kigali.month - 1];
      const yearNum = kigali.year;
      const shiftRolloverDesc = `Shift Payment: ${monthName} ${yearNum}`;

      // 1. Roll over salary into Pending Shift Payouts
      if (expectedSalary > 0) {
        await connection.query(
          `INSERT INTO PendingEarnings (amount, description, earned_date, is_collected) 
           VALUES (?, ?, ?, FALSE)`,
          [expectedSalary, shiftRolloverDesc, kigali.dateTimeString],
        );
      }

      // 2. Fetch emergency allocation percentage from templates
      const [templates] = await connection.query(
        "SELECT emergency_pct FROM AllocationTemplates WHERE user_id = 1 LIMIT 1",
      );
      const emergencyPct =
        templates.length > 0 ? n(templates[0].emergency_pct) : 0;

      // 3. Snapshot emergency targets derived from salary and side income before clearing counters
      const emergencyFromSalary = (expectedSalary * emergencyPct) / 100;
      const emergencyFromSideIncome = (otherIncomeVal * emergencyPct) / 100;

      if (emergencyFromSalary > 0 || emergencyFromSideIncome > 0) {
        // Store or update staged emergency allocation targets in a pending snapshot table or pending field
        // This ensures the Pending Emergency Target widget retains these breakdown figures until deposited.
        await connection
          .query(
            `INSERT INTO PendingEmergencySnapshots (salary_allocation, side_income_allocation, month_label, earned_date, is_deposited) 
           VALUES (?, ?, ?, ?, FALSE)`,
            [
              emergencyFromSalary,
              emergencyFromSideIncome,
              `${monthName} ${yearNum}`,
              kigali.dateTimeString,
            ],
          )
          .catch(async () => {
            // Fallback or handle table creation inline if not already present
            await connection.query(`
            CREATE TABLE IF NOT EXISTS PendingEmergencySnapshots (
              id INT AUTO_INCREMENT PRIMARY KEY,
              salary_allocation DECIMAL(12,2) DEFAULT 0,
              side_income_allocation DECIMAL(12,2) DEFAULT 0,
              month_label VARCHAR(50),
              earned_date VARCHAR(50),
              is_deposited BOOLEAN DEFAULT FALSE
            )
          `);
            await connection.query(
              `INSERT INTO PendingEmergencySnapshots (salary_allocation, side_income_allocation, month_label, earned_date, is_deposited) 
             VALUES (?, ?, ?, ?, FALSE)`,
              [
                emergencyFromSalary,
                emergencyFromSideIncome,
                `${monthName} ${yearNum}`,
                kigali.dateTimeString,
              ],
            );
          });
      }

      const currentRealMonth = kigali.month;
      const currentRealYear = kigali.year;
      const currentWalletBalance = v(b.balance);

      // 4. Reset active working counters for the new cycle
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

    await connection.query(
      "UPDATE DailyExpense SET is_archived = 1 WHERE is_archived = 0",
    );

    await connection.commit();

    return res.status(200).json({
      message:
        "Month reset successful! Earnings moved to Pending Buffer, allocations snapshotted into the emergency widget, and working counters reset.",
    });
  } catch (err) {
    await connection.rollback();
    console.error("Reset Month Error:", err);
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
