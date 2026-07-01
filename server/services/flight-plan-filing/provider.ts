import crypto from "crypto";
import { isFlightPlanCloseOverdue } from "@shared/flight-plan-lifecycle";
import { extractFilingProviderPlanId, extractFilingVersionStamp } from "@shared/flight-plan-filing";
import {
  buildFilingEventId,
  buildFilingFieldDiffs,
  buildOtherInfoWithDof,
  formatOperationalDateKey,
  mergeProviderMessages,
  normalizeRouteForProvider,
  toDisplayString,
  type FilingPayloadSnapshot,
  type FilingProviderMessage,
  type FilingProviderSnapshot,
} from "@shared/flight-plan-filing-workflow";
import { resolveDepartureAirportTimezone } from "@shared/airport-timezones";
import { normalizeIcaoEquipmentCodes, validateFlightServiceAircraftEquipmentCodes } from "@shared/icao-equipment-codes";
import { getIcaoOtherInfoEquipmentWarnings, hasOnlyFlightServiceSurveillanceCodes, hasOnlyKnownIcaoSurveillanceCodes } from "@shared/icao-filing";
import { normalizeZzzzActualLocation } from "@shared/zzzz-location";
import type { FlightPlan, FlightPlanFilingAction, FlightPlanFilingStatus } from "@shared/schema";
import { getFlightServiceRuntimeMode } from "../flightServiceRuntimeMode";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

const LAB_REST_BASE_URL = "https://ffspelabs.leidos.com/Website2/rest/";
const PRODUCTION_REST_BASE_URL = "https://www.lmfsweb.afss.com/Website/rest/";
const DEFAULT_USER_AGENT = "ReadySetFly Flight Service Interface";
const DEFAULT_LEIDOS_REQUEST_TIMEOUT_MS = 25000;

type LeidosEnvironment = "lab" | "test" | "validation" | "production";

export type FilingServiceResult = {
  live: boolean;
  provider: string;
  action: FlightPlanFilingAction;
  accepted: true;
  message: string;
  nextStatus: FlightPlanFilingStatus;
  warnings: string[];
  providerUrl: string;
  providerPlanId: string;
  raw: Record<string, unknown>;
  payloadSnapshot?: FilingPayloadSnapshot | null;
  providerSnapshot?: FilingProviderSnapshot | null;
  providerMessages?: FilingProviderMessage[];
};

export type FilingValidationResult = {
  ready: boolean;
  errors: string[];
  warnings: string[];
};

export type LeidosFlightServiceDiagnostics = {
  provider: string;
  enabled: boolean;
  environment: LeidosEnvironment;
  baseUrl: string;
  accountEmail: string | null;
  usernameConfigured: boolean;
  passwordConfigured: boolean;
  webhookUsernameConfigured: boolean;
  webhookPasswordConfigured: boolean;
  actionPaths: Record<FlightPlanFilingAction, string | null>;
  retrievePath: string | null;
};

export type LeidosRouteSearchResult = {
  provider: string;
  environment: LeidosEnvironment;
  departure: string;
  destination: string;
  route: string | null;
  atcRecentIFRRoutes: string[];
  codedDepartureRoutes: string[];
  faaPreferredRoutes: string[];
  warnings: string[];
};

export interface FlightPlanFilingProvider {
  stageAction(plan: FlightPlan, action: FlightPlanFilingAction): Promise<FilingServiceResult>;
}

type LeidosFlightServiceConfig = {
  enabled: boolean;
  environment: LeidosEnvironment;
  baseUrl: string;
  userAgent: string;
  username: string | null;
  password: string | null;
  accountEmail: string | null;
  actionPaths: Record<FlightPlanFilingAction, string | null>;
  retrievePath: string | null;
  webhookUsername: string | null;
  webhookPassword: string | null;
  wakeTurbulence: string;
  typeOfFlight: string;
  surveillanceEquipment: string;
  otherInfo: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getLeidosRequestTimeoutMs = () => {
  const parsed = Number(process.env.LEIDOS_FLIGHT_SERVICE_REQUEST_TIMEOUT_MS || DEFAULT_LEIDOS_REQUEST_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LEIDOS_REQUEST_TIMEOUT_MS;
  return Math.min(Math.max(Math.round(parsed), 5000), 29000);
};

const isLeidosTimeoutLikeError = (error: any) => {
  const message = String(error?.message || "");
  const causeCode = String(error?.cause?.code || error?.code || "");
  const causeMessage = String(error?.cause?.message || "");
  return (
    error?.name === "TimeoutError" ||
    causeCode === "UND_ERR_CONNECT_TIMEOUT" ||
    /connect timeout|timed out|timeout|fetch failed|socket hang up/i.test(message) ||
    /connect timeout|timed out|timeout/i.test(causeMessage)
  );
};

const fetchLeidosUrl = async (
  urlString: string,
  options: {
    method: "GET" | "POST";
    headers: Record<string, string>;
    body?: string;
  },
  timeoutMs = getLeidosRequestTimeoutMs(),
): Promise<Response> => {
  const url = new URL(urlString);
  const bodyBuffer = options.body != null ? Buffer.from(options.body) : null;
  const headers: Record<string, string> = { ...options.headers };
  if (bodyBuffer && !Object.keys(headers).some((key) => key.toLowerCase() === "content-length")) {
    headers["Content-Length"] = String(bodyBuffer.byteLength);
  }

  return await new Promise<Response>((resolve, reject) => {
    let settled = false;
    const transport = url.protocol === "http:" ? httpRequest : httpsRequest;
    const req = transport(
      url,
      {
        method: options.method,
        headers,
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        incoming.on("end", () => {
          if (settled) return;
          settled = true;
          const responseHeaders = new Headers();
          Object.entries(incoming.headers).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              value.forEach((entry) => responseHeaders.append(key, entry));
            } else if (value != null) {
              responseHeaders.set(key, String(value));
            }
          });
          resolve(new Response(new Uint8Array(Buffer.concat(chunks)), {
            status: incoming.statusCode || 500,
            statusText: incoming.statusMessage,
            headers: responseHeaders,
          }));
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Leidos request timed out after ${timeoutMs}ms`));
    });
    req.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    if (bodyBuffer) {
      req.write(bodyBuffer);
    }
    req.end();
  });
};

const parseMetadataRetryDelays = (value?: string | null) => {
  const parsed = String(value || "")
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry >= 0);
  if (parsed.length > 0) {
    return Array.from(new Set(parsed));
  }
  return [0, 1500, 5000, 15000, 30000];
};

const normalizeFlightRules = (value?: string | null) => (value || "VFR").toUpperCase();

const normalizePath = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return trimmed.replace(/^\/+/, "");
};

const boolFromEnv = (value?: string | null) => ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());

const getLeidosFlightServiceConfig = (): LeidosFlightServiceConfig => {
  const environment = getFlightServiceRuntimeMode().environment.toLowerCase() as LeidosEnvironment;

  const baseUrl = String(process.env.LEIDOS_FLIGHT_SERVICE_REST_BASE_URL || "").trim() || (
    environment === "production" ? PRODUCTION_REST_BASE_URL : LAB_REST_BASE_URL
  );

  return {
    enabled: boolFromEnv(process.env.LEIDOS_FLIGHT_SERVICE_ENABLE_LIVE),
    environment,
    baseUrl,
    userAgent: String(process.env.LEIDOS_FLIGHT_SERVICE_USER_AGENT || DEFAULT_USER_AGENT).trim() || DEFAULT_USER_AGENT,
    username: String(process.env.LEIDOS_FLIGHT_SERVICE_USERNAME || "").trim() || null,
    password: String(process.env.LEIDOS_FLIGHT_SERVICE_PASSWORD || "").trim() || null,
    accountEmail: String(process.env.LEIDOS_FLIGHT_SERVICE_ACCOUNT_EMAIL || process.env.LEIDOS_FLIGHT_SERVICE_USERNAME || "").trim() || null,
    actionPaths: {
      file: normalizePath(process.env.LEIDOS_FLIGHT_SERVICE_FILE_PATH),
      amend: normalizePath(process.env.LEIDOS_FLIGHT_SERVICE_AMEND_PATH),
      activate: normalizePath(process.env.LEIDOS_FLIGHT_SERVICE_ACTIVATE_PATH),
      cancel: normalizePath(process.env.LEIDOS_FLIGHT_SERVICE_CANCEL_PATH),
      close: normalizePath(process.env.LEIDOS_FLIGHT_SERVICE_CLOSE_PATH),
    },
    retrievePath: normalizePath(process.env.LEIDOS_FLIGHT_SERVICE_RETRIEVE_PATH) || "FP/{providerPlanId}/retrieve",
    webhookUsername: String(process.env.LEIDOS_FLIGHT_SERVICE_WEBHOOK_USERNAME || "").trim() || null,
    webhookPassword: String(process.env.LEIDOS_FLIGHT_SERVICE_WEBHOOK_PASSWORD || "").trim() || null,
    wakeTurbulence: String(process.env.LEIDOS_FLIGHT_SERVICE_WAKE_TURBULENCE || "MEDIUM").trim() || "MEDIUM",
    typeOfFlight: String(process.env.LEIDOS_FLIGHT_SERVICE_TYPE_OF_FLIGHT || "G").trim() || "G",
    surveillanceEquipment: String(process.env.LEIDOS_FLIGHT_SERVICE_SURVEILLANCE_EQUIPMENT || "N").trim() || "N",
    otherInfo: String(process.env.LEIDOS_FLIGHT_SERVICE_OTHER_INFO || "").trim() || null,
  };
};

export const getLeidosFlightServiceDiagnostics = (): LeidosFlightServiceDiagnostics => {
  const config = getLeidosFlightServiceConfig();
  return {
    provider: "Leidos Flight Service",
    enabled: config.enabled,
    environment: config.environment,
    baseUrl: config.baseUrl,
    accountEmail: config.accountEmail,
    usernameConfigured: Boolean(config.username),
    passwordConfigured: Boolean(config.password),
    webhookUsernameConfigured: Boolean(config.webhookUsername),
    webhookPasswordConfigured: Boolean(config.webhookPassword),
    actionPaths: config.actionPaths,
    retrievePath: config.retrievePath,
  };
};

export const getLeidosFlightServicePlanDebug = (plan: FlightPlan) => {
  const config = getLeidosFlightServiceConfig();
  const resolvedActionPaths = Object.fromEntries(
    Object.entries(config.actionPaths).map(([action, actionPath]) => [
      action,
      actionPath ? resolveActionPath(config.baseUrl, actionPath, plan) : null,
    ]),
  );
  const resolvedRetrievePath = config.retrievePath
    ? config.retrievePath
      .replaceAll("{flightIdentifier}", encodeURIComponent(String(plan.filingProviderPlanId || "").trim()))
      .replaceAll("{providerPlanId}", encodeURIComponent(String(plan.filingProviderPlanId || "").trim()))
      .replaceAll("{planId}", encodeURIComponent(plan.id))
    : null;

  return {
    diagnostics: getLeidosFlightServiceDiagnostics(),
    planId: plan.id,
    filingStatus: plan.filingStatus,
    filingIsLive: plan.filingIsLive,
    filingPendingAction: plan.filingPendingAction,
    filingProvider: plan.filingProvider,
    providerPlanId: plan.filingProviderPlanId || null,
    versionStamp: extractVersionStamp(plan),
    filingPayload: getRecord((plan as Record<string, unknown>).filingPayload),
    filingProviderSnapshot: getRecord((plan as Record<string, unknown>).filingProviderSnapshot),
    filingProviderMessages: Array.isArray((plan as Record<string, unknown>).filingProviderMessages)
      ? (plan as Record<string, unknown>).filingProviderMessages
      : [],
    configuredPaths: {
      ...config.actionPaths,
      retrieve: config.retrievePath,
    },
    resolvedPaths: {
      ...resolvedActionPaths,
      retrieve: resolvedRetrievePath
        ? (resolvedRetrievePath.startsWith("http://") || resolvedRetrievePath.startsWith("https://")
          ? resolvedRetrievePath
          : new URL(resolvedRetrievePath, config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`).toString())
        : null,
    },
  };
};

const FIELD_VERIFICATION_KEYS = [
  "aircraftIdentifier",
  "aircraftType",
  "aircraftEquipment",
  "surveillanceEquipment",
  "departure",
  "destination",
  "altDestination1",
  "departureInstant",
  "route",
  "otherInfo",
  "suppRemarksExtended",
  "pilotPhone",
  "aircraftHomeBase",
  "fuelOnBoard",
  "speedKnots",
  "altitudeTypeA",
  "altitudeTypeF",
];

const normalizeVerificationValue = (value: unknown) =>
  String(value || "").trim().replace(/\s+/g, " ");

const normalizeVerificationComparable = (value: unknown) =>
  normalizeVerificationValue(value).toUpperCase();

const findProviderFieldValue = (source: unknown, key: string) => {
  const exact = findNestedString(source, [key]);
  if (exact) return exact;
  const aliases: Record<string, string[]> = {
    aircraftIdentifier: ["aircraftId", "aircraft_identifier", "acid"],
    altDestination1: ["alternate", "alternateDestination", "altDestination"],
    departureInstant: ["departureTime", "departureDateTime", "departureInstantUtc", "departureUtc"],
    suppRemarksExtended: ["supplementalRemarks", "suppRemarks", "supplemental"],
    pilotPhone: ["phone", "phoneNumber", "telephone", "pilotTelephone", "pilotPhone", "contactPhone", "contactTelephone"],
    aircraftHomeBase: ["homeBase", "home_base", "base", "aircraftBase"],
  };
  return aliases[key] ? findNestedString(source, aliases[key]) : null;
};

const redactVerificationValue = (field: string, value: unknown) => {
  if (value === null || value === undefined) return null;
  const text = normalizeVerificationValue(value);
  if (!text) return null;
  if (/phone/i.test(field)) return text.replace(/\d(?=\d{4})/g, "x");
  return text;
};

export const compareRetrievedProviderPlanFields = ({
  submittedFields,
  retrievedProviderPlan,
}: {
  submittedFields: Record<string, unknown> | null;
  retrievedProviderPlan: Record<string, unknown> | null;
}) => {
  const matches: Array<{ field: string; submitted: string; retrieved: string }> = [];
  const mismatches: Array<{ field: string; submitted: string; retrieved: string | null; issue: string }> = [];

  for (const key of FIELD_VERIFICATION_KEYS) {
    const submitted = submittedFields?.[key];
    const submittedText = normalizeVerificationValue(submitted);
    if (!submittedText) continue;

    const retrieved = findProviderFieldValue(retrievedProviderPlan, key);
    const retrievedText = normalizeVerificationValue(retrieved);
    if (!retrievedText) {
      mismatches.push({
        field: key,
        submitted: submittedText,
        retrieved: null,
        issue: "missing_from_retrieve",
      });
      continue;
    }

    if (normalizeVerificationComparable(submittedText) === normalizeVerificationComparable(retrievedText)) {
      matches.push({ field: key, submitted: submittedText, retrieved: retrievedText });
      continue;
    }

    mismatches.push({
      field: key,
      submitted: submittedText,
      retrieved: retrievedText,
      issue: "value_mismatch",
    });
  }

  const submittedSupplemental = normalizeVerificationValue(submittedFields?.suppRemarksExtended);
  const retrievedOtherInfo = normalizeVerificationValue(findProviderFieldValue(retrievedProviderPlan, "otherInfo"));
  const retrievedSupplemental = normalizeVerificationValue(findProviderFieldValue(retrievedProviderPlan, "suppRemarksExtended"));
  if (
    submittedSupplemental &&
    !retrievedSupplemental &&
    normalizeVerificationComparable(retrievedOtherInfo).includes(normalizeVerificationComparable(submittedSupplemental))
  ) {
    mismatches.push({
      field: "suppRemarksExtended",
      submitted: submittedSupplemental,
      retrieved: retrievedOtherInfo || null,
      issue: "supplemental_returned_in_otherInfo",
    });
  }

  const missingFromRetrieve = mismatches.filter((entry) => entry.issue === "missing_from_retrieve");
  return {
    totalComparedFields: matches.length + mismatches.length,
    matchedFields: matches,
    mismatchedFields: mismatches,
    missingFromRetrieve,
    staleLocalValues: mismatches.filter((entry) => entry.issue === "value_mismatch"),
  };
};

export const verifyLeidosRetrievedPlanAgainstStoredPayload = async (plan: FlightPlan) => {
  const config = getLeidosFlightServiceConfig();
  const providerPlanId = String(plan.filingProviderPlanId || "").trim();
  const submittedPayload = getRecord((plan as Record<string, unknown>).filingPayload);
  const submittedFields = getRecord(submittedPayload?.transmittedFields);
  const retrievedProviderPlan = providerPlanId
    ? await retrieveLeidosPlanMetadataByProviderPlanId(providerPlanId, config)
    : null;
  const comparison = compareRetrievedProviderPlanFields({ submittedFields, retrievedProviderPlan });
  const submittedPilotPhone = submittedFields?.pilotPhone ?? null;
  const retrievedPilotPhone = findProviderFieldValue(retrievedProviderPlan, "pilotPhone");
  const submittedAircraftHomeBase = submittedFields?.aircraftHomeBase ?? null;
  const retrievedAircraftHomeBase = findProviderFieldValue(retrievedProviderPlan, "aircraftHomeBase");
  const phoneHomeBaseVerification = {
    submittedPilotPhone: redactVerificationValue("pilotPhone", submittedPilotPhone),
    retrievedPilotPhone: redactVerificationValue("pilotPhone", retrievedPilotPhone),
    pilotPhoneMatched: Boolean(
      normalizeVerificationComparable(submittedPilotPhone) &&
      normalizeVerificationComparable(submittedPilotPhone) === normalizeVerificationComparable(retrievedPilotPhone),
    ),
    submittedAircraftHomeBase: redactVerificationValue("aircraftHomeBase", submittedAircraftHomeBase),
    retrievedAircraftHomeBase: redactVerificationValue("aircraftHomeBase", retrievedAircraftHomeBase),
    aircraftHomeBaseMatched: Boolean(
      normalizeVerificationComparable(submittedAircraftHomeBase) &&
      normalizeVerificationComparable(submittedAircraftHomeBase) === normalizeVerificationComparable(retrievedAircraftHomeBase),
    ),
  };

  console.info(JSON.stringify({
    event: "flight_service_retrieve_verification",
    planId: plan.id,
    providerPlanId,
    versionStamp: extractVersionStamp(plan),
    retrieved: Boolean(retrievedProviderPlan),
    totalComparedFields: comparison.totalComparedFields,
    matchedFieldCount: comparison.matchedFields.length,
    mismatchCount: comparison.mismatchedFields.length,
    missingFromRetrieveCount: comparison.missingFromRetrieve.length,
    phoneHomeBaseVerification,
    mismatches: comparison.mismatchedFields.map((entry) => ({
      ...entry,
      submitted: redactVerificationValue(entry.field, entry.submitted),
      retrieved: redactVerificationValue(entry.field, entry.retrieved),
    })),
  }));

  return {
    planId: plan.id,
    providerPlanId,
    versionStamp: extractVersionStamp(plan),
    submittedPayload,
    retrievedProviderPlan,
    persistedProviderSnapshot: getRecord((plan as Record<string, unknown>).filingProviderSnapshot),
    phoneHomeBaseVerification,
    ...comparison,
  };
};

const getProviderUrl = () => getLeidosFlightServiceConfig().baseUrl;

const getLiveNextStatus = (action: FlightPlanFilingAction): FlightPlanFilingStatus => {
  switch (action) {
    case "activate":
      return "activated";
    case "cancel":
      return "cancelled";
    case "close":
      return "closed";
    case "file":
    case "amend":
    default:
      return "filed";
  }
};

const getLifecycleMessage = (action: FlightPlanFilingAction) => {
  switch (action) {
    case "file":
      return "RSF submitted the flight plan to the filing provider.";
    case "amend":
      return "RSF submitted the amended flight plan to the filing provider.";
    case "activate":
      return "RSF submitted the VFR activation request to the filing provider.";
    case "cancel":
      return "RSF submitted the cancellation request to the filing provider.";
    case "close":
      return "RSF submitted the VFR close request to the filing provider.";
    default:
      return "RSF submitted the request to the filing provider.";
  }
};

const buildProviderPlanId = (plan: FlightPlan, action: FlightPlanFilingAction) =>
  plan.filingProviderPlanId || `rsf-${plan.id}-${action}`;

const minutesToIsoDuration = (minutes?: number | null) => {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) return null;
  const wholeMinutes = Math.max(1, Math.round(minutes));
  const hours = Math.floor(wholeMinutes / 60);
  const minutesRemainder = wholeMinutes % 60;
  const hourPart = hours > 0 ? `${hours}H` : "";
  const minutePart = minutesRemainder > 0 ? `${minutesRemainder}M` : (!hourPart ? "0M" : "");
  return `PT${hourPart}${minutePart}`;
};

