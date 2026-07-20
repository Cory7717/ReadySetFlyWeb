import assert from "node:assert/strict";
import test from "node:test";
import {
  amendMutationForCase,
  buildCases,
  buildCleanupVerification,
  buildCleanupSummary,
  buildValidationSummary,
  compareGeneratedSentReturned,
  shouldCleanupImmediatelyAfterCase,
} from "./leidos-live-lab/live-lab-runner";

const context = {
  user: { id: "test-user", email: "test@example.invalid" },
  profile: {
    id: "test-aircraft",
    tailNumber: "N123RS",
    filingEquipmentDefault: "S",
    filingSoulsOnBoardDefault: "2",
    filingAircraftColorDefault: "WHITE BLUE",
    filingPilotNameDefault: "Test Pilot",
    filingWakeTurbulenceDefault: "LIGHT",
    filingTypeOfFlightDefault: "G",
    filingSurveillanceEquipmentDefault: "N",
  },
  aircraftType: "C172",
  phone: "5550001234",
  homeBase: "KEDC",
  pilotName: "Test Pilot",
} as any;

const basePlan = (overrides: Record<string, unknown> = {}) => ({
  id: "plan-1",
  departure: "KEDC",
  destination: "KDTO",
  route: "DCT ACT DCT",
  tailNumber: "N123RS",
  aircraftType: "C172",
  filingFlightRules: "IFR",
  filingEquipment: "S",
  filingSurveillanceEquipment: "N",
  filingOtherInfo: "PBN/A1 RMK/RSF LAB TEST",
  filingPilotPhone: "5550001234",
  filingAircraftHomeBase: "KEDC",
  plannedDepartureAt: new Date("2026-07-16T15:00:00.000Z"),
  plannerState: { userDisplayDepartureTimeLocal: "2026-07-16 10:00" },
  filingProviderPlanId: "provider-1",
  filingStatus: "filed",
  ...overrides,
}) as any;

test("round-trip route comparison does not treat transmitted route snapshot as provider echo", () => {
  const payload = {
    departure: "KEDC",
    destination: "KDTO",
    route: "DCT ACT DCT",
    aircraftIdentifier: "N123RS",
    aircraftType: "C172",
    flightRules: "IFR",
    aircraftEquipment: "S",
    surveillanceEquipment: "N",
    otherInfo: "PBN/A1 RMK/RSF LAB TEST",
    pilotPhone: "5550001234",
    aircraftHomeBase: "KEDC",
    departureInstant: "2026-07-16T15:00:00.000Z",
  };
  const comparison = compareGeneratedSentReturned(payload, payload, basePlan({
    filingProviderSnapshot: {
      route: {
        localEnteredRoute: "DCT ACT DCT",
        normalizedTransmittedRoute: "DCT ACT DCT",
        changedByProvider: false,
      },
    },
    filingRaw: { providerPlanId: "provider-1" },
  }));

  const route = comparison.fieldComparisons.find((item: any) => item.field === "route");
  assert.equal(route.providerResponse, null);
  assert.equal(route.classification, "provider_did_not_echo_route");
  assert.equal(comparison.failureCount, 0);
});

test("round-trip route comparison uses explicit provider-returned route when present", () => {
  const payload = {
    departure: "KEDC",
    destination: "KDTO",
    route: "DCT ACT DCT",
  };
  const comparison = compareGeneratedSentReturned(payload, payload, basePlan({
    filingProviderSnapshot: {
      route: {
        routeProvider: "DCT ACT DCT",
        localEnteredRoute: "DCT ACT DCT",
        normalizedTransmittedRoute: "DCT ACT DCT",
        changedByProvider: false,
      },
    },
  }));

  const route = comparison.fieldComparisons.find((item: any) => item.field === "route");
  assert.equal(route.providerResponse, "DCT ACT DCT");
  assert.equal(route.classification, "PASS");
});

test("Case 8 AMEND changes route altitude and alternate before provider amend", () => {
  const cases = buildCases(context, "post-run-fixes");
  const case8 = cases.find((item) => item.seed === 8)!;
  const mutation = amendMutationForCase(case8);

  assert.deepEqual(case8.actions, ["file", "amend"]);
  assert.equal(mutation?.route, "DCT ACT DCT");
  assert.equal(mutation?.filingPlannedAltitudeFt, 9000);
  assert.equal(mutation?.alternate, "KACT");
});

test("immediate cleanup applies only to successful nonterminal provider-created non-lifecycle cases", () => {
  const cases = buildCases(context, "cleanup-selection");
  const case2 = cases.find((item) => item.seed === 2)!;
  const case7 = cases.find((item) => item.seed === 7)!;
  const case10 = cases.find((item) => item.seed === 10)!;

  assert.equal(shouldCleanupImmediatelyAfterCase(
    case2,
    { pass: true },
    basePlan({ filingProviderPlanId: "provider-2", providerLifecycleStatus: "proposed" }),
  ), true);
  assert.equal(shouldCleanupImmediatelyAfterCase(
    case7,
    { pass: true },
    basePlan({ filingProviderPlanId: "provider-7", providerLifecycleStatus: "closed" }),
  ), false);
  assert.equal(shouldCleanupImmediatelyAfterCase(
    case10,
    { pass: true },
    basePlan({ filingProviderPlanId: null }),
  ), false);
});

