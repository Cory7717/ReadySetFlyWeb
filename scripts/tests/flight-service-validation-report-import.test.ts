import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { removeRestrictedProviderBranding, validatePublicValidationReport } from "../../shared/config/flightServiceValidationReports";

const validReport = {
  schemaVersion: "1.0.0",
  reportType: "rsf-flight-service-validation",
  reportId: "lab-validation-v1",
  title: "Flight Service Validation",
  subtitle: "Sanitized report",
  visibility: "public-sanitized",
  metadata: { environment: "LAB / Elab2", validationDate: "August 4, 2026", overallStatus: "Passed" },
  executiveSummary: ["Validation completed."],
  testScenario: { title: "Lifecycle validation" },
  lifecycleTimeline: ["File", "Retrieve", "Close"],
  validationResults: [{ title: "File", result: "PASS" }],
  evidence: [{ title: "Retrieve", evidenceType: "provider response", httpStatus: "200 OK", summary: "Accepted", json: { returnStatus: true } }],
  engineeringObservations: ["No critical issues."],
  openItems: [],
  conclusion: { status: "Passed" },
};

test("valid public report passes import validation", () => {
  const result = validatePublicValidationReport(validReport);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.report.testCases, []);
});

test("v1 reports may publish dedicated selectable test cases", () => {
  const candidate = { ...validReport, testCases: [{ testCaseId: "zzzz-departure", title: "ZZZZ Departure", category: "ZZZZ Operations", status: "PASS", purpose: "Verify DEP generation.", expected: { otherInfo: "DEP/77TS" }, actual: { otherInfo: "DEP/77TS" }, evidenceRefs: ["retrieve-filed"] }] };
  const result = validatePublicValidationReport(candidate);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.report.testCases[0]?.testCaseId, "zzzz-departure");
});

test("explicit redaction placeholders are accepted while raw identifiers remain blocked", () => {
  const sanitized = structuredClone(validReport) as any;
  sanitized.evidence[0].providerPlanId = "[REDACTED]";
  sanitized.evidence[0].flightIdentifier = "PII restricted";
  assert.equal(validatePublicValidationReport(sanitized).ok, true);
  sanitized.evidence[0].providerPlanId = "raw-provider-123";
  assert.equal(validatePublicValidationReport(sanitized).ok, false);
});

test("restricted provider branding is removed from public report content", () => {
  const branded = { subtitle: "RSF and Leidos Flight Services", event: "leidos_push_received" };
  const publicValue = removeRestrictedProviderBranding(branded);
  assert.deepEqual(publicValue, { subtitle: "RSF and Flight Services", event: "flight_services_push_received" });
  assert.doesNotMatch(JSON.stringify(publicValue), /leidos/i);

  const candidate = structuredClone(validReport) as any;
  candidate.subtitle = "Ready Set Fly ↔ Leidos Flight Services eLab2";
  const result = validatePublicValidationReport(candidate);
  assert.equal(result.ok, true);
  if (result.ok) assert.doesNotMatch(JSON.stringify(result.report), /leidos/i);
});

test("invalid report type, schema version, and missing fields are rejected", () => {
  assert.equal(validatePublicValidationReport({ ...validReport, reportType: "other" }).ok, false);
  assert.equal(validatePublicValidationReport({ ...validReport, schemaVersion: "2.0" }).ok, false);
  const { evidence: _evidence, ...missing } = validReport;
  assert.equal(validatePublicValidationReport(missing).ok, false);
});

test("sensitive-looking content is rejected with its field path", () => {
  for (const [path, value] of [
    ["$.evidence[0].authorization", "Bearer abcdefghijklmnop"],
    ["$.evidence[0].summary", "Contact pilot@example.com"],
    ["$.metadata.databaseUrl", "postgresql://secret"],
  ] as const) {
    const candidate = structuredClone(validReport) as any;
    if (path.includes("metadata")) candidate.metadata.databaseUrl = value;
    else if (path.includes("authorization")) candidate.evidence[0].authorization = value;
    else candidate.evidence[0].summary = value;
    const result = validatePublicValidationReport(candidate);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("report routes separate public reads from authenticated publication", () => {
  const source = readFileSync("server/routes/flightServiceValidationReports.ts", "utf8");
  assert.match(source, /app\.get\("\/api\/public\/flight-service-validation\/reports"/);
  assert.match(source, /app\.post\("\/api\/admin\/flight-service-validation\/reports\/preview", isAuthenticated, isAdmin/);
  assert.match(source, /app\.post\("\/api\/admin\/flight-service-validation\/reports\/publish", isAuthenticated, isAdmin/);
  assert.match(source, /REPLACEMENT_CONFIRMATION_REQUIRED/);
  assert.match(source, /Content-Disposition/);
  assert.doesNotMatch(source, /Leidos|filing-action|filing-sync|webhook|provider synchronization/i);
});

test("import UI previews before publishing and keeps evidence collapsed", () => {
  const source = readFileSync("client/src/components/flight-service-validation/ImportedValidationReport.tsx", "utf8");
  assert.match(source, /Preview before publishing/);
  assert.match(source, /Publish Report/);
  assert.match(source, /<Accordion type="single" collapsible/);
  assert.doesNotMatch(source, /<Accordion type="single"[^>]*defaultValue=/);
  assert.match(source, /Expand Raw Provider Response/);
  assert.match(source, /Expand Log Evidence/);
  assert.match(source, /evidenceValue\(item, "response", "events"/);
  assert.match(source, /function ScenarioGrid/);
  assert.match(source, /function LifecycleTimeline/);
  assert.match(source, /function TestCaseWorkspace/);
  assert.match(source, /Selected test case/);
  assert.match(source, /testCases\.length > 0 \? testCases : results\.map/);
  assert.match(source, /testCases=\{report\.testCases \?\? \[\]\}/);
  assert.match(source, /results=\{report\.validationResults \?\? \[\]\}/);
  assert.match(source, /Linked Evidence/);
  assert.match(source, /Download Sanitized JSON/);
});

test("published validation reports remain individually accessible without replacement", () => {
  const source = readFileSync("client/src/components/flight-service-validation/ImportedValidationReport.tsx", "utf8");
  assert.match(source, /Published Tests/);
  assert.match(source, /Every published validation report remains available/);
  assert.match(source, /\/flight-service-validation\/reports\/\$\{encodeURIComponent\(item\.reportId\)\}/);
  assert.match(source, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(source, /Give this test a new reportId so the earlier report remains available/);
  assert.doesNotMatch(source, /publish\(true\)/);
  assert.doesNotMatch(source, /window\.confirm\("This report ID already exists/);
});
