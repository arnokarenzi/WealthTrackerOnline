import test from "node:test";
import assert from "node:assert/strict";
import { calculateFinancialHealth } from "../utils/financialHealthScore.js";

test("perfect configured profile can reach 100/100", () => {
  const result = calculateFinancialHealth({
    emergencyBalance: 200_000,
    emergencyTarget: 200_000,
    investmentValue: 200_000,
    liveIncome: 1_000_000,
    walletBalance: 25_000,
    actualExpenses: 100_000,
    plannedEssentials: 100_000,
  });
  assert.equal(result.wealthScore, 100);
  assert.equal(result.financialStage, "Wealth Builder");
  assert.equal(
    result.breakdown.emergencyBuffer.points +
    result.breakdown.investment.points +
    result.breakdown.budgetControl.points +
    result.breakdown.wallet.points,
    result.wealthScore,
  );
});

test("missing emergency target does not award free emergency points", () => {
  const result = calculateFinancialHealth({
    emergencyBalance: 500_000,
    emergencyTarget: 0,
    investmentValue: 200_000,
    liveIncome: 1_000_000,
    walletBalance: 1,
    actualExpenses: 50_000,
    plannedEssentials: 100_000,
  });
  assert.equal(result.efCompletionPct, 0);
  assert.equal(result.breakdown.emergencyBuffer.points, 0);
  assert.equal(result.wealthScore, 60);
});

test("overspending reduces budget-control points", () => {
  const result = calculateFinancialHealth({
    emergencyBalance: 100_000,
    emergencyTarget: 200_000,
    investmentValue: 0,
    liveIncome: 1_000_000,
    walletBalance: 0,
    actualExpenses: 150_000,
    plannedEssentials: 100_000,
  });
  assert.equal(result.breakdown.budgetControl.points, 10);
  assert.equal(result.wealthScore, 30);
});

test("zero income and zero essentials budget do not generate points", () => {
  const result = calculateFinancialHealth({
    emergencyBalance: 1_000_000,
    emergencyTarget: 0,
    investmentValue: 5_000_000,
    liveIncome: 0,
    walletBalance: 0,
    actualExpenses: 0,
    plannedEssentials: 0,
  });
  assert.equal(result.breakdown.emergencyBuffer.points, 0);
  assert.equal(result.breakdown.investment.points, 0);
  assert.equal(result.breakdown.budgetControl.points, 0);
  assert.equal(result.wealthScore, 0);
});
