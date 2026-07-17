import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const plannerSource = readFileSync("client/src/pages/flight-planner.tsx", "utf8");
const actionsSource = readFileSync("client/src/components/flight-planner/FlightPlanLifecycleActions.tsx", "utf8");
const queryClientSource = readFileSync("client/src/lib/queryClient.ts", "utf8");
const routesSource = readFileSync("server/routes.ts", "utf8");

test("LAB acknowledgement-required responses are stable structured prerequisite failures", () => {
  assert.match(routesSource, /sendFlightServiceLabAcknowledgementRequired/);
  assert.match(routesSource, /status\(428\)/);
  assert.match(routesSource, /code: "LAB_ACKNOWLEDGEMENT_REQUIRED"/);
  assert.match(routesSource, /reason: "missing_lab_acknowledgement"/);
  assert.match(routesSource, /retryable: false/);
  assert.match(routesSource, /operatorActionRequired: true/);
  assert.doesNotMatch(routesSource, /code: "FLIGHT_SERVICE_TEST_ACK_REQUIRED"/);
});

test("final LAB authorization logging does not report authorized true before missing acknowledgement rejection", () => {
  const actionStart = routesSource.indexOf('/api/flight-plans/:id/filing-action');
  const actionEnd = routesSource.indexOf("const actionProviderSnapshot");
  const syncStart = routesSource.indexOf('/api/flight-plans/:id/filing-sync');
  const syncEnd = routesSource.indexOf("const syncResult = await syncLeidosPlanMetadata", syncStart);
  assert.ok(actionStart >= 0 && actionEnd > actionStart);
  assert.ok(syncStart >= 0 && syncEnd > syncStart);
  const actionRoute = routesSource.slice(actionStart, actionEnd);
  const syncRoute = routesSource.slice(syncStart, syncEnd);

  assert.match(actionRoute, /if \(!acknowledgementAccepted\)[\s\S]*authorized: false[\s\S]*sendFlightServiceLabAcknowledgementRequired/);
  assert.match(syncRoute, /if \(!acknowledgementAccepted\)[\s\S]*authorized: false[\s\S]*sendFlightServiceLabAcknowledgementRequired/);
  assert.doesNotMatch(actionRoute, /authorized: true[\s\S]*if \(!acknowledgementAccepted\)/);
  assert.doesNotMatch(syncRoute, /authorized: true[\s\S]*if \(!acknowledgementAccepted\)/);
});

test("apiRequest preserves safe response metadata for client retry classification", () => {
  assert.match(queryClientSource, /error\.status = res\.status/);
  assert.match(queryClientSource, /error\.code = record\.code/);
  assert.match(queryClientSource, /error\.reason = record\.reason/);
  assert.match(queryClientSource, /error\.retryable = record\.retryable/);
  assert.match(queryClientSource, /error\.operatorActionRequired = record\.operatorActionRequired/);
});

test("background sync pauses after LAB acknowledgement failure and deduplicates in-flight requests", () => {
  assert.match(plannerSource, /type LabAcknowledgementBlockedSync/);
  assert.match(plannerSource, /const \[labAcknowledgementBlockedSync, setLabAcknowledgementBlockedSync\]/);
  assert.match(plannerSource, /backgroundSyncInFlightRef = useRef<Set<string>>\(new Set\(\)\)/);
  assert.match(plannerSource, /labAcknowledgementBlockedSync\[plan\.id\]\?\.acknowledgementGeneration !== acknowledgementGeneration/);
  assert.match(plannerSource, /backgroundSyncInFlightRef\.current\.has\(plan\.id\)/);
  assert.match(plannerSource, /isLabAcknowledgementRequiredError\(error\)[\s\S]*setLabAcknowledgementBlockedSync/);
  assert.match(plannerSource, /Background sync should not interrupt planner work/);
});

test("manual sync and provider actions do not call provider endpoints while acknowledgement is blocked", () => {
  assert.match(plannerSource, /Provider synchronization remains paused until the LAB acknowledgement is renewed/);
  assert.match(plannerSource, /Provider actions remain paused until the LAB acknowledgement is renewed/);
  assert.match(plannerSource, /Renew acknowledgement and refresh status/);
  assert.match(plannerSource, /setLabAcknowledgementBlockedSync\(\{\}\)/);
  assert.match(actionsSource, /providerActionsPausedReason/);
  assert.match(actionsSource, /providerActionsPaused/);
  assert.match(actionsSource, /disabled=\{actionPending \|\| syncPending \|\| providerActionsPaused/);
});

test("webhook endpoint remains independent of user-facing LAB acknowledgement gate", () => {
  const webhookStart = routesSource.indexOf('app.post("/api/leidos/webhooks/flight-service"');
  const webhookEnd = routesSource.indexOf('app.post("/api/flight-plans/:id/filing-action"', webhookStart);
  assert.ok(webhookStart >= 0 && webhookEnd > webhookStart);
  const webhookRoute = routesSource.slice(webhookStart, webhookEnd);
  assert.match(webhookRoute, /verifyLeidosWebhookAuthorization/);
  assert.match(webhookRoute, /extractLeidosWebhookFields/);
  assert.match(webhookRoute, /normalizedPushLifecycle/);
  assert.match(webhookRoute, /providerLifecycleStatus/);
  assert.doesNotMatch(webhookRoute, /hasFlightServiceTestAcknowledgement/);
  assert.doesNotMatch(webhookRoute, /sendFlightServiceLabAcknowledgementRequired/);
});
