import test from "node:test";
import assert from "node:assert/strict";
import type { FlightPlan } from "../../shared/schema";
import { extractFilingProviderPlanId } from "../../shared/flight-plan-filing";
import { buildZzzzOtherInfoForLeidos, buildZzzzSupplementalRemarks, normalizeLeidosOtherInfoForTransmission, validateFlightPlanForAction } from "../../server/services/flight-plan-filing/provider";

function filingPlan(overrides: Partial<FlightPlan> = {}): FlightPlan {
  return {
    id: "demo-plan",
    userId: "demo-user",
    title: "Leidos demo",
    departure: "KEDC",
    destination: "KDAL",
    route: "DCT",
    alternate: null,
    plannedDepartureAt: new Date("2026-06-22T15:00:00.000Z"),
    plannedArrivalAt: new Date("2026-06-22T16:00:00.000Z"),
    aircraftType: "C172",
    tailNumber: "N123RS",
    fuelOnBoard: "40",
    fuelRequired: "15",
    filingFlightRules: "VFR",
    filingEquipment: "S",
    filingSoulsOnBoard: "2",
    filingAircraftColor: "WHITE BLUE",
    filingPilotName: "Demo Pilot",
    filingPilotPhone: "5125550100",
    filingAircraftHomeBase: "KEDC",
    filingRemarks: "LEIDOS DEMO",
    filingWakeTurbulence: "LIGHT",
    filingTypeOfFlight: "G",
    filingSurveillanceEquipment: "C",
    filingOtherInfo: null,
    filingTrueAirspeedKtas: 110,
    filingPlannedAltitudeFt: 5500,
    filingEstimatedEnrouteMinutes: 60,
    filingEnduranceMinutes: 240,
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
    plannerState: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as FlightPlan;
}

test("ZZZZ is accepted as the aircraft identifier", () => {
  const result = validateFlightPlanForAction(filingPlan({ tailNumber: "ZZZZ" }), "file");
  assert.equal(result.ready, true);
  assert.equal(result.errors.some((error) => /aircraft id/i.test(error)), false);
});

test("ZZZZ airports require their supplemental location names", () => {
  const missing = validateFlightPlanForAction(filingPlan({
    departure: "ZZZZ",
    destination: "ZZZZ",
    alternate: "ZZZZ",
  }), "file");
  assert.deepEqual(missing.errors.filter((error) => /actual .* location name/i.test(error)).length, 3);

  const complete = validateFlightPlanForAction(filingPlan({
    departure: "ZZZZ",
    destination: "ZZZZ",
    alternate: "ZZZZ",
    filingDepartureName: "Demo departure strip",
    filingDestinationName: "Demo destination strip",
    filingAlternateName: "Demo alternate strip",
    plannerState: {
      planningReferenceDepartureAirport: "KEDC",
      planningReferenceDestinationAirport: "KDAL",
      planningReferenceAlternateAirport: "KADS",
    },
  }), "file");
  assert.equal(complete.ready, true);
});

test("filing does not silently default operational ICAO fields", () => {
  const result = validateFlightPlanForAction(filingPlan({
    filingPilotName: null,
    filingSoulsOnBoard: null,
    filingWakeTurbulence: null,
    filingTypeOfFlight: null,
    filingSurveillanceEquipment: null,
  }), "file");

  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) => /pilot in command/i.test(error)));
  assert.ok(result.errors.some((error) => /souls on board/i.test(error)));
  assert.ok(result.errors.some((error) => /wake turbulence/i.test(error)));
  assert.ok(result.errors.some((error) => /type of flight/i.test(error)));
  assert.ok(result.errors.some((error) => /surveillance equipment/i.test(error)));
});

test("Leidos otherInfo transmission omits duplicated remarks", () => {
  assert.equal(
    normalizeLeidosOtherInfoForTransmission("DOF/260623 RMK/RSF_INTERNAL_FILING_PREVIEW"),
    "DOF/260623",
  );
});

test("ZZZZ location names are transmitted in otherInfo while supplemental remarks stay clean", () => {
  assert.equal(
    buildZzzzSupplementalRemarks("LEIDOS DEMO", {
      departureName: "Demo departure strip",
      destinationName: "Demo destination strip",
      alternateName: "Demo alternate strip",
    }),
    "LEIDOS DEMO",
  );
  assert.equal(
    buildZzzzOtherInfoForLeidos("DOF/260623", {
      departureName: "Demo departure strip",
      destinationName: "Demo destination strip",
      alternateName: "Demo alternate strip",
    }),
    "DOF/260623 DEP/DEMO DEPARTURE STRIP DEST/DEMO DESTINATION STRIP ALTN/DEMO ALTERNATE STRIP",
  );
  assert.equal(
    normalizeLeidosOtherInfoForTransmission("DOF/260623 DEP/Demo departure strip"),
    "DOF/260623 DEP/DEMO DEPARTURE STRIP",
  );
});

test("Leidos FILE flightIdentifier is accepted as the provider plan id", () => {
  assert.equal(
    extractFilingProviderPlanId({
      returnStatus: true,
      versionStamp: "20260622153435610",
      flightIdentifier: "651864278_696243_7021",
    }),
    "651864278_696243_7021",
  );
});

test("VFR and IFR lifecycle action matrix matches the Leidos demo", () => {
  assert.equal(validateFlightPlanForAction(filingPlan(), "file").ready, true);

  const filedVfr = filingPlan({
    filingStatus: "filed",
    filingProviderPlanId: "LEIDOS-VFR-1",
  });
  assert.equal(validateFlightPlanForAction(filedVfr, "amend").ready, true);
  assert.equal(validateFlightPlanForAction(filedVfr, "activate").ready, true);
  assert.equal(validateFlightPlanForAction(filedVfr, "cancel").ready, true);

  const activeVfr = filingPlan({
    filingStatus: "activated",
    filingProviderPlanId: "LEIDOS-VFR-1",
    plannedArrivalAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  assert.equal(validateFlightPlanForAction(activeVfr, "close").ready, true);

  const filedIfr = filingPlan({
    filingFlightRules: "IFR",
    filingStatus: "filed",
    filingProviderPlanId: "LEIDOS-IFR-1",
  });
  assert.equal(validateFlightPlanForAction(filedIfr, "amend").ready, true);
  assert.equal(validateFlightPlanForAction(filedIfr, "cancel").ready, true);
  assert.equal(validateFlightPlanForAction(filedIfr, "activate").ready, false);
  assert.equal(validateFlightPlanForAction(filedIfr, "close").ready, false);
});

test("overdue VFR close requires an actual close location", () => {
  const overdue = filingPlan({
    filingStatus: "activated",
    filingProviderPlanId: "LEIDOS-VFR-OVERDUE",
    plannedArrivalAt: new Date(Date.now() - 60 * 60 * 1000),
  });
  const missingLocation = validateFlightPlanForAction(overdue, "close");
  assert.equal(missingLocation.ready, false);
  assert.ok(missingLocation.errors.some((error) => /actual close location/i.test(error)));

  const withLocation = validateFlightPlanForAction({
    ...overdue,
    filingCloseLocation: "KEDC ramp",
  }, "close");
  assert.equal(withLocation.ready, true);
});
