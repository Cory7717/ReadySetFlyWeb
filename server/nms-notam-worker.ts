import crypto from "crypto";
import zlib from "zlib";
import { db } from "./db";
import { notams as notamsTable, nmsSyncState } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

type NmsNotam = {
  icao: string;
  notamId: string;
  text: string;
  effectiveAt?: Date | null;
  expiresAt?: Date | null;
  lastUpdatedAt?: Date | null;
  raw?: any;
};

const NMS_ENABLED = String(process.env.NMS_ENABLED ?? "").toLowerCase() === "true";
const NMS_BASE_URL = (process.env.NMS_BASE_URL || "https://api-staging.cgifederal-aim.com/nmsapi/v1").replace(/\/+$/, "");
const NMS_AUTH_URL = (process.env.NMS_AUTH_URL || "https://api-staging.cgifederal-aim.com/v1/auth/token").replace(/\/+$/, "");
const NMS_RESPONSE_FORMAT = (process.env.NMS_RESPONSE_FORMAT || "GEOJSON").toUpperCase();
const NMS_CLASSIFICATIONS = (process.env.NMS_CLASSIFICATIONS || "DOMESTIC,INTERNATIONAL,MILITARY,LOCAL_MILITARY,FDC")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const NMS_INITIAL_LOAD_ON_START = String(process.env.NMS_INITIAL_LOAD_ON_START ?? "false").toLowerCase() === "true";
const NMS_POLL_INTERVAL_MINUTES = Number(process.env.NMS_POLL_INTERVAL_MINUTES || 15);
const NMS_SOURCE = "nms_api";
const MAX_DELTA_LOOKBACK_DAYS = 5;
const UPSERT_BATCH_SIZE = 500;

let workerStarted = false;
let activeSync = false;
let accessToken: string | null = null;
let accessTokenExpiresAt = 0;

function logEvent(payload: Record<string, any>) {
  console.log(JSON.stringify({ event: "nms_sync", ...payload }));
}

function buildUrl(path: string, params?: Record<string, string | undefined>) {
  const url = new URL(path.startsWith("http") ? path : `${NMS_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === "") continue;
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function looksGzipped(buffer: Buffer) {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizeIcao(value?: string | null) {
  if (!value) return null;
  const cleaned = String(value).trim().toUpperCase();
  if (!cleaned) return null;
  return cleaned;
}

function stableNotamId(seed: string) {
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 24);
}

function toArray<T>(value?: T | T[] | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractNotamText(notam: any, translations: any[] | undefined) {
  if (notam?.text && String(notam.text).trim()) return String(notam.text);
  const items = toArray(translations);
  const icao = items.find((entry) => entry?.type === "ICAO" && entry?.icao_message)?.icao_message;
  if (icao && String(icao).trim()) return String(icao);
  const domestic = items.find((entry) => entry?.type === "LOCAL_FORMAT" && entry?.domestic_message)?.domestic_message;
  if (domestic && String(domestic).trim()) return String(domestic);
  return "";
}

function buildNotamId(notam: any, icao: string, text: string) {
  if (notam?.id) return String(notam.id);
  const series = notam?.series ? String(notam.series).trim() : "";
  const number = notam?.number ? String(notam.number).trim() : "";
  const year = notam?.year ? String(notam.year).trim() : "";
  if (series || number || year) {
    return [series, number, year].filter(Boolean).join("/");
  }
  return stableNotamId(`${icao}|${notam?.issued || ""}|${text}`);
}

function extractGeojsonFeatures(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  const data = payload?.data ?? payload;
  if (Array.isArray(data?.geojson)) return data.geojson;
  if (Array.isArray(data?.features)) return data.features;
  if (data?.type === "FeatureCollection" && Array.isArray(data?.features)) return data.features;
  return [];
}

function parseGeojsonBuffer(buffer: Buffer, contentType?: string | null) {
  const gunzip = looksGzipped(buffer) || (contentType || "").includes("gzip");
  const rawBuffer = gunzip ? zlib.gunzipSync(buffer) : buffer;
  const text = rawBuffer.toString("utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn("NMS parse JSON failed:", error);
    return null;
  }
}

function resolveContentUrl(rawUrl: string) {
  if (!rawUrl) return null;
  if (rawUrl.startsWith("http")) return rawUrl;
  const base = new URL(NMS_BASE_URL);
  if (rawUrl.startsWith("/")) {
    return `${base.origin}${rawUrl}`;
  }
  return `${base.origin}/${rawUrl}`;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function getAccessToken() {
  const now = Date.now();
  if (accessToken && now < accessTokenExpiresAt - 30_000) return accessToken;
  const clientId = process.env.NMS_CLIENT_ID;
  const clientSecret = process.env.NMS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("NMS credentials not configured");
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetchWithTimeout(
    NMS_AUTH_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${authHeader}`,
      },
      body: "grant_type=client_credentials",
    },
    15000
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`NMS token fetch failed (${response.status}) ${text.slice(0, 200)}`);
  }
  const payload = await response.json();
  accessToken = payload?.access_token || payload?.accessToken || null;
  const expiresIn = Number(payload?.expires_in || payload?.expiresIn || 0);
  accessTokenExpiresAt = Date.now() + Math.max(expiresIn, 600) * 1000;
  if (!accessToken) {
    throw new Error("NMS token response missing access_token");
  }
  return accessToken;
}

