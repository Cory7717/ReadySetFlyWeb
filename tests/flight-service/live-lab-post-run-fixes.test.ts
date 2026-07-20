import assert from "node:assert/strict";
import test from "node:test";
import {
  amendMutationForCase,
  buildCases,
  buildCleanupVerification,
  buildCleanupSummary,
  buildLifecycleEvidenceSummary,
  buildValidationSummary,
  compareGeneratedSentReturned,
  shouldCleanupImmediatelyAfterCase,
  verifyActivationActionState,
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
    { cleanupPhase: "immediate_case_cleanup", action: "cancel", responseStatus: "accepted", pass: true, providerPlanId: "provider-2", cancelAttempted: true, cancelAccepted: true, terminalVerificationAttempted: true, terminalVerificationMatched: true, finalCleanupDisposition: "explicitly_verified_terminal" },
    { cleanupPhase: "final_sweep", action: "cancel", responseStatus: "accepted", pass: true, providerPlanId: "provider-2", cancelAttempted: false, cancelAccepted: false, terminalVerificationAttempted: true, terminalVerificationMatched: true, finalCleanupDisposition: "explicitly_verified_terminal" },
    { cleanupPhase: "final_sweep", action: "cancel", responseStatus: "accepted", pass: true, providerPlanId: "provider-3", cancelAttempted: true, cancelAccepted: true, terminalVerificationAttempted: true, terminalVerificationMatched: false, finalCleanupDisposition: "accepted_unverified" },
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
  ], [{
    actions: [
      { action: "file", providerPlanId: "provider-2", responseStatus: "accepted" },
      { action: "file", providerPlanId: "provider-3", responseStatus: "accepted" },
      { action: "file", providerPlanId: "provider-8", responseStatus: "accepted" },
    ],
  }]);

  assert.equal(summary.immediateCleanupTotal, 1);
  assert.equal(summary.immediateCleanupCancelled, 1);
  assert.equal(summary.immediateCleanupAttempted, 1);
  assert.equal(summary.immediateCleanupCancelAccepted, 1);
  assert.equal(summary.immediateCleanupTerminalStateExplicitlyVerified, 1);
  assert.equal(summary.terminalStateExplicitlyVerified, 1);
  assert.equal(summary.uniquePlansExplicitlyTerminalVerified, 1);
  assert.equal(summary.cleanupVerificationAttempts, 3);
  assert.equal(summary.finalSweepNewlyVerified, 0);
  assert.equal(summary.finalSweepReconfirmedAlreadyVerified, 1);
  assert.equal(summary.acceptedButTerminalEvidenceUnavailable, 1);
  assert.equal(summary.finalSweepTotal, 3);
  assert.equal(summary.cleanupErrors, 1);
  assert.equal(summary.unresolvedProviderPlans, 1);
  assert.equal(summary.unresolvedPlans[0].providerPlanId, "provider-8");
  assert.equal(summary.unresolvedPlans[0].automaticProviderClosureExpected, true);
});

test("cleanup summary consistency checks catch impossible unique verification counts", () => {
  const summary = buildCleanupSummary([
    { cleanupPhase: "final_sweep", providerPlanId: "provider-not-created", terminalVerificationAttempted: true, terminalVerificationMatched: true, pass: true },
  ], [{
    actions: [{ action: "file", providerPlanId: "provider-created", responseStatus: "accepted" }],
  }]);

  assert.equal(summary.uniquePlansExplicitlyTerminalVerified, 1);
  assert.equal(summary.providerPlansCreated, 1);
  assert.equal(summary.consistencyChecks.some((item: any) => item.name === "unique_terminal_verified_belongs_to_current_run" && item.pass === false), true);
  assert.equal(summary.cleanupFinalDispositions[0].disposition, "unresolved");
  assert.equal(summary.unresolvedProviderPlans, 1);
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

test("local activated status alone is not explicit provider activation evidence", async () => {
  const response = {
    live: true,
    providerPlanId: "provider-21",
    raw: { response: { returnStatus: true } },
  } as any;
  const verification = await verifyActivationActionState(basePlan({
    id: "plan-21",
    filingStatus: "activated",
    filingProviderPlanId: "provider-21",
    filingProviderSnapshot: {
      providerPlanId: "provider-21",
      providerLifecycleStatus: "activated",
      providerLifecycleSource: "local_action",
      providerLifecycleReason: "local_status_after_action",
    },
  }), response, true);

  assert.equal(verification.activateAccepted, true);
  assert.equal(verification.localActivatedStateConfirmed, true);
  assert.equal(verification.activationVerificationMatched, false);
  assert.equal(verification.activationEvidenceKind, "local_derived_state");
  assert.equal(verification.status, "REVIEW");
});

test("Case 21 lifecycle evidence summary requires explicit ACTIVATED and CLOSED evidence", () => {
  const summary = buildLifecycleEvidenceSummary([
    {
      seed: 21,
      certificationCaseId: "edge-21",
      testName: "VFR full lifecycle extended",
      actions: [
        {
          action: "activate",
          activateAccepted: true,
          activationVerificationAttempted: true,
          activationVerificationMatched: true,
          activationEvidenceKind: "explicit_provider_webhook",
          activationEvidenceSource: "leidos_webhook",
          activationPollCount: 2,
          activationTimedOut: false,
          activatedAt: "2026-07-20T18:00:00.000Z",
        },
        {
          action: "close",
          closeAccepted: true,
          closeVerificationMatched: true,
          closeEvidenceKind: "explicit_provider_webhook",
          closeEvidenceSource: "leidos_webhook",
          closedAt: "2026-07-20T18:10:00.000Z",
          terminalVerification: {
            status: "PASS",
            evidenceKind: "explicit_provider_webhook",
            evidenceSource: "leidos_webhook",
          },
        },
      ],
    },
  ]);

  assert.equal(summary.cases[0].activateAccepted, true);
  assert.equal(summary.cases[0].activationVerificationMatched, true);
  assert.equal(summary.cases[0].closeVerificationMatched, true);
  assert.equal(summary.cases[0].lifecycleEvidenceComplete, true);
});

test("Case 21 cannot report complete lifecycle evidence without explicit activation", () => {
  const summary = buildLifecycleEvidenceSummary([
    {
      seed: 21,
      certificationCaseId: "edge-21",
      testName: "VFR full lifecycle extended",
      actions: [
        {
          action: "activate",
          activateAccepted: true,
          activationVerificationAttempted: true,
          activationVerificationMatched: false,
          activationEvidenceKind: "local_derived_state",
          activationEvidenceSource: "local_action",
          activationTimedOut: true,
        },
        {
          action: "close",
          closeAccepted: true,
          closeVerificationMatched: true,
          closeEvidenceKind: "explicit_provider_webhook",
          closeEvidenceSource: "leidos_webhook",
        },
      ],
    },
  ]);

  assert.equal(summary.cases[0].activateAccepted, true);
  assert.equal(summary.cases[0].activationVerificationMatched, false);
  assert.equal(summary.cases[0].closeVerificationMatched, true);
  assert.equal(summary.cases[0].lifecycleEvidenceComplete, false);
});
