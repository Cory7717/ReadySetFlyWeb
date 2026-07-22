import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { FlightPlan } from "../../shared/schema";
import { resolveDepartureAirportTimezone } from "../../shared/airport-timezones";
import { formatFlightPlanDepartureTime } from "../../shared/flight-plan-time";
import { extractFilingProviderPlanId, isGenuineFilingProviderPlanId } from "../../shared/flight-plan-filing";
import { ICAO_OTHER_INFO_GUIDANCE, ICAO_OTHER_INFO_PREFIX_OPTIONS, ICAO_OTHER_INFO_VALUE_OPTIONS, buildIcaoOtherInfo, parseIcaoOtherInfoEntries, parseIcaoSurveillanceCodes } from "../../shared/icao-filing";
import { formatDecimalCoordinatesForLeidos, normalizeZzzzActualLocation } from "../../shared/zzzz-location";
import { LeidosFlightPlanFilingProvider, buildLeidosActionPayload, buildOtherInfoWithAircraftType, buildOtherInfoWithRemarks, buildZzzzOtherInfoForLeidos, buildZzzzSupplementalRemarks, compareRetrievedProviderPlanFields, findLikelyDuplicateFlightPlan, getProviderDepartureInstantForPlan, normalizeLeidosOtherInfoForTransmission, redactLeidosPayloadForLog, setLeidosHttpsRequestForTesting, syncLeidosPlanMetadata, validateFlightPlanForAction, zonedLocalDateTimeToUtcIso } from "../../server/services/flight-plan-filing/provider";

const futureChicagoDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));
const testDepartureLocal = `${futureChicagoDate}T10:00`;
const testDepartureAt = new Date(zonedLocalDateTimeToUtcIso(testDepartureLocal, "America/Chicago")!);
const testArrivalAt = new Date(testDepartureAt.getTime() + 60 * 60 * 1000);
const testDof = futureChicagoDate.slice(2).replaceAll("-", "");

type MockLeidosResponse = {
  status?: number;
  contentType?: string;
  body?: unknown;
  error?: Error;
};

const withMockedLeidosProvider = async (
  responses: MockLeidosResponse[],
  run: (calls: Array<{ url: string; method: string; body: string }>) => Promise<void>,
) => {
  const envKeys = [
    "FLIGHT_SERVICE_ENVIRONMENT",
    "LEIDOS_FLIGHT_SERVICE_ENABLE_LIVE",
    "LEIDOS_FLIGHT_SERVICE_USERNAME",
    "LEIDOS_FLIGHT_SERVICE_PASSWORD",
    "LEIDOS_FLIGHT_SERVICE_FILE_PATH",
    "LEIDOS_FLIGHT_SERVICE_AMEND_PATH",
    "LEIDOS_FLIGHT_SERVICE_ACTIVATE_PATH",
    "LEIDOS_FLIGHT_SERVICE_CANCEL_PATH",
    "LEIDOS_FLIGHT_SERVICE_CLOSE_PATH",
    "LEIDOS_FLIGHT_SERVICE_RETRIEVE_PATH",
    "LEIDOS_FLIGHT_SERVICE_REQUEST_TIMEOUT_MS",
  ];
  const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  process.env.FLIGHT_SERVICE_ENVIRONMENT = "LAB";
  process.env.LEIDOS_FLIGHT_SERVICE_ENABLE_LIVE = "true";
  process.env.LEIDOS_FLIGHT_SERVICE_USERNAME = "test-user";
  process.env.LEIDOS_FLIGHT_SERVICE_PASSWORD = "test-password";
  process.env.LEIDOS_FLIGHT_SERVICE_FILE_PATH = "FP/file";
  process.env.LEIDOS_FLIGHT_SERVICE_AMEND_PATH = "FP/{providerPlanId}/amend";
  process.env.LEIDOS_FLIGHT_SERVICE_ACTIVATE_PATH = "FP/{providerPlanId}/activate";
  process.env.LEIDOS_FLIGHT_SERVICE_CANCEL_PATH = "FP/{providerPlanId}/cancel";
  process.env.LEIDOS_FLIGHT_SERVICE_CLOSE_PATH = "FP/{providerPlanId}/close";
  process.env.LEIDOS_FLIGHT_SERVICE_RETRIEVE_PATH = "FP/{providerPlanId}/retrieve";
  process.env.LEIDOS_FLIGHT_SERVICE_REQUEST_TIMEOUT_MS = "5000";

  const calls: Array<{ url: string; method: string; body: string }> = [];
  const queue = [...responses];
  setLeidosHttpsRequestForTesting(((url: URL, options: any, callback: (incoming: EventEmitter & { statusCode?: number; statusMessage?: string; headers: Record<string, string> }) => void) => {
    const request = new EventEmitter() as EventEmitter & {
      setTimeout: (timeoutMs: number, handler: () => void) => void;
      write: (chunk: Buffer | string) => void;
      end: () => void;
      destroy: (error?: Error) => void;
    };
    let body = "";
    request.setTimeout = () => undefined;
    request.write = (chunk) => {
      body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    };
    request.destroy = (error) => {
      if (error) queueMicrotask(() => request.emit("error", error));
    };
    request.end = () => {
      calls.push({ url: url.toString(), method: String(options?.method || "GET"), body });
      const response = queue.shift() || { status: 500, body: { returnStatus: false, messages: ["Unexpected mocked request."] } };
      if (response.error) {
        queueMicrotask(() => request.emit("error", response.error));
        return;
      }
      const incoming = new EventEmitter() as EventEmitter & { statusCode?: number; statusMessage?: string; headers: Record<string, string> };
      incoming.statusCode = response.status ?? 200;
      incoming.statusMessage = incoming.statusCode >= 400 ? "ERROR" : "OK";
      incoming.headers = { "content-type": response.contentType || "application/json" };
      const responseBody = typeof response.body === "string"
        ? response.body
        : JSON.stringify(response.body ?? {});
      queueMicrotask(() => {
        callback(incoming);
        incoming.emit("data", Buffer.from(responseBody, "utf8"));
        incoming.emit("end");
      });
    };
    return request as any;
  }) as any);

  try {
    await run(calls);
  } finally {
    setLeidosHttpsRequestForTesting(null);
    for (const key of envKeys) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
  }
};

