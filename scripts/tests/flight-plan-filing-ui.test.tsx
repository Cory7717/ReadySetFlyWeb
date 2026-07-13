import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FlightPlanLifecycleActions } from "../../client/src/components/flight-planner/FlightPlanLifecycleActions";
import { FilingProviderUpdatesList, FilingProviderWorkspace } from "../../client/src/components/flight-planner/FilingProviderWorkspace";
import type { FlightPlan } from "../../shared/schema";

const plan = {
  id: "plan-1",
  userId: "user-1",
  title: "Austin to Vegas",
  departure: "KEDC",
  destination: "KVGT",
  route: "KBPG KSRR KINW",
  alternate: null,
  plannedDepartureAt: new Date("2026-04-26T12:30:00.000Z"),
  plannedArrivalAt: new Date("2026-04-26T15:30:00.000Z"),
  aircraftType: "SR22",
  tailNumber: "N123RS",
  fuelOnBoard: null,
  fuelRequired: null,
  filingProvider: "leidos_flight_service",
  filingProviderPlanId: "ABC123",
  filingFlightRules: "IFR",
  filingEquipment: "SDFG",
  filingSoulsOnBoard: "2",
  filingAircraftColor: null,
  filingPilotName: "Pilot",
  filingRemarks: "Internal note",
  filingWakeTurbulence: null,
  filingTypeOfFlight: "G",
  filingSurveillanceEquipment: "N",
  filingOtherInfo: "PBN/A1B2",
  filingTrueAirspeedKtas: 180,
  filingPlannedAltitudeFt: 21000,
  filingEstimatedEnrouteMinutes: 120,
  filingEnduranceMinutes: 240,
  filingStatus: "filed",
  filingPendingAction: null,
  filingIsLive: true,
  filedAt: new Date("2026-04-23T13:00:00.000Z"),
  activatedAt: null,
  cancelledAt: null,
  closedAt: null,
  filingLastProviderSyncAt: new Date("2026-04-23T13:05:00.000Z"),
  filingPayload: {
    dof: "260426",
    dofInjected: true,
    builtAt: "2026-04-23T13:00:00.000Z",
    otherInfo: "PBN/A1B2 DOF/260426",
    route: {
      normalizedTransmittedRoute: "DCT KBPG DCT KSRR DCT KINW DCT",
    },
  },
  filingProviderSnapshot: {
    syncedAt: "2026-04-23T13:05:00.000Z",
    providerStatus: "PROPOSED",
    artccState: "ROGERED",
    route: {
      providerRoute: "DCT KBPG DCT TCC DCT KINW DCT",
    },
    fieldDiffs: [
      { field: "route", changedForTransmission: true, changedByProvider: true },
    ],
  },
  filingProviderMessages: [
    {
      id: "msg-1",
      timestamp: "2026-04-23T13:05:00.000Z",
      severity: "warning",
      title: "Provider route changed",
      details: "Leidos returned an expectedRoute with TCC inserted.",
      providerPlanId: "ABC123",
    },
  ],
  filingRaw: null,
  filingActionHistory: [],
  plannerState: null,
  notes: "Internal note",
  createdAt: new Date("2026-04-23T12:55:00.000Z"),
  updatedAt: new Date("2026-04-23T13:05:00.000Z"),
} as unknown as FlightPlan;

const lifecycleLabels = {
  file: "Submit Test Flight Plan - Saved",
  amend: "Amend Test Flight Plan",
  activate: "Test Activate",
  cancel: "Test Cancel",
  close: "Test Close Flight Plan",
  sync: "Provider Sync",
};

const noop = () => undefined;

const lifecyclePlan = (overrides: Partial<FlightPlan> & Record<string, unknown> = {}) => ({
  ...plan,
  id: "life-plan-1",
  filingStatus: "filed",
  filingIsLive: true,
  filingProviderPlanId: "PROVIDER-1",
  filingFlightRules: "IFR",
  filingProviderSnapshot: {
    providerLifecycleStatus: "proposed",
    providerStatus: "PROPOSED",
    artccState: "ROGERED",
    versionStamp: "20260713120000000",
    providerActionAvailability: {
      amend: true,
      activate: false,
      cancel: true,
      close: false,
    },
  },
  filingRaw: {
    versionStamp: "20260713120000000",
  },
  filingProviderMessages: [
    {
      id: "provider-update-1",
      timestamp: "2026-07-13T12:00:00.000Z",
      severity: "info",
      title: "Provider update",
      details: "Provider sync available.",
    },
  ],
  ...overrides,
}) as unknown as FlightPlan;