const appendLeidosAltitudeFields = (params: URLSearchParams, altitudeFt?: number | null) => {
  if (!altitudeFt || !Number.isFinite(altitudeFt) || altitudeFt <= 0) return;
  const roundedAltitude = Math.round(altitudeFt);
  if (roundedAltitude >= 18000) {
    params.append("altitudeTypeF", String(Math.round(roundedAltitude / 100)));
    return;
  }
  params.append("altitudeTypeA", String(Math.round(roundedAltitude / 100)));
};

const parseJsonLikeRecord = (value: unknown) => {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (
    !(trimmed.startsWith("{") && trimmed.endsWith("}")) &&
    !(trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

const extractVersionStamp = (plan: FlightPlan) => {
  const raw = parseJsonLikeRecord(plan.filingRaw);
  const rawVersionStamp = extractFilingVersionStamp(raw);
  if (rawVersionStamp) return rawVersionStamp;

  const history = Array.isArray(plan.filingActionHistory) ? [...plan.filingActionHistory].reverse() : [];
  for (const entry of history) {
    const versionStamp =
      extractFilingVersionStamp(entry) ||
      extractFilingVersionStamp(parseJsonLikeRecord((entry as Record<string, unknown>)?.raw)) ||
      extractFilingVersionStamp(parseJsonLikeRecord((entry as Record<string, unknown>)?.providerRaw)) ||
      extractFilingVersionStamp(parseJsonLikeRecord((entry as Record<string, unknown>)?.response));
    if (versionStamp) return versionStamp;
  }

  return null;
};

const formatDepartureInstant = (value?: Date | string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const isValidIanaTimeZone = (value?: string | null) => {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const parseDateTimeLocal = (value?: string | null) => {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const parsed = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
  if (
    !Number.isInteger(parsed.year) ||
    parsed.month < 1 ||
    parsed.month > 12 ||
    parsed.day < 1 ||
    parsed.day > 31 ||
    parsed.hour < 0 ||
    parsed.hour > 23 ||
    parsed.minute < 0 ||
    parsed.minute > 59
  ) {
    return null;
  }
  return parsed;
};

const getTimeZoneOffsetMinutes = (date: Date, timeZone: string) => {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  parts.forEach((part) => {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  });
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return (asUtc - date.getTime()) / 60000;
};

export const zonedLocalDateTimeToUtcIso = (localDateTime: string, timeZone: string) => {
  if (!isValidIanaTimeZone(timeZone)) return null;
  const parts = parseDateTimeLocal(localDateTime);
  if (!parts) return null;
  const guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0));
  const firstOffset = getTimeZoneOffsetMinutes(guess, timeZone);
  const firstUtc = new Date(guess.getTime() - firstOffset * 60000);
  const secondOffset = getTimeZoneOffsetMinutes(firstUtc, timeZone);
  const utc = secondOffset === firstOffset
    ? firstUtc
    : new Date(guess.getTime() - secondOffset * 60000);
  return utc.toISOString();
};

const normalizeLocalDateTimeInput = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  return parseDateTimeLocal(trimmed) ? trimmed.slice(0, 16) : null;
};

const looksLikeHtml = (value?: string | null) =>
  /<!doctype html|<html[\s>]|<body[\s>]|<head[\s>]/i.test(String(value || ""));

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const extractHtmlText = (value: string) => decodeHtmlEntities(
  value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "),
)
  .replace(/\s+/g, " ")
  .trim();

const truncateText = (value: string, maxLength = 280) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;

const asTrimmedString = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return null;
  const text = String(value).trim();
  return text || null;
};

const flattenLeidosMessageArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const messages: string[] = [];

  for (const item of value) {
    if (item === null || item === undefined) continue;
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      const text = String(item).trim();
      if (text) messages.push(text);
      continue;
    }
    if (Array.isArray(item)) {
      const nestedText = item
        .map((part) => String(part ?? "").trim())
        .filter(Boolean)
        .join(": ");
      if (nestedText) messages.push(nestedText);
      continue;
    }
    if (typeof item === "object") {
      const record = item as Record<string, unknown>;
      const code = asTrimmedString(record.code);
      const message =
        asTrimmedString(record.message) ||
        asTrimmedString(record.text) ||
        asTrimmedString(record.description);
      const combined = [code, message].filter(Boolean).join(": ");
      if (combined) {
        messages.push(combined);
        continue;
      }
      try {
        const serialized = JSON.stringify(item);
        if (serialized && serialized !== "{}") messages.push(serialized);
      } catch {
        // ignore unserializable item
      }
    }
  }

  return messages;
};

