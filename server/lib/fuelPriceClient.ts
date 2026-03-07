export type FuelType =
  "100LL" | "Jet-A" | "Mogas" | "100LL UL";

export type FuelPrice = {
  type: FuelType;
  pricePPG: number | null;
  updatedAt: string | null;
  source: "airnav" | "community" | "mock";
  reportedBy?: "airnav" | "pilot";
};

export type FuelPriceResult = {
  icao: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  fuels: FuelPrice[];
  distanceMiles?: number;
};

export type FuelPriceResponse = {
  results: FuelPriceResult[];
  queriedAt: string;
  source: "airnav" | "community" | "mixed" | "mock";
  communityEnabled: boolean;
};

type CommunityReport = {
  icao: string;
  fuelType: string;
  pricePPG: number;
  reportedAt: string;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeFuelType(raw: string): FuelType {
  const val = (raw ?? "").toUpperCase().trim();
  if (val.includes("JET")) return "Jet-A";
  if (val.includes("MOGAS")) return "Mogas";
  if (val.includes("UL94") || val.includes("UL 94"))
    return "100LL UL";
  return "100LL";
}

export function mockFuelPrices(
  airport?: string,
  lat?: number,
  lon?: number,
  radiusMiles = 50
): FuelPriceResponse {
  void lat;
  void lon;
  void radiusMiles;

  const now = new Date().toISOString();
  return {
    queriedAt: now,
    source: "mock",
    communityEnabled: false,
    results: [
      {
        icao: airport ?? "KDAL",
        name: "Dallas Love Field",
        city: "Dallas",
        state: "TX",
        lat: 32.847,
        lon: -96.851,
        distanceMiles: 0,
        fuels: [
          { type: "100LL", pricePPG: 6.89, updatedAt: now, source: "mock", reportedBy: "airnav" },
          { type: "Jet-A", pricePPG: 5.42, updatedAt: now, source: "mock", reportedBy: "airnav" },
        ],
      },
      {
        icao: "KADS",
        name: "Addison Airport",
        city: "Addison",
        state: "TX",
        lat: 32.969,
        lon: -96.836,
        distanceMiles: 8.4,
        fuels: [
          { type: "100LL", pricePPG: 7.15, updatedAt: now, source: "mock", reportedBy: "airnav" },
        ],
      },
      {
        icao: "KGPM",
        name: "Grand Prairie Municipal",
        city: "Grand Prairie",
        state: "TX",
        lat: 32.699,
        lon: -97.043,
        distanceMiles: 14.1,
        fuels: [
          { type: "100LL", pricePPG: 6.55, updatedAt: now, source: "mock", reportedBy: "airnav" },
          { type: "Jet-A", pricePPG: 5.18, updatedAt: now, source: "mock", reportedBy: "airnav" },
        ],
      },
      {
        icao: "KTKI",
        name: "McKinney National",
        city: "McKinney",
        state: "TX",
        lat: 33.178,
        lon: -96.59,
        distanceMiles: 22.7,
        fuels: [
          { type: "100LL", pricePPG: 7.44, updatedAt: now, source: "mock", reportedBy: "airnav" },
        ],
      },
      {
        icao: "KFWS",
        name: "Fort Worth Spinks",
        city: "Fort Worth",
        state: "TX",
        lat: 32.565,
        lon: -97.308,
        distanceMiles: 31.2,
        fuels: [
          { type: "100LL", pricePPG: 6.72, updatedAt: now, source: "mock", reportedBy: "airnav" },
          { type: "Jet-A", pricePPG: 5.31, updatedAt: now, source: "mock", reportedBy: "airnav" },
        ],
      },
    ],
  };
}

function mapAirNavFuel(value: unknown): FuelPrice | null {
  const fuel = asRecord(value);
  if (!fuel) return null;

  return {
    type: normalizeFuelType(
      asString(fuel.type) ?? asString(fuel.fuel_type) ?? ""
    ),
    pricePPG:
      asNumber(fuel.price_ppg) ?? asNumber(fuel.price) ?? null,
    updatedAt:
      asString(fuel.updated_at) ?? asString(fuel.date) ?? null,
    source: "airnav",
    reportedBy: "airnav",
  };
}

function mapAirNavAirport(value: unknown): FuelPriceResult | null {
  const airport = asRecord(value);
  if (!airport) return null;

  const icao = asString(airport.icao) ?? asString(airport.id);
  const name = asString(airport.name) ?? asString(airport.airport_name);
  const city = asString(airport.city);
  const state = asString(airport.state) ?? asString(airport.state_code);
  const lat = asNumber(airport.lat) ?? asNumber(airport.latitude);
  const lon = asNumber(airport.lon) ?? asNumber(airport.longitude);

  if (!icao || !name || !city || !state || lat === null || lon === null) {
    return null;
  }

  const rawFuels =
    asArray(airport.fuels).length > 0
      ? asArray(airport.fuels)
      : asArray(airport.fuel_prices);

  return {
    icao,
    name,
    city,
    state,
    lat,
    lon,
    distanceMiles:
      asNumber(airport.distance_miles) ?? asNumber(airport.distance) ?? undefined,
    fuels: rawFuels
      .map(mapAirNavFuel)
      .filter((fuel): fuel is FuelPrice => !!fuel),
  };
}

export async function fetchFromAirNav(
  airport?: string,
  lat?: number,
  lon?: number,
  radiusMiles = 50
): Promise<FuelPriceResponse> {
  const apiKey = process.env.AIRNAV_API_KEY;
  const baseUrl = process.env.AIRNAV_API_BASE_URL
    ?? "https://www.airnav.com/datafeed";

  if (!apiKey) {
    throw new Error("AIRNAV_API_KEY is not configured");
  }

  const params = new URLSearchParams();
  params.set("key", apiKey); // AIRNAV_FIELD: auth param name
  if (airport) {
    params.set("airport", airport); // AIRNAV_FIELD: icao param
  } else if (lat !== undefined && lon !== undefined) {
    params.set("lat", String(lat)); // AIRNAV_FIELD: lat param
    params.set("lon", String(lon)); // AIRNAV_FIELD: lon param
  }
  params.set("radius", String(radiusMiles)); // AIRNAV_FIELD: radius param
  params.set("format", "json"); // AIRNAV_FIELD: format param

  const res = await fetch(
    `${baseUrl}/fuel?${params}`, // AIRNAV_FIELD: endpoint path
    {
      headers: {
        "Accept": "application/json",
        "User-Agent": "ReadySetFly/1.0",
      },
    }
  );

  if (!res.ok) {
    throw new Error(
      `AirNav API responded with ${res.status} ${res.statusText}`
    );
  }

  const raw = await res.json();
  const root = asRecord(raw);

  // AIRNAV_FIELD: top-level array key - update when confirmed
  const airports: unknown[] = root
    ? (asArray(root.airports).length > 0
        ? asArray(root.airports)
        : asArray(root.data).length > 0
          ? asArray(root.data)
          : Array.isArray(raw)
            ? raw
            : [])
    : Array.isArray(raw)
      ? raw
      : [];

  const results = airports
    .map(mapAirNavAirport)
    .filter((entry): entry is FuelPriceResult => !!entry);

  return {
    results,
    queriedAt: new Date().toISOString(),
    source: "airnav",
    communityEnabled:
      process.env.FUEL_COMMUNITY_ENABLED === "true",
  };
}

export function mergeCommunityPrices(
  airnavResults: FuelPriceResult[],
  communityReports: CommunityReport[]
): FuelPriceResult[] {
  return airnavResults.map((airport) => {
    const reports = communityReports.filter(
      (report) => report.icao === airport.icao
    );
    if (reports.length === 0) return airport;

    const mergedFuels = [...airport.fuels];
    for (const report of reports) {
      const fuelType = normalizeFuelType(report.fuelType);
      const existingIndex = mergedFuels.findIndex(
        (fuel) => fuel.type === fuelType
      );
      const communityEntry: FuelPrice = {
        type: fuelType,
        pricePPG: report.pricePPG,
        updatedAt: report.reportedAt,
        source: "community",
        reportedBy: "pilot",
      };
      if (existingIndex >= 0) {
        const existing = mergedFuels[existingIndex];
        const existingAge = existing.updatedAt
          ? Date.now() - new Date(existing.updatedAt).getTime()
          : Infinity;
        const reportAge =
          Date.now() - new Date(report.reportedAt).getTime();
        if (reportAge < existingAge) {
          mergedFuels[existingIndex] = communityEntry;
        }
      } else {
        mergedFuels.push(communityEntry);
      }
    }
    return { ...airport, fuels: mergedFuels };
  });
}

export async function getFuelPrices(
  airport?: string,
  lat?: number,
  lon?: number,
  radiusMiles = 50
): Promise<FuelPriceResponse> {
  const provider = process.env.FUEL_PRICE_PROVIDER ?? "mock";
  if (provider === "airnav") {
    return fetchFromAirNav(airport, lat, lon, radiusMiles);
  }
  return mockFuelPrices(airport, lat, lon, radiusMiles);
}
