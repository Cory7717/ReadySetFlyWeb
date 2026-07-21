import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildFlightServiceOpsDetail,
  buildFlightServiceOpsSearchResult,
  buildFlightServiceSarReport,
  formatFlightServiceOpsDisplayValue,
  getFlightServiceOpsAdminUserId,
  logFlightServiceOpsMissingAdminUserId,
  logFlightServiceOpsAuditEvent,
} from "../../server/services/flightServiceOpsConsole";
import { filingPlan } from "./test-utils";

const owner = {
  email: "pilot@example.com",
  firstName: "Casey",
  lastName: "Pilot",
  phone: "5125550199",
  homeBase: "KEDC",
} as any;

test("Flight Service Ops endpoints are super-admin guarded", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  for (const route of [
    "/api/admin/flight-service-ops/search",
    "/api/admin/flight-service-ops/plans/:planId",
    "/api/admin/flight-service-ops/plans/:planId/sar-report",
  ]) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(routes, new RegExp(`"${escaped}",\\s*isAuthenticated,\\s*isSuperAdmin`));
  }
});

test("Super admin search projection supports tail and provider plan review fields", () => {
  const plan = filingPlan({
    id: "rsf-plan-1",
    tailNumber: "N987RS",
    filingProviderPlanId: "339842058_322259_285",
    filingStatus: "filed",
    plannedDepartureAt: new Date("2026-08-15T15:00:00.000Z"),
    plannedArrivalAt: new Date("2026-08-15T16:00:00.000Z"),
    filingLastProviderSyncAt: new Date("2026-07-09T14:00:00.000Z"),
  });

  const result = buildFlightServiceOpsSearchResult(plan, owner);
  assert.equal(result.id, "rsf-plan-1");
  assert.equal(result.tailNumber, "N987RS");
  assert.equal(result.providerPlanId, "339842058_322259_285");
  assert.equal(result.pilotEmail, "pilot@example.com");
  assert.equal(result.operationalState, "open");
});

test("Flight detail returns timeline and append-only action history without raw provider payloads", () => {
  const plan = filingPlan({
    filingStatus: "closed",
    filingProviderPlanId: "provider-123",
    filedAt: new Date("2026-07-09T14:00:00.000Z"),
    closedAt: new Date("2026-07-09T15:00:00.000Z"),
    filingProviderSnapshot: { providerStatus: "CLOSED", versionStamp: "20260709150000123" } as any,
    filingProviderMessages: [{ action: "close", message: "Accepted", versionStamp: null }] as any,
    filingActionHistory: [
      {
        action: "file",
        stagedAt: "2026-07-09T14:00:00.000Z",
        providerPlanId: "provider-123",
        versionStamp: "20260709140000123",
        raw: { pilotPhone: "5125550199", requestPayload: "secret" },
        payloadSnapshot: { pilotPhone: "5125550199" },
      },
      {
        action: "close",
        stagedAt: "2026-07-09T15:00:00.000Z",
        providerPlanId: "provider-123",
        raw: { pilotPhone: "5125550199", response: "secret" },
      },
    ] as any,
  });

  const detail = buildFlightServiceOpsDetail(plan, owner);
  assert.ok(detail.timeline.some((event) => event.type === "file"));
  assert.ok(detail.timeline.some((event) => event.type === "closed"));
  assert.equal(detail.amendmentHistory.length, 2);
  const serialized = JSON.stringify(detail.amendmentHistory);
  assert.doesNotMatch(serialized, /requestPayload|secret|5125550199|payloadSnapshot/);
});

test("SAR report includes required operational sections", () => {
  const plan = filingPlan({
    id: "sar-plan",
    filingProviderPlanId: "provider-sar-1",
    filingStatus: "activated",
    filingPilotName: "SAR Pilot",
    filingPilotPhone: "5125550100",
    filingAircraftColor: "WHITE BLUE",
    filingEnduranceMinutes: 240,
  });

  const report = buildFlightServiceSarReport(plan, owner);
  assert.equal(report.plan.planId, "sar-plan");
  assert.equal(report.plan.status.providerPlanId, "provider-sar-1");
  assert.equal(report.plan.pilot.name, "SAR Pilot");
  assert.equal(report.plan.summary.aircraftColor, "WHITE BLUE");
  assert.equal(report.plan.summary.fuelEnduranceMinutes, 240);
  assert.match(report.note, /Verify against Leidos\/provider records/);
});

