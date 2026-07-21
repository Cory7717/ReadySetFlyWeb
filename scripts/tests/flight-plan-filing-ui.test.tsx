import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FlightPlanLifecycleActions } from "../../client/src/components/flight-planner/FlightPlanLifecycleActions";
import {
  canCancelPlan,
  getCanonicalPlanDepartureInstant,
  getLifecycleActionDisabledReason,
  getPastDepartureLifecycleMessage,
  shouldApplyPastDepartureReadinessBlock,
} from "../../client/src/components/flight-planner/FlightPlanLifecycleActions";
import { FilingProviderUpdatesList, FilingProviderWorkspace } from "../../client/src/components/flight-planner/FilingProviderWorkspace";
import {
  PlannerWorkflowFooter,
  type PlannerWorkflowStep,
  type PlannerWorkflowStepId,
} from "../../client/src/components/flight-planner/PlannerWorkflowFooter";
import { FlightPlannerAccountRequirementContent } from "../../client/src/components/flight-planner/FlightPlannerAccountRequirementDialog";
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

test("provider updates list displays historical accept records as reviewed updates", () => {
  const legacyPlan = {
    ...plan,
    filingProviderMessages: [{
      id: "msg-accepted",
      timestamp: "2026-07-16T22:00:00.000Z",
      severity: "success",
      title: "Provider changes accepted",
      details: "Pilot reviewed and accepted the current provider version in RSF. Amendments can be submitted again from this provider state.",
      providerPlanId: "ABC123",
    }],
  } as unknown as FlightPlan;
  const html = renderToStaticMarkup(<FilingProviderUpdatesList plan={legacyPlan} />);

  assert.ok(html.includes("Provider update marked reviewed"));
  assert.ok(html.includes("Pilot reviewed the current provider version in RSF."));
  assert.equal(html.includes("Provider changes accepted"), false);
  assert.equal(html.includes("reviewed and accepted"), false);
});

