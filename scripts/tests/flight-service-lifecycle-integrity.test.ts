import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const routes = readFileSync("server/routes.ts", "utf8");
const schema = readFileSync("shared/schema.ts", "utf8");
const provider = readFileSync("server/services/flight-plan-filing/provider.ts", "utf8");
const migration = readFileSync("migrations/0114_add_flight_service_provider_action_attempts.sql", "utf8");
const packageJson = readFileSync("package.json", "utf8");

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

test("webhook lifecycle persistence happens before notification and push side effects", () => {
  const webhookRoute = routes.slice(routes.indexOf('app.post("/api/leidos/webhooks/flight-service"'));
  const persistenceIndex = webhookRoute.indexOf("storage.updateFlightPlan(matchedPlan.id");
  const notificationIndex = webhookRoute.lastIndexOf("providerPushNotification = await storage.createUserNotification");
  const expoIndex = webhookRoute.lastIndexOf('fetch("https://exp.host/--/api/v2/push/send"');
  assert.ok(persistenceIndex > 0, "webhook should persist canonical state");
  assert.ok(notificationIndex > persistenceIndex, "notification should be created after persistence");
  assert.ok(expoIndex > notificationIndex, "Expo push should happen after notification creation");
  assert.match(webhookRoute, /leidos_push_expo_delivery_failed/);
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