test("Flight Service Ops audit logging avoids query PII and raw values", () => {
  const originalLog = console.log;
  const logs: string[] = [];
  console.log = (value?: unknown) => {
    logs.push(String(value));
  };
  try {
    logFlightServiceOpsAuditEvent("flight_service_ops_search", {
      adminUserId: "admin-1",
      searchType: "pilotPhone",
      selectedPlanId: "plan-1",
      resultCount: 1,
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(logs.length, 1);
  const event = JSON.parse(logs[0]);
  assert.equal(event.event, "flight_service_ops_search");
  assert.equal(event.searchType, "pilotPhone");
  assert.equal(event.selectedPlanId, "plan-1");
  assert.doesNotMatch(logs[0], /512|pilot@example|SAR Pilot/);
});

test("Flight Service Ops audit identity uses canonical authenticated admin id", () => {
  assert.equal(
    getFlightServiceOpsAdminUserId({
      user: { id: "wrong-client-shape", claims: { sub: "admin-canonical-1" } },
      session: { userId: "session-admin-1" },
      query: { adminUserId: "attacker-query-id" },
      body: { adminUserId: "attacker-body-id" },
      headers: { "x-admin-user-id": "attacker-header-id" },
    }),
    "admin-canonical-1",
  );
  assert.equal(
    getFlightServiceOpsAdminUserId({
      session: { userId: "session-admin-2" },
      query: { adminUserId: "attacker-query-id" },
    }),
    "session-admin-2",
  );
  assert.equal(getFlightServiceOpsAdminUserId({ user: { id: "legacy-id-only" } }), null);
});

test("Flight Service Ops missing audit context warning is sanitized", () => {
  const originalWarn = console.warn;
  const logs: string[] = [];
  console.warn = (value?: unknown) => {
    logs.push(String(value));
  };
  try {
    logFlightServiceOpsMissingAdminUserId("flight_service_ops_view", "/api/admin/flight-service-ops/plans/:planId", "plan-1");
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(logs.length, 1);
  const event = JSON.parse(logs[0]);
  assert.equal(event.event, "flight_service_ops_audit_context_missing");
  assert.equal(event.activityEvent, "flight_service_ops_view");
  assert.equal(event.selectedPlanId, "plan-1");
  assert.doesNotMatch(logs[0], /pilot@example|512|cookie|token|attacker/);
});

test("Flight Service Ops routes audit canonical admin id and fail closed if absent", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  assert.doesNotMatch(routes, /flight_service_ops_(?:search|view|sar_report|provider_diagnostics)"[\s\S]{0,220}adminUserId:\s*req\.user\?\.id/);
  for (const eventName of [
    "flight_service_ops_search",
    "flight_service_ops_view",
    "flight_service_ops_sar_report",
    "flight_service_ops_provider_diagnostics",
  ]) {
    const eventIndex = routes.indexOf(`logFlightServiceOpsAuditEvent("${eventName}"`);
    assert.ok(eventIndex > 0, `${eventName} audit event should be logged`);
    const nearby = routes.slice(Math.max(0, eventIndex - 3000), eventIndex + 250);
    assert.match(nearby, /getFlightServiceOpsAdminUserId\(req\)/);
    assert.match(nearby, /if \(!adminUserId\)/);
    assert.match(nearby, /logFlightServiceOpsMissingAdminUserId/);
    assert.match(nearby, /adminUserId,/);
  }
  assert.doesNotMatch(routes, /req\.(?:query|body|headers|params)\.adminUserId/);
});

test("Flight Service Ops search controls use readable local dark-field styling", () => {
  const page = readFileSync("client/src/pages/flight-service-ops.tsx", "utf8");
  assert.match(page, /const opsFieldClassName =[\s\S]*bg-slate-950[\s\S]*text-slate-50[\s\S]*placeholder:text-slate-400[\s\S]*focus-visible:ring-blue-600[\s\S]*disabled:text-slate-400[\s\S]*-webkit-text-fill-color:#f8fafc/);
  assert.match(page, /const opsSelectTriggerClassName =[\s\S]*bg-slate-950[\s\S]*text-slate-50[\s\S]*focus:ring-blue-600/);
  assert.match(page, /const opsSelectContentClassName = "border-slate-700 bg-slate-950 text-slate-50"/);
  assert.equal((page.match(/className=\{opsFieldClassName\}/g) || []).length, 15);
  assert.equal((page.match(/className=\{opsSelectTriggerClassName\}/g) || []).length, 2);
  assert.equal((page.match(/className=\{opsSelectContentClassName\}/g) || []).length, 2);
});

test("missing optional Flight Service Ops fields display as Not available", () => {
  assert.equal(formatFlightServiceOpsDisplayValue(null), "Not available");
  assert.equal(formatFlightServiceOpsDisplayValue(""), "Not available");
  assert.equal(formatFlightServiceOpsDisplayValue("KEDC"), "KEDC");
});