function filingPlan(overrides: Partial<FlightPlan> = {}): FlightPlan {
  return {
    id: "demo-plan",
    userId: "demo-user",
    title: "Leidos demo",
    departure: "KEDC",
    destination: "KDAL",
    route: "DCT",
    alternate: null,
    plannedDepartureAt: testDepartureAt,
    plannedArrivalAt: testArrivalAt,
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
      userDisplayDepartureTimeLocal: testDepartureLocal,
    },
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as FlightPlan;
}

test("provider departure instant uses departure airport timezone, not browser timezone", () => {
  const cases = [
    ["KPBI", "America/New_York", "2026-07-15T10:00", "2026-07-15T14:00:00.000Z"],
    ["KLAS", "America/Los_Angeles", "2026-07-15T10:00", "2026-07-15T17:00:00.000Z"],
    ["KPHX", "America/Phoenix", "2026-07-15T10:00", "2026-07-15T17:00:00.000Z"],
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
        departureTimeZone: "America/Chicago",
        userDisplayDepartureTimeLocal: localDateTime,
      },
    })), expectedUtc);
  }
});

test("fuel endurance shorter than ETE is blocked before provider submission", () => {
  const result = validateFlightPlanForAction(filingPlan({
    filingEstimatedEnrouteMinutes: 328,
    filingEnduranceMinutes: 240,
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: testDepartureLocal,
      fuelAvailableGallons: 40,
      fuelBurnGph: 10,
      calculatedEnduranceMinutes: 240,
      reserveMinutes: 45,
      filingEnduranceSource: "manual_icao_endurance",
    },
  }), "file");

  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) =>
    error.includes("Fuel endurance is 4:00, but estimated time enroute is 5:28.")
  ));
});

test("fuel endurance greater than ETE passes local endurance validation", () => {
  const result = validateFlightPlanForAction(filingPlan({
    filingEstimatedEnrouteMinutes: 300,
    filingEnduranceMinutes: 360,
  }), "file");

  assert.equal(result.ready, true);
  assert.equal(result.errors.some((error) => error.includes("Fuel endurance is")), false);
});

test("Leidos payload route removes endpoint airports without globally trimming DCT", () => {
  const routeFor = (route: string, departure = "KBOS", destination = "KSEA") => {
    const payload = buildLeidosActionPayload(filingPlan({
      departure,
      destination,
      route,
      filingFlightRules: "IFR",
      filingEquipment: "SR",
      filingOtherInfo: "PBN/A1",
    }), "file", { otherInfo: null } as any);
    return payload.params.get("route");
  };

  assert.equal(routeFor("KBOS DCT ALB DCT KSEA"), "ALB");
  assert.equal(routeFor("KBOS DCT ALB DCT SYR DCT KSEA"), "ALB DCT SYR");
  assert.equal(routeFor("DCT ALB J60 BOI"), "DCT ALB J60 BOI");
  assert.equal(routeFor("ALB J60 BOI DCT"), "ALB J60 BOI DCT");
  assert.equal(routeFor("DCT"), "DCT");
  assert.equal(routeFor("KBOS DCT KSEA"), "DCT");
  assert.equal(routeFor("ALB DCT DCT SYR"), "ALB DCT SYR");
  assert.equal(routeFor("ALB DCT KBOS DCT SYR DCT KSEA DCT BOI"), "ALB DCT KBOS DCT SYR DCT KSEA DCT BOI");
  assert.equal(routeFor("DALL3 EIC V18 MEI LGC4"), "DALL3 EIC V18 MEI LGC4");
  assert.equal(routeFor("DCT EMI/D01+40 DCT MAPEL/D00+30 V143 DELRO DCT"), "DCT EMI/D01+40 DCT MAPEL/D00+30 V143 DELRO DCT");
});

test("Leidos payload logs redact pilot phone while retaining population metadata", () => {
  const phone = "15124121762";
  const payload = buildLeidosActionPayload(
    filingPlan({ filingPilotPhone: phone }),
    "file",
    { otherInfo: null } as any,
  ).payloadSnapshot!.transmittedFields;
  const loggedPayload = redactLeidosPayloadForLog(payload);
  const logEntry = {
    event: "leidos_payload_built",
    pilotPhonePopulated: Boolean(payload.pilotPhone),
    payload: loggedPayload,
  };

  assert.equal(logEntry.pilotPhonePopulated, true);
  assert.equal(loggedPayload.pilotPhone, "[redacted]");
  assert.equal(loggedPayload.pilotData, "[redacted]");
  assert.equal(JSON.stringify(logEntry).includes(phone), false);
});

