const numeric = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const roundMoney = (value) => Math.round((numeric(value) + Number.EPSILON) * 100) / 100;

export const calculateNetWorthTotals = (assets, liabilities) => {
  const totalAssets = roundMoney((assets || []).reduce((sum, item) => sum + numeric(item.currentValue), 0));
  const totalLiabilities = roundMoney((liabilities || []).reduce((sum, item) => sum + numeric(item.amount), 0));
  return { totalAssets, totalLiabilities, netWorth: roundMoney(totalAssets - totalLiabilities) };
};

export const calculateDebtPayment = (currentBalance, amount, epsilon = 0.00001) => {
  const balanceBefore = roundMoney(currentBalance);
  const paymentAmount = roundMoney(amount);
  if (!Number.isFinite(Number(amount)) || paymentAmount <= 0) {
    return { ok: false, error: "Payment amount must be positive." };
  }
  if (paymentAmount > balanceBefore + epsilon) {
    return { ok: false, error: "Payment cannot exceed the current outstanding balance." };
  }
  return {
    ok: true,
    balanceBefore,
    paymentAmount,
    balanceAfter: roundMoney(Math.max(0, balanceBefore - paymentAmount)),
  };
};

export const calculateRatioPercent = (numerator, denominator) => {
  const base = numeric(denominator);
  if (base <= 0) return null;
  return roundMoney((numeric(numerator) / base) * 100);
};

export const getBudgetAlertLevel = (percent, warningPercent, criticalPercent) => {
  if (numeric(percent) >= numeric(criticalPercent)) return "critical";
  if (numeric(percent) >= numeric(warningPercent)) return "warning";
  return "success";
};
