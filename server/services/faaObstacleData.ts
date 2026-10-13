import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import type {
  FaaObstacleDurableSnapshot,
  FaaObstacleSnapshotStore,
} from "./faaObstacleSnapshotStore";

export const OFFICIAL_FAA_DDOF_URL =
  "https://aeronav.faa.gov/Obst_Data/DAILY_DOF_CSV.ZIP";
const OFFICIAL_FAA_DDOF_DIRECTORY_URL =
  "https://aeronav.faa.gov/Obst_Data/";

export const DEFAULT_FAA_DDOF_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
export const MIN_FAA_DDOF_CACHE_TTL_MS = 60 * 60 * 1000;
export const MAX_FAA_DDOF_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_RETRY_COOLDOWN_MS = 5 * 60 * 1000;
const DEFAULT_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 60 * 1000;
const DEFAULT_DIRECTORY_TIMEOUT_MS = 10 * 1000;
const DEFAULT_MIN_RECORDS = 500_000;
const DEFAULT_MAX_RECORDS = 1_500_000;
export const DEFAULT_MAX_ARCHIVE_BYTES = 40 * 1024 * 1024;
const DEFAULT_MAX_CSV_BYTES = 150 * 1024 * 1024;
const DEFAULT_MAX_PUBLICATION_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type FaaObstacleRecord = {
  id: string;
  lat: number;
  lon: number;
  amslFt: number | null;
  aglFt: number | null;
  city: string | null;
  state: string | null;
  kind: string | null;
  lighting: string | null;
};

export type FaaObstacleReferenceData = {
  provider: "FAA Daily DOF";
  provenance: "official-default" | "environment-override";
  sourceHost: string;
  sourcePath: string;
  fetchedAt: string;
  publishedAt: string | null;
  freshnessBasis: string[];
  recordCount: number;
  archiveBytes: number;
  csvBytes: number;
  cacheAgeMs: number;
  dataAgeMs: number | null;
  stale: boolean;
  status: "fresh" | "stale";
  warning: string | null;
};

export type FaaObstacleDataResult = {
  records: FaaObstacleRecord[];
  referenceData: FaaObstacleReferenceData;
};

export type NearbyFaaObstacle = FaaObstacleRecord & { distanceNm: number };

export type NearbyFaaObstacleResult = {
  nearby: NearbyFaaObstacle[];
  highestObstacle: NearbyFaaObstacle | null;
  mslElevationAvailableCount: number;
  missingMslElevationCount: number;
  clearanceStatus: "verifiable" | "unverifiable" | "no-nearby-obstacles";
};

function obstacleDistanceNm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * earthRadiusKm * 0.539957;
}

export function queryNearbyFaaObstacles(options: {
  records: FaaObstacleRecord[];
  lat: number;
  lon: number;
  radiusNm: number;
  limit: number;
}): NearbyFaaObstacleResult {
  const withinRadius: NearbyFaaObstacle[] = [];
  for (const obstacle of options.records) {
    const distanceNm = obstacleDistanceNm(
      options.lat,
      options.lon,
      obstacle.lat,
      obstacle.lon,
    );
    if (distanceNm <= options.radiusNm) {
      withinRadius.push({ ...obstacle, distanceNm });
    }
  }
  const mslElevationAvailableCount = withinRadius.reduce(
    (count, obstacle) => count + (obstacle.amslFt === null ? 0 : 1),
    0,
  );
  const missingMslElevationCount =
    withinRadius.length - mslElevationAvailableCount;
  const highestObstacle = withinRadius.reduce<NearbyFaaObstacle | null>(
    (highest, obstacle) => {
      if (obstacle.amslFt === null) return highest;
      return obstacle.amslFt > (highest?.amslFt ?? -Infinity)
        ? obstacle
        : highest;
    },
    null,
  );
  const nearby = withinRadius
    .sort((a, b) => {
      if (Math.abs(a.distanceNm - b.distanceNm) < 0.25) {
        if (a.amslFt === null && b.amslFt !== null) return 1;
        if (a.amslFt !== null && b.amslFt === null) return -1;
        return (b.amslFt ?? 0) - (a.amslFt ?? 0);
      }
      return a.distanceNm - b.distanceNm;
    })
    .slice(0, options.limit);
  return {
    nearby,
    highestObstacle,
    mslElevationAvailableCount,
    missingMslElevationCount,
    clearanceStatus:
      withinRadius.length === 0
        ? "no-nearby-obstacles"
        : highestObstacle
          ? "verifiable"
          : "unverifiable",
  };
}

