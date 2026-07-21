import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildProviderAcceptedEffectivePlanSnapshot,
  buildProviderEffectivePlanSnapshot,
  buildProviderReviewDecision,
  hashProviderEffectivePlanSnapshot,
  normalizeProviderReviewOtherInfo,
  normalizeProviderReviewRoute,
  providerReviewNotificationMatchesCurrentReview,
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
  assert.equal(acceptedCanonical.otherInfo, "EET/KZAK0056 PHZH0449 PBN/A1 RMK/VEGAS TO HAWAII IFR TEST PLAN");
});

test("stale provider notification acknowledgement cannot clear a newer pending review", () => {
  assert.equal(providerReviewNotificationMatchesCurrentReview({
    providerPendingReview: true,
    notificationProviderPlanId: "658167349_806440_6464",
    notificationVersionStamp: "20260716173117000",
    notificationEffectivePlanHash: "hash-a",
    currentProviderPlanId: "658167349_806440_6464",
    currentVersionStamp: "20260716173119000",
    currentEffectivePlanHash: "hash-b",
  }), false);
});

test("current provider notification acknowledgement clears the matching pending review", () => {
  assert.equal(providerReviewNotificationMatchesCurrentReview({
    providerPendingReview: true,
    notificationProviderPlanId: "658167349_806440_6464",
    notificationVersionStamp: "20260716173119000",
    notificationEffectivePlanHash: "hash-b",
    currentProviderPlanId: "658167349_806440_6464",
    currentVersionStamp: "20260716173119000",
    currentEffectivePlanHash: "hash-b",
  }), true);
});

test("provider notification acknowledgement is idempotent after review is already cleared", () => {
  assert.equal(providerReviewNotificationMatchesCurrentReview({
    providerPendingReview: false,
    notificationProviderPlanId: "658167349_806440_6464",
    notificationVersionStamp: "20260716173119000",
    notificationEffectivePlanHash: "hash-b",
    currentProviderPlanId: "658167349_806440_6464",
    currentVersionStamp: "20260716173119000",
    currentEffectivePlanHash: "hash-b",
  }), true);
});

test("notification without provider-review identity cannot clear a pending review by plan id alone", () => {
  assert.equal(providerReviewNotificationMatchesCurrentReview({
    providerPendingReview: true,
    notificationProviderPlanId: "658167349_806440_6464",
    currentProviderPlanId: "658167349_806440_6464",
    currentVersionStamp: "20260716173119000",
    currentEffectivePlanHash: "hash-b",
  }), false);
});

