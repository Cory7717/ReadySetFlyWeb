import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { flightServiceValidationReport } from "../../client/src/pages/flight-service-validation";

const pageSource = readFileSync("client/src/pages/flight-service-validation.tsx", "utf8");
const appSource = readFileSync("client/src/App.tsx", "utf8");

test("Flight Service Validation is registered as an unconditional public route", () => {
  assert.match(appSource, /<Route path="\/flight-service-validation" component=\{FlightServiceValidationPage\} \/>/);
  assert.doesNotMatch(appSource, /path="\/flight-service-validation"[\s\S]{0,160}(RequireAuth|isAuthenticated\s*\?)/);
});

test("validation page renders every required report section", () => {
  for (const heading of Object.values(flightServiceValidationReport.sections)) {
    assert.ok(pageSource.includes(heading), `Missing section: ${heading}`);
  }
  assert.ok(pageSource.includes(flightServiceValidationReport.title));
  assert.ok(pageSource.includes(flightServiceValidationReport.subtitle));
});

test("overall validation status presents the current certification snapshot", () => {
  assert.equal(flightServiceValidationReport.overallValidation.headline, "118 / 118 Validation Tests Passed");
  assert.deepEqual(flightServiceValidationReport.overallValidation.metrics, [
    { label: "Critical Issues", value: "0" },
    { label: "Major Issues", value: "0" },
    { label: "Environment", value: "LAB / Elab2" },
    { label: "Integration Status", value: "Awaiting Final Flight Services Demonstration" },
  ]);
  assert.match(pageSource, /report\.overallValidation\.metrics\.map/);
});

test("validation matrix renders all required tests and status badge variants", () => {
  assert.equal(flightServiceValidationReport.testMatrix.length, 18);
  for (const row of flightServiceValidationReport.testMatrix) {
    assert.ok(pageSource.includes(row.test), `Missing test matrix row: ${row.test}`);
  }
  for (const status of ["Passed", "Pending", "Not Yet Observed"]) {
    assert.ok(pageSource.includes(status), `Missing status badge: ${status}`);
  }
});

test("sanitized evidence presents summaries with keyboard-accessible raw-response controls", () => {
  assert.match(pageSource, /<Accordion type="single" collapsible/);
  assert.doesNotMatch(pageSource, /<Accordion type="single"[^>]*defaultValue=/);
  assert.match(pageSource, /<AccordionItem/);
  assert.match(pageSource, /<AccordionTrigger[^>]*>\{report\.evidenceLabels\.expand\}<\/AccordionTrigger>/);
  assert.match(pageSource, /<AccordionContent>[\s\S]*?<SyntaxHighlightedJson value=\{item\.json\} \/>[\s\S]*?<\/AccordionContent>/);
  for (const evidence of flightServiceValidationReport.evidence) {
    assert.ok(pageSource.includes(evidence.title));
    assert.ok(evidence.purpose.length > 0);
    assert.ok(evidence.expectedLifecycle.length > 0);
    assert.equal(evidence.result, "PASS");
    assert.equal(evidence.environment, "Flight Services LAB (Elab2)");
    assert.equal(evidence.httpStatus, "200 OK");
    assert.ok(evidence.summary.length > 0);
    assert.ok(Object.keys(evidence.json).length > 0);
  }
  for (const label of Object.values(flightServiceValidationReport.evidenceLabels)) {
    assert.ok(pageSource.includes(label), `Missing evidence label: ${label}`);
  }
  assert.equal(flightServiceValidationReport.evidenceLabels.validationSummary, "Validation Summary");
  assert.equal(flightServiceValidationReport.evidenceLabels.expand, "Expand Raw Provider Response");
  assert.equal(flightServiceValidationReport.evidenceLabels.rawResponse, "Sanitized Postman Response");
  assert.match(pageSource, /<Button type="button" variant="secondary" disabled>\{report\.evidenceLabels\.download\}<\/Button>/);
  assert.match(pageSource, /<Badge[^>]*>\{report\.evidenceLabels\.comingSoon\}<\/Badge>/);
});

test("validation methodology documents the dual-channel verification workflow", () => {
  assert.deepEqual(flightServiceValidationReport.methodology.steps, [
    "File Flight Plan",
    "Retrieve Provider Response",
    "Validate Provider Data",
    "Verify Lifecycle",
    "Confirm Webhook Processing",
    "Compare Expected Results",
    "Record Validation",
  ]);
  assert.deepEqual(flightServiceValidationReport.methodology.verificationChannels, [
    "RSF user interface",
    "Direct provider retrieval through Postman",
  ]);
  assert.match(pageSource, /report\.methodology\.steps\.map/);
});

test("future validation reports are presentation-only disabled cards", () => {
  assert.deepEqual(
    flightServiceValidationReport.futureReports.map(({ label, title, button }) => ({ label, title, button })),
    [
      { label: "Validation Report 1", title: "Flight Service Integration Validation v1.0", button: "Current Report" },
      { label: "Validation Report 2", title: "Flight Services Demonstration Validation", button: "Coming After Demo" },
      { label: "Validation Report 3", title: "Production Readiness Validation", button: "Future" },
    ],
  );
  assert.match(pageSource, /report\.futureReports\.map/);
  assert.match(pageSource, /<Button type="button" variant="secondary" disabled>\{item\.button\}<\/Button>/);
});

test("validation footer returns visitors to the public home page", () => {
  assert.match(pageSource, /<Link href="\/">\{report\.footer\.button\}<\/Link>/);
  assert.ok(pageSource.includes("Return to Ready Set Fly"));
});

test("static validation page performs no authentication, network, or provider operations", () => {
  assert.doesNotMatch(pageSource, /useAuth|RequireAuth|isAuthenticated|useQuery|apiRequest|fetch\s*\(|\/api\//);
  assert.doesNotMatch(pageSource, /syncLeidos|filing-sync|filing-action|webhooks\/flight-service/);
});

test("public validation content contains no operational identifiers or personal data", () => {
  assert.doesNotMatch(pageSource, /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  assert.doesNotMatch(pageSource, /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
  assert.doesNotMatch(pageSource, /flightIdentifier|providerPlanId|userId|pilotName|phoneNumber|authToken|apiKey|requestId|databaseId/);
});

test("displayed report content is sourced from the typed page configuration", () => {
  assert.match(pageSource, /export const flightServiceValidationReport = \{/);
  assert.match(pageSource, /satisfies FlightServiceValidationReport/);
  assert.match(pageSource, /const report = flightServiceValidationReport/);
});
