import crypto from "crypto";
import { isFlightPlanCloseOverdue } from "@shared/flight-plan-lifecycle";
import { extractFilingProviderPlanId, extractFilingVersionStamp } from "@shared/flight-plan-filing";
import type { FlightPlan, FlightPlanFilingAction, FlightPlanFilingStatus } from "@shared/schema";

const LAB_REST_BASE_URL = "https://ffspelabs.leidos.com/Website2/rest/";
const PRODUCTION_REST_BASE_URL = "https://www.lmfsweb.afss.com/Website/rest/";
const DEFAULT_USER_AGENT = "ReadySetFly Flight Service Interface";

type LeidosEnvironment = "lab" | "production";

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

const normalizeFlightRules = (value?: string | null) => (value || "VFR").toUpperCase();

const normalizePath = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return trimmed.replace(/^\/+/, "");
};

const boolFromEnv = (value?: string | null) => ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());

const getLeidosFlightServiceConfig = (): LeidosFlightServiceConfig => {
  const environment = String(process.env.LEIDOS_FLIGHT_SERVICE_ENV || "lab").trim().toLowerCase() === "production"
    ? "production"
    : "lab";

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
      return "RSF submitted the flight plan to Leidos Flight Service.";
    case "amend":
      return "RSF submitted the amended flight plan to Leidos Flight Service.";
    case "activate":
      return "RSF submitted the VFR activation request to Leidos Flight Service.";
    case "cancel":
      return "RSF submitted the cancellation request to Leidos Flight Service.";
    case "close":
      return "RSF submitted the VFR close request to Leidos Flight Service.";
    default:
      return "RSF submitted the request to Leidos Flight Service.";
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
  params.append("altitudeTypeA", String(roundedAltitude));
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

  const codedMessages = Array.isArray(parsedResponse.returnCodedMessage)
    ? parsedResponse.returnCodedMessage.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  if (codedMessages.length > 0) {
    return truncateText(codedMessages.join(" | "));
  }

  const plainMessages = Array.isArray(parsedResponse.returnMessage)
    ? parsedResponse.returnMessage.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
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

const buildLeidosActionPayload = (plan: FlightPlan, action: FlightPlanFilingAction, config: LeidosFlightServiceConfig) => {
  const params = new URLSearchParams();

  const append = (key: string, value: unknown) => {
    if (value === null || value === undefined) return;
    const stringValue = String(value).trim();
    if (!stringValue) return;
    params.append(key, stringValue);
  };

  append("includeCodedMessages", "true");

  if (action === "file" || action === "amend") {
    append("type", "ICAO");
    append("flightRules", normalizeFlightRules(plan.filingFlightRules));
    append("aircraftIdentifier", plan.tailNumber);
    append("departure", plan.departure);
    append("destination", plan.destination);
    append("altDestination1", plan.alternate);
    append("departureInstant", formatDepartureInstant(plan.plannedDepartureAt));
    append("flightDuration", minutesToIsoDuration(plan.filingEstimatedEnrouteMinutes));
    append("speedKnots", plan.filingTrueAirspeedKtas);
    append("aircraftType", plan.aircraftType);
    append("wakeTurbulence", plan.filingWakeTurbulence || config.wakeTurbulence);
    append("aircraftEquipment", plan.filingEquipment);
    append("route", plan.route || "DCT");
    append("remarks", plan.filingRemarks || plan.notes);
    append("fuelOnBoard", minutesToIsoDuration(plan.filingEnduranceMinutes));
    append("pilotData", plan.filingPilotName);
    append("peopleOnBoardExtended", plan.filingSoulsOnBoard);
    append("aircraftColor", plan.filingAircraftColor);
    append("typeOfFlight", plan.filingTypeOfFlight || config.typeOfFlight);
    append("surveillanceEquipment", plan.filingSurveillanceEquipment || config.surveillanceEquipment);
    append("pilotInCommandExtended", plan.filingPilotName);
    append("suppRemarksExtended", plan.filingRemarks || plan.notes);
    append("otherInfo", plan.filingOtherInfo || config.otherInfo);
    appendLeidosAltitudeFields(params, plan.filingPlannedAltitudeFt);
    if (action === "amend") {
      append("versionStamp", extractVersionStamp(plan));
    }
    return params;
  }

  if (action === "activate") {
    append("actualDepartureInstant", formatDepartureInstant(plan.plannedDepartureAt) || new Date().toISOString());
    append("versionStamp", extractVersionStamp(plan));
    return params;
  }

  return params;
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
    response = await fetch(url.toString(), {
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
  const delaysMs = [0, 350, 1000, 2200];
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
    response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: "application/json, text/plain, */*",
        "User-Agent": config.userAgent,
      },
    });
  } catch (error: any) {
    const code = String(error?.cause?.code || error?.code || "");
    const message = String(error?.message || "");
    if (code === "UND_ERR_CONNECT_TIMEOUT" || /connect timeout|timed out|fetch failed/i.test(message)) {
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

  if (!plan.departure) errors.push("Departure airport is required.");
  if (!plan.destination) errors.push("Destination airport is required.");
  if (!plan.tailNumber) errors.push("Aircraft ID / tail number is required.");
  if (!plan.aircraftType) errors.push("Aircraft type is required.");
  if ((action === "file" || action === "amend") && !plan.filingTrueAirspeedKtas) {
    errors.push("Cruise speed is required before sending this filing action to Leidos.");
  }
  if ((action === "file" || action === "amend") && !plan.filingPlannedAltitudeFt) {
    errors.push("Planned altitude is required before sending this filing action to Leidos.");
  }

  if ((action === "file" || action === "amend" || action === "activate") && !plan.plannedDepartureAt) {
    errors.push("Planned departure time is required before staging this action.");
  }

  if (rules === "IFR" && !plan.route) {
    errors.push("IFR flight plans require a route before staging.");
  }

  if ((action === "activate" || action === "close") && rules !== "VFR") {
    errors.push(`${action === "activate" ? "Activation" : "Closure"} is only available for VFR flight plans.`);
  }

  if (action !== "file" && !plan.filingProviderPlanId) {
    errors.push("Stage or file the plan first so a provider plan ID exists before using this action.");
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
    errors.push("Only a filed flight plan in the PROPOSED state can be cancelled through Leidos.");
  }

  if (action === "activate" && lifecycleStatus !== "filed") {
    errors.push("Only a filed VFR plan in the PROPOSED state can be activated.");
  }

  if (action === "close" && lifecycleStatus !== "activated") {
    errors.push("Only an active VFR flight plan can be closed.");
  }

  if (action === "close" && isFlightPlanCloseOverdue(plan.plannedArrivalAt)) {
    errors.push("This VFR flight plan appears overdue. Leidos requires closeDestinationInfo for overdue closes, and RSF does not collect that field yet.");
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

  if (!plan.route && rules === "VFR") {
    warnings.push("VFR filing can proceed direct, but adding route detail improves the handoff packet.");
  }

  if (!plan.filingRemarks && !plan.notes) {
    warnings.push("No filing remarks or notes are attached to this plan.");
  }

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
        metadataKeys: summarizeObjectKeys(retrieval.metadataResponse),
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
    const requestBody = buildLeidosActionPayload(effectivePlan, action, config);
    const basic = Buffer.from(`${config.username}:${config.password}`).toString("base64");
    let response: Response;
    try {
      response = await fetch(requestUrl, {
        method: "POST",
        redirect: "manual",
        headers: {
          Authorization: `Basic ${basic}`,
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": config.userAgent,
        },
        body: requestBody.toString(),
      });
    } catch (error: any) {
      const message = String(error?.message || "");
      const causeCode = String(error?.cause?.code || "");
      const causeMessage = String(error?.cause?.message || "");
      const timeoutLike =
        error?.name === "TimeoutError" ||
        causeCode === "UND_ERR_CONNECT_TIMEOUT" ||
        /connect timeout|timed out|fetch failed/i.test(message) ||
        /connect timeout|timed out/i.test(causeMessage);

      if (timeoutLike) {
        throw new Error(
          `Leidos ${action.toUpperCase()} request timed out before Flight Service responded. ` +
          "Leidos is taking longer than usual to respond. Wait a few minutes, then try again."
        );
      }

      throw new Error(
        `Leidos ${action.toUpperCase()} request failed before Flight Service responded. ` +
        `${message || "Network request failed."}`
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

    const providerPlanId =
      extractFilingProviderPlanId(parsedResponse) ||
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
        responseKeys: summarizeObjectKeys(parsedResponse),
        metadataKeys: summarizeObjectKeys(metadataResponse),
      }));
    }

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
      raw: {
        requestUrl,
        requestPayload: Object.fromEntries(requestBody.entries()),
        providerPlanId,
        versionStamp,
        metadataResponse,
        response: parsedResponse,
      },
    };
  }
}

export const flightPlanFilingProvider = new LeidosFlightPlanFilingProvider();
