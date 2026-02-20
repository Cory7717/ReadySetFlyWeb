import crypto from "crypto";
import { createRequire } from "module";
import zlib from "zlib";
import { XMLParser } from "fast-xml-parser";
import { db } from "./db";
import { notams as notamsTable } from "@shared/schema";

const require = createRequire(import.meta.url);
let solclientjs: any = null;
try {
  const solclientModule = require("solclientjs");
  solclientjs =
    solclientModule?.SessionEventCode ? solclientModule : solclientModule?.debug || solclientModule;
} catch (error) {
  console.error("Solace client load failed:", error);
  solclientjs = null;
}
let solaceInitialized = false;

type NormalizedNotam = {
  icao: string;
  notamId: string;
  text: string;
  effectiveAt?: Date | null;
  expiresAt?: Date | null;
  raw?: any;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: true,
  trimValues: true,
});

function parseNotamDate(raw?: string | null) {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!/^\d{10}$/.test(cleaned)) return null;
  const year = 2000 + Number(cleaned.slice(0, 2));
  const month = Number(cleaned.slice(2, 4)) - 1;
  const day = Number(cleaned.slice(4, 6));
  const hour = Number(cleaned.slice(6, 8));
  const minute = Number(cleaned.slice(8, 10));
  return new Date(Date.UTC(year, month, day, hour, minute));
}

function extractFromText(text: string): Partial<NormalizedNotam> {
  const icaoMatch = text.match(/\bA\)\s*([A-Z]{3,4})/);
  const effMatch = text.match(/\bB\)\s*([0-9]{10})/);
  const expMatch = text.match(/\bC\)\s*([0-9]{10})/);
  const idMatch = text.match(/\b([A-Z]{3,4}\s\d{2}\/\d{3})\b/);

  return {
    icao: icaoMatch?.[1]?.toUpperCase(),
    notamId: idMatch?.[1]?.replace(/\s+/g, " "),
    effectiveAt: parseNotamDate(effMatch?.[1]),
    expiresAt: parseNotamDate(expMatch?.[1]),
  };
}

function stableNotamId(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 24);
}

const TEXT_KEYS = [
  "text",
  "notamText",
  "notam_text",
  "rawText",
  "message",
  "body",
  "NOTAM_TEXT",
  "NOTAM-TEXT",
  "notam-text",
];

const ICAO_KEYS = [
  "icao",
  "ICAO",
  "location",
  "Location",
  "locationIndicator",
  "location_indicator",
  "locationIndicatorICAO",
  "facilityDesignator",
  "facility_designator",
  "aerodrome",
  "airport",
  "facility",
];

const TEXT_KEYS_LOWER = new Set(TEXT_KEYS.map((key) => key.toLowerCase()));
const ICAO_KEYS_LOWER = new Set(ICAO_KEYS.map((key) => key.toLowerCase()));

function keyVariants(rawKey: string) {
  const trimmed = rawKey.trim();
  if (!trimmed) return [rawKey];
  const parts = trimmed.split(":");
  const last = parts[parts.length - 1] || trimmed;
  return [trimmed, last];
}

function matchesKey(rawKey: string, keysLower: Set<string>) {
  return keyVariants(rawKey).some((variant) => keysLower.has(variant.toLowerCase()));
}

function extractIcaoFromValue(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    const match = value.toUpperCase().match(/\b[A-Z]{3,4}\b/);
    return match?.[0];
  }
  if (typeof value === "object") {
    const nested =
      value?.icao ||
      value?.ICAO ||
      value?.designator ||
      value?.locationIndicator ||
      value?.location_indicator ||
      value?.identifier ||
      value?.id ||
      value?.code;
    if (typeof nested === "string") {
      return extractIcaoFromValue(nested);
    }
  }
  return undefined;
}

function pickText(item: any): string | null {
  if (item && typeof item === "object") {
    for (const [key, value] of Object.entries(item)) {
      if (matchesKey(key, TEXT_KEYS_LOWER) && typeof value === "string" && value.trim()) {
        return value;
      }
    }
  }
  const nested =
    item?.notam?.text ||
    item?.notam?.notamText ||
    item?.NOTAM?.text ||
    item?.NOTAM?.notamText ||
    item?.NOTAM?.["NOTAM_TEXT"];
  if (typeof nested === "string" && nested.trim()) return nested;
  return null;
}

