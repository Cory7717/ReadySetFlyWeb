import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildProviderEffectivePlanSnapshot,
  buildProviderReviewDecision,
  hashProviderEffectivePlanSnapshot,
} from "../../shared/provider-effective-review";

const basePlan = {
  id: "7406aa3f-fa7e-47c4-b19b-28fe4f9342e8",
  departure: "KLAS",
  destination: "PHNL",
  route: "KSBP",
  flightRules: "IFR",
  aircraftId: "N123RS",
  aircraftType: "C421",
  equipment: "S",
  surveillanceEquipment: "C",
  plannedAltitudeFt: "14000",
  plannedDepartureUtc: "2026-07-17T22:30:00.000Z",
  estimatedEnrouteMinutes: 328,
  enduranceMinutes: 450,
  soulsOnBoard: "2",
  otherInfo: "PBN/A1 RMK/VEGAS TO HAWAII IFR TEST PLAN",
  remarks: "VEGAS TO HAWAII IFR TEST PLAN",
};

const enrichedSnapshot = {
  providerPlanId: "658167349_806440_7590",
  versionStamp: "20260717201622780",
  route: {
    localEnteredRoute: "KSBP",
    normalizedTransmittedRoute: "KSBP",
    providerRoute: "KSBP",
    changedByProvider: false,
  },
  fieldDiffs: [
    {
      field: "otherInfo",
      transmittedValue: "PBN/A1 RMK/VEGAS TO HAWAII IFR TEST PLAN",
      providerValue: "PBN/A1 EET/KZAK0056 PHZH0449 RMK/VEGAS TO HAWAII IFR TEST PLAN",
      changedByProvider: true,
    },
  ],
};

test("provider enrichment opens review once and accepted effective baseline persists", () => {
  const decision = buildProviderReviewDecision({
    plan: basePlan,
    previousSnapshot: {},
    nextSnapshot: enrichedSnapshot,
  });
  assert.equal(decision.reviewPending, true);
  assert.deepEqual(decision.changedFields, ["otherInfo"]);

  const acceptedCanonical = buildProviderEffectivePlanSnapshot(basePlan, enrichedSnapshot);
  const acceptedHash = hashProviderEffectivePlanSnapshot(acceptedCanonical);
  assert.equal(decision.effectiveHash, acceptedHash);
  assert.equal(acceptedCanonical.otherInfo, "PBN/A1 EET/KZAK0056 PHZH0449 RMK/VEGAS TO HAWAII IFR TEST PLAN");
});

test("new operational alert with unchanged effective plan does not reopen review", () => {
  const acceptedCanonical = buildProviderEffectivePlanSnapshot(basePlan, enrichedSnapshot);
  const acceptedHash = hashProviderEffectivePlanSnapshot(acceptedCanonical);
  const previousSnapshot = {
    ...enrichedSnapshot,
    providerPendingReview: false,
    providerModifiedBySpecialist: false,
    providerReviewAcceptedVersionStamp: "20260717201622780",
    providerReviewAcceptedEffectivePlanHash: acceptedHash,
    providerReviewAcceptedEffectivePlanSnapshot: acceptedCanonical,
  };
  const alertSnapshot = {
    ...enrichedSnapshot,
    providerOperationalAlertType: "CONVECTION_SIGMET",
    providerLastPushTitle: "Flight Alert: CONVECTION_SIGMET",
  };
  const decision = buildProviderReviewDecision({
    plan: basePlan,
    previousSnapshot,
    nextSnapshot: alertSnapshot,
  });
  assert.equal(decision.effectiveHash, acceptedHash);
  assert.equal(decision.hashMatchesAccepted, true);
  assert.equal(decision.reviewPending, false);
  assert.equal(decision.reason, "accepted_effective_plan_unchanged");
});

test("new version stamp with unchanged effective plan updates metadata without review", () => {
  const acceptedCanonical = buildProviderEffectivePlanSnapshot(basePlan, enrichedSnapshot);
  const acceptedHash = hashProviderEffectivePlanSnapshot(acceptedCanonical);
  const decision = buildProviderReviewDecision({
    plan: basePlan,
    previousSnapshot: {
      ...enrichedSnapshot,
      providerReviewAcceptedVersionStamp: "20260717201622780",
      providerReviewAcceptedEffectivePlanHash: acceptedHash,
    },
    nextSnapshot: {
      ...enrichedSnapshot,
      versionStamp: "20260717211622780",
    },
  });
  assert.equal(decision.reviewPending, false);
  assert.equal(decision.effectiveHash, acceptedHash);
});

test("same version stamp with materially changed route reopens review", () => {
  const acceptedCanonical = buildProviderEffectivePlanSnapshot(basePlan, enrichedSnapshot);
  const acceptedHash = hashProviderEffectivePlanSnapshot(acceptedCanonical);
  const decision = buildProviderReviewDecision({
    plan: basePlan,
    previousSnapshot: {
      ...enrichedSnapshot,
      providerReviewAcceptedVersionStamp: "20260717201622780",
      providerReviewAcceptedEffectivePlanHash: acceptedHash,
    },
    nextSnapshot: {
      ...enrichedSnapshot,
      route: {
        localEnteredRoute: "KSBP",
        normalizedTransmittedRoute: "KSBP",
        providerRoute: "KSBP DCT ZIGIE",
        changedByProvider: true,
      },
      fieldDiffs: [
        ...enrichedSnapshot.fieldDiffs,
        {
          field: "route",
          transmittedValue: "KSBP",
          providerValue: "KSBP DCT ZIGIE",
          changedByProvider: true,
        },
      ],
    },
  });
  assert.equal(decision.reviewPending, true);
  assert.deepEqual(decision.changedFields, ["otherInfo", "route"]);
  assert.equal(decision.reason, "effective_plan_changed_after_acceptance");
});

test("legacy accepted same version establishes accepted baseline without reopening", () => {
  const decision = buildProviderReviewDecision({
    plan: basePlan,
    previousSnapshot: {
      ...enrichedSnapshot,
      providerPendingReview: false,
      providerReviewAcceptedVersionStamp: "20260717201622780",
    },
    nextSnapshot: enrichedSnapshot,
  });
  assert.equal(decision.reviewPending, false);
  assert.equal(decision.acceptedEffectiveHash, decision.effectiveHash);
  assert.equal(decision.reason, "legacy_accepted_version_baseline_established");
});

test("route webhook does not set pending review directly from alert/change presence", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  assert.doesNotMatch(routes, /providerPendingReview:\s*hasExplicitProviderChange/);
  assert.doesNotMatch(routes, /providerModifiedBySpecialist:\s*hasExplicitProviderChange/);
  assert.match(routes, /applyProviderEffectiveReviewDecision/);
  assert.match(routes, /providerReviewAcceptedEffectivePlanHash/);
  assert.match(routes, /normalizedAlertType/);
});

