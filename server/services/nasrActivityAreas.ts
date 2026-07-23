import AdmZip from "adm-zip";

export type NasrActivityAreaFeature = {
  type: "Feature";
  id: string;
  geometry: {
    type: "Point" | "Polygon";
    coordinates: any;
  };
  properties: {
    activityType: "PJA" | "MAA";
    typeLabel: string;
    name: string;
    state?: string | null;
    city?: string | null;
    altitude?: string | null;
    schedule?: string | null;
    remarks?: string | null;
    checkNotams?: string | null;
    source: string;
    displayCenterLat: number;
    displayCenterLon: number;
    radiusNm?: number | null;
    cycle?: string | null;
  };
};

type NasrActivityAreaPayload = {
  type: "FeatureCollection";
  features: NasrActivityAreaFeature[];
  count: number;
  source: string;
  cycle: string | null;
  updatedAt: string;
  stale: boolean;
};

type CachedNasrAreas = {
  payload: NasrActivityAreaPayload;
  expiresAt: number;
};

const NASR_ROOT_URL = "https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/";
const NFDC_EXTRA_BASE_URL = "https://nfdc.faa.gov/webContent/28DaySub/extra/";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const MONTH_ABBREVIATIONS: Record<string, string> = {
  january: "Jan",
  february: "Feb",
  march: "Mar",
  april: "Apr",
  may: "May",
  june: "Jun",
  july: "Jul",
  august: "Aug",
  september: "Sep",
  october: "Oct",
  november: "Nov",
  december: "Dec",
};

let activityAreaCache: CachedNasrAreas | null = null;

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      value = "";
      continue;
    }
    value += char;
  }

  if (value.length || row.length) {
    row.push(value);
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  const [header, ...data] = rows;
  if (!header) return [];
  return data.map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = (cells[index] || "").trim();
    });
    return record;
  });
}

