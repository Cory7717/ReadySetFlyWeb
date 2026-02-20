import crypto from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { createRequire } from "module";
import { join } from "path";
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

const EMPTY_REASONS = [
  "NO_XML_BODY",
  "PARSE_ERROR",
  "MISSING_AIXM_BASIC_MESSAGE",
  "MISSING_EVENT_SECTION",
  "MISSING_FNS_PAYLOAD",
  "NO_NOTAM_ELEMENTS",
  "UNSUPPORTED_MESSAGE_TYPE",
  "MISSING_REQUIRED_FIELDS",
  "FILTERED_OUT",
] as const;

type EmptyReason = (typeof EMPTY_REASONS)[number];

type NotamParseMeta = {
  xmlByteLength: number;
  rootTag?: string;
  rootNamespaces: Record<string, string>;
  hasFnsNamespace: boolean;
  parseError?: string;
};

type NotamExtractResult = {
  items: NormalizedNotam[];
  parsedNotamCount: number;
  hasAixmBasicMessage: boolean;
  hasEventSection: boolean;
  hasFnsPayload: boolean;
  eventTypes: string[];
  reasonEmpty?: EmptyReason;
};

type NotamIngestResult = NotamParseMeta &
  NotamExtractResult & {
    dbWriteAttempted: boolean;
    dbWriteSucceeded: boolean;
    dbErrorCode?: string;
    dbErrorMessage?: string;
  };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  textNodeName: "text",
  parseTagValue: true,
  trimValues: false,
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

