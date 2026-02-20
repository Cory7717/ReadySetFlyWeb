import crypto from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { createRequire } from "module";
import { join } from "path";
import zlib from "zlib";
import { XMLParser } from "fast-xml-parser";
import { db } from "./db";
import { notams as notamsTable, notamIngestEvents } from "@shared/schema";

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
    canonicalWriteAttempted: boolean;
    canonicalWriteSucceeded: boolean;
    fallbackWriteAttempted: boolean;
    fallbackWriteSucceeded: boolean;
    missingFields?: string[];
    extracted?: {
      notamKey?: string;
      icao?: string;
      issueTime?: string;
      effectiveStart?: string;
      effectiveEnd?: string;
      textLen?: number;
      eventTypes?: string[];
      classification?: string;
    };
    reason?: string;
  };

type FallbackIngestWriter = (data: {
  source?: string;
  messageId: string;
  parsedNotamCount: number;
  reason: string;
  missingFields?: string[];
  eventTypes?: string[];
  xmlByteLength?: number;
  notamKeys?: string[];
  icaos?: string[];
  excerpt?: string | null;
  details?: any;
}) => Promise<any>;

type IngestOptions = {
  maxXmlBytes?: number;
  messageId?: string;
  fallbackWriter?: FallbackIngestWriter;
  storeExcerpt?: boolean;
  excerptMaxChars?: number;
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
  if (/^\d{10}$/.test(cleaned)) {
    const year = 2000 + Number(cleaned.slice(0, 2));
    const month = Number(cleaned.slice(2, 4)) - 1;
    const day = Number(cleaned.slice(4, 6));
    const hour = Number(cleaned.slice(6, 8));
    const minute = Number(cleaned.slice(8, 10));
    return new Date(Date.UTC(year, month, day, hour, minute));
  }
  if (/^\d{12}$/.test(cleaned)) {
    const year = Number(cleaned.slice(0, 4));
    const month = Number(cleaned.slice(4, 6)) - 1;
    const day = Number(cleaned.slice(6, 8));
    const hour = Number(cleaned.slice(8, 10));
    const minute = Number(cleaned.slice(10, 12));
    return new Date(Date.UTC(year, month, day, hour, minute));
  }
  if (/^\d{14}$/.test(cleaned)) {
    const year = Number(cleaned.slice(0, 4));
    const month = Number(cleaned.slice(4, 6)) - 1;
    const day = Number(cleaned.slice(6, 8));
    const hour = Number(cleaned.slice(8, 10));
    const minute = Number(cleaned.slice(10, 12));
    const second = Number(cleaned.slice(12, 14));
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
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

function buildExcerpt(body: string, storeExcerpt: boolean, maxChars: number) {
  if (!storeExcerpt) return null;
  if (!body) return null;
  return truncateText(redactXmlSample(body), maxChars);
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
      const isNotamKey =
        keyLower === "notam" ||
        keyLower === "textnotam" ||
        keyLower.endsWith("notam") ||
        keyLower.includes("notamtext") ||
        keyLower.includes("notamid");
      if (isNotamKey) {
        if (typeof entry === "string" && looksLikeNotamText(entry)) {
          results.push(entry);
        } else if (typeof entry === "object") {
          if (keyLower === "textnotam" && entry && typeof entry === "object") {
            const nested = (entry as any).NOTAM || (entry as any).notam;
            if (nested) {
              toArray(nested).forEach((item) => {
                if (item) results.push(item);
              });
            } else {
              toArray(entry).forEach((item) => {
                if (item) results.push(item);
              });
            }
          } else {
            toArray(entry).forEach((item) => {
              if (item && hasNotamSignals(item)) {
                results.push(item);
              }
            });
          }
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
  const leadingIcaoMatch = text.match(/^\s*([A-Z0-9]{3,4})\b/);
  const effMatch = text.match(/\bB\)\s*([0-9]{10})/);
  const expMatch = text.match(/\bC\)\s*([0-9]{10})/);
  const idMatch = text.match(/\b([A-Z]{3,4}\s\d{2}\/\d{3})\b/);
  const localIdMatch = text.match(/\b([A-Z]\d{3,4}\/\d{2,4})\b/);

  return {
    icao: (icaoMatch?.[1] || leadingIcaoMatch?.[1])?.toUpperCase(),
    notamId: (idMatch?.[1] || localIdMatch?.[1])?.replace(/\s+/g, " "),
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

const NOTAM_KEY_KEYS_LOWER = new Set([
  "notamid",
  "notam_id",
  "notamId",
  "seriesnumber",
  "series_number",
  "reference",
  "notamnumber",
  "id",
].map((key) => key.toLowerCase()));

const NUMBER_KEYS_LOWER = new Set(["number", "notamnumber"].map((key) => key.toLowerCase()));
const YEAR_KEYS_LOWER = new Set(["year"].map((key) => key.toLowerCase()));

const ISSUE_TIME_KEYS_LOWER = new Set([
  "issuetime",
  "issue_time",
  "issued",
  "issuedtime",
  "issuedate",
  "created",
  "createdat",
  "creationtime",
  "datetime",
].map((key) => key.toLowerCase()));

const EFFECTIVE_START_KEYS_LOWER = new Set([
  "effectivestart",
  "effectivestarttime",
  "starttime",
  "startdate",
  "beginposition",
  "validfrom",
  "fromtime",
  "fromdate",
  "effectivefrom",
].map((key) => key.toLowerCase()));

const EFFECTIVE_END_KEYS_LOWER = new Set([
  "effectiveend",
  "effectiveendtime",
  "endtime",
  "enddate",
  "endposition",
  "validto",
  "totime",
  "todate",
  "effectiveto",
  "expirationdate",
  "expirydate",
].map((key) => key.toLowerCase()));

const Q_CODE_KEYS_LOWER = new Set(["qcode", "q_code", "selectioncode"].map((key) => key.toLowerCase()));
const PURPOSE_KEYS_LOWER = new Set(["purpose", "purposecode"].map((key) => key.toLowerCase()));
const SCOPE_KEYS_LOWER = new Set(["scope", "scopecode"].map((key) => key.toLowerCase()));

const CLASSIFICATION_KEYS_LOWER = new Set([
  "classification",
  "class",
  "type",
  "notamtype",
  "notam_type",
].map((key) => key.toLowerCase()));

const LOCATION_KEYS_LOWER = new Set([
  "location",
  "locationindicator",
  "location_indicator",
  "aerodrome",
  "facility",
  "area",
  "region",
  "locationname",
].map((key) => key.toLowerCase()));

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

function extractValueByKeys(value: any, keysLower: Set<string>, depth: number = 0): string | undefined {
  if (!value || depth > 7) return undefined;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const extracted = extractValueByKeys(entry, keysLower, depth + 1);
      if (extracted) return extracted;
    }
    return undefined;
  }
  if (typeof value !== "object") return undefined;

  for (const [key, entry] of Object.entries(value)) {
    if (matchesKey(key, keysLower)) {
      const extracted = extractTextValue(entry);
      if (extracted) return extracted;
      if (typeof entry === "string") return entry;
    }
  }

  for (const entry of Object.values(value)) {
    const extracted = extractValueByKeys(entry, keysLower, depth + 1);
    if (extracted) return extracted;
  }

  return undefined;
}

function parseSeriesNumberYear(notamKey?: string) {
  if (!notamKey) return {};
  const match = notamKey.match(/([A-Z]{0,3})\s*(\d{1,2})\/(\d{3,4})/i);
  if (!match) return {};
  const series = match[1] ? match[1].toUpperCase() : undefined;
  const number = match[2];
  const year = match[3];
  return { series, number, year };
}

function deriveNotamKeyFromFields(item: any) {
  const number = extractValueByKeys(item, NUMBER_KEYS_LOWER);
  const year = extractValueByKeys(item, YEAR_KEYS_LOWER);
  const location =
    extractValueByKeys(item, ICAO_KEYS_LOWER) ||
    extractValueByKeys(item, LOCATION_KEYS_LOWER);
  if (!number || !year) return undefined;
  if (location) return `${String(location).toUpperCase()} ${number}/${year}`;
  return `${number}/${year}`;
}

function hasNotamSignals(item: any): boolean {
  if (!item) return false;
  const hasKey =
    Boolean(extractValueByKeys(item, NUMBER_KEYS_LOWER)) ||
    Boolean(extractValueByKeys(item, YEAR_KEYS_LOWER)) ||
    Boolean(extractValueByKeys(item, Q_CODE_KEYS_LOWER)) ||
    Boolean(extractValueByKeys(item, NOTAM_KEY_KEYS_LOWER));
  if (hasKey) return true;
  if (typeof item === "object") {
    return Object.keys(item).some((key) => key.toLowerCase().includes("notam"));
  }
  return false;
}

function toIsoDateString(date?: Date | null) {
  if (!date) return undefined;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

type NotamItemSummary = {
  notamKey?: string;
  series?: string;
  number?: string;
  year?: string;
  icao?: string;
  location?: string;
  issueTime?: string;
  effectiveStart?: string;
  effectiveEnd?: string;
  text?: string;
  textLen?: number;
  qCode?: string;
  purpose?: string;
  scope?: string;
  classification?: string;
};

function extractNotamSummary(item: any): NotamItemSummary {
  const text = pickText(item) || (typeof item === "string" ? item : undefined);
  const extractedFromText = text ? extractFromText(text) : {};
  const notamKey =
    extractValueByKeys(item, NOTAM_KEY_KEYS_LOWER) ||
    item?.notamId ||
    item?.id ||
    extractedFromText.notamId ||
    deriveNotamKeyFromFields(item);
  const number = extractValueByKeys(item, NUMBER_KEYS_LOWER);
  const year = extractValueByKeys(item, YEAR_KEYS_LOWER);
  const icao =
    (pickIcao(item) ||
      extractValueByKeys(item, ICAO_KEYS_LOWER) ||
      extractedFromText.icao) ??
    undefined;
  const issueTime =
    extractValueByKeys(item, ISSUE_TIME_KEYS_LOWER) ||
    toIsoDateString(extractedFromText.effectiveAt) ||
    undefined;
  const effectiveStart =
    extractValueByKeys(item, EFFECTIVE_START_KEYS_LOWER) ||
    toIsoDateString(extractedFromText.effectiveAt) ||
    undefined;
  const effectiveEnd =
    extractValueByKeys(item, EFFECTIVE_END_KEYS_LOWER) ||
    toIsoDateString(extractedFromText.expiresAt) ||
    undefined;

  const qCode = extractValueByKeys(item, Q_CODE_KEYS_LOWER);
  const purpose = extractValueByKeys(item, PURPOSE_KEYS_LOWER);
  const scope = extractValueByKeys(item, SCOPE_KEYS_LOWER);
  const classification = extractValueByKeys(item, CLASSIFICATION_KEYS_LOWER);
  const location = extractValueByKeys(item, LOCATION_KEYS_LOWER);
  const parsed = parseSeriesNumberYear(notamKey);
  const series = parsed.series;
  const mergedNumber = parsed.number || (number ? String(number) : undefined);
  const mergedYear = parsed.year || (year ? String(year) : undefined);

  return {
    notamKey: notamKey ? String(notamKey) : undefined,
    series,
    number: mergedNumber,
    year: mergedYear,
    icao: icao ? String(icao).toUpperCase() : undefined,
    location: location ? String(location) : undefined,
    issueTime: issueTime ? String(issueTime) : undefined,
    effectiveStart: effectiveStart ? String(effectiveStart) : undefined,
    effectiveEnd: effectiveEnd ? String(effectiveEnd) : undefined,
    text,
    textLen: text ? text.length : undefined,
    qCode: qCode ? String(qCode) : undefined,
    purpose: purpose ? String(purpose) : undefined,
    scope: scope ? String(scope) : undefined,
    classification: classification ? String(classification) : undefined,
  };
}

function mergeSummary(target: NotamItemSummary, source: NotamItemSummary) {
  const merged = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null || value === "") continue;
    if (key === "textLen") {
      const current = merged.textLen || 0;
      const next = typeof value === "number" ? value : current;
      merged.textLen = Math.max(current, next);
      continue;
    }
    if (!(merged as any)[key]) {
      (merged as any)[key] = value;
    }
  }
  return merged;
}

function computeMissingFields(summary: NotamItemSummary): string[] {
  const missing: string[] = [];
  if (!summary.notamKey) missing.push("notamKey");
  if (!summary.series) missing.push("series");
  if (!summary.number) missing.push("number");
  if (!summary.year) missing.push("year");
  if (!summary.icao) missing.push("icao");
  if (!summary.location) missing.push("location");
  if (!summary.issueTime) missing.push("issueTime");
  if (!summary.effectiveStart) missing.push("effectiveStart");
  if (!summary.effectiveEnd) missing.push("effectiveEnd");
  if (!summary.text) missing.push("text");
  if (!summary.qCode) missing.push("qCode");
  if (!summary.purpose) missing.push("purpose");
  if (!summary.scope) missing.push("scope");
  return missing;
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
  if (!text) return null;

  const extracted = extractFromText(text);
  const derivedKey = deriveNotamKeyFromFields(item);
  const notamIdCandidate = item?.notamId || item?.id || extracted.notamId || derivedKey;
  const textLooksLikeNotam = looksLikeNotamText(text);
  const hasSignals = hasNotamSignals(item);
  const structuredIcao =
    pickIcao(item) ||
    extractValueByKeys(item, ICAO_KEYS_LOWER) ||
    extractValueByKeys(item, LOCATION_KEYS_LOWER);
  const resolvedIcao = (structuredIcao || extracted.icao || "ZZZZ").toUpperCase();
  const effectiveStartRaw = extractValueByKeys(item, EFFECTIVE_START_KEYS_LOWER);
  const effectiveEndRaw = extractValueByKeys(item, EFFECTIVE_END_KEYS_LOWER);
  const issueTimeRaw = extractValueByKeys(item, ISSUE_TIME_KEYS_LOWER);
  const hasTemporal = Boolean(issueTimeRaw || effectiveStartRaw || effectiveEndRaw);
  const isLikelyLocal = resolvedIcao !== "ZZZZ" && text.trim().length >= 10;
  const hasSignal = textLooksLikeNotam || hasSignals || isLikelyLocal || hasTemporal;
  if (!notamIdCandidate && !hasSignal) return null;
  const notamId = notamIdCandidate || stableNotamId(`${resolvedIcao}|${issueTimeRaw ?? ""}|${text}`);
  const icao = resolvedIcao;
  const effectiveAt = parseNotamDate(effectiveStartRaw) ?? extracted.effectiveAt;
  const expiresAt = parseNotamDate(effectiveEndRaw) ?? extracted.expiresAt;

  return {
    icao,
    notamId: String(notamId),
    text: String(text),
    effectiveAt,
    expiresAt,
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
    const textValue = entries.find(
      ([key, entry]) => matchesKey(key, TEXT_KEYS_LOWER) && typeof entry === "string"
    )?.[1] as string | undefined;
    const hasText = Boolean(textValue && looksLikeNotamText(textValue));
    const hasSignals = hasNotamSignals(value);
    if (hasText || hasSignals) candidates.push(value);
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

async function insertNotamIngestEvent(data: {
  source?: string;
  messageId: string;
  parsedNotamCount: number;
  reason: string;
  missingFields?: string[];
  eventTypes?: string[];
  xmlByteLength?: number;
  notamKeys?: string[];
  icaos?: string[];
  excerpt?: string | null;
  details?: any;
}) {
  const payload = {
    source: data.source ?? "SWIM_AIM_FNS",
    messageId: data.messageId,
    parsedNotamCount: data.parsedNotamCount,
    reason: data.reason,
    missingFields: data.missingFields ?? [],
    eventTypes: data.eventTypes ?? [],
    xmlByteLength: data.xmlByteLength ?? null,
    notamKeys: data.notamKeys ?? [],
    icaos: data.icaos ?? [],
    excerpt: data.excerpt ?? null,
    details: data.details ?? null,
    createdAt: new Date(),
  };

  const [created] = await db.insert(notamIngestEvents).values(payload).returning();
  return created;
}

function parseNotamBody(
  body: string,
  maxXmlBytes?: number
): { payload: any; meta: NotamParseMeta; messageType: "xml" | "json" | "text"; oversize: boolean } {
  const xmlByteLength = Buffer.byteLength(body || "", "utf-8");
  const trimmed = (body || "").trim();
  const rootInfo = extractRootInfo(trimmed);
  const meta: NotamParseMeta = {
    xmlByteLength,
    rootTag: rootInfo.rootTag,
    rootNamespaces: rootInfo.rootNamespaces,
    hasFnsNamespace: rootInfo.hasFnsNamespace,
  };
  const oversize = typeof maxXmlBytes === "number" && xmlByteLength > maxXmlBytes;

  if (!trimmed) {
    return {
      payload: undefined,
      meta: { ...meta, parseError: "NO_XML_BODY" },
      messageType: "text",
      oversize,
    };
  }

  if (oversize) {
    return {
      payload: undefined,
      meta: { ...meta, parseError: "MAX_XML_BYTES_EXCEEDED" },
      messageType: "xml",
      oversize,
    };
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return { payload: JSON.parse(trimmed), meta, messageType: "json", oversize };
    } catch {
      // fall through to XML parsing
    }
  }

  try {
    return { payload: parser.parse(trimmed), meta, messageType: "xml", oversize };
  } catch (error: any) {
    return {
      payload: undefined,
      meta: { ...meta, parseError: error?.message || "PARSE_ERROR" },
      messageType: "xml",
      oversize,
    };
  }
}

export function analyzeNotamMessage(
  body: string,
  options?: { maxXmlBytes?: number }
): NotamParseMeta & NotamExtractResult & { messageType: string; oversize: boolean; rawItems: any[] } {
  const { payload, meta, messageType, oversize } = parseNotamBody(body, options?.maxXmlBytes);
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
      oversize,
      rawItems: [],
      items: [],
      parsedNotamCount: 0,
      hasAixmBasicMessage,
      hasEventSection,
      hasFnsPayload: false,
      eventTypes,
      reasonEmpty:
        meta.parseError === "NO_XML_BODY"
          ? "NO_XML_BODY"
          : meta.parseError === "MAX_XML_BYTES_EXCEEDED"
            ? "FILTERED_OUT"
            : "PARSE_ERROR",
    };
  }

  const notamNodes = collectNotamNodes(payloadRoot);
  const textCandidates = collectNotamTextCandidates(payloadRoot);
  const rawItems = notamNodes.length > 0 ? notamNodes : textCandidates.map((candidate) => ({
    text: candidate.text,
    icao: candidate.icao,
    raw: candidate.raw,
  }));
  const normalized = rawItems.length > 0 ? normalizePayload(rawItems) : normalizePayload(payloadRoot);
  const parsedNotamCount = Math.max(rawItems.length, normalized.length);
  const hasFnsPayload = rawItems.length > 0 || normalized.length > 0;

  let reasonEmpty: EmptyReason | undefined;
  if (normalized.length === 0) {
    if (parsedNotamCount === 0 && messageType !== "xml" && !hasAixmBasicMessage) {
      reasonEmpty = "UNSUPPORTED_MESSAGE_TYPE";
    } else if (parsedNotamCount === 0 && !hasAixmBasicMessage) {
      reasonEmpty = "MISSING_AIXM_BASIC_MESSAGE";
    } else if (parsedNotamCount === 0 && !hasEventSection) {
      reasonEmpty = "MISSING_EVENT_SECTION";
    } else if (parsedNotamCount === 0 && !hasFnsPayload) {
      reasonEmpty = "MISSING_FNS_PAYLOAD";
    } else if (parsedNotamCount === 0) {
      reasonEmpty = "NO_NOTAM_ELEMENTS";
    }
  }

  return {
    ...meta,
    messageType,
    oversize,
    rawItems,
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
  writer: (items: NormalizedNotam[]) => Promise<{ savedCount: number; errorCount: number; errors: any[] }> = upsertNotams,
  options?: IngestOptions
): Promise<NotamIngestResult & { savedCount: number; dbErrorCount: number; rawItems: any[]; notamKeys: string[]; icaos: string[] }> {
  const analysis = analyzeNotamMessage(body, { maxXmlBytes: options?.maxXmlBytes });
  const messageId = options?.messageId ?? "unknown";
  const fallbackWriter = options?.fallbackWriter;
  const storeExcerpt = options?.storeExcerpt ?? false;
  const rawExcerptMax = Number(options?.excerptMaxChars ?? 12000);
  const excerptMaxChars = Number.isFinite(rawExcerptMax) ? Math.max(200, rawExcerptMax) : 12000;
  const excerpt = buildExcerpt(body || "", storeExcerpt, excerptMaxChars);
  let dbWriteAttempted = false;
  let dbWriteSucceeded = false;
  let dbErrorCode: string | undefined;
  let dbErrorMessage: string | undefined;
  let savedCount = 0;
  let dbErrorCount = 0;
  let canonicalWriteAttempted = false;
  let canonicalWriteSucceeded = false;
  let fallbackWriteAttempted = false;
  let fallbackWriteSucceeded = false;
  let missingFields: string[] | undefined;
  let extracted: NotamIngestResult["extracted"];
  let reason: string | undefined;

  const canonicalItems: NormalizedNotam[] = [];
  const summarySeed: NotamItemSummary = {};
  const notamKeys = new Set<string>();
  const icaos = new Set<string>();

  const summaryItems = (analysis.rawItems && analysis.rawItems.length > 0)
    ? analysis.rawItems
    : analysis.items;

  for (const rawItem of summaryItems || []) {
    const summary = extractNotamSummary(rawItem);
    const merged = mergeSummary(summarySeed, summary);
    summarySeed.notamKey = merged.notamKey;
    summarySeed.series = merged.series;
    summarySeed.number = merged.number;
    summarySeed.year = merged.year;
    summarySeed.icao = merged.icao;
    summarySeed.location = merged.location;
    summarySeed.issueTime = merged.issueTime;
    summarySeed.effectiveStart = merged.effectiveStart;
    summarySeed.effectiveEnd = merged.effectiveEnd;
    summarySeed.text = merged.text;
    summarySeed.textLen = merged.textLen;
    summarySeed.qCode = merged.qCode;
    summarySeed.purpose = merged.purpose;
    summarySeed.scope = merged.scope;
    summarySeed.classification = merged.classification;

    if (summary.notamKey) notamKeys.add(summary.notamKey);
    if (summary.icao) icaos.add(summary.icao);

    const canonical = normalizeNotamItem(rawItem);
    if (canonical) {
      canonicalItems.push(canonical);
    }
  }

  extracted = {
    notamKey: summarySeed.notamKey,
    icao: summarySeed.icao,
    issueTime: summarySeed.issueTime,
    effectiveStart: summarySeed.effectiveStart,
    effectiveEnd: summarySeed.effectiveEnd,
    textLen: summarySeed.textLen,
    eventTypes: analysis.eventTypes,
    classification: summarySeed.classification,
  };

  if (analysis.reasonEmpty === "FILTERED_OUT") {
    reason = "FILTERED_OUT";
    if (fallbackWriter) {
      fallbackWriteAttempted = true;
      try {
        await fallbackWriter({
          messageId,
          parsedNotamCount: analysis.parsedNotamCount,
          reason,
          eventTypes: analysis.eventTypes,
          xmlByteLength: analysis.xmlByteLength,
          notamKeys: Array.from(notamKeys),
          icaos: Array.from(icaos),
          excerpt,
          details: extracted ? { extracted } : undefined,
        });
        fallbackWriteSucceeded = true;
      } catch (error: any) {
        dbErrorCount += 1;
        dbErrorCode = error?.code ? String(error.code) : undefined;
        dbErrorMessage = error?.message ? String(error.message) : "DB write failed";
        reason = "DB_ERROR";
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
      canonicalWriteAttempted,
      canonicalWriteSucceeded,
      fallbackWriteAttempted,
      fallbackWriteSucceeded,
      missingFields,
      extracted,
      reason,
      notamKeys: Array.from(notamKeys),
      icaos: Array.from(icaos),
    };
  }

  if (canonicalItems.length > 0) {
    canonicalWriteAttempted = true;
    dbWriteAttempted = true;
    try {
      const result = await writer(canonicalItems);
      savedCount = result.savedCount;
      dbErrorCount = result.errorCount;
      dbWriteSucceeded = result.errorCount === 0;
      canonicalWriteSucceeded = result.errorCount === 0;
      if (result.errorCount > 0) {
        const firstError = result.errors[0] as any;
        dbErrorCode = firstError?.code ? String(firstError.code) : undefined;
        dbErrorMessage = firstError?.message ? String(firstError.message) : "DB write failed";
        reason = "DB_ERROR";
      }
    } catch (error: any) {
      dbErrorCount = canonicalItems.length;
      dbWriteSucceeded = false;
      canonicalWriteSucceeded = false;
      dbErrorCode = error?.code ? String(error.code) : undefined;
      dbErrorMessage = error?.message ? String(error.message) : "DB write failed";
      reason = "DB_ERROR";
    }
  }

  if (analysis.parsedNotamCount > 0 && analysis.hasFnsPayload && canonicalItems.length === 0) {
    missingFields = computeMissingFields(summarySeed);
    reason = "MISSING_REQUIRED_FIELDS";
    if (fallbackWriter) {
      fallbackWriteAttempted = true;
      try {
        await fallbackWriter({
          messageId,
          parsedNotamCount: analysis.parsedNotamCount,
          reason,
          missingFields,
          eventTypes: analysis.eventTypes,
          xmlByteLength: analysis.xmlByteLength,
          notamKeys: Array.from(notamKeys),
          icaos: Array.from(icaos),
          excerpt,
          details: extracted ? { extracted } : undefined,
        });
        fallbackWriteSucceeded = true;
      } catch (error: any) {
        dbErrorCount += 1;
        dbErrorCode = error?.code ? String(error.code) : undefined;
        dbErrorMessage = error?.message ? String(error.message) : "DB write failed";
        reason = "DB_ERROR";
      }
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
    canonicalWriteAttempted,
    canonicalWriteSucceeded,
    fallbackWriteAttempted,
    fallbackWriteSucceeded,
    missingFields,
    extracted,
    reason,
    notamKeys: Array.from(notamKeys),
    icaos: Array.from(icaos),
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
  const storeExcerptEnabled =
    String(process.env.NOTAM_INGEST_STORE_EXCERPT || "").toLowerCase() === "true";
  const rawExcerptMax = Number(process.env.NOTAM_INGEST_EXCERPT_MAX_CHARS || 12000);
  const excerptMaxChars = Number.isFinite(rawExcerptMax)
    ? Math.max(500, rawExcerptMax)
    : 12000;
  const rawMaxXmlBytes = Number(process.env.NOTAM_INGEST_MAX_XML_BYTES || 400000);
  const maxXmlBytes = Number.isFinite(rawMaxXmlBytes)
    ? Math.max(1000, rawMaxXmlBytes)
    : 400000;
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
        const analysis = await ingestNotamMessage(body, upsertNotams, {
          maxXmlBytes,
          messageId,
          fallbackWriter: insertNotamIngestEvent,
          storeExcerpt: storeExcerptEnabled,
          excerptMaxChars,
        });

        savedCount += analysis.savedCount;
        if (analysis.reasonEmpty && analysis.reasonEmpty !== "FILTERED_OUT") {
          emptyCount += 1;
        }
        if (analysis.dbErrorCount > 0) {
          dbErrorCount += analysis.dbErrorCount;
        }

        let samplePath: string | undefined;
        if (
          analysis.reasonEmpty &&
          analysis.reasonEmpty !== "FILTERED_OUT" &&
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
          Boolean(analysis.reason) ||
          analysis.fallbackWriteAttempted ||
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
              reason: analysis.reason,
              missingFields: analysis.missingFields,
              extracted: analysis.extracted,
              dbWriteAttempted: analysis.dbWriteAttempted,
              dbWriteSucceeded: analysis.dbWriteSucceeded,
              dbErrorCode: analysis.dbErrorCode,
              dbErrorMessage: analysis.dbErrorMessage,
              dbErrorCount: analysis.dbErrorCount,
              canonicalWriteAttempted: analysis.canonicalWriteAttempted,
              canonicalWriteSucceeded: analysis.canonicalWriteSucceeded,
              fallbackWriteAttempted: analysis.fallbackWriteAttempted,
              fallbackWriteSucceeded: analysis.fallbackWriteSucceeded,
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