const extractLeidosResponseMessages = (parsedResponse: Record<string, unknown>) =>
  Array.from(
    new Set([
      ...flattenLeidosMessageArray(parsedResponse.returnCodedMessage),
      ...flattenLeidosMessageArray(parsedResponse.returnMessage),
    ]),
  ).filter(Boolean);

const summarizeProviderError = (parsedResponse: Record<string, unknown>, response: Response) => {
  const rawText = typeof parsedResponse.text === "string" ? parsedResponse.text : "";
  if (rawText) {
    if (looksLikeHtml(rawText)) {
      const titleMatch = rawText.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch?.[1] ? extractHtmlText(titleMatch[1]) : "";
      const titlePrefix = title ? `${title}. ` : "";
      return `${titlePrefix}Leidos returned HTML instead of the expected REST response. This usually means the REST endpoint path, credentials, or lab environment configuration is incorrect.`;
    }

    return truncateText(rawText.replace(/\s+/g, " ").trim());
  }

  const codedMessages = flattenLeidosMessageArray(parsedResponse.returnCodedMessage);
  if (codedMessages.length > 0) {
    return truncateText(codedMessages.join(" | "));
  }

  const plainMessages = flattenLeidosMessageArray(parsedResponse.returnMessage);
  if (plainMessages.length > 0) {
    return truncateText(plainMessages.join(" | "));
  }

  const responseStatus = response.statusText.trim();
  return responseStatus || null;
};

const resolveActionPath = (baseUrl: string, actionPath: string, plan: FlightPlan) => {
  const flightIdentifier = (plan.filingProviderPlanId || "").trim();
  const resolvedPath = actionPath
    .replaceAll("{flightIdentifier}", encodeURIComponent(flightIdentifier))
    .replaceAll("{providerPlanId}", encodeURIComponent(flightIdentifier))
    .replaceAll("{planId}", encodeURIComponent(plan.id));

  return resolvedPath.startsWith("http://") || resolvedPath.startsWith("https://")
    ? resolvedPath
    : new URL(resolvedPath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
};

const getPlannerStateRecord = (plan: FlightPlan) => {
  const plannerState = (plan as Record<string, unknown>)?.plannerState;
  return plannerState && typeof plannerState === "object" && !Array.isArray(plannerState)
    ? plannerState as Record<string, unknown>
    : null;
};

const getPlannerTimeZoneFromState = (plan: FlightPlan) => {
  const plannerState = getPlannerStateRecord(plan);
  const departureTimeZone =
    plannerState && typeof plannerState.departureTimeZone === "string"
      ? plannerState.departureTimeZone.trim()
      : "";
  return departureTimeZone || "";
};

const getPlannerTimeZone = (plan: FlightPlan) => {
  const plannerState = getPlannerStateRecord(plan);
  const planningReferenceDepartureAirport =
    plannerState && typeof plannerState.planningReferenceDepartureAirport === "string"
      ? plannerState.planningReferenceDepartureAirport.trim().toUpperCase()
      : null;
  return resolveDepartureAirportTimezone({
    departureAirport: {
      icao: plan.departure || null,
      timezone: getPlannerTimeZoneFromState(plan),
    },
    planningReferenceDepartureAirport: planningReferenceDepartureAirport
      ? { icao: planningReferenceDepartureAirport }
      : null,
    explicitDepartureTimezone: getPlannerTimeZoneFromState(plan),
  }).timezone || "";
};

const getSelectedDepartureLocalDateTime = (plan: FlightPlan) => {
  const plannerState = getPlannerStateRecord(plan);
  const localFromPlanner =
    plannerState && typeof plannerState.userDisplayDepartureTimeLocal === "string"
      ? normalizeLocalDateTimeInput(plannerState.userDisplayDepartureTimeLocal)
      : null;
  if (localFromPlanner) return localFromPlanner;

  const departureTimeZone = getPlannerTimeZone(plan);
  if (!plan.plannedDepartureAt || !isValidIanaTimeZone(departureTimeZone)) return null;
  const parsed = new Date(plan.plannedDepartureAt);
  if (Number.isNaN(parsed.getTime())) return null;

  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: departureTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    });
    const parts = dtf.formatToParts(parsed);
    const map: Record<string, string> = {};
    parts.forEach((part) => {
      if (part.type !== "literal") map[part.type] = part.value;
    });
    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
  } catch {
    return null;
  }
};

export const getProviderDepartureInstantForPlan = (plan: FlightPlan) => {
  const departureTimeZone = getPlannerTimeZone(plan);
  const selectedLocalDepartureTime = getSelectedDepartureLocalDateTime(plan);
  if (selectedLocalDepartureTime && isValidIanaTimeZone(departureTimeZone)) {
    return zonedLocalDateTimeToUtcIso(selectedLocalDepartureTime, departureTimeZone);
  }
  return formatDepartureInstant(plan.plannedDepartureAt);
};

const getPlannerStateString = (plan: FlightPlan, key: string) => {
  const plannerState = getPlannerStateRecord(plan);
  const value = plannerState?.[key];
  return typeof value === "string" ? value.trim().toUpperCase() : "";
};

const getPlannerStateLocationMode = (plan: FlightPlan, key: string) => {
  const value = getPlannerStateString(plan, key);
  return value === "LATLONG" ? "latlong" : value === "IDENTIFIER" ? "identifier" : null;
};

const getRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const findNestedString = (input: unknown, candidateKeys: string[], maxDepth = 8): string | null => {
  const record = getRecord(input);
  if (!record) return null;
  const normalizedCandidates = new Set(candidateKeys.map((key) => key.toLowerCase().replace(/[^a-z0-9]/g, "")));
  const queue: Array<{ value: unknown; depth: number }> = [{ value: record, depth: 0 }];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const { value, depth } = current;
    if (!value || typeof value !== "object" || visited.has(value) || depth > maxDepth) continue;
    visited.add(value);

    if (Array.isArray(value)) {
      value.forEach((item) => queue.push({ value: item, depth: depth + 1 }));
      continue;
    }

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalizedCandidates.has(normalizedKey)) {
        const match = toDisplayString(child);
        if (match) return match;
      }
      if (child && typeof child === "object") {
        queue.push({ value: child, depth: depth + 1 });
      }
    }
  }

  return null;
};

const findNestedStringArray = (input: unknown, candidateKeys: string[], maxDepth = 8) => {
  const values = new Set<string>();
  const record = getRecord(input);
  if (!record) return [] as string[];
  const normalizedCandidates = new Set(candidateKeys.map((key) => key.toLowerCase().replace(/[^a-z0-9]/g, "")));
  const queue: Array<{ value: unknown; depth: number }> = [{ value: record, depth: 0 }];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const { value, depth } = current;
    if (!value || typeof value !== "object" || visited.has(value) || depth > maxDepth) continue;
    visited.add(value);

    if (Array.isArray(value)) {
      value.forEach((item) => {
        const text = toDisplayString(item);
        if (text) values.add(text);
        if (item && typeof item === "object") {
          queue.push({ value: item, depth: depth + 1 });
        }
      });
      continue;
    }

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalizedCandidates.has(normalizedKey)) {
        if (Array.isArray(child)) {
          child.forEach((item) => {
            const text = toDisplayString(item);
            if (text) values.add(text);
          });
        } else {
          const text = toDisplayString(child);
          if (text) values.add(text);
        }
      }
      if (child && typeof child === "object") {
        queue.push({ value: child, depth: depth + 1 });
      }
    }
  }

  return Array.from(values);
};

const redactPayloadForLog = (payload: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (["pilotData", "pilotInCommandExtended"].includes(key)) return [key, "[redacted]"];
      if (["remarks", "suppRemarksExtended"].includes(key) && value) return [key, "[redacted]"];
      return [key, value];
    }),
  );

const normalizeLeidosEquipmentCode = (value?: string | null) => normalizeIcaoEquipmentCodes(value);

const normalizeLeidosBeaconCode = (value?: string | null) => {
  const normalized = String(value || "").trim().toUpperCase().replace(/[^0-7A-Z]/g, "");
  const octalMatch = normalized.match(/\b[0-7]{4}\b/);
  return octalMatch?.[0] || (normalized.length >= 4 && normalized.length <= 8 ? normalized : null);
};

