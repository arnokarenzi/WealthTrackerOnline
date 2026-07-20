import { pool } from "../models/MonthlyBudget.js";

const USER_ID = 1;

const validatePercentages = (template) => {
  const total =
    Number(template.essentials_pct) +
    Number(template.emergency_pct) +
    Number(template.invest_pct) +
    Number(template.discretionary_pct);

  if (total !== 100) {
    throw new Error("Allocation percentages must total 100%");
  }
};

export const getAllocation = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM AllocationTemplates WHERE user_id = ? LIMIT 1",
      [USER_ID],
    );
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const upsertAllocation = async (req, res) => {
  try {
    validatePercentages(req.body);

    const { essentials_pct, emergency_pct, invest_pct, discretionary_pct } =
      req.body;

    const sql = `
      INSERT INTO AllocationTemplates 
      (user_id, essentials_pct, emergency_pct, invest_pct, discretionary_pct)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        essentials_pct=?,
        emergency_pct=?,
        invest_pct=?,
        discretionary_pct=?,
        updated_at=NOW()
    `;

    await pool.query(sql, [
      USER_ID,
      essentials_pct,
      emergency_pct,
      invest_pct,
      discretionary_pct,
      essentials_pct,
      emergency_pct,
      invest_pct,
      discretionary_pct,
    ]);

    res.json({ message: "Allocation saved successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const applyAllocation = async (req, res) => {
  try {
    const { essentials_pct, emergency_pct, invest_pct, discretionary_pct } =
      req.body;

    const [[budget]] = await pool.query(
      "SELECT salary, otherIncome FROM MonthlyBudget WHERE id=1",
    );

    const income =
      Number(budget?.salary || 0) + Number(budget?.otherIncome || 0);

    const calc = (pct) =>
      Math.round(((income * Number(pct)) / 100) * 100) / 100;

    const recommendedEssentials = calc(essentials_pct);
    const recommendedEmergency = calc(emergency_pct);
    const recommendedInvest = calc(invest_pct);
    const recommendedDiscretionary = calc(discretionary_pct);

    await pool.query(
      `UPDATE MonthlyBudget 
       SET recommendedEssentials=?, 
           recommendedEmergency=?, 
           recommendedInvest=?, 
           recommendedDiscretionary=? 
       WHERE id=1`,
      [
        recommendedEssentials,
        recommendedEmergency,
        recommendedInvest,
        recommendedDiscretionary,
      ],
    );

    res.json({
      recommendedEssentials,
      recommendedEmergency,
      recommendedInvest,
      recommendedDiscretionary,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