test("internal RSF references are not displayed or treated as live provider IDs", () => {
  const internalReference = "rsf-245fd8ec-c8fb-4d68-ac74-7cec4dc3f5e1-file";
  const legacyPlan = {
    ...plan,
    filingProviderPlanId: internalReference,
    filingProviderSnapshot: {
      providerReferenceId: internalReference,
      providerLifecycleStatus: "proposed",
      providerStatus: "PROPOSED",
      versionStamp: "20260721120540000",
    },
    filingProviderMessages: [{
      id: "msg-internal",
      timestamp: "2026-07-21T17:05:40.000Z",
      severity: "info",
      title: "Provider update",
      details: "Provider sync available.",
      providerPlanId: internalReference,
    }],
  } as unknown as FlightPlan;

  const workspaceHtml = renderToStaticMarkup(<FilingProviderWorkspace plan={legacyPlan} />);
  const updatesHtml = renderToStaticMarkup(<FilingProviderUpdatesList plan={legacyPlan} />);
  const actionHtml = renderLifecycleActions(legacyPlan);

  assert.equal(canCancelPlan(legacyPlan), false);
  assert.equal(workspaceHtml.includes(internalReference), false);
  assert.equal(updatesHtml.includes(internalReference), false);
  assertButtonAbsent(actionHtml, "Test Cancel");
  assert.match(getLifecycleActionDisabledReason(legacyPlan, "cancel") || "", /does not have a live provider filing reference/i);
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

test("flight planner mobile workflow mirrors desktop five-step flow", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  assert.match(source, /Mobile workflow/);
  assert.match(source, /Same five-step flow as desktop/);
  assert.match(source, /plannerWorkflowOrder\.map\(\(tab\) =>/);
  assert.match(source, /aria-current=\{activeTab === tab \? "step" : undefined\}/);
  assert.match(source, /grid-flow-col auto-cols-\[minmax\(8rem,1fr\)\] overflow-x-auto/);
  assert.match(source, /Route step shortcuts/);
  assert.match(source, /planner-aircraft-setup/);
  assert.doesNotMatch(source, /Phone Quick Planner/);
  assert.doesNotMatch(source, /Use quick jumps for the dense planner sections/);
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

test("rendered lifecycle actions show mark reviewed when provider review is pending", () => {
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

  assertButtonVisible(html, "Mark update reviewed", { disabled: false });
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

test("rendered lifecycle actions ignore stale provider review flags on terminal plans", () => {
  const html = renderLifecycleActions(lifecyclePlan({
    filingStatus: "closed",
    closedAt: new Date("2026-07-16T20:00:00.000Z"),
    filingProviderSnapshot: {
      providerLifecycleStatus: "closed",
      providerPendingReview: true,
    },
  }));

  assertButtonAbsent(html, "Mark update reviewed");
  assertButtonAbsent(html, lifecycleLabels.amend);
  assertButtonAbsent(html, lifecycleLabels.cancel);
  assertButtonAbsent(html, lifecycleLabels.close);
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

test("cancel eligibility uses canonical UTC departure instant instead of browser-local display time", () => {
  const planForRender = lifecyclePlan({
    id: "7406aa3f-fa7e-47c4-b19b-28fe4f9342e8",
    departure: "KLAS",
    destination: "KDFW",
    filingStatus: "filed",
    filingFlightRules: "IFR",
    plannedDepartureAt: new Date("2026-07-17T22:30:00.000Z"),
    filingPayload: {
      departureInstant: "2026-07-17T22:30:00.000Z",
    },
    plannerState: {
      departureTimeZone: "America/Los_Angeles",
      userDisplayDepartureTimeLocal: "2026-07-17T15:30",
    },
    filingProviderSnapshot: {
      providerLifecycleStatus: "proposed",
      providerLifecycleSource: "provider_retrieve",
      artccState: "ROGERED",
      versionStamp: "20260717201622780",
    },
  });

  assert.equal(getCanonicalPlanDepartureInstant(planForRender)?.toISOString(), "2026-07-17T22:30:00.000Z");
  assert.equal(canCancelPlan(planForRender), true);
  assert.equal(getLifecycleActionDisabledReason(planForRender, "cancel"), null);

  const html = renderLifecycleActions(planForRender);
  assertButtonVisible(html, lifecycleLabels.cancel, { disabled: false });
  assertButtonAbsent(html, lifecycleLabels.activate);
  assertButtonAbsent(html, lifecycleLabels.close);
});

test("cancel eligibility is stable when browser timezone differs or changes", () => {
  const basePlan = lifecyclePlan({
    departure: "KLAS",
    filingStatus: "filed",
    filingFlightRules: "IFR",
    plannedDepartureAt: new Date("2026-07-17T22:30:00.000Z"),
    plannerState: {
      departureTimeZone: "America/Los_Angeles",
      userDisplayDepartureTimeLocal: "2026-07-17T15:30",
    },
    filingProviderSnapshot: {
      providerLifecycleStatus: "proposed",
      lastKnownArtccState: "ROGERED",
      versionStamp: "20260717201622780",
    },
  });
  const chicagoDevicePlan = lifecyclePlan({
    ...basePlan,
    plannerState: {
      departureTimeZone: "America/Los_Angeles",
      browserTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-07-17T15:30",
    },
  } as Partial<FlightPlan>);
  const newYorkDevicePlan = lifecyclePlan({
    ...basePlan,
    plannerState: {
      departureTimeZone: "America/Los_Angeles",
      browserTimeZone: "America/New_York",
      userDisplayDepartureTimeLocal: "2026-07-17T15:30",
    },
  } as Partial<FlightPlan>);

  assert.equal(canCancelPlan(basePlan), true);
  assert.equal(canCancelPlan(chicagoDevicePlan), true);
  assert.equal(canCancelPlan(newYorkDevicePlan), true);
  assert.equal(getCanonicalPlanDepartureInstant(chicagoDevicePlan)?.toISOString(), "2026-07-17T22:30:00.000Z");
  assert.equal(getCanonicalPlanDepartureInstant(newYorkDevicePlan)?.toISOString(), "2026-07-17T22:30:00.000Z");
});

test("planner filing readiness edit target sends departure time fixes to Route Setup", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/flight-planner.tsx"), "utf8");
  assert.match(
    source,
    /departureTime:\s*\{\s*tab:\s*"route",\s*sectionId:\s*"planner-route-setup",\s*focusId:\s*"planner-field-departure-time"\s*\}/,
  );
  assert.match(
    source,
    /departureTimezone:\s*\{\s*tab:\s*"route",\s*sectionId:\s*"planner-route-setup",\s*focusId:\s*"planner-field-departure"\s*\}/,
  );
  assert.doesNotMatch(
    source,
    /departureTime:\s*\{\s*tab:\s*"route",\s*sectionId:\s*"planner-distance-performance"/,
  );
});

test("filing action failures preserve server readiness details", () => {
  const plannerSource = readFileSync(resolve(process.cwd(), "client/src/pages/flight-planner.tsx"), "utf8");
  const queryClientSource = readFileSync(resolve(process.cwd(), "client/src/lib/queryClient.ts"), "utf8");

  assert.match(queryClientSource, /validationMessages\?:\s*string\[\]/);
  assert.match(queryClientSource, /error\.validationMessages = Array\.from\(new Set\(validationMessages\)\)/);
  assert.match(plannerSource, /const summarizeFilingActionError = \(error: unknown\) => \{/);
  assert.match(plannerSource, /record\.code === "FLIGHT_PLAN_READINESS_FAILED"/);
  assert.match(plannerSource, /validationMessages\.map\(\(message\) => `- \$\{summarizePlannerError\(message\)\}`\)/);
  assert.match(plannerSource, /const message = summarizeFilingActionError\(error\);/);
  assert.match(plannerSource, /className="mt-1 whitespace-pre-line"/);
});

test("blank Fuel On Board is not treated as full usable fuel capacity", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/flight-planner.tsx"), "utf8");
  assert.match(source, /const fuelAvailableGallons = useMemo\(\(\) => \{/);
  assert.match(source, /if \(Number\.isFinite\(onboard\) && onboard > 0\) return onboard;/);
  assert.match(source, /return null;\s*\}, \[form\.fuelOnBoard\]\);/);
  assert.doesNotMatch(source, /return planningFuel;\s*\}, \[form\.fuelOnBoard, planningFuel\]\);/);
});

test("flight planner refreshes saved plans when notification polling changes", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/flight-planner.tsx"), "utf8");
  assert.match(source, /queryKey:\s*\["\/api\/notifications\/unread"\]/);
  assert.match(source, /refetchInterval:\s*isAuthenticated\s*\?\s*15_000\s*:\s*false/);
  assert.match(source, /lastProviderNotificationCountRef\.current\s*=\s*nextCount/);
  assert.match(source, /const invalidateFlightPlanQueries = useCallback\(\(\) => \{/);
  assert.match(source, /predicate:\s*\(query\) => String\(query\.queryKey\?\.\[0\] \|\| ""\)\.startsWith\("\/api\/flight-plans"\)/);
  assert.match(source, /invalidateFlightPlanQueries\(\);/);
  assert.match(source, /void poll\(\);\s*const timer = window\.setInterval\(poll, 60000\)/);
});

test("timezone-less display strings are not canonical lifecycle-action instants", () => {
  const sameTimezonePlan = lifecyclePlan({
    departure: "KEDC",
    filingStatus: "filed",
    filingFlightRules: "IFR",
    plannedDepartureAt: new Date("2026-07-17T20:30:00.000Z"),
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-07-17T15:30",
    },
    filingProviderSnapshot: {
      providerLifecycleStatus: "proposed",
      providerLifecycleSource: "local_reconciliation",
    },
  });
  const dateBoundaryPlan = lifecyclePlan({
    departure: "KLAS",
    filingStatus: "filed",
    filingFlightRules: "IFR",
    plannedDepartureAt: new Date("2026-07-18T06:30:00.000Z"),
    plannerState: {
      departureTimeZone: "America/Los_Angeles",
      browserTimeZone: "America/New_York",
      userDisplayDepartureTimeLocal: "2026-07-17T23:30",
    },
    filingProviderSnapshot: {
      providerLifecycleStatus: "proposed",
      providerLifecycleSource: "local_reconciliation",
    },
  });

  assert.equal(getCanonicalPlanDepartureInstant(sameTimezonePlan)?.toISOString(), "2026-07-17T20:30:00.000Z");
  assert.equal(getCanonicalPlanDepartureInstant(dateBoundaryPlan)?.toISOString(), "2026-07-18T06:30:00.000Z");
  assert.equal(canCancelPlan(sameTimezonePlan), true);
  assert.equal(canCancelPlan(dateBoundaryPlan), true);
});

test("cancel remains disabled for active and terminal provider states", () => {
  const activePlan = lifecyclePlan({
    filingStatus: "activated",
    filingFlightRules: "VFR",
    filingProviderSnapshot: {
      providerLifecycleStatus: "activated",
      providerLifecycleSource: "provider_retrieve",
      versionStamp: "20260717201622780",
      providerActionAvailability: { cancel: false, close: true },
    },
  });
  const closedPlan = lifecyclePlan({
    filingStatus: "closed",
    filingFlightRules: "IFR",
    filingProviderSnapshot: {
      providerLifecycleStatus: "closed",
      providerLifecycleSource: "provider_retrieve",
      versionStamp: "20260717201622780",
    },
  });

  assert.equal(canCancelPlan(activePlan), false);
  assert.match(getLifecycleActionDisabledReason(activePlan, "cancel") || "", /Cancellation is only available/);
  assert.equal(canCancelPlan(closedPlan), false);
  assert.match(getLifecycleActionDisabledReason(closedPlan, "cancel") || "", /already closed or cancelled/);
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

test("flight planner account requirement dialog renders required account, privacy, and no-auto-action copy", () => {
  const html = renderToStaticMarkup(
    <FlightPlannerAccountRequirementContent
      sourceAction="file_flight_plan"
      activeStep="file"
      environment="LAB"
      showLabDisclosure
      onCreateAccount={noop}
      onSignIn={noop}
      onContinueExploring={noop}
    />,
  );

  assert.ok(html.includes("Create an RSF account"));
  assert.ok(html.includes("Flight Services requires pilot and contact information"));
  assert.ok(html.includes("provider updates, amendments, cancellation, and lifecycle history"));
  assert.ok(html.includes("It will not automatically file, amend, cancel, activate, or close anything."));
  assert.ok(html.includes("Ready Set Fly does not sell pilot filing information."));
  assert.ok(html.includes("/privacy-policy"));
  assert.ok(html.includes("Current environment: LAB"));
  assert.ok(html.includes("Create an Account &amp; Continue"));
  assert.ok(html.includes("Sign In"));
  assert.ok(html.includes("Continue Exploring Without Filing"));
});

test("flight planner account requirement dialog hides LAB disclosure in production", () => {
  const html = renderToStaticMarkup(
    <FlightPlannerAccountRequirementContent
      sourceAction="save_flight_plan"
      activeStep="route"
      environment="PRODUCTION"
      showLabDisclosure={false}
      onCreateAccount={noop}
      onSignIn={noop}
      onContinueExploring={noop}
    />,
  );

  assert.equal(html.includes("Current environment:"), false);
  assert.equal(html.includes("not available to Air Traffic Control"), false);
});

test("flight planner account prompt preserves guest test filing and uses safe auth-return analytics", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");

  assert.match(source, /POST", "\/api\/flight-plans\/guest-file"/);
  assert.match(source, /guestFlightPlanFiles >= 2/);
  assert.match(source, /Submit Test Flight Plan - \$\{guestFlightPlanFilesRemaining\}/);
  assert.match(source, /Guest test filing remains available in this validation environment/);

  assert.match(source, /FLIGHT_PLANNER_AUTH_RETURN_KEY = "rsf_flight_planner_auth_return_v1"/);
  assert.match(source, /FLIGHT_PLANNER_AUTH_RETURN_TTL_MS = 30 \* 60 \* 1000/);
  assert.match(source, /account_requirement_prompt_shown/);
  assert.match(source, /account_requirement_choice/);
  assert.match(source, /planner_draft_restored_after_auth/);
  assert.match(source, /intended_action: String\(parsed\?\.intendedAction \|\| "unknown"\)/);
  assert.match(source, /restored_step: restoredStep/);
  assert.match(source, /window\.location\.href = withReturnTo\(choice === "create_account" \? "\/register" : "\/login", "\/flight-planner"\)/);

  const analyticsBlocks = Array.from(source.matchAll(/trackEvent\("(account_requirement_prompt_shown|account_requirement_choice|planner_draft_restored_after_auth)"[\s\S]*?\}\);/g))
    .map((match) => match[0])
    .join("\n");
  assert.ok(analyticsBlocks.length > 0, "expected account requirement analytics");
  for (const forbidden of ["route:", "departure:", "destination:", "tailNumber", "pilotPhone", "pilotName", "filingDraft"]) {
    assert.equal(analyticsBlocks.includes(forbidden), false, `analytics must not include ${forbidden}`);
  }
});

test("flight planner first-use route flow removes scratch pad and assigns stable section ids", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");

  assert.doesNotMatch(source, /Scratch Pad|scratchPad|SCRATCH_PAD|ScratchField|ScratchPadInkBoard/);
  assert.match(source, /id="planner-route-summary"/);
  assert.match(source, /id="planner-route-setup"/);
  assert.match(source, /id="planner-field-departure"/);
  assert.match(source, /id="planner-field-destination"/);
  assert.match(source, /id="planner-route-method"/);
  assert.match(source, /id="planner-quick-references"/);

  const setupIndex = source.indexOf('id="planner-route-setup"');
  const refsIndex = source.indexOf('id="planner-quick-references"');
  assert.ok(setupIndex >= 0, "expected real route setup section");
  assert.ok(refsIndex >= 0, "expected quick references section");
  assert.ok(setupIndex > refsIndex || source.includes('"order-2"'), "references must render after primary route setup");

  const idMatches = Array.from(source.matchAll(/id="([^"]+)"/g)).map((match) => match[1]);
  const duplicates = idMatches.filter((id, index) => idMatches.indexOf(id) !== index);
  assert.equal(duplicates.includes("planner-route-setup"), false);
  assert.equal(duplicates.includes("planner-route-summary"), false);
});

test("flight planner removes stale quick route helper midpoint UI", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");

  assert.doesNotMatch(source, /Quick Route Helpers/);
  assert.doesNotMatch(source, /Add midpoint/);
  assert.doesNotMatch(source, /Planning helper waypoint/);
  assert.doesNotMatch(source, /setRouteSuggestion/);
  assert.doesNotMatch(source, /useState<"direct" \| "midpoint">/);
});

test("flight planner route summary is a semantic action targeting route setup focus", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");

  assert.match(source, /handleRouteSummaryAction/);
  assert.match(source, /planner_route_summary_action/);
  assert.match(source, /planner_route_setup_reached/);
  assert.match(source, /getRouteSetupFocusId/);
  assert.match(source, /return "planner-field-departure"/);
  assert.match(source, /return "planner-field-destination"/);
  assert.match(source, /return "planner-route-method"/);
  assert.match(source, /<button[\s\S]*aria-label=\{planningDepartureCode && planningDestinationCode \? "Edit route departure and destination" : "Start route by entering departure and destination"\}/);
  assert.match(source, /Start Route/);
  assert.match(source, /Edit Route/);
  assert.match(source, /Enter departure and destination/);
  assert.match(source, /handleRouteSummaryAction\("quick_jump"\)/);
});

test("flight planner phase two input clarity avoids operational-looking placeholders", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");

  assert.match(source, /Departure airport - Required/);
  assert.match(source, /Destination airport - Required/);
  assert.match(source, /Search airport name, city, FAA ID, or ICAO ID/);
  assert.match(source, /FAA location IDs such as 22T are supported/);
  assert.match(source, /Planned Altitude \(ft\) - Required/);
  assert.match(source, /Fuel On Board \(gal\) - Required/);
  assert.match(source, /Enter actual fuel aboard/);
  assert.match(source, /Override KTAS, e\.g\. 110/);
  assert.match(source, /Override burn, e\.g\. 8\.5/);
  assert.match(source, /Override usable fuel, e\.g\. 40/);
  assert.match(source, /Override max gross, e\.g\. 2400/);
  assert.doesNotMatch(source, /placeholder=\{String\(planningFuel\)\}/);
  assert.match(source, /planner_required_field_state/);
  assert.match(source, /planner_incomplete_analysis_shown/);
});

test("flight planner direct mode hides manual route text and files DCT", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");

  assert.match(source, /Route: Direct/);
  assert.match(source, /Filed enroute value:[\s\S]*DCT/);
  assert.match(source, /routeMode === "direct" \? \(/);
  assert.match(source, /Switch to Route Builder/);
  assert.match(source, /placeholder="Enter route, e\.g\. DCT TXK V18 MEM J42 ATL"/);
  assert.doesNotMatch(source, /readOnly=\{routeMode === "direct"\}/);
  assert.match(source, /planner_route_mode_change/);
});

test("airport identifier resolution supports FAA LIDs without arbitrary K-prefixing", () => {
  const plannerSource = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  const serverSource = readFileSync(resolve("server/routes.ts"), "utf8");

  assert.ok(serverSource.includes('if (/^[A-Z]{3}$/.test(normalized))'));
  assert.doesNotMatch(serverSource, /if \(normalized\.length === 3\)/);
  assert.match(plannerSource, /\/\^\[A-Z0-9\]\{3,4\}\$\/\.test\(value\)/);
  assert.doesNotMatch(plannerSource, /value\.length === 3 && ICAO_REGEX\.test\(value\)[\s\S]{0,80}setDepartureResolved\(value\)/);
  assert.doesNotMatch(plannerSource, /value\.length === 3 && ICAO_REGEX\.test\(value\)[\s\S]{0,80}setDestinationResolved\(value\)/);
  assert.match(plannerSource, /planner_airport_identifier_resolution/);
});

test("flight planner runway selector exposes all runway options with surface and dimensions", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  const serverSource = readFileSync(resolve("server/routes.ts"), "utf8");

  assert.match(serverSource, /const widthIdx = idx\("width_ft"\)/);
  assert.match(serverSource, /widthFt: row\[widthIdx\]/);
  assert.match(serverSource, /SUPPLEMENTAL_RUNWAYS/);
  assert.match(serverSource, /KARB:[\s\S]*leIdent: "12"[\s\S]*heIdent: "30"[\s\S]*surface: "TURF - FAIR"/);
  assert.match(serverSource, /getRunwaysForAirport\(runwayMap, requestedIcao\)/);
  assert.match(source, /widthFt\?: number \| null/);
  assert.match(source, /parts\.push\(`\$\{Math\.round\(widthFt\)\.toLocaleString\(\)\} ft wide`\)/);
  assert.match(source, /parts\.push\(normalizedSurface\)/);
  assert.match(source, /departureRunwayOptions\.map\(\(option\) =>/);
  assert.doesNotMatch(source, /departureRunwayOptions\.slice\(0, 6\)/);
  assert.match(source, /Selected runway surface is/);
  assert.match(source, /planner_runway_options_loaded/);
});

test("flight planner phase three TFR corridor overlay is wired into supported 2D maps", () => {
  const plannerSource = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  const typesSource = readFileSync(resolve("client/src/components/flight-planner/plannerMapTypes.ts"), "utf8");
  const leafletSource = readFileSync(resolve("client/src/components/flight-planner/PlannerMap.tsx"), "utf8");
  const mapLibreSource = readFileSync(resolve("client/src/components/flight-planner/MapLibrePlannerMap.tsx"), "utf8");

  assert.match(plannerSource, /const \[tfrCorridorNm, setTfrCorridorNm\] = useState\("10"\)/);
  assert.match(plannerSource, /<SelectItem value="5">5 NM<\/SelectItem>/);
  assert.match(plannerSource, /<SelectItem value="10">10 NM<\/SelectItem>/);
  assert.match(plannerSource, /<SelectItem value="25">25 NM<\/SelectItem>/);
  assert.match(plannerSource, /<SelectItem value="50">50 NM<\/SelectItem>/);
  assert.match(plannerSource, /filterTfrFeaturesForCorridor/);
  assert.match(plannerSource, /ringIntersectsRouteCorridor/);
  assert.match(plannerSource, /tfrOverlayStatus === "unavailable"/);
  assert.match(plannerSource, /TFR corridor check completed with no relevant TFRs/);
  assert.match(typesSource, /tfrFeatures\?: PlannerTfrFeature\[\]/);
  assert.match(leafletSource, /<GeoJSON/);
  assert.match(leafletSource, /showTfrOverlay && tfrFeatures\.length > 0/);
  assert.match(mapLibreSource, /TFR_SOURCE_ID/);
  assert.match(mapLibreSource, /TFR_FILL_LAYER_ID/);
  assert.match(mapLibreSource, /TFR_LINE_LAYER_ID/);
});

test("flight planner phase three route winds use calculated component with explicit manual override", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");

  assert.match(source, /calculateWindComponentKt/);
  assert.match(source, /calculateRouteWindComponent/);
  assert.match(source, /distance_weighted/);
  assert.match(source, /const \[manualWindOverrideEnabled, setManualWindOverrideEnabled\] = useState\(false\)/);
  assert.match(source, /const rawManualWindValue = Number\(headwind \|\| 0\)/);
  assert.match(source, /const manualWindValue = Number\.isFinite\(rawManualWindValue\) \? rawManualWindValue : 0/);
  assert.match(source, /const calculatedWindComponentKt = Number\.isFinite\(calculatedRouteWind\.componentKt\)/);
  assert.match(source, /const selectedWindComponentKt = manualWindOverrideEnabled \? manualWindValue : calculatedWindComponentKt/);
  assert.match(source, /const groundspeed = Math\.max\(40, planningCruise - selectedWindComponentKt\)/);
  assert.match(source, /Route wind component/);
  assert.match(source, /Override winds/);
  assert.match(source, /Use calculated winds/);
  assert.doesNotMatch(source, /<Label>Avg Headwind \(kt\)<\/Label>/);
});

test("flight planner route mode and route controls appear before aircraft setup", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  const routeModeIndex = source.indexOf('id="planner-route-method"');
  const routeAssistIndex = source.indexOf("Route Assist Waypoints (optional)");
  const aircraftSetupIndex = source.indexOf('id="planner-aircraft-setup"');

  assert.ok(routeModeIndex > 0, "route mode exists");
  assert.ok(routeAssistIndex > routeModeIndex, "route assist helpers are after route mode");
  assert.ok(aircraftSetupIndex > routeAssistIndex, "aircraft setup is after route controls");
});

test("flight planner keeps schedule fields above airports and alternate below runway", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  const routeSetupIndex = source.indexOf('id="planner-route-setup"');
  const plannedDepartureIndex = source.indexOf("<Label>Planned Departure</Label>", routeSetupIndex);
  const departureAirportIndex = source.indexOf("<Label>Departure airport - Required</Label>", routeSetupIndex);
  const departureRunwayIndex = source.indexOf("<Label>Departure runway (optional)</Label>", routeSetupIndex);
  const alternateIndex = source.indexOf("<Label>Alternate airport (optional)</Label>", routeSetupIndex);
  const routeModeIndex = source.indexOf('id="planner-route-method"', routeSetupIndex);

  assert.ok(plannedDepartureIndex > routeSetupIndex, "planned departure appears in route setup");
  assert.ok(plannedDepartureIndex < departureAirportIndex, "planned departure is above airport selection");
  assert.ok(alternateIndex > departureRunwayIndex, "alternate is below departure runway");
  assert.ok(alternateIndex < routeModeIndex, "alternate remains before route construction controls");
  assert.match(source, /xl:grid-cols-5/);
  assert.match(source, /Override winds/);
});

