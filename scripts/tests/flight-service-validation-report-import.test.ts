import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validatePublicValidationReport } from "../../shared/config/flightServiceValidationReports";

const validReport = {
  schemaVersion: "1.0",
  reportType: "rsf-flight-service-validation",
  reportId: "lab-validation-v1",
  title: "Flight Service Validation",
  subtitle: "Sanitized report",
  visibility: "public",
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
  assert.match(source, /Download Sanitized JSON/);
});
