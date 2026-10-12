const FAA_DTPP_SEARCH_URL =
  "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/search/";
const FAA_DTPP_BASE_URL = "https://aeronav.faa.gov/d-tpp";

const DEFAULT_DISCOVERY_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_RETRY_COOLDOWN_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 20 * 1000;
const MAX_DISCOVERY_BYTES = 512 * 1024;
const MAX_XML_PROBE_BYTES = 768 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
// FAA's www host rejects product-token user agents with 403 while serving its
// public publication page to ordinary browser-compatible clients.
const FAA_HTTP_USER_AGENT = "Mozilla/5.0";

type FetchLike = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

export type FaaDtppCycleListing = {
  cycle: string;
  effectiveFrom: string;
  effectiveTo: string;
  faaLabel: "current" | "next" | "listed";
};

export type FaaDtppCycleConfig = FaaDtppCycleListing & {
  metaUrl: string;
  pdfBaseUrl: string;
  zipUrl: string | null;
  provenance: "faa-auto" | "environment-override" | "last-known-good";
  validatedAt: string;
  stale: boolean;
  status: "current" | "stale";
  warning: string | null;
  nextCycle: {
    cycle: string;
    effectiveFrom: string;
    effectiveTo: string;
    ready: boolean;
    validationError: string | null;
  } | null;
};

export type FaaDtppPersistedState = Omit<
  FaaDtppCycleConfig,
  "provenance" | "stale" | "status" | "warning"
>;

export type FaaDtppCycleManagerOptions = {
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  now?: () => number;
  discoveryTtlMs?: number;
  retryCooldownMs?: number;
  timeoutMs?: number;
  loadPersisted?: () => Promise<FaaDtppPersistedState | null>;
  savePersisted?: (state: FaaDtppPersistedState) => Promise<void>;
  logger?: (event: Record<string, unknown>) => void;
};

export class FaaDtppCycleError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "FaaDtppCycleError";
  }
}