test("flight planner gates downstream alternate weather on resolved airport identity", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  assert.match(source, /const \[alternateResolved, setAlternateResolved\] = useState\(""\)/);
  assert.match(source, /airportSearchResultMatchesIdentifier/);
  assert.match(source, /const planningAlternateCode = filedAlternateCode === "ZZZZ"[\s\S]*: alternateResolved\.trim\(\)\.toUpperCase\(\)/);
  assert.match(source, /planner_airport_identifier_resolution[\s\S]*field: "alternate"/);
});

test("flight planner exposes route options with preview before apply", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  assert.match(source, /IFR Route Options/);
  assert.match(source, /Provider Recommended Route/);
  assert.match(source, /not a current ATC clearance/);
  assert.match(source, /const \[routeOptionPreview, setRouteOptionPreview\]/);
  assert.match(source, /Route option preview/);
  assert.match(source, /Apply previewed route/);
  assert.match(source, /setRouteOptionPreview\(route\)/);
});

test("flight planner shows honest procedure availability and alternate fuel breakdown", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  assert.match(source, /Departure Procedure \(SID\) \/ Arrival Procedure \(STAR\)/);
  assert.match(source, /Structured SID\/STAR selection is not available/);
  assert.match(source, /Destination to alternate/);
  assert.match(source, /Alternate fuel unavailable/);
  assert.match(source, /totalFuelIncludesAlternate/);
  assert.match(source, /Awaiting alternate/);
  assert.match(source, /Planning estimate only/);
});

