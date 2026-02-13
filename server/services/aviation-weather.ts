const AWC_BASE_URL = "https://aviationweather.gov/api/data";
const DEFAULT_HEADERS = { "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)" };

const METAR_TTL_MS = 3 * 60 * 1000;
const TAF_TTL_MS = 3 * 60 * 1000;
const PIREP_TTL_MS = 10 * 60 * 1000;
const HAZARD_TTL_MS = 10 * 60 * 1000;
const WINDS_TTL_MS = 30 * 60 * 1000;

const cache = new Map<string, { expiresAt: number; value: any }>();

export type AviationFetchResult<T> = {
  data: T | null;
  raw?: string | null;
  decoded?: T | null;
  fetchedAt: number;
  source: "awc";
  warnings: string[];
};

export type WindsAloftSample = {
  directionDeg: number | null;
  speedKt: number | null;
  tempC: number | null;
};

export type WindsAloftStation = {
  stationId: string;
  values: Record<number, WindsAloftSample>;
};

export type WindsAloftReport = {
  dataBasedOn: string | null;
  validTime: string | null;
  altitudes: number[];
  stations: WindsAloftStation[];
};

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function cacheSet<T>(key: string, ttlMs: number, value: T) {
  if (cache.size > 500) {
    cache.clear();
  }
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function buildAwcUrl(path: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.append(key, String(value));
  });
  return `${AWC_BASE_URL}/${path}?${search.toString()}`;
}

async function fetchAwcJson<T>(path: string, params: Record<string, string | number | undefined>, timeoutMs: number) {
  const url = buildAwcUrl(path, params);
  try {
    const response = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, timeoutMs);
    if (!response.ok) {
      return { data: null as T | null, warnings: [`${path} unavailable (${response.status})`] };
    }
    const text = await response.text();
    const trimmed = text.trim();
    if (!trimmed) {
      return { data: null as T | null, warnings: [`${path} empty response`] };
    }
    if (trimmed.startsWith("<")) {
      return { data: null as T | null, warnings: [`${path} unexpected response`] };
    }
    try {
      const parsed = JSON.parse(trimmed) as T;
      return { data: parsed, warnings: [] };
    } catch {
      return { data: null as T | null, warnings: [`${path} parse error`] };
    }
  } catch (error) {
    return { data: null as T | null, warnings: [`${path} request failed`] };
  }
}

async function fetchAwcText(path: string, params: Record<string, string | number | undefined>, timeoutMs: number) {
  const url = buildAwcUrl(path, params);
  try {
    const response = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, timeoutMs);
    if (!response.ok) {
      return { text: null as string | null, warnings: [`${path} unavailable (${response.status})`] };
    }
    const text = await response.text();
    const trimmed = text.trim();
    if (!trimmed) {
      return { text: null as string | null, warnings: [`${path} empty response`] };
    }
    if (trimmed.startsWith("<")) {
      return { text: null as string | null, warnings: [`${path} unexpected response`] };
    }
    return { text, warnings: [] };
  } catch {
    return { text: null as string | null, warnings: [`${path} request failed`] };
  }
}

export async function fetchMetar(icao: string): Promise<AviationFetchResult<any>> {
  const key = `metar:${icao}`;
  const cached = cacheGet<AviationFetchResult<any>>(key);
  if (cached) return cached;

  const fetchedAt = Date.now();
  const { data, warnings } = await fetchAwcJson<any[]>(
    "metar",
    { ids: icao, format: "json" },
    5000
  );
  const decoded = Array.isArray(data) ? data[0] ?? null : data ?? null;
  const result: AviationFetchResult<any> = {
    data: decoded,
    decoded,
    raw: decoded?.rawOb ?? null,
    fetchedAt,
    source: "awc",
    warnings,
  };
  cacheSet(key, METAR_TTL_MS, result);
  return result;
}

export async function fetchTaf(icao: string): Promise<AviationFetchResult<any>> {
  const key = `taf:${icao}`;
  const cached = cacheGet<AviationFetchResult<any>>(key);
  if (cached) return cached;

  const fetchedAt = Date.now();
  const { data, warnings } = await fetchAwcJson<any[]>(
    "taf",
    { ids: icao, format: "json" },
    5000
  );
  const decoded = Array.isArray(data) ? data[0] ?? null : data ?? null;
  const result: AviationFetchResult<any> = {
    data: decoded,
    decoded,
    raw: decoded?.rawTAF ?? null,
    fetchedAt,
    source: "awc",
    warnings,
  };
  cacheSet(key, TAF_TTL_MS, result);
  return result;
}

