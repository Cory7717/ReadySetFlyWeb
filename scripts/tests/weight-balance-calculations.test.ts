import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateWeightBalance,
  createScenarioForProfile,
  getCgBoundsAtWeight,
  pointInEnvelope,
  type WeightBalanceProfile,
} from "../../shared/weight-balance";

const profile: WeightBalanceProfile = {
  id: "test-profile",
  name: "Test 172",
  source: "manual",
  verificationStatus: "verified",
  maxRampWeightLb: 2558,
  maxTakeoffWeightLb: 2550,
  maxLandingWeightLb: 2550,
  taxiFuelGal: 1,
  updatedAt: "2026-07-24T00:00:00.000Z",
  stations: [
    { id: "empty", name: "Basic Empty Aircraft", type: "empty", armIn: 39.5, defaultWeightLb: 1600, required: true },
    { id: "front", name: "Front Seats", type: "occupant", armIn: 37, defaultWeightLb: 340, maxWeightLb: 400 },
    { id: "rear", name: "Rear Seats", type: "occupant", armIn: 73, defaultWeightLb: 120, maxWeightLb: 400 },
    { id: "bag-a", name: "Baggage A", type: "baggage", armIn: 95, defaultWeightLb: 30, maxWeightLb: 120 },
  ],
  fuelTanks: [{ id: "main", name: "Main", armIn: 48, capacityGal: 56, defaultFuelGal: 38, fuelDensityLbPerGal: 6 }],
  envelope: [
    { cgIn: 35, weightLb: 1500 },
    { cgIn: 35, weightLb: 1950 },
    { cgIn: 41, weightLb: 2550 },
    { cgIn: 47.3, weightLb: 2550 },
    { cgIn: 47.3, weightLb: 1500 },
  ],
};

test("weight and balance calculates ramp, takeoff, zero-fuel, and landing phases", () => {
  const scenario = createScenarioForProfile(profile);
  scenario.tripFuelGal = 12;

  const result = calculateWeightBalance(profile, scenario);
  const ramp = result.phases.find((phase) => phase.name === "Ramp");
  const takeoff = result.phases.find((phase) => phase.name === "Takeoff");
  const zeroFuel = result.phases.find((phase) => phase.name === "Zero Fuel");
  const landing = result.phases.find((phase) => phase.name === "Landing");

  assert.ok(ramp);
  assert.ok(takeoff);
  assert.ok(zeroFuel);
  assert.ok(landing);
  assert.equal(result.phases.length, 5);
  assert.equal(ramp.weightLb, 2318);
  assert.equal(takeoff.weightLb, 2312);
  assert.equal(zeroFuel.weightLb, 2090);
  assert.equal(landing.weightLb, 2240);
  assert.equal(takeoff.status, "within");
  assert.equal(landing.status, "within");
});

test("envelope interpolation identifies forward and aft CG bounds at a weight", () => {
  const bounds = getCgBoundsAtWeight(profile.envelope, 2250);
  assert.ok(bounds);
  assert.ok(bounds.forward > 37.9 && bounds.forward < 38.1);
  assert.equal(bounds.aft, 47.3);
  assert.equal(pointInEnvelope(profile.envelope, 42, 2250), true);
  assert.equal(pointInEnvelope(profile.envelope, 34, 2250), false);
});

test("fuel burn warning is produced when planned fuel burn exceeds fuel aboard", () => {
  const scenario = createScenarioForProfile(profile);
  scenario.fuelGallons.main = 10;
  scenario.taxiFuelGal = 2;
  scenario.tripFuelGal = 20;

  const result = calculateWeightBalance(profile, scenario);
  assert.match(result.fuelBurnWarning ?? "", /exceeds fuel aboard/);
});
