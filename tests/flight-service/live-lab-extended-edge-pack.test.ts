import assert from "node:assert/strict";
import test from "node:test";
import {
  amendMutationForCase,
  assertNoLiveLabDuplicateRisk,
  buildCases,
  buildCasesForSuite,
  buildCoreCaseMappingAudit,
  buildExtendedEdgeCases,
  CORE_CERTIFICATION_SUITE_VERSION,
  EXTENDED_EDGE_PACK_VERSION,
  summarizePayload,
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

test("core certification suite keeps the stable Core 15 mapping", () => {
  const cases = buildCases(context, "core-mapping");
  const mapping = buildCoreCaseMappingAudit();

  assert.equal(CORE_CERTIFICATION_SUITE_VERSION, "core-15");
  assert.equal(cases.length, 15);
  assert.equal(mapping.length, 15);
  assert.deepEqual(cases.map((item) => item.seed), Array.from({ length: 15 }, (_, index) => index + 1));
  assert.deepEqual(cases.map((item) => item.stableId), Array.from({ length: 15 }, (_, index) => `case-${String(index + 1).padStart(2, "0")}`));
  assert.equal(cases.every((item) => item.suite === "core"), true);
  assert.equal(mapping.every((item) => item.disposition === "retained"), true);
  assert.equal(cases.find((item) => item.seed === 10)?.name, "Negative - Equipment R with no PBN");
  assert.equal(cases.find((item) => item.seed === 15)?.name, "Negative - Invalid Other Info");
});

test("suite selector can run core, extended, or all cases without changing Core 15", () => {
  const core = buildCasesForSuite(context, "suite-selection", "core");
  const extended = buildCasesForSuite(context, "suite-selection", "extended");
  const all = buildCasesForSuite(context, "suite-selection", "all");

  assert.equal(EXTENDED_EDGE_PACK_VERSION, "extended-edge-pack-2026-07");
  assert.equal(core.length, 15);
  assert.equal(extended.length, 7);
  assert.equal(all.length, 22);
  assert.deepEqual(extended.map((item) => item.seed), [16, 17, 18, 19, 20, 21, 22]);
  assert.equal(extended.every((item) => item.suite === "extended"), true);
  assert.equal(all.slice(0, 15).every((item) => item.suite === "core"), true);
  assert.equal(all.slice(15).every((item) => item.suite === "extended"), true);
});

test("extended edge pack covers cancellation, valid PBN, timezone, ZZZZ TYP, lifecycle, and future DOF edges", () => {
  const cases = buildExtendedEdgeCases(context, "edge-coverage");
  const namesBySeed = new Map(cases.map((item) => [item.seed, item.name]));

  assert.equal(namesBySeed.get(16), "IFR proposed cancellation");
  assert.equal(namesBySeed.get(17), "IFR amend then cancel with newest version stamp");
  assert.equal(namesBySeed.get(18), "Positive - Equipment R with valid PBN");
  assert.equal(namesBySeed.get(19), "KLAS date-boundary timezone payload");
  assert.equal(namesBySeed.get(20), "ZZZZ aircraft type with TYP");
  assert.equal(namesBySeed.get(21), "VFR full lifecycle extended");
  assert.equal(namesBySeed.get(22), "Future-date DOF positive control");
  assert.deepEqual(cases.find((item) => item.seed === 17)?.actions, ["file", "amend", "cancel"]);
  assert.deepEqual(cases.find((item) => item.seed === 21)?.actions, ["file", "activate", "close"]);
});

test("valid Equipment R/PBN positive edge case sends both values together", () => {
  const case18 = buildExtendedEdgeCases(context, "valid-pbn").find((item) => item.seed === 18)!;
  const plan = case18.buildPlan();
  const payload = summarizePayload(plan, "file") as any;

  assert.match(String(plan.filingEquipment), /R/);
  assert.match(String(plan.filingOtherInfo), /\bPBN\/A1\b/);
  assert.match(String(payload.equipment), /R/);
  assert.match(String(payload.otherInfo), /\bPBN\/A1\b/);
});

test("KLAS date-boundary edge case preserves airport-local date and canonical UTC instant", () => {
  const case19 = buildExtendedEdgeCases(context, "klas-boundary").find((item) => item.seed === 19)!;
  const plan = case19.buildPlan();
  const plannerState = plan.plannerState as any;

  assert.equal(plan.departure, "KLAS");
  assert.equal(plannerState.departureTimeZone, "America/Los_Angeles");
  assert.equal(plannerState.userDisplayDepartureTimeLocal, "2026-07-17T23:30");
  assert.equal(plan.plannedDepartureAt?.toISOString(), "2026-07-18T06:30:00.000Z");
});

test("extended amend cases mutate before the next provider action and preserve required fields", () => {
  const cases = buildExtendedEdgeCases(context, "amend-mutations");
  const case17 = cases.find((item) => item.seed === 17)!;
  const case20 = cases.find((item) => item.seed === 20)!;

  assert.deepEqual(amendMutationForCase(case17), {
    route: "DCT ACT DCT SAT DCT",
    filingPlannedAltitudeFt: 9000,
    alternate: "KAUS",
    filingOtherInfo: "PBN/A1 RMK/RSF LAB TEST SEED 17 AMENDED BEFORE CANCEL",
    filingRemarks: "RSF LAB TEST SEED 17 AMENDED BEFORE CANCEL",
  });
  assert.deepEqual(amendMutationForCase(case20), {
    route: "DCT CWK DCT",
    filingPlannedAltitudeFt: 8500,
    alternate: "KAUS",
    filingOtherInfo: "PBN/A1 TYP/TBM9 RMK/RSF LAB TEST SEED 20 ZZZZ TYP AMENDED",
    filingRemarks: "RSF LAB TEST SEED 20 ZZZZ TYP AMENDED",
  });
});

test("extended edge pack fails locally if provider-submitted cases collide", () => {
  const cases = buildExtendedEdgeCases(context, "duplicate-safe-edge-pack");

  assert.doesNotThrow(() => assertNoLiveLabDuplicateRisk(
    cases.map((testCase) => ({ testCase, plan: testCase.buildPlan() })),
  ));
});
