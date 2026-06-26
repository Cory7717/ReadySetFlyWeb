import test from "node:test";
import assert from "node:assert/strict";
import type { FlightPlan } from "../../shared/schema";
import { resolveDepartureAirportTimezone } from "../../shared/airport-timezones";
import { formatFlightPlanDepartureTime } from "../../shared/flight-plan-time";
import { extractFilingProviderPlanId } from "../../shared/flight-plan-filing";
import { ICAO_OTHER_INFO_GUIDANCE, ICAO_OTHER_INFO_PREFIX_OPTIONS, ICAO_OTHER_INFO_VALUE_OPTIONS, buildIcaoOtherInfo, parseIcaoOtherInfoEntries, parseIcaoSurveillanceCodes } from "../../shared/icao-filing";
import { formatDecimalCoordinatesForLeidos, normalizeZzzzActualLocation } from "../../shared/zzzz-location";
import { buildLeidosActionPayload, buildOtherInfoWithAircraftType, buildOtherInfoWithRemarks, buildZzzzOtherInfoForLeidos, buildZzzzSupplementalRemarks, getProviderDepartureInstantForPlan, normalizeLeidosOtherInfoForTransmission, validateFlightPlanForAction, zonedLocalDateTimeToUtcIso } from "../../server/services/flight-plan-filing/provider";

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
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-06-22T10:00",
    },
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as FlightPlan;
}

test("provider departure instant uses departure airport timezone, not browser timezone", () => {
  const cases = [
    ["KPHX", "America/Phoenix", "2026-06-23T09:30", "2026-06-23T16:30:00.000Z"],
    ["KEDC", "America/Chicago", "2026-06-23T09:30", "2026-06-23T14:30:00.000Z"],
    ["KDEN", "America/Denver", "2026-06-23T09:30", "2026-06-23T15:30:00.000Z"],
    ["KMIA", "America/New_York", "2026-06-23T09:30", "2026-06-23T13:30:00.000Z"],
    ["KLAX", "America/Los_Angeles", "2026-06-23T09:30", "2026-06-23T16:30:00.000Z"],
    ["PHNL", "Pacific/Honolulu", "2026-06-23T09:30", "2026-06-23T19:30:00.000Z"],
    ["PANC", "America/Anchorage", "2026-06-23T09:30", "2026-06-23T17:30:00.000Z"],
  ] as const;

  for (const [departure, timeZone, localDateTime, expectedUtc] of cases) {
    assert.equal(zonedLocalDateTimeToUtcIso(localDateTime, timeZone), expectedUtc);
    assert.equal(getProviderDepartureInstantForPlan(filingPlan({
      departure,
      plannedDepartureAt: new Date("2026-06-23T14:30:00.000Z"),
      plannerState: {
        departureTimeZone: timeZone,
        userDisplayDepartureTimeLocal: localDateTime,
      },
    })), expectedUtc);
  }
});

test("airport timezone resolver covers required filing timezones", () => {
  const cases = [
    ["KPHX", "2026-06-24T10:45", "America/Phoenix", "2026-06-24T17:45:00.000Z"],
    ["KFFZ", "2026-06-23T09:30", "America/Phoenix", "2026-06-23T16:30:00.000Z"],
    ["KEDC", "2026-06-24T10:45", "America/Chicago", "2026-06-24T15:45:00.000Z"],
    ["KDEN", "2026-06-24T10:45", "America/Denver", "2026-06-24T16:45:00.000Z"],
    ["KLAX", "2026-06-24T10:45", "America/Los_Angeles", "2026-06-24T17:45:00.000Z"],
    ["PHNL", "2026-06-24T10:45", "Pacific/Honolulu", "2026-06-24T20:45:00.000Z"],
  ] as const;

  for (const [airport, localDateTime, expectedTimezone, expectedUtc] of cases) {
    const resolution = resolveDepartureAirportTimezone({
      departureAirport: { icao: airport },
    });
    assert.equal(resolution.timezone, expectedTimezone);
    assert.equal(zonedLocalDateTimeToUtcIso(localDateTime, expectedTimezone), expectedUtc);
  }
});

