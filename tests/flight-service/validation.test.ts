import test from "node:test";
import assert from "node:assert/strict";
import { validateFlightPlanForAction } from "../../server/services/flight-plan-filing/provider";
import { getFlightServiceRuntimeMode, hasFlightServiceTestAcknowledgement } from "../../server/services/flightServiceRuntimeMode";
import { filingPlan, resetPlannerState } from "./test-utils";

test("invalid equipment SCE is blocked before provider call", () => {
  const result = validateFlightPlanForAction(filingPlan({
    filingEquipment: "SCE",
    filingSurveillanceEquipment: "S",
  }), "file");
  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) => /invalid ICAO code/i.test(error)));
});

test("missing altitude is blocked before provider call", () => {
  const result = validateFlightPlanForAction(filingPlan({
    filingPlannedAltitudeFt: null,
  }), "file");
  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) => /planned altitude/i.test(error)));
});

test("missing fuel endurance is blocked before provider call", () => {
  const result = validateFlightPlanForAction(filingPlan({
    filingEnduranceMinutes: null,
  }), "file");
  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) => /endurance/i.test(error)));
});

test("new plan reset state does not retain stale provider errors", () => {
  const reset = resetPlannerState();
  assert.equal(reset.filingActionFeedback, null);
  assert.equal(reset.providerUpdatesPlan, null);
  assert.equal(reset.filingPreview, null);
  assert.equal(reset.draftPlanId, null);
  assert.equal(reset.editingPlan, null);
});

test("clear form clears validation and provider error state", () => {
  const reset = resetPlannerState();
  assert.equal(reset.filingActionFeedback, null);
  assert.equal(reset.showFilingPayload, false);
});

test("Flight Service environment defaults to LAB with acknowledgement required", () => {
  const mode = getFlightServiceRuntimeMode({});
  assert.equal(mode.environment, "LAB");
  assert.equal(mode.operationalFilingEnabled, false);
  assert.equal(mode.providerTestModeEnabled, true);
  assert.equal(mode.acknowledgementRequired, true);
});

test("Flight Service production requires explicit operational filing flag", () => {
  const withoutFlag = getFlightServiceRuntimeMode({ FLIGHT_SERVICE_ENVIRONMENT: "PRODUCTION" });
  assert.equal(withoutFlag.environment, "PRODUCTION");
  assert.equal(withoutFlag.operationalFilingEnabled, false);
  assert.equal(withoutFlag.acknowledgementRequired, true);

  const withFlag = getFlightServiceRuntimeMode({
    FLIGHT_SERVICE_ENVIRONMENT: "PRODUCTION",
    FLIGHT_FILING_OPERATIONAL_ENABLED: "true",
  });
  assert.equal(withFlag.operationalFilingEnabled, true);
  assert.equal(withFlag.acknowledgementRequired, false);
});

test("Flight Service test acknowledgement must match environment and expire after 24 hours", () => {
  const now = Date.parse("2026-07-01T12:00:00.000Z");
  const acknowledgedAt = new Date(now - 60_000).toISOString();
  assert.equal(hasFlightServiceTestAcknowledgement({
    testAcknowledgement: {
      accepted: true,
      environment: "LAB",
      acknowledgedAt,
    },
  }, "LAB", now), true);
  assert.equal(hasFlightServiceTestAcknowledgement({
    testAcknowledgement: {
      accepted: true,
      environment: "TEST",
      acknowledgedAt,
    },
  }, "LAB", now), false);
  assert.equal(hasFlightServiceTestAcknowledgement({
    testAcknowledgement: {
      accepted: true,
      environment: "LAB",
      acknowledgedAt: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
    },
  }, "LAB", now), false);
});
