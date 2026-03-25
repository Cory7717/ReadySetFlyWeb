import crypto from "crypto";
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
  webhookUsername: string | null;
  webhookPassword: string | null;
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
    webhookUsername: String(process.env.LEIDOS_FLIGHT_SERVICE_WEBHOOK_USERNAME || "").trim() || null,
    webhookPassword: String(process.env.LEIDOS_FLIGHT_SERVICE_WEBHOOK_PASSWORD || "").trim() || null,
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

const buildLeidosActionPayload = (plan: FlightPlan, action: FlightPlanFilingAction) => {
  const params = new URLSearchParams();

  const append = (key: string, value: unknown) => {
    if (value === null || value === undefined) return;
    const stringValue = String(value).trim();
    if (!stringValue) return;
    params.append(key, stringValue);
  };

  append("action", action);
  append("planId", plan.id);
  append("providerPlanId", buildProviderPlanId(plan, action));
  append("flightRules", normalizeFlightRules(plan.filingFlightRules));
  append("departure", plan.departure);
  append("destination", plan.destination);
  append("route", plan.route);
  append("alternate", plan.alternate);
  append("plannedDepartureUtc", plan.plannedDepartureAt ? new Date(plan.plannedDepartureAt).toISOString() : null);
  append("plannedArrivalUtc", plan.plannedArrivalAt ? new Date(plan.plannedArrivalAt).toISOString() : null);
  append("aircraftId", plan.tailNumber);
  append("aircraftType", plan.aircraftType);
  append("estimatedEnrouteMinutes", plan.filingEstimatedEnrouteMinutes);
  append("enduranceMinutes", plan.filingEnduranceMinutes);
  append("equipment", plan.filingEquipment);
  append("soulsOnBoard", plan.filingSoulsOnBoard);
  append("aircraftColor", plan.filingAircraftColor);
  append("pilotName", plan.filingPilotName);
  append("remarks", plan.filingRemarks || plan.notes);
  append("fuelOnBoard", plan.fuelOnBoard);
  append("fuelRequired", plan.fuelRequired);

  return params;
};

const joinBaseAndPath = (baseUrl: string, actionPath: string) => (
  actionPath.startsWith("http://") || actionPath.startsWith("https://")
    ? actionPath
    : new URL(actionPath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString()
);

const parseProviderResponse = async (response: Response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await response.json() as Record<string, unknown>;
  }
  const text = await response.text();
  return { text };
};

const buildStagedFallbackResult = (
  plan: FlightPlan,
  action: FlightPlanFilingAction,
  validation: FilingValidationResult,
  reason: string,
): FilingServiceResult => ({
  live: false,
  provider: "Leidos Flight Service",
  action,
  accepted: true,
  message: `RSF staged the ${action.toUpperCase()} request. ${reason}`,
  nextStatus: "staged",
  warnings: validation.warnings,
  providerUrl: getProviderUrl(),
  providerPlanId: buildProviderPlanId(plan, action),
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

  if (!plan.departure) errors.push("Departure airport is required.");
  if (!plan.destination) errors.push("Destination airport is required.");
  if (!plan.tailNumber) errors.push("Aircraft ID / tail number is required.");
  if (!plan.aircraftType) errors.push("Aircraft type is required.");

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

  if (action === "cancel" && ["cancelled", "closed"].includes((plan.filingStatus || "").toLowerCase())) {
    errors.push(`This plan is already ${String(plan.filingStatus).toLowerCase()}.`);
  }

  if (action === "close" && ["draft", "cancelled", "closed"].includes((plan.filingStatus || "").toLowerCase())) {
    errors.push("Only an active or previously filed VFR plan can be closed.");
  }

  if (action === "activate" && ["draft", "cancelled", "closed"].includes((plan.filingStatus || "").toLowerCase())) {
    errors.push("Only a staged or filed VFR plan can be activated.");
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

    const requestUrl = joinBaseAndPath(config.baseUrl, actionPath);
    const requestBody = buildLeidosActionPayload(plan, action);
    const basic = Buffer.from(`${config.username}:${config.password}`).toString("base64");
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": config.userAgent,
      },
      body: requestBody.toString(),
    });

    const parsedResponse = await parseProviderResponse(response);
    if (!response.ok) {
      throw new Error(`Leidos ${action.toUpperCase()} request failed with status ${response.status}`);
    }

    const providerPlanId = String(
      parsedResponse.providerPlanId ||
      parsedResponse.flightPlanId ||
      parsedResponse.planId ||
      parsedResponse.id ||
      plan.filingProviderPlanId ||
      buildProviderPlanId(plan, action),
    );

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
        response: parsedResponse,
      },
    };
  }
}

export const flightPlanFilingProvider = new LeidosFlightPlanFilingProvider();
