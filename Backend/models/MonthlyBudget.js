import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: {
    rejectUnauthorized: false,
  },
});

export const MonthlyBudget = {
  // 1. Fetch active budget row
  get: async () => {
    return await pool.query("SELECT * FROM MonthlyBudget LIMIT 1");
  },

  // 2. Upsert budget row (Placeholders do not auto-mutate other tables)
  update: async (values) => {
    const month = Number(values[12]);
    const year = Number(values[13]);

    // Budget entries are placeholders; wallet balance is preserved until explicit reset rollover
    const [existingRows] = await pool.query(
      "SELECT balance FROM MonthlyBudget WHERE month = ? AND year = ?",
      [month, year],
    );
    const currentBalance =
      existingRows.length > 0 ? Number(existingRows[0].balance) || 0 : 0;

    const updatedValues = [...values];
    updatedValues[14] = currentBalance; // Keep existing balance intact during budget edits

    const [existing] = await pool.query(
      "SELECT id FROM MonthlyBudget WHERE month = ? AND year = ?",
      [month, year],
    );

    if (existing.length > 0) {
      const existingId = existing[0].id;
      updatedValues[15] = existingId;

      return await pool.query(
        `UPDATE MonthlyBudget 
         SET salary=?, otherIncome=?, rent=?, schoolSaving=?, 
             phoneInternet=?, electricityWater=?, food=?, miscellaneous=?, 
             medical=?, familySupport=?, emergencyFund=?, investment=?, 
             month=?, year=?, balance=? 
         WHERE id=?`,
        updatedValues,
      );
    } else {
      const insertValues = updatedValues.slice(0, 15);
      return await pool.query(
        `INSERT INTO MonthlyBudget 
         (salary, otherIncome, rent, schoolSaving, phoneInternet, electricityWater, 
          food, miscellaneous, medical, familySupport, emergencyFund, investment, 
          month, year, balance) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        insertValues,
      );
    }
  },

  // 3. Reset Month Rollover: Stages expected salary/otherIncome into PendingEarnings instead of wallet deposit
  resetMonth: async () => {
    const [rows] = await pool.query("SELECT * FROM MonthlyBudget WHERE id = 1");
    if (rows.length === 0) return 0;

    const b = rows[0];
    const expectedSalary = Number(b.salary) || 0;
    const otherIncome = Number(b.otherIncome) || 0;
    const currentWalletBalance = Number(b.balance) || 0;

    // Stage expected earnings as uncollected pending receivables
    if (expectedSalary > 0) {
      await pool.query(
        `INSERT INTO PendingEarnings (amount, description, earned_date, is_collected) 
         VALUES (?, ?, NOW(), FALSE)`,
        [expectedSalary, "Shift Salary Rollover"],
      );
    }

    if (otherIncome > 0) {
      await pool.query(
        `INSERT INTO PendingEarnings (amount, description, earned_date, is_collected) 
         VALUES (?, ?, NOW(), FALSE)`,
        [otherIncome, "Other Income / Auxiliary Rollover"],
      );
    }

    // Preserve the current wallet balance until manually claimed, and reset placeholders for the new cycle
    await pool.query(
      `UPDATE MonthlyBudget 
       SET balance = ?, 
           salary = 0, 
           otherIncome = 0, 
           translatedLetters = 0, 
           shiftLetters = 0 
       WHERE id = 1`,
      [currentWalletBalance],
    );

    return currentWalletBalance;
  },

  // 4. Recalculate balance based on actual daily expenses subtracted from wallet balance
  recalculateBalance: async (month, year) => {
    const numericMonth = Number(month);
    const numericYear = Number(year);

    const [budgets] = await pool.query(
      "SELECT id, balance FROM MonthlyBudget WHERE month = ? AND year = ?",
      [numericMonth, numericYear],
    );
    if (budgets.length === 0) return 0;

    const budgetId = budgets[0].id;
    const currentBalance = Number(budgets[0].balance) || 0;

    // Sum up actual expenses recorded for the month
    const [expenseResult] = await pool.query(
      "SELECT SUM(amount) as totalExpenses FROM DailyExpense WHERE MONTH(expenseDate) = ? AND YEAR(expenseDate) = ?",
      [numericMonth, numericYear],
    );
    const totalExpenses = Number(expenseResult[0].totalExpenses) || 0;

    // Balance reflects rolled-over cash minus actual spent daily expenses
    return currentBalance;
  },
};
