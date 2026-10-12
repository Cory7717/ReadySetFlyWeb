export type RunwayMeta = {
  leIdent: string | null;
  heIdent: string | null;
  leHeading: number | null;
  heHeading: number | null;
  lengthFt: number | null;
  widthFt: number | null;
  surface: string | null;
};

export type RunwayCacheStatus = {
  sourceHost: string;
  fetchedAt: string | null;
  ageSeconds: number | null;
  cacheStatus: "empty" | "fresh" | "stale" | "expired";
  stale: boolean;
  lastErrorCode: string | null;
  lastErrorClassification: string | null;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type RunwayReferenceCacheOptions = {
  sourceUrl: string;
  ttlMs: number;
  maxStaleMs: number;
  retryDelayMs: number;
  timeoutMs: number;
  fetchImpl?: FetchLike;
  now?: () => number;
  log?: (entry: Record<string, unknown>) => void;
};

type CacheEntry = {
  data: Map<string, RunwayMeta[]>;
  fetchedAtMs: number;
  expiresAtMs: number;
  stale: boolean;
  lastErrorCode: string | null;
  lastErrorClassification: string | null;
};

export class RunwayReferenceFetchError extends Error {
  code: string;
  classification: string;

  constructor(message: string, code: string, classification: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RunwayReferenceFetchError";
    this.code = code;
    this.classification = classification;
  }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function parseRunwayCsv(csvText: string): Map<string, RunwayMeta[]> {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new RunwayReferenceFetchError("Runway dataset was empty", "EMPTY_DATASET", "data");
  }

  const header = parseCsvLine(lines[0]);
  const required = [
    "airport_ident",
    "length_ft",
    "width_ft",
    "surface",
    "closed",
    "le_ident",
    "he_ident",
    "le_heading_degT",
    "he_heading_degT",
  ];
  const indexes = Object.fromEntries(required.map((name) => [name, header.indexOf(name)]));
  const missing = required.filter((name) => indexes[name] < 0);
  if (missing.length > 0) {
    throw new RunwayReferenceFetchError(
      `Runway dataset is missing required columns: ${missing.join(", ")}`,
      "INVALID_SCHEMA",
      "data",
    );
  }

  const data = new Map<string, RunwayMeta[]>();
  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const airportIdent = row[indexes.airport_ident]?.toUpperCase();
    if (!airportIdent || row[indexes.closed] === "1") continue;
    const runway: RunwayMeta = {
      leIdent: row[indexes.le_ident] || null,
      heIdent: row[indexes.he_ident] || null,
      leHeading: row[indexes.le_heading_degT] ? Number(row[indexes.le_heading_degT]) : null,
      heHeading: row[indexes.he_heading_degT] ? Number(row[indexes.he_heading_degT]) : null,
      lengthFt: row[indexes.length_ft] ? Number(row[indexes.length_ft]) : null,
      widthFt: row[indexes.width_ft] ? Number(row[indexes.width_ft]) : null,
      surface: row[indexes.surface] || null,
    };
    const airportRunways = data.get(airportIdent) || [];
    airportRunways.push(runway);
    data.set(airportIdent, airportRunways);
  }

  if (data.size === 0) {
    throw new RunwayReferenceFetchError("Runway dataset contained no usable records", "EMPTY_DATASET", "data");
  }
  return data;
}

function rawErrorCode(error: unknown): string {
  const value = error as any;
  if (value?.name === "AbortError") return "ETIMEDOUT";
  return String(value?.code || value?.cause?.code || value?.name || "FETCH_FAILED").toUpperCase();
}

export function classifyRunwayFetchError(error: unknown) {
  if (error instanceof RunwayReferenceFetchError) {
    return { code: error.code, classification: error.classification };
  }
  const code = rawErrorCode(error);
  const classification =
    code.includes("CERT") || code.includes("TLS")
      ? "tls"
      : code === "ENOTFOUND" || code === "EAI_AGAIN"
        ? "dns"
        : code === "ETIMEDOUT" || code === "ABORTERROR"
          ? "timeout"
          : "network";
  return { code, classification };
}

