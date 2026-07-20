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
    rejectUnauthorized: false, // Required for secure Aiven cloud database connections[cite: 21]
  },
});

export const MonthlyBudget = {
  // 1. Fetch active budget row
  get: async () => {
    return await pool.query("SELECT * FROM MonthlyBudget LIMIT 1");
  },

  // 2. Intelligent Upsert and Wallet Balance Rule (Balance stays 0 until month reset)
  update: async (values) => {
    const month = Number(values[12]); // numeric month[cite: 21]
    const year = Number(values[13]); // numeric year[cite: 21]

    // WALLET BALANCE RULE: Expected salary/income sits in the budget targets
    // and is not liquid cash in hand yet, so wallet balance remains 0 until reset.
    const correctBalance = 0;

    // Overwrite the balance index with 0
    const updatedValues = [...values];
    updatedValues[14] = correctBalance;

    // Check if a budget row already exists for this numeric month & year[cite: 21]
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

  // 3. Helper function to force-sync the balance on demand
  recalculateBalance: async (month, year) => {
    const numericMonth = Number(month);
    const numericYear = Number(year);

    const [budgets] = await pool.query(
      "SELECT id FROM MonthlyBudget WHERE month = ? AND year = ?",
      [numericMonth, numericYear],
    );
    if (budgets.length === 0) return 0;

    const budgetId = budgets[0].id;

    // Wallet balance stays 0 until reset month rolls over expected funds
    const correctBalance = 0;

    await pool.query("UPDATE MonthlyBudget SET balance = ? WHERE id = ?", [
      correctBalance,
      budgetId,
    ]);

    return correctBalance;
  },
};
