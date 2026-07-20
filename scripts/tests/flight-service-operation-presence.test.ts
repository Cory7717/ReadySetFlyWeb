import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schemaSource = readFileSync("shared/schema.ts", "utf8");
const providerSource = readFileSync("server/services/flight-plan-filing/provider.ts", "utf8");
const routesSource = readFileSync("server/routes.ts", "utf8");
const plannerSource = readFileSync("client/src/pages/flight-planner.tsx", "utf8");
const lifecycleActionsSource = readFileSync("client/src/components/flight-planner/FlightPlanLifecycleActions.tsx", "utf8");
const liveLabRunnerSource = readFileSync("tests/flight-service/leidos-live-lab/live-lab-runner.ts", "utf8");

const providerActions = ["file", "amend", "activate", "cancel", "close"] as const;

test("flight-service provider actions remain present across schema, UI, API, provider adapter, and certification runner", () => {
  assert.match(schemaSource, /flightPlanFilingActions\s*=\s*\[[^\]]*"file"[^\]]*"amend"[^\]]*"activate"[^\]]*"cancel"[^\]]*"close"/s);
  assert.match(providerSource, /interface FlightPlanFilingProvider[\s\S]*stageAction\(plan: FlightPlan, action: FlightPlanFilingAction\)/);
  assert.match(routesSource, /app\.post\("\/api\/flight-plans\/:id\/filing-action",\s*isAuthenticated/);
  assert.match(routesSource, /action:\s*z\.enum\(flightPlanFilingActions\)/);
  assert.match(routesSource, /const parsed = filingLifecycleActionSchema\.safeParse\(req\.body \?\? \{\}\)/);
  assert.match(routesSource, /flightPlanFilingProvider\.stageAction\(effectivePlanForAction, action\)/);
  assert.match(plannerSource, /type FilingActionName = "file" \| "amend" \| "activate" \| "cancel" \| "close"/);
  assert.match(plannerSource, /apiRequest\("POST", `\/api\/flight-plans\/\$\{planId\}\/filing-action`, body\)/);
  assert.match(liveLabRunnerSource, /export type CaseAction = FlightPlanFilingAction/);
  assert.match(liveLabRunnerSource, /actions:\s*\["file", "activate", "close"\]/);
  assert.match(liveLabRunnerSource, /actions:\s*\["file", "amend", "cancel"\]/);

  for (const action of providerActions) {
    assert.match(providerSource, new RegExp(`${action}: normalizePath\\(process\\.env\\.LEIDOS_FLIGHT_SERVICE_${action.toUpperCase()}_PATH\\)`));
    assert.match(providerSource, new RegExp(`if \\(action === "${action}"|action === "${action}"|case "${action}"`));
    assert.match(plannerSource, new RegExp(`action: "${action}"`));
    assert.match(lifecycleActionsSource, new RegExp(`\\b${action}\\b`, "i"));
    assert.match(liveLabRunnerSource, new RegExp(`"${action}"`));
  }
});

test("required Leidos REST paths and retrieve/sync plumbing remain present", () => {
  assert.match(providerSource, /file:\s*normalizePath\(process\.env\.LEIDOS_FLIGHT_SERVICE_FILE_PATH\)/);
  assert.match(providerSource, /retrievePath:\s*normalizePath\(process\.env\.LEIDOS_FLIGHT_SERVICE_RETRIEVE_PATH\) \|\| "FP\/\{providerPlanId\}\/retrieve"/);
  assert.match(providerSource, /actionPaths\[action\]/);
  assert.match(providerSource, /resolveValidatedActionPath\(config, actionPath, effectivePlan, action\)/);
  assert.match(providerSource, /url\.searchParams\.set\('versionRequested', '20240801'\)/);
  assert.match(providerSource, /buildLeidosActionPayload\(effectivePlan, action, config\)/);
  assert.match(providerSource, /append\("includeCodedMessages", "true"\)/);
  assert.match(routesSource, /syncLeidosPlanMetadata\(updated as any\)/);
  assert.match(routesSource, /persistLeidosProviderSync\(updated as any, postActionSync\)/);
  assert.match(routesSource, /providerPendingReview/);
});

test("flight-planner lifecycle controls are not hard-suppressed", () => {
  const combinedUi = `${plannerSource}\n${lifecycleActionsSource}`;
  assert.doesNotMatch(combinedUi, /false\s*&&[\s\S]{0,180}(Amend|Activate|Cancel|Close|Sync|Provider updates|Accept Provider Changes)/i);
  assert.doesNotMatch(combinedUi, /Boolean\(false\)[\s\S]{0,180}(Amend|Activate|Cancel|Close|Sync|Provider updates|Accept Provider Changes)/i);
  for (const label of [
    "File Flight Plan",
    "Amend",
    "Activate",
    "Cancel",
    "Close",
    "Provider updates",
    "Accept Provider Changes",
    "Download Filing Summary",
  ]) {
    assert.match(combinedUi, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("route assist remains optional and cannot be a filing prerequisite", () => {
  const submitBlock = plannerSource.slice(plannerSource.indexOf("const submitFilingAction"), plannerSource.indexOf("const requestSaveCurrentPlanWithFilingAction"));
  assert.doesNotMatch(submitBlock, /leidosRouteQuery|routeAssist|Route Assist/i);
  const saveBlock = plannerSource.slice(plannerSource.indexOf("const saveCurrentPlan"), plannerSource.indexOf("const logFilingReadinessFailure"));
  assert.doesNotMatch(saveBlock, /leidosRouteQuery\.data\?\.available === false/);
  assert.match(plannerSource, /No Route Assist suggestions came back for this city pair yet/);
});

test("diagnostic sanitization occurs after provider response operational extraction", () => {
  const responseIndex = providerSource.indexOf("const parsedResponse = await parseProviderResponse(response)");
  const snapshotIndex = providerSource.indexOf("const providerSnapshot = buildProviderSnapshot", responseIndex);
  const messagesIndex = providerSource.indexOf("const providerMessages = buildProviderMessages", responseIndex);
  const rawSanitizerIndex = providerSource.indexOf("const raw = sanitizeProviderDiagnosticRecordForPersistence", responseIndex);
  assert.ok(responseIndex > 0);
  assert.ok(snapshotIndex > responseIndex);
  assert.ok(messagesIndex > snapshotIndex);
  assert.ok(rawSanitizerIndex > messagesIndex, "diagnostic sanitizer must run after operational extraction");
});