const renderLifecycleActions = (planForRender: FlightPlan, extraProps: Partial<React.ComponentProps<typeof FlightPlanLifecycleActions>> = {}) =>
  renderToStaticMarkup(
    <FlightPlanLifecycleActions
      plan={planForRender}
      labels={lifecycleLabels}
      onFile={noop}
      onAmend={noop}
      onSync={noop}
      onAcceptProviderChanges={noop}
      onProviderUpdates={noop}
      onActivate={noop}
      onClose={noop}
      onCancel={noop}
      onCertificationCleanup={noop}
      onDownloadSummary={noop}
      {...extraProps}
    />,
  );

const getButtonMarkup = (html: string, label: string) => {
  const labelIndex = html.indexOf(label);
  assert.notEqual(labelIndex, -1, `expected rendered button label: ${label}`);
  const start = html.lastIndexOf("<button", labelIndex);
  const end = html.indexOf("</button>", labelIndex);
  assert.notEqual(start, -1, `expected ${label} to be inside a button`);
  assert.notEqual(end, -1, `expected ${label} button to close`);
  return html.slice(start, end + "</button>".length);
};

const assertButtonVisible = (html: string, label: string, options: { disabled?: boolean } = {}) => {
  const button = getButtonMarkup(html, label);
  if (options.disabled === true) {
    assert.match(button, /\sdisabled(?:=""|>| )/, `expected ${label} to be disabled`);
  } else if (options.disabled === false) {
    assert.doesNotMatch(button, /\sdisabled(?:=""|>| )/, `expected ${label} to be enabled`);
  }
};

const assertButtonAbsent = (html: string, label: string) => {
  assert.equal(html.includes(label), false, `expected ${label} to be absent`);
};

test("provider workspace renders local, filed, and provider route views", () => {
  const html = renderToStaticMarkup(<FilingProviderWorkspace plan={plan} />);
  assert.ok(html.includes("Local Plan"));
  assert.ok(html.includes("Filed Payload Summary"));
  assert.ok(html.includes("Provider Sync / Effective Plan"));
  assert.ok(html.includes("KBPG KSRR KINW"));
  assert.ok(html.includes("DCT KBPG DCT KSRR DCT KINW DCT"));
  assert.ok(html.includes("DCT KBPG DCT TCC DCT KINW DCT"));
  assert.ok(html.includes("Updated by provider"));
  assert.ok(html.includes("260426"));
});

test("provider updates list renders event entries", () => {
  const html = renderToStaticMarkup(<FilingProviderUpdatesList plan={plan} />);
  assert.ok(html.includes("Provider route changed"));
  assert.ok(html.includes("Leidos returned an expectedRoute with TCC inserted."));
  assert.ok(html.includes("Provider reference: ABC123"));
});

test("flight planner review workflow exposes one clear filing surface", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  assert.match(source, /Review &amp; File/);
  assert.match(source, /Review &amp; Submit/);
  assert.match(source, /guestFileMutation\.mutate\(\)/);
  assert.match(source, /Submit Test Flight Plan -/);
  assert.match(source, /Save & Submit Test Flight Plan/);
  assert.match(source, /Save Changes & Amend Test Flight Plan/);
  assert.doesNotMatch(source, /File & Save/);
  assert.doesNotMatch(source, /Save local changes/);
  assert.doesNotMatch(source, /Save and continue to filing/);
  assert.doesNotMatch(source, /Return to Filing/);
  assert.doesNotMatch(source, /Required Filing Information/);
  assert.doesNotMatch(source, /Resolve before File or Amend/);
});

