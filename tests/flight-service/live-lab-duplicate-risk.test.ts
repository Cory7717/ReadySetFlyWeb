import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNoLiveLabDuplicateRisk,
  buildCases,
  buildLiveLabDuplicateRiskSignature,
} from "./leidos-live-lab/live-lab-runner";

const context = {
  user: { id: "test-user", email: "test@example.invalid" },
  profile: {
    id: "test-aircraft",
    tailNumber: "N123RS",
    filingEquipmentDefault: "S",
    filingSoulsOnBoardDefault: "2",
    filingAircraftColorDefault: "WHITE BLUE",
    filingPilotNameDefault: "Test Pilot",
    filingWakeTurbulenceDefault: "LIGHT",
    filingTypeOfFlightDefault: "G",
    filingSurveillanceEquipmentDefault: "N",
  },
  aircraftType: "C172",
  phone: "5550001234",
  homeBase: "KEDC",
  pilotName: "Test Pilot",
} as any;

test("Case 2 and Case 8 have different duplicate-risk signatures before FILE", () => {
  const cases = buildCases(context, "duplicate-risk-regression");
  const case2 = cases.find((item) => item.seed === 2)!;
  const case8 = cases.find((item) => item.seed === 8)!;

  assert.equal(case2.name, "Normal IFR ICAO file");
  assert.deepEqual(case2.actions, ["file"]);
  assert.equal(case8.name, "IFR file then amend");
  assert.deepEqual(case8.actions, ["file", "amend"]);
  assert.notEqual(
    buildLiveLabDuplicateRiskSignature(case2.buildPlan()),
    buildLiveLabDuplicateRiskSignature(case8.buildPlan()),
  );
});

test("all provider-submitted live LAB cases pass duplicate-risk preflight", () => {
  const cases = buildCases(context, "duplicate-risk-suite");
  assert.doesNotThrow(() => assertNoLiveLabDuplicateRisk(
    cases.map((testCase) => ({ testCase, plan: testCase.buildPlan() })),
  ));
});

test("duplicate-risk preflight reports colliding case numbers", () => {
  const cases = buildCases(context, "duplicate-risk-collision");
  const case2 = cases.find((item) => item.seed === 2)!;
  const case8 = cases.find((item) => item.seed === 8)!;

  assert.throws(
    () => assertNoLiveLabDuplicateRisk([
      { testCase: case2, plan: case2.buildPlan() },
      { testCase: case8, plan: case2.buildPlan() },
    ]),
    /cases 2 and 8/i,
  );
});
