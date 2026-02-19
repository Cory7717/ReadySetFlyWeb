import test from "node:test";
import assert from "node:assert/strict";
import {
  calcPressureAltitude,
  calcDensityAltitude,
  calcWindComponents,
  calcTAS,
  calcGroundSpeed,
  calcWca,
  calcTrueHeading,
  calcEnduranceHours,
  calcRangeNm,
} from "../../client/src/lib/calculators/eb6";

test("EB-6 pressure/density altitude estimates", () => {
  const pa = calcPressureAltitude(29.92, 500);
  assert.equal(Math.round(pa), 500);

  const da = calcDensityAltitude(pa, 25, 500);
  assert.equal(Math.round(da), 1690);
});

test("EB-6 wind, TAS, and groundspeed estimates", () => {
  const wind = calcWindComponents(270, 20, 240);
  assert.ok(wind.headwind > 0);
  assert.ok(wind.crosswind > 0);

  const tas = calcTAS(120, 2000);
  assert.equal(Math.round(tas), 125);

  const gs = calcGroundSpeed(tas, wind.headwind);
  assert.ok(gs > tas);
});

test("EB-6 WCA, heading, endurance, and range", () => {
  const wca = calcWca(10, 120);
  assert.ok(wca > 0);

  const heading = calcTrueHeading(240, wca);
  assert.ok(heading >= 0 && heading < 360);

  const endurance = calcEnduranceHours(36, 9);
  assert.equal(endurance, 4);

  const range = calcRangeNm(120, endurance);
  assert.equal(range, 480);
});