type VerifiedSnapshot = {
  records: FaaObstacleRecord[];
  fetchedAtMs: number;
  publishedAtMs: number | null;
  provenance: FaaObstacleReferenceData["provenance"];
  sourceHost: string;
  sourcePath: string;
  freshnessBasis: string[];
  archiveBytes: number;
  csvBytes: number;
  restoredFromDurableCache: boolean;
};

type DirectoryMetadata = {
  sizeBytes: number;
  listedAt: string | null;
  listedAtMs: number | null;
};

type FetchLike = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

export type FaaObstacleDataServiceOptions = {
  sourceUrl?: string;
  sourceWasOverridden?: boolean;
  cacheTtlMs?: number;
  retryCooldownMs?: number;
  maxStaleMs?: number;
  downloadTimeoutMs?: number;
  directoryTimeoutMs?: number;
  minRecords?: number;
  maxRecords?: number;
  maxArchiveBytes?: number;
  maxCsvBytes?: number;
  maxPublicationAgeMs?: number;
  fetchImpl?: FetchLike;
  now?: () => number;
  snapshotStore?: FaaObstacleSnapshotStore;
};

export class FaaObstacleDataError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "FaaObstacleDataError";
  }
}

export function resolveFaaObstacleSource(
  rawOverride: string | undefined,
): { sourceUrl: string; sourceWasOverridden: boolean } {
  const override = String(rawOverride || "").trim();
  return override
    ? { sourceUrl: override, sourceWasOverridden: true }
    : { sourceUrl: OFFICIAL_FAA_DDOF_URL, sourceWasOverridden: false };
}

export function resolveFaaObstacleCacheTtlMs(rawValue: string | undefined) {
  const normalized = String(rawValue || "").trim();
  if (!normalized) return DEFAULT_FAA_DDOF_CACHE_TTL_MS;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_FAA_DDOF_CACHE_TTL_MS;
  }
  return Math.min(
    Math.max(Math.round(parsed), MIN_FAA_DDOF_CACHE_TTL_MS),
    MAX_FAA_DDOF_CACHE_TTL_MS,
  );
}

function safeSourceParts(sourceUrl: string) {
  try {
    const parsed = new URL(sourceUrl);
    return { sourceHost: parsed.hostname, sourcePath: parsed.pathname };
  } catch {
    return { sourceHost: "configured-source", sourcePath: "unavailable" };
  }
}

export function buildFaaObstacleDownloadUrl({
  sourceUrl,
  sourceWasOverridden,
  nowMs,
  cacheTtlMs,
}: {
  sourceUrl: string;
  sourceWasOverridden: boolean;
  nowMs: number;
  cacheTtlMs: number;
}) {
  void sourceWasOverridden;
  void nowMs;
  void cacheTtlMs;
  return sourceUrl;
}

function findHeaderIndex(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map((alias) => alias.toUpperCase());
  return headers.findIndex((header) => normalizedAliases.includes(header));
}

