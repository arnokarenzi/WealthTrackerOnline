import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDebtPayment,
  calculateNetWorthTotals,
  calculateRatioPercent,
  getBudgetAlertLevel,
  roundMoney,
} from "../utils/featureMath.js";

test("roundMoney rounds financial values to cents", () => {
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney("2.345"), 2.35);
  assert.equal(roundMoney(Number.NaN), 0);
});

test("net worth totals equal assets minus liabilities", () => {
  assert.deepEqual(calculateNetWorthTotals(
    [{ currentValue: 125.25 }, { currentValue: 74.75 }],
    [{ amount: 60.10 }, { amount: 15.15 }],
  ), { totalAssets: 200, totalLiabilities: 75.25, netWorth: 124.75 });
});

test("repayment calculations retain a correct before and after balance", () => {
  assert.deepEqual(calculateDebtPayment(100, 35.25), {
    ok: true, balanceBefore: 100, paymentAmount: 35.25, balanceAfter: 64.75,
  });
  assert.equal(calculateDebtPayment(100, 0).ok, false);
  assert.equal(calculateDebtPayment(100, 100.01).ok, false);
});

test("ratio is omitted if the denominator is zero and is otherwise a percentage", () => {
  assert.equal(calculateRatioPercent(250, 1000), 25);
  assert.equal(calculateRatioPercent(1, 0), null);
});

test("budget alert severity follows warning and critical thresholds", () => {
  assert.equal(getBudgetAlertLevel(79, 80, 100), "success");
  assert.equal(getBudgetAlertLevel(80, 80, 100), "warning");
  assert.equal(getBudgetAlertLevel(100, 80, 100), "critical");
});