test("cleanup summary separates immediate cleanup from final sweep and unresolved plans", () => {
  const summary = buildCleanupSummary([
    { cleanupPhase: "immediate_case_cleanup", action: "cancel", responseStatus: "accepted", pass: true, cancelAttempted: true, cancelAccepted: true, terminalVerificationMatched: true, finalCleanupDisposition: "explicitly_verified_terminal" },
    { cleanupPhase: "final_sweep", action: "cancel", responseStatus: "accepted", pass: true, cancelAttempted: true, cancelAccepted: true, terminalVerificationMatched: false, finalCleanupDisposition: "accepted_unverified" },
    {
      cleanupPhase: "final_sweep",
      action: "cancel",
      responseStatus: "rejected",
      pass: false,
      certificationCaseId: "case-08",
      planId: "plan-8",
      providerPlanId: "provider-8",
      flightRules: "IFR",
      departureTime: "2026-07-16T15:00:00.000Z",
      priorStatus: "proposed",
      errors: ["provider rejected cleanup"],
      automaticProviderClosureExpected: true,
    },
  ], []);

  assert.equal(summary.immediateCleanupTotal, 1);
  assert.equal(summary.immediateCleanupCancelled, 1);
  assert.equal(summary.immediateCleanupAttempted, 1);
  assert.equal(summary.immediateCleanupCancelAccepted, 1);
  assert.equal(summary.immediateCleanupTerminalStateExplicitlyVerified, 1);
  assert.equal(summary.terminalStateExplicitlyVerified, 1);
  assert.equal(summary.acceptedButTerminalEvidenceUnavailable, 1);
  assert.equal(summary.finalSweepTotal, 2);
  assert.equal(summary.cleanupErrors, 1);
  assert.equal(summary.unresolvedProviderPlans, 1);
  assert.equal(summary.unresolvedPlans[0].providerPlanId, "provider-8");
  assert.equal(summary.unresolvedPlans[0].automaticProviderClosureExpected, true);
});

test("cleanup verification reports REVIEW when cancel accepted but terminal evidence is unavailable", () => {
  const cleanupResults = [
    {
      cleanupPhase: "immediate_case_cleanup",
      action: "cancel",
      responseStatus: "accepted",
      pass: true,
      cancelAttempted: true,
      cancelAccepted: true,
      terminalVerificationAttempted: true,
      terminalVerificationMatched: false,
      terminalEvidenceKind: "local_status_only",
      terminalEvidenceSource: "local_plan_status",
      finalCleanupDisposition: "accepted_unverified",
      providerPlanId: "provider-19",
    },
  ];
  const verification = buildCleanupVerification(cleanupResults, []);
  const summary = buildCleanupSummary(cleanupResults, []);

  assert.equal(verification.status, "REVIEW");
  assert.equal(verification.acceptedButTerminalEvidenceUnavailable.length, 1);
  assert.equal(summary.acceptedButTerminalEvidenceUnavailable, 1);
  assert.equal(summary.terminalStateExplicitlyVerified, 0);
});

test("validation summary separates expected local blocks from unexpected validation failures", () => {
  const cases = buildCases(context, "validation-summary");
  const case10 = cases.find((item) => item.seed === 10)!;
  const summary = buildValidationSummary([
    {
      seed: 10,
      pass: true,
      testType: "Negative",
      actions: [{ action: "file", blockedBeforeLeidos: true, validationStatus: "BLOCKED" }],
    },
    {
      seed: 2,
      pass: false,
      testType: "Positive",
      actions: [{ action: "file", blockedBeforeLeidos: true, validationStatus: "BLOCKED" }],
    },
  ], [case10, cases.find((item) => item.seed === 2)!]);

  assert.equal(summary.expectedValidationBlocks, 1);
  assert.equal(summary.unexpectedValidationFailures, 1);
  assert.equal(summary.payloadValidationFailures, 1);
});

test("validation summary counts internally contradictory positive fixtures as test-design failures", () => {
  const cases = buildCases(context, "test-design-summary");
  const summary = buildValidationSummary([
    {
      seed: 20,
      pass: false,
      testType: "Positive",
      testDesignFailures: ["Test design failure: certification fixture is internally inconsistent before amend."],
      actions: [{
        action: "amend",
        blockedBeforeLeidos: true,
        validationStatus: "BLOCKED",
        responseStatus: "test_design_validation_failed",
      }],
    },
  ], [...cases, { seed: 20, testType: "Positive", expectedBlockedBeforeLeidos: false } as any]);

  assert.equal(summary.testDesignFailures, 1);
  assert.equal(summary.expectedValidationBlocks, 0);
  assert.equal(summary.unexpectedValidationFailures, 1);
});