function parseDecimal(value: string | undefined | null) {
  const numeric = Number(String(value || "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function parseDmsCoordinate(value: string | undefined | null) {
  const raw = String(value || "").trim().toUpperCase();
  const match = raw.match(/^(\d{2,3})-(\d{2})-(\d{2}(?:\.\d+)?)([NSEW])$/);
  if (!match) return null;
  const degrees = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (![degrees, minutes, seconds].every(Number.isFinite)) return null;
  const decimal = degrees + minutes / 60 + seconds / 3600;
  return match[4] === "S" || match[4] === "W" ? -decimal : decimal;
}

function destinationPoint(lat: number, lon: number, bearingDeg: number, distanceNm: number) {
  const radiusNm = 3440.065;
  const bearing = (bearingDeg * Math.PI) / 180;
  const distance = distanceNm / radiusNm;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distance) + Math.cos(lat1) * Math.sin(distance) * Math.cos(bearing)
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(distance) * Math.cos(lat1),
    Math.cos(distance) - Math.sin(lat1) * Math.sin(lat2)
  );
  return {
    lat: (lat2 * 180) / Math.PI,
    lon: (((lon2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

function buildCirclePolygon(lon: number, lat: number, radiusNm: number) {
  const ring: [number, number][] = [];
  for (let bearing = 0; bearing <= 360; bearing += 10) {
    const point = destinationPoint(lat, lon, bearing, radiusNm);
    ring.push([point.lon, point.lat]);
  }
  return ring;
}

function getZipCsv(zipBuffer: Buffer, fileNamePattern: RegExp) {
  const zip = new AdmZip(zipBuffer);
  const entry = zip.getEntries().find((candidate) => fileNamePattern.test(candidate.entryName));
  return entry ? entry.getData().toString("utf8") : "";
}

function resolveZipUrl(href: string, baseUrl: string) {
  return new URL(href.replace(/&amp;/g, "&"), baseUrl).toString();
}

function extractCycleLabel(pageUrl: string, html: string) {
  const urlDate = pageUrl.match(/NASR_Subscription\/(\d{4}-\d{2}-\d{2})/i)?.[1];
  const titleDate = html.match(/Effective\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/i);
  return titleDate ? `${titleDate[1]} ${titleDate[2]}, ${titleDate[3]}` : urlDate || null;
}

async function resolveNasrCsvUrls() {
  const explicitPja = process.env.NASR_PJA_CSV_ZIP_URL;
  const explicitMaa = process.env.NASR_MAA_CSV_ZIP_URL;
  const explicitCycleUrl = process.env.NASR_SUBSCRIPTION_CYCLE_URL;
  if (explicitPja && explicitMaa) {
    return { pjaUrl: explicitPja, maaUrl: explicitMaa, cycle: explicitCycleUrl || null };
  }

  const rootResponse = await fetch(NASR_ROOT_URL);
  if (!rootResponse.ok) throw new Error(`FAA NASR cycle page failed: ${rootResponse.status}`);
  const rootHtml = await rootResponse.text();
  const cycleHref = explicitCycleUrl || rootHtml.match(/href=["']([^"']*NASR_Subscription\/\d{4}-\d{2}-\d{2}\/?[^"']*)["']/i)?.[1];
  const cycleUrl = cycleHref ? resolveZipUrl(cycleHref, NASR_ROOT_URL) : NASR_ROOT_URL;

  const cycleResponse = await fetch(cycleUrl);
  if (!cycleResponse.ok) throw new Error(`FAA NASR selected cycle page failed: ${cycleResponse.status}`);
  const cycleHtml = await cycleResponse.text();
  const hrefs: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let hrefMatch: RegExpExecArray | null;
  while ((hrefMatch = hrefRegex.exec(cycleHtml))) {
    hrefs.push(hrefMatch[1]);
  }
  let pjaUrl = explicitPja || hrefs.find((href) => /PJA_CSV\.zip/i.test(href));
  let maaUrl = explicitMaa || hrefs.find((href) => /MAA_CSV\.zip/i.test(href));

  if (!pjaUrl || !maaUrl) {
    const effective = cycleHtml.match(/Effective\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/i);
    const month = effective ? MONTH_ABBREVIATIONS[effective[1].toLowerCase()] : null;
    if (effective && month) {
      const day = effective[2].padStart(2, "0");
      const year = effective[3];
      pjaUrl ||= `${NFDC_EXTRA_BASE_URL}${day}_${month}_${year}_PJA_CSV.zip`;
      maaUrl ||= `${NFDC_EXTRA_BASE_URL}${day}_${month}_${year}_MAA_CSV.zip`;
    }
  }

  if (!pjaUrl || !maaUrl) throw new Error("FAA NASR PJA/MAA CSV links were not found");
  return {
    pjaUrl: resolveZipUrl(pjaUrl, cycleUrl),
    maaUrl: resolveZipUrl(maaUrl, cycleUrl),
    cycle: extractCycleLabel(cycleUrl, cycleHtml),
  };
}

async function fetchBuffer(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`FAA NASR download failed ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function normalizeAltitude(parts: Array<string | null | undefined>) {
  return parts.map((part) => String(part || "").trim()).filter(Boolean).join(" ").trim() || null;
}

function makeAreaGeometry(centerLat: number, centerLon: number, radiusNm: number | null, polygon?: [number, number][]) {
  if (polygon && polygon.length >= 3) {
    const closed = [...polygon];
    const first = closed[0];
    const last = closed[closed.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) closed.push(first);
    return { type: "Polygon" as const, coordinates: [closed] };
  }
  if (radiusNm && radiusNm > 0) {
    return { type: "Polygon" as const, coordinates: [buildCirclePolygon(centerLon, centerLat, radiusNm)] };
  }
  return { type: "Point" as const, coordinates: [centerLon, centerLat] };
}

function buildPjaFeatures(baseCsv: string, cycle: string | null): NasrActivityAreaFeature[] {
  return parseCsv(baseCsv)
    .map((row) => {
      const lat = parseDecimal(row.LAT_DECIMAL) ?? parseDmsCoordinate(row.LATITUDE);
      const lon = parseDecimal(row.LONG_DECIMAL) ?? parseDmsCoordinate(row.LONGITUDE);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const radiusNm = parseDecimal(row.PJA_RADIUS);
      const id = row.PJA_ID || `${row.STATE_CODE || "PJA"}-${row.CITY || row.DROP_ZONE_NAME || lat}-${lon}`;
      const name = row.DROP_ZONE_NAME || row.CITY || row.NAVAID_NAME || id;
      return {
        type: "Feature" as const,
        id: `PJA-${id}`,
        geometry: makeAreaGeometry(lat as number, lon as number, radiusNm),
        properties: {
          activityType: "PJA" as const,
          typeLabel: "Parachute Jump Area",
          name,
          state: row.STATE_CODE || null,
          city: row.CITY || null,
          altitude: normalizeAltitude([row.MAX_ALTITUDE, row.MAX_ALTITUDE_TYPE_CODE]),
          schedule: row.TIME_OF_USE || null,
          remarks: row.REMARK || row.DESCRIPTION || null,
          source: "FAA NASR PJA",
          displayCenterLat: lat as number,
          displayCenterLon: lon as number,
          radiusNm,
          cycle,
        },
      };
    })
    .filter(Boolean) as NasrActivityAreaFeature[];
}

function buildMaaFeatures(baseCsv: string, shapeCsv: string, cycle: string | null): NasrActivityAreaFeature[] {
  const shapes = new Map<string, [number, number][]>();
  parseCsv(shapeCsv).forEach((row) => {
    const lat = parseDmsCoordinate(row.LATITUDE);
    const lon = parseDmsCoordinate(row.LONGITUDE);
    if (!row.MAA_ID || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const points = shapes.get(row.MAA_ID) || [];
    points.push([lon as number, lat as number]);
    shapes.set(row.MAA_ID, points);
  });

  return parseCsv(baseCsv)
    .map((row) => {
      const polygon = shapes.get(row.MAA_ID);
      const shapeCenter = polygon && polygon.length
        ? polygon.reduce((acc, [lon, lat]) => ({ lat: acc.lat + lat / polygon.length, lon: acc.lon + lon / polygon.length }), { lat: 0, lon: 0 })
        : null;
      const lat = parseDmsCoordinate(row.LATITUDE) ?? shapeCenter?.lat ?? null;
      const lon = parseDmsCoordinate(row.LONGITUDE) ?? shapeCenter?.lon ?? null;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const radiusNm = parseDecimal(row.MAA_RADIUS);
      const id = row.MAA_ID || `${row.MAA_TYPE_NAME || "MAA"}-${lat}-${lon}`;
      const typeName = row.MAA_TYPE_NAME || "Miscellaneous Activity Area";
      return {
        type: "Feature" as const,
        id: `MAA-${id}`,
        geometry: makeAreaGeometry(lat as number, lon as number, radiusNm, polygon),
        properties: {
          activityType: "MAA" as const,
          typeLabel: typeName,
          name: row.MAA_NAME || typeName,
          state: row.STATE_CODE || null,
          city: row.CITY || null,
          altitude: normalizeAltitude([row.MIN_ALT ? `${row.MIN_ALT} min` : null, row.MAX_ALT ? `${row.MAX_ALT} max` : null]),
          schedule: row.TIME_OF_USE || null,
          remarks: row.DESCRIPTION || null,
          checkNotams: row.CHECK_NOTAMS || null,
          source: "FAA NASR MAA",
          displayCenterLat: lat as number,
          displayCenterLon: lon as number,
          radiusNm,
          cycle,
        },
      };
    })
    .filter(Boolean) as NasrActivityAreaFeature[];
}

async function loadNasrActivityAreas(): Promise<NasrActivityAreaPayload> {
  const resolved = await resolveNasrCsvUrls();
  const [pjaZip, maaZip] = await Promise.all([fetchBuffer(resolved.pjaUrl), fetchBuffer(resolved.maaUrl)]);
  const pjaBase = getZipCsv(pjaZip, /PJA_BASE\.csv$/i);
  const maaBase = getZipCsv(maaZip, /MAA_BASE\.csv$/i);
  const maaShape = getZipCsv(maaZip, /MAA_SHP\.csv$/i);
  const features = [
    ...buildPjaFeatures(pjaBase, resolved.cycle),
    ...buildMaaFeatures(maaBase, maaShape, resolved.cycle),
  ];
  return {
    type: "FeatureCollection",
    features,
    count: features.length,
    source: "FAA NASR Subscription PJA/MAA CSV",
    cycle: resolved.cycle,
    updatedAt: new Date().toISOString(),
    stale: false,
  };
}

export async function getNasrActivityAreas(options: { force?: boolean } = {}) {
  if (!options.force && activityAreaCache && activityAreaCache.expiresAt > Date.now()) {
    return activityAreaCache.payload;
  }
  try {
    const payload = await loadNasrActivityAreas();
    activityAreaCache = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
    return payload;
  } catch (error) {
    if (activityAreaCache) {
      return { ...activityAreaCache.payload, stale: true, updatedAt: new Date().toISOString() };
    }
    throw error;
  }
}

export const __nasrActivityAreaTestUtils = {
  parseCsv,
  parseDmsCoordinate,
  buildPjaFeatures,
  buildMaaFeatures,
};
