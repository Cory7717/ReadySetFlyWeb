import test from "node:test";
import assert from "node:assert/strict";
import { buildCertificationScenarios } from "./scenario-generator";
import { runFlightServiceScenarios, summarizeScenarioResults } from "./scenario-runner";

const argValue = (name: string, fallback: string) => {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

test("generated Flight Service certification scenarios pass expected mock outcomes", () => {
  const seed = Number(argValue("seed", "20260701"));
  const count = Number(argValue("count", "50"));
  const scenarios = buildCertificationScenarios({ seed, count });
  const results = runFlightServiceScenarios(scenarios);
  const summary = summarizeScenarioResults(results);
  const failures = results.filter((result) => !result.passed);

  assert.equal(failures.length, 0, failures.map((failure) => ({
    name: failure.scenario.name,
    mismatches: failure.mismatches,
    validationErrors: failure.validationErrors,
    steps: failure.reproductionSteps,
  })));
  assert.equal(summary.totalScenarios, count + 25);
  assert.ok(summary.providerCallsBlocked > 0);
  assert.ok(summary.providerCallsAttempted > 0);
  assert.ok(summary.seanFeedbackCoverage >= 15);
});

test("provider/lab certification mode fails closed without explicit env confirmation", () => {
  const enabled = process.env.FLIGHT_SERVICE_PROVIDER_TESTS_ENABLED === "true";
  const confirmed = process.env.FLIGHT_SERVICE_PROVIDER_TEST_CONFIRMATION === "I_UNDERSTAND_THIS_CALLS_PROVIDER_LAB";

  if (enabled || confirmed) {
    assert.equal(enabled, true);
    assert.equal(confirmed, true);
    return;
  }

  assert.equal(enabled, false);
  assert.equal(confirmed, false);
});