export const normalizeLeidosOtherInfoForTransmission = (otherInfo: string | null) => {
  const normalized = String(otherInfo || "")
    .toUpperCase()
    .replace(/_/g, "")
    .replace(/[^A-Z0-9/ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || null;
};

const normalizeLeidosRemarksText = (value?: string | null) => {
  const normalized = String(value || "")
    .trim()
    .replace(/^RMK\//i, "")
    .replace(/_/g, " ")
    .replace(/[^A-Z0-9/ -]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return normalized || null;
};

export const buildOtherInfoWithRemarks = (otherInfo: string | null, remarks?: string | null) => {
  const source = String(otherInfo || "").trim();
  const existingRmkMatch = source.match(/(?:^|\s)RMK\/.*?(?=\s+[A-Z]{2,5}\/|$)/i);
  const existingRmkText = normalizeLeidosRemarksText(existingRmkMatch?.[0]?.replace(/^\s*RMK\//i, ""));
  const remarksText = normalizeLeidosRemarksText(remarks) || existingRmkText;
  const base = source
    .replace(/(?:^|\s)RMK\/.*?(?=\s+[A-Z]{2,5}\/|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [base, remarksText ? `RMK/${remarksText}` : null].filter(Boolean).join(" ").replace(/\s+/g, " ").trim() || null;
};

const normalizeLeidosAircraftColorExtended = (value?: string | null) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (!normalized) return null;

  const parts = normalized
    .split(/[\s/,:;+|&-]+/g)
    .map((part) => part.replace(/[^A-Z0-9]/g, "").trim())
    .filter(Boolean);

  if (parts.length === 0) return null;
  return parts.slice(0, 3).join(":");
};

const hasZzzzLocationDescription = (value?: string | null) =>
  Boolean(String(value || "").trim().replace(/\s+/g, " "));

const normalizeWakeTurbulenceCategory = (value?: string | null) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return null;
  if (["L", "LIGHT"].includes(normalized)) return "LIGHT";
  if (["M", "MEDIUM"].includes(normalized)) return "MEDIUM";
  if (["H", "HEAVY"].includes(normalized)) return "HEAVY";
  if (["J", "SUPER"].includes(normalized)) return "SUPER";
  return normalized;
};

const inferWakeTurbulenceCategoryFromWeightLb = (maxGrossWeightLb?: number | null) => {
  if (!maxGrossWeightLb || !Number.isFinite(maxGrossWeightLb) || maxGrossWeightLb <= 0) return null;
  if (maxGrossWeightLb <= 15500) return "LIGHT";
  if (maxGrossWeightLb > 300000) return "HEAVY";
  return "MEDIUM";
};

const LEIDOS_AIRCRAFT_TYPE_ALIASES: Record<string, string> = {
  B300: "B350",
  B300C: "B350",
};

const LEIDOS_AIRCRAFT_TYPE_WAKE_OVERRIDES: Record<string, "LIGHT" | "MEDIUM" | "HEAVY" | "SUPER"> = {
  C421: "LIGHT",
};

const normalizeLeidosAircraftTypeCode = (value?: string | null) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return null;
  return LEIDOS_AIRCRAFT_TYPE_ALIASES[normalized] || normalized;
};

export const normalizeActualAircraftTypeForIcao = (value?: string | null) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!normalized || !/^[A-Z0-9]{2,8}$/.test(normalized)) return null;
  return normalized;
};

export const buildOtherInfoWithAircraftType = (otherInfo: string | null, actualAircraftType?: string | null) => {
  const normalizedType = normalizeActualAircraftTypeForIcao(actualAircraftType);
  let base = String(otherInfo || "").trim();
  if (!normalizedType) return base || null;
  base = base
    .replace(/(?:^|\s)TYPE\/[A-Z0-9]+/gi, " ")
    .replace(/(?:^|\s)TYP\/[A-Z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [base, `TYP/${normalizedType}`].filter(Boolean).join(" ").replace(/\s+/g, " ").trim() || null;
};

const getLeidosAircraftTypeCode = (plan: FlightPlan) => {
  const plannerState = getPlannerStateRecord(plan);
  if (String(plan.aircraftType || "").trim().toUpperCase() === "ZZZZ") {
    return "ZZZZ";
  }
  const selectedTypeIcao =
    plannerState && typeof plannerState.selectedTypeIcao === "string"
      ? plannerState.selectedTypeIcao.trim().toUpperCase()
      : "";
  if (selectedTypeIcao) return normalizeLeidosAircraftTypeCode(selectedTypeIcao);

  const aircraftType = String(plan.aircraftType || "").trim();
  const parentheticalMatch = aircraftType.match(/\(([A-Z0-9]{2,6})\)\s*$/i);
  if (parentheticalMatch?.[1]) {
    return normalizeLeidosAircraftTypeCode(parentheticalMatch[1]);
  }

  return normalizeLeidosAircraftTypeCode(aircraftType);
};

const getLeidosWakeTurbulence = (plan: FlightPlan) => {
  const plannerState = getPlannerStateRecord(plan);
  const selectedProfileMaxGrossWeightLb =
    plannerState && typeof plannerState.selectedProfileMaxGrossWeightLb === "number"
      ? plannerState.selectedProfileMaxGrossWeightLb
      : null;
  const selectedTypeMaxGrossWeightLb =
    plannerState && typeof plannerState.selectedTypeMaxGrossWeightLb === "number"
      ? plannerState.selectedTypeMaxGrossWeightLb
      : null;
  const inferredWakeTurbulence =
    inferWakeTurbulenceCategoryFromWeightLb(selectedProfileMaxGrossWeightLb) ||
    inferWakeTurbulenceCategoryFromWeightLb(selectedTypeMaxGrossWeightLb);
  const aircraftTypeWake = LEIDOS_AIRCRAFT_TYPE_WAKE_OVERRIDES[getLeidosAircraftTypeCode(plan) || ""];
  return inferredWakeTurbulence || aircraftTypeWake || normalizeWakeTurbulenceCategory(plan.filingWakeTurbulence);
};

const buildProviderMessages = ({
  action,
  providerPlanId,
  response,
  metadataResponse,
  source,
}: {
  action: FlightPlanFilingAction | "sync";
  providerPlanId?: string | null;
  response?: Record<string, unknown> | null;
  metadataResponse?: Record<string, unknown> | null;
  source: "provider" | "sync";
}) => {
  const responseMessages = response ? extractLeidosResponseMessages(response) : [];
  const metadataMessages = metadataResponse
    ? findNestedStringArray(metadataResponse, [
      "returnMessage",
      "returnCodedMessage",
      "lastTransmittedMessage",
      "lastReceivedMessage",
      "messages",
      "notices",
      "warnings",
      "errors",
      "artccInfo",
    ])
    : [];
  const merged = Array.from(new Set([...responseMessages, ...metadataMessages])).filter(Boolean);
  return merged.map<FilingProviderMessage>((details, index) => {
    const normalized = String(details || "").toLowerCase();
    const severity =
      /reject|error|failed|denied/i.test(normalized) ? "error" :
      /warn|missing|required|needs|action/i.test(normalized) ? "warning" :
      action === "sync" ? "info" : "success";
    const actionLabels: Record<string, string> = {
      file: "Flight plan filed",
      amend: "Amendment accepted",
      cancel: "Cancellation confirmed",
      activate: "Activation confirmed",
      close: "Closure confirmed",
    };
    const title =
      action === "sync"
        ? severity === "warning" ? "Provider notice — review recommended"
          : severity === "error" ? "Provider returned an error — action may be needed"
          : "Provider sync update"
        : severity === "error" ? "Provider returned an error — action may be needed"
        : severity === "warning" ? "Provider notice — action may be needed"
        : actionLabels[action] ?? "Provider request accepted";
    return {
      id: buildFilingEventId(source, action, providerPlanId, title, details, String(index)),
      timestamp: new Date().toISOString(),
      severity,
      title,
      details,
      source,
      action,
      provider: "Leidos Flight Service",
      providerPlanId: providerPlanId || null,
      raw: response ?? metadataResponse ?? null,
    };
  });
};

const buildProviderSnapshot = ({
  providerPlanId,
  versionStamp,
  payloadSnapshot,
  response,
  metadataResponse,
  syncedAt,
}: {
  providerPlanId: string | null;
  versionStamp: string | null;
  payloadSnapshot: FilingPayloadSnapshot | null;
  response?: Record<string, unknown> | null;
  metadataResponse?: Record<string, unknown> | null;
  syncedAt: string;
}): FilingProviderSnapshot => {
  const source = metadataResponse || response || {};
  const providerRoute = findNestedString(source, [
    "route",
    "expectedRoute",
    "expected_route",
    "currentRoute",
    "routeString",
    "routeText",
  ]);
  const providerStatus = findNestedString(source, [
    "state",
    "status",
    "flightPlanStatus",
    "flightState",
  ]);
  const artccState = findNestedString(source, ["artccState", "artcc_status"]);
  const artccInfo = findNestedString(source, ["artccInfo", "artcc_info"]);
  const directBeaconCode = findNestedString(source, [
    "beaconCode",
    "beacon_code",
    "squawk",
    "squawkCode",
    "squawk_code",
    "transponder",
    "transponderCode",
    "transponder_code",
    "assignedBeacon",
    "assignedBeaconCode",
    "assignedCode",
    "discreteCode",
    "discreteBeaconCode",
    "beacon",
  ]);
  const providerReferenceId = findNestedString(source, [
    "transactionId",
    "referenceId",
    "messageId",
    "trackingId",
  ]);
  const providerOtherInfo = findNestedString(source, ["otherInfo", "other_info"]);
  const notices = Array.from(
    new Set([
      ...extractLeidosResponseMessages(response || {}),
      ...findNestedStringArray(source, [
        "lastTransmittedMessage",
        "lastReceivedMessage",
        "warnings",
        "notices",
        "errors",
        "artccInfo",
      ]),
    ]),
  ).filter(Boolean);
  const beaconCode = normalizeLeidosBeaconCode(directBeaconCode) ||
    normalizeLeidosBeaconCode(notices.join(" ")) ||
    normalizeLeidosBeaconCode(JSON.stringify(source));
  const lifecycleText = [
    providerStatus,
    artccState,
    artccInfo,
    ...notices,
    JSON.stringify(source),
  ].filter(Boolean).join(" ").toLowerCase();
  const providerLifecycleStatus: FilingProviderSnapshot["providerLifecycleStatus"] =
    /cancelled|canceled|cancellation/.test(lifecycleText) ? "cancelled" :
    /\bclosed\b|closure/.test(lifecycleText) ? "closed" :
    /\bactivated\b|\bactive\b|\bopened\b/.test(lifecycleText) ? "activated" :
    /\bproposed\b/.test(lifecycleText) ? "proposed" :
    /\bfiled\b|\baccepted\b/.test(lifecycleText) ? "filed" :
    "unknown";
  const cancellationIndicator = /cancelled|canceled|cancellation/.test(lifecycleText)
    ? (providerStatus || artccState || notices.find((notice) => /cancelled|canceled|cancellation/i.test(notice)) || "Provider indicates cancellation")
    : null;
  const closureIndicator = /\bclosed\b|closure/.test(lifecycleText)
    ? (providerStatus || artccState || notices.find((notice) => /\bclosed\b|closure/i.test(notice)) || "Provider indicates closure")
    : null;
  const providerActionAvailability = {
    amend: ["proposed", "filed", "activated"].includes(providerLifecycleStatus || ""),
    activate: providerLifecycleStatus === "proposed" || providerLifecycleStatus === "filed",
    cancel: providerLifecycleStatus === "proposed",
    close: providerLifecycleStatus === "activated",
    requiresSync: providerLifecycleStatus === "unknown",
    reason: providerLifecycleStatus === "unknown"
      ? "RSF could not determine the current Leidos state. Refresh provider sync before taking lifecycle actions."
      : null,
  };
  const route = {
    localEnteredRoute: payloadSnapshot?.route.localEnteredRoute || null,
    normalizedTransmittedRoute: payloadSnapshot?.route.normalizedTransmittedRoute || null,
    providerRoute: providerRoute || null,
    changedForTransmission: Boolean(payloadSnapshot?.route.changedForTransmission),
    changedByProvider: Boolean(
      providerRoute &&
      payloadSnapshot?.route.normalizedTransmittedRoute &&
      providerRoute !== payloadSnapshot.route.normalizedTransmittedRoute
    ),
    normalizationNotes: payloadSnapshot?.route.normalizationNotes || [],
  };

  return {
    provider: "Leidos Flight Service",
    syncedAt,
    providerPlanId,
    providerReferenceId,
    versionStamp,
    providerStatus,
    artccState,
    artccInfo,
    providerLifecycleStatus,
    providerActionAvailability,
    cancellationIndicator,
    closureIndicator,
    externalChangeDetected: false,
    externalChangeNotice: null,
    beaconCode,
    route,
    notices,
    timestamps: {
      syncedAt,
      filedAt: syncedAt,
      acknowledgedAt: artccState ? syncedAt : null,
    },
    fieldDiffs: buildFilingFieldDiffs({
      localRoute: route.localEnteredRoute,
      transmittedRoute: route.normalizedTransmittedRoute,
      providerRoute: route.providerRoute,
      localOtherInfo: null,
      transmittedOtherInfo: payloadSnapshot?.otherInfo || null,
      providerOtherInfo,
      dof: payloadSnapshot?.dof || null,
    }),
  };
};

export const buildZzzzSupplementalRemarks = (
  remarks: string | null,
  { departureName, destinationName, alternateName }: {
    departureName?: string | null;
    destinationName?: string | null;
    alternateName?: string | null;
  },
): string | null => {
  let base = String(remarks || "").trim();
  if (departureName) base = base.replace(/(?:^|\s)DEP\/\S*/gi, " ").replace(/\s+/g, " ").trim();
  if (destinationName) base = base.replace(/(?:^|\s)DEST\/\S*/gi, " ").replace(/\s+/g, " ").trim();
  if (alternateName) base = base.replace(/(?:^|\s)ALTN\/\S*/gi, " ").replace(/\s+/g, " ").trim();
  return base || null;
};

export const buildZzzzOtherInfoForLeidos = (
  otherInfo: string | null,
  { departureName, destinationName, alternateName, departureLocation, destinationLocation, alternateLocation }: {
    departureName?: string | null;
    destinationName?: string | null;
    alternateName?: string | null;
    departureLocation?: string | null;
    destinationLocation?: string | null;
    alternateLocation?: string | null;
  },
): string | null => {
  let base = String(otherInfo || "").trim();
  const stripSubfield = (source: string, prefix: string) =>
    source.replace(new RegExp(`(?:^|\\s)${prefix}\\\/.*?(?=\\s+[A-Z]{2,5}\\\/|$)`, "gi"), " ").replace(/\s+/g, " ").trim();
  base = stripSubfield(base, "DEP");
  base = stripSubfield(base, "DEST");
  base = stripSubfield(base, "ALT");
  base = stripSubfield(base, "ALTN");
  const formatLocation = (location?: string | null, description?: string | null) => {
    const normalizedLocation = normalizeZzzzActualLocation(location);
    if (!normalizedLocation) return null;
    const shouldAppendDescription = /^\d{4}[NS]?\/?\d{4,5}[EW]?$/i.test(normalizedLocation);
    const normalizedDescription = shouldAppendDescription
      ? String(description || "").trim().replace(/\s+/g, " ").toUpperCase()
      : "";
    return [normalizedLocation, normalizedDescription].filter(Boolean).join(" ");
  };
  const supplementals: string[] = [];
  const formattedDepartureLocation = formatLocation(departureLocation, departureName);
  const formattedDestinationLocation = formatLocation(destinationLocation, destinationName);
  const formattedAlternateLocation = formatLocation(alternateLocation, alternateName);
  if (formattedDepartureLocation) supplementals.push(`DEP/${formattedDepartureLocation}`);
  if (formattedDestinationLocation) supplementals.push(`DEST/${formattedDestinationLocation}`);
  if (formattedAlternateLocation) supplementals.push(`ALTN/${formattedAlternateLocation}`);
  const merged = [base, ...supplementals].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return merged || null;
};

export const buildLeidosActionPayload = (plan: FlightPlan, action: FlightPlanFilingAction, config: LeidosFlightServiceConfig) => {
  const params = new URLSearchParams();
  const routeNormalization = normalizeRouteForProvider(plan.route || "DCT");
  const selectedLocalDepartureTime = getSelectedDepartureLocalDateTime(plan);
  const departureTimeZone = getPlannerTimeZone(plan);
  const providerDepartureInstant = getProviderDepartureInstantForPlan(plan);
  const otherInfoResult = buildOtherInfoWithDof({
    existingOtherInfo: plan.filingOtherInfo || config.otherInfo,
    plannedDepartureAt: providerDepartureInstant || plan.plannedDepartureAt,
    operationalTimeZone: departureTimeZone,
  });

  const append = (key: string, value: unknown) => {
    if (value === null || value === undefined) return;
    const stringValue = String(value).trim();
    if (!stringValue) return;
    params.append(key, stringValue);
  };

  append("includeCodedMessages", "true");

  if (action === "file" || action === "amend") {
    console.info(JSON.stringify({
      event: "flight_time_conversion",
      action,
      planId: plan.id,
      departureDateLocal: selectedLocalDepartureTime?.slice(0, 10) || null,
      departureTimeLocal: selectedLocalDepartureTime?.slice(11, 16) || null,
      departureAirport: plan.departure || null,
      planningReferenceDepartureAirport: getPlannerStateString(plan, "planningReferenceDepartureAirport") || null,
      departureTimezone: departureTimeZone || null,
      computedDepartureInstantUtc: providerDepartureInstant,
      browserTimezoneForDebugOnly: null,
      expectedProviderZulu: providerDepartureInstant
        ? `${String(new Date(providerDepartureInstant).getUTCHours()).padStart(2, "0")}${String(new Date(providerDepartureInstant).getUTCMinutes()).padStart(2, "0")}Z`
        : null,
    }));
    console.info(JSON.stringify({
      event: "flight_plan_time_consistency",
      planId: plan.id,
      departureAirport: plan.departure || null,
      destinationAirport: plan.destination || null,
      departureTimezone: departureTimeZone || null,
      departureDateLocal: selectedLocalDepartureTime?.slice(0, 10) || null,
      departureTimeLocal: selectedLocalDepartureTime?.slice(11, 16) || null,
      departureInstantUtc: providerDepartureInstant,
      displayDepartureAirportTime: selectedLocalDepartureTime && departureTimeZone
        ? `${selectedLocalDepartureTime.replace("T", " ")} ${departureTimeZone}`
        : null,
      displayZulu: providerDepartureInstant
        ? `${String(new Date(providerDepartureInstant).getUTCHours()).padStart(2, "0")}${String(new Date(providerDepartureInstant).getUTCMinutes()).padStart(2, "0")}Z`
        : null,
      browserTimezoneDebugOnly: null,
      anyUserLocalDisplayTime: null,
    }));

    append("type", "ICAO");
    append("flightRules", normalizeFlightRules(plan.filingFlightRules));
    append("aircraftIdentifier", plan.tailNumber);
    append("departure", plan.departure);
    append("destination", plan.destination);
    append("altDestination1", plan.alternate);
    append("departureInstant", providerDepartureInstant);
    append("flightDuration", minutesToIsoDuration(plan.filingEstimatedEnrouteMinutes));
    append("speedKnots", plan.filingTrueAirspeedKtas);
    append("aircraftType", getLeidosAircraftTypeCode(plan));
    append("wakeTurbulence", getLeidosWakeTurbulence(plan));
    append("aircraftEquipment", normalizeLeidosEquipmentCode(plan.filingEquipment));
    append("route", routeNormalization.normalizedRoute || "DCT");
    const primaryRemarks = String(plan.filingRemarks || plan.notes || "").trim();
    append("remarks", primaryRemarks);
    append("fuelOnBoard", minutesToIsoDuration(plan.filingEnduranceMinutes));
    append("pilotData", plan.filingPilotName);
    append("peopleOnBoardExtended", plan.filingSoulsOnBoard);
    append("aircraftColorExtended", normalizeLeidosAircraftColorExtended(plan.filingAircraftColor));
    append("typeOfFlight", plan.filingTypeOfFlight);
    append("surveillanceEquipment", plan.filingSurveillanceEquipment);
    append("pilotInCommandExtended", plan.filingPilotName);
    append("pilotPhone", plan.filingPilotPhone);
    append("aircraftHomeBase", plan.filingAircraftHomeBase);
    const supplementalRemarks = buildZzzzSupplementalRemarks(plan.filingRemarks || plan.notes || null, {
      departureName: plan.departure?.toUpperCase() === "ZZZZ" ? plan.filingDepartureName : null,
      destinationName: plan.destination?.toUpperCase() === "ZZZZ" ? plan.filingDestinationName : null,
      alternateName: plan.alternate?.toUpperCase() === "ZZZZ" ? plan.filingAlternateName : null,
    });
    if (supplementalRemarks && supplementalRemarks !== primaryRemarks) {
      append("suppRemarksExtended", supplementalRemarks);
    }
    const zzzzLocationCompliance = {
      departure: plan.departure?.toUpperCase() === "ZZZZ"
        ? {
          filedDeparture: "ZZZZ",
          planningReferenceDepartureAirport: getPlannerStateString(plan, "planningReferenceDepartureAirport") || null,
          actualDepartureLocation: getPlannerStateString(plan, "actualDepartureLocation") || null,
          actualDepartureLocationMode: getPlannerStateLocationMode(plan, "actualDepartureLocationMode"),
          formattedLeidosDepartureLocation: normalizeZzzzActualLocation(getPlannerStateString(plan, "actualDepartureLocation")) || null,
        }
        : null,
      destination: plan.destination?.toUpperCase() === "ZZZZ"
        ? {
          filedDestination: "ZZZZ",
          planningReferenceDestinationAirport: getPlannerStateString(plan, "planningReferenceDestinationAirport") || null,
          actualDestinationLocation: getPlannerStateString(plan, "actualDestinationLocation") || null,
          actualDestinationLocationMode: getPlannerStateLocationMode(plan, "actualDestinationLocationMode"),
          formattedLeidosDestinationLocation: normalizeZzzzActualLocation(getPlannerStateString(plan, "actualDestinationLocation")) || null,
        }
        : null,
      alternate: plan.alternate?.toUpperCase() === "ZZZZ"
        ? {
          filedAlternate: "ZZZZ",
          planningReferenceAlternateAirport: getPlannerStateString(plan, "planningReferenceAlternateAirport") || null,
          actualAlternateLocation: getPlannerStateString(plan, "actualAlternateLocation") || null,
          actualAlternateLocationMode: getPlannerStateLocationMode(plan, "actualAlternateLocationMode"),
          formattedLeidosAlternateLocation: normalizeZzzzActualLocation(getPlannerStateString(plan, "actualAlternateLocation")) || null,
        }
        : null,
    };
    const remarksMergedOtherInfo = buildOtherInfoWithRemarks(otherInfoResult.otherInfo, primaryRemarks);
    const zzzzMergedOtherInfo = buildZzzzOtherInfoForLeidos(remarksMergedOtherInfo, {
      departureName: plan.departure?.toUpperCase() === "ZZZZ" ? plan.filingDepartureName : null,
      destinationName: plan.destination?.toUpperCase() === "ZZZZ" ? plan.filingDestinationName : null,
      alternateName: plan.alternate?.toUpperCase() === "ZZZZ" ? plan.filingAlternateName : null,
      departureLocation: zzzzLocationCompliance.departure?.formattedLeidosDepartureLocation || null,
      destinationLocation: zzzzLocationCompliance.destination?.formattedLeidosDestinationLocation || null,
      alternateLocation: zzzzLocationCompliance.alternate?.formattedLeidosAlternateLocation || null,
    });
    const aircraftTypeCode = getLeidosAircraftTypeCode(plan);
    const actualAircraftType = normalizeActualAircraftTypeForIcao(getPlannerStateString(plan, "actualAircraftType"));
    const mergedOtherInfo = normalizeLeidosOtherInfoForTransmission(
      aircraftTypeCode === "ZZZZ"
        ? buildOtherInfoWithAircraftType(zzzzMergedOtherInfo, actualAircraftType)
        : zzzzMergedOtherInfo
    );
    if (aircraftTypeCode === "ZZZZ") {
      console.info(JSON.stringify({
        event: "leidos_aircraft_type_zzzz_compliance",
        planId: plan.id,
        aircraftType: "ZZZZ",
        actualAircraftType,
        generatedOtherInfoType: actualAircraftType ? `TYP/${actualAircraftType}` : null,
      }));
    }
    if (zzzzLocationCompliance.departure || zzzzLocationCompliance.destination || zzzzLocationCompliance.alternate) {
      console.info(JSON.stringify({
        event: "leidos_zzzz_location_compliance",
        action,
        planId: plan.id,
        departure: zzzzLocationCompliance.departure
          ? { ...zzzzLocationCompliance.departure, generatedOtherInfo: mergedOtherInfo?.match(/\bDEP\/.*?(?=\s+[A-Z]{2,5}\/|$)/)?.[0] || null }
          : null,
        destination: zzzzLocationCompliance.destination
          ? { ...zzzzLocationCompliance.destination, generatedOtherInfo: mergedOtherInfo?.match(/\bDEST\/.*?(?=\s+[A-Z]{2,5}\/|$)/)?.[0] || null }
          : null,
        alternate: zzzzLocationCompliance.alternate
          ? { ...zzzzLocationCompliance.alternate, generatedOtherInfo: mergedOtherInfo?.match(/\bALTN\/.*?(?=\s+[A-Z]{2,5}\/|$)/)?.[0] || null }
          : null,
      }));
    }
    append("otherInfo", mergedOtherInfo);
    appendLeidosAltitudeFields(params, plan.filingPlannedAltitudeFt);
    if (action === "amend") {
      append("versionStamp", extractVersionStamp(plan));
    }
    const transmittedFields = Object.fromEntries(params.entries());
    const payloadSnapshot: FilingPayloadSnapshot = {
      provider: "Leidos Flight Service",
      action,
      builtAt: new Date().toISOString(),
      departureInstant: providerDepartureInstant,
      selectedLocalDepartureTime,
      departureOperationalDate: plan.plannedDepartureAt
        ? formatOperationalDateKey(providerDepartureInstant || plan.plannedDepartureAt, departureTimeZone)
        : null,
      dof: otherInfoResult.dof,
      dofInjected: otherInfoResult.injected,
      route: {
        localEnteredRoute: routeNormalization.localEnteredRoute,
        normalizedTransmittedRoute: routeNormalization.normalizedRoute,
        providerRoute: null,
        changedForTransmission: routeNormalization.changed,
        changedByProvider: false,
        normalizationNotes: routeNormalization.notes,
      },
      otherInfo: mergedOtherInfo,
      transmittedFields,
    };
    return {
      params,
      payloadSnapshot,
      routeNormalization,
      otherInfoResult,
    };
  }

  if (action === "cancel" || action === "close") {
    append("versionStamp", extractVersionStamp(plan));
    if (action === "close" && plan.filingCloseLocation) {
      append("closeDestinationInfo", plan.filingCloseLocation);
    }
    return {
      params,
      payloadSnapshot: null,
      routeNormalization,
      otherInfoResult,
    };
  }

  if (action === "activate") {
    append("actualDepartureInstant", formatDepartureInstant(plan.plannedDepartureAt) || new Date().toISOString());
    append("versionStamp", extractVersionStamp(plan));
    return {
      params,
      payloadSnapshot: null,
      routeNormalization,
      otherInfoResult,
    };
  }

  return {
    params,
    payloadSnapshot: null,
    routeNormalization,
    otherInfoResult,
  };
};

const parseProviderResponse = async (response: Response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await response.json() as Record<string, unknown>;
  }
  const text = await response.text();
  const trimmed = text.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      // Keep the raw text fallback if the provider sends malformed JSON.
    }
  }
  return { text };
};

const retrieveLeidosPlanMetadataByProviderPlanId = async (
  providerPlanId: string,
  config: LeidosFlightServiceConfig,
): Promise<Record<string, unknown> | null> => {
  const trimmedProviderPlanId = String(providerPlanId || '').trim();
  if (!trimmedProviderPlanId || !config.username || !config.password || !config.retrievePath) return null;

  const resolvedPath = config.retrievePath
    .replaceAll("{flightIdentifier}", encodeURIComponent(trimmedProviderPlanId))
    .replaceAll("{providerPlanId}", encodeURIComponent(trimmedProviderPlanId))
    .replaceAll("{planId}", encodeURIComponent(trimmedProviderPlanId));
  const url = resolvedPath.startsWith("http://") || resolvedPath.startsWith("https://")
    ? new URL(resolvedPath)
    : new URL(resolvedPath, config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`);
  url.searchParams.set('versionRequested', '20240801');

  const basic = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  let response: Response;
  try {
    response = await fetchLeidosUrl(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: 'application/json, text/plain, */*',
        'User-Agent': config.userAgent,
      },
    });
  } catch {
    return null;
  }

  const parsedResponse = await parseProviderResponse(response);
  if (!response.ok || typeof parsedResponse.text === 'string') {
    return null;
  }
  return parsedResponse;
};

const retrieveLeidosPlanMetadata = async (
  plan: FlightPlan,
  config: LeidosFlightServiceConfig,
): Promise<Record<string, unknown> | null> => {
  const providerPlanId = String(plan.filingProviderPlanId || '').trim();
  if (!providerPlanId || !config.username || !config.password) return null;
  return retrieveLeidosPlanMetadataByProviderPlanId(providerPlanId, config);
};

const retrieveLeidosPlanMetadataWithVersionStamp = async (
  providerPlanId: string,
  config: LeidosFlightServiceConfig,
) => {
  const delaysMs = parseMetadataRetryDelays(process.env.LEIDOS_FLIGHT_SERVICE_METADATA_RETRY_DELAYS_MS);
  let metadataResponse: Record<string, unknown> | null = null;
  let versionStamp: string | null = null;

  for (const delayMs of delaysMs) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    metadataResponse = await retrieveLeidosPlanMetadataByProviderPlanId(providerPlanId, config);
    versionStamp = extractFilingVersionStamp(metadataResponse);
    if (versionStamp) break;
  }

  return {
    metadataResponse,
    versionStamp,
  };
};

export const syncLeidosPlanMetadata = async (plan: FlightPlan) => {
  const config = getLeidosFlightServiceConfig();
  const providerPlanId = String(plan.filingProviderPlanId || "").trim();
  if (!providerPlanId) {
    return {
      providerPlanId: null,
      versionStamp: null,
      metadataResponse: null as Record<string, unknown> | null,
      providerSnapshot: null as FilingProviderSnapshot | null,
      providerMessages: [] as FilingProviderMessage[],
      message: "This plan does not have a Leidos flight identifier yet.",
    };
  }

  const retrieval = await retrieveLeidosPlanMetadataWithVersionStamp(providerPlanId, config);
  const existingPayload = getRecord((plan as Record<string, unknown>).filingPayload) as FilingPayloadSnapshot | null;
  const providerSnapshot = buildProviderSnapshot({
    providerPlanId,
    versionStamp: retrieval.versionStamp,
    payloadSnapshot: existingPayload,
    metadataResponse: retrieval.metadataResponse,
    syncedAt: new Date().toISOString(),
  });
  const providerMessages = buildProviderMessages({
    action: "sync",
    providerPlanId,
    metadataResponse: retrieval.metadataResponse,
    source: "sync",
  });
  console.info(JSON.stringify({
    event: "leidos_sync_pulled",
    planId: plan.id,
    providerPlanId,
    versionStamp: retrieval.versionStamp,
    providerStatus: providerSnapshot.providerStatus,
    artccState: providerSnapshot.artccState,
    routeProvider: providerSnapshot.route.providerRoute,
    routeChangedByProvider: providerSnapshot.route.changedByProvider,
    notices: providerSnapshot.notices,
  }));
  return {
    providerPlanId,
    versionStamp: retrieval.versionStamp,
    metadataResponse: retrieval.metadataResponse,
    providerSnapshot,
    providerMessages,
    message: retrieval.versionStamp
      ? "RSF refreshed the Leidos provider sync and recovered the current amend token."
      : "RSF refreshed the Leidos provider sync, but the amend token is still not available yet.",
  };
};

const summarizeObjectKeys = (input: unknown, maxDepth = 2, depth = 0): unknown => {
  if (!input || typeof input !== "object") return null;
  if (Array.isArray(input)) {
    return input.slice(0, 5).map((item) => summarizeObjectKeys(item, maxDepth, depth + 1));
  }
  if (depth >= maxDepth) {
    return Object.keys(input as Record<string, unknown>).sort();
  }

  const record = input as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record).slice(0, 25)) {
    if (!value || typeof value !== "object") {
      summary[key] = typeof value;
      continue;
    }
    summary[key] = summarizeObjectKeys(value, maxDepth, depth + 1);
  }
  return summary;
};

const VERSION_STAMP_CANDIDATE_KEYS = new Set(
  [
    "versionStamp",
    "version_stamp",
    "version",
    "versionId",
    "version_id",
    "currentVersionStamp",
    "current_version_stamp",
    "currentVersion",
    "current_version",
    "flightPlanVersion",
    "flight_plan_version",
    "flightPlanVersionStamp",
    "flight_plan_version_stamp",
    "versionNumber",
    "version_number",
    "fpVersion",
    "fp_version",
    "filedVersion",
    "filed_version",
    "amendVersion",
    "amend_version",
    "etag",
    "eTag",
    "lastModified",
    "last_modified",
    "sequenceNumber",
    "sequence_number",
    "revisionNumber",
    "revision_number",
  ].map((value) => value.toLowerCase().replace(/[^a-z0-9]/g, "")),
);

const PROVIDER_PLAN_ID_CANDIDATE_KEYS = new Set(
  [
    "providerPlanId",
    "provider_plan_id",
    "flightIdentifier",
    "flight_identifier",
    "flightPlanId",
    "flight_plan_id",
    "planId",
    "plan_id",
    "id",
  ].map((value) => value.toLowerCase().replace(/[^a-z0-9]/g, "")),
);

const collectVersionCandidatePaths = (input: unknown, maxDepth = 8) => {
  const matches: Array<{ path: string; type: string; preview: unknown }> = [];
  if (!input || typeof input !== "object") return matches;

  const queue: Array<{ value: unknown; depth: number; path: string }> = [{ value: input, depth: 0, path: "$" }];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const { value, depth, path } = current;
    if (value === null || value === undefined || depth > maxDepth) {
      continue;
    }

    if (typeof value !== "object") {
      continue;
    }

    if (visited.has(value)) continue;
    visited.add(value);

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        queue.push({ value: item, depth: depth + 1, path: `${path}[${index}]` });
      });
      continue;
    }

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      const childPath = `${path}.${key}`;
      if (VERSION_STAMP_CANDIDATE_KEYS.has(normalizedKey)) {
        let preview: unknown = child;
        if (child && typeof child === "object") {
          try {
            preview = JSON.stringify(child);
          } catch {
            preview = "[object]";
          }
        }
        matches.push({
          path: childPath,
          type: Array.isArray(child) ? "array" : typeof child,
          preview,
        });
      }
      if (child && typeof child === "object") {
        queue.push({ value: child, depth: depth + 1, path: childPath });
      }
    }
  }

  return matches.slice(0, 20);
};

const collectProviderPlanIdCandidatePaths = (input: unknown, maxDepth = 8) => {
  const matches: Array<{ path: string; type: string; preview: unknown }> = [];
  if (!input || typeof input !== "object") return matches;

  const queue: Array<{ value: unknown; depth: number; path: string }> = [{ value: input, depth: 0, path: "$" }];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const { value, depth, path } = current;
    if (value === null || value === undefined || depth > maxDepth) {
      continue;
    }

    if (typeof value !== "object") {
      continue;
    }

    if (visited.has(value)) continue;
    visited.add(value);

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        queue.push({ value: item, depth: depth + 1, path: `${path}[${index}]` });
      });
      continue;
    }

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      const childPath = `${path}.${key}`;
      if (PROVIDER_PLAN_ID_CANDIDATE_KEYS.has(normalizedKey)) {
        let preview: unknown = child;
        if (child && typeof child === "object") {
          try {
            preview = JSON.stringify(child);
          } catch {
            preview = "[object]";
          }
        }
        matches.push({
          path: childPath,
          type: Array.isArray(child) ? "array" : typeof child,
          preview,
        });
      }
      if (child && typeof child === "object") {
        queue.push({ value: child, depth: depth + 1, path: childPath });
      }
    }
  }

  return matches.slice(0, 20);
};

export const searchLeidosRoute = async ({
  departure,
  destination,
  altitudeFt,
}: {
  departure: string;
  destination: string;
  altitudeFt?: number | null;
}): Promise<LeidosRouteSearchResult> => {
  const config = getLeidosFlightServiceConfig();
  if (!config.username || !config.password) {
    throw new Error("Leidos credentials are not configured.");
  }

  const baseUrl = config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`;
  const url = new URL("util/routeSearch", baseUrl);
  url.searchParams.set("departure", departure.trim().toUpperCase());
  url.searchParams.set("destination", destination.trim().toUpperCase());
  url.searchParams.set("searchOption", "SYSTEM_RECOMMENDED");
  if (altitudeFt && Number.isFinite(altitudeFt) && altitudeFt > 0 && altitudeFt < 18000) {
    url.searchParams.set("searchPathOption", "LOW_ALTITUDE_ONLY");
  }

  const basic = Buffer.from(`${config.username}:${config.password}`).toString("base64");
  let response: Response;
  try {
    response = await fetchLeidosUrl(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: "application/json, text/plain, */*",
        "User-Agent": config.userAgent,
      },
    });
  } catch (error: any) {
    if (isLeidosTimeoutLikeError(error)) {
      throw new Error("Leidos route assist timed out in the lab. Flight Service did not respond in time, so route suggestions are temporarily unavailable.");
    }
    throw error;
  }

  const parsed = await parseProviderResponse(response);
  if (!response.ok) {
    throw new Error(`Leidos route search failed with status ${response.status}`);
  }

  const asStringArray = (value: unknown) =>
    Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];

  return {
    provider: "Leidos Flight Service",
    environment: config.environment,
    departure: departure.trim().toUpperCase(),
    destination: destination.trim().toUpperCase(),
    route: String((parsed.route as string | undefined) || "").trim() || null,
    atcRecentIFRRoutes: asStringArray(parsed.atcRecentIFRRoutes),
    codedDepartureRoutes: asStringArray(parsed.codedDepartureRoutes),
    faaPreferredRoutes: asStringArray(parsed.faaPreferredRoutes),
    warnings: asStringArray(parsed.returnCodedMessage),
  };
};

