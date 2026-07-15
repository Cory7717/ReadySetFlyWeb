import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assessCruiseAltitudePracticality,
  cruiseAltitudeBand,
  routeDistanceBand,
} from "../../shared/flight-plan-altitude-practicality";

const baseInput = {
  routeDistanceNm: 300,
  plannedAltitudeFt: 8500,
  departureElevationFt: 500,
  destinationElevationFt: 500,
  climbRateFpm: 800,
  climbSpeedKt: 90,
  descentRateFpm: 500,
  descentSpeedKt: 120,
  serviceCeilingFt: 14000,
  performanceSource: "fixture" as const,
};

test("long route with reasonable altitude is practical", () => {
  const result = assessCruiseAltitudePracticality(baseInput);
  assert.equal(result.classification, "practical");
  assert.equal(result.climbTimeMinutes, 10);
  assert.equal(result.descentTimeMinutes, 16);
  assert.ok((result.remainingCruiseDistanceNm ?? 0) > 200);
});

test("short route with little level cruise remaining is marginal", () => {
  const result = assessCruiseAltitudePracticality({ ...baseInput, routeDistanceNm: 65 });
  assert.equal(result.classification, "marginal");
  assert.ok((result.remainingCruiseDistanceNm ?? 0) >= 10);
  assert.ok((result.remainingCruiseDistanceNm ?? 0) < 20);
});

test("very short route with excessive altitude is impractical", () => {
  const result = assessCruiseAltitudePracticality({ ...baseInput, routeDistanceNm: 35 });
  assert.equal(result.classification, "impractical");
  assert.ok((result.remainingCruiseDistanceNm ?? 0) < 10);
});

test("different departure and destination elevations affect climb and descent estimates", () => {
  const result = assessCruiseAltitudePracticality({
    ...baseInput,
    departureElevationFt: 7000,
    destinationElevationFt: 1000,
  });
  assert.equal(result.altitudeToClimbFt, 1500);
  assert.equal(result.altitudeToDescendFt, 7500);
  assert.equal(result.climbTimeMinutes, 1.9);
  assert.equal(result.descentTimeMinutes, 15);
});

test("selected altitude below an airport elevation is impractical", () => {
  const result = assessCruiseAltitudePracticality({
    ...baseInput,
    plannedAltitudeFt: 4500,
    departureElevationFt: 5000,
  });
  assert.equal(result.classification, "impractical");
  assert.match(result.message, /field elevation/i);
});

test("missing departure elevation returns unable", () => {
  const result = assessCruiseAltitudePracticality({ ...baseInput, departureElevationFt: null });
  assert.equal(result.classification, "unable");
  assert.ok(result.missingInputs.includes("departureElevationFt"));
});

test("missing destination elevation returns unable", () => {
  const result = assessCruiseAltitudePracticality({ ...baseInput, destinationElevationFt: null });
  assert.equal(result.classification, "unable");
  assert.ok(result.missingInputs.includes("destinationElevationFt"));
});

test("missing climb performance returns unable", () => {
  const result = assessCruiseAltitudePracticality({ ...baseInput, climbRateFpm: null });
  assert.equal(result.classification, "unable");
  assert.ok(result.missingInputs.includes("climbRateFpm"));
});

test("missing descent performance returns unable", () => {
  const result = assessCruiseAltitudePracticality({ ...baseInput, descentSpeedKt: null });
  assert.equal(result.classification, "unable");
  assert.ok(result.missingInputs.includes("descentSpeedKt"));
});

test("malformed or zero performance values return unable", () => {
  const result = assessCruiseAltitudePracticality({
    ...baseInput,
    climbRateFpm: 0,
    descentRateFpm: Number.NaN,
  });
  assert.equal(result.classification, "unable");
  assert.ok(result.missingInputs.includes("climbRateFpm"));
  assert.ok(result.missingInputs.includes("descentRateFpm"));
});

test("selected altitude above service ceiling is impractical", () => {
  const result = assessCruiseAltitudePracticality({
    ...baseInput,
    plannedAltitudeFt: 15000,
    serviceCeilingFt: 14000,
  });
  assert.equal(result.classification, "impractical");
  assert.equal(result.serviceCeilingExceeded, true);
});

test("aircraft performance changes recalculate the result", () => {
  const fastClimber = assessCruiseAltitudePracticality({ ...baseInput, routeDistanceNm: 65, climbRateFpm: 1400 });
  const slowClimber = assessCruiseAltitudePracticality({ ...baseInput, routeDistanceNm: 65, climbRateFpm: 400 });
  assert.notEqual(fastClimber.remainingCruiseDistanceNm, slowClimber.remainingCruiseDistanceNm);
  assert.equal(fastClimber.classification, "practical");
  assert.equal(slowClimber.classification, "impractical");
});

test("route distance changes recalculate classification", () => {
  assert.equal(assessCruiseAltitudePracticality({ ...baseInput, routeDistanceNm: 300 }).classification, "practical");
  assert.equal(assessCruiseAltitudePracticality({ ...baseInput, routeDistanceNm: 35 }).classification, "impractical");
});

test("altitude changes recalculate classification", () => {
  assert.equal(assessCruiseAltitudePracticality({ ...baseInput, routeDistanceNm: 65, plannedAltitudeFt: 3500 }).classification, "practical");
  assert.equal(assessCruiseAltitudePracticality({ ...baseInput, routeDistanceNm: 65, plannedAltitudeFt: 8500 }).classification, "marginal");
});

test("wind data changes climb and descent distance when provided", () => {
  const still = assessCruiseAltitudePracticality({ ...baseInput, windComponentKt: null, windSource: "unavailable" });
  const headwind = assessCruiseAltitudePracticality({ ...baseInput, windComponentKt: 20, windSource: "calculated" });
  assert.equal(still.windAdjusted, false);
  assert.equal(headwind.windAdjusted, true);
  assert.notEqual(still.climbDistanceNm, headwind.climbDistanceNm);
});

test("missing winds clearly identifies still-air assumption", () => {
  const result = assessCruiseAltitudePracticality({ ...baseInput, windComponentKt: null, windSource: "unavailable" });
  assert.equal(result.windAdjusted, false);
  assert.ok(result.assumptions.some((item) => /Still-air estimate/i.test(item)));
});

test("analytics helper bands do not expose route or pilot details", () => {
  assert.equal(routeDistanceBand(20), "below_25");
  assert.equal(routeDistanceBand(160), "150_299");
  assert.equal(cruiseAltitudeBand(8500), "5000_9999");
  assert.equal(cruiseAltitudeBand(19000), "18000_plus");
});