test("flight planner weather briefing labels route roles and partial data honestly", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  assert.match(source, /weatherRoleLabel/);
  assert.match(source, /Departure weather/);
  assert.match(source, /Destination weather/);
  assert.match(source, /Alternate weather/);
  assert.match(source, /Advisory planning context, not a complete official briefing/);
  assert.match(source, /Missing METAR\/TAF data is shown as unavailable, not assumed VFR/);
});

test("flight planner shows cruise altitude practicality as a non-blocking advisory", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  assert.match(source, /assessCruiseAltitudePracticality/);
  assert.match(source, /altitudePracticalityDialogOpen/);
  assert.match(source, /Cruise altitude practicality/);
  assert.match(source, /View estimate/);
  assert.match(source, /setAltitudePracticalityDialogOpen\(true\)/);
  assert.match(source, /setAltitudePracticalityDialogOpen\(false\)/);
  assert.match(source, /Unable to assess/);
  assert.match(source, /This advisory is not a filing blocker/);
  assert.match(source, /does not change ETE, fuel endurance, filing readiness, or the filed altitude/);
  assert.match(source, /planner_cruise_altitude_practicality/);
  assert.doesNotMatch(source, /<details className="mt-2">/);
  assert.doesNotMatch(source, /addIssue\([^)]*cruiseAltitudePracticality/);
  assert.doesNotMatch(source, /filingPacket[\s\S]{0,500}cruiseAltitudePracticality/);
});

