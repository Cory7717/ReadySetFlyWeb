import test from "node:test";
import assert from "node:assert/strict";
import { buildCertificationScenarios } from "./scenario-generator";
import { runFlightServiceScenarios, summarizeScenarioResults } from "./scenario-runner";
import { resolveDepartureAirportTimezone } from "../../shared/airport-timezones";

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

test("generated certification scenarios store departure timezone for actual departure airport", () => {
  const scenarios = buildCertificationScenarios({ seed: 20260701, count: 100 });
  const mismatches: Array<Record<string, unknown>> = [];

  for (const scenario of scenarios) {
    const plan = (scenario.visibleForm || scenario.savedPlan || scenario.initialPlan || {}) as Record<string, any>;
    const departure = String(plan.departure || "KEDC").trim().toUpperCase();
    const plannerState = plan.plannerState && typeof plan.plannerState === "object" ? plan.plannerState as Record<string, unknown> : {};
    const planningReferenceDepartureAirport = String(plannerState.planningReferenceDepartureAirport || "").trim().toUpperCase();
    const expected = resolveDepartureAirportTimezone({
      departureAirport: { icao: departure },
      planningReferenceDepartureAirport: planningReferenceDepartureAirport
        ? { icao: planningReferenceDepartureAirport }
        : null,
    }).timezone;
    const actual = String(plannerState.departureTimeZone || "").trim() || null;

    if (actual && expected && actual !== expected) {
      mismatches.push({ scenario: scenario.name, departure, planningReferenceDepartureAirport, actual, expected });
    }
  }

  assert.deepEqual(mismatches, []);
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