function parseCsvNumber(value: string | undefined) {
  if (!value) return null;
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function internNullable(value: string, pool: Map<string, string>) {
  const normalized = value.trim();
  if (!normalized) return null;
  const existing = pool.get(normalized);
  if (existing) return existing;
  pool.set(normalized, normalized);
  return normalized;
}

export function parseFaaObstacleCsvBuffer(
  csvBuffer: Buffer,
  options: { minRecords?: number; maxRecords?: number } = {},
) {
  const minRecords = options.minRecords ?? DEFAULT_MIN_RECORDS;
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const records: FaaObstacleRecord[] = [];
  const stringPool = new Map<string, string>();
  let headers: string[] | null = null;
  let indexes:
    | {
        id: number;
        lat: number;
        lon: number;
        amsl: number;
        agl: number;
        city: number;
        state: number;
        kind: number;
        lighting: number;
      }
    | null = null;
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let dataRows = 0;
  let invalidCoordinateRows = 0;
  const seenIdentifiers = new Set<string>();

  const processRow = () => {
    if (!row.some((value) => value.length > 0)) return;
    if (!headers) {
      headers = row.map((value, index) =>
        (index === 0 ? value.replace(/^\uFEFF/, "") : value)
          .trim()
          .toUpperCase(),
      );
      indexes = {
        id: findHeaderIndex(headers, ["OAS", "OID", "OBSTACLEID", "ID", "NUMBER"]),
        lat: findHeaderIndex(headers, ["LATDEC", "LATITUDE", "LATDD", "LATITUDEDECIMAL"]),
        lon: findHeaderIndex(headers, ["LONDEC", "LONGITUDE", "LONDD", "LONGITUDEDECIMAL"]),
        amsl: findHeaderIndex(headers, ["AMSL", "ALT_MSL", "ELEVATION", "MSL"]),
        agl: findHeaderIndex(headers, ["AGL", "HEIGHTAGL", "HEIGHT_AGL"]),
        city: findHeaderIndex(headers, ["CITY", "CITYNAME"]),
        state: findHeaderIndex(headers, ["STATE", "STATEABBR"]),
        kind: findHeaderIndex(headers, ["TYPE", "OBSTACLETYPE", "KIND"]),
        lighting: findHeaderIndex(headers, ["LIGHTING", "LIGHTEDIND", "MARKER"]),
      };
      const missing = [
        ["identifier", indexes.id],
        ["latitude", indexes.lat],
        ["longitude", indexes.lon],
        ["AGL", indexes.agl],
        ["AMSL", indexes.amsl],
        ["type", indexes.kind],
      ]
        .filter(([, index]) => Number(index) < 0)
        .map(([name]) => name);
      if (missing.length) {
        throw new FaaObstacleDataError(
          `FAA DDOF CSV is missing required headers: ${missing.join(", ")}`,
        );
      }
      return;
    }

    dataRows += 1;
    if (!indexes) return;
    const lat = parseCsvNumber(row[indexes.lat]);
    const lon = parseCsvNumber(row[indexes.lon]);
    if (
      lat === null ||
      lon === null ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      invalidCoordinateRows += 1;
      return;
    }
    const id = String(row[indexes.id] || "").trim();
    if (!id) {
      throw new FaaObstacleDataError(
        `FAA DDOF record ${dataRows} is missing its stable obstacle identifier`,
      );
    }
    if (seenIdentifiers.has(id)) {
      throw new FaaObstacleDataError(
        `FAA DDOF contains duplicate stable obstacle identifier ${id}`,
      );
    }
    seenIdentifiers.add(id);
    const amslFt = parseCsvNumber(row[indexes.amsl]);
    const aglFt = parseCsvNumber(row[indexes.agl]);
    if (amslFt !== null && (amslFt < -2_000 || amslFt > 100_000)) {
      throw new FaaObstacleDataError(`FAA DDOF record ${id} has an invalid AMSL elevation`);
    }
    if (aglFt !== null && (aglFt < 0 || aglFt > 100_000)) {
      throw new FaaObstacleDataError(`FAA DDOF record ${id} has an invalid AGL height`);
    }
    records.push({
      id,
      lat,
      lon,
      amslFt,
      aglFt,
      city:
        indexes.city >= 0
          ? internNullable(String(row[indexes.city] || ""), stringPool)
          : null,
      state:
        indexes.state >= 0
          ? internNullable(String(row[indexes.state] || ""), stringPool)
          : null,
      kind: internNullable(String(row[indexes.kind] || ""), stringPool),
      lighting:
        indexes.lighting >= 0
          ? internNullable(String(row[indexes.lighting] || ""), stringPool)
          : null,
    });
    if (records.length > maxRecords) {
      throw new FaaObstacleDataError(
        `FAA DDOF record count exceeded the safe limit of ${maxRecords}`,
      );
    }
  };

  for (let index = 0; index < csvBuffer.length; index += 1) {
    const byte = csvBuffer[index];
    const next = csvBuffer[index + 1];
    if (byte === 34) {
      if (inQuotes && next === 34) {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (byte === 44 && !inQuotes) {
      row.push(field.trim());
      field = "";
      continue;
    }
    if ((byte === 10 || byte === 13) && !inQuotes) {
      if (byte === 13 && next === 10) index += 1;
      row.push(field.trim());
      field = "";
      processRow();
      row = [];
      continue;
    }
    field += String.fromCharCode(byte);
  }
  if (field.length || row.length) {
    row.push(field.trim());
    processRow();
  }
  if (inQuotes) {
    throw new FaaObstacleDataError("FAA DDOF CSV ended inside a quoted field");
  }
  if (!headers) {
    throw new FaaObstacleDataError("FAA DDOF CSV did not contain a header row");
  }
  if (records.length < minRecords) {
    throw new FaaObstacleDataError(
      `FAA DDOF record count ${records.length} is below the safe minimum ${minRecords}`,
    );
  }
  const validRatio = dataRows > 0 ? records.length / dataRows : 0;
  if (validRatio < 0.98) {
    throw new FaaObstacleDataError(
      `FAA DDOF coordinate validation failed for ${invalidCoordinateRows} of ${dataRows} rows`,
    );
  }
  return {
    records,
    headers,
    dataRows,
    invalidCoordinateRows,
  };
}

async function fetchResponseBodyWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  options: RequestInit,
  timeoutMs: number,
  mode: "buffer" | "text",
  maxBodyBytes: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new FaaObstacleDataError(
        `FAA DDOF download failed (${response.status})`,
      );
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
      throw new FaaObstacleDataError(
        `FAA DDOF response size ${declaredLength} exceeds the safe limit`,
      );
    }
    const reader = response.body?.getReader();
    if (!reader) {
      throw new FaaObstacleDataError("FAA DDOF response did not include a body");
    }
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBodyBytes) {
        controller.abort();
        throw new FaaObstacleDataError(
          `FAA DDOF response exceeded the safe limit of ${maxBodyBytes} bytes`,
        );
      }
      chunks.push(Buffer.from(value));
    }
    const buffer = Buffer.concat(chunks, totalBytes);
    const body = mode === "buffer" ? buffer : buffer.toString("utf8");
    return { response, body };
  } catch (error) {
    if (error instanceof FaaObstacleDataError) throw error;
    const message =
      error instanceof Error ? error.message : "Unknown FAA DDOF fetch error";
    throw new FaaObstacleDataError(`FAA DDOF fetch failed: ${message}`, {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHeadWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  options: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      ...options,
      method: "HEAD",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new FaaObstacleDataError(
        `FAA DDOF metadata request failed (${response.status})`,
      );
    }
    return response;
  } catch (error) {
    if (error instanceof FaaObstacleDataError) throw error;
    const message =
      error instanceof Error ? error.message : "Unknown FAA DDOF metadata error";
    throw new FaaObstacleDataError(`FAA DDOF metadata fetch failed: ${message}`, {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function parseHttpDate(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDirectoryMetadata(html: string): DirectoryMetadata | null {
  const match = html.match(
    /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}\s+[AP]M)\s+(\d+)\s+<A[^>]+HREF=["'][^"']*DAILY_DOF_CSV\.ZIP["']/i,
  );
  if (!match) return null;
  const listedAt = `${match[1]} ${match[2]}`;
  const listedAtMs = Date.parse(`${listedAt} UTC`);
  return {
    listedAt,
    listedAtMs: Number.isFinite(listedAtMs) ? listedAtMs : null,
    sizeBytes: Number(match[3]),
  };
}

function findDofCsvEntry(zip: AdmZip) {
  return zip.getEntries().find((entry) => {
    if (entry.isDirectory) return false;
    const basename = entry.entryName.split(/[\\/]/).pop() || "";
    return basename.toUpperCase() === "DOF.CSV";
  });
}

function publicReferenceData(
  snapshot: VerifiedSnapshot,
  nowMs: number,
  stale: boolean,
  warning: string | null,
): FaaObstacleReferenceData {
  const cacheAgeMs = Math.max(0, nowMs - snapshot.fetchedAtMs);
  const dataAgeMs =
    snapshot.publishedAtMs === null
      ? null
      : Math.max(0, nowMs - snapshot.publishedAtMs);
  return {
    provider: "FAA Daily DOF",
    provenance: snapshot.provenance,
    sourceHost: snapshot.sourceHost,
    sourcePath: snapshot.sourcePath,
    fetchedAt: new Date(snapshot.fetchedAtMs).toISOString(),
    publishedAt:
      snapshot.publishedAtMs === null
        ? null
        : new Date(snapshot.publishedAtMs).toISOString(),
    freshnessBasis: snapshot.freshnessBasis,
    recordCount: snapshot.records.length,
    archiveBytes: snapshot.archiveBytes,
    csvBytes: snapshot.csvBytes,
    cacheAgeMs,
    dataAgeMs,
    stale,
    status: stale ? "stale" : "fresh",
    warning,
  };
}

export function createFaaObstacleDataService(
  options: FaaObstacleDataServiceOptions = {},
) {
  const sourceUrl = options.sourceUrl || OFFICIAL_FAA_DDOF_URL;
  const sourceWasOverridden = Boolean(options.sourceWasOverridden);
  const cacheTtlMs =
    options.cacheTtlMs ?? DEFAULT_FAA_DDOF_CACHE_TTL_MS;
  const retryCooldownMs =
    options.retryCooldownMs ?? DEFAULT_RETRY_COOLDOWN_MS;
  const maxStaleMs = options.maxStaleMs ?? DEFAULT_MAX_STALE_MS;
  const downloadTimeoutMs =
    options.downloadTimeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;
  const directoryTimeoutMs =
    options.directoryTimeoutMs ?? DEFAULT_DIRECTORY_TIMEOUT_MS;
  const maxArchiveBytes =
    options.maxArchiveBytes ?? DEFAULT_MAX_ARCHIVE_BYTES;
  const maxCsvBytes = options.maxCsvBytes ?? DEFAULT_MAX_CSV_BYTES;
  const maxPublicationAgeMs =
    options.maxPublicationAgeMs ?? DEFAULT_MAX_PUBLICATION_AGE_MS;
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || Date.now;
  const snapshotStore = options.snapshotStore;
  const sourceParts = safeSourceParts(sourceUrl);
  let snapshot: VerifiedSnapshot | null = null;
  let refreshPromise: Promise<VerifiedSnapshot> | null = null;
  let restorePromise: Promise<void> | null = null;
  let restoreAttempted = false;
  let retryAfterMs = 0;
  let lastRefreshError: string | null = null;

  const validateArchive = (
    archive: Buffer,
    context: {
      fetchedAtMs: number;
      publishedAtMs: number | null;
      provenance: FaaObstacleReferenceData["provenance"];
      freshnessBasis: string[];
      restoredFromDurableCache: boolean;
      expectedCsvBytes?: number;
      expectedRecordCount?: number;
      sourceHost?: string;
      sourcePath?: string;
    },
  ): VerifiedSnapshot => {
    if (archive.length <= 0 || archive.length > maxArchiveBytes) {
      throw new FaaObstacleDataError(
        `FAA DDOF archive size ${archive.length} is outside the safe range`,
      );
    }
    let zip: AdmZip;
    try {
      zip = new AdmZip(archive);
    } catch (error) {
      throw new FaaObstacleDataError("FAA DDOF archive was not a valid ZIP", {
        cause: error,
      });
    }
    const csvEntry = findDofCsvEntry(zip);
    if (!csvEntry) {
      throw new FaaObstacleDataError("FAA DDOF archive did not contain DOF.CSV");
    }
    if (csvEntry.header.size <= 0 || csvEntry.header.size > maxCsvBytes) {
      throw new FaaObstacleDataError(
        `FAA DDOF CSV size ${csvEntry.header.size} is outside the safe range`,
      );
    }
    let csvBuffer: Buffer;
    try {
      csvBuffer = csvEntry.getData();
    } catch (error) {
      throw new FaaObstacleDataError("FAA DDOF CSV could not be decompressed", {
        cause: error,
      });
    }
    if (csvBuffer.length !== csvEntry.header.size) {
      throw new FaaObstacleDataError(
        "FAA DDOF CSV decompressed size did not match its ZIP metadata",
      );
    }
    if (
      context.expectedCsvBytes !== undefined &&
      csvBuffer.length !== context.expectedCsvBytes
    ) {
      throw new FaaObstacleDataError(
        "FAA DDOF durable snapshot CSV size did not match its manifest",
      );
    }
    const parsed = parseFaaObstacleCsvBuffer(csvBuffer, {
      minRecords: options.minRecords,
      maxRecords: options.maxRecords,
    });
    if (
      context.expectedRecordCount !== undefined &&
      parsed.records.length !== context.expectedRecordCount
    ) {
      throw new FaaObstacleDataError(
        "FAA DDOF durable snapshot record count did not match its manifest",
      );
    }
    return {
      records: parsed.records,
      fetchedAtMs: context.fetchedAtMs,
      publishedAtMs: context.publishedAtMs,
      provenance: context.provenance,
      sourceHost: context.sourceHost ?? sourceParts.sourceHost,
      sourcePath: context.sourcePath ?? sourceParts.sourcePath,
      freshnessBasis: context.freshnessBasis,
      archiveBytes: archive.length,
      csvBytes: csvBuffer.length,
      restoredFromDurableCache: context.restoredFromDurableCache,
    };
  };

  const fetchDirectory = async () => {
    if (sourceWasOverridden) return null;
    try {
      const result = await fetchResponseBodyWithTimeout(
        fetchImpl,
        OFFICIAL_FAA_DDOF_DIRECTORY_URL,
        {
          headers: {
            Accept: "text/html",
            "Cache-Control": "no-cache",
            "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)",
          },
        },
        directoryTimeoutMs,
        "text",
        1024 * 1024,
      );
      return parseDirectoryMetadata(result.body as string);
    } catch {
      return null;
    }
  };

  const refresh = async () => {
    const startedAt = now();
    const downloadUrl = buildFaaObstacleDownloadUrl({
      sourceUrl,
      sourceWasOverridden,
      nowMs: startedAt,
      cacheTtlMs,
    });
    const directoryMetadata = await fetchDirectory();
    if (!sourceWasOverridden) {
      const headResponse = await fetchHeadWithTimeout(
        fetchImpl,
        downloadUrl,
        {
          headers: {
            Accept: "application/octet-stream",
            "Accept-Encoding": "identity",
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
            "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)",
          },
        },
        directoryTimeoutMs,
      );
      const headLength = Number(headResponse.headers.get("content-length"));
      if (
        directoryMetadata &&
        Number.isFinite(headLength) &&
        headLength > 0 &&
        headLength !== directoryMetadata.sizeBytes
      ) {
        throw new FaaObstacleDataError(
          "FAA DDOF CDN metadata did not match the current official directory publication",
        );
      }
    }
    const result = await fetchResponseBodyWithTimeout(
      fetchImpl,
      downloadUrl,
      {
        headers: {
          Accept: "application/octet-stream",
          "Accept-Encoding": "identity",
          ...(sourceWasOverridden
            ? {}
            : { "Cache-Control": "no-cache", Pragma: "no-cache" }),
          "User-Agent": "ReadySetFly/1.0 (+https://readysetfly.us)",
        },
      },
      downloadTimeoutMs,
      "buffer",
      maxArchiveBytes,
    );
    const archive = result.body as Buffer;
    if (
      directoryMetadata &&
      Number.isFinite(directoryMetadata.sizeBytes) &&
      directoryMetadata.sizeBytes !== archive.length
    ) {
      throw new FaaObstacleDataError(
        "FAA DDOF archive did not match the current official directory publication",
      );
    }

    const httpPublishedAt = parseHttpDate(
      result.response.headers.get("last-modified"),
    );
    let zip: AdmZip;
    try {
      zip = new AdmZip(archive);
    } catch (error) {
      throw new FaaObstacleDataError("FAA DDOF archive was not a valid ZIP", {
        cause: error,
      });
    }
    const csvEntry = findDofCsvEntry(zip);
    if (!csvEntry) {
      throw new FaaObstacleDataError("FAA DDOF archive did not contain DOF.CSV");
    }
    const zipPublishedAt = csvEntry.header.time?.getTime?.() || null;
    const publishedAtMs = directoryMetadata?.listedAtMs ?? zipPublishedAt ?? httpPublishedAt;
    const freshnessBasis: string[] = [];
    if (httpPublishedAt !== null) freshnessBasis.push("http-last-modified");
    if (zipPublishedAt !== null) freshnessBasis.push("zip-entry-time");
    if (directoryMetadata) freshnessBasis.push("faa-directory-size");
    if (directoryMetadata?.listedAtMs !== null && directoryMetadata?.listedAtMs !== undefined) {
      freshnessBasis.push("faa-directory-listing-time");
    }
    const publicationSignals = [zipPublishedAt, directoryMetadata?.listedAtMs ?? null].filter(
      (value): value is number => value !== null,
    );
    if (
      publicationSignals.some(
        (value) => value > startedAt + 24 * 60 * 60 * 1000,
      )
    ) {
      throw new FaaObstacleDataError(
        "FAA DDOF publication timestamp is unexpectedly in the future",
      );
    }
    if (
      publicationSignals.some(
        (value) => startedAt - value > maxPublicationAgeMs,
      )
    ) {
      throw new FaaObstacleDataError(
        "FAA DDOF publication is older than the accepted freshness window",
      );
    }

    const nextSnapshot = validateArchive(archive, {
      fetchedAtMs: now(),
      publishedAtMs,
      provenance: sourceWasOverridden ? "environment-override" : "official-default",
      freshnessBasis,
      restoredFromDurableCache: false,
    });
    snapshot = nextSnapshot;
    retryAfterMs = 0;
    lastRefreshError = null;
    if (snapshotStore) {
      const checksumSha256 = createHash("sha256").update(archive).digest("hex");
      const durable: FaaObstacleDurableSnapshot = {
        archive,
        manifest: {
          version: 1,
          archiveKey: "reference-data/faa-obstacles/archives/pending.zip",
          checksumSha256,
          archiveBytes: archive.length,
          csvBytes: nextSnapshot.csvBytes,
          recordCount: nextSnapshot.records.length,
          fetchedAt: new Date(nextSnapshot.fetchedAtMs).toISOString(),
          publishedAt:
            nextSnapshot.publishedAtMs === null
              ? null
              : new Date(nextSnapshot.publishedAtMs).toISOString(),
          provenance: nextSnapshot.provenance,
          sourceHost: nextSnapshot.sourceHost,
          sourcePath: nextSnapshot.sourcePath,
          freshnessBasis: nextSnapshot.freshnessBasis,
        },
      };
      try {
        await snapshotStore.save(durable);
      } catch (error) {
        console.warn("faa_obstacle_snapshot_persist_failed", {
          error: error instanceof Error ? error.message : "snapshot persistence failed",
        });
      }
    }
    return nextSnapshot;
  };

  const restoreDurableSnapshot = async () => {
    if (!snapshotStore || restoreAttempted) return;
    restoreAttempted = true;
    try {
      const durable = await snapshotStore.load();
      if (!durable) return;
      const checksumSha256 = createHash("sha256")
        .update(durable.archive)
        .digest("hex");
      if (
        durable.archive.length !== durable.manifest.archiveBytes ||
        checksumSha256 !== durable.manifest.checksumSha256
      ) {
        throw new FaaObstacleDataError(
          "FAA DDOF durable snapshot archive did not match its manifest",
        );
      }
      const fetchedAtMs = Date.parse(durable.manifest.fetchedAt);
      const publishedAtMs = durable.manifest.publishedAt
        ? Date.parse(durable.manifest.publishedAt)
        : null;
      if (
        !Number.isFinite(fetchedAtMs) ||
        (publishedAtMs !== null && !Number.isFinite(publishedAtMs)) ||
        fetchedAtMs > now() + 5 * 60 * 1000 ||
        (publishedAtMs !== null && publishedAtMs > now() + 24 * 60 * 60 * 1000) ||
        now() - fetchedAtMs > maxStaleMs
      ) {
        throw new FaaObstacleDataError("FAA DDOF durable snapshot is expired or invalid");
      }
      const restored = validateArchive(durable.archive, {
        fetchedAtMs,
        publishedAtMs,
        provenance: durable.manifest.provenance,
        freshnessBasis: [...durable.manifest.freshnessBasis, "durable-s3-snapshot"],
        restoredFromDurableCache: true,
        expectedCsvBytes: durable.manifest.csvBytes,
        expectedRecordCount: durable.manifest.recordCount,
        sourceHost: durable.manifest.sourceHost,
        sourcePath: durable.manifest.sourcePath,
      });
      snapshot = restored;
    } catch (error) {
      console.warn("faa_obstacle_snapshot_restore_failed", {
        error: error instanceof Error ? error.message : "snapshot restore failed",
      });
    }
  };

  const getData = async (): Promise<FaaObstacleDataResult> => {
    if (!restoreAttempted) {
      restorePromise ||= restoreDurableSnapshot().finally(() => {
        restorePromise = null;
      });
      await restorePromise;
    }
    const requestedAt = now();
    if (
      snapshot &&
      !snapshot.restoredFromDurableCache &&
      requestedAt - snapshot.fetchedAtMs <= cacheTtlMs
    ) {
      return {
        records: snapshot.records,
        referenceData: publicReferenceData(
          snapshot,
          requestedAt,
          false,
          null,
        ),
      };
    }
    if (snapshot && requestedAt < retryAfterMs) {
      const ageMs = requestedAt - snapshot.fetchedAtMs;
      if (ageMs <= maxStaleMs) {
        return {
          records: snapshot.records,
          referenceData: publicReferenceData(
            snapshot,
            requestedAt,
            true,
            "The FAA refresh is temporarily unavailable; verified last-known-good obstacle data is being shown.",
          ),
        };
      }
    }
    if (!snapshot && requestedAt < retryAfterMs) {
      throw new FaaObstacleDataError(
        "FAA DDOF refresh is temporarily in retry cooldown",
      );
    }

    refreshPromise ||= refresh().finally(() => {
      refreshPromise = null;
    });
    try {
      const refreshed = await refreshPromise;
      return {
        records: refreshed.records,
        referenceData: publicReferenceData(refreshed, now(), false, null),
      };
    } catch (error) {
      lastRefreshError =
        error instanceof Error ? error.message : "FAA DDOF refresh failed";
      retryAfterMs = now() + retryCooldownMs;
      if (snapshot && now() - snapshot.fetchedAtMs <= maxStaleMs) {
        return {
          records: snapshot.records,
          referenceData: publicReferenceData(
            snapshot,
            now(),
            true,
            "The FAA refresh failed; verified last-known-good obstacle data is being shown.",
          ),
        };
      }
      throw error;
    }
  };

  return {
    getData,
    getDiagnostics: () => ({
      hasSnapshot: Boolean(snapshot),
      recordCount: snapshot?.records.length || 0,
      retryAfterMs,
      lastRefreshError,
      cacheTtlMs,
      maxStaleMs,
      provenance: sourceWasOverridden
        ? "environment-override"
        : "official-default",
      ...sourceParts,
    }),
  };
}
