import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFlightServiceOpsDetail,
  buildFlightServiceOpsSearchResult,
  buildFlightServiceSarReport,
  FLIGHT_SERVICE_OPS_RETENTION_NOTICE,
} from "../../server/services/flightServiceOpsConsole";

const routes = readFileSync("server/routes.ts", "utf8");
const schema = readFileSync("shared/schema.ts", "utf8");
const provider = readFileSync("server/services/flight-plan-filing/provider.ts", "utf8");
const migration = readFileSync("migrations/0114_add_flight_service_provider_action_attempts.sql", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const opsConsole = readFileSync("server/services/flightServiceOpsConsole.ts", "utf8");

test("public flight-plan mutations reject provider-owned lifecycle fields", () => {
  for (const field of [
    "filingStatus",
    "filingProviderPlanId",
    "filingProviderSnapshot",
    "filingRaw",
    "filingActionHistory",
    "filedAt",
    "activatedAt",
    "cancelledAt",
    "closedAt",
    "versionStamp",
  ]) {
    assert.match(routes, new RegExp(`"${field}"`));
  }
  assert.match(routes, /rejectPublicFlightPlanProviderFields\(payload\)/);
  assert.match(routes, /publicFlightPlanCreateSchema\.safeParse\(payload\)/);
  assert.match(routes, /publicFlightPlanPatchSchema\.safeParse\(payload\)/);
  assert.doesNotMatch(routes, /const result = insertFlightPlanSchema\.safeParse\(payload\)/);
  assert.doesNotMatch(routes, /const result = insertFlightPlanSchema\.partial\(\)\.safeParse\(payload\)/);
});

test("provider action attempts have durable active-action and idempotency indexes", () => {
  assert.match(schema, /flightServiceProviderActionAttempts/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS flight_service_provider_action_attempts/);
  assert.match(migration, /idx_flight_service_provider_action_attempts_key/);
  assert.match(migration, /WHERE idempotency_key IS NOT NULL/);
  assert.match(migration, /idx_flight_service_provider_action_attempts_active_action/);
  assert.match(migration, /WHERE status IN \('pending', 'dispatched', 'provider-outcome-unknown'\)/);
});

test("filing action route reserves attempts before provider dispatch and replays completed keys", () => {
  const reservationIndex = routes.indexOf("reserveFlightServiceProviderActionAttempt");
  const dispatchIndex = routes.indexOf("flightPlanFilingProvider.stageAction");
  assert.ok(reservationIndex > 0, "route should reserve a durable provider action attempt");
  assert.ok(dispatchIndex > reservationIndex, "provider dispatch must happen after durable reservation");
  assert.match(routes, /FLIGHT_SERVICE_IDEMPOTENCY_KEY_CONFLICT/);
  assert.match(routes, /idempotentReplay:\s*true/);
  assert.match(routes, /FLIGHT_SERVICE_ACTION_IN_PROGRESS/);
});

test("ambiguous dispatched provider failures are marked outcome unknown and blind retries are blocked", () => {
  assert.match(schema, /"provider-outcome-unknown"/);
  assert.match(routes, /status:\s*"provider-outcome-unknown"/);
  assert.match(routes, /FLIGHT_SERVICE_PROVIDER_OUTCOME_UNKNOWN/);
  assert.match(routes, /provider_timeout_after_dispatch|provider_transport_or_parse_error_after_dispatch/);
  assert.match(routes, /provider_accepted_without_flight_identifier/);
});

test("local payload validation failures are classified before dispatch", () => {
  assert.match(provider, /class LeidosPreDispatchValidationError/);
  assert.match(provider, /providerRequestDispatched = false/);
  assert.match(routes, /error instanceof LeidosPreDispatchValidationError/);
  assert.match(routes, /status:\s*"failed-before-dispatch"/);
  assert.match(routes, /statusReason:\s*"local_validation_failed_before_dispatch"/);
  assert.match(routes, /dispatchedAt:\s*null/);
  assert.match(routes, /FLIGHT_SERVICE_LOCAL_VALIDATION_FAILED/);
});

test("manual provider sync uses retrieve persistence and never resubmits a filing action", () => {
  const syncRoute = routes.slice(
    routes.indexOf('"/api/flight-plans/:id/filing-sync"'),
    routes.indexOf('"/api/flight-plans/:id/provider-review/accept"'),
  );
  assert.match(syncRoute, /syncLeidosPlanMetadata\(plan as any\)/);
  assert.match(syncRoute, /persistLeidosProviderSync/);
  assert.match(routes, /filingLastProviderSyncAt:\s*now/);
  assert.doesNotMatch(syncRoute, /flightPlanFilingProvider\.stageAction/);
});

test("provider acknowledgement is local-only and leaves provider lifecycle transport untouched", () => {
  const acceptRoute = routes.slice(
    routes.indexOf('"/api/flight-plans/:id/provider-review/accept"'),
    routes.indexOf('app.get("/api/flight-plans"'),
  );
  assert.match(acceptRoute, /providerAcknowledgedMessageId/);
  assert.match(acceptRoute, /isRead:\s*true/);
  assert.doesNotMatch(acceptRoute, /syncLeidosPlanMetadata/);
  assert.doesNotMatch(acceptRoute, /persistLeidosProviderSync/);
  assert.doesNotMatch(acceptRoute, /flightPlanFilingProvider\.stageAction/);
  assert.doesNotMatch(acceptRoute, /filingLastProviderSyncAt/);
});

test("webhook provider notifications are explicitly created unacknowledged", () => {
  const webhookRoute = routes.slice(
    routes.indexOf('app.post("/api/leidos/webhooks/flight-service"'),
    routes.indexOf('"/api/flight-plans/:id/filing-action"'),
  );
  assert.match(
    webhookRoute,
    /providerPushNotification = await storage\.createUserNotification\([\s\S]*?isRead:\s*false[\s\S]*?readAt:\s*null/,
  );
});

test("webhook synchronization retrieves only the affected provider plan", () => {
  const webhookRoute = routes.slice(
    routes.indexOf('app.post("/api/leidos/webhooks/flight-service"'),
    routes.indexOf('"/api/flight-plans/:id/filing-action"'),
  );
  assert.match(webhookRoute, /eq\(flightPlans\.filingProviderPlanId, flightIdentifier\)/);
  assert.match(webhookRoute, /const webhookSyncResult = await syncLeidosPlanMetadata\(\s*matchedPlan as any,?\s*\)/);
  assert.match(webhookRoute, /persistLeidosProviderSync\(\s*matchedPlan as any,/);
  assert.match(webhookRoute, /const syncResult = webhookSyncResult/);
  assert.doesNotMatch(webhookRoute, /for \(const .*flightPlans/);
  const reservationIndex = webhookRoute.indexOf("reserveLeidosWebhookEvent");
  const duplicateReturnIndex = webhookRoute.indexOf("leidos_webhook_duplicate_ignored");
  const retrieveIndex = webhookRoute.indexOf("const webhookSyncResult = await syncLeidosPlanMetadata");
  assert.ok(reservationIndex >= 0 && duplicateReturnIndex > reservationIndex);
  assert.ok(retrieveIndex > duplicateReturnIndex, "duplicate deliveries must return before provider retrieval");
});

test("continuous provider polling is replaced by targeted failed-webhook recovery", () => {
  const planner = readFileSync("client/src/pages/flight-planner.tsx", "utf8");
  assert.doesNotMatch(planner, /activeTab === "file" \? 15_000 : false/);
  assert.match(planner, /providerWebhookRetrievalPending === true/);
  assert.match(planner, /setInterval\(poll, 5 \* 60_000\)/);
  assert.match(routes, /providerWebhookRetrievalPending:\s*true/);
  assert.match(routes, /providerWebhookRetrievalPending:\s*false/);
});

test("post-action reconciliation remains enabled for every filing lifecycle action", () => {
  const actionRoute = routes.slice(
    routes.indexOf('"/api/flight-plans/:id/filing-action"'),
    routes.indexOf('"/api/flight-plans/:id/filing-sync"'),
  );
  for (const action of ["file", "amend", "activate", "cancel", "close"]) {
    assert.match(actionRoute, new RegExp(`"${action}"`));
  }
  assert.match(actionRoute, /const postActionSync = await syncLeidosPlanMetadata\(updated as any\)/);
  assert.match(actionRoute, /persistLeidosProviderSync/);
});

test("webhook lifecycle persistence happens before notification and push side effects", () => {
  const webhookRoute = routes.slice(routes.indexOf('app.post("/api/leidos/webhooks/flight-service"'));
  const persistenceIndex = webhookRoute.indexOf("storage.updateFlightPlan(matchedPlan.id");
  const notificationIndex = webhookRoute.lastIndexOf("providerPushNotification = await storage.createUserNotification");
  const expoIndex = webhookRoute.lastIndexOf('fetch("https://exp.host/--/api/v2/push/send"');
  assert.ok(persistenceIndex > 0, "webhook should persist canonical state");
  assert.ok(notificationIndex > persistenceIndex, "notification should be created after persistence");
  assert.ok(expoIndex > notificationIndex, "Expo push should happen after notification creation");
  assert.match(webhookRoute, /leidos_push_expo_delivery_failed/);
  assert.doesNotMatch(webhookRoute, /\/\*\s*providerPushNotification = await storage\.createUserNotification/);
});

test("webhook ordering guard prevents terminal regression and lower version overwrite", () => {
  assert.match(routes, /applyProviderWebhookOrderingGuard/);
  assert.match(routes, /lower_version_stamp/);
  assert.match(routes, /terminal_state_regression/);
  assert.match(routes, /stale_lower_version_ignored/);
  assert.match(routes, /terminal_state_regression_ignored/);
});

test("stored diagnostics avoid raw provider request payloads and raw webhook payloads", () => {
  assert.doesNotMatch(provider, /requestPayload:\s*requestPayloadRecord/);
  assert.match(provider, /otherInfoGenerated:\s*requestPayloadRecord\.otherInfo \? "\[redacted\]"/);
  assert.doesNotMatch(routes, /raw:\s*payload/);
  assert.match(routes, /payloadSummary:\s*safeWebhookPayloadSummary/);
});

test("non-writing flight-service release gate includes adjacent omitted tests", () => {
  assert.match(packageJson, /"test:flight-service:release"/);
  for (const filename of [
    "flight-planner-route-geometry.test.ts",
    "flight-plan-access.test.ts",
    "flight-filing-readiness-messages.test.ts",
    "route-builder-navaids.test.ts",
    "route-weather-tokens.test.ts",
  ]) {
    assert.match(packageJson, new RegExp(filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(packageJson.match(/"test:flight-service:release":\s*"([^"]+)"/)?.[1] || "", /certification:flight-service|certification:leidos-live-lab/);
});

test("Ops and SAR reports use explicit support, retention, and local time fields", () => {
  const plan = {
    id: "plan-1",
    userId: "user-1",
    title: "Test",
    departure: "KBOS",
    destination: "KSEA",
    route: "ALB DCT BOI",
    plannedDepartureAt: new Date("2026-07-13T15:00:00.000Z"),
    plannedArrivalAt: new Date("2026-07-13T21:00:00.000Z"),
    tailNumber: "N12345",
    filingProvider: "leidos_flight_service",
    filingProviderPlanId: "provider-1",
    filingStatus: "filed",
    filingActionHistory: [],
    filingProviderMessages: [],
    filingProviderSnapshot: {},
    plannerState: {
      userDisplayDepartureTimeLocal: "2026-07-13T11:00",
      departureTimeZone: "America/New_York",
      userDisplayArrivalTimeLocal: "2026-07-13T14:00",
      destinationTimeZone: "America/Los_Angeles",
      emergencyContactName: "Dispatch",
      emergencyContactPhone: "555-0100",
    },
    createdAt: new Date("2026-07-13T14:00:00.000Z"),
    updatedAt: new Date("2026-07-13T14:05:00.000Z"),
  } as any;

  const searchResult = buildFlightServiceOpsSearchResult(plan, { email: "pilot@example.com" });
  assert.equal(searchResult.etdZulu, "2026-07-13T15:00:00.000Z");
  assert.equal(searchResult.etdLocal, "2026-07-13T11:00 America/New_York");

  const detail = buildFlightServiceOpsDetail(plan, { email: "pilot@example.com" } as any);
  assert.equal(detail.retentionNotice, FLIGHT_SERVICE_OPS_RETENTION_NOTICE);
  assert.equal(detail.summary.etdLocal, "2026-07-13T11:00 America/New_York");
  assert.equal(detail.summary.etaLocal, "2026-07-13T14:00 America/Los_Angeles");
  assert.equal(detail.pilot.secondaryEmergencyContact, "Dispatch / 555-0100");

  const sar = buildFlightServiceSarReport(plan, { email: "pilot@example.com" } as any);
  assert.notEqual(sar.supportContact, "RSF support contact placeholder");
  assert.equal(sar.plan.retentionNotice, FLIGHT_SERVICE_OPS_RETENTION_NOTICE);
});

test("WSDL drift checker is available but not part of the non-live release gate", () => {
  const wsdlScript = readFileSync("scripts/check-leidos-wsdl.mjs", "utf8");
  assert.match(packageJson, /"flight-service:wsdl-check":\s*"node scripts\/check-leidos-wsdl\.mjs"/);
  assert.match(wsdlScript, /ffspelabs\.leidos\.com\/Website2\/resources\/doc\/WebService\.xml/);
  assert.match(wsdlScript, /www\.1800wxbrief\.com\/Website\/resources\/doc\/WebService\.xml/);
  assert.match(wsdlScript, /LEIDOS_WSDL_EXPECTED_SHA256/);
  assert.match(wsdlScript, /crossEnvironmentDrift/);
  assert.doesNotMatch(packageJson.match(/"test:flight-service:release":\s*"([^"]+)"/)?.[1] || "", /wsdl-check/);
  assert.doesNotMatch(opsConsole, /TODO: Confirm Flight Service operational support retention period|RSF support contact placeholder/);
});