export function createRunwayReferenceCache(options: RunwayReferenceCacheOptions) {
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || Date.now;
  const sourceHost = new URL(options.sourceUrl).hostname;
  const log =
    options.log ||
    ((entry: Record<string, unknown>) => console.warn(JSON.stringify(entry)));
  let cache: CacheEntry | null = null;
  let inFlight: Promise<Map<string, RunwayMeta[]>> | null = null;
  let lastFailure: RunwayReferenceFetchError | null = null;
  let nextRetryAtMs = 0;

  const getStatus = (): RunwayCacheStatus => {
    const currentTime = now();
    if (!cache) {
      return {
        sourceHost,
        fetchedAt: null,
        ageSeconds: null,
        cacheStatus: "empty",
        stale: false,
        lastErrorCode: lastFailure?.code || null,
        lastErrorClassification: lastFailure?.classification || null,
      };
    }
    const ageMs = Math.max(0, currentTime - cache.fetchedAtMs);
    const expiredBeyondFallback = ageMs > options.maxStaleMs;
    return {
      sourceHost,
      fetchedAt: new Date(cache.fetchedAtMs).toISOString(),
      ageSeconds: Math.floor(ageMs / 1000),
      cacheStatus: expiredBeyondFallback ? "expired" : cache.stale ? "stale" : "fresh",
      stale: cache.stale || expiredBeyondFallback,
      lastErrorCode: cache.lastErrorCode,
      lastErrorClassification: cache.lastErrorClassification,
    };
  };

  const load = async (): Promise<Map<string, RunwayMeta[]>> => {
    const currentTime = now();
    if (cache && cache.expiresAtMs > currentTime) return cache.data;
    if (inFlight) return inFlight;
    if (!cache && lastFailure && currentTime < nextRetryAtMs) throw lastFailure;

    inFlight = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
      try {
        const response = await fetchImpl(options.sourceUrl, {
          headers: { "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)" },
          redirect: "follow",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new RunwayReferenceFetchError(
            `Runway provider returned HTTP ${response.status}`,
            `HTTP_${response.status}`,
            "http",
          );
        }
        if (new URL(response.url || options.sourceUrl).protocol !== "https:") {
          throw new RunwayReferenceFetchError(
            "Runway provider redirected to a non-HTTPS destination",
            "INSECURE_REDIRECT",
            "tls",
          );
        }
        const data = parseRunwayCsv(await response.text());
        const fetchedAtMs = now();
        cache = {
          data,
          fetchedAtMs,
          expiresAtMs: fetchedAtMs + options.ttlMs,
          stale: false,
          lastErrorCode: null,
          lastErrorClassification: null,
        };
        lastFailure = null;
        nextRetryAtMs = 0;
        return data;
      } catch (error) {
        const classified = classifyRunwayFetchError(error);
        const failure =
          error instanceof RunwayReferenceFetchError
            ? error
            : new RunwayReferenceFetchError(
                "Runway reference refresh failed",
                classified.code,
                classified.classification,
                { cause: error },
              );
        const failureTime = now();
        const cacheAgeMs = cache ? Math.max(0, failureTime - cache.fetchedAtMs) : null;
        const fallbackUsed = Boolean(cache && cacheAgeMs !== null && cacheAgeMs <= options.maxStaleMs);
        nextRetryAtMs = failureTime + options.retryDelayMs;
        lastFailure = failure;
        if (fallbackUsed && cache) {
          cache = {
            ...cache,
            expiresAtMs: nextRetryAtMs,
            stale: true,
            lastErrorCode: failure.code,
            lastErrorClassification: failure.classification,
          };
        }
        log({
          event: "runway_reference_refresh_failed",
          operation: "load_runway_reference_cache",
          providerHost: sourceHost,
          errorClassification: failure.classification,
          errorCode: failure.code,
          cacheStatus: fallbackUsed ? "stale" : cache ? "expired" : "empty",
          cacheAgeSeconds: cacheAgeMs === null ? null : Math.floor(cacheAgeMs / 1000),
          fallbackUsed,
        });
        if (fallbackUsed && cache) return cache.data;
        throw failure;
      } finally {
        clearTimeout(timeout);
      }
    })();

    try {
      return await inFlight;
    } finally {
      inFlight = null;
    }
  };

  return { load, getStatus };
}
