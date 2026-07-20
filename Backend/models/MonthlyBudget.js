import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

console.log("--- DEBUG: DB CONFIG ---");
console.log("Host:", process.env.DB_HOST);
console.log("User:", process.env.DB_USER);
console.log("Database:", process.env.DB_NAME);
console.log("Port:", process.env.DB_PORT);
console.log("------------------------");

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: {
    rejectUnauthorized: false, // Required for secure Aiven cloud database connections
  },
});

export const MonthlyBudget = {
  // 1. Fetch active budget row
  get: async () => {
    return await pool.query("SELECT * FROM MonthlyBudget LIMIT 1");
  },

  // 2. Intelligent Upsert and Balance Auto-Recalculation
  update: async (values) => {
    const salary = Number(values[0]) || 0;
    const otherIncome = Number(values[1]) || 0;
    const month = Number(values[12]); // numeric month (e.g. 1)
    const year = Number(values[13]); // numeric year (e.g. 2026)

    // A. Query the sum of actual daily expenses recorded for this month and year
    const [expenseResult] = await pool.query(
      `SELECT SUM(amount) as totalExpenses 
       FROM DailyExpense 
       WHERE MONTH(expenseDate) = ? AND YEAR(expenseDate) = ?`,
      [month, year],
    );
    const totalExpenses = Number(expenseResult[0].totalExpenses) || 0;

    // B. Query the sum of actual investments made for this month and year
    const [investmentResult] = await pool.query(
      `SELECT SUM(principal_invested) as totalInvested 
       FROM ActualInvestments 
       WHERE month = ? AND year = ?`,
      [month, year],
    );
    const totalInvested = Number(investmentResult[0].totalInvested) || 0;

    // C. Calculate the True actual cash balance
    const correctBalance = salary + otherIncome - totalExpenses - totalInvested;

    // D. Overwrite the balance (index 14) with the correct calculation
    const updatedValues = [...values];
    updatedValues[14] = correctBalance;

    // E. Check if a budget row already exists for this numeric month & year
    const [existing] = await pool.query(
      "SELECT id FROM MonthlyBudget WHERE month = ? AND year = ?",
      [month, year],
    );

    if (existing.length > 0) {
      // If it exists, overwrite that specific record
      const existingId = existing[0].id;
      updatedValues[15] = existingId; // Set ID parameter for WHERE clause

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
      // If it doesn't exist, create a clean row
      const insertValues = updatedValues.slice(0, 15); // Drop the ID index
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

  // 3. Helper function to force-sync the balance on demand
  recalculateBalance: async (month, year) => {
    const numericMonth = Number(month);
    const numericYear = Number(year);

    // Fetch budget details
    const [budgets] = await pool.query(
      "SELECT id, salary, otherIncome FROM MonthlyBudget WHERE month = ? AND year = ?",
      [numericMonth, numericYear],
    );
    if (budgets.length === 0) return 0;

    const budgetId = budgets[0].id;
    const salary = Number(budgets[0].salary) || 0;
    const otherIncome = Number(budgets[0].otherIncome) || 0;

    // Sum actual expenses
    const [expenseResult] = await pool.query(
      "SELECT SUM(amount) as totalExpenses FROM DailyExpense WHERE MONTH(expenseDate) = ? AND YEAR(expenseDate) = ?",
      [numericMonth, numericYear],
    );
    const totalExpenses = Number(expenseResult[0].totalExpenses) || 0;

    // Sum actual investments
    const [investmentResult] = await pool.query(
      "SELECT SUM(principal_invested) as totalInvested FROM ActualInvestments WHERE month = ? AND year = ?",
      [numericMonth, numericYear],
    );
    const totalInvested = Number(investmentResult[0].totalInvested) || 0;

    // True Balance
    const correctBalance = salary + otherIncome - totalExpenses - totalInvested;

    // Update the DB row
    await pool.query("UPDATE MonthlyBudget SET balance = ? WHERE id = ?", [
      correctBalance,
      budgetId,
    ]);

    return correctBalance;
  },
};
