// Explainable Financial Health score based only on data currently persisted by FinTrack.
// Maximum score = 100: emergency buffer 40, investments 30, spending control 20, wallet 10.
const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clampAtZero = (value) => Math.max(0, number(value));

export const calculateFinancialHealth = ({
  emergencyBalance = 0,
  emergencyTarget = 0,
  investmentValue = 0,
  liveIncome = 0,
  walletBalance = 0,
  actualExpenses = 0,
  plannedEssentials = 0,
} = {}) => {
  const emergency = clampAtZero(emergencyBalance);
  const target = clampAtZero(emergencyTarget);
  const income = clampAtZero(liveIncome);
  const investments = clampAtZero(investmentValue);
  const wallet = number(walletBalance);
  const spending = clampAtZero(actualExpenses);
  const essentialsBudget = clampAtZero(plannedEssentials);

  // Emergency fund is scored only if an actual target has been configured.
  const emergencyTargetConfigured = target > 0;
  const efCompletionPct = emergencyTargetConfigured
    ? Math.min((emergency / target) * 100, 100)
    : 0;
  const emergencyPoints = emergencyTargetConfigured
    ? Math.round((efCompletionPct / 100) * 40)
    : 0;

  // The existing metric caps investment credit at a 20% investment-to-income ratio.
  const investRatioPct = income > 0 ? (investments / income) * 100 : 0;
  const investmentPoints = income > 0
    ? Math.round(Math.min((investRatioPct / 20) * 30, 30))
    : 0;

  // Award up to 20 points for spending within the planned essentials budget.
  // At/under budget: full points. Between 100% and 200% of budget, points
  // decline linearly. At 200% or more, no points. No configured budget = 0.
  const essentialsBudgetConfigured = essentialsBudget > 0;
  const spendingPct = essentialsBudgetConfigured
    ? (spending / essentialsBudget) * 100
    : null;
  let budgetControlPoints = 0;
  if (essentialsBudgetConfigured) {
    budgetControlPoints = spending <= essentialsBudget
      ? 20
      : Math.round(Math.max(0, 20 * (2 - spending / essentialsBudget)));
  }

  const positiveWalletBalance = wallet > 0;
  const walletPoints = positiveWalletBalance ? 10 : 0;

  // Sum integer component scores so the displayed total always matches the breakdown.
  const wealthScore = Math.min(
    100,
    emergencyPoints + investmentPoints + budgetControlPoints + walletPoints,
  );

  let financialStage;
  if (wealthScore <= 40) financialStage = "Priority: Build Safety";
  else if (wealthScore <= 60) financialStage = "Stability Phase";
  else if (wealthScore <= 80) financialStage = "Investing Mode";
  else financialStage = "Wealth Builder";

  return {
    wealthScore,
    financialStage,
    efCompletionPct: Math.round(efCompletionPct),
    investRatioPct: Math.round(investRatioPct),
    breakdown: {
      emergencyBuffer: {
        points: emergencyPoints,
        maxPoints: 40,
        progressPct: Math.round(efCompletionPct),
        targetConfigured: emergencyTargetConfigured,
        balance: emergency,
        target,
      },
      investment: {
        points: investmentPoints,
        maxPoints: 30,
        ratioPct: Math.round(investRatioPct),
        capRatioPct: 20,
        incomeConfigured: income > 0,
        value: investments,
      },
      budgetControl: {
        points: budgetControlPoints,
        maxPoints: 20,
        configured: essentialsBudgetConfigured,
        spendingPct: spendingPct == null ? null : Math.round(spendingPct),
        actualExpenses: spending,
        plannedEssentials: essentialsBudget,
      },
      wallet: {
        points: walletPoints,
        maxPoints: 10,
        positiveBalance: positiveWalletBalance,
        balance: wallet,
      },
    },
  };
};