export async function fetchPireps(params: {
  bbox?: string;
  id?: string;
  distance?: number;
  age?: number;
  level?: number;
  inten?: "lgt" | "mod" | "sev";
}): Promise<AviationFetchResult<any[]>> {
  const key = `pirep:${JSON.stringify(params)}`;
  const cached = cacheGet<AviationFetchResult<any[]>>(key);
  if (cached) return cached;

  const fetchedAt = Date.now();
  const { data, warnings } = await fetchAwcJson<any[]>(
    "pirep",
    {
      format: "json",
      bbox: params.bbox,
      id: params.id,
      distance: params.distance,
      age: params.age,
      level: params.level,
      inten: params.inten,
    },
    6000
  );

  const reports = Array.isArray(data) ? data : data ? [data] : [];
  const result: AviationFetchResult<any[]> = {
    data: reports,
    decoded: reports,
    fetchedAt,
    source: "awc",
    warnings,
  };
  cacheSet(key, PIREP_TTL_MS, result);
  return result;
}

export async function fetchAirSigmets(params: {
  hazard?: "conv" | "turb" | "ice" | "ifr";
  level?: number;
  format?: "json" | "geojson" | "raw" | "xml";
}): Promise<AviationFetchResult<any>> {
  const key = `airsigmet:${JSON.stringify(params)}`;
  const cached = cacheGet<AviationFetchResult<any>>(key);
  if (cached) return cached;

  const fetchedAt = Date.now();
  const { data, warnings } = await fetchAwcJson<any>(
    "airsigmet",
    {
      format: params.format ?? "json",
      hazard: params.hazard,
      level: params.level,
    },
    6000
  );

  const result: AviationFetchResult<any> = {
    data,
    decoded: data,
    fetchedAt,
    source: "awc",
    warnings,
  };
  cacheSet(key, HAZARD_TTL_MS, result);
  return result;
}

export async function fetchGAirmets(params: {
  product?: "sierra" | "tango" | "zulu";
  hazard?: string;
  fore?: number;
  format?: "json" | "geojson" | "raw" | "xml";
}): Promise<AviationFetchResult<any>> {
  const key = `gairmet:${JSON.stringify(params)}`;
  const cached = cacheGet<AviationFetchResult<any>>(key);
  if (cached) return cached;

  const fetchedAt = Date.now();
  const { data, warnings } = await fetchAwcJson<any>(
    "gairmet",
    {
      format: params.format ?? "json",
      product: params.product,
      hazard: params.hazard,
      fore: params.fore,
    },
    6000
  );

  const result: AviationFetchResult<any> = {
    data,
    decoded: data,
    fetchedAt,
    source: "awc",
    warnings,
  };
  cacheSet(key, HAZARD_TTL_MS, result);
  return result;
}

export async function fetchAirmets(params: {
  hazard?: "turb" | "ifr" | "conv" | "ice";
  level?: number;
  format?: "json" | "geojson" | "iwxxm" | "xml";
}): Promise<AviationFetchResult<any>> {
  const key = `airmet:${JSON.stringify(params)}`;
  const cached = cacheGet<AviationFetchResult<any>>(key);
  if (cached) return cached;

  const fetchedAt = Date.now();
  const { data, warnings } = await fetchAwcJson<any>(
    "airmet",
    {
      format: params.format ?? "json",
      hazard: params.hazard,
      level: params.level,
    },
    6000
  );

  const result: AviationFetchResult<any> = {
    data,
    decoded: data,
    fetchedAt,
    source: "awc",
    warnings,
  };
  cacheSet(key, HAZARD_TTL_MS, result);
  return result;
}

export async function fetchTcf(): Promise<AviationFetchResult<any>> {
  const key = "tcf";
  const cached = cacheGet<AviationFetchResult<any>>(key);
  if (cached) return cached;

  const fetchedAt = Date.now();
  const { data, warnings } = await fetchAwcJson<any>(
    "tcf",
    { format: "json" },
    6000
  );
  const result: AviationFetchResult<any> = {
    data,
    decoded: data,
    fetchedAt,
    source: "awc",
    warnings,
  };
  cacheSet(key, HAZARD_TTL_MS, result);
  return result;
}