test("out-of-order notification from a different provider plan cannot clear review", () => {
  assert.equal(providerReviewNotificationMatchesCurrentReview({
    providerPendingReview: true,
    notificationProviderPlanId: "old-provider-plan",
    notificationVersionStamp: "20260716173119000",
    notificationEffectivePlanHash: "hash-b",
    currentProviderPlanId: "new-provider-plan",
    currentVersionStamp: "20260716173119000",
    currentEffectivePlanHash: "hash-b",
  }), false);
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

test("accepted provider-effective baseline survives durable JSON reload before alert reconciliation", () => {
  const acceptedCanonical = buildProviderEffectivePlanSnapshot(basePlan, enrichedSnapshot);
  const acceptedHash = hashProviderEffectivePlanSnapshot(acceptedCanonical);
  const persistedJsonbValue = JSON.parse(JSON.stringify({
    ...enrichedSnapshot,
    providerPendingReview: false,
    providerModifiedBySpecialist: false,
    providerEffectivePlanHash: acceptedHash,
    providerEffectivePlanSnapshot: acceptedCanonical,
    providerReviewAcceptedVersionStamp: "20260717201622780",
    providerReviewAcceptedEffectivePlanHash: acceptedHash,
    providerReviewAcceptedEffectivePlanSnapshot: acceptedCanonical,
    providerReviewAcceptedAt: "2026-07-17T20:30:00.000Z",
    providerReviewAcceptedBy: "user-1",
    providerReviewAcceptedSource: "provider_review_accept",
  }));
  const reloadedPlan = JSON.parse(JSON.stringify(basePlan));
  const alertSnapshot = JSON.parse(JSON.stringify({
    ...enrichedSnapshot,
    providerOperationalAlertType: "CONVECTION_SIGMET",
    providerLastPushTitle: "Flight Alert: CONVECTION_SIGMET",
  }));

  const decision = buildProviderReviewDecision({
    plan: reloadedPlan,
    previousSnapshot: persistedJsonbValue,
    nextSnapshot: alertSnapshot,
  });

  assert.equal(decision.effectiveHash, acceptedHash);
  assert.equal(decision.acceptedEffectiveHash, acceptedHash);
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

test("expected FILE provider echo does not create pending provider review", () => {
  const fileSnapshot = {
    providerPlanId: "658167349_806440_6464",
    versionStamp: "20260720150000000",
    route: {
      localEnteredRoute: "KSBP",
      normalizedTransmittedRoute: "KSBP",
      providerRoute: "KSBP",
      changedByProvider: false,
    },
    fieldDiffs: [],
  };
  const decision = buildProviderReviewDecision({
    plan: basePlan,
    previousSnapshot: {},
    nextSnapshot: fileSnapshot,
  });

  assert.equal(decision.reviewPending, false);
  assert.deepEqual(decision.changedFields, []);
  assert.equal(decision.reason, "no_effective_plan_change");
});

test("expected AMEND provider echo compares against the amended accepted route", () => {
  const amendedPlan = {
    ...basePlan,
    route: "KSBP DCT ZIGIE",
    plannedAltitudeFt: "16000",
    alternate: "KSMX",
    otherInfo: "RMK/AMENDED ROUTE ALT",
  };
  const amendSnapshot = {
    providerPlanId: "658167349_806440_6464",
    versionStamp: "20260720153000000",
    route: {
      localEnteredRoute: "KSBP DCT ZIGIE",
      normalizedTransmittedRoute: "KSBP DCT ZIGIE",
      providerRoute: "KSBP DCT ZIGIE",
      changedByProvider: false,
    },
    fieldDiffs: [],
  };
  const decision = buildProviderReviewDecision({
    plan: amendedPlan,
    previousSnapshot: {},
    nextSnapshot: amendSnapshot,
  });

  assert.equal(decision.reviewPending, false);
  assert.deepEqual(decision.changedFields, []);
  assert.equal(decision.canonical.route, "KSBP ZIGIE");
});

test("successful FILE accepted transmitted snapshot matches equivalent provider echo", () => {
  const transmittedFields = {
    aircraftIdentifier: "N123RS",
    aircraftType: "C421",
    aircraftEquipment: "S",
    surveillanceEquipment: "C",
    flightRules: "VFR",
    departure: "KEDC",
    destination: "KACT",
    altDestination1: "KDAL",
    departureInstant: "2026-07-21T18:40:00.000Z",
    flightDuration: "PT1H",
    fuelOnBoard: "PT7H30M",
    route: "DCT ACT DCT",
    remarks: "RSF LAB TEST SEED 21",
    otherInfo: "RMK/RSF LAB TEST SEED 21",
    peopleOnBoardExtended: "2",
  };
  const acceptedSnapshot = buildProviderAcceptedEffectivePlanSnapshot(transmittedFields, {});
  const acceptedHash = hashProviderEffectivePlanSnapshot(acceptedSnapshot);
  const decision = buildProviderReviewDecision({
    plan: {
      tailNumber: "N123RS",
      aircraftType: "C421",
      filingEquipment: "S",
      filingSurveillanceEquipment: "C",
      filingFlightRules: "VFR",
      departure: "KEDC",
      destination: "KACT",
      alternate: "KDAL",
      plannedDepartureAt: new Date("2026-07-21T18:40:00.000Z"),
      filingEstimatedEnrouteMinutes: 60,
      filingEnduranceMinutes: 450,
      route: "DCT ACT",
      filingRemarks: "RSF LAB TEST SEED 21",
      filingOtherInfo: "RMK/RSF LAB TEST SEED 21",
      filingSoulsOnBoard: "2",
    },
    previousSnapshot: {
      providerReviewAcceptedEffectivePlanHash: acceptedHash,
      providerReviewAcceptedEffectivePlanSnapshot: acceptedSnapshot,
    },
    nextSnapshot: {
      route: {
        normalizedTransmittedRoute: "DCT ACT DCT",
        providerRoute: "DCT ACT",
        changedByProvider: true,
      },
      fieldDiffs: [],
    },
  });

  assert.equal(decision.reviewPending, false);
  assert.equal(decision.hashMatchesAccepted, true);
  assert.deepEqual(decision.changedFields, []);
});

test("ACTIVATED lifecycle-only webhook does not set provider pending review", () => {
  const acceptedSnapshot = buildProviderAcceptedEffectivePlanSnapshot({
    aircraftIdentifier: "N123RS",
    aircraftType: "C172",
    departure: "KEDC",
    destination: "KACT",
    route: "DCT ACT DCT",
    flightRules: "VFR",
  }, {});
  const acceptedHash = hashProviderEffectivePlanSnapshot(acceptedSnapshot);
  const decision = buildProviderReviewDecision({
    plan: {
      tailNumber: "N123RS",
      aircraftType: "C172",
      departure: "KEDC",
      destination: "KACT",
      route: "DCT ACT DCT",
      filingFlightRules: "VFR",
    },
    previousSnapshot: {
      providerReviewAcceptedEffectivePlanHash: acceptedHash,
      providerReviewAcceptedEffectivePlanSnapshot: acceptedSnapshot,
    },
    nextSnapshot: {
      providerLifecycleStatus: "activated",
      providerLifecycleSource: "leidos_webhook",
      providerLifecycleReason: "explicit_provider_active",
      providerFlightState: "ACTIVATED",
      fieldDiffs: [],
    },
  });

  assert.equal(decision.reviewPending, false);
  assert.deepEqual(decision.changedFields, []);
  assert.ok(
    ["accepted_effective_plan_unchanged", "no_effective_plan_change"].includes(decision.reason),
    `unexpected review decision reason: ${decision.reason}`,
  );
});

test("terminal provider lifecycle clears pending review while retaining changed-field evidence", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  const applyBlock = routes.slice(
    routes.indexOf("const applyProviderEffectiveReviewDecision = ("),
    routes.indexOf("const getProviderDiffValue = ("),
  );

  assert.match(applyBlock, /providerTerminalLifecycle = \["closed", "cancelled", "canceled"\]\.includes\(providerLifecycle\)/);
  assert.match(applyBlock, /const reviewPending = providerTerminalLifecycle \? false : decision\.reviewPending/);
  assert.match(applyBlock, /providerEffectivePlanChangedFields:\s*decision\.changedFields/);
  assert.match(applyBlock, /providerReviewDecisionReason:\s*providerTerminalLifecycle[\s\S]*terminal_provider_lifecycle_auto_reconciled/);
  assert.match(applyBlock, /providerPendingReview:\s*reviewPending/);
  assert.match(applyBlock, /providerModifiedBySpecialist:\s*reviewPending/);
});

test("provider route absence does not count as provider route change", () => {
  const decision = buildProviderReviewDecision({
    plan: basePlan,
    previousSnapshot: {},
    nextSnapshot: {
      route: {
        normalizedTransmittedRoute: "DCT ACT DCT",
        providerRoute: null,
        changedByProvider: false,
      },
      fieldDiffs: [],
    },
  });

  assert.equal(decision.reviewPending, false);
  assert.deepEqual(decision.changedFields, []);
});

test("equivalent route and Item 18 formatting do not count as provider changes", () => {
  assert.equal(normalizeProviderReviewRoute("DCT ACT DCT"), normalizeProviderReviewRoute("DCT ACT"));
  assert.equal(normalizeProviderReviewRoute("KJSO DCT KELD"), normalizeProviderReviewRoute("KJSO KELD"));
  assert.equal(normalizeProviderReviewRoute("kjsO\nDCT   keld"), normalizeProviderReviewRoute("KJSO KELD"));
  assert.equal(
    normalizeProviderReviewOtherInfo("RMK/RSF   LAB TEST   TYP/TBM9"),
    normalizeProviderReviewOtherInfo("TYP/TBM9 RMK/RSF LAB TEST"),
  );
  const decision = buildProviderReviewDecision({
    plan: {
      ...basePlan,
      route: "DCT ACT DCT",
      otherInfo: "RMK/RSF LAB TEST TYP/TBM9",
    },
    previousSnapshot: {},
    nextSnapshot: {
      route: {
        normalizedTransmittedRoute: "DCT ACT DCT",
        providerRoute: "DCT ACT",
        changedByProvider: true,
      },
      fieldDiffs: [{
        field: "otherInfo",
        transmittedValue: "RMK/RSF LAB TEST TYP/TBM9",
        providerValue: "TYP/TBM9 RMK/RSF LAB TEST",
        changedByProvider: true,
      }],
    },
  });

  assert.equal(decision.reviewPending, false);
  assert.deepEqual(decision.changedFields, []);
});

test("successful-run direct route formats do not create false route reviews", () => {
  const equivalentPairs = [
    ["DCT ACT DCT", "ACT"],
    ["DCT", ""],
    ["DCT CWK DCT", "CWK"],
    ["DCT DRK DCT", "DRK"],
    ["DCT ACT DCT SAT DCT", "ACT SAT"],
  ];

  for (const [transmitted, provider] of equivalentPairs) {
    assert.equal(
      normalizeProviderReviewRoute(transmitted),
      normalizeProviderReviewRoute(provider),
      `${transmitted} should normalize like ${provider || "empty direct route"}`,
    );
    const acceptedCanonical = buildProviderAcceptedEffectivePlanSnapshot({
      aircraftIdentifier: "N123RS",
      aircraftType: "C172",
      departure: "KEDC",
      destination: "KACT",
      route: transmitted,
      flightRules: "VFR",
    }, {});
    const acceptedHash = hashProviderEffectivePlanSnapshot(acceptedCanonical);
    const decision = buildProviderReviewDecision({
      plan: { ...basePlan, departure: "KEDC", destination: "KACT", route: transmitted, flightRules: "VFR", filingFlightRules: "VFR" },
      previousSnapshot: {
        providerPendingReview: false,
        providerReviewAcceptedEffectivePlanHash: acceptedHash,
        providerReviewAcceptedEffectivePlanSnapshot: acceptedCanonical,
      },
      nextSnapshot: {
        route: {
          normalizedTransmittedRoute: transmitted,
          providerRoute: provider,
          changedByProvider: true,
        },
        fieldDiffs: [{
          field: "route",
          transmittedValue: transmitted,
          providerValue: provider,
          changedByProvider: true,
        }],
      },
    });

    assert.equal(decision.reviewPending, false, `${transmitted} vs ${provider} should not require review`);
    assert.deepEqual(decision.changedFields, []);
  }
});

test("locally initiated AMEND echo uses the amended transmitted baseline", () => {
  const amendedTransmittedRoute = "DCT ACT DCT SAT DCT";
  const acceptedCanonical = buildProviderAcceptedEffectivePlanSnapshot({
    aircraftIdentifier: "N123RS",
    aircraftType: "C172",
    departure: "KEDC",
    destination: "KDTO",
    route: amendedTransmittedRoute,
    flightRules: "IFR",
  }, {});
  const acceptedHash = hashProviderEffectivePlanSnapshot(acceptedCanonical);
  const decision = buildProviderReviewDecision({
    plan: {
      ...basePlan,
      departure: "KEDC",
      destination: "KDTO",
      route: amendedTransmittedRoute,
      flightRules: "IFR",
      filingFlightRules: "IFR",
    },
    previousSnapshot: {
      route: {
        normalizedTransmittedRoute: "DCT CWK DCT",
        providerRoute: "CWK",
        changedByProvider: false,
      },
      providerPendingReview: false,
      providerReviewAcceptedEffectivePlanHash: acceptedHash,
      providerReviewAcceptedEffectivePlanSnapshot: acceptedCanonical,
      providerReviewAcceptedVersionStamp: "20260720180000000",
    },
    nextSnapshot: {
      versionStamp: "20260720180500000",
      route: {
        normalizedTransmittedRoute: amendedTransmittedRoute,
        localEnteredRoute: amendedTransmittedRoute,
        providerRoute: "ACT SAT",
        changedByProvider: true,
      },
      fieldDiffs: [{
        field: "route",
        transmittedValue: amendedTransmittedRoute,
        providerValue: "ACT SAT",
        changedByProvider: true,
      }],
    },
  });

  assert.equal(decision.reviewPending, false);
  assert.deepEqual(decision.changedFields, []);
  assert.ok(
    ["accepted_effective_plan_unchanged", "no_effective_plan_change"].includes(decision.reason),
    `unexpected review decision reason: ${decision.reason}`,
  );
});

test("genuine provider route sequence and airway changes still require review", () => {
  const cases = [
    ["ACT SAT", "ACT CWK SAT"],
    ["ACT V198 SAT", "ACT SAT"],
    ["ACT SAT", "ACT SAT ABI"],
  ];

  for (const [transmitted, provider] of cases) {
    const decision = buildProviderReviewDecision({
      plan: { ...basePlan, route: transmitted },
      previousSnapshot: {},
      nextSnapshot: {
        route: {
          normalizedTransmittedRoute: transmitted,
          providerRoute: provider,
          changedByProvider: true,
        },
        fieldDiffs: [],
      },
    });

    assert.equal(decision.reviewPending, true, `${transmitted} -> ${provider} should require review`);
    assert.deepEqual(decision.changedFields, ["route"]);
  }
});

test("incomplete retrieve preserves accepted route baseline without false review", () => {
  const acceptedCanonical = buildProviderAcceptedEffectivePlanSnapshot({
    aircraftIdentifier: "N123RS",
    aircraftType: "C172",
    departure: "KEDC",
    destination: "KACT",
    route: "DCT ACT DCT",
    flightRules: "VFR",
  }, {});
  const acceptedHash = hashProviderEffectivePlanSnapshot(acceptedCanonical);
  const decision = buildProviderReviewDecision({
    plan: { ...basePlan, departure: "KEDC", destination: "KACT", route: "DCT ACT DCT", flightRules: "VFR", filingFlightRules: "VFR" },
    previousSnapshot: {
      providerPendingReview: false,
      providerReviewAcceptedEffectivePlanHash: acceptedHash,
      providerReviewAcceptedEffectivePlanSnapshot: acceptedCanonical,
      route: {
        normalizedTransmittedRoute: "DCT ACT DCT",
        providerRoute: "ACT",
        changedByProvider: false,
      },
    },
    nextSnapshot: {
      versionStamp: "20260720190000000",
      route: {
        providerRoute: null,
        changedByProvider: true,
      },
      fieldDiffs: [{
        field: "route",
        transmittedValue: "DCT ACT DCT",
        providerValue: null,
        changedByProvider: true,
      }],
    },
  });

  assert.equal(decision.reviewPending, false);
  assert.deepEqual(decision.changedFields, []);
});

test("incomplete retrieve cannot clear a genuine pending route modification", () => {
  const decision = buildProviderReviewDecision({
    plan: { ...basePlan, route: "ACT SAT" },
    previousSnapshot: {
      providerPendingReview: true,
      route: {
        normalizedTransmittedRoute: "ACT SAT",
        providerRoute: "ACT CWK SAT",
        changedByProvider: true,
      },
      fieldDiffs: [],
    },
    nextSnapshot: {
      versionStamp: "20260720190000000",
      route: {
        providerRoute: null,
        changedByProvider: false,
      },
      fieldDiffs: [],
    },
  });

  assert.equal(decision.reviewPending, true);
  assert.deepEqual(decision.changedFields, ["route"]);
  assert.equal(decision.reason, "pending_review_preserved_incomplete_provider_snapshot");
});

test("provider omitted DCT formatting does not reopen accepted route review", () => {
  const acceptedCanonical = buildProviderAcceptedEffectivePlanSnapshot({
    aircraftIdentifier: "N123RS",
    aircraftType: "C421",
    departure: "KLAS",
    destination: "PHNL",
    route: "KJSO DCT KELD",
    flightRules: "IFR",
  }, {});
  const acceptedHash = hashProviderEffectivePlanSnapshot(acceptedCanonical);
  const decision = buildProviderReviewDecision({
    plan: { ...basePlan, route: "KJSO DCT KELD" },
    previousSnapshot: {
      providerPendingReview: false,
      providerReviewAcceptedEffectivePlanHash: acceptedHash,
      providerReviewAcceptedEffectivePlanSnapshot: acceptedCanonical,
      providerReviewAcceptedVersionStamp: "20260720180000000",
    },
    nextSnapshot: {
      versionStamp: "20260720180100000",
      route: {
        normalizedTransmittedRoute: "KJSO DCT KELD",
        providerRoute: "KJSO KELD",
        changedByProvider: true,
      },
      fieldDiffs: [{
        field: "route",
        transmittedValue: "KJSO DCT KELD",
        providerValue: "KJSO KELD",
        changedByProvider: true,
      }],
    },
  });

  assert.equal(decision.reviewPending, false);
  assert.deepEqual(decision.changedFields, []);
  assert.equal(decision.reason, "no_effective_plan_change");
});

test("genuinely different provider route sets provider pending review", () => {
  const decision = buildProviderReviewDecision({
    plan: { ...basePlan, route: "DCT ACT DCT" },
    previousSnapshot: {},
    nextSnapshot: {
      route: {
        normalizedTransmittedRoute: "DCT ACT DCT",
        providerRoute: "DCT CWK DCT",
        changedByProvider: true,
      },
      fieldDiffs: [],
    },
  });

  assert.equal(decision.reviewPending, true);
  assert.deepEqual(decision.changedFields, ["route"]);
});

test("genuinely different altitude or alternate sets provider pending review", () => {
  const decision = buildProviderReviewDecision({
    plan: basePlan,
    previousSnapshot: {},
    nextSnapshot: {
      fieldDiffs: [
        { field: "plannedAltitudeFt", transmittedValue: "14000", providerValue: "16000", changedByProvider: true },
        { field: "alternate", transmittedValue: "KDAL", providerValue: "KACT", changedByProvider: true },
      ],
    },
  });

  assert.equal(decision.reviewPending, true);
  assert.deepEqual(decision.changedFields, ["alternate", "plannedAltitudeFt"]);
});

test("incomplete retrieve does not erase a genuine pending provider review", () => {
  const decision = buildProviderReviewDecision({
    plan: { ...basePlan, route: "DCT ACT DCT" },
    previousSnapshot: {
      providerPendingReview: true,
      route: {
        normalizedTransmittedRoute: "DCT ACT DCT",
        providerRoute: "DCT CWK DCT",
        changedByProvider: true,
      },
      fieldDiffs: [],
    },
    nextSnapshot: {
      versionStamp: "20260717201622780",
      fieldDiffs: [],
    },
  });

  assert.equal(decision.reviewPending, true);
  assert.deepEqual(decision.changedFields, ["route"]);
  assert.equal(decision.reason, "pending_review_preserved_incomplete_provider_snapshot");
});

test("incomplete retrieve cannot restore an already accepted route review", () => {
  const acceptedCanonical = buildProviderAcceptedEffectivePlanSnapshot({
    aircraftIdentifier: "N123RS",
    aircraftType: "C421",
    departure: "KLAS",
    destination: "PHNL",
    route: "KJSO DCT KELD",
    flightRules: "IFR",
  }, {});
  const acceptedHash = hashProviderEffectivePlanSnapshot(acceptedCanonical);
  const decision = buildProviderReviewDecision({
    plan: { ...basePlan, route: "KJSO DCT KELD" },
    previousSnapshot: {
      providerPendingReview: false,
      providerReviewAcceptedEffectivePlanHash: acceptedHash,
      providerReviewAcceptedEffectivePlanSnapshot: acceptedCanonical,
      providerReviewAcceptedVersionStamp: "20260720180000000",
      route: {
        normalizedTransmittedRoute: "KJSO DCT KELD",
        providerRoute: "KJSO KELD",
        changedByProvider: true,
      },
    },
    nextSnapshot: {
      versionStamp: "20260720180100000",
      fieldDiffs: [],
    },
  });

  assert.equal(decision.reviewPending, false);
  assert.deepEqual(decision.changedFields, []);
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

test("provider-review accept persists all accepted baseline fields in one guarded flight-plan update", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  const acceptRoute = routes.slice(routes.indexOf('app.post("/api/flight-plans/:id/provider-review/accept"'));
  const updateIndex = acceptRoute.indexOf("const [updated] = await db");
  const responseIndex = acceptRoute.indexOf("res.json({", updateIndex);
  assert.ok(updateIndex > 0, "accept endpoint should persist through a guarded database update");
  assert.ok(responseIndex > updateIndex, "response should be sent after the update");
  const updateBlock = acceptRoute.slice(updateIndex, responseIndex);
  assert.match(acceptRoute, /const acceptanceGuard = currentPlan\.updatedAt/);
  assert.match(updateBlock, /\.where\(acceptanceGuard\)/);
  assert.match(acceptRoute, /PROVIDER_REVIEW_STALE_ACCEPTANCE/);
  assert.match(acceptRoute, /filingProviderSnapshot:\s*acceptedSnapshot/);
  assert.match(acceptRoute, /providerReviewAcceptedVersionStamp:\s*acceptedVersionStamp/);
  assert.match(acceptRoute, /providerReviewAcceptedEffectivePlanHash:\s*acceptedEffectivePlanHash/);
  assert.match(acceptRoute, /providerReviewAcceptedEffectivePlanSnapshot:\s*acceptedEffectivePlanSnapshot/);
  assert.match(acceptRoute, /providerReviewAcceptedAt:\s*now\.toISOString\(\)/);
  assert.match(acceptRoute, /providerPendingReview:\s*false/);
});

test("provider sync applies provider-authored effective changes to visible plan fields", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  const syncBlock = routes.slice(routes.indexOf("const persistLeidosProviderSync = async"));
  assert.match(routes, /const buildProviderAuthoredPlanUpdates = \(snapshot: Record<string, unknown>\) =>/);
  assert.match(routes, /providerEffectivePlanChangedFields/);
  assert.match(routes, /changedFields\.has\("route"\)/);
  assert.match(routes, /updates\.route = providerRoute/);
  assert.match(routes, /changedFields\.has\("otherInfo"\)/);
  assert.match(routes, /updates\.filingOtherInfo = providerOtherInfo/);
  assert.match(routes, /changedFields\.has\("plannedAltitudeFt"\)/);
  assert.match(routes, /updates\.filingPlannedAltitudeFt = Math\.round\(providerAltitude\)/);
  assert.match(routes, /changedFields\.has\("alternate"\)/);
  assert.match(routes, /updates\.alternate = providerAlternate\.toUpperCase\(\)/);
  assert.match(syncBlock, /const providerAuthoredPlanUpdates = buildProviderAuthoredPlanUpdates\(nextProviderSnapshot\)/);
  assert.match(syncBlock, /\.\.\.providerAuthoredPlanUpdates/);
});
