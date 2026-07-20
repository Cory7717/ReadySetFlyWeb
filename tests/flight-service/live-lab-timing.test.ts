import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLiveLabEffectiveDepartureTime,
  assertEffectiveDepartureTimeNotStale,
  assertNoLiveLabDuplicateRisk,
  buildCases,
  buildCasesForSuite,
  getLiveLabTestDesignFailure,
} from "./leidos-live-lab/live-lab-runner";
import { validateFlightPlanForAction } from "../../server/services/flight-plan-filing/provider";

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

const caseBySeed = (seed: number) => {
  const found = buildCases(context, "timing-regression").find((item) => item.seed === seed);
  assert.ok(found, `case ${seed} exists`);
  return found;
};

test("dynamic LAB timing replaces stale July 15 seed for Case 1", () => {
  const testCase = caseBySeed(1);
  const original = testCase.buildPlan();
  assert.equal(original.plannedDepartureAt?.toISOString(), "2026-07-15T15:00:00.000Z");

  const timing = applyLiveLabEffectiveDepartureTime(original, testCase, {
    dynamicTimingEnabled: true,
    now: "2026-07-16T17:00:00.000Z",
  });

  assert.equal(timing.metadata.lifecycleDynamicTimeEnabled, true);
  assert.equal(timing.metadata.originalPlannedLocalTime, "2026-07-15T10:00");
  assert.equal(timing.metadata.effectiveDepartureLocalTime, "2026-07-16T13:00");
  assert.equal(timing.metadata.departureTimeZone, "America/Chicago");
  assert.equal(timing.metadata.departureInstantUtc, "2026-07-16T18:00:00.000Z");
  assert.equal(timing.metadata.expectedProviderZulu, "1800Z");
  assert.doesNotThrow(() => assertEffectiveDepartureTimeNotStale(timing, testCase, "2026-07-16T17:00:00.000Z"));
});

test("later cases remain future after simulated two-minute inter-case delays", () => {
  const cases = buildCases(context, "timing-delay");
  const runStart = Date.parse("2026-07-16T17:00:00.000Z");

  for (const [index, testCase] of cases.entries()) {
    const now = new Date(runStart + index * 2 * 60_000);
    const timing = applyLiveLabEffectiveDepartureTime(testCase.buildPlan(), testCase, {
      dynamicTimingEnabled: true,
      now,
    });
    assert.doesNotThrow(() => assertEffectiveDepartureTimeNotStale(timing, testCase, now));
    assert.ok(new Date(timing.metadata.departureInstantUtc!).getTime() > now.getTime());
  }
});

test("dynamic timing is generated from the post-delay clock for the current case", () => {
  const testCase = caseBySeed(8);
  const beforeDelay = applyLiveLabEffectiveDepartureTime(testCase.buildPlan(), testCase, {
    dynamicTimingEnabled: true,
    now: "2026-07-16T17:00:00.000Z",
  });
  const afterDelay = applyLiveLabEffectiveDepartureTime(testCase.buildPlan(), testCase, {
    dynamicTimingEnabled: true,
    now: "2026-07-16T17:02:00.000Z",
  });

  assert.notEqual(afterDelay.metadata.departureInstantUtc, beforeDelay.metadata.departureInstantUtc);
  assert.equal(afterDelay.metadata.effectiveTimeGeneratedAt, "2026-07-16T17:02:00.000Z");
});

test("midnight and UTC-date rollover use the departure airport timezone", () => {
  const testCase = caseBySeed(1);
  const plan = { ...testCase.buildPlan(), departure: "KEDC" } as any;
  const timing = applyLiveLabEffectiveDepartureTime(plan, testCase, {
    dynamicTimingEnabled: true,
    now: "2026-07-17T04:30:00.000Z",
  });

  assert.equal(timing.metadata.departureTimeZone, "America/Chicago");
  assert.equal(timing.metadata.effectiveDepartureLocalTime, "2026-07-17T00:30");
  assert.equal(timing.metadata.departureInstantUtc, "2026-07-17T05:30:00.000Z");
  assert.equal(timing.metadata.expectedProviderZulu, "0530Z");
});

