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
    // 1. Fetch template settings
    const [rows] = await pool.query(
      "SELECT * FROM AllocationTemplates WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      [USER_ID],
    );

    // 2. Fetch current monthly budget income
    const [[budget]] = await pool.query(
      "SELECT salary, otherIncome FROM MonthlyBudget WHERE id = 1",
    );

    // 3. Fetch static un-deposited emergency snapshots for the Pending Widget
    const [[snapshots]] = await pool.query(
      `SELECT 
         IFNULL(SUM(salary_allocation), 0) AS stagedSalaryEmergency, 
         IFNULL(SUM(side_income_allocation), 0) AS stagedSideEmergency 
       FROM PendingEmergencySnapshots 
       WHERE is_deposited = 0`,
    );

    const salary = Number(budget?.salary || 0);
    const otherIncome = Number(budget?.otherIncome || 0);
    const totalIncome = salary + otherIncome;

    const template = rows[0] || {
      essentials_pct: 50.0,
      emergency_pct: 15.0,
      invest_pct: 25.0,
      discretionary_pct: 10.0,
    };

    const emergencyPct = Number(template.emergency_pct || 0);

    // Dynamic live calculations for the Allocations Page
    const liveEmergencySalary = (salary * emergencyPct) / 100;
    const liveEmergencySide = (otherIncome * emergencyPct) / 100;
    const recommendedEmergency =
      Math.round((liveEmergencySalary + liveEmergencySide) * 100) / 100;

    // Static DB row amounts strictly for the Pending Emergency Target Widget
    const stagedSalaryPortion = Number(snapshots?.stagedSalaryEmergency || 0);
    const stagedSidePortion = Number(snapshots?.stagedSideEmergency || 0);
    const pendingEmergencyTotal =
      Math.round((stagedSalaryPortion + stagedSidePortion) * 100) / 100;

    res.json({
      ...template,
      salary,
      otherIncome,
      totalIncome,

      // Dynamic calculations strictly for the Allocations Page
      liveEmergencySalary,
      liveEmergencySide,
      liveRecommendedEmergency: recommendedEmergency,
      recommendedEmergency, // Dynamic target recommendation for MonthlyBudget

      // Static database snapshot amounts strictly for the Pending Emergency Target widget
      stagedSalaryPortion,
      stagedSidePortion,
      pendingSalaryPortion: stagedSalaryPortion,
      pendingSidePortion: stagedSidePortion,
      pendingEmergencyTotal,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const upsertAllocation = async (req, res) => {
  try {
    validatePercentages(req.body);

    const { essentials_pct, emergency_pct, invest_pct, discretionary_pct } =
      req.body;

    const [existing] = await pool.query(
      "SELECT id FROM AllocationTemplates WHERE user_id = ? LIMIT 1",
      [USER_ID],
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE AllocationTemplates 
         SET essentials_pct = ?, emergency_pct = ?, invest_pct = ?, discretionary_pct = ?, updated_at = NOW() 
         WHERE id = ?`,
        [
          essentials_pct,
          emergency_pct,
          invest_pct,
          discretionary_pct,
          existing[0].id,
        ],
      );
    } else {
      await pool.query(
        `INSERT INTO AllocationTemplates 
         (user_id, essentials_pct, emergency_pct, invest_pct, discretionary_pct) 
         VALUES (?, ?, ?, ?, ?)`,
        [USER_ID, essentials_pct, emergency_pct, invest_pct, discretionary_pct],
      );
    }

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
      "SELECT salary, otherIncome FROM MonthlyBudget WHERE id = 1",
    );

    const [[snapshots]] = await pool.query(
      `SELECT 
         IFNULL(SUM(salary_allocation), 0) AS stagedSalaryEmergency, 
         IFNULL(SUM(side_income_allocation), 0) AS stagedSideEmergency 
       FROM PendingEmergencySnapshots 
       WHERE is_deposited = 0`,
    );

    const salary = Number(budget?.salary || 0);
    const otherIncome = Number(budget?.otherIncome || 0);
    const totalIncome = salary + otherIncome;

    const calc = (pct) =>
      Math.round(((totalIncome * Number(pct)) / 100) * 100) / 100;

    const recommendedEssentials = calc(essentials_pct);
    const recommendedEmergency = calc(emergency_pct);
    const recommendedInvest = calc(invest_pct);
    const recommendedDiscretionary = calc(discretionary_pct);

    const stagedSalaryPortion = Number(snapshots?.stagedSalaryEmergency || 0);
    const stagedSidePortion = Number(snapshots?.stagedSideEmergency || 0);
    const pendingEmergencyTotal =
      Math.round((stagedSalaryPortion + stagedSidePortion) * 100) / 100;

    // Updates recommended targets without touching MonthlyBudget.emergencyFund
    await pool.query(
      `UPDATE MonthlyBudget 
       SET recommendedEssentials = ?, 
           recommendedEmergency = ?, 
           recommendedInvest = ?, 
           recommendedDiscretionary = ?,
           investment = ?,
           miscellaneous = ?
       WHERE id = 1`,
      [
        recommendedEssentials,
        recommendedEmergency,
        recommendedInvest,
        recommendedDiscretionary,
        recommendedInvest,
        recommendedDiscretionary,
      ],
    );

    res.json({
      salary,
      otherIncome,
      totalIncome,
      recommendedEssentials,
      recommendedEmergency,
      recommendedInvest,
      recommendedDiscretionary,
      stagedSalaryPortion,
      stagedSidePortion,
      pendingEmergencyTotal,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
