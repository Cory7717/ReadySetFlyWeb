import assert from "node:assert/strict";
import test from "node:test";
import { calculateLaborRoi } from "../../client/src/lib/inntrix-roi";

test("calculates the illustrative INNTRIX labor scenario", () => {
  const result = calculateLaborRoi({
    currentWeeklyHours: 675,
    targetWeeklyHours: 600,
    hourlyLaborCost: 20,
    monthlySubscription: 199,
  });

  assert.equal(result.weeklyHoursSaved, 75);
  assert.equal(result.annualizedHoursSaved, 3_900);
  assert.equal(result.estimatedWeeklyLaborSavings, 1_500);
  assert.equal(result.estimatedAnnualLaborSavings, 78_000);
  assert.equal(result.estimatedAnnualSubscriptionExpense, 2_388);
  assert.equal(result.estimatedAnnualNetBenefit, 75_612);
});

test("never reports saved hours when the target exceeds current usage", () => {
  const result = calculateLaborRoi({
    currentWeeklyHours: 500,
    targetWeeklyHours: 550,
    hourlyLaborCost: 25,
    monthlySubscription: 0,
  });

  assert.equal(result.weeklyHoursSaved, 0);
  assert.equal(result.estimatedAnnualLaborSavings, 0);
  assert.equal(result.estimatedAnnualNetBenefit, 0);
});

test("safely normalizes negative and non-finite inputs", () => {
  const result = calculateLaborRoi({
    currentWeeklyHours: Number.NaN,
    targetWeeklyHours: -10,
    hourlyLaborCost: Number.POSITIVE_INFINITY,
    monthlySubscription: -199,
  });

  assert.equal(result.currentWeeklyHours, 0);
  assert.equal(result.targetWeeklyHours, 0);
  assert.equal(result.hourlyLaborCost, 0);
  assert.equal(result.monthlySubscription, 0);
});