test("KPHX 10:45 local files as 1745Z even if stale saved timezone says Chicago", () => {
  const plan = filingPlan({
    departure: "KPHX",
    plannedDepartureAt: new Date("2026-06-24T15:45:00.000Z"),
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-06-24T10:45",
    },
  });

  assert.equal(getProviderDepartureInstantForPlan(plan), "2026-06-24T17:45:00.000Z");
});

test("KPHX departure display uses airport timezone for 08:45 and 10:45 local", () => {
  const early = filingPlan({
    departure: "KPHX",
    destination: "KEDC",
    plannedDepartureAt: new Date("2026-06-24T15:45:00.000Z"),
    plannerState: {
      departureTimeZone: "America/Phoenix",
      userDisplayDepartureTimeLocal: "2026-06-24T08:45",
    },
  });
  const later = filingPlan({
    departure: "KPHX",
    destination: "KEDC",
    plannedDepartureAt: new Date("2026-06-24T17:45:00.000Z"),
    plannerState: {
      departureTimeZone: "America/Phoenix",
      userDisplayDepartureTimeLocal: "2026-06-24T10:45",
    },
  });

  const earlyDisplay = formatFlightPlanDepartureTime(early);
  assert.equal(earlyDisplay.departureTimezone, "America/Phoenix");
  assert.equal(earlyDisplay.displayTime, "8:45 AM");
  assert.equal(earlyDisplay.displayTimezoneAbbreviation, "MST");
  assert.equal(earlyDisplay.displayZulu, "1545Z");

  const laterDisplay = formatFlightPlanDepartureTime(later);
  assert.equal(laterDisplay.departureTimezone, "America/Phoenix");
  assert.equal(laterDisplay.displayTime, "10:45 AM");
  assert.equal(laterDisplay.displayTimezoneAbbreviation, "MST");
  assert.equal(laterDisplay.displayZulu, "1745Z");
});

test("ZZZZ departure resolves timezone from planning reference airport", () => {
  const resolution = resolveDepartureAirportTimezone({
    departureAirport: { icao: "ZZZZ" },
    planningReferenceDepartureAirport: { icao: "KPHX" },
  });

  assert.equal(resolution.timezone, "America/Phoenix");
  assert.equal(zonedLocalDateTimeToUtcIso("2026-06-24T10:45", resolution.timezone), "2026-06-24T17:45:00.000Z");
});

test("reopened Arizona plan preserves selected local departure time as provider source", () => {
  const plan = filingPlan({
    departure: "KPHX",
    plannedDepartureAt: new Date("2026-06-23T14:30:00.000Z"),
    plannerState: {
      departureTimeZone: "America/Phoenix",
      userDisplayDepartureTimeLocal: "2026-06-23T09:30",
    },
  });

  assert.equal(getProviderDepartureInstantForPlan(plan), "2026-06-23T16:30:00.000Z");
});

test("ZZZZ departure uses planning reference airport timezone stored in planner state", () => {
  const plan = filingPlan({
    departure: "ZZZZ",
    filingDepartureName: "Private air strip",
    plannedDepartureAt: new Date("2026-06-23T14:30:00.000Z"),
    plannerState: {
      planningReferenceDepartureAirport: "KFFZ",
      actualDepartureLocation: "52TS",
      departureTimeZone: "America/Phoenix",
      userDisplayDepartureTimeLocal: "2026-06-23T09:30",
    },
  });

  assert.equal(validateFlightPlanForAction(plan, "file").ready, true);
  assert.equal(getProviderDepartureInstantForPlan(plan), "2026-06-23T16:30:00.000Z");
});