function parseWindsAloftToken(token: string, altitudeFt: number): WindsAloftSample | null {
  const cleaned = token.trim();
  if (!cleaned || cleaned.includes("/") || cleaned.length < 4) return null;

  let dirCode = Number(cleaned.slice(0, 2));
  let speed = Number(cleaned.slice(2, 4));
  if (!Number.isFinite(dirCode) || !Number.isFinite(speed)) return null;

  let tempC: number | null = null;
  const tempPart = cleaned.slice(4);
  if (altitudeFt >= 6000 && tempPart) {
    if (tempPart.startsWith("+") || tempPart.startsWith("-")) {
      tempC = Number(tempPart);
    } else if (altitudeFt >= 24000 && tempPart.length === 2) {
      tempC = -Number(tempPart);
    } else {
      tempC = Number(tempPart);
    }
    if (!Number.isFinite(tempC)) tempC = null;
  }

  if (dirCode === 99) {
    return { directionDeg: null, speedKt: 0, tempC };
  }

  if (dirCode >= 51 && dirCode <= 86) {
    dirCode -= 50;
    speed += 100;
  }

  const directionDeg = dirCode * 10;
  if (!Number.isFinite(directionDeg)) return null;
  return { directionDeg, speedKt: speed, tempC };
}

export function parseWindsAloftReport(text: string): WindsAloftReport {
  const lines = text.split(/\r?\n/);
  let dataBasedOn: string | null = null;
  let validTime: string | null = null;

  for (const line of lines) {
    const dataMatch = line.match(/DATA BASED ON\s+(\d{6}Z)/i);
    if (dataMatch) dataBasedOn = dataMatch[1];
    const validMatch = line.match(/VALID\s+(\d{6}Z)/i);
    if (validMatch) validTime = validMatch[1];
  }

  const altitudes: number[] = [];
  let tableStart = -1;
  let parsingHeader = false;

  const extractAltitudes = (line: string) =>
    (line.match(/\b\d{4,5}\b/g) || []).map((value) => Number(value));

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim().startsWith("FT")) {
      parsingHeader = true;
      altitudes.push(...extractAltitudes(line));
      continue;
    }
    if (parsingHeader) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^[A-Z0-9]{3,4}\b/.test(trimmed)) {
        tableStart = i;
        break;
      }
      altitudes.push(...extractAltitudes(line));
    }
  }

  const stations: WindsAloftStation[] = [];
  if (tableStart === -1 || altitudes.length === 0) {
    return { dataBasedOn, validTime, altitudes, stations };
  }

  for (let i = tableStart; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!/^[A-Z0-9]{3,4}\b/.test(trimmed)) continue;

    const tokens = trimmed.split(/\s+/);
    const stationId = tokens[0];
    const values: Record<number, WindsAloftSample> = {};

    for (let idx = 0; idx < altitudes.length; idx += 1) {
      const token = tokens[idx + 1];
      if (!token) continue;
      const sample = parseWindsAloftToken(token, altitudes[idx]);
      if (sample) values[altitudes[idx]] = sample;
    }

    if (Object.keys(values).length > 0) {
      stations.push({ stationId, values });
    }
  }

  return { dataBasedOn, validTime, altitudes, stations };
}

export async function fetchWindsAloftReport(): Promise<AviationFetchResult<WindsAloftReport>> {
  const key = "winds-aloft";
  const cached = cacheGet<AviationFetchResult<WindsAloftReport>>(key);
  if (cached) return cached;

  const fetchedAt = Date.now();
  const { text, warnings } = await fetchAwcText("windtemp", {}, 8000);
  const report = text ? parseWindsAloftReport(text) : null;
  const result: AviationFetchResult<WindsAloftReport> = {
    data: report,
    decoded: report,
    fetchedAt,
    source: "awc",
    warnings,
  };
  cacheSet(key, WINDS_TTL_MS, result);
  return result;
}

export function buildEmptyStub<T>(label: string): AviationFetchResult<T> {
  return {
    data: null,
    decoded: null,
    fetchedAt: Date.now(),
    source: "awc",
    warnings: [`${label} not available via AWC Data API.`],
  };
}
