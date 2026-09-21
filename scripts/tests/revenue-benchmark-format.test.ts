import assert from "node:assert/strict";
import test from "node:test";
import { budgetVsPriorYearPercent, editableBenchmarkValue, formatBenchmarkValue, formatBudgetVsPriorYearVariance, parseBenchmarkValue } from "../../client/src/lib/revenue-benchmark-format";

test("benchmark values display as currency, room counts, and percentages", () => {
  assert.equal(formatBenchmarkValue("307753.00", "currency"), "$307,753.00");
  assert.equal(formatBenchmarkValue(2625, "rooms"), "2,625");
  assert.equal(formatBenchmarkValue("0.71760", "percent"), "71.76%");
  assert.equal(formatBenchmarkValue(null, "currency"), "");
});

test("editing percentages preserves the decimal API value", () => {
  assert.equal(editableBenchmarkValue("0.71760", "percent"), "71.76");
  assert.equal(parseBenchmarkValue("71.76%", "percent"), "0.7176");
  assert.equal(parseBenchmarkValue("$307,753.00", "currency"), "307753");
  assert.equal(parseBenchmarkValue("2,625", "rooms"), "2625");
  assert.equal(parseBenchmarkValue("", "percent"), "");
});

test("invalid benchmark values are rejected before saving", () => {
  assert.equal(parseBenchmarkValue("101", "percent"), null);
  assert.equal(parseBenchmarkValue("-1", "currency"), null);
  assert.equal(parseBenchmarkValue("2.5", "rooms"), null);
  assert.equal(parseBenchmarkValue("abc", "currency"), null);
});

test("budget variance compares budget with prior-year actual revenue", () => {
  assert.ok(Math.abs(budgetVsPriorYearPercent(366543, 307753)! - 19.10298) < 0.001);
  assert.equal(budgetVsPriorYearPercent(900, 1000), -10);
  assert.equal(budgetVsPriorYearPercent(1000, 0), null);
  assert.equal(formatBudgetVsPriorYearVariance(366543, 307753), "+19.10%");
  assert.equal(formatBudgetVsPriorYearVariance(900, 1000), "-10.00%");
  assert.equal(formatBudgetVsPriorYearVariance(1000, 1000), "0.00%");
  assert.equal(formatBudgetVsPriorYearVariance(null, 1000), "—");
  assert.equal(formatBudgetVsPriorYearVariance(1000, 0), "—");
});