test("filing validation rejects plans without a resolvable departure timezone", () => {
  const result = validateFlightPlanForAction(filingPlan({
    departure: "ZZZZ",
    filingDepartureName: "Private strip",
    plannerState: {
      actualDepartureLocation: "52TS",
      userDisplayDepartureTimeLocal: "2026-06-23T09:30",
    },
  }), "file");

  assert.equal(result.ready, false);
  assert.ok(result.errors.includes("Departure timezone is required when using ZZZZ without a planning reference airport."));
});

test("ZZZZ airports require actual FAA identifiers or lat/long locations", () => {
  const missing = validateFlightPlanForAction(filingPlan({
    departure: "ZZZZ",
    destination: "ZZZZ",
    alternate: "ZZZZ",
  }), "file");
  assert.deepEqual(missing.errors.filter((error) => /FAA identifier or latitude\/longitude/i.test(error)).length, 3);

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
      actualDepartureLocation: "52TS",
      actualDestinationLocation: "3001N09015W",
      actualAlternateLocation: "3015N09122W",
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-06-22T10:00",
    },
  }), "file");
  assert.equal(complete.ready, true);
  assert.equal(normalizeZzzzActualLocation("3027N/09749W"), "3027N/09749W");
  assert.equal(formatDecimalCoordinatesForLeidos(30.45, -97.8167), "3027N09749W");
});

test("ZZZZ airports require human-readable location descriptions", () => {
  const missingDescription = validateFlightPlanForAction(filingPlan({
    departure: "ZZZZ",
    destination: "ZZZZ",
    alternate: "ZZZZ",
    plannerState: {
      planningReferenceDepartureAirport: "KEDC",
      planningReferenceDestinationAirport: "KDAL",
      planningReferenceAlternateAirport: "KADS",
      actualDepartureLocation: "3027N09749W",
      actualDestinationLocation: "3001N09015W",
      actualAlternateLocation: "3015N09122W",
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-06-22T10:00",
    },
  }), "file");

  assert.equal(missingDescription.ready, false);
  assert.equal(
    missingDescription.errors.filter((error) => /brief description of this location/i.test(error)).length,
    3,
  );
});