function pickIcao(item: any): string | undefined {
  if (item && typeof item === "object") {
    for (const [key, value] of Object.entries(item)) {
      if (matchesKey(key, ICAO_KEYS_LOWER)) {
        const extracted = extractIcaoFromValue(value);
        if (extracted) return extracted;
      }
    }
  }
  return undefined;
}

function normalizeNotamItem(item: any): NormalizedNotam | null {
  const text = pickText(item) || (typeof item === "string" ? item : null);
  if (!text) return null;

  const extracted = extractFromText(text);
  const notamId = item?.notamId || item?.id || extracted.notamId || stableNotamId(text);
  const icao = (pickIcao(item) || extracted.icao || "").toUpperCase();
  if (!icao) return null;

  return {
    icao,
    notamId: String(notamId),
    text: String(text),
    effectiveAt: extracted.effectiveAt,
    expiresAt: extracted.expiresAt,
    raw: item,
  };
}

function normalizePayload(payload: any): NormalizedNotam[] {
  if (!payload) return [];
  const list =
    payload?.notams ||
    payload?.notamList ||
    payload?.NOTAMs ||
    payload?.data ||
    payload?.items ||
    payload?.results ||
    payload?.notam ||
    payload?.NOTAM ||
    payload;

  if (Array.isArray(list)) {
    return list.map(normalizeNotamItem).filter(Boolean) as NormalizedNotam[];
  }

  const single = normalizeNotamItem(list);
  if (single) return [single];

  const candidates: any[] = [];
  const seen = new Set<any>();
  const walk = (value: any, depth: number) => {
    if (!value || depth > 6) return;
    if (seen.has(value)) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => walk(entry, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    seen.add(value);
    const entries = Object.entries(value);
    const hasText = entries.some(
      ([key, entry]) => matchesKey(key, TEXT_KEYS_LOWER) && typeof entry === "string"
    );
    const hasIcao = entries.some(([key, entry]) => matchesKey(key, ICAO_KEYS_LOWER) && entry);
    if (hasText || hasIcao) candidates.push(value);
    Object.values(value).forEach((entry) => walk(entry, depth + 1));
  };
  walk(payload, 0);

  return candidates.map(normalizeNotamItem).filter(Boolean) as NormalizedNotam[];
}

async function upsertNotams(items: NormalizedNotam[]) {
  if (items.length === 0) return;
  for (const item of items) {
    await db
      .insert(notamsTable)
      .values({
        icao: item.icao,
        notamId: item.notamId,
        text: item.text,
        effectiveAt: item.effectiveAt ?? null,
        expiresAt: item.expiresAt ?? null,
        source: "swim",
        raw: item.raw ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: notamsTable.notamId,
        set: {
          icao: item.icao,
          text: item.text,
          effectiveAt: item.effectiveAt ?? null,
          expiresAt: item.expiresAt ?? null,
          raw: item.raw ?? null,
          updatedAt: new Date(),
        },
      });
  }
}

function parsePayload(body: string) {
  try {
    return JSON.parse(body);
  } catch {
    // fall through
  }
  try {
    return parser.parse(body);
  } catch {
    return body;
  }
}

function resolveSolaceLogLevel() {
  const raw = (process.env.SWIM_SOLACE_LOG_LEVEL || "WARN").toUpperCase();
  return solclientjs.LogLevel?.[raw] ?? solclientjs.LogLevel.WARN;
}

function initSolace() {
  if (solaceInitialized) return;
  if (!solclientjs?.SolclientFactory?.init) {
    throw new Error("Solace client missing SolclientFactory.init");
  }
  solclientjs.SolclientFactory.init({
    profile: solclientjs.SolclientFactoryProfiles.version10,
    logLevel: resolveSolaceLogLevel(),
  });
  solaceInitialized = true;
}

function messageToString(message: any): string {
  if (!message) return "";
  try {
    const binary = message.getBinaryAttachment?.();
    if (binary) {
      if (typeof binary === "string") return binary;
      const buffer =
        binary instanceof Uint8Array
          ? Buffer.from(binary)
          : binary instanceof ArrayBuffer
            ? Buffer.from(new Uint8Array(binary))
            : Buffer.isBuffer(binary)
              ? binary
              : null;
      if (buffer) {
        const isGzip = buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
        const isZlib =
          buffer.length >= 2 &&
          buffer[0] === 0x78 &&
          (buffer[1] === 0x01 || buffer[1] === 0x9c || buffer[1] === 0xda);
        try {
          if (isGzip) return zlib.gunzipSync(buffer).toString("utf-8");
          if (isZlib) return zlib.inflateSync(buffer).toString("utf-8");
        } catch {
          // fall back to raw text
        }
        return buffer.toString("utf-8");
      }
    }
  } catch {
    // ignore
  }
  try {
    const text = message.getText?.();
    if (text) return text;
  } catch {
    // ignore
  }
  try {
    const xml = message.getXmlContent?.();
    if (xml) return xml;
  } catch {
    // ignore
  }
  return "";
}

export function startSwimNotamWorker() {
  const debugNotams = String(process.env.SWIM_NOTAM_DEBUG || "").toLowerCase() === "true";
  let receivedCount = 0;
  let savedCount = 0;
  let emptyCount = 0;
  const queueName = process.env.SWIM_JMS_QUEUE;
  const username = process.env.SWIM_JMS_USERNAME;
  const password = process.env.SWIM_JMS_PASSWORD;
  const connectionUrl = process.env.SWIM_JMS_URL;
  const vpn = process.env.SWIM_JMS_VPN;
  const allowInsecure = String(process.env.SWIM_TLS_INSECURE ?? "").toLowerCase() === "true";

  if (!queueName || !username || !password || !connectionUrl || !vpn) {
    console.warn("SWIM JMS env vars missing. NOTAM worker will not start.");
    return false;
  }
  if (!solclientjs?.SessionEventCode || !solclientjs?.MessageConsumerEventName) {
    console.error("Solace client missing event codes. Check solclientjs import.");
    return false;
  }

  const sessionEvents = solclientjs.SessionEventCode;
  const consumerEvents = solclientjs.MessageConsumerEventName;
  const pickEvent = (source: Record<string, any>, labels: string[], fallbackLabel: string) => {
    for (const label of labels) {
      const value = source?.[label];
      if (value !== undefined && value !== null) return value;
    }
    console.warn(`SWIM Solace event missing: ${fallbackLabel}`);
    return undefined;
  };

  const sessionUpEvent = pickEvent(sessionEvents, ["UP_NOTICE", "UP", "CONNECTED"], "UP_NOTICE");
  const sessionConnectFailedEvent = pickEvent(
    sessionEvents,
    ["CONNECT_FAILED_ERROR", "CONNECT_FAILED", "DOWN_ERROR"],
    "CONNECT_FAILED_ERROR"
  );
  const sessionDisconnectedEvent = pickEvent(sessionEvents, ["DISCONNECTED", "DISCONNECT"], "DISCONNECTED");
  const sessionReconnectingEvent = pickEvent(
    sessionEvents,
    ["RECONNECTING_NOTICE", "RECONNECTING"],
    "RECONNECTING_NOTICE"
  );
  const sessionReconnectedEvent = pickEvent(
    sessionEvents,
    ["RECONNECTED_NOTICE", "RECONNECTED"],
    "RECONNECTED_NOTICE"
  );
  const consumerMessageEvent = pickEvent(consumerEvents, ["MESSAGE", "MESSAGE_RECEIVED"], "MESSAGE");
  const consumerConnectFailedEvent = pickEvent(
    consumerEvents,
    ["CONNECT_FAILED_ERROR", "CONNECT_FAILED"],
    "CONSUMER_CONNECT_FAILED"
  );
  const consumerDownEvent = pickEvent(
    consumerEvents,
    ["DOWN_ERROR", "DOWN"],
    "CONSUMER_DOWN_ERROR"
  );

  try {
    initSolace();
  } catch (error) {
    console.error("Solace init failed. NOTAM worker disabled:", error);
    return false;
  }

  const sessionProps = {
    url: connectionUrl,
    vpnName: vpn,
    userName: username,
    password,
    connectRetries: 2,
    reconnectRetries: -1,
    reconnectRetryWaitInMsecs: 5000,
    keepAliveIntervalInMsecs: 10000,
    keepAliveIntervalsLimit: 3,
    sslValidateCertificate: !allowInsecure,
  };

  const session = solclientjs.SolclientFactory.createSession(sessionProps);
  let consumer: any = null;

  const safeOn = (
    emitter: any,
    eventName: any,
    handler: (...args: any[]) => void,
    label: string
  ) => {
    if (eventName === undefined || eventName === null) {
      console.warn(`SWIM Solace event missing: ${label}`);
      return;
    }
    try {
      emitter.on(eventName, handler);
    } catch (error: any) {
      console.error(`SWIM Solace listener attach failed (${label}):`, error?.message || error);
    }
  };

  safeOn(session, sessionUpEvent, () => {
    console.log("SWIM Solace session up. Subscribing to queue:", queueName);
    if (consumer) return;
    try {
      consumer = session.createMessageConsumer({
        queueDescriptor: { name: queueName, type: solclientjs.QueueType.QUEUE },
        acknowledgeMode: solclientjs.MessageConsumerAcknowledgeMode.CLIENT,
      });
    } catch (err: any) {
      console.error("SWIM consumer create failed:", err?.message || err);
      return;
    }

    safeOn(consumer, consumerMessageEvent, async (message: any) => {
      try {
        receivedCount += 1;
        const body = messageToString(message);
        const payload = parsePayload(body);
        const normalized = normalizePayload(payload);
        if (normalized.length === 0 && typeof payload === "string") {
          const fallback = normalizeNotamItem(payload);
          if (fallback) {
            normalized.push(fallback);
          }
        }
        await upsertNotams(normalized);
        savedCount += normalized.length;
        if (debugNotams) {
          const shouldLog = receivedCount <= 5 || receivedCount % 50 === 0;
          if (normalized.length === 0) {
            emptyCount += 1;
          }
          if (shouldLog || normalized.length === 0) {
            const snippet = typeof body === "string" ? body.slice(0, 300) : "";
            console.log(
              JSON.stringify({
                event: "notam_ingest",
                receivedCount,
                savedCount,
                emptyCount,
                bodySample: snippet,
              })
            );
          }
        }
      } catch (ingestError: any) {
        console.error("NOTAM ingest error:", ingestError?.message || ingestError);
      } finally {
        try {
          message.acknowledge?.();
        } catch {
          // ignore
        }
      }
    }, "MESSAGE");

    safeOn(consumer, consumerConnectFailedEvent, (err: any) => {
      console.error("SWIM consumer connect failed:", err?.message || err);
    }, "CONSUMER_CONNECT_FAILED");

    safeOn(consumer, consumerDownEvent, (err: any) => {
      console.error("SWIM consumer down:", err?.message || err);
    }, "CONSUMER_DOWN_ERROR");

    consumer.connect();
  }, "UP_NOTICE");

  safeOn(session, sessionConnectFailedEvent, (err: any) => {
    console.error("SWIM session connect failed:", err?.message || err);
  }, "CONNECT_FAILED_ERROR");

  safeOn(session, sessionDisconnectedEvent, () => {
    console.warn("SWIM session disconnected.");
  }, "DISCONNECTED");

  safeOn(session, sessionReconnectingEvent, () => {
    console.warn("SWIM session reconnecting...");
  }, "RECONNECTING_NOTICE");

  safeOn(session, sessionReconnectedEvent, () => {
    console.warn("SWIM session reconnected.");
  }, "RECONNECTED_NOTICE");

  session.connect();
  return true;
}

const shouldAutoStart =
  process.env.SWIM_RUN_MODE === "worker" ||
  process.argv.some((arg) => arg.includes("notam-worker"));

if (shouldAutoStart) {
  startSwimNotamWorker();
}