function decodeHtml(value: string) {
  return value
    .replace(/&ndash;|&#8211;/gi, "-")
    .replace(/&mdash;|&#8212;/gi, "-")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFaaEffectiveRange(label: string) {
  const normalized = decodeHtml(label);
  const match = normalized.match(
    /0901Z\s+([A-Za-z]+)\s+(\d{1,2})\s+to\s+0901Z\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/i,
  );
  if (!match) {
    throw new FaaDtppCycleError(
      `FAA d-TPP effective range could not be parsed: ${normalized.slice(0, 120)}`,
    );
  }
  const monthIndex = (name: string) => {
    const parsed = Date.parse(`${name} 1, 2020 00:00:00 UTC`);
    if (!Number.isFinite(parsed)) {
      throw new FaaDtppCycleError(`FAA d-TPP month is invalid: ${name}`);
    }
    return new Date(parsed).getUTCMonth();
  };
  const endYear = Number(match[5]);
  const startMonth = monthIndex(match[1]);
  const endMonth = monthIndex(match[3]);
  const startYear = startMonth > endMonth ? endYear - 1 : endYear;
  const effectiveFrom = Date.UTC(
    startYear,
    startMonth,
    Number(match[2]),
    9,
    1,
  );
  const effectiveTo = Date.UTC(
    endYear,
    endMonth,
    Number(match[4]),
    9,
    1,
  );
  if (effectiveTo <= effectiveFrom) {
    throw new FaaDtppCycleError("FAA d-TPP effective range is not increasing");
  }
  return {
    effectiveFrom: new Date(effectiveFrom).toISOString(),
    effectiveTo: new Date(effectiveTo).toISOString(),
  };
}

export function parseFaaDtppCycleListings(html: string) {
  const select = html.match(
    /<select[^>]+(?:name|id)=["']cycle["'][^>]*>([\s\S]*?)<\/select>/i,
  );
  if (!select) {
    throw new FaaDtppCycleError("FAA d-TPP cycle selector was not found");
  }
  const listings: FaaDtppCycleListing[] = [];
  const optionPattern =
    /<option\b([^>]*)value=["'](\d{4})["']([^>]*)>([\s\S]*?)<\/option>/gi;
  let match: RegExpExecArray | null;
  while ((match = optionPattern.exec(select[1]))) {
    const attributes = `${match[1]} ${match[3]}`;
    const label = decodeHtml(match[4]);
    const range = parseFaaEffectiveRange(label);
    listings.push({
      cycle: match[2],
      ...range,
      faaLabel: /\(current\)/i.test(label) || /\bselected\b/i.test(attributes)
        ? "current"
        : /\(next\)/i.test(label)
          ? "next"
          : "listed",
    });
  }
  if (!listings.length) {
    throw new FaaDtppCycleError("FAA d-TPP cycle selector contained no cycles");
  }
  return listings;
}

export function selectEffectiveFaaDtppCycle(
  listings: FaaDtppCycleListing[],
  nowMs: number,
) {
  const active = listings.find(
    (listing) =>
      nowMs >= Date.parse(listing.effectiveFrom) &&
      nowMs < Date.parse(listing.effectiveTo),
  );
  if (!active) {
    throw new FaaDtppCycleError(
      "FAA d-TPP metadata did not contain a cycle effective at the current time",
    );
  }
  const next = listings
    .filter((listing) => Date.parse(listing.effectiveFrom) >= Date.parse(active.effectiveTo))
    .sort((a, b) => Date.parse(a.effectiveFrom) - Date.parse(b.effectiveFrom))[0] || null;
  return { active, next };
}

function officialUrls(cycle: string) {
  return {
    metaUrl: `${FAA_DTPP_BASE_URL}/${cycle}/xml_data/d-TPP_Metafile.xml`,
    pdfBaseUrl: `${FAA_DTPP_BASE_URL}/${cycle}`,
  };
}

function cycleFromDtppUrl(value: string) {
  try {
    const url = new URL(value);
    return url.pathname.match(/\/d-tpp\/(\d{4})(?:\/|$)/i)?.[1] || null;
  } catch {
    return null;
  }
}

function validateHttpsUrl(value: string, label: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new FaaDtppCycleError(`${label} is not a valid URL`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new FaaDtppCycleError(`${label} must be a credential-free HTTPS URL`);
  }
  return url.toString();
}

function expectedZipDate(effectiveFrom: string) {
  const date = new Date(effectiveFrom);
  return `${String(date.getUTCFullYear()).slice(-2)}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function resolveFaaDtppEnvironmentOverride(
  env: Record<string, string | undefined>,
) {
  const cycle = String(env.FAA_DTPP_CYCLE || "").trim();
  const metaUrl = String(env.FAA_DTPP_META_URL || "").trim();
  const pdfBaseUrl = String(env.FAA_DTPP_PDF_BASE_URL || "").trim();
  const zipUrl = String(env.FAA_DTPP_ZIP_URL || "").trim();
  const hasRuntimeOverride = Boolean(cycle || metaUrl || pdfBaseUrl);
  if (!hasRuntimeOverride) return null;
  if (cycle && !/^\d{4}$/.test(cycle)) {
    throw new FaaDtppCycleError("FAA_DTPP_CYCLE must be a four-digit cycle code");
  }
  const urlCycles = [metaUrl, pdfBaseUrl]
    .filter(Boolean)
    .map(cycleFromDtppUrl)
    .filter((value): value is string => Boolean(value));
  const candidates = Array.from(new Set([cycle, ...urlCycles].filter(Boolean)));
  if (candidates.length !== 1) {
    throw new FaaDtppCycleError(
      candidates.length > 1
        ? "FAA d-TPP environment overrides reference conflicting cycles"
        : "Custom FAA d-TPP URLs require FAA_DTPP_CYCLE",
    );
  }
  const resolvedCycle = candidates[0];
  const defaults = officialUrls(resolvedCycle);
  const validatedZipUrl = zipUrl
    ? validateHttpsUrl(zipUrl, "FAA_DTPP_ZIP_URL")
    : null;
  return {
    cycle: resolvedCycle,
    metaUrl: validateHttpsUrl(metaUrl || defaults.metaUrl, "FAA_DTPP_META_URL"),
    pdfBaseUrl: validateHttpsUrl(
      pdfBaseUrl || defaults.pdfBaseUrl,
      "FAA_DTPP_PDF_BASE_URL",
    ).replace(/\/+$/, ""),
    zipUrl: validatedZipUrl,
  };
}

function parseXmlEffectiveDate(value: string) {
  const match = value.match(/0901Z\s+(\d{1,2})\/(\d{1,2})\/(\d{2})/i);
  if (!match) return null;
  return Date.UTC(2000 + Number(match[3]), Number(match[1]) - 1, Number(match[2]), 9, 1);
}

function xmlAttribute(attributes: string, name: string) {
  return attributes.match(new RegExp(`${name}=["']([^"']+)["']`, "i"))?.[1] || null;
}

async function readBoundedText(
  response: Response,
  controller: AbortController,
  maxBytes: number,
) {
  if (!response.body) throw new FaaDtppCycleError("FAA d-TPP response had no body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      controller.abort();
      break;
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

async function fetchBoundedText(
  fetchImpl: FetchLike,
  url: string,
  timeoutMs: number,
  maxBytes: number,
  headers: Record<string, string> = {},
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xml,text/xml;q=0.9,*/*;q=0.5",
        "User-Agent": FAA_HTTP_USER_AGENT,
        ...headers,
      },
    });
    if (!response.ok) {
      throw new FaaDtppCycleError(`FAA d-TPP request failed (${response.status})`);
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes && !headers.Range) {
      throw new FaaDtppCycleError("FAA d-TPP response exceeded the safe size limit");
    }
    return await readBoundedText(response, controller, maxBytes);
  } catch (error) {
    if (error instanceof FaaDtppCycleError) throw error;
    throw new FaaDtppCycleError(
      `FAA d-TPP request failed: ${error instanceof Error ? error.message : "unknown error"}`,
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function validatePdf(
  fetchImpl: FetchLike,
  url: string,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": FAA_HTTP_USER_AGENT },
    });
    if (!response.ok) {
      throw new FaaDtppCycleError(
        `FAA d-TPP representative PDF was unavailable (${response.status})`,
      );
    }
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const contentLength = Number(response.headers.get("content-length"));
    if (!contentType.includes("pdf")) {
      throw new FaaDtppCycleError("FAA d-TPP representative file was not a PDF");
    }
    if (
      Number.isFinite(contentLength) &&
      (contentLength <= 0 || contentLength > MAX_PDF_BYTES)
    ) {
      throw new FaaDtppCycleError("FAA d-TPP representative PDF size was invalid");
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function validateCycleCandidate(
  candidate: FaaDtppCycleListing & {
    metaUrl: string;
    pdfBaseUrl: string;
    zipUrl: string | null;
  },
  fetchImpl: FetchLike,
  timeoutMs: number,
) {
  const xml = await fetchBoundedText(
    fetchImpl,
    candidate.metaUrl,
    timeoutMs,
    MAX_XML_PROBE_BYTES,
    { Range: `bytes=0-${MAX_XML_PROBE_BYTES - 1}` },
  );
  const root = xml.match(/<digital_tpp\b([^>]*)>/i);
  if (!root) throw new FaaDtppCycleError("FAA d-TPP XML root was invalid");
  const xmlCycle = xmlAttribute(root[1], "cycle");
  const xmlFrom = parseXmlEffectiveDate(xmlAttribute(root[1], "from_edate") || "");
  const xmlTo = parseXmlEffectiveDate(xmlAttribute(root[1], "to_edate") || "");
  if (xmlCycle !== candidate.cycle) {
    throw new FaaDtppCycleError(
      `FAA d-TPP XML cycle ${xmlCycle || "missing"} did not match ${candidate.cycle}`,
    );
  }
  if (
    xmlFrom === null ||
    xmlTo === null ||
    xmlFrom !== Date.parse(candidate.effectiveFrom) ||
    xmlTo !== Date.parse(candidate.effectiveTo)
  ) {
    throw new FaaDtppCycleError("FAA d-TPP XML effective dates did not match publication metadata");
  }
  const airport = xml.match(/<airport_name\b[^>]*>[\s\S]*?<\/airport_name>/i);
  const record = airport?.[0].match(/<record>[\s\S]*?<\/record>/i)?.[0] || null;
  const pdfName = record?.match(/<pdf_name>([^<]+)<\/pdf_name>/i)?.[1]?.trim() || "";
  if (
    !airport ||
    !record ||
    !/<chart_code>[^<]+<\/chart_code>/i.test(record) ||
    !/<chart_name>[^<]+<\/chart_name>/i.test(record) ||
    !/^[A-Z0-9_.-]+\.PDF$/i.test(pdfName)
  ) {
    throw new FaaDtppCycleError("FAA d-TPP XML chart mapping was invalid");
  }
  await validatePdf(fetchImpl, `${candidate.pdfBaseUrl}/${pdfName}`, timeoutMs);
  return candidate;
}

function persistedState(config: FaaDtppCycleConfig): FaaDtppPersistedState {
  const { provenance: _provenance, stale: _stale, status: _status, warning: _warning, ...state } = config;
  return state;
}

export function createFaaDtppCycleManager(
  options: FaaDtppCycleManagerOptions = {},
) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || Date.now;
  const discoveryTtlMs = options.discoveryTtlMs ?? DEFAULT_DISCOVERY_TTL_MS;
  const retryCooldownMs = options.retryCooldownMs ?? DEFAULT_RETRY_COOLDOWN_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const logger = options.logger || ((event) => console.info(JSON.stringify(event)));
  let active: FaaDtppCycleConfig | null = null;
  let refreshPromise: Promise<FaaDtppCycleConfig> | null = null;
  let retryAfterMs = 0;
  let interval: ReturnType<typeof setInterval> | null = null;

  const staleCopy = (config: FaaDtppCycleConfig, warning: string) => ({
    ...config,
    provenance: "last-known-good" as const,
    stale: true,
    status: "stale" as const,
    warning,
  });

  const restorePersisted = async () => {
    if (active || !options.loadPersisted) return active;
    const persisted = await options.loadPersisted();
    if (!persisted || !/^\d{4}$/.test(persisted.cycle)) return null;
    active = staleCopy(
      {
        ...persisted,
        provenance: "last-known-good",
        stale: true,
        status: "stale",
        warning: null,
      },
      "FAA cycle refresh is unavailable; validated last-known-good chart data is in use.",
    );
    return active;
  };

  const refresh = async () => {
    const requestedAt = now();
    const override = resolveFaaDtppEnvironmentOverride(env);
    let candidate: FaaDtppCycleListing & {
      metaUrl: string;
      pdfBaseUrl: string;
      zipUrl: string | null;
    };
    let nextListing: FaaDtppCycleListing | null = null;
    let provenance: FaaDtppCycleConfig["provenance"];

    if (override) {
      const xmlProbe = await fetchBoundedText(
        fetchImpl,
        override.metaUrl,
        timeoutMs,
        MAX_XML_PROBE_BYTES,
        { Range: `bytes=0-${MAX_XML_PROBE_BYTES - 1}` },
      );
      const root = xmlProbe.match(/<digital_tpp\b([^>]*)>/i);
      const from = root ? parseXmlEffectiveDate(xmlAttribute(root[1], "from_edate") || "") : null;
      const to = root ? parseXmlEffectiveDate(xmlAttribute(root[1], "to_edate") || "") : null;
      if (from === null || to === null) {
        throw new FaaDtppCycleError("FAA d-TPP override XML effective dates were invalid");
      }
      candidate = {
        ...override,
        effectiveFrom: new Date(from).toISOString(),
        effectiveTo: new Date(to).toISOString(),
        faaLabel: "listed",
      };
      provenance = "environment-override";
    } else {
      const html = await fetchBoundedText(
        fetchImpl,
        FAA_DTPP_SEARCH_URL,
        timeoutMs,
        MAX_DISCOVERY_BYTES,
      );
      const selected = selectEffectiveFaaDtppCycle(
        parseFaaDtppCycleListings(html),
        requestedAt,
      );
      const urls = officialUrls(selected.active.cycle);
      candidate = { ...selected.active, ...urls, zipUrl: null };
      nextListing = selected.next;
      provenance = "faa-auto";
    }

    await validateCycleCandidate(candidate, fetchImpl, timeoutMs);
    if (candidate.zipUrl) {
      const zipDate = new URL(candidate.zipUrl).pathname.match(/_(\d{6})\.zip$/i)?.[1];
      if (zipDate && zipDate !== expectedZipDate(candidate.effectiveFrom)) {
        throw new FaaDtppCycleError(
          "FAA_DTPP_ZIP_URL effective date conflicts with the validated XML cycle",
        );
      }
    }
    let nextCycle: FaaDtppCycleConfig["nextCycle"] = null;
    if (nextListing) {
      try {
        await validateCycleCandidate(
          { ...nextListing, ...officialUrls(nextListing.cycle), zipUrl: null },
          fetchImpl,
          timeoutMs,
        );
        nextCycle = { ...nextListing, ready: true, validationError: null };
      } catch (error) {
        nextCycle = {
          ...nextListing,
          ready: false,
          validationError: error instanceof Error ? error.message : "validation failed",
        };
      }
    }

    const insideWindow =
      requestedAt >= Date.parse(candidate.effectiveFrom) &&
      requestedAt < Date.parse(candidate.effectiveTo);
    const config: FaaDtppCycleConfig = {
      ...candidate,
      provenance,
      validatedAt: new Date(now()).toISOString(),
      stale: !insideWindow,
      status: insideWindow ? "current" : "stale",
      warning: insideWindow
        ? null
        : "The configured FAA d-TPP override is outside its published effective period.",
      nextCycle,
    };
    active = config;
    retryAfterMs = 0;
    await options.savePersisted?.(persistedState(config));
    logger({
      event: "faa_dtpp_cycle_resolved",
      cycle: config.cycle,
      effectiveFrom: config.effectiveFrom,
      effectiveTo: config.effectiveTo,
      status: config.status,
      provenance: config.provenance,
      nextCycle: config.nextCycle?.cycle || null,
      nextReady: config.nextCycle?.ready ?? null,
    });
    return config;
  };

  const getActiveCycle = async ({ force = false } = {}) => {
    const requestedAt = now();
    if (!force && active && requestedAt - Date.parse(active.validatedAt) < discoveryTtlMs) {
      const outsideWindow =
        requestedAt < Date.parse(active.effectiveFrom) ||
        requestedAt >= Date.parse(active.effectiveTo);
      if (!outsideWindow) return active;
      if (active.provenance === "environment-override") {
        return staleCopy(
          active,
          "The configured FAA d-TPP override is outside its published effective period.",
        );
      }
      // Automatic configurations must re-discover immediately at the effective
      // boundary even if their ordinary discovery TTL has not elapsed.
    }
    if (!force && requestedAt < retryAfterMs) {
      const fallback = active || (await restorePersisted());
      if (fallback) {
        return staleCopy(
          fallback,
          "FAA cycle refresh is in retry cooldown; validated last-known-good chart data is in use.",
        );
      }
      throw new FaaDtppCycleError("FAA d-TPP cycle refresh is in retry cooldown");
    }
    refreshPromise ||= refresh().finally(() => {
      refreshPromise = null;
    });
    try {
      return await refreshPromise;
    } catch (error) {
      retryAfterMs = now() + retryCooldownMs;
      const fallback = active || (await restorePersisted());
      if (fallback) {
        logger({
          event: "faa_dtpp_cycle_refresh_failed",
          cycle: fallback.cycle,
          fallback: "last-known-good",
          error: error instanceof Error ? error.message : "unknown error",
        });
        return staleCopy(
          fallback,
          "FAA cycle refresh failed; validated last-known-good chart data is in use.",
        );
      }
      throw error;
    }
  };

  return {
    getActiveCycle,
    forceRefresh: () => getActiveCycle({ force: true }),
    start() {
      if (interval) return;
      void getActiveCycle().catch((error) => {
        logger({
          event: "faa_dtpp_cycle_initialization_failed",
          error: error instanceof Error ? error.message : "unknown error",
        });
      });
      interval = setInterval(() => {
        void getActiveCycle({ force: true }).catch(() => undefined);
      }, discoveryTtlMs);
      interval.unref?.();
    },
    stop() {
      if (interval) clearInterval(interval);
      interval = null;
    },
    getDiagnostics: () => ({
      active,
      refreshInProgress: Boolean(refreshPromise),
      retryAfter: retryAfterMs ? new Date(retryAfterMs).toISOString() : null,
    }),
  };
}
