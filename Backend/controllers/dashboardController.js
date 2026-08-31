import { pool } from "../models/MonthlyBudget.js";

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const RATE_PER_LETTER = 245;
const MAX_SHIFT_LETTERS = 750;

export const getDashboard = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM MonthlyBudget WHERE id = 1");
    if (!rows.length) {
      return res.status(404).json({ error: "Budget row not found" });
    }
    const b = rows[0];
    const currentMonth = Number(b.month);
    const currentYear = Number(b.year);

    const [templates] = await pool.query(
      "SELECT emergency_pct FROM AllocationTemplates WHERE user_id = 1 LIMIT 1",
    );
    const emergencyPct =
      templates.length > 0 ? n(templates[0].emergency_pct) : 0;

    const [expensesRows] = await pool.query(
      `SELECT IFNULL(SUM(amount), 0) AS totalSpent 
       FROM DailyExpense 
       WHERE MONTH(expenseDate) = ? AND YEAR(expenseDate) = ?`,
      [currentMonth, currentYear],
    );
    const actualSpentFromDaily = n(expensesRows[0].totalSpent);

    const [investmentRows] = await pool.query(
      `SELECT IFNULL(SUM(principal_invested), 0) AS totalPrincipal, 
              IFNULL(SUM(current_value), 0) AS totalValue 
       FROM ActualInvestments 
       WHERE month = ? AND year = ?`,
      [currentMonth, currentYear],
    );
    const actualPrincipalInvested = n(investmentRows[0].totalPrincipal);
    const currentInvestmentValue = n(investmentRows[0].totalValue);

    const liveSalary = n(b.translatedLetters) * RATE_PER_LETTER;
    const liveIncome = liveSalary + n(b.otherIncome);
    const liveBalance = n(b.balance);

    await pool.query("UPDATE MonthlyBudget SET salary = ? WHERE id = 1", [
      liveSalary,
    ]);

    const plannedEssentials =
      n(b.rent) +
      n(b.phoneInternet) +
      n(b.electricityWater) +
      n(b.food) +
      n(b.miscellaneous) +
      n(b.medical) +
      n(b.familySupport);

    const now = new Date();
    const day = now.getDate();
    const lastDayOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();

    const isShift1 = day <= 15;
    const totalDaysInShift = isShift1 ? 15 : lastDayOfMonth - 15;
    const shiftDay = isShift1 ? day : day - 15;

    const shiftLetters = n(b.shiftLetters);
    const remainingToMax = MAX_SHIFT_LETTERS - shiftLetters;

    // --- NEW GRANULAR TIME MATH FOR MEDALS ---
    const completedDays = Math.max(0, shiftDay - 1);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const fractionOfToday = (currentHour + currentMinute / 60) / 24; 
    const preciseDaysElapsed = completedDays + fractionOfToday;

    const dailyMax = MAX_SHIFT_LETTERS / totalDaysInShift;
    const dailyMin = (MAX_SHIFT_LETTERS * 0.9) / totalDaysInShift;

    // Use precise fraction instead of whole integer to calculate pace targets
    const maxPace = preciseDaysElapsed * dailyMax;
    const minPace = preciseDaysElapsed * dailyMin;

    const remainingDaysInShift = Math.max(1, totalDaysInShift - shiftDay + 1);
    const chunkPacingTarget = Math.round(remainingToMax / remainingDaysInShift);

    let shiftStatus = {
      medal: "None",
      message: "",
      variant: "light",
      behind: 0,
      isLastDay: day === 15 || day === lastDayOfMonth,
      shiftDay, 
      totalDaysInShift,
      isShift1,
      currentDay: day,
      chunkPacingTarget,
    };

    if (shiftLetters >= maxPace) {
      shiftStatus.medal = "🥇 Gold";
      shiftStatus.message = `Elite Performance! Only ${remainingToMax} letters left to reach your shift cap.`;
      shiftStatus.variant = "warning";
    } else if (shiftLetters >= minPace) {
      const toGold = Math.ceil(maxPace - shiftLetters);
      shiftStatus.medal = "🥈 Silver";
      shiftStatus.message = `Optimal Pace. You need ${toGold} more letters to hit the Gold track!`;
      shiftStatus.variant = "secondary";
    } else if (shiftLetters >= maxPace * 0.8) {
      const toSilver = Math.ceil(minPace - shiftLetters);
      shiftStatus.medal = "🥉 Bronze";
      shiftStatus.message = `Slightly behind pace. Add ${toSilver} more letters to reach Silver territory.`;
      shiftStatus.variant = "success";
    } else {
      shiftStatus.behind = Math.round((maxPace * 0.8) - shiftLetters);
      shiftStatus.medal = "⚠️ Danger";
      shiftStatus.message = `DANGER: You are ${shiftStatus.behind} letters behind the safety guard!`;
      shiftStatus.variant = "danger";
    }

    // --- NEW PROJECTED PAY MATH (Never falls below actual typed amount) ---
    let projectedPay = 0;
    if (shiftStatus.medal.includes("Gold")) {
      projectedPay = MAX_SHIFT_LETTERS * RATE_PER_LETTER;
    } else if (shiftStatus.medal.includes("Silver")) {
      projectedPay = Math.max(shiftLetters, (MAX_SHIFT_LETTERS * 0.9)) * RATE_PER_LETTER;
    } else if (shiftStatus.medal.includes("Bronze")) {
      projectedPay = Math.max(shiftLetters, (MAX_SHIFT_LETTERS * 0.8)) * RATE_PER_LETTER;
    } else {
      projectedPay = shiftLetters * RATE_PER_LETTER;
    }

    shiftStatus.projectedPay = projectedPay;
    shiftStatus.potentialLoss =
      MAX_SHIFT_LETTERS * RATE_PER_LETTER - projectedPay;

    const emergencyTarget = (liveIncome * emergencyPct) / 100;
    const efCompletionPct =
      emergencyTarget > 0
        ? Math.min((n(b.emergencyFund) / emergencyTarget) * 100, 100)
        : 100;

    const effectiveInvestmentVal =
      currentInvestmentValue > 0 ? currentInvestmentValue : n(b.investment);
    const investRatio =
      liveIncome > 0 ? (effectiveInvestmentVal / liveIncome) * 100 : 0;

    let score = 0;
    score += (efCompletionPct / 100) * 40;
    score += Math.min((investRatio / 20) * 30, 30);
    if (liveBalance > 0) score += 10;

    const stages = [
      "Priority: Build Safety",
      "Stability Phase",
      "Investing Mode",
      "Wealth Builder",
    ];
    const stageIndex = score <= 40 ? 0 : score <= 60 ? 1 : score <= 80 ? 2 : 3;

    res.json({
      wealthScore: Math.round(score),
      financialStage: stages[stageIndex],
      emergencyTarget,
      efCompletionPct: Math.round(efCompletionPct),
      seedRatio: Math.round(investRatio),
      essentials: plannedEssentials,
      shiftStatus,
      monthlyBudget: {
        ...b,
        salary: liveSalary,
        balance: liveBalance,
        remainingBalance: liveBalance,
      },
    });
  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const updateLetters = async (req, res) => {
  const { newLetters } = req.body;
  const num = Number(newLetters);

  try {
    const [rows] = await pool.query(
      "SELECT translatedLetters, shiftLetters FROM MonthlyBudget WHERE id = 1",
    );
    const currentTotal = rows[0].translatedLetters + num;
    const currentShift = rows[0].shiftLetters + num;

    if (currentShift > MAX_SHIFT_LETTERS) {
      return res.status(400).json({
        error: `Limit reached! You can only add ${MAX_SHIFT_LETTERS - rows[0].shiftLetters} more letters this shift.`,
      });
    }

    const newSalary = currentTotal * RATE_PER_LETTER;

    await pool.query(
      "UPDATE MonthlyBudget SET translatedLetters = ?, shiftLetters = ?, salary = ? WHERE id = 1",
      [currentTotal, currentShift, newSalary],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Update Letters Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const resetShift = async (req, res) => {
  try {
    // 1. Fetch completed shift letters before reset
    const [rows] = await pool.query(
      "SELECT shiftLetters FROM MonthlyBudget WHERE id = 1"
    );
    
    if (rows.length > 0) {
      const currentShiftLetters = n(rows[0].shiftLetters);
      const earnedAmount = currentShiftLetters * RATE_PER_LETTER;

      // 2. Insert into PendingEarnings matching actual schema columns
      if (earnedAmount > 0) {
        await pool.query(
          `INSERT INTO PendingEarnings (amount, description, is_collected, earned_date) 
           VALUES (?, ?, 0, NOW())`,
          [earnedAmount, `Shift Salary (${currentShiftLetters} letters)`]
        );
      }
    }

    // 3. Reset shift metrics for the next shift
    await pool.query(`
      UPDATE MonthlyBudget 
      SET shiftLetters = 0, 
          translatedLetters = 0, 
          salary = 0 
      WHERE id = 1
    `);

    res.json({ message: "Shift reset successful! Earnings moved to Pending Buffer." });
  } catch (err) {
    console.error("Reset Shift Error:", err);
    res.status(500).json({ error: err.message });
  }
};


export const updateMonthlyBudget = async (req, res) => {
  const { id } = req.params;
  const incoming = req.body;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM MonthlyBudget WHERE id = ?",
      [id],
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Budget row not found" });
    }

    const [templates] = await pool.query(
      "SELECT emergency_pct FROM AllocationTemplates WHERE user_id = 1 LIMIT 1",
    );

    const current = { ...rows[0], ...incoming };
    const emergencyPct =
      templates.length > 0 ? n(templates[0].emergency_pct) : 0;
    const income = n(current.salary) + n(current.otherIncome);
    const emergencyTarget = (income * emergencyPct) / 100;

    let finalInvestment = n(current.investment);
    let locked = false;

    if (n(current.emergencyFund) < emergencyTarget) {
      if (finalInvestment > 0) {
        finalInvestment = 0;
        locked = true;
      }
    }

    const sql = `UPDATE MonthlyBudget SET 
      salary=?, otherIncome=?, rent=?, schoolSaving=?, phoneInternet=?, electricityWater=?, 
      food=?, miscellaneous=?, medical=?, familySupport=?, emergencyFund=?, investment=?
      WHERE id=?`;

    await pool.query(sql, [
      n(current.salary),
      n(current.otherIncome),
      n(current.rent),
      n(current.schoolSaving),
      n(current.phoneInternet),
      n(current.electricityWater),
      n(current.food),
      n(current.miscellaneous),
      n(current.medical),
      n(current.familySupport),
      n(current.emergencyFund),
      finalInvestment,
      id,
    ]);

    res.json({
      message: locked
        ? `Investment Locked: ${(emergencyTarget - n(current.emergencyFund)).toLocaleString()} RWF more needed in Emergency Fund.`
        : "Budget updated successfully.",
      investmentLocked: locked,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