test("extended Case 19 always produces a real KLAS local-to-UTC date boundary", () => {
  const testCase = buildCasesForSuite(context, "case-19-date-boundary", "extended").find((item) => item.seed === 19)!;
  const timing = applyLiveLabEffectiveDepartureTime(testCase.buildPlan(), testCase, {
    dynamicTimingEnabled: true,
    now: "2026-07-20T17:00:00.000Z",
  });

  assert.equal(timing.metadata.departureTimeZone, "America/Los_Angeles");
  assert.equal(timing.metadata.departureTimeLocal, "23:30");
  assert.notEqual(timing.metadata.localCalendarDate, timing.metadata.utcCalendarDate);
  assert.equal(timing.metadata.dateBoundaryExpected, true);
  assert.equal(timing.metadata.dateBoundaryObserved, true);
  assert.equal(timing.metadata.dateBoundaryCheckPassed, true);
  assert.equal(getLiveLabTestDesignFailure(timing, testCase), null);
  assert.doesNotThrow(() => assertEffectiveDepartureTimeNotStale(timing, testCase, "2026-07-20T17:00:00.000Z"));
});

test("extended Case 19 fails test-design preflight if date-boundary assertion is false", () => {
  const testCase = buildCasesForSuite(context, "case-19-date-boundary-failure", "extended").find((item) => item.seed === 19)!;
  const timing = applyLiveLabEffectiveDepartureTime(testCase.buildPlan(), testCase, {
    dynamicTimingEnabled: true,
    now: "2026-07-20T17:00:00.000Z",
  });
  const badTiming = {
    ...timing,
    metadata: {
      ...timing.metadata,
      localCalendarDate: "2026-07-20",
      utcCalendarDate: "2026-07-20",
      dateBoundaryObserved: false,
      dateBoundaryCheckPassed: false,
    },
  };

  assert.match(String(getLiveLabTestDesignFailure(badTiming, testCase)), /Test design failure: Case 19/);
});

test("extended Case 22 always uses a future airport-local date and injects one DOF", () => {
  const testCase = buildCasesForSuite(context, "case-22-future-dof", "extended").find((item) => item.seed === 22)!;
  const timing = applyLiveLabEffectiveDepartureTime(testCase.buildPlan(), testCase, {
    dynamicTimingEnabled: true,
    now: "2026-07-20T17:00:00.000Z",
  });

  assert.equal(timing.metadata.departureTimeZone, "America/Chicago");
  assert.equal(timing.metadata.departureDateLocal, "2026-07-21");
  assert.equal(timing.metadata.departureTimeLocal, "13:40");
  assert.equal(timing.metadata.currentDateAtDepartureAirport, "2026-07-20");
  assert.equal(timing.metadata.futureDateExpected, true);
  assert.equal(timing.metadata.futureDateObserved, true);
  assert.equal(timing.metadata.futureDateCheckPassed, true);
  assert.equal(timing.metadata.dofExpected, "260721");
  assert.equal(timing.metadata.dofInjected, true);
  assert.equal(timing.metadata.dofTransmitted, "260721");
  assert.equal(timing.metadata.dofEntryCount, 1);
  assert.equal(timing.metadata.dofCheckPassed, true);
  assert.equal(getLiveLabTestDesignFailure(timing, testCase), null);
});

test("extended Case 22 fails test-design preflight if future-date or DOF evidence is false", () => {
  const testCase = buildCasesForSuite(context, "case-22-future-dof-failure", "extended").find((item) => item.seed === 22)!;
  const timing = applyLiveLabEffectiveDepartureTime(testCase.buildPlan(), testCase, {
    dynamicTimingEnabled: true,
    now: "2026-07-20T17:00:00.000Z",
  });
  const badTiming = {
    ...timing,
    metadata: {
      ...timing.metadata,
      futureDateCheckPassed: false,
      dofInjected: false,
      dofCheckPassed: false,
      dofTransmitted: null,
    },
  };

  assert.match(String(getLiveLabTestDesignFailure(badTiming, testCase)), /Case 22 must prove future-date DOF injection/);
});

