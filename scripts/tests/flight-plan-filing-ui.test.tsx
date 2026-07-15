import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FlightPlanLifecycleActions } from "../../client/src/components/flight-planner/FlightPlanLifecycleActions";
import {
  getPastDepartureLifecycleMessage,
  shouldApplyPastDepartureReadinessBlock,
} from "../../client/src/components/flight-planner/FlightPlanLifecycleActions";
import { FilingProviderUpdatesList, FilingProviderWorkspace } from "../../client/src/components/flight-planner/FilingProviderWorkspace";
import {
  PlannerWorkflowFooter,
  type PlannerWorkflowStep,
  type PlannerWorkflowStepId,
} from "../../client/src/components/flight-planner/PlannerWorkflowFooter";
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

const workflowSteps: Record<PlannerWorkflowStepId, PlannerWorkflowStep> = {
  route: { id: "route", step: 1, label: "Route" },
  weather: { id: "weather", step: 2, label: "Weather" },
  navlog: { id: "navlog", step: 3, label: "Nav Log" },
  analysis: { id: "analysis", step: 4, label: "Analysis" },
  file: { id: "file", step: 5, label: "Review & File" },
};

const renderWorkflowFooter = ({
  current,
  previous,
  next,
}: {
  current: PlannerWorkflowStepId;
  previous?: PlannerWorkflowStepId;
  next?: PlannerWorkflowStepId;
}) => renderToStaticMarkup(
  <PlannerWorkflowFooter
    currentStep={workflowSteps[current]}
    previousStep={previous ? workflowSteps[previous] : undefined}
    nextStep={next ? workflowSteps[next] : undefined}
    status={`${workflowSteps[current].label} is ready.`}
    onNavigate={noop as any}
    onReturnToTop={current === "file" ? noop : undefined}
  />
);

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

test("flight planner keeps hydrated airport suggestions closed until the user edits", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  assert.match(source, /const \[departureSearchActive, setDepartureSearchActive\] = useState\(false\)/);
  assert.match(source, /const \[destinationSearchActive, setDestinationSearchActive\] = useState\(false\)/);
  assert.match(source, /departureSearchActive && departureSuggestions\.length > 0/);
  assert.match(source, /destinationSearchActive && destinationSuggestions\.length > 0/);
  assert.match(source, /setDepartureSearchActive\(true\);\s*setForm\(\(current\) => \(\{ \.\.\.current, departure: value \}\)\)/);
  assert.match(source, /setDestinationSearchActive\(true\);\s*setForm\(\(current\) => \(\{ \.\.\.current, destination: value \}\)\)/);
  assert.match(source, /setDepartureSearchActive\(false\);\s*setDepartureSuggestions\(\[\]\)/);
  assert.match(source, /setDestinationSearchActive\(false\);\s*setDestinationSuggestions\(\[\]\)/);
  assert.match(source, /onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/);
});

test("flight planner resets restored scroll position on page entry", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  assert.match(source, /previousScrollRestoration = window\.history\.scrollRestoration/);
  assert.match(source, /window\.history\.scrollRestoration = "manual"/);
  assert.match(source, /window\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\)/);
  assert.match(source, /window\.history\.scrollRestoration = previousScrollRestoration/);
});