const buildStagedFallbackResult = (
  plan: FlightPlan,
  action: FlightPlanFilingAction,
  validation: FilingValidationResult,
  reason: string,
  options?: {
    providerPlanId?: string | null;
    payloadSnapshot?: FilingPayloadSnapshot | null;
    providerSnapshot?: FilingProviderSnapshot | null;
    providerMessages?: FilingProviderMessage[];
    rawExtras?: Record<string, unknown>;
  },
): FilingServiceResult => ({
  live: false,
  provider: "Leidos Flight Service",
  action,
  accepted: true,
  message: `RSF staged the ${action.toUpperCase()} request. ${reason}`,
  nextStatus: "staged",
  warnings: validation.warnings,
  providerUrl: getProviderUrl(),
  providerPlanId: String(options?.providerPlanId || "").trim() || buildProviderPlanId(plan, action),
  payloadSnapshot: options?.payloadSnapshot ?? null,
  providerSnapshot: options?.providerSnapshot ?? null,
  providerMessages: options?.providerMessages ?? [],
  raw: {
    action,
    planId: plan.id,
    filingFlightRules: normalizeFlightRules(plan.filingFlightRules),
    departure: plan.departure,
    destination: plan.destination,
    route: plan.route || null,
    alternate: plan.alternate || null,
    validation,
    stagedReason: reason,
    ...options?.rawExtras,
  },
});