test("ZZZZ aircraft type requires TYP details in Other Info", () => {
  const missing = validateFlightPlanForAction(filingPlan({
    aircraftType: "ZZZZ",
  }), "file");
  assert.equal(missing.ready, false);
  assert.ok(missing.errors.includes("Actual aircraft type is required when Aircraft Type is ZZZZ."));

  const complete = validateFlightPlanForAction(filingPlan({
    aircraftType: "ZZZZ",
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-06-22T10:00",
      actualAircraftType: "TBM9",
    },
  }), "file");
  assert.equal(complete.ready, true);
  assert.equal(buildOtherInfoWithAircraftType("PBN/A1", "TBM9"), "PBN/A1 TYP/TBM9");
  assert.equal(buildOtherInfoWithAircraftType("PBN/A1 TYPE/OLD", "tbm9"), "PBN/A1 TYP/TBM9");
  assert.equal(buildOtherInfoWithAircraftType("PBN/A1 TYP/OLD", "TBM700"), "PBN/A1 TYP/TBM700");
  assert.equal(buildOtherInfoWithAircraftType("PBN/A1", "TBM-9"), "PBN/A1");
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

test("ICAO filing controls normalize surveillance and Other Info entries", () => {
  assert.deepEqual(parseIcaoSurveillanceCodes("B2 U2"), ["B2", "U2"]);
  assert.ok(ICAO_OTHER_INFO_VALUE_OPTIONS["PBN/"]?.some((option) => option.value === "B2" && /RNAV 5 GNSS/i.test(option.description)));
  assert.ok(ICAO_OTHER_INFO_VALUE_OPTIONS["STS/"]?.some((option) => option.value === "MEDEVAC"));
  assert.equal(
    buildIcaoOtherInfo([
      { prefix: "PBN/", value: "a1b2c2d2s1" },
      { prefix: "NAV/", value: "gps" },
      { prefix: "RMK/", value: "training flight" },
    ]),
    "PBN/A1B2C2D2S1 NAV/GPS RMK/TRAINING FLIGHT",
  );
  assert.deepEqual(parseIcaoOtherInfoEntries("PBN/A1B2C2D2S1 NAV/GPS RMK/TRAINING FLIGHT"), [
    { prefix: "PBN/", value: "A1B2C2D2S1" },
    { prefix: "NAV/", value: "GPS" },
    { prefix: "RMK/", value: "TRAINING FLIGHT" },
  ]);
});

test("ICAO Other Info guidance covers every prefix option", () => {
  for (const option of ICAO_OTHER_INFO_PREFIX_OPTIONS) {
    const guidance = ICAO_OTHER_INFO_GUIDANCE[option.prefix];
    assert.ok(guidance, `${option.prefix} should have guidance metadata`);
    assert.ok(["automatic", "common", "special"].includes(guidance.level));
    assert.ok(guidance.levelLabel);
    assert.ok(guidance.title.includes(option.prefix.replace("/", "")));
    assert.ok(guidance.help);
    assert.ok(guidance.examples.length > 0);
  }
});

test("ICAO validation rejects bad surveillance and warns for equipment dependencies", () => {
  const invalidSurveillance = validateFlightPlanForAction(filingPlan({ filingSurveillanceEquipment: "Q9" }), "file");
  assert.equal(invalidSurveillance.ready, false);
  assert.ok(invalidSurveillance.errors.some((error) => /surveillance equipment must use approved/i.test(error)));

  const flightServiceUnsupportedSurveillance = validateFlightPlanForAction(filingPlan({ filingSurveillanceEquipment: "B2" }), "file");
  assert.equal(flightServiceUnsupportedSurveillance.ready, false);
  assert.ok(flightServiceUnsupportedSurveillance.errors.some((error) => /Flight Service currently accepts N, A, C, or S/i.test(error)));

  const missingPbn = validateFlightPlanForAction(filingPlan({ filingEquipment: "SCR" }), "file");
  assert.equal(missingPbn.ready, false);
  assert.ok(missingPbn.errors.some((error) => /PBN approved.*PBN\//i.test(error)));

  const missingEquipment = validateFlightPlanForAction(filingPlan({
    filingEquipment: "S",
    filingOtherInfo: "PBN/A1B2C2D2S1 NAV/GPS",
  }), "file");
  assert.equal(missingEquipment.ready, true);
  assert.ok(missingEquipment.warnings.some((warning) => /requires additional aircraft equipment codes/i.test(warning)));
});

test("Flight Service otherInfo transmission preserves ICAO RMK remarks", () => {
  assert.equal(
    normalizeLeidosOtherInfoForTransmission(buildOtherInfoWithRemarks("DOF/260623", "TEST MESSAGE")),
    "DOF/260623 RMK/TEST MESSAGE",
  );
  assert.equal(
    normalizeLeidosOtherInfoForTransmission(buildOtherInfoWithRemarks("DOF/260623", "RMK/TEST MESSAGE")),
    "DOF/260623 RMK/TEST MESSAGE",
  );
  assert.equal(
    normalizeLeidosOtherInfoForTransmission(buildOtherInfoWithRemarks("DOF/260623 RMK/OLD MESSAGE", "RMK/TEST MESSAGE")),
    "DOF/260623 RMK/TEST MESSAGE",
  );
  assert.equal(
    normalizeLeidosOtherInfoForTransmission(buildOtherInfoWithRemarks("PBN/A1 RMK/TEST MESSAGE DOF/260623", null)),
    "PBN/A1 DOF/260623 RMK/TEST MESSAGE",
  );
});

test("Flight Service payload puts normal filing remarks in Field 18 RMK and keeps supplemental remarks empty", () => {
  const payload = buildLeidosActionPayload(filingPlan({
    filingRemarks: "TEST REMARK",
    filingOtherInfo: "PBN/A1",
  }), "file", { otherInfo: null } as any);
  const fields = Object.fromEntries(payload.params.entries());

  assert.equal(fields.remarks, "TEST REMARK");
  assert.equal(fields.otherInfo, "PBN/A1 RMK/TEST REMARK");
  assert.equal(fields.suppRemarksExtended, undefined);
  assert.equal(fields.pilotPhone, "5125550100");
  assert.equal(fields.aircraftHomeBase, "KEDC");
});

test("Flight Service payload collapses user-entered RMK prefix to one outbound RMK", () => {
  const fromRemarks = Object.fromEntries(buildLeidosActionPayload(filingPlan({
    filingRemarks: "RMK/TEST MESSAGE",
    filingOtherInfo: "PBN/A1",
  }), "file", { otherInfo: null } as any).params.entries());
  assert.equal(fromRemarks.otherInfo, "PBN/A1 RMK/TEST MESSAGE");
  assert.doesNotMatch(String(fromRemarks.otherInfo), /RMK\/RMK\//);

  const fromOtherInfo = Object.fromEntries(buildLeidosActionPayload(filingPlan({
    filingRemarks: null,
    notes: "TEST MESSAGE",
    filingOtherInfo: "PBN/A1 RMK/TEST MESSAGE",
  }), "file", { otherInfo: null } as any).params.entries());
  assert.equal(fromOtherInfo.otherInfo, "PBN/A1 RMK/TEST MESSAGE");
  assert.doesNotMatch(String(fromOtherInfo.otherInfo), /RMK\/RMK\//);
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
      departureLocation: "52TS",
      destinationLocation: "3001N09015W",
      alternateLocation: "3015N09122W",
    }),
    "DOF/260623 DEP/52TS DEST/3001N09015W DEMO DESTINATION STRIP ALTN/3015N09122W DEMO ALTERNATE STRIP",
  );
  assert.equal(
    normalizeLeidosOtherInfoForTransmission("DOF/260623 DEP/Demo departure strip"),
    "DOF/260623 DEP/DEMO DEPARTURE STRIP",
  );
  assert.equal(
    buildZzzzOtherInfoForLeidos("DOF/260623 DEP/OLD VALUE", {
      departureName: "Private field",
      departureLocation: "3027N/09749W",
    }),
    "DOF/260623 DEP/3027N/09749W PRIVATE FIELD",
  );
});

test("ZZZZ departure, destination, and alternate Field 18 entries include coordinates and descriptions", () => {
  assert.equal(
    buildZzzzOtherInfoForLeidos(null, {
      departureLocation: "3027N09749W",
      departureName: "Private Strip",
    }),
    "DEP/3027N09749W PRIVATE STRIP",
  );
  assert.equal(
    buildZzzzOtherInfoForLeidos(null, {
      destinationLocation: "3027N09749W",
      destinationName: "Smith Ranch",
    }),
    "DEST/3027N09749W SMITH RANCH",
  );
  assert.equal(
    buildZzzzOtherInfoForLeidos(null, {
      alternateLocation: "3839N09045W",
      alternateName: "Grass Airstrip",
    }),
    "ALTN/3839N09045W GRASS AIRSTRIP",
  );
});

test("ZZZZ alternate private field code does not append airport name", () => {
  assert.equal(
    buildZzzzOtherInfoForLeidos("DOF/260627 RMK/ZZZZ ALTERNATE VALIDATION TEST ALTN/RUTHERFORD RANCH AIRPORT", {
      alternateLocation: "85TX",
      alternateName: "Rutherford Ranch Airport",
    }),
    "DOF/260627 RMK/ZZZZ ALTERNATE VALIDATION TEST ALTN/85TX",
  );
});

test("ZZZZ alternate private field filing keeps altDestination1 ZZZZ and sends only ALTN code", () => {
  const payload = buildLeidosActionPayload(filingPlan({
    departure: "KDWH",
    destination: "KSDL",
    alternate: "ZZZZ",
    route: "DCT",
    filingOtherInfo: "DOF/260627",
    filingRemarks: "ZZZZ ALTERNATE VALIDATION TEST",
    filingAlternateName: "Rutherford Ranch Airport",
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-06-27T10:00",
      planningReferenceAlternateAirport: "KSDL",
      actualAlternateLocationMode: "identifier",
      actualAlternateLocation: "85TX",
    },
  }), "file", { otherInfo: null } as any);
  const fields = Object.fromEntries(payload.params.entries());

  assert.equal(fields.altDestination1, "ZZZZ");
  assert.equal(fields.otherInfo, "DOF/260627 RMK/ZZZZ ALTERNATE VALIDATION TEST ALTN/85TX");
  assert.doesNotMatch(String(fields.otherInfo), /RUTHERFORD/i);
  assert.equal(String(fields.otherInfo).match(/\bALTN\//g)?.length, 1);
});

test("ZZZZ departure private field filing keeps departure ZZZZ and sends only DEP code", () => {
  const payload = buildLeidosActionPayload(filingPlan({
    departure: "ZZZZ",
    destination: "KSDL",
    alternate: null,
    route: "DCT",
    filingOtherInfo: "DOF/260627",
    filingRemarks: "ZZZZ DEPARTURE VALIDATION TEST",
    filingDepartureName: "Rutherford Ranch Airport",
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-06-27T10:00",
      planningReferenceDepartureAirport: "KDWH",
      actualDepartureLocationMode: "identifier",
      actualDepartureLocation: "85TX",
    },
  }), "file", { otherInfo: null } as any);
  const fields = Object.fromEntries(payload.params.entries());

  assert.equal(fields.departure, "ZZZZ");
  assert.equal(fields.destination, "KSDL");
  assert.match(String(fields.otherInfo), /\bDEP\/85TX\b/);
  assert.doesNotMatch(String(fields.otherInfo), /DEP\/RUTHERFORD/i);
  assert.doesNotMatch(String(fields.otherInfo), /RUTHERFORD/i);
  assert.equal(String(fields.otherInfo).match(/\bDEP\//g)?.length, 1);
});

test("ZZZZ destination private field filing keeps destination ZZZZ and sends only DEST code", () => {
  const payload = buildLeidosActionPayload(filingPlan({
    departure: "KDWH",
    destination: "ZZZZ",
    alternate: null,
    route: "DCT",
    filingOtherInfo: "DOF/260627",
    filingRemarks: "ZZZZ DESTINATION VALIDATION TEST",
    filingDestinationName: "Rutherford Ranch Airport",
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-06-27T10:00",
      planningReferenceDestinationAirport: "KSDL",
      actualDestinationLocationMode: "identifier",
      actualDestinationLocation: "85TX",
    },
  }), "file", { otherInfo: null } as any);
  const fields = Object.fromEntries(payload.params.entries());

  assert.equal(fields.departure, "KDWH");
  assert.equal(fields.destination, "ZZZZ");
  assert.match(String(fields.otherInfo), /\bDEST\/85TX\b/);
  assert.doesNotMatch(String(fields.otherInfo), /DEST\/RUTHERFORD/i);
  assert.doesNotMatch(String(fields.otherInfo), /RUTHERFORD/i);
  assert.equal(String(fields.otherInfo).match(/\bDEST\//g)?.length, 1);
});

test("ZZZZ private field codes for departure destination and alternate do not append names or duplicate subfields", () => {
  const payload = buildLeidosActionPayload(filingPlan({
    departure: "ZZZZ",
    destination: "ZZZZ",
    alternate: "ZZZZ",
    route: "DCT",
    filingOtherInfo: "DOF/260627",
    filingRemarks: "ZZZZ ALL PRIVATE FIELD VALIDATION TEST",
    filingDepartureName: "Rutherford Ranch Airport",
    filingDestinationName: "Private Destination Airport",
    filingAlternateName: "Private Alternate Airport",
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-06-27T10:00",
      planningReferenceDepartureAirport: "KDWH",
      planningReferenceDestinationAirport: "KSDL",
      planningReferenceAlternateAirport: "KSDL",
      actualDepartureLocationMode: "identifier",
      actualDepartureLocation: "85TX",
      actualDestinationLocationMode: "identifier",
      actualDestinationLocation: "TX03",
      actualAlternateLocationMode: "identifier",
      actualAlternateLocation: "87TX",
    },
  }), "file", { otherInfo: null } as any);
  const fields = Object.fromEntries(payload.params.entries());
  const otherInfo = String(fields.otherInfo);

  assert.equal(fields.departure, "ZZZZ");
  assert.equal(fields.destination, "ZZZZ");
  assert.equal(fields.altDestination1, "ZZZZ");
  assert.match(otherInfo, /\bDEP\/85TX\b/);
  assert.match(otherInfo, /\bDEST\/TX03\b/);
  assert.match(otherInfo, /\bALTN\/87TX\b/);
  assert.equal(otherInfo.match(/\bDEP\//g)?.length, 1);
  assert.equal(otherInfo.match(/\bDEST\//g)?.length, 1);
  assert.equal(otherInfo.match(/\bALTN\//g)?.length, 1);
  assert.doesNotMatch(otherInfo, /RUTHERFORD|PRIVATE DESTINATION|PRIVATE ALTERNATE/i);
  assert.doesNotMatch(otherInfo, /\b\d{4}[NS]\/?\d{4,5}[EW]\b/);
});

test("non-ZZZZ filing does not add ZZZZ location Field 18 entries", () => {
  const payload = buildLeidosActionPayload(filingPlan({
    departure: "KAUS",
    destination: "KDEN",
    alternate: "KCOS",
    filingOtherInfo: "PBN/A1",
    filingDepartureName: "Private Strip",
    filingDestinationName: "Smith Ranch",
    filingAlternateName: "Grass Airstrip",
    plannerState: {
      actualDepartureLocation: "3027N09749W",
      actualDestinationLocation: "3027N09749W",
      actualAlternateLocation: "3839N09045W",
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-06-22T10:00",
    },
  }), "file", { otherInfo: null } as any);
  const fields = Object.fromEntries(payload.params.entries());

  assert.equal(fields.otherInfo, "PBN/A1 RMK/LEIDOS DEMO");
  assert.doesNotMatch(String(fields.otherInfo), /\bDEP\//);
  assert.doesNotMatch(String(fields.otherInfo), /\bDEST\//);
  assert.doesNotMatch(String(fields.otherInfo), /\bALTN\//);
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

test("provider push review blocks filing actions until acknowledged", () => {
  const pendingReview = filingPlan({
    filingStatus: "filed",
    filingProviderPlanId: "FS-PENDING-1",
    filingIsLive: true,
    filingProviderSnapshot: {
      providerPendingReview: true,
      providerLifecycleStatus: "filed",
    } as any,
  });

  for (const action of ["amend", "activate", "cancel", "close"] as const) {
    const result = validateFlightPlanForAction(pendingReview, action);
    assert.equal(result.ready, false);
    assert.ok(result.errors.some((error) => /Flight Service has updated/i.test(error)));
  }

  const accepted = filingPlan({
    ...pendingReview,
    filingProviderSnapshot: {
      providerPendingReview: false,
      providerLifecycleStatus: "filed",
    } as any,
  });
  assert.equal(validateFlightPlanForAction(accepted, "amend").ready, true);
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