test("flight planner route-structure badges use explicit planner-safe contrast colors", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  assert.match(source, /plannerSafeBadgeClass = ".*!border-\[#60758C\].*!bg-\[#18212B\].*!text-\[#E3EDF7\]/);
  assert.match(source, /\[--card:213_24%_11%\]/);
  assert.match(source, /\[--foreground:210_40%_94%\]/);
  assert.match(source, /\[--muted-foreground:211_28%_78%\]/);
  assert.match(source, /\[--badge-outline:#60758C\]/);
  assert.match(source, /Procedure-aware route structure/);
  assert.match(source, /<Badge variant="outline" className=\{cn\("uppercase tracking-\[0\.14em\]", plannerSafeBadgeClass\)\}/);
  assert.doesNotMatch(source, /<Badge variant="outline" className="border-\[#5d6f85\]\/30 text-\[#B8CBDD\]"/);

  const luminance = (hex: string) => {
    const channels = hex.match(/[0-9a-f]{2}/gi)?.map((part) => parseInt(part, 16) / 255) || [];
    const linear = channels.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const contrast = (a: string, b: string) => {
    const [lighter, darker] = [luminance(a), luminance(b)].sort((left, right) => right - left);
    return (lighter + 0.05) / (darker + 0.05);
  };

  assert.ok(contrast("#E3EDF7", "#18212B") >= 4.5, "badge text contrast should meet WCAG AA");
  assert.ok(contrast("#60758C", "#18212B") >= 3, "badge border contrast should identify the chip boundary");
});

test("rendered workflow footer exposes named next-step navigation for every planner tab", () => {
  const route = renderWorkflowFooter({ current: "route", next: "weather" });
  assert.match(route, /Step 1 of 5 - Route/);
  assert.match(route, /Continue to Weather/);
  assert.doesNotMatch(route, /Back to/);

  const weather = renderWorkflowFooter({ current: "weather", previous: "route", next: "navlog" });
  assert.match(weather, /Step 2 of 5 - Weather/);
  assert.match(weather, /Back to Route/);
  assert.match(weather, /Continue to Nav Log/);

  const navlog = renderWorkflowFooter({ current: "navlog", previous: "weather", next: "analysis" });
  assert.match(navlog, /Step 3 of 5 - Nav Log/);
  assert.match(navlog, /Back to Weather/);
  assert.match(navlog, /Continue to Analysis/);

  const analysis = renderWorkflowFooter({ current: "analysis", previous: "navlog", next: "file" });
  assert.match(analysis, /Step 4 of 5 - Analysis/);
  assert.match(analysis, /Back to Nav Log/);
  assert.match(analysis, /Continue to Review &amp; File/);

  const file = renderWorkflowFooter({ current: "file", previous: "analysis" });
  assert.match(file, /Step 5 of 5 - Review &amp; File/);
  assert.match(file, /Back to Analysis/);
  assert.match(file, /Return to Top/);
  assert.doesNotMatch(file, /Continue to/);
  assert.doesNotMatch(file, /Submit|Amend|Cancel|Activate|Close|Provider Sync/);
});

test("flight planner workflow footer wiring is navigation-only and preserves planner state", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  assert.match(source, /<div\s+id="planner-workflow"[\s\S]*?ref=\{plannerWorkflowRef\}[\s\S]*?tabIndex=\{-1\}/);
  assert.match(source, /const plannerWorkflowOrder: FlightPlannerTab\[\] = \["route", "weather", "navlog", "analysis", "file"\]/);
  assert.match(source, /trackEvent\("planner_step_navigation"/);
  assert.match(source, /setActiveTab\(nextTab\);/);
  assert.match(source, /scrollToPlannerWorkflowTop\(\);/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /renderPlannerWorkflowFooter\("route"\)/);
  assert.match(source, /renderPlannerWorkflowFooter\("weather"\)/);
  assert.match(source, /renderPlannerWorkflowFooter\("navlog"\)/);
  assert.match(source, /renderPlannerWorkflowFooter\("analysis"\)/);
  assert.match(source, /renderPlannerWorkflowFooter\("file"\)/);

  const navigationBlock = source.match(/const navigatePlannerWorkflowStep = useCallback\([\s\S]*?\}, \[activeTab, isAuthenticated, isGuest, scrollToPlannerWorkflowTop\]\);/)?.[0] || "";
  assert.ok(navigationBlock, "navigation callback should be present");
  assert.doesNotMatch(navigationBlock, /save|fileFlightPlan|amend|cancel|activate|close|sync|invalidate|resetForm|setForm|setEditingPlan|setDraftPlanId/i);
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

test("past departure readiness block applies only to unfiled plans", () => {
  assert.equal(shouldApplyPastDepartureReadinessBlock(null), true);
  assert.equal(shouldApplyPastDepartureReadinessBlock(lifecyclePlan({
    filingStatus: "draft",
    filingIsLive: false,
    filingProviderPlanId: null,
    filingProviderSnapshot: {},
  })), true);
  assert.equal(shouldApplyPastDepartureReadinessBlock(lifecyclePlan({
    filingStatus: "filed",
    filingFlightRules: "IFR",
  })), false);
  assert.equal(shouldApplyPastDepartureReadinessBlock(lifecyclePlan({
    filingStatus: "activated",
    filingFlightRules: "IFR",
    filingProviderSnapshot: { providerLifecycleStatus: "activated" },
  })), false);
  assert.equal(shouldApplyPastDepartureReadinessBlock(lifecyclePlan({ filingStatus: "closed" })), false);
  assert.equal(shouldApplyPastDepartureReadinessBlock(lifecyclePlan({ filingStatus: "cancelled" })), false);
});

test("past filed departure renders provider lifecycle status instead of incomplete-plan copy", () => {
  const now = Date.parse("2026-07-13T18:00:00.000Z");
  const pastDeparture = new Date("2026-07-13T17:45:00.000Z");

  assert.equal(
    getPastDepartureLifecycleMessage(lifecyclePlan({
      filingStatus: "filed",
      filingFlightRules: "IFR",
      filingProviderSnapshot: { providerLifecycleStatus: "proposed" },
    }), pastDeparture, now),
    "Departure time has passed. Waiting for provider lifecycle confirmation.",
  );
  assert.equal(
    getPastDepartureLifecycleMessage(lifecyclePlan({
      filingStatus: "activated",
      filingFlightRules: "IFR",
      filingProviderSnapshot: { providerLifecycleStatus: "activated" },
    }), pastDeparture, now),
    "Provider lifecycle: ACTIVE.",
  );
  assert.equal(
    getPastDepartureLifecycleMessage(lifecyclePlan({ filingStatus: "closed" }), pastDeparture, now),
    null,
  );
  assert.equal(
    getPastDepartureLifecycleMessage(lifecyclePlan({ filingStatus: "cancelled" }), pastDeparture, now),
    null,
  );
});

test("filed IFR lifecycle actions never render activate or close after departure", () => {
  const html = renderLifecycleActions(lifecyclePlan({
    filingStatus: "filed",
    filingFlightRules: "IFR",
    plannedDepartureAt: new Date("2026-07-13T17:45:00.000Z"),
    filingProviderSnapshot: {
      providerLifecycleStatus: "proposed",
      providerStatus: "PROPOSED",
      artccState: "ROGERED",
      versionStamp: "20260713174500000",
      providerActionAvailability: {
        amend: true,
        activate: true,
        cancel: true,
        close: true,
      },
    },
  }));

  assertButtonVisible(html, lifecycleLabels.amend, { disabled: false });
  assertButtonVisible(html, lifecycleLabels.cancel, { disabled: false });
  assertButtonVisible(html, lifecycleLabels.sync, { disabled: false });
  assertButtonAbsent(html, lifecycleLabels.activate);
  assertButtonAbsent(html, lifecycleLabels.close);
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