export const verifyLeidosWebhookAuthorization = (authorizationHeader?: string | null) => {
  const { webhookUsername, webhookPassword } = getLeidosFlightServiceConfig();
  if (!webhookUsername || !webhookPassword || !authorizationHeader?.startsWith("Basic ")) {
    return false;
  }

  const providedToken = authorizationHeader.slice("Basic ".length).trim();
  const expectedToken = Buffer.from(`${webhookUsername}:${webhookPassword}`).toString("base64");
  const providedBuffer = Buffer.from(providedToken);
  const expectedBuffer = Buffer.from(expectedToken);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

export const validateFlightPlanForAction = (plan: FlightPlan, action: FlightPlanFilingAction): FilingValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rules = normalizeFlightRules(plan.filingFlightRules);
  const lifecycleStatus = String(plan.filingStatus || "").toLowerCase();
  const routeNormalization = normalizeRouteForProvider(plan.route || "DCT");

  if (!plan.departure) errors.push("Departure airport is required.");
  if (plan.departure?.toUpperCase() === "ZZZZ" && (action === "file" || action === "amend")) {
    if (!normalizeZzzzActualLocation(getPlannerStateString(plan, "actualDepartureLocation"))) {
      errors.push("Departure is ZZZZ - enter an actual departure FAA identifier or latitude/longitude.");
    }
    if (!hasZzzzLocationDescription(plan.filingDepartureName)) {
      errors.push("Please enter a brief description of this location (for example: Private Strip, Grass Airstrip, Smith Ranch, Helipad).");
    }
    const reference = getPlannerStateString(plan, "planningReferenceDepartureAirport");
    if (!reference || reference === "ZZZZ") {
      errors.push("Departure ZZZZ requires a planning reference airport so RSF can calculate the route.");
    }
  }
  if (!plan.destination) errors.push("Destination airport is required.");
  if (plan.destination?.toUpperCase() === "ZZZZ" && (action === "file" || action === "amend")) {
    if (!normalizeZzzzActualLocation(getPlannerStateString(plan, "actualDestinationLocation"))) {
      errors.push("Destination is ZZZZ - enter an actual destination FAA identifier or latitude/longitude.");
    }
    if (!hasZzzzLocationDescription(plan.filingDestinationName)) {
      errors.push("Please enter a brief description of this location (for example: Private Strip, Grass Airstrip, Smith Ranch, Helipad).");
    }
    const reference = getPlannerStateString(plan, "planningReferenceDestinationAirport");
    if (!reference || reference === "ZZZZ") {
      errors.push("Destination ZZZZ requires a planning reference airport so RSF can calculate the route.");
    }
  }
  if (plan.alternate?.toUpperCase() === "ZZZZ" && (action === "file" || action === "amend")) {
    if (!normalizeZzzzActualLocation(getPlannerStateString(plan, "actualAlternateLocation"))) {
      errors.push("Alternate is ZZZZ - enter an actual alternate FAA identifier or latitude/longitude.");
    }
    if (!hasZzzzLocationDescription(plan.filingAlternateName)) {
      errors.push("Please enter a brief description of this location (for example: Private Strip, Grass Airstrip, Smith Ranch, Helipad).");
    }
    const reference = getPlannerStateString(plan, "planningReferenceAlternateAirport");
    if (!reference || reference === "ZZZZ") {
      errors.push("Alternate ZZZZ requires a planning reference airport so RSF can calculate the route.");
    }
  }
  if (!plan.tailNumber) errors.push("Aircraft ID / tail number is required.");
  if (!plan.aircraftType) errors.push("Aircraft type is required.");
  if ((action === "file" || action === "amend") && getLeidosAircraftTypeCode(plan) === "ZZZZ" && !normalizeActualAircraftTypeForIcao(getPlannerStateString(plan, "actualAircraftType"))) {
    errors.push("Actual aircraft type is required when Aircraft Type is ZZZZ.");
  }
  if ((action === "file" || action === "amend") && !plan.filingTrueAirspeedKtas) {
    errors.push("Cruise speed is required before sending this filing action to the filing provider.");
  }
  if ((action === "file" || action === "amend") && !plan.filingPlannedAltitudeFt) {
    errors.push("Planned altitude is required before sending this filing action to the filing provider.");
  }
  if ((action === "file" || action === "amend") && !plan.filingEstimatedEnrouteMinutes) {
    errors.push("Estimated enroute time is required before sending this filing action to the filing provider.");
  }
  if ((action === "file" || action === "amend") && !plan.filingEnduranceMinutes) {
    errors.push("Endurance is required before sending this filing action to the filing provider.");
  }
  if ((action === "file" || action === "amend") && !plan.filingEquipment) {
    errors.push("Aircraft equipment is required before sending this filing action to the filing provider.");
  }
  if ((action === "file" || action === "amend") && plan.filingEquipment) {
    const equipmentValidation = validateFlightServiceAircraftEquipmentCodes(
      plan.filingEquipment,
      plan.filingSurveillanceEquipment,
    );
    console.info(JSON.stringify({
      event: "leidos_aircraft_equipment_validation",
      planId: plan.id,
      action,
      originalAircraftEquipment: equipmentValidation.originalAircraftEquipment,
      normalizedAircraftEquipment: equipmentValidation.normalizedAircraftEquipment,
      surveillanceEquipment: equipmentValidation.surveillanceEquipment,
      invalidEquipmentCodes: equipmentValidation.invalidEquipmentCodes,
      duplicateEquipmentCodes: equipmentValidation.duplicateEquipmentCodes,
      validationResult: equipmentValidation.validationResult,
      blockedBeforeLeidos: equipmentValidation.blockedBeforeLeidos,
      blockedBeforeProvider: equipmentValidation.blockedBeforeLeidos,
    }));
    if (equipmentValidation.validationResult === "invalid") {
      errors.push("Aircraft equipment contains an invalid ICAO code. Please update the aircraft equipment before filing.");
    }
  }
  if ((action === "file" || action === "amend") && !plan.filingPilotPhone) {
    errors.push("Pilot phone number is required before sending this filing action to the filing provider.");
  }
  if ((action === "file" || action === "amend") && !plan.filingPilotName) {
    errors.push("Pilot in command name is required before sending this filing action to the filing provider.");
  }
  if ((action === "file" || action === "amend") && !plan.filingSoulsOnBoard) {
    errors.push("Souls on board is required before sending this filing action to the filing provider.");
  }
  if ((action === "file" || action === "amend") && !getLeidosWakeTurbulence(plan)) {
    errors.push("Wake turbulence category is required. Enter it or select an aircraft profile with a known maximum gross weight.");
  }
  if ((action === "file" || action === "amend") && !plan.filingTypeOfFlight) {
    errors.push("Type of flight is required before sending this filing action to the filing provider.");
  }
  if ((action === "file" || action === "amend") && !plan.filingSurveillanceEquipment) {
    errors.push("Surveillance equipment is required before sending this filing action to the filing provider.");
  }
  if ((action === "file" || action === "amend") && plan.filingSurveillanceEquipment && !hasOnlyKnownIcaoSurveillanceCodes(plan.filingSurveillanceEquipment)) {
    errors.push("Surveillance equipment must use approved ICAO surveillance codes.");
  }
  if ((action === "file" || action === "amend") && plan.filingSurveillanceEquipment && !hasOnlyFlightServiceSurveillanceCodes(plan.filingSurveillanceEquipment)) {
    errors.push("Flight Service currently accepts N, A, C, or S in the Surveillance Equipment field. Put ADS-B or ADS-C details in Other ICAO Information using SUR/ if needed.");
  }
  if ((action === "file" || action === "amend") && !plan.filingAircraftHomeBase) {
    errors.push("Aircraft home base is required before sending this filing action to the filing provider.");
  }
  if ((action === "file" || action === "amend") && !plan.filingRemarks && !plan.notes) {
    errors.push("Filing Remarks / ATC Remarks are required before sending this filing action to the filing provider.");
  }
  if ((action === "file" || action === "amend") && rules === "VFR" && Number(plan.filingPlannedAltitudeFt || 0) >= 18000) {
    errors.push("VFR flight plans cannot be filed at or above FL180. Use IFR or choose a lower altitude.");
  }

  if ((action === "file" || action === "amend" || action === "activate") && !plan.plannedDepartureAt) {
    errors.push("Planned departure time is required before staging this action.");
  }
  if ((action === "file" || action === "amend") && !getSelectedDepartureLocalDateTime(plan)) {
    errors.push("Departure date and time are required before filing.");
  }
  if ((action === "file" || action === "amend") && !isValidIanaTimeZone(getPlannerTimeZone(plan))) {
    if (String(plan.departure || "").trim().toUpperCase() === "ZZZZ" && !getPlannerStateString(plan, "planningReferenceDepartureAirport")) {
      errors.push("Departure timezone is required when using ZZZZ without a planning reference airport.");
    } else {
      errors.push("Departure airport timezone could not be determined. Please select the departure timezone before filing.");
    }
  }

  if (rules === "IFR" && !routeNormalization.normalizedRoute) {
    errors.push("IFR flight plans require a route before staging.");
  }
  if ((action === "file" || action === "amend") && plan.route && String(plan.route).trim().toUpperCase() !== "DCT" && !routeNormalization.hasValidToken) {
    errors.push("Route must contain at least one valid airport, fix, navaid, airway, or procedure token before filing.");
  }

  if ((action === "activate" || action === "close") && rules !== "VFR") {
    errors.push(`${action === "activate" ? "Activation" : "Closure"} is only available for VFR flight plans.`);
  }

  if (action !== "file" && !plan.filingProviderPlanId) {
    errors.push("Stage or file the plan first so a provider plan ID exists before using this action.");
  }
  const providerSnapshot = plan.filingProviderSnapshot && typeof plan.filingProviderSnapshot === "object" && !Array.isArray(plan.filingProviderSnapshot)
    ? plan.filingProviderSnapshot as Record<string, unknown>
    : null;
  if (action !== "file" && providerSnapshot?.providerPendingReview === true) {
    errors.push("The filing provider has updated this flight plan. Review and accept or reconcile those changes before submitting another provider action.");
  }

  if (action === "amend") {
    const amendableStatuses = rules === "VFR" ? ["filed", "activated"] : ["filed"];
    if (!amendableStatuses.includes(lifecycleStatus)) {
      errors.push(
        rules === "VFR"
          ? "Only a filed or active VFR plan can be amended."
          : "Only a filed IFR plan can be amended before ATC cutoff.",
      );
    }
  }

  if (action === "cancel" && lifecycleStatus !== "filed") {
    errors.push("Only a filed flight plan in the PROPOSED state can be cancelled through the filing provider.");
  }

  if (action === "activate" && lifecycleStatus !== "filed") {
    errors.push("Only a filed VFR plan in the PROPOSED state can be activated.");
  }

  if (action === "close" && lifecycleStatus !== "activated") {
    errors.push("Only an active VFR flight plan can be closed.");
  }

  if (action === "close" && isFlightPlanCloseOverdue(plan.plannedArrivalAt) && !plan.filingCloseLocation) {
    errors.push("This VFR flight plan appears overdue. Enter your actual close location so Leidos can process the overdue close.");
  }

  if (action === "cancel" && ["cancelled", "closed"].includes((plan.filingStatus || "").toLowerCase())) {
    errors.push(`This plan is already ${String(plan.filingStatus).toLowerCase()}.`);
  }

  if (!plan.fuelOnBoard) {
    warnings.push("Fuel on board is not saved with this plan yet. Verify endurance before filing.");
  }

  if (!plan.alternate && rules === "IFR") {
    warnings.push("Consider adding an alternate before filing IFR.");
  }

  if (!routeNormalization.normalizedRoute && rules === "VFR") {
    warnings.push("VFR filing can proceed direct, but adding route detail improves the handoff packet.");
  }
  if (action === "file" || action === "amend") {
    const otherInfoWarnings = getIcaoOtherInfoEquipmentWarnings(plan.filingOtherInfo, plan.filingEquipment);
    if (otherInfoWarnings.missingPbn) {
      errors.push("Aircraft equipment code R means PBN approved, so Other ICAO Information must include PBN/ capability data.");
    }
    if (otherInfoWarnings.missingR || otherInfoWarnings.missingZ) {
      warnings.push("Selected ICAO information requires additional aircraft equipment codes.");
    }
  }
  warnings.push(...routeNormalization.notes.filter((note) => !warnings.includes(note)));

  return {
    ready: errors.length === 0,
    errors,
    warnings,
  };
};

