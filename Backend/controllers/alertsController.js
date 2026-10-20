import { pool } from "../models/MonthlyBudget.js";
import { getKigaliTime } from "../utils/kigaliTime.js";

export const getAlerts = async (req, res) => {
  try {
    // ExpenseDate is a DATE (calendar date), so compare against the first
    // calendar day of the current Kigali month; don't round-trip through UTC ISO.
    const { year, month } = getKigaliTime();
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;

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
    const alerts = [];

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
