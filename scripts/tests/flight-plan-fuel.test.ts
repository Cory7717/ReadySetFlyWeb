import test from "node:test";
import assert from "node:assert/strict";
import type { FlightPlan } from "../../shared/schema";
import {
  buildFuelEnduranceState,
  calculateFuelEnduranceMinutes,
  calculateFuelRequiredGallons,
  formatFuelDurationClock,
  resolveAuthoritativeEteMinutes,
} from "../../shared/flight-plan-fuel";
import { buildLeidosActionPayload } from "../../server/services/flight-plan-filing/provider";

const basePlan = {
  id: "fuel-sync-plan",
  userId: "demo-user",
  title: "Fuel sync",
  departure: "KBOS",
  destination: "KSEA",
  route: "ALB DCT SYR DCT BOI",
  alternate: null,
  plannedDepartureAt: new Date("2026-07-15T14:00:00.000Z"),
  plannedArrivalAt: new Date("2026-07-15T19:35:00.000Z"),
  aircraftType: "C208",
  tailNumber: "N123RS",
  fuelOnBoard: "750",
  fuelRequired: "634.1",
  filingFlightRules: "IFR",
  filingEquipment: "SR",
  filingSoulsOnBoard: "2",
  filingAircraftColor: "WHITE",
  filingPilotName: "Demo Pilot",
  filingPilotPhone: "5125550100",
  filingAircraftHomeBase: "KBOS",
  filingRemarks: "RSF TEST",
  filingWakeTurbulence: "LIGHT",
  filingTypeOfFlight: "G",
  filingSurveillanceEquipment: "C",
  filingOtherInfo: "PBN/A1",
  filingTrueAirspeedKtas: 210,
  filingPlannedAltitudeFt: 9000,
  filingEstimatedEnrouteMinutes: 335,
  filingEnduranceMinutes: 450,
  filingStatus: "draft",
  filingProvider: "leidos_flight_service",
  filingProviderPlanId: null,
  filingPendingAction: null,
  filingIsLive: false,
  filedAt: null,
  activatedAt: null,
  cancelledAt: null,
  closedAt: null,
  filingLastProviderSyncAt: null,
  filingPayload: null,
  filingProviderSnapshot: null,
  filingProviderMessages: [],
  filingAssignedBeaconCode: null,
  filingRaw: null,
  filingActionHistory: [],
  plannerState: {
    departureTimeZone: "America/New_York",
    userDisplayDepartureTimeLocal: "2026-07-15T10:00",
    calculatedEteMinutes: 335,
    calculatedEnduranceMinutes: 450,
    transmittedFuelEnduranceMinutes: 450,
    fuelAvailableGallons: 750,
    fuelBurnGph: 100,
    reserveMinutes: 45,
    filingEnduranceSource: "calculated_from_fuel_and_burn",
  },
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as FlightPlan;

test("fuel aboard and burn calculate endurance in whole minutes", () => {
  assert.equal(calculateFuelEnduranceMinutes(750, 100), 450);
  assert.equal(formatFuelDurationClock(450), "7:30");
});

test("fuel required and surplus use the authoritative ETE", () => {
  const fuel = calculateFuelRequiredGallons({
    eteMinutes: 335.46,
    fuelBurnGph: 100,
    reserveMinutes: 45,
  });

  assert.equal(fuel.tripFuelGallons.toFixed(1), "559.1");
  assert.equal(fuel.totalRequiredFuelGallons.toFixed(1), "634.1");
  assert.equal((750 - fuel.totalRequiredFuelGallons).toFixed(1), "115.9");
});

test("stale saved legacy ETE cannot override route-derived ETE", () => {
  const displayedEte = resolveAuthoritativeEteMinutes({
    routeDerivedEteMinutes: 335,
    legacyManualEstimatedEnrouteMinutes: 240,
  });
  const readinessEte = resolveAuthoritativeEteMinutes({
    routeDerivedEteMinutes: 335,
    legacyManualEstimatedEnrouteMinutes: 999,
  });
  const savedEte = resolveAuthoritativeEteMinutes({
    routeDerivedEteMinutes: 335,
    legacyManualEstimatedEnrouteMinutes: null,
  });

  const payload = buildLeidosActionPayload({
    ...basePlan,
    filingEstimatedEnrouteMinutes: savedEte,
    plannerState: {
      ...(basePlan.plannerState as Record<string, unknown>),
      manualEstimatedEnrouteMinutes: 240,
    },
  } as FlightPlan, "file", { otherInfo: null } as any);

  assert.equal(displayedEte, 335);
  assert.equal(readinessEte, 335);
  assert.equal(savedEte, 335);
  assert.equal(payload.params.get("flightDuration"), "PT5H35M");
});

test("filed endurance defaults to calculated endurance when manual override is off", () => {
  const state = buildFuelEnduranceState({
    eteMinutes: 335,
    fuelOnBoardGallons: 750,
    fuelBurnGph: 100,
    manualEnduranceMinutes: 240,
    manualOverrideEnabled: false,
  });

  assert.equal(state.filedEnduranceMinutes, 450);
  assert.equal(state.source, "calculated_from_fuel_and_burn");
});

test("manual override below ETE is a conflict and local block", () => {
  const state = buildFuelEnduranceState({
    eteMinutes: 335,
    fuelOnBoardGallons: 750,
    fuelBurnGph: 100,
    manualEnduranceMinutes: 240,
    manualOverrideEnabled: true,
  });

  assert.equal(state.filedEnduranceMinutes, 240);
  assert.equal(state.isDeficient, true);
  assert.equal(state.manualDiffersMaterially, true);
  assert.equal(state.manualDifferenceMinutes, -210);
});

test("changing fuel aboard or burn changes filed endurance when manual override is off", () => {
  assert.equal(buildFuelEnduranceState({
    eteMinutes: 335,
    fuelOnBoardGallons: 750,
    fuelBurnGph: 100,
    manualOverrideEnabled: false,
  }).filedEnduranceMinutes, 450);
  assert.equal(buildFuelEnduranceState({
    eteMinutes: 335,
    fuelOnBoardGallons: 600,
    fuelBurnGph: 120,
    manualOverrideEnabled: false,
  }).filedEnduranceMinutes, 300);
});

test("saved plan and provider payload use the same ETE and filed endurance minutes", () => {
  const payload = buildLeidosActionPayload(basePlan, "file", { otherInfo: null } as any);
  assert.equal(basePlan.filingEstimatedEnrouteMinutes, 335);
  assert.equal(basePlan.filingEnduranceMinutes, 450);
  assert.equal(payload.params.get("flightDuration"), "PT5H35M");
  assert.equal(payload.params.get("fuelOnBoard"), "PT7H30M");
});
