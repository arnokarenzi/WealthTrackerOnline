import { pool } from "./MonthlyBudget.js";

const SavingsGoal = {
  // Fetch all goals
  getAll: () => pool.query("SELECT * FROM SavingsGoals"),

  // Fetch a single goal by ID
  getById: (id) => pool.query("SELECT * FROM SavingsGoals WHERE id = ?", [id]),

  // Create new goal
  create: (goalName, targetAmount) => {
    return pool.query(
      "INSERT INTO SavingsGoals (goalName, targetAmount, currentAmount) VALUES (?, ?, 0)",
      [goalName, targetAmount],
    );
  },

  // Update core fields
  update: (id, currentAmount) => {
    const sql = `UPDATE SavingsGoals SET currentAmount = ? WHERE id = ?`;
    return pool.query(sql, [currentAmount, id]);
  },

  // NEW: Delete a goal
  delete: (id) => pool.query("DELETE FROM SavingsGoals WHERE id = ?", [id]),
};

export default SavingsGoal;
