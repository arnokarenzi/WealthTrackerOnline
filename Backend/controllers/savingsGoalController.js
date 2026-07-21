import { pool } from "../models/MonthlyBudget.js"; // Import pool for transactions
import SavingsGoal from "../models/SavingsGoal.js";

export const getGoals = async (req, res) => {
  try {
    const [rows] = await SavingsGoal.getAll();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateGoal = async (req, res) => {
  const { id } = req.params;
  const { amountToAdd } = req.body;
  const amount = Number(amountToAdd);

  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: "Invalid amount to add" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Check current wallet balance from MonthlyBudget
    const [budgetRows] = await connection.query(
      "SELECT balance FROM MonthlyBudget WHERE id = 1",
    );
    if (budgetRows.length === 0) {
      await connection.rollback();
      return res
        .status(404)
        .json({ error: "Monthly budget configuration not found." });
    }

    const currentBalance = Number(budgetRows[0].balance || 0);

    // 2. Validate sufficient wallet funds before allowing allocation
    if (currentBalance < amount) {
      await connection.rollback();
      return res.status(400).json({
        error:
          "Insufficient funds in your Wallet balance to make this allocation.",
      });
    }

    // 3. Verify the target savings goal exists
    const [goalRows] = await connection.query(
      "SELECT * FROM SavingsGoals WHERE id = ?",
      [id],
    );
    if (goalRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Savings goal not found." });
    }

    // 4. Deduct the contribution amount from the Wallet balance
    await connection.query(
      "UPDATE MonthlyBudget SET balance = balance - ? WHERE id = 1",
      [amount],
    );

    // 5. Add the contribution amount to the specific savings goal
    await connection.query(
      "UPDATE SavingsGoals SET currentAmount = currentAmount + ? WHERE id = ?",
      [amount, id],
    );

    await connection.commit();
    res.json({
      message: "Funds successfully allocated from wallet to savings goal.",
    });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

export const createGoal = async (req, res) => {
  const { goalName, targetAmount } = req.body;

  try {
    if (!goalName || !targetAmount) {
      return res
        .status(400)
        .json({ error: "Name and target amount are required" });
    }

    await SavingsGoal.create(goalName, targetAmount);

    res.status(201).json({ message: "Goal created successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteGoal = async (req, res) => {
  const { id } = req.params;
  try {
    await SavingsGoal.delete(id);
    res.json({ message: "Goal deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