test("flight planner preserves Flight Service lifecycle action buttons", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  assert.doesNotMatch(source, /false && canFilePlan/);
  assert.doesNotMatch(source, /false && !isTerminalFilingPlan/);
  assert.doesNotMatch(source, /false && hasPendingProviderReview/);
  assert.match(source, /<FlightPlanLifecycleActions/);
  assert.match(source, /requestSaveCurrentPlanWithFilingAction\("file"\)/);
  assert.match(source, /requestSaveCurrentPlanWithFilingAction\("amend", currentSavedPlan!\.id\)/);
  assert.match(source, /submitFilingAction\(\{ planId: currentSavedPlan!\.id, action: "activate" \}\)/);
  assert.match(source, /submitFilingAction\(\{ planId: currentSavedPlan!\.id, action: "close" \}\)/);
  assert.match(source, /submitFilingAction\(\{ planId: currentSavedPlan!\.id, action: "cancel" \}\)/);
  assert.match(source, /submitProviderSync\(currentSavedPlan!\.id\)/);
  assert.match(source, /acceptProviderReviewMutation\.mutate\(currentSavedPlan!\.id\)/);
  assert.match(source, /setProviderUpdatesPlan\(currentSavedPlan!\)/);
  assert.match(source, /submitFilingAction\(\{ planId: plan\.id, action: "file" \}\)/);
  assert.match(source, /requestSaveCurrentPlanWithFilingAction\("amend", plan\.id\)/);
  assert.match(source, /submitFilingAction\(\{ planId: plan\.id, action: "activate" \}\)/);
  assert.match(source, /submitFilingAction\(\{ planId: plan\.id, action: "close" \}\)/);
  assert.match(source, /submitFilingAction\(\{ planId: plan\.id, action: "cancel" \}\)/);
  assert.match(source, /submitProviderSync\(plan\.id\)/);
  assert.match(source, /acceptProviderReviewMutation\.mutate\(plan\.id\)/);
  assert.match(source, /setProviderUpdatesPlan\(plan\)/);
});

test("rendered lifecycle actions show saved unfiled plan filing controls", () => {
  const html = renderLifecycleActions(lifecyclePlan({
    filingStatus: "draft",
    filingIsLive: false,
    filingProviderPlanId: null,
    filingProviderSnapshot: {},
    filingRaw: null,
  }));

  assertButtonVisible(html, lifecycleLabels.file, { disabled: false });
  assertButtonVisible(html, "Provider updates", { disabled: false });
  assertButtonVisible(html, "Download filing summary", { disabled: false });
  assertButtonAbsent(html, lifecycleLabels.amend);
  assertButtonAbsent(html, lifecycleLabels.activate);
  assertButtonAbsent(html, lifecycleLabels.close);
  assertButtonAbsent(html, lifecycleLabels.cancel);
});

test("rendered lifecycle actions show filed IFR proposed controls without activate or close", () => {
  const html = renderLifecycleActions(lifecyclePlan());

  assertButtonVisible(html, lifecycleLabels.amend, { disabled: false });
  assertButtonVisible(html, lifecycleLabels.cancel, { disabled: false });
  assertButtonVisible(html, lifecycleLabels.sync, { disabled: false });
  assertButtonVisible(html, "Provider updates", { disabled: false });
  assertButtonVisible(html, "Download filing summary", { disabled: false });
  assertButtonAbsent(html, lifecycleLabels.activate);
  assertButtonAbsent(html, lifecycleLabels.close);
  assertButtonAbsent(html, lifecycleLabels.file);
});

test("rendered lifecycle actions show filed VFR proposed activate cancel and sync controls", () => {
  const html = renderLifecycleActions(lifecyclePlan({
    filingFlightRules: "VFR",
    filingProviderSnapshot: {
      providerLifecycleStatus: "proposed",
      providerStatus: "PROPOSED",
      artccState: "ROGERED",
      versionStamp: "20260713120000000",
      providerActionAvailability: {
        amend: true,
        activate: true,
        cancel: true,
        close: false,
      },
    },
  }));

  assertButtonVisible(html, lifecycleLabels.amend, { disabled: false });
  assertButtonVisible(html, lifecycleLabels.activate, { disabled: false });
  assertButtonVisible(html, lifecycleLabels.cancel, { disabled: false });
  assertButtonVisible(html, lifecycleLabels.sync, { disabled: false });
  assertButtonVisible(html, "Provider updates", { disabled: false });
  assertButtonVisible(html, lifecycleLabels.close, { disabled: true });
});