test("generic dynamic timing cannot overwrite Case 22 future-date DOF strategy", () => {
  const case1 = caseBySeed(1);
  const case22 = buildCasesForSuite(context, "case-22-not-generic", "extended").find((item) => item.seed === 22)!;
  const now = "2026-07-20T17:00:00.000Z";
  const generic = applyLiveLabEffectiveDepartureTime(case1.buildPlan(), case1, { dynamicTimingEnabled: true, now });
  const futureDof = applyLiveLabEffectiveDepartureTime(case22.buildPlan(), case22, { dynamicTimingEnabled: true, now });

  assert.match(futureDof.metadata.lifecycleDepartureTimeStrategy, /case-22/);
  assert.notEqual(futureDof.metadata.departureDateLocal, generic.metadata.departureDateLocal);
  assert.equal(futureDof.metadata.futureDateCheckPassed, true);
  assert.equal(futureDof.metadata.dofCheckPassed, true);
});

test("America/Chicago daylight-saving conversion is reflected in local time", () => {
  const testCase = caseBySeed(1);
  const timing = applyLiveLabEffectiveDepartureTime(testCase.buildPlan(), testCase, {
    dynamicTimingEnabled: true,
    now: "2026-03-08T07:45:00.000Z",
  });

  assert.equal(timing.metadata.departureTimeZone, "America/Chicago");
  assert.equal(timing.metadata.effectiveDepartureLocalTime, "2026-03-08T03:45");
  assert.equal(timing.metadata.departureInstantUtc, "2026-03-08T08:45:00.000Z");
});

test("lifecycle activation cases receive an activation-window departure time", () => {
  const testCase = caseBySeed(7);
  const timing = applyLiveLabEffectiveDepartureTime(testCase.buildPlan(), testCase, {
    dynamicTimingEnabled: true,
    now: "2026-07-16T17:00:00.000Z",
  });

  assert.equal(timing.metadata.offsetMinutes, 15);
  assert.equal(timing.metadata.activationWindowCheckPassed, true);
  assert.equal(timing.metadata.departureInstantUtc, "2026-07-16T17:15:00.000Z");
});

test("negative cases keep future baseline and fail for intended validation", () => {
  const testCase = caseBySeed(10);
  const now = new Date(Date.now() + 60 * 60_000);
  const timing = applyLiveLabEffectiveDepartureTime(testCase.buildPlan(), testCase, {
    dynamicTimingEnabled: true,
    now,
  });
  const validation = validateFlightPlanForAction(timing.plan, "file");

  assert.equal(validation.ready, false);
  assert.match(validation.errors.join(" | "), /PBN|equipment/i);
  assert.doesNotMatch(validation.errors.join(" | "), /past|departure time/i);
});

test("confirmed static stale effective time is rejected before provider submission", () => {
  const testCase = caseBySeed(1);
  const timing = applyLiveLabEffectiveDepartureTime(testCase.buildPlan(), testCase, {
    dynamicTimingEnabled: false,
    now: "2026-07-16T17:00:00.000Z",
  });

  assert.equal(timing.metadata.lifecycleDynamicTimeEnabled, false);
  assert.equal(timing.metadata.lifecycleDepartureTimeStrategy, "static deterministic seed time");
  assert.throws(
    () => assertEffectiveDepartureTimeNotStale(timing, testCase, "2026-07-16T17:00:00.000Z"),
    /effective departure time is stale/i,
  );
});

test("dynamic timing keeps live LAB duplicate preflight safe", () => {
  const cases = buildCases(context, "timing-duplicate-preflight");
  const now = new Date("2026-07-16T17:00:00.000Z");
  assert.doesNotThrow(() => assertNoLiveLabDuplicateRisk(
    cases.map((testCase) => ({
      testCase,
      plan: applyLiveLabEffectiveDepartureTime(testCase.buildPlan(), testCase, {
        dynamicTimingEnabled: true,
        now,
      }).plan,
    })),
  ));
});
