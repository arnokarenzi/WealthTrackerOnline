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

  // 2. Upsert budget row
  update: async (values) => {
    const month = Number(values[11]);
    const year = Number(values[12]);

    const [existingRows] = await pool.query(
      "SELECT balance FROM MonthlyBudget WHERE month = ? AND year = ?",
      [month, year],
    );
    const currentBalance =
      existingRows.length > 0 ? Number(existingRows[0].balance) || 0 : 0;

    const updatedValues = [...values];
    updatedValues[13] = currentBalance;

    const [existing] = await pool.query(
      "SELECT id FROM MonthlyBudget WHERE month = ? AND year = ?",
      [month, year],
    );

    if (existing.length > 0) {
      const existingId = existing[0].id;
      updatedValues[14] = existingId;

      return await pool.query(
        `UPDATE MonthlyBudget 
         SET salary=?, rent=?, schoolSaving=?, 
             phoneInternet=?, electricityWater=?, food=?, miscellaneous=?, 
             medical=?, familySupport=?, emergencyFund=?, investment=?, 
             month=?, year=?, balance=? 
         WHERE id=?`,
        updatedValues,
      );
    } else {
      const insertValues = updatedValues.slice(0, 14);
      return await pool.query(
        `INSERT INTO MonthlyBudget 
         (salary, rent, schoolSaving, phoneInternet, electricityWater, 
          food, miscellaneous, medical, familySupport, emergencyFund, investment, 
          month, year, balance) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        insertValues,
      );
    }
  },

  // Reset Month Rollover: Stages expected salary into PendingEarnings only
  resetMonth: async () => {
    const [rows] = await pool.query("SELECT * FROM MonthlyBudget WHERE id = 1");
    if (rows.length === 0) return 0;

    const b = rows[0];
    const expectedSalary = Number(b.salary) || 0;
    const currentWalletBalance = Number(b.balance) || 0;

    // Stage salary into PendingEarnings
    if (expectedSalary > 0) {
      await pool.query(
        `INSERT INTO PendingEarnings (amount, description, earned_date, is_collected) 
         VALUES (?, ?, NOW(), FALSE)`,
        [expectedSalary, "Shift Salary Rollover"],
      );
    }

    // Reset shift parameters
    await pool.query(
      `UPDATE MonthlyBudget 
       SET balance = ?, 
           salary = 0, 
           schoolSaving = 0,
           emergencyFund = 0,
           investment = 0,
           translatedLetters = 0, 
           shiftLetters = 0 
       WHERE id = 1`,
      [currentWalletBalance],
    );

    return currentWalletBalance;
  },
};
