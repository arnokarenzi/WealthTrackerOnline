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

  try {
    const [rows] = await SavingsGoal.getById(id);
    if (rows.length === 0)
      return res.status(404).json({ error: "Goal not found" });

    const goal = rows[0];
    const newCurrentAmount = Number(goal.currentAmount) + Number(amountToAdd);

    await SavingsGoal.update(id, newCurrentAmount);

    res.json({
      message: "Goal updated successfully",
      newAmount: newCurrentAmount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

// NEW: Delete handler
export const deleteGoal = async (req, res) => {
  const { id } = req.params;
  try {
    await SavingsGoal.delete(id);
    res.json({ message: "Goal deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
