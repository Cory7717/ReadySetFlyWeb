import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const routesSource = readFileSync("server/routes.ts", "utf8");

test("Flight Service tester gate logs safe structured diagnostics before rejection", () => {
  assert.match(routesSource, /event: "flight_service_auth_gate_debug"/);
  assert.match(routesSource, /testerEmailsConfigured: args\.testerEmails\.size > 0/);
  assert.match(routesSource, /testerEmailCount: args\.testerEmails\.size/);
  assert.match(routesSource, /testerEmailMatch: args\.testerEmailMatch/);
  assert.match(routesSource, /flightServiceEnvironment: args\.runtimeMode\.environment/);
  assert.match(routesSource, /flightFilingOperationalEnabled: args\.runtimeMode\.operationalFilingEnabled/);
  assert.match(routesSource, /leidosLabSubmissionEnabled:/);
  assert.match(routesSource, /validationOnlyMode: !args\.runtimeMode\.operationalFilingEnabled/);
  assert.match(routesSource, /labAcknowledgementAccepted: args\.acknowledgementAccepted/);
  assert.match(routesSource, /subscriptionTier: entitlements\.tier/);
  assert.match(routesSource, /activeOpenFlightPlanCount/);
  assert.match(routesSource, /rejectionReason: args\.rejectionReason/);
});

test("Flight Service tester email comparison uses normalized auth and database email candidates", () => {
  assert.match(routesSource, /const normalizeFlightServiceTesterEmail = \(value: unknown\) =>/);
  assert.match(routesSource, /process\.env\.FLIGHT_SERVICE_TESTER_EMAILS/);
  assert.match(routesSource, /\.split\(","\)/);
  assert.match(routesSource, /\.map\(normalizeFlightServiceTesterEmail\)/);
  assert.match(routesSource, /user\?\.email/);
  assert.match(routesSource, /req\.user\?\.claims\?\.email/);
  assert.match(routesSource, /req\.auth\?\.email/);
  assert.match(routesSource, /req\.auth\?\.token\?\.email/);
  assert.match(routesSource, /testerEmailMatch = Boolean\(normalizedUserEmail && testerEmails\.has\(normalizedUserEmail\)\)/);
});

test("Flight Service filing gate returns specific rejection codes", () => {
  assert.match(routesSource, /FLIGHT_SERVICE_TESTER_NOT_AUTHORIZED/);
  assert.match(routesSource, /FLIGHT_SERVICE_TEST_ACK_REQUIRED/);
  assert.match(routesSource, /FLIGHT_SERVICE_OPERATIONAL_FILING_DISABLED/);
  assert.match(routesSource, /FLIGHT_PLAN_LIMIT_EXCEEDED/);
  assert.match(routesSource, /FLIGHT_PLAN_READINESS_FAILED/);
  assert.doesNotMatch(routesSource, /code: "FLIGHT_SERVICE_VALIDATION_ONLY"/);
  assert.doesNotMatch(routesSource, /code: "FLIGHT_SERVICE_TEST_ACKNOWLEDGEMENT_REQUIRED"/);
  assert.doesNotMatch(routesSource, /code: "ACTIVE_FLIGHT_PLAN_LIMIT"/);
});
