import test from "node:test";
import assert from "node:assert/strict";
import { validateFlightPlanForAction } from "../../server/services/flight-plan-filing/provider";
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
