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

test("sanitized evidence uses keyboard-accessible collapsible controls", () => {
  assert.match(pageSource, /<Accordion type="single" collapsible/);
  assert.match(pageSource, /<AccordionItem/);
  assert.match(pageSource, /<AccordionTrigger/);
  assert.match(pageSource, /<AccordionContent>/);
  for (const evidence of flightServiceValidationReport.evidence) {
    assert.ok(pageSource.includes(evidence.title));
    assert.ok(evidence.objective.length > 0);
    assert.ok(evidence.procedure.length > 0);
    assert.ok(evidence.expectedResult.length > 0);
  }
  for (const label of Object.values(flightServiceValidationReport.evidenceLabels)) {
    assert.ok(pageSource.includes(label), `Missing evidence label: ${label}`);
  }
  assert.match(pageSource, /<Button type="button" variant="secondary" disabled>/);
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
