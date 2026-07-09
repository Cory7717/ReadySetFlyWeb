import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const plannerSource = readFileSync("client/src/pages/flight-planner.tsx", "utf8");
const routesSource = readFileSync("server/routes.ts", "utf8");

test("Flight Planner readiness uses field-level categories instead of generic aircraft profile copy", () => {
  assert.match(plannerSource, /type FilingReadinessIssue/);
  assert.match(plannerSource, /Flight Filing Readiness/);
  assert.match(plannerSource, /Aircraft Profile/);
  assert.match(plannerSource, /Pilot Profile/);
  assert.match(plannerSource, /Flight Plan/);
  assert.match(plannerSource, /Leidos Requirements/);
  assert.match(plannerSource, /Home Airport/);
  assert.match(plannerSource, /Equipment Code/);
  assert.match(plannerSource, /Fuel Endurance/);
  assert.match(plannerSource, /Why is this required\?/);
  assert.doesNotMatch(plannerSource, /Aircraft profile complete/);
  assert.doesNotMatch(plannerSource, /needs attention\./);
  assert.doesNotMatch(plannerSource, /Select or create an aircraft profile before filing/);
  assert.doesNotMatch(plannerSource, /Add aircraft profile/);
});

test("readiness blockers provide edit targets and required/recommended severity", () => {
  assert.match(plannerSource, /actionHref: aircraftProfileHref/);
  assert.match(plannerSource, /actionTab: fileTab/);
  assert.match(plannerSource, /severity: "required"/);
  assert.match(plannerSource, /severity: "recommended"/);
  assert.match(plannerSource, /Required items must be completed before filing/);
});

test("readiness validates resolved aircraft data, not saved profile source", () => {
  assert.match(plannerSource, /const filingAircraftType = filingDraft\.aircraftType\.trim\(\)\.toUpperCase\(\) === "ZZZZ"/);
  assert.match(plannerSource, /basePlannerAircraftType/);
  assert.match(plannerSource, /selectedType/);
  assert.doesNotMatch(plannerSource, /addIssue\(!selectedProfile/);
  assert.match(plannerSource, /message: "Aircraft type is required\."/);
  assert.match(plannerSource, /message: "Aircraft equipment code is required\."/);
  assert.match(plannerSource, /message: "Surveillance equipment code is required\."/);
});

test("library aircraft selection is not overridden by the default saved profile", () => {
  assert.match(plannerSource, /const userSelectedAircraftTypeRef = useRef\(false\)/);
  assert.match(plannerSource, /const handleAircraftTypeSelection = \(value: string\) => \{/);
  assert.match(plannerSource, /userSelectedAircraftTypeRef\.current = true;\s+setSelectedTypeId\(value\);\s+setSelectedProfileId\("none"\);/);
  assert.match(plannerSource, /const handleAircraftProfileSelection = \(value: string\) => \{/);
  assert.match(plannerSource, /userSelectedAircraftTypeRef\.current = value === "none";/);
  assert.match(plannerSource, /if \(userSelectedAircraftTypeRef\.current\) return;\s+if \(editingPlan \|\| draftPlanId\) return;/);
  assert.match(plannerSource, /onValueChange=\{handleAircraftTypeSelection\}/);
  assert.match(plannerSource, /onValueChange=\{handleAircraftProfileSelection\}/);
});

test("client and server log structured flight validation failures without payload values", () => {
  assert.match(plannerSource, /event: "flight_validation_failed"/);
  assert.match(plannerSource, /missingFields/);
  assert.match(plannerSource, /categories/);
  assert.match(routesSource, /event: "flight_validation_failed"/);
  assert.match(routesSource, /failedRules/);
  assert.match(routesSource, /missingFields/);
  assert.match(routesSource, /userId: req\.user\?\.id \|\| null/);
});
