import { pool } from "../models/MonthlyBudget.js";

export const getAlerts = async (req, res) => {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    const startDate = monthStart.toISOString().slice(0, 10);

    const [expenses] = await pool.query(
      "SELECT category, SUM(amount) as spent FROM DailyExpense WHERE expenseDate >= ? GROUP BY category",
      [startDate],
    );

    const essentialsCategories = [
      "food",
      "rent",
      "miscellaneous",
      "phoneInternet",
      "electricityWater",
      "medical",
      "familySupport",
    ];

    let essentialsSpent = 0;

    expenses.forEach((row) => {
      if (essentialsCategories.includes(row.category)) {
        essentialsSpent += Number(row.spent || 0);
      }
    });

    const [[budget]] = await pool.query(
      "SELECT recommendedEssentials FROM MonthlyBudget WHERE id=1",
    );

    const recommended = Number(budget?.recommendedEssentials || 0);

    let alerts = [];

    if (recommended > 0) {
      const pct = Math.round((essentialsSpent / recommended) * 100);

      if (pct >= 100) {
        alerts.push({
          level: "critical",
          message: `Essentials spending exceeded budget (${pct}%)`,
        });
      } else if (pct >= 80) {
        alerts.push({
          level: "warning",
          message: `Essentials spending at ${pct}% of budget`,
        });
      }
    }

    res.json({ alerts, essentialsSpent, recommended });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