test("flight planner keeps lifecycle action labels present after altitude advisory addition", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  assert.match(source, /Save Changes/);
  assert.match(source, /action: "activate"/);
  assert.match(source, /action: "close"/);
  assert.match(source, /action: "cancel"/);
  assert.match(source, /submitProviderSync/);
  assert.match(source, /acceptProviderReviewMutation/);
});

test("flight planner preserves newer provider sync state during stale query merges", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  assert.match(source, /const mergePlanPreservingNewerProviderState = \(currentPlan: FlightPlan, nextPlan: FlightPlan\): FlightPlan =>/);
  assert.match(source, /compareProviderMergeFreshness\(currentPlan, nextPlan\) <= 0/);
  assert.match(source, /filingProviderSnapshot: currentPlan\.filingProviderSnapshot/);
  assert.match(source, /filingProviderMessages: currentPlan\.filingProviderMessages/);
  assert.match(source, /filingActionHistory: currentPlan\.filingActionHistory/);
  assert.match(source, /route: currentPlan\.route/);
  assert.match(source, /alternate: currentPlan\.alternate/);
  assert.match(source, /filingOtherInfo: currentPlan\.filingOtherInfo/);
  assert.match(source, /filingPlannedAltitudeFt: currentPlan\.filingPlannedAltitudeFt/);
  assert.match(source, /mergePlanPreservingNewerProviderState\(plan, nextPlan\)/);
  assert.match(source, /mergePlanPreservingNewerProviderState\(current, refreshedPlan\)/);
});