function toArray<T>(value?: T | T[] | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n...[truncated ${value.length - maxChars} chars]`;
}

function stringifyTruncated(value: any, maxChars: number) {
  if (typeof value === "string") return truncateText(value, maxChars);
  try {
    return truncateText(JSON.stringify(value), maxChars);
  } catch {
    return truncateText(String(value), maxChars);
  }
}

function extractRootInfo(xml: string): {
  rootTag?: string;
  rootNamespaces: Record<string, string>;
  hasFnsNamespace: boolean;
} {
  const rootNamespaces: Record<string, string> = {};
  if (!xml || typeof xml !== "string") {
    return { rootNamespaces, hasFnsNamespace: false };
  }

  const match = xml.match(/<([A-Za-z0-9:_-]+)(\s[^>]*)?>/);
  if (!match) {
    return { rootNamespaces, hasFnsNamespace: false };
  }

  const rootTag = match[1];
  const attrs = match[2] || "";
  const nsRegex = /\s(xmlns(?::[A-Za-z0-9_-]+)?)=(["'])(.*?)\2/g;
  let nsMatch: RegExpExecArray | null = null;
  while ((nsMatch = nsRegex.exec(attrs))) {
    const rawKey = nsMatch[1];
    const uri = nsMatch[3];
    const prefix = rawKey.includes(":") ? rawKey.split(":")[1] : "default";
    rootNamespaces[prefix] = uri;
  }

  const hasFnsNamespace = Object.entries(rootNamespaces).some(([prefix, uri]) => {
    const prefixLower = prefix.toLowerCase();
    const uriLower = uri.toLowerCase();
    return prefixLower.includes("fns") || uriLower.includes("fns") || uriLower.includes("notam");
  });

  return { rootTag, rootNamespaces, hasFnsNamespace };
}

function findFirstByKey(value: any, keyLower: string, depth: number = 0): any {
  if (!value || depth > 8) return undefined;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findFirstByKey(entry, keyLower, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (typeof value !== "object") return undefined;
  for (const [key, entry] of Object.entries(value)) {
    if (key.toLowerCase() === keyLower) {
      return entry;
    }
    const found = findFirstByKey(entry, keyLower, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

function hasKeyMatch(value: any, matcher: (key: string) => boolean, depth: number = 0): boolean {
  if (!value || depth > 8) return false;
  if (Array.isArray(value)) {
    return value.some((entry) => hasKeyMatch(entry, matcher, depth + 1));
  }
  if (typeof value !== "object") return false;
  for (const [key, entry] of Object.entries(value)) {
    if (matcher(key)) return true;
    if (hasKeyMatch(entry, matcher, depth + 1)) return true;
  }
  return false;
}

function collectNotamNodes(payload: any): any[] {
  const results: any[] = [];
  const seen = new Set<any>();
  const walk = (value: any, depth: number) => {
    if (!value || depth > 8) return;
    if (seen.has(value)) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => walk(entry, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    seen.add(value);
    for (const [key, entry] of Object.entries(value)) {
      const keyLower = key.toLowerCase();
      if (keyLower.includes("notam")) {
        if (typeof entry === "string" && looksLikeNotamText(entry)) {
          results.push(entry);
        } else if (typeof entry === "object") {
          toArray(entry).forEach((item) => {
            if (item) results.push(item);
          });
        }
      }
      walk(entry, depth + 1);
    }
  };
  walk(payload, 0);
  return results;
}

function collectEventTypes(payload: any): string[] {
  const types = new Set<string>();
  const keys = new Set([
    "eventtype",
    "eventtypecode",
    "status",
    "action",
    "operation",
    "operationtype",
  ]);
  const walk = (value: any, depth: number) => {
    if (!value || depth > 8) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => walk(entry, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
      if (keys.has(key.toLowerCase())) {
        if (typeof entry === "string") {
          const trimmed = entry.trim();
          if (trimmed) types.add(trimmed);
        } else if (Array.isArray(entry)) {
          entry.forEach((item) => {
            if (typeof item === "string" && item.trim()) types.add(item.trim());
          });
        }
      }
      walk(entry, depth + 1);
    }
  };
  walk(payload, 0);
  return Array.from(types);
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

const NOTAM_TEXT_RE = /\bA\)\s*[A-Z0-9]{3,4}\b/i;

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
  const textValue = extractTextValue(value);
  if (textValue) return extractIcaoFromValue(textValue);
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

function extractTextValue(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const extracted = extractTextValue(entry);
      if (extracted) return extracted;
    }
    return undefined;
  }
  if (typeof value !== "object") return undefined;
  const direct =
    value.text ||
    value["#text"] ||
    value.value ||
    value.content ||
    value.body ||
    value._text;
  if (typeof direct === "string" && direct.trim()) return direct;
  return undefined;
}

function pickText(item: any): string | null {
  if (item && typeof item === "object") {
    for (const [key, value] of Object.entries(item)) {
      if (matchesKey(key, TEXT_KEYS_LOWER)) {
        const extracted = extractTextValue(value);
        if (extracted && extracted.trim()) return extracted;
      }
    }
  }
  const nested =
    extractTextValue(item?.notam?.text) ||
    extractTextValue(item?.notam?.notamText) ||
    extractTextValue(item?.NOTAM?.text) ||
    extractTextValue(item?.NOTAM?.notamText) ||
    extractTextValue(item?.NOTAM?.["NOTAM_TEXT"]);
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
  const fallbackText =
    text ||
    (item && typeof item === "object" ? stringifyTruncated(item, 4000) : null);
  if (!fallbackText) return null;

  const extracted = extractFromText(fallbackText);
  const notamIdCandidate = item?.notamId || item?.id || extracted.notamId;
  const textLooksLikeNotam = looksLikeNotamText(fallbackText);
  if (!notamIdCandidate && !textLooksLikeNotam) return null;
  const notamId = notamIdCandidate || stableNotamId(fallbackText);
  const icao = (pickIcao(item) || extracted.icao || "ZZZZ").toUpperCase();

  return {
    icao,
    notamId: String(notamId),
    text: String(fallbackText),
    effectiveAt: extracted.effectiveAt,
    expiresAt: extracted.expiresAt,
    raw: item,
  };
}

function looksLikeNotamText(value: string) {
  if (!value || typeof value !== "string") return false;
  if (NOTAM_TEXT_RE.test(value)) return true;
  const upper = value.toUpperCase();
  return upper.includes("NOTAM") && upper.includes("A)");
}

function collectNotamTextCandidates(payload: any): Array<{ text: string; icao?: string; raw?: any }> {
  const results: Array<{ text: string; icao?: string; raw?: any }> = [];
  const seen = new Set<any>();
  const walk = (value: any, depth: number, inheritedIcao?: string) => {
    if (!value || depth > 7) return;
    if (seen.has(value)) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => walk(entry, depth + 1, inheritedIcao));
      return;
    }
    if (typeof value !== "object") return;
    seen.add(value);

    const currentIcao = pickIcao(value) || inheritedIcao;
    for (const entry of Object.values(value)) {
      const extracted = extractTextValue(entry);
      if (extracted && looksLikeNotamText(extracted)) {
        results.push({ text: extracted, icao: currentIcao, raw: value });
      }
    }

    Object.values(value).forEach((entry) => walk(entry, depth + 1, currentIcao));
  };

  walk(payload, 0);
  return results;
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

  const normalizedFromCandidates = candidates.map(normalizeNotamItem).filter(Boolean) as NormalizedNotam[];
  if (normalizedFromCandidates.length > 0) return normalizedFromCandidates;

  const textCandidates = collectNotamTextCandidates(payload);
  const normalizedFromText = textCandidates
    .map((candidate) =>
      normalizeNotamItem({
        text: candidate.text,
        icao: candidate.icao,
        raw: candidate.raw,
      })
    )
    .filter(Boolean) as NormalizedNotam[];

  return normalizedFromText;
}

async function upsertNotams(items: NormalizedNotam[]) {
  if (items.length === 0) return { savedCount: 0, errorCount: 0, errors: [] as any[] };
  let savedCount = 0;
  const errors: any[] = [];
  for (const item of items) {
    try {
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
      savedCount += 1;
    } catch (error) {
      errors.push(error);
    }
  }
  return { savedCount, errorCount: errors.length, errors };
}

function parseNotamBody(body: string): { payload: any; meta: NotamParseMeta; messageType: "xml" | "json" | "text" } {
  const xmlByteLength = Buffer.byteLength(body || "", "utf-8");
  const trimmed = (body || "").trim();
  const rootInfo = extractRootInfo(trimmed);
  const meta: NotamParseMeta = {
    xmlByteLength,
    rootTag: rootInfo.rootTag,
    rootNamespaces: rootInfo.rootNamespaces,
    hasFnsNamespace: rootInfo.hasFnsNamespace,
  };

  if (!trimmed) {
    return {
      payload: undefined,
      meta: { ...meta, parseError: "NO_XML_BODY" },
      messageType: "text",
    };
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return { payload: JSON.parse(trimmed), meta, messageType: "json" };
    } catch {
      // fall through to XML parsing
    }
  }

  try {
    return { payload: parser.parse(trimmed), meta, messageType: "xml" };
  } catch (error: any) {
    return {
      payload: undefined,
      meta: { ...meta, parseError: error?.message || "PARSE_ERROR" },
      messageType: "xml",
    };
  }
}

export function analyzeNotamMessage(body: string): NotamParseMeta & NotamExtractResult & { messageType: string } {
  const { payload, meta, messageType } = parseNotamBody(body);
  const aixmNode = findFirstByKey(payload, "aixmbasicmessage");
  const payloadRoot = aixmNode ?? payload;
  const hasAixmBasicMessage =
    Boolean(aixmNode) || Boolean(meta.rootTag?.toLowerCase().includes("aixmbasicmessage"));
  const hasEventSection = hasKeyMatch(payloadRoot, (key) => key.toLowerCase().includes("event"));
  const eventTypes = collectEventTypes(payloadRoot);

  if (!payload) {
    return {
      ...meta,
      messageType,
      items: [],
      parsedNotamCount: 0,
      hasAixmBasicMessage,
      hasEventSection,
      hasFnsPayload: false,
      eventTypes,
      reasonEmpty: meta.parseError === "NO_XML_BODY" ? "NO_XML_BODY" : "PARSE_ERROR",
    };
  }

  const notamNodes = collectNotamNodes(payloadRoot);
  const hasFnsPayload = notamNodes.length > 0;
  const normalized =
    notamNodes.length > 0 ? normalizePayload(notamNodes) : normalizePayload(payloadRoot);
  const parsedNotamCount = Math.max(notamNodes.length, normalized.length);

  let reasonEmpty: EmptyReason | undefined;
  if (normalized.length === 0) {
    if (messageType !== "xml" && !hasAixmBasicMessage) {
      reasonEmpty = "UNSUPPORTED_MESSAGE_TYPE";
    } else if (!hasAixmBasicMessage) {
      reasonEmpty = "MISSING_AIXM_BASIC_MESSAGE";
    } else if (!hasEventSection) {
      reasonEmpty = "MISSING_EVENT_SECTION";
    } else if (!hasFnsPayload) {
      reasonEmpty = "MISSING_FNS_PAYLOAD";
    } else if (parsedNotamCount === 0) {
      reasonEmpty = "NO_NOTAM_ELEMENTS";
    } else {
      reasonEmpty = "MISSING_REQUIRED_FIELDS";
    }
  }

  return {
    ...meta,
    messageType,
    items: normalized,
    parsedNotamCount,
    hasAixmBasicMessage,
    hasEventSection,
    hasFnsPayload,
    eventTypes,
    reasonEmpty,
  };
}

export async function ingestNotamMessage(
  body: string,
  writer: (items: NormalizedNotam[]) => Promise<{ savedCount: number; errorCount: number; errors: any[] }> = upsertNotams
): Promise<NotamIngestResult & { savedCount: number; dbErrorCount: number }> {
  const analysis = analyzeNotamMessage(body);
  let dbWriteAttempted = false;
  let dbWriteSucceeded = false;
  let dbErrorCode: string | undefined;
  let dbErrorMessage: string | undefined;
  let savedCount = 0;
  let dbErrorCount = 0;

  if (analysis.items.length > 0) {
    dbWriteAttempted = true;
    try {
      const result = await writer(analysis.items);
      savedCount = result.savedCount;
      dbErrorCount = result.errorCount;
      dbWriteSucceeded = result.errorCount === 0;
      if (result.errorCount > 0) {
        const firstError = result.errors[0] as any;
        dbErrorCode = firstError?.code ? String(firstError.code) : undefined;
        dbErrorMessage = firstError?.message ? String(firstError.message) : "DB write failed";
      }
    } catch (error: any) {
      dbErrorCount = analysis.items.length;
      dbWriteSucceeded = false;
      dbErrorCode = error?.code ? String(error.code) : undefined;
      dbErrorMessage = error?.message ? String(error.message) : "DB write failed";
    }
  }

  return {
    ...analysis,
    dbWriteAttempted,
    dbWriteSucceeded,
    dbErrorCode,
    dbErrorMessage,
    savedCount,
    dbErrorCount,
  };
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

function extractMessageId(message: any): string | undefined {
  if (!message) return undefined;
  const candidates = [
    message.getApplicationMessageId?.(),
    message.getMessageId?.(),
    message.getCorrelationId?.(),
    message.getSequenceNumber?.(),
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    const value = String(candidate).trim();
    if (value) return value;
  }
  return undefined;
}

function redactXmlSample(xml: string) {
  if (!xml) return xml;
  return xml
    .replace(/(<(password|passwd|secret|token)[^>]*>)([^<]*)(<\/\2>)/gi, "$1[redacted]$4")
    .replace(/(password|passwd|secret|token)=["'][^"']+["']/gi, "$1=\"[redacted]\"");
}

export function startSwimNotamWorker() {
  const debugNotams = String(process.env.SWIM_NOTAM_DEBUG || "").toLowerCase() === "true";
  const debugCaptureEnabled =
    String(process.env.NOTAM_INGEST_DEBUG_CAPTURE || "").toLowerCase() === "true";
  const rawCaptureLimit = Number(process.env.NOTAM_INGEST_DEBUG_CAPTURE_LIMIT || 1);
  const rawCaptureMax = Number(process.env.NOTAM_INGEST_DEBUG_CAPTURE_MAX_CHARS || 12000);
  const debugCaptureLimit = Number.isFinite(rawCaptureLimit)
    ? Math.max(0, rawCaptureLimit)
    : 1;
  const debugCaptureMaxChars = Number.isFinite(rawCaptureMax)
    ? Math.max(500, rawCaptureMax)
    : 12000;
  let receivedCount = 0;
  let savedCount = 0;
  let emptyCount = 0;
  let dbErrorCount = 0;
  let capturedEmptyCount = 0;
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
        const messageId = extractMessageId(message);
        const analysis = await ingestNotamMessage(body);

        savedCount += analysis.savedCount;
        if (analysis.reasonEmpty) {
          emptyCount += 1;
        }
        if (analysis.dbErrorCount > 0) {
          dbErrorCount += analysis.dbErrorCount;
        }

        let samplePath: string | undefined;
        if (
          analysis.reasonEmpty &&
          debugCaptureEnabled &&
          capturedEmptyCount < debugCaptureLimit
        ) {
          try {
            const dir = join(process.cwd(), "debug", "notam");
            await mkdir(dir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const fileName = `empty-${timestamp}-${messageId || receivedCount}.xml`;
            const fullPath = join(dir, fileName);
            const safeXml = truncateText(
              redactXmlSample(body || ""),
              debugCaptureMaxChars
            );
            await writeFile(fullPath, safeXml, "utf-8");
            capturedEmptyCount += 1;
            samplePath = fullPath;
          } catch (error: any) {
            console.warn("Failed to capture empty NOTAM sample:", error?.message || error);
          }
        }

        const shouldLog =
          (debugNotams && (receivedCount <= 5 || receivedCount % 50 === 0)) ||
          Boolean(analysis.reasonEmpty) ||
          analysis.dbErrorCount > 0;

        if (shouldLog) {
          console.log(
            JSON.stringify({
              event: "notam_ingest",
              messageId,
              receivedCount,
              savedCount,
              emptyCount,
              parsedNotamCount: analysis.parsedNotamCount,
              eventTypes: analysis.eventTypes,
              hasAixmBasicMessage: analysis.hasAixmBasicMessage,
              hasEventSection: analysis.hasEventSection,
              hasFnsNamespace: analysis.hasFnsNamespace,
              hasFnsPayload: analysis.hasFnsPayload,
              reasonEmpty: analysis.reasonEmpty,
              dbWriteAttempted: analysis.dbWriteAttempted,
              dbWriteSucceeded: analysis.dbWriteSucceeded,
              dbErrorCode: analysis.dbErrorCode,
              dbErrorMessage: analysis.dbErrorMessage,
              parseError: analysis.parseError,
              xmlByteLength: analysis.xmlByteLength,
              rootNamespaces: analysis.rootNamespaces,
              samplePath,
            })
          );
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
