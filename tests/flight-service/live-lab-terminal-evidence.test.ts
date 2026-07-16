import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  buildTerminalVerificationSummary,
  classifyLifecycleEvidence,
} from "./leidos-live-lab/live-lab-runner";

test("explicit provider retrieve lifecycle is provider evidence", () => {
  const evidence = classifyLifecycleEvidence({
    providerLifecycleStatus: "closed",
    providerLifecycleSource: "provider_retrieve",
    providerLifecycleReason: "explicit_provider_closure",
    providerFlightState: "CLOSED",
    lastProviderRetrieveAt: "2026-07-16T18:00:00.000Z",
  }, "closed");

  assert.equal(evidence.kind, "explicit_provider_retrieve");
  assert.equal(evidence.hasExplicitProviderEvidence, true);
  assert.equal(evidence.explicitLifecycleValue, "closed");
  assert.equal(evidence.latestRetrieveIncludedLifecycle, true);
});

test("delayed Leidos webhook lifecycle is explicit provider evidence", () => {
  const evidence = classifyLifecycleEvidence({
    providerLifecycleStatus: "closed",
    providerLifecycleSource: "leidos_webhook",
    providerLifecycleReason: "explicit_provider_closure",
    providerFlightState: "CLOSED",
    providerEventTimestamp: "2026-07-16T18:01:00.000Z",
    rsfReceiptTimestamp: "2026-07-16T18:01:03.000Z",
    webhookProcessingTimestamp: "2026-07-16T18:01:04.000Z",
  }, "closed");

  assert.equal(evidence.kind, "explicit_provider_webhook");
  assert.equal(evidence.hasExplicitProviderEvidence, true);
  assert.equal(evidence.providerEventTimestamp, "2026-07-16T18:01:00.000Z");
  assert.equal(evidence.rsfReceiptTimestamp, "2026-07-16T18:01:03.000Z");
  assert.equal(evidence.webhookProcessingTimestamp, "2026-07-16T18:01:04.000Z");
});

test("local-derived terminal lifecycle is not labeled explicit provider evidence", () => {
  for (const source of ["user_action", "admin_action", "local_reconciliation"]) {
    const evidence = classifyLifecycleEvidence({
      providerLifecycleStatus: "closed",
      providerLifecycleSource: source,
      providerLifecycleReason: "local_filing_status_baseline",
    }, "closed");

    assert.equal(evidence.hasExplicitProviderEvidence, false);
    assert.equal(evidence.kind, "local_derived_state");
    assert.equal(evidence.explicitLifecycleValue, null);
  }
});

test("missing retrieve lifecycle remains missing provider state", () => {
  const evidence = classifyLifecycleEvidence({
    providerLifecycleStatus: "unknown",
    providerLifecycleSource: "provider_retrieve",
    providerRetrievalState: "retrievable",
    lastProviderRetrieveAt: "2026-07-16T18:00:00.000Z",
  }, "closed");

  assert.equal(evidence.kind, "missing_provider_state");
  assert.equal(evidence.hasExplicitProviderEvidence, false);
  assert.equal(evidence.latestRetrieveIncludedLifecycle, false);
});

test("conflicting explicit provider lifecycle is surfaced", () => {
  const evidence = classifyLifecycleEvidence({
    providerLifecycleStatus: "proposed",
    providerLifecycleSource: "leidos_webhook",
    providerLifecycleReason: "explicit_provider_flight_state",
    providerFlightState: "PROPOSED",
  }, "closed");

  assert.equal(evidence.kind, "conflicting_provider_evidence");
  assert.equal(evidence.conflictsWithExpected, true);
});

test("terminal summary carries evidence classification and versionStamp optionality", () => {
  const summary = buildTerminalVerificationSummary([{
    certificationCaseId: "case-07",
    seed: 7,
    testName: "VFR file activate close",
    actions: [{
      action: "close",
      terminalAction: true,
      providerPlanId: "provider-1",
      responseStatus: "accepted",
      providerActionAccepted: true,
      providerActionRejected: false,
      versionStampRequired: false,
      versionStampMissingClassification: "optional_missing_after_terminal_action",
      terminalVerification: {
        status: "PASS",
        expectedTerminalLifecycle: "closed",
        effectiveLifecycle: "closed",
        explicitLifecycleValue: "closed",
        evidenceKind: "explicit_provider_webhook",
        evidenceSource: "leidos_webhook",
        retrieveIncludedLifecycle: false,
        polling: { timeoutMs: 45000, intervalMs: 3000, pollCount: 2, matched: true },
        reason: "CLOSE was accepted by Leidos. The immediate retrieve response omitted flight state. A validated Leidos webhook subsequently reported CLOSED, satisfying terminal verification.",
      },
    }],
  }]);

  assert.equal(summary.passed, 1);
  assert.equal(summary.versionStampOptionalMissingAfterTerminal, 1);
  assert.equal(summary.cases[0].terminalVerification.evidenceKind, "explicit_provider_webhook");
  assert.match(summary.cases[0].terminalVerification.reason, /validated Leidos webhook subsequently reported CLOSED/);
});

test("UI and reports expose source-transparent lifecycle wording", () => {
  const flightPlanner = readFileSync("client/src/pages/flight-planner.tsx", "utf8");
  const liveRunner = readFileSync("tests/flight-service/leidos-live-lab/live-lab-runner.ts", "utf8");
  const routes = readFileSync("server/routes.ts", "utf8");

  assert.match(flightPlanner, /Effective Provider Lifecycle/);
  assert.match(flightPlanner, /Lifecycle Confirmed By/);
  assert.match(flightPlanner, /Latest Provider Retrieval/);
  assert.match(flightPlanner, /Successful - lifecycle not included in latest response/);
  assert.match(liveRunner, /explicitLifecycleValue/);
  assert.match(liveRunner, /evidenceKind/);
  assert.match(liveRunner, /pollCount/);
  assert.match(routes, /providerEventTimestamp/);
  assert.match(routes, /webhookProcessingTimestamp/);
  assert.doesNotMatch(routes, /\["user_action", "admin_action"\]\.includes\(String\(incoming\.providerLifecycleSource/);
});

