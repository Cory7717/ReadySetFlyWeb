export type AirportTimezoneInput = {
  icao?: string | null;
  timezone?: string | null;
  lat?: number | string | null;
  lon?: number | string | null;
};

export type DepartureTimezoneResolution = {
  timezone: string | null;
  source: "airport" | "planning-reference" | "explicit" | "known-airport" | "coordinates" | "unresolved";
  airportCode: string | null;
};

const KNOWN_AIRPORT_TIMEZONES: Record<string, string> = {
  KPHX: "America/Phoenix",
  KIWA: "America/Phoenix",
  KFFZ: "America/Phoenix",
  KDVT: "America/Phoenix",
  KSDL: "America/Phoenix",
  KTUS: "America/Phoenix",
  KFLG: "America/Phoenix",
  KGCN: "America/Phoenix",
  KNYL: "America/Phoenix",
  KPRC: "America/Phoenix",
  KSEZ: "America/Phoenix",
  KDEN: "America/Denver",
  KAPA: "America/Denver",
  KBJC: "America/Denver",
  KCOS: "America/Denver",
  KEDC: "America/Chicago",
  KDWH: "America/Chicago",
  KAUS: "America/Chicago",
  KACT: "America/Chicago",
  KGTU: "America/Chicago",
  KDTO: "America/Chicago",
  KHYI: "America/Chicago",
  KDAL: "America/Chicago",
  KDFW: "America/Chicago",
  KHOU: "America/Chicago",
  KORD: "America/Chicago",
  KJFK: "America/New_York",
  KLGA: "America/New_York",
  KEWR: "America/New_York",
  KMIA: "America/New_York",
  KPBI: "America/New_York",
  KBOS: "America/New_York",
  KLAX: "America/Los_Angeles",
  KLAS: "America/Los_Angeles",
  KVGT: "America/Los_Angeles",
  KSFO: "America/Los_Angeles",
  KSEA: "America/Los_Angeles",
  PANC: "America/Anchorage",
  PALH: "America/Anchorage",
  PHNL: "Pacific/Honolulu",
  PHOG: "Pacific/Honolulu",
  PHKO: "Pacific/Honolulu",
};

export const isValidIanaTimezone = (value?: string | null) => {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

export const normalizeAirportCode = (value?: string | null) =>
  String(value || "").trim().toUpperCase() || null;

const numeric = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const resolveTimezoneFromAirportCoordinates = (latInput?: number | string | null, lonInput?: number | string | null) => {
  const lat = numeric(latInput);
  const lon = numeric(lonInput);
  if (lat === null || lon === null) return null;

  if (lat >= 18 && lat <= 23 && lon >= -161 && lon <= -154) return "Pacific/Honolulu";
  if (lat >= 51 && lat <= 72 && lon >= -170 && lon <= -129) return "America/Anchorage";
  if (lat >= 31 && lat <= 37.5 && lon >= -115.2 && lon <= -108.8) return "America/Phoenix";
  if (lon <= -114) return "America/Los_Angeles";
  if (lon <= -101) return "America/Denver";
  if (lon <= -84.5) return "America/Chicago";
  return "America/New_York";
};

export const resolveAirportTimezone = (airport?: AirportTimezoneInput | null): DepartureTimezoneResolution => {
  const airportCode = normalizeAirportCode(airport?.icao);
  if (airportCode && KNOWN_AIRPORT_TIMEZONES[airportCode]) {
    return { timezone: KNOWN_AIRPORT_TIMEZONES[airportCode], source: "known-airport", airportCode };
  }

  const explicitTimezone = String(airport?.timezone || "").trim();
  if (isValidIanaTimezone(explicitTimezone)) {
    return { timezone: explicitTimezone, source: "airport", airportCode };
  }

  const coordinateTimezone = resolveTimezoneFromAirportCoordinates(airport?.lat, airport?.lon);
  if (coordinateTimezone) {
    return { timezone: coordinateTimezone, source: "coordinates", airportCode };
  }

  return { timezone: null, source: "unresolved", airportCode };
};

export const resolveDepartureAirportTimezone = ({
  departureAirport,
  planningReferenceDepartureAirport,
  explicitDepartureTimezone,
}: {
  departureAirport?: AirportTimezoneInput | null;
  planningReferenceDepartureAirport?: AirportTimezoneInput | null;
  explicitDepartureTimezone?: string | null;
}): DepartureTimezoneResolution => {
  const departureCode = normalizeAirportCode(departureAirport?.icao);
  if (departureCode === "ZZZZ") {
    const reference = resolveAirportTimezone(planningReferenceDepartureAirport);
    if (reference.timezone) {
      return { ...reference, source: "planning-reference" };
    }
    const explicit = String(explicitDepartureTimezone || "").trim();
    if (isValidIanaTimezone(explicit)) {
      return { timezone: explicit, source: "explicit", airportCode: departureCode };
    }
    return { timezone: null, source: "unresolved", airportCode: departureCode };
  }

  return resolveAirportTimezone(departureAirport);
};