async function fetchNms(path: string, params?: Record<string, string | undefined>) {
  const token = await getAccessToken();
  const url = buildUrl(path, params);
  const response = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      nmsResponseFormat: NMS_RESPONSE_FORMAT,
    },
  });
  if (response.status === 401 || response.status === 403) {
    accessToken = null;
    accessTokenExpiresAt = 0;
  }
  return response;
}

async function fetchContentFromUrl(url: string) {
  const urlObj = new URL(url);
  const base = new URL(NMS_BASE_URL);
  const sameOrigin = urlObj.origin === base.origin;
  const headers: Record<string, string> = {};

  if (sameOrigin) {
    const token = await getAccessToken();
    headers.Authorization = `Bearer ${token}`;
    headers.nmsResponseFormat = NMS_RESPONSE_FORMAT;
  }

  const response = await fetchWithTimeout(url, { headers }, 30000);
  if ((response.status === 401 || response.status === 403) && sameOrigin) {
    accessToken = null;
    accessTokenExpiresAt = 0;
  }
  if (!response.ok) {
    throw new Error(`NMS content fetch failed (${response.status}) ${urlObj.pathname}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return parseGeojsonBuffer(buffer, response.headers.get("content-type"));
}

async function fetchGeojsonPayload(path: string, params?: Record<string, string | undefined>) {
  const response = await fetchNms(path, params);
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`NMS request failed (${response.status}) ${text.slice(0, 200)}`);
  }

  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    if (!payload) return null;
    const features = extractGeojsonFeatures(payload);
    if (features.length > 0) return payload;
    const url = payload?.data?.url || payload?.data?.contentUrl || payload?.url;
    if (url) {
      const resolved = resolveContentUrl(String(url));
      if (resolved) return fetchContentFromUrl(resolved);
    }
    return payload;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return parseGeojsonBuffer(buffer, contentType);
}

function mapFeatureToNotam(feature: any): NmsNotam | null {
  const core = feature?.properties?.coreNOTAMData || feature?.coreNOTAMData || feature?.properties?.coreNotamData;
  const notam = core?.notam || feature?.properties?.notam || feature?.notam;
  if (!notam) return null;
  const translations = core?.notamTranslation || core?.notamTranslationList;
  const text = extractNotamText(notam, translations);
  if (!text.trim()) return null;

  const icao = normalizeIcao(notam?.icaoLocation || notam?.location || notam?.accountId);
  if (!icao) return null;
  const notamId = buildNotamId(notam, icao, text);
  const effectiveAt = parseDate(notam?.effectiveStart) || parseDate(notam?.issued);
  const expiresAt = parseDate(notam?.effectiveEnd) || parseDate(notam?.cancelationDate);
  const lastUpdatedAt = parseDate(notam?.lastUpdated);

  return {
    icao,
    notamId,
    text,
    effectiveAt,
    expiresAt,
    lastUpdatedAt,
    raw: feature,
  };
}

async function upsertNotams(notams: NmsNotam[]) {
  if (!notams.length) return;
  for (let i = 0; i < notams.length; i += UPSERT_BATCH_SIZE) {
    const batch = notams.slice(i, i + UPSERT_BATCH_SIZE);
    const now = new Date();
    try {
      await db
        .insert(notamsTable)
        .values(
          batch.map((item) => ({
            icao: item.icao,
            notamId: item.notamId,
            text: item.text,
            effectiveAt: item.effectiveAt ?? null,
            expiresAt: item.expiresAt ?? null,
            source: NMS_SOURCE,
            raw: item.raw ?? null,
            updatedAt: now,
          }))
        )
        .onConflictDoUpdate({
          target: notamsTable.notamId,
          set: {
            icao: sql`excluded.icao`,
            text: sql`excluded.text`,
            effectiveAt: sql`excluded.effective_at`,
            expiresAt: sql`excluded.expires_at`,
            source: NMS_SOURCE,
            raw: sql`excluded.raw`,
            updatedAt: now,
          },
        });
    } catch (error) {
      console.warn("NMS upsert failed:", error);
    }
  }
}

async function getStateValue(key: string) {
  const [row] = await db.select().from(nmsSyncState).where(eq(nmsSyncState.key, key)).limit(1);
  return row?.value ?? null;
}

async function setStateValue(key: string, value: string) {
  await db
    .insert(nmsSyncState)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: nmsSyncState.key,
      set: { value, updatedAt: new Date() },
    });
}

function clampLookback(date: Date) {
  const maxLookbackMs = MAX_DELTA_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const earliest = Date.now() - maxLookbackMs;
  if (date.getTime() < earliest) return new Date(earliest);
  return date;
}

async function runInitialLoad() {
  const started = Date.now();
  const classifications = NMS_CLASSIFICATIONS.length > 0 ? NMS_CLASSIFICATIONS : ["DOMESTIC"];
  let total = 0;
  let latestUpdated: Date | null = null;

  for (const classification of classifications) {
    const payload = await fetchGeojsonPayload("/notams", {
      classification,
      allowRedirect: "false",
    });
    const features = extractGeojsonFeatures(payload);
    const mapped = features.map(mapFeatureToNotam).filter(Boolean) as NmsNotam[];
    total += mapped.length;
    for (const item of mapped) {
      if (item.lastUpdatedAt && (!latestUpdated || item.lastUpdatedAt > latestUpdated)) {
        latestUpdated = item.lastUpdatedAt;
      }
    }
    await upsertNotams(mapped);
    logEvent({
      phase: "initial_load",
      classification,
      count: mapped.length,
      durationMs: Date.now() - started,
    });
  }

  if (latestUpdated) {
    await setStateValue("lastUpdatedDate", latestUpdated.toISOString());
  }
  await setStateValue("initialLoadCompleted", "true");
  logEvent({
    phase: "initial_load_complete",
    classifications: classifications.length,
    total,
    durationMs: Date.now() - started,
  });
}

async function runDeltaSync() {
  if (activeSync) return;
  activeSync = true;
  const started = Date.now();
  try {
    const lastUpdatedRaw = await getStateValue("lastUpdatedDate");
    const fallback = new Date(Date.now() - 60 * 60 * 1000);
    const lastUpdated = lastUpdatedRaw ? clampLookback(new Date(lastUpdatedRaw)) : fallback;
    const classifications = NMS_CLASSIFICATIONS.length > 0 ? NMS_CLASSIFICATIONS : ["DOMESTIC"];

    let latestUpdated: Date | null = lastUpdated;
    let total = 0;

    for (const classification of classifications) {
      const payload = await fetchGeojsonPayload("/notams", {
        classification,
        lastUpdatedDate: lastUpdated.toISOString(),
      });
      const features = extractGeojsonFeatures(payload);
      const mapped = features.map(mapFeatureToNotam).filter(Boolean) as NmsNotam[];
      total += mapped.length;
      for (const item of mapped) {
        if (item.lastUpdatedAt && (!latestUpdated || item.lastUpdatedAt > latestUpdated)) {
          latestUpdated = item.lastUpdatedAt;
        }
      }
      await upsertNotams(mapped);
      logEvent({
        phase: "delta",
        classification,
        count: mapped.length,
        durationMs: Date.now() - started,
      });
    }

    if (latestUpdated) {
      await setStateValue("lastUpdatedDate", latestUpdated.toISOString());
    }
    logEvent({
      phase: "delta_complete",
      total,
      durationMs: Date.now() - started,
    });
  } catch (error: any) {
    logEvent({
      phase: "delta_error",
      error: error?.message || String(error),
    });
  } finally {
    activeSync = false;
  }
}

async function runInitialLoadIfNeeded() {
  if (!NMS_INITIAL_LOAD_ON_START) {
    logEvent({ phase: "initial_load_skipped", reason: "disabled" });
    return;
  }
  const completed = await getStateValue("initialLoadCompleted");
  if (completed === "true") return;
  try {
    await runInitialLoad();
  } catch (error: any) {
    logEvent({ phase: "initial_load_error", error: error?.message || String(error) });
  }
}

async function runInitialLoadJob() {
  logEvent({ phase: "initial_load_job_started" });
  try {
    await runInitialLoad();
    logEvent({ phase: "initial_load_job_complete" });
  } catch (error: any) {
    logEvent({ phase: "initial_load_job_error", error: error?.message || String(error) });
    throw error;
  }
}

export function startNmsNotamWorker() {
  if (!NMS_ENABLED) return false;
  if (NMS_RESPONSE_FORMAT !== "GEOJSON") {
    logEvent({ phase: "disabled", reason: "NMS_RESPONSE_FORMAT must be GEOJSON" });
    return false;
  }
  if (workerStarted) return true;
  workerStarted = true;

  void runInitialLoadIfNeeded();
  const intervalMs = Math.max(1, NMS_POLL_INTERVAL_MINUTES) * 60 * 1000;
  setInterval(() => {
    void runDeltaSync();
  }, intervalMs);
  void runDeltaSync();

  logEvent({
    phase: "started",
    intervalMinutes: NMS_POLL_INTERVAL_MINUTES,
    classifications: NMS_CLASSIFICATIONS,
  });
  return true;
}

if (process.argv.includes("--initial-load")) {
  void runInitialLoadJob()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