test("rendered lifecycle actions show activated VFR close and sync controls", () => {
  const html = renderLifecycleActions(lifecyclePlan({
    filingStatus: "activated",
    filingFlightRules: "VFR",
    filingProviderSnapshot: {
      providerLifecycleStatus: "activated",
      providerStatus: "ACTIVATED",
      artccState: "ROGERED",
      versionStamp: "20260713120000001",
      providerActionAvailability: {
        amend: true,
        activate: false,
        cancel: false,
        close: true,
      },
    },
  }));

  assertButtonVisible(html, lifecycleLabels.amend, { disabled: false });
  assertButtonVisible(html, lifecycleLabels.close, { disabled: false });
  assertButtonVisible(html, lifecycleLabels.sync, { disabled: false });
  assertButtonVisible(html, "Provider updates", { disabled: false });
  assertButtonVisible(html, lifecycleLabels.activate, { disabled: true });
  assertButtonVisible(html, lifecycleLabels.cancel, { disabled: true });
});

test("rendered lifecycle actions show accept provider changes when review is pending", () => {
  const html = renderLifecycleActions(lifecyclePlan({
    filingProviderSnapshot: {
      providerLifecycleStatus: "proposed",
      providerStatus: "PROPOSED",
      artccState: "ROGERED",
      versionStamp: "20260713120000000",
      providerPendingReview: true,
      providerActionAvailability: {
        amend: true,
        activate: false,
        cancel: true,
        close: false,
      },
    },
  }));

  assertButtonVisible(html, "Accept provider changes", { disabled: false });
  assertButtonVisible(html, lifecycleLabels.amend, { disabled: false });
  assertButtonVisible(html, lifecycleLabels.cancel, { disabled: false });
});

test("rendered lifecycle actions suppress mutation controls for terminal plans", () => {
  for (const status of ["cancelled", "closed"]) {
    const html = renderLifecycleActions(lifecyclePlan({
      filingStatus: status,
      filingFlightRules: "VFR",
      filingProviderSnapshot: {
        providerLifecycleStatus: status,
        providerStatus: status.toUpperCase(),
        artccState: "ROGERED",
        versionStamp: "20260713120000002",
        providerActionAvailability: {
          amend: false,
          activate: false,
          cancel: false,
          close: false,
        },
      },
    }));

    assertButtonAbsent(html, lifecycleLabels.file);
    assertButtonAbsent(html, lifecycleLabels.amend);
    assertButtonAbsent(html, lifecycleLabels.activate);
    assertButtonAbsent(html, lifecycleLabels.close);
    assertButtonAbsent(html, lifecycleLabels.cancel);
    assertButtonVisible(html, "Provider updates", { disabled: false });
    assertButtonVisible(html, "Download filing summary", { disabled: false });
  }
});

test("rendered lifecycle actions keep amend visible but disabled when an amend prerequisite is missing", () => {
  const reason = "This filed record is still waiting on the provider amend token. Refresh provider sync in a few minutes, then try amend again.";
  const html = renderLifecycleActions(lifecyclePlan(), { amendUnavailableReason: reason });
  const button = getButtonMarkup(html, lifecycleLabels.amend);

  assert.match(button, /\sdisabled(?:=""|>| )/);
  assert.ok(button.includes(reason));
});

test("flight planner readiness edit actions target stable planner fields", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  for (const id of [
    "planner-field-departure",
    "planner-field-destination",
    "planner-field-route",
    "planner-field-equipment",
    "planner-field-surveillance",
    "planner-field-fuel-endurance",
    "planner-filing-details",
    "planner-current-plan-actions",
  ]) {
    assert.ok(source.includes(id), `expected ${id} target`);
  }
  assert.match(source, /jumpToReadinessIssue\(issue\)/);
});

test("planner map overlays are constrained for narrow screens", () => {
  const leafletSource = readFileSync(resolve("client/src/components/flight-planner/PlannerMap.tsx"), "utf8");
  const mapLibreSource = readFileSync(resolve("client/src/components/flight-planner/MapLibrePlannerMap.tsx"), "utf8");
  const cesiumSource = readFileSync(resolve("client/src/components/flight-planner/CesiumGlobe.tsx"), "utf8");
  assert.match(leafletSource, /max-w-\[calc\(100%-9rem\)\]/);
  assert.match(leafletSource, /truncate/);
  assert.match(mapLibreSource, /max-w-\[calc\(100%-9rem\)\]/);
  assert.match(mapLibreSource, /truncate/);
  assert.match(cesiumSource, /max-w-\[calc\(100%-11rem\)\]/);
});