test("local FILE duplicate detection blocks an exact provider-filed signature", () => {
  const proposed = filingPlan({ id: "proposed" });
  const existing = filingPlan({
    id: "existing",
    filingProviderPlanId: "provider-existing",
    filingIsLive: true,
    filingStatus: "filed",
  });

  assert.equal(findLikelyDuplicateFlightPlan(proposed, [existing])?.id, "existing");
});

test("local FILE duplicate detection allows meaningful signature changes", () => {
  const proposed = filingPlan({ id: "proposed" });
  const baseExisting = {
    id: "existing",
    filingProviderPlanId: "provider-existing",
    filingIsLive: true,
    filingStatus: "filed",
  } satisfies Partial<FlightPlan>;
  const nonDuplicates = [
    filingPlan({ ...baseExisting, tailNumber: "N456RS" }),
    filingPlan({ ...baseExisting, filingFlightRules: "IFR" }),
    filingPlan({ ...baseExisting, departure: "KAUS" }),
    filingPlan({ ...baseExisting, destination: "KACT" }),
    filingPlan({
      ...baseExisting,
      plannedDepartureAt: new Date(testDepartureAt.getTime() + 10 * 60_000),
      plannerState: {
        departureTimeZone: "America/Chicago",
        userDisplayDepartureTimeLocal: `${futureChicagoDate}T10:10`,
      },
    }),
    filingPlan({ ...baseExisting, route: "DCT ACT DCT" }),
    filingPlan({ ...baseExisting, filingPlannedAltitudeFt: 6500 }),
  ];

  for (const existing of nonDuplicates) {
    assert.equal(findLikelyDuplicateFlightPlan(proposed, [existing]), null);
  }
});

test("local FILE duplicate detection ignores stale terminal provider plans", () => {
  const proposed = filingPlan({ id: "proposed" });
  const existing = filingPlan({
    id: "existing",
    filingProviderPlanId: "provider-existing",
    filingIsLive: true,
    filingStatus: "closed",
    closedAt: new Date("2026-07-01T12:00:00.000Z"),
    updatedAt: new Date("2026-07-01T12:00:00.000Z"),
  });

  assert.equal(
    findLikelyDuplicateFlightPlan(proposed, [existing], new Date("2026-07-09T12:00:00.000Z")),
    null,
  );
});

test("duplicate aircraft equipment validation names the duplicated code", () => {
  const validation = validateFlightPlanForAction(filingPlan({ filingEquipment: "SRR" }), "file");
  assert.ok(validation.errors.includes(
    "Aircraft equipment code R was entered more than once. Remove duplicate ICAO equipment codes before filing.",
  ));
});

