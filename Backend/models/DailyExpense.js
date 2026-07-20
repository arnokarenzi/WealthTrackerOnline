import { pool } from "./MonthlyBudget.js";

const DailyExpense = {
  getAll: () =>
    pool.query("SELECT * FROM DailyExpense ORDER BY expenseDate DESC"),
  create: (data) => {
    const sql =
      "INSERT INTO DailyExpense (expenseDate, description, category, amount, notes) VALUES (?, ?, ?, ?, ?)";
    return pool.query(sql, [
      data.expenseDate,
      data.description,
      data.category,
      data.amount,
      data.notes || "", // Ensures an empty string is saved if no note is provided
    ]);
  },
  delete: (id) => pool.query("DELETE FROM DailyExpense WHERE id = ?", [id]),
};

export default DailyExpense;