export class LeidosFlightPlanFilingProvider implements FlightPlanFilingProvider {
  async stageAction(plan: FlightPlan, action: FlightPlanFilingAction): Promise<FilingServiceResult> {
    const validation = validateFlightPlanForAction(plan, action);
    const config = getLeidosFlightServiceConfig();
    const actionPath = config.actionPaths[action];

    if (!config.enabled) {
      return buildStagedFallbackResult(
        plan,
        action,
        validation,
        "Live provider submission remains disabled until RSF enables Leidos in environment configuration.",
      );
    }

    if (!config.username || !config.password) {
      return buildStagedFallbackResult(
        plan,
        action,
        validation,
        "Leidos credentials are not configured yet, so RSF kept the request staged.",
      );
    }

    if (!actionPath) {
      return buildStagedFallbackResult(
        plan,
        action,
        validation,
        `The Leidos ${action.toUpperCase()} endpoint path is not configured yet, so RSF kept the request staged.`,
      );
    }

    if (action !== "file" && !plan.filingProviderPlanId) {
      return buildStagedFallbackResult(
        plan,
        action,
        validation,
        `The Leidos ${action.toUpperCase()} request needs a flightIdentifier from a prior file response, so RSF kept it staged.`,
      );
    }

    let effectivePlan = plan;
    if ((action === "amend" || action === "activate") && !extractVersionStamp(effectivePlan)) {
      const providerPlanId = String(plan.filingProviderPlanId || "").trim();
      const retrieval = providerPlanId
        ? await retrieveLeidosPlanMetadataWithVersionStamp(providerPlanId, config)
        : { metadataResponse: await retrieveLeidosPlanMetadata(plan, config), versionStamp: null as string | null };
      const retrievedMetadata = retrieval.metadataResponse;
      const retrievedVersionStamp = retrieval.versionStamp || extractFilingVersionStamp(retrievedMetadata);
      if (retrievedMetadata && retrievedVersionStamp) {
        effectivePlan = {
          ...plan,
          filingRaw: {
            retrievedAt: new Date().toISOString(),
            providerPlanId: plan.filingProviderPlanId,
            versionStamp: retrievedVersionStamp,
            response: retrievedMetadata,
          },
        } as FlightPlan;
      }
    }

    if ((action === "amend" || action === "activate") && !extractVersionStamp(effectivePlan)) {
      const providerPlanId = String(plan.filingProviderPlanId || "").trim() || buildProviderPlanId(plan, action);
      const retrieval = providerPlanId
        ? await retrieveLeidosPlanMetadataWithVersionStamp(providerPlanId, config)
        : { metadataResponse: null as Record<string, unknown> | null, versionStamp: null as string | null };
      console.info(JSON.stringify({
        event: "leidos_missing_version_stamp_before_action",
        action,
        providerPlanId,
        retrievePath: config.retrievePath,
        versionStamp: retrieval.versionStamp,
        metadataVersionStamp: retrieval.metadataResponse && typeof retrieval.metadataResponse === "object"
          ? (retrieval.metadataResponse as Record<string, unknown>).versionStamp ?? null
          : null,
        metadataKeys: summarizeObjectKeys(retrieval.metadataResponse),
        versionCandidates: collectVersionCandidatePaths(retrieval.metadataResponse),
      }));
      return buildStagedFallbackResult(
        plan,
        action,
        validation,
        `The Leidos ${action.toUpperCase()} request needs the current versionStamp from the filed plan, so RSF kept it staged.`,
        {
          providerPlanId,
          rawExtras: {
            metadataResponse: retrieval.metadataResponse,
            versionStamp: retrieval.versionStamp,
            retrievedAt: retrieval.metadataResponse ? new Date().toISOString() : null,
          },
        },
      );
    }

    const requestUrl = resolveActionPath(config.baseUrl, actionPath, effectivePlan);
    const payloadContext = buildLeidosActionPayload(effectivePlan, action, config);
    const requestBody = payloadContext.params;
    const basic = Buffer.from(`${config.username}:${config.password}`).toString("base64");
    const requestPayloadRecord = Object.fromEntries(requestBody.entries());
    if (payloadContext.payloadSnapshot) {
      console.info(JSON.stringify({
        event: "leidos_payload_built",
        action,
        planId: plan.id,
        providerPlanId: effectivePlan.filingProviderPlanId || null,
        dofInjected: payloadContext.payloadSnapshot.dofInjected,
        dof: payloadContext.payloadSnapshot.dof,
        routeChanged: payloadContext.payloadSnapshot.route.changedForTransmission,
        routeLocal: payloadContext.payloadSnapshot.route.localEnteredRoute,
        routeTransmitted: payloadContext.payloadSnapshot.route.normalizedTransmittedRoute,
        selectedLocalDepartureTime: (payloadContext.payloadSnapshot as Record<string, unknown>).selectedLocalDepartureTime ?? null,
        timezoneUsed: getPlannerTimeZone(effectivePlan),
        computedProviderDepartureInstant: payloadContext.payloadSnapshot.departureInstant,
        savedDisplayTime: (payloadContext.payloadSnapshot as Record<string, unknown>).selectedLocalDepartureTime ?? null,
        remarksPopulated: Boolean(requestPayloadRecord.remarks),
        remarksInput: requestPayloadRecord.remarks ? "[redacted]" : null,
        otherInfoGenerated: requestPayloadRecord.otherInfo || null,
        suppRemarksExtendedPopulated: Boolean(requestPayloadRecord.suppRemarksExtended),
        otherInfoPopulated: Boolean(requestPayloadRecord.otherInfo),
        pilotPhonePopulated: Boolean(requestPayloadRecord.pilotPhone),
        aircraftHomeBasePopulated: Boolean(requestPayloadRecord.aircraftHomeBase),
        payload: redactPayloadForLog(payloadContext.payloadSnapshot.transmittedFields),
      }));
    }
    console.info(JSON.stringify({
      event: "leidos_payload_sent",
      action,
      planId: plan.id,
      providerPlanId: effectivePlan.filingProviderPlanId || null,
      requestUrl,
    }));
    let response: Response;
    try {
      response = await fetchLeidosUrl(requestUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": config.userAgent,
        },
        body: requestBody.toString(),
      });
    } catch (error: any) {
      const message = String(error?.message || "Network request failed.");
      const reason = isLeidosTimeoutLikeError(error)
        ? `Leidos did not answer the ${action.toUpperCase()} request before RSF's provider timeout, so RSF kept it staged. Wait a few minutes, then try again.`
        : `RSF could not reach Leidos for the ${action.toUpperCase()} request (${message}), so RSF kept it staged instead of dropping it.`;
      return buildStagedFallbackResult(
        plan,
        action,
        validation,
        reason,
        {
          providerPlanId: plan.filingProviderPlanId || null,
          payloadSnapshot: payloadContext.payloadSnapshot,
          rawExtras: {
            requestUrl,
            requestPayload: requestPayloadRecord,
            providerError: message,
            providerTimeout: isLeidosTimeoutLikeError(error),
          },
        },
      );
    }

    const parsedResponse = await parseProviderResponse(response);
    if (response.status >= 300 && response.status < 400) {
      const redirectLocation = response.headers.get("location");
      throw new Error(
        `Leidos ${action.toUpperCase()} request was redirected instead of returning a REST response` +
        `${redirectLocation ? ` (Location: ${redirectLocation})` : ""}. ` +
        "This usually means the REST endpoint path or account authorization is not set up correctly."
      );
    }
    if (typeof parsedResponse.text === "string" && looksLikeHtml(parsedResponse.text)) {
      const responseDetail = summarizeProviderError(parsedResponse, response);
      throw new Error(`Leidos ${action.toUpperCase()} request returned HTML instead of a REST response${responseDetail ? `: ${responseDetail}` : ""}`);
    }
    if (!response.ok) {
      const responseDetail = summarizeProviderError(parsedResponse, response);
      throw new Error(`Leidos ${action.toUpperCase()} request failed with status ${response.status}${responseDetail ? `: ${responseDetail}` : ""}`);
    }

    const responseMessages = extractLeidosResponseMessages(parsedResponse);
    const providerReturnStatus =
      typeof parsedResponse.returnStatus === "boolean" ? parsedResponse.returnStatus : null;

    if (providerReturnStatus === false) {
      const details = responseMessages.length > 0
        ? responseMessages.join(" | ")
        : "Leidos did not return a detailed provider message.";
      console.info(JSON.stringify({
        event: "leidos_action_rejected",
        action,
        planId: plan.id,
        providerPlanId: plan.filingProviderPlanId || null,
        responseMessages,
        returnStatus: providerReturnStatus,
      }));
      throw new Error(`Leidos returned an unsuccessful ${action.toUpperCase()} response: ${details}`);
    }

    const returnedProviderPlanId = extractFilingProviderPlanId(parsedResponse);
    const providerPlanId =
      returnedProviderPlanId ||
      plan.filingProviderPlanId ||
      buildProviderPlanId(plan, action);
    let versionStamp = extractFilingVersionStamp(parsedResponse);
    let metadataResponse: Record<string, unknown> | null = null;

    if (!versionStamp && providerPlanId && (action === "file" || action === "amend" || action === "activate")) {
      const retrieval = await retrieveLeidosPlanMetadataWithVersionStamp(providerPlanId, config);
      metadataResponse = retrieval.metadataResponse;
      versionStamp = retrieval.versionStamp || extractFilingVersionStamp(metadataResponse);
    }

    if (!versionStamp) {
      console.info(JSON.stringify({
        event: "leidos_live_action_missing_version_stamp",
        action,
        providerPlanId,
        retrievePath: config.retrievePath,
        responseMessages,
        returnStatus: providerReturnStatus,
        responseKeys: summarizeObjectKeys(parsedResponse),
        metadataKeys: summarizeObjectKeys(metadataResponse),
        responseProviderPlanIdCandidates: collectProviderPlanIdCandidatePaths(parsedResponse),
        metadataProviderPlanIdCandidates: collectProviderPlanIdCandidatePaths(metadataResponse),
        responseVersionCandidates: collectVersionCandidatePaths(parsedResponse),
        metadataVersionCandidates: collectVersionCandidatePaths(metadataResponse),
      }));
    }

    if (action === "file" && !returnedProviderPlanId) {
      console.info(JSON.stringify({
        event: "leidos_file_missing_provider_plan_id",
        action,
        providerPlanId,
        responseKeys: summarizeObjectKeys(parsedResponse),
        responseProviderPlanIdCandidates: collectProviderPlanIdCandidatePaths(parsedResponse),
        responseMessages,
        returnStatus: providerReturnStatus,
      }));
      return buildStagedFallbackResult(
        plan,
        action,
        validation,
        responseMessages.length > 0
          ? `Leidos accepted the FILE response over HTTP but did not return a usable flightIdentifier: ${responseMessages.join(" | ")}`
          : "Leidos accepted the FILE response over HTTP but did not return a usable flightIdentifier, so RSF kept the record staged.",
        {
          providerPlanId: null,
          payloadSnapshot: payloadContext.payloadSnapshot,
          providerMessages: buildProviderMessages({
            action,
            providerPlanId: null,
            response: parsedResponse,
            source: "provider",
          }),
          rawExtras: {
            requestUrl,
            requestPayload: requestPayloadRecord,
            response: parsedResponse,
            responseMessages,
            returnStatus: providerReturnStatus,
          },
        },
      );
    }

    const providerSnapshot = buildProviderSnapshot({
      providerPlanId,
      versionStamp,
      payloadSnapshot: payloadContext.payloadSnapshot,
      response: parsedResponse,
      metadataResponse,
      syncedAt: new Date().toISOString(),
    });
    const providerMessages = buildProviderMessages({
      action,
      providerPlanId,
      response: parsedResponse,
      metadataResponse,
      source: "provider",
    });
    console.info(JSON.stringify({
      event: "leidos_response_received",
      action,
      planId: plan.id,
      providerPlanId,
      versionStamp,
      providerStatus: providerSnapshot.providerStatus,
      artccState: providerSnapshot.artccState,
      routeProvider: providerSnapshot.route.providerRoute,
      routeChangedByProvider: providerSnapshot.route.changedByProvider,
      notices: providerSnapshot.notices,
    }));

    return {
      live: true,
      provider: "Leidos Flight Service",
      action,
      accepted: true,
      message: getLifecycleMessage(action),
      nextStatus: getLiveNextStatus(action),
      warnings: validation.warnings,
      providerUrl: requestUrl,
      providerPlanId,
      payloadSnapshot: payloadContext.payloadSnapshot,
      providerSnapshot,
      providerMessages,
      raw: {
        requestUrl,
        requestPayload: requestPayloadRecord,
        providerPlanId,
        versionStamp,
        metadataResponse,
        response: parsedResponse,
      },
    };
  }
}

export const flightPlanFilingProvider = new LeidosFlightPlanFilingProvider();