test("airport timezone resolver covers required filing timezones", () => {
  const cases = [
    ["KPBI", "2026-07-15T10:00", "America/New_York", "2026-07-15T14:00:00.000Z"],
    ["KLAS", "2026-07-15T10:00", "America/Los_Angeles", "2026-07-15T17:00:00.000Z"],
    ["KPHX", "2026-07-15T10:00", "America/Phoenix", "2026-07-15T17:00:00.000Z"],
    ["KPHX", "2026-06-24T10:45", "America/Phoenix", "2026-06-24T17:45:00.000Z"],
    ["KFFZ", "2026-06-23T09:30", "America/Phoenix", "2026-06-23T16:30:00.000Z"],
    ["KEDC", "2026-06-24T10:45", "America/Chicago", "2026-06-24T15:45:00.000Z"],
    ["KMSP", "2026-07-21T10:00", "America/Chicago", "2026-07-21T15:00:00.000Z"],
    ["KJVL", "2026-07-21T10:00", "America/Chicago", "2026-07-21T15:00:00.000Z"],
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

test("KMSP to KJVL filing validates with authoritative airport timezone metadata", () => {
  const plan = filingPlan({
    departure: "KMSP",
    destination: "KJVL",
    route: "DLL",
    filingFlightRules: "IFR",
    plannedDepartureAt: new Date("2026-07-21T15:00:00.000Z"),
    plannerState: {
      userDisplayDepartureTimeLocal: "2026-07-21T10:00",
      departureTimeZone: "",
    },
  });

  const validation = validateFlightPlanForAction(plan, "file");

  assert.equal(getProviderDepartureInstantForPlan(plan), "2026-07-21T15:00:00.000Z");
  assert.equal(validation.errors.some((error) => /Departure airport timezone could not be determined/i.test(error)), false);
  assert.equal(validation.errors.some((error) => /Departure date and time are required/i.test(error)), false);
});

test("KMSP to KJVL with blank fuel blocks on endurance, not timezone", () => {
  const plan = filingPlan({
    departure: "KMSP",
    destination: "KJVL",
    route: "DLL",
    filingFlightRules: "IFR",
    fuelOnBoard: null,
    filingEnduranceMinutes: null,
    plannedDepartureAt: new Date("2026-07-21T15:00:00.000Z"),
    plannerState: {
      userDisplayDepartureTimeLocal: "2026-07-21T10:00",
      departureTimeZone: "",
    },
  });

  const validation = validateFlightPlanForAction(plan, "file");

  assert.equal(validation.ready, false);
  assert.equal(getProviderDepartureInstantForPlan(plan), "2026-07-21T15:00:00.000Z");
  assert.equal(validation.errors.some((error) => /Departure airport timezone could not be determined/i.test(error)), false);
  assert.ok(validation.errors.some((error) => /Fuel on Board or a filed ICAO endurance is required/i.test(error)));
});

test("airport timezone resolver uses coordinates for recognized airports without explicit timezone metadata", () => {
  const resolution = resolveDepartureAirportTimezone({
    departureAirport: {
      icao: "KUGN",
      lat: 42.4222,
      lon: -87.8679,
    },
  });
  assert.equal(resolution.timezone, "America/Chicago");
  assert.equal(resolution.source, "coordinates");
  assert.equal(zonedLocalDateTimeToUtcIso("2026-07-15T10:00", resolution.timezone), "2026-07-15T15:00:00.000Z");
});

test("airport timezone resolver uses standard-time UTC conversion from coordinates", () => {
  const resolution = resolveDepartureAirportTimezone({
    departureAirport: {
      icao: "KUGN",
      lat: 42.4222,
      lon: -87.8679,
    },
  });
  assert.equal(resolution.timezone, "America/Chicago");
  assert.equal(zonedLocalDateTimeToUtcIso("2026-01-15T10:00", resolution.timezone), "2026-01-15T16:00:00.000Z");
});

test("filing validation uses server-enriched airport metadata for ICAO airports outside the known fallback list", () => {
  const plan = filingPlan({
    departure: "KUGN",
    destination: "KJVL",
    route: "DCT",
    plannedDepartureAt: new Date("2026-07-21T15:00:00.000Z"),
    plannerState: {
      userDisplayDepartureTimeLocal: "2026-07-21T10:00",
      departureTimeZone: "",
      departureAirportMetadata: {
        icao: "KUGN",
        lat: 42.4222,
        lon: -87.8679,
        timezone: "America/Chicago",
      },
    },
  });

  const validation = validateFlightPlanForAction(plan, "file");

  assert.equal(getProviderDepartureInstantForPlan(plan), "2026-07-21T15:00:00.000Z");
  assert.equal(validation.errors.some((error) => /Departure airport timezone could not be determined/i.test(error)), false);
});

test("KPBI and KLAS ignore stale saved Chicago timezone in reopened plans", () => {
  const cases = [
    ["KPBI", "2026-07-15T10:00", "2026-07-15T14:00:00.000Z"],
    ["KLAS", "2026-07-15T10:00", "2026-07-15T17:00:00.000Z"],
  ] as const;

  for (const [departure, localDateTime, expectedUtc] of cases) {
    const plan = filingPlan({
      departure,
      plannedDepartureAt: new Date("2026-07-15T15:00:00.000Z"),
      plannerState: {
        departureTimeZone: "America/Chicago",
        userDisplayDepartureTimeLocal: localDateTime,
      },
    });

    assert.equal(getProviderDepartureInstantForPlan(plan), expectedUtc);
    assert.equal(buildLeidosActionPayload(plan, "file", { otherInfo: null } as any).params.get("departureInstant"), expectedUtc);
  }
});

test("changing departure airport across time zones recalculates provider instant from new airport", () => {
  const reopened = filingPlan({
    departure: "KEDC",
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-07-15T10:00",
    },
  });
  assert.equal(getProviderDepartureInstantForPlan(reopened), "2026-07-15T15:00:00.000Z");

  const changedToVegas = filingPlan({
    ...reopened,
    departure: "KLAS",
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-07-15T10:00",
    },
  });
  assert.equal(getProviderDepartureInstantForPlan(changedToVegas), "2026-07-15T17:00:00.000Z");
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
  const phoenixDepartureAt = new Date(zonedLocalDateTimeToUtcIso(testDepartureLocal, "America/Phoenix")!);
  const plan = filingPlan({
    departure: "ZZZZ",
    filingDepartureName: "Private air strip",
    plannedDepartureAt: phoenixDepartureAt,
    plannerState: {
      planningReferenceDepartureAirport: "KFFZ",
      actualDepartureLocation: "52TS",
      departureTimeZone: "America/Phoenix",
      userDisplayDepartureTimeLocal: testDepartureLocal,
    },
  });

  assert.equal(validateFlightPlanForAction(plan, "file").ready, true);
  assert.equal(getProviderDepartureInstantForPlan(plan), phoenixDepartureAt.toISOString());
});

test("ZZZZ departure ignores stale saved timezone and uses planning reference airport timezone", () => {
  const plan = filingPlan({
    departure: "ZZZZ",
    filingDepartureName: "Private strip",
    plannedDepartureAt: new Date("2026-07-15T15:00:00.000Z"),
    plannerState: {
      planningReferenceDepartureAirport: "KPBI",
      actualDepartureLocation: "52TS",
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-07-15T10:00",
    },
  });

  assert.equal(getProviderDepartureInstantForPlan(plan), "2026-07-15T14:00:00.000Z");
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

test("filing validation rejects normal airports whose timezone cannot be resolved", () => {
  const plan = filingPlan({
    departure: "KZZZ",
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-07-15T10:00",
    },
  });
  const result = validateFlightPlanForAction(plan, "file");

  assert.equal(result.ready, false);
  assert.equal(getProviderDepartureInstantForPlan(plan), null);
  assert.ok(result.errors.includes("Departure airport timezone could not be determined from airport metadata. Confirm the departure airport selection before filing."));
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
      userDisplayDepartureTimeLocal: testDepartureLocal,
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
      userDisplayDepartureTimeLocal: testDepartureLocal,
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
      userDisplayDepartureTimeLocal: testDepartureLocal,
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

test("ICAO validation rejects bad surveillance and blocks missing equipment dependencies", () => {
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
  assert.equal(missingEquipment.ready, false);
  assert.ok(missingEquipment.errors.some((error) => /PBN\/.*Aircraft Equipment.*R|Aircraft Equipment.*R.*PBN\//i.test(error)));
});

test("ICAO aircraft equipment validation blocks Flight Service-invalid equipment before file or amend", () => {
  const invalidFile = validateFlightPlanForAction(filingPlan({
    filingEquipment: "SCE",
    filingSurveillanceEquipment: "S",
  }), "file");
  assert.equal(invalidFile.ready, false);
  assert.ok(invalidFile.errors.some((error) => /aircraft equipment contains an invalid ICAO code/i.test(error)));

  const invalidAmend = validateFlightPlanForAction(filingPlan({
    filingStatus: "filed",
    filingProviderPlanId: "123456789_123456_1234",
    filingRaw: { versionStamp: "20260629123000000" } as any,
    filingEquipment: "SCE",
    filingSurveillanceEquipment: "S",
  }), "amend");
  assert.equal(invalidAmend.ready, false);
  assert.ok(invalidAmend.errors.some((error) => /aircraft equipment contains an invalid ICAO code/i.test(error)));
});

test("ICAO aircraft equipment validation preserves valid equipment separately from surveillance", () => {
  const plan = filingPlan({
    filingEquipment: "SC",
    filingSurveillanceEquipment: "S",
  });
  const validation = validateFlightPlanForAction(plan, "file");
  assert.equal(validation.ready, true);

  const payload = buildLeidosActionPayload(plan, "file", { otherInfo: null } as any);
  const fields = Object.fromEntries(payload.params.entries());
  assert.equal(fields.aircraftEquipment, "SC");
  assert.equal(fields.surveillanceEquipment, "S");
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
    "DOF/260623 RMK/OLD MESSAGE",
  );
  assert.equal(
    normalizeLeidosOtherInfoForTransmission(buildOtherInfoWithRemarks("PBN/A1 RMK/TEST MESSAGE DOF/260623", null)),
    "PBN/A1 DOF/260623 RMK/TEST MESSAGE",
  );
});

test("Field 18 RMK entered in Other ICAO Information is not overwritten by filing remarks", () => {
  const payload = buildLeidosActionPayload(filingPlan({
    filingRemarks: "THIS IS A TEST",
    filingOtherInfo: "PBN/A1 RMK/FIELD 18 USER REMARK",
  }), "file", { otherInfo: null } as any);
  const fields = Object.fromEntries(payload.params.entries());

  assert.equal(fields.remarks, "THIS IS A TEST");
  assert.equal(fields.otherInfo, `PBN/A1 DOF/${testDof} RMK/FIELD 18 USER REMARK`);
});

test("Flight Service payload puts normal filing remarks in Field 18 RMK and keeps supplemental remarks empty", () => {
  const payload = buildLeidosActionPayload(filingPlan({
    filingRemarks: "TEST REMARK",
    filingOtherInfo: "PBN/A1",
  }), "file", { otherInfo: null } as any);
  const fields = Object.fromEntries(payload.params.entries());

  assert.equal(fields.remarks, "TEST REMARK");
  assert.equal(fields.otherInfo, `PBN/A1 DOF/${testDof} RMK/TEST REMARK`);
  assert.equal(fields.suppRemarksExtended, undefined);
  assert.equal(fields.pilotPhone, "5125550100");
  assert.equal(fields.aircraftHomeBase, "KEDC");
});

test("Flight Service payload collapses user-entered RMK prefix to one outbound RMK", () => {
  const fromRemarks = Object.fromEntries(buildLeidosActionPayload(filingPlan({
    filingRemarks: "RMK/TEST MESSAGE",
    filingOtherInfo: "PBN/A1",
  }), "file", { otherInfo: null } as any).params.entries());
  assert.equal(fromRemarks.otherInfo, `PBN/A1 DOF/${testDof} RMK/TEST MESSAGE`);
  assert.doesNotMatch(String(fromRemarks.otherInfo), /RMK\/RMK\//);

  const fromOtherInfo = Object.fromEntries(buildLeidosActionPayload(filingPlan({
    filingRemarks: null,
    notes: "TEST MESSAGE",
    filingOtherInfo: "PBN/A1 RMK/TEST MESSAGE",
  }), "file", { otherInfo: null } as any).params.entries());
  assert.equal(fromOtherInfo.otherInfo, `PBN/A1 DOF/${testDof} RMK/TEST MESSAGE`);
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
    buildZzzzOtherInfoForLeidos("DOF/260702 RMK/ZZZZ ALTERNATE VALIDATION TEST ALTN/RUTHERFORD RANCH AIRPORT", {
      alternateLocation: "85TX",
      alternateName: "Rutherford Ranch Airport",
    }),
    "DOF/260702 RMK/ZZZZ ALTERNATE VALIDATION TEST ALTN/85TX",
  );
});

test("ZZZZ alternate private field filing keeps altDestination1 ZZZZ and sends only ALTN code", () => {
  const payload = buildLeidosActionPayload(filingPlan({
    departure: "KDWH",
    destination: "KSDL",
    alternate: "ZZZZ",
    route: "DCT",
    filingOtherInfo: `DOF/${testDof}`,
    filingRemarks: "ZZZZ ALTERNATE VALIDATION TEST",
    filingAlternateName: "Rutherford Ranch Airport",
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: testDepartureLocal,
      planningReferenceAlternateAirport: "KSDL",
      actualAlternateLocationMode: "identifier",
      actualAlternateLocation: "85TX",
    },
  }), "file", { otherInfo: null } as any);
  const fields = Object.fromEntries(payload.params.entries());

  assert.equal(fields.altDestination1, "ZZZZ");
  assert.equal(fields.otherInfo, `DOF/${testDof} RMK/ZZZZ ALTERNATE VALIDATION TEST ALTN/85TX`);
  assert.doesNotMatch(String(fields.otherInfo), /RUTHERFORD/i);
  assert.equal(String(fields.otherInfo).match(/\bALTN\//g)?.length, 1);
});

test("ZZZZ departure private field filing keeps departure ZZZZ and sends only DEP code", () => {
  const payload = buildLeidosActionPayload(filingPlan({
    departure: "ZZZZ",
    destination: "KSDL",
    alternate: null,
    route: "DCT",
    filingOtherInfo: `DOF/${testDof}`,
    filingRemarks: "ZZZZ DEPARTURE VALIDATION TEST",
    filingDepartureName: "Rutherford Ranch Airport",
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: testDepartureLocal,
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
    filingOtherInfo: `DOF/${testDof}`,
    filingRemarks: "ZZZZ DESTINATION VALIDATION TEST",
    filingDestinationName: "Rutherford Ranch Airport",
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: testDepartureLocal,
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
    filingOtherInfo: `DOF/${testDof}`,
    filingRemarks: "ZZZZ ALL PRIVATE FIELD VALIDATION TEST",
    filingDepartureName: "Rutherford Ranch Airport",
    filingDestinationName: "Private Destination Airport",
    filingAlternateName: "Private Alternate Airport",
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: testDepartureLocal,
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
      userDisplayDepartureTimeLocal: testDepartureLocal,
    },
  }), "file", { otherInfo: null } as any);
  const fields = Object.fromEntries(payload.params.entries());

  assert.equal(fields.otherInfo, `PBN/A1 DOF/${testDof} RMK/LEIDOS DEMO`);
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

test("Leidos FILE provider id extraction ignores RSF and generic response identifiers", () => {
  assert.equal(
    extractFilingProviderPlanId({
      returnStatus: true,
      clientReference: "rsf-245fd8ec-c8fb-4d68-ac74-7cec4dc3f5e1-file",
      correlationId: "attempt-1",
      id: "generic-operation-id",
      planId: "245fd8ec-c8fb-4d68-ac74-7cec4dc3f5e1",
    }),
    null,
  );
  assert.equal(
    extractFilingProviderPlanId({
      returnStatus: true,
      nested: {
        id: "unrelated-id",
        planId: "local-plan-id",
      },
    }),
    null,
  );
  assert.equal(
    extractFilingProviderPlanId({
      returnStatus: true,
      filing: {
        flightIdentifier: "658167349_806440_10941",
      },
      clientReference: "rsf-local-action",
    }),
    "658167349_806440_10941",
  );
  assert.equal(isGenuineFilingProviderPlanId("658167349_806440_10941"), true);
  assert.equal(isGenuineFilingProviderPlanId("rsf-245fd8ec-c8fb-4d68-ac74-7cec4dc3f5e1-file"), false);
  assert.equal(isGenuineFilingProviderPlanId(null), false);
});

test("Leidos live FILE accepts only a genuine provider plan id from the response", async () => {
  await withMockedLeidosProvider([
    {
      body: {
        returnStatus: true,
        flightIdentifier: "658167349_806440_10941",
        versionStamp: "20260721120540000",
      },
    },
  ], async (calls) => {
    const result = await new LeidosFlightPlanFilingProvider().stageAction(filingPlan({
      filingOtherInfo: null,
    }), "file");

    assert.equal(result.live, true);
    assert.equal(result.nextStatus, "filed");
    assert.equal(result.providerPlanId, "658167349_806440_10941");
    assert.equal(result.providerSnapshot?.providerPlanId, "658167349_806440_10941");
    assert.equal(result.providerSnapshot?.versionStamp, "20260721120540000");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/FP\/file$/);
  });
});

test("Leidos live FILE with 2xx but no provider id stays unconfirmed and does not retrieve", async () => {
  await withMockedLeidosProvider([
    {
      body: {
        returnStatus: true,
        messages: ["Request accepted for processing"],
      },
    },
  ], async (calls) => {
    const result = await new LeidosFlightPlanFilingProvider().stageAction(filingPlan({
      filingOtherInfo: null,
    }), "file");

    assert.equal(result.live, false);
    assert.equal(result.nextStatus, "staged");
    assert.equal(result.providerPlanId, null);
    assert.equal(result.providerSnapshot, null);
    assert.match(result.message, /did not return a usable flightIdentifier/i);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/FP\/file$/);
  });
});

test("Leidos live FILE ignores echoed RSF references and unrelated generic ids", async () => {
  const internalReference = "rsf-245fd8ec-c8fb-4d68-ac74-7cec4dc3f5e1-file";
  await withMockedLeidosProvider([
    {
      body: {
        returnStatus: true,
        clientReference: internalReference,
        correlationId: "attempt-1",
        id: "generic-operation-id",
        planId: "245fd8ec-c8fb-4d68-ac74-7cec4dc3f5e1",
        versionStamp: "20260721120540000",
      },
    },
  ], async (calls) => {
    const result = await new LeidosFlightPlanFilingProvider().stageAction(filingPlan({
      id: "245fd8ec-c8fb-4d68-ac74-7cec4dc3f5e1",
      filingOtherInfo: null,
    }), "file");

    assert.equal(result.live, false);
    assert.equal(result.nextStatus, "staged");
    assert.equal(result.providerPlanId, null);
    assert.equal(JSON.stringify(result).includes(internalReference), false);
    assert.equal(calls.length, 1);
  });
});

test("Leidos live FILE rejection fails without provider confirmation", async () => {
  await withMockedLeidosProvider([
    {
      body: {
        returnStatus: false,
        messages: ["Duplicate flight"],
      },
    },
  ], async () => {
    await assert.rejects(
      () => new LeidosFlightPlanFilingProvider().stageAction(filingPlan({
        filingOtherInfo: null,
      }), "file"),
      /unsuccessful FILE response/i,
    );
  });
});

test("Leidos live FILE empty success body remains unconfirmed", async () => {
  await withMockedLeidosProvider([
    {
      contentType: "text/plain",
      body: "",
    },
  ], async (calls) => {
    const result = await new LeidosFlightPlanFilingProvider().stageAction(filingPlan({
      filingOtherInfo: null,
    }), "file");

    assert.equal(result.live, false);
    assert.equal(result.nextStatus, "staged");
    assert.equal(result.providerPlanId, null);
    assert.equal(calls.length, 1);
  });
});

test("Leidos live FILE network failure does not fabricate provider confirmation", async () => {
  await withMockedLeidosProvider([
    {
      error: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }),
    },
  ], async (calls) => {
    const result = await new LeidosFlightPlanFilingProvider().stageAction(filingPlan({
      filingOtherInfo: null,
    }), "file");

    assert.equal(result.live, false);
    assert.equal(result.nextStatus, "staged");
    assert.equal(result.providerPlanId, null);
    assert.match(result.message, /could not reach Leidos|kept it staged/i);
    assert.equal(calls.length, 1);
  });
});

test("provider lifecycle actions are blocked when FILE confirmation has no genuine provider id", () => {
  const unconfirmed = filingPlan({
    filingStatus: "staged",
    filingIsLive: false,
    filingProviderPlanId: null,
    filingOtherInfo: null,
  });

  for (const action of ["amend", "activate", "cancel", "close"] as const) {
    const validation = validateFlightPlanForAction(unconfirmed, action);
    assert.equal(validation.ready, false, `${action} should be blocked`);
    assert.ok(
      validation.errors.some((error) => /confirmed Leidos flight identifier|provider plan ID|filed flight plan|active VFR flight plan|filed VFR plan/i.test(error)),
      `${action} should explain the missing provider confirmation`,
    );
  }
});

test("direct provider sync with an internal RSF reference makes no provider request", async () => {
  const internalReference = "rsf-245fd8ec-c8fb-4d68-ac74-7cec4dc3f5e1-file";
  await withMockedLeidosProvider([], async (calls) => {
    const result = await syncLeidosPlanMetadata(filingPlan({
      filingStatus: "filed",
      filingIsLive: true,
      filingProviderPlanId: internalReference,
      filingOtherInfo: null,
    }));

    assert.equal(result.providerUnconfirmed, true);
    assert.equal(result.providerPlanId, null);
    assert.equal(result.versionStamp, null);
    assert.match(result.message, /internal RSF reference|not a confirmed Leidos flight identifier/i);
    assert.equal(calls.length, 0);
  });
});

test("direct lifecycle actions with an internal RSF reference make no provider request", async () => {
  const internalReference = "rsf-245fd8ec-c8fb-4d68-ac74-7cec4dc3f5e1-file";
  const base = filingPlan({
    filingStatus: "filed",
    filingIsLive: true,
    filingProviderPlanId: internalReference,
    filingRaw: { versionStamp: "20260721120540000" },
    filingProviderSnapshot: {
      providerLifecycleStatus: "filed",
      providerActionAvailability: {
        amend: true,
        activate: true,
        cancel: true,
        close: false,
      },
    } as any,
    filingOtherInfo: null,
  });

  await withMockedLeidosProvider([], async (calls) => {
    for (const action of ["amend", "activate", "cancel"] as const) {
      const result = await new LeidosFlightPlanFilingProvider().stageAction(base, action);
      assert.equal(result.live, false, `${action} must not be live`);
      assert.equal(result.providerPlanId, null, `${action} must not retain internal provider id`);
      assert.match(result.message, /confirmed flightIdentifier/i);
    }

    const closeResult = await new LeidosFlightPlanFilingProvider().stageAction({
      ...base,
      filingStatus: "activated",
      filingProviderSnapshot: {
        providerLifecycleStatus: "activated",
        providerActionAvailability: {
          amend: true,
          activate: false,
          cancel: false,
          close: true,
        },
      } as any,
    }, "close");
    assert.equal(closeResult.live, false);
    assert.equal(closeResult.providerPlanId, null);
    assert.match(closeResult.message, /confirmed flightIdentifier/i);
    assert.equal(calls.length, 0);
  });
});

test("legitimate Leidos provider id still retrieves during direct sync", async () => {
  await withMockedLeidosProvider([
    {
      body: {
        returnStatus: true,
        flightIdentifier: "658167349_806440_10941",
        versionStamp: "20260721120540000",
        flightState: "PROPOSED",
        artccState: "ROGERED",
      },
    },
  ], async (calls) => {
    const result = await syncLeidosPlanMetadata(filingPlan({
      filingStatus: "filed",
      filingIsLive: true,
      filingProviderPlanId: "658167349_806440_10941",
      filingOtherInfo: null,
    }));

    assert.equal(result.providerPlanId, "658167349_806440_10941");
    assert.equal(result.versionStamp, "20260721120540000");
    assert.notEqual(result.providerUnconfirmed, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /658167349_806440_10941/);
    assert.match(calls[0].url, /\/retrieve\?/);
  });
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

test("file and amend with past departure remain blocked before provider submission", () => {
  const pastDeparture = new Date(Date.now() - 15 * 60 * 1000);
  const pastArrival = new Date(Date.now() + 45 * 60 * 1000);
  const pastDraft = filingPlan({
    plannedDepartureAt: pastDeparture,
    plannedArrivalAt: pastArrival,
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-07-13T12:45",
    },
  });
  const fileResult = validateFlightPlanForAction(pastDraft, "file");
  assert.equal(fileResult.ready, false);
  assert.ok(fileResult.errors.some((error) => /departure time/i.test(error) && /past/i.test(error)));

  const pastFiledIfr = filingPlan({
    ...pastDraft,
    filingFlightRules: "IFR",
    filingStatus: "filed",
    filingIsLive: true,
    filingProviderPlanId: "LEIDOS-IFR-PAST",
  });
  const amendResult = validateFlightPlanForAction(pastFiledIfr, "amend");
  assert.equal(amendResult.ready, false);
  assert.ok(amendResult.errors.some((error) => /departure time/i.test(error) && /past/i.test(error)));
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

  for (const action of ["amend", "activate", "cancel"] as const) {
    const result = validateFlightPlanForAction(pendingReview, action);
    assert.equal(result.ready, false);
    assert.ok(result.errors.some((error) => /filing provider has updated/i.test(error)));
  }

  const pendingReviewActiveVfr = filingPlan({
    ...pendingReview,
    filingStatus: "activated",
    filingFlightRules: "VFR",
    plannedArrivalAt: new Date(Date.now() + 60 * 60 * 1000),
    filingProviderSnapshot: {
      providerPendingReview: true,
      providerLifecycleStatus: "activated",
    } as any,
  });
  const closeResult = validateFlightPlanForAction(pendingReviewActiveVfr, "close");
  assert.equal(closeResult.ready, true);
  assert.ok(!closeResult.errors.some((error) => /filing provider has updated/i.test(error)));

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

test("Retrieve verification flags submitted fields missing from provider retrieve", () => {
  const comparison = compareRetrievedProviderPlanFields({
    submittedFields: {
      pilotPhone: "15124121762",
      aircraftHomeBase: "KEDC",
      otherInfo: "PBN/A1 RMK/FIELD 18 TEST",
      suppRemarksExtended: "SUPPLEMENTAL TEST",
      aircraftEquipment: "SC",
      surveillanceEquipment: "S",
      route: "DCT",
      fuelOnBoard: "PT5H",
      departureInstant: "2026-06-29T15:00:00.000Z",
      departure: "KEDC",
      destination: "KDAL",
      altDestination1: "KACT",
    },
    retrievedProviderPlan: {
      aircraftEquipment: "SC",
      surveillanceEquipment: "S",
      route: "DCT",
      departure: "KEDC",
      destination: "KDAL",
      altDestination1: "KACT",
    },
  });

  assert.ok(comparison.mismatchedFields.some((entry) => entry.field === "pilotPhone" && entry.issue === "missing_from_retrieve"));
  assert.ok(comparison.mismatchedFields.some((entry) => entry.field === "aircraftHomeBase" && entry.issue === "missing_from_retrieve"));
  assert.ok(comparison.mismatchedFields.some((entry) => entry.field === "otherInfo" && entry.issue === "missing_from_retrieve"));
  assert.ok(comparison.mismatchedFields.some((entry) => entry.field === "suppRemarksExtended" && entry.issue === "missing_from_retrieve"));
  assert.ok(comparison.mismatchedFields.some((entry) => entry.field === "fuelOnBoard" && entry.issue === "missing_from_retrieve"));
  assert.ok(comparison.mismatchedFields.some((entry) => entry.field === "departureInstant" && entry.issue === "missing_from_retrieve"));
  assert.equal(comparison.matchedFields.some((entry) => entry.field === "aircraftEquipment"), true);
  assert.equal(comparison.missingFromRetrieve.length, 6);
});

test("Retrieve verification flags supplemental remarks returned inside Field 18", () => {
  const comparison = compareRetrievedProviderPlanFields({
    submittedFields: {
      otherInfo: "PBN/A1 RMK/FIELD 18 TEST",
      suppRemarksExtended: "SUPPLEMENTAL TEST",
    },
    retrievedProviderPlan: {
      otherInfo: "PBN/A1 RMK/FIELD 18 TEST SUPPLEMENTAL TEST",
    },
  });

  assert.ok(comparison.mismatchedFields.some((entry) =>
    entry.field === "suppRemarksExtended" &&
    entry.issue === "supplemental_returned_in_otherInfo"
  ));
});