test("flight planner timezone lookup falls back to typed filed airport while async resolution settles", () => {
  const source = readFileSync(resolve("client/src/pages/flight-planner.tsx"), "utf8");
  const departureBlock = source.slice(
    source.indexOf("const departureTimeZone = useMemo(() => {"),
    source.indexOf("const destinationTimeZone = useMemo(() => {"),
  );
  const destinationBlock = source.slice(
    source.indexOf("const destinationTimeZone = useMemo(() => {"),
    source.indexOf("const plannedDepartureUtc = useMemo(() => {"),
  );

  assert.match(departureBlock, /const departureCodeForTimezone = planningDepartureCode \|\| filedDepartureCode/);
  assert.match(departureBlock, /airportForTimezoneResolution\(departureCodeForTimezone, departureAirport\)/);
  assert.match(departureBlock, /\[airportMap, filedDepartureCode, planningDepartureCode, planningReferenceDepartureAirport\]/);
  assert.match(destinationBlock, /const destinationCodeForTimezone = planningDestinationCode \|\| filedDestinationCode/);
  assert.match(destinationBlock, /airportForTimezoneResolution\(destinationCodeForTimezone, airport\)/);
  assert.match(destinationBlock, /\[airportMap, filedDestinationCode, planningDestinationCode\]/);
});
