import { classifyFiledRouteToken, normalizeRouteText, parseFiledRouteTokens, type FiledRouteTokenKind } from "./flight-plan-route";

export type FilingSeverity = "info" | "success" | "warning" | "error";

export type FilingRouteSnapshot = {
  localEnteredRoute: string | null;
  normalizedTransmittedRoute: string | null;
  providerRoute: string | null;
  changedForTransmission: boolean;
  changedByProvider: boolean;
  normalizationNotes: string[];
};

export type FilingFieldDiff = {
  field: string;
  localValue: string | null;
  transmittedValue: string | null;
  providerValue: string | null;
  changedForTransmission: boolean;
  changedByProvider: boolean;
};

export type FilingPayloadSnapshot = {
  provider: string;
  action: string;
  builtAt: string;
  departureInstant: string | null;
  departureOperationalDate: string | null;
  dof: string | null;
  dofInjected: boolean;
  route: FilingRouteSnapshot;
  otherInfo: string | null;
  transmittedFields: Record<string, string>;
};

export type FilingProviderMessage = {
  id: string;
  timestamp: string;
  severity: FilingSeverity;
  title: string;
  details: string;
  source: "rsf" | "provider" | "sync" | "webhook";
  action?: string | null;
  provider: string;
  providerPlanId?: string | null;
  providerReferenceId?: string | null;
  code?: string | null;
  raw?: unknown;
};

export type FilingProviderSnapshot = {
  provider: string;
  syncedAt: string;
  providerPlanId: string | null;
  providerReferenceId: string | null;
  versionStamp: string | null;
  providerStatus: string | null;
  artccState: string | null;
  artccInfo: string | null;
  beaconCode: string | null;
  route: FilingRouteSnapshot;
  notices: string[];
  timestamps: Record<string, string | null>;
  fieldDiffs: FilingFieldDiff[];
};

const ICAO_ROUTE_VALUE_KINDS = new Set<FiledRouteTokenKind>([
  "airport",
  "fix",
  "navaid",
  "coordinate",
  "unknown",
]);

const ICAO_ROUTE_STRUCTURAL_KINDS = new Set<FiledRouteTokenKind>([
  "airway",
  "procedure",
]);

const normalizeMessageText = (value: string | null | undefined) => {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || null;
};

export const buildFilingEventId = (...parts: Array<string | null | undefined>) =>
  parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(":")
    .replace(/\s+/g, "_")
    .toLowerCase();

export const formatOperationalDateKey = (value: Date | string, timeZone = "UTC") => {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(parsed);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
};

export const formatIcaoDof = (value: Date | string) => {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear() % 100;
  const month = parsed.getUTCMonth() + 1;
  const day = parsed.getUTCDate();
  return `${String(year).padStart(2, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
};

const stripOtherInfoSubfield = (otherInfo: string, prefix: string) =>
  otherInfo.replace(new RegExp(`(?:^|\\s)${prefix}\\/[^\\s]*`, "gi"), " ");

const normalizeOtherInfoSpacing = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim();

export const buildOtherInfoWithDof = ({
  existingOtherInfo,
  plannedDepartureAt,
  operationalTimeZone,
  now = new Date(),
}: {
  existingOtherInfo?: string | null;
  plannedDepartureAt?: Date | string | null;
  operationalTimeZone?: string | null;
  now?: Date;
}) => {
  const baseOtherInfo = normalizeOtherInfoSpacing(String(existingOtherInfo || ""));
  if (!plannedDepartureAt) {
    return {
      otherInfo: baseOtherInfo || null,
      dof: null,
      injected: false,
      reason: "missing_departure_time",
    };
  }

  const departure = plannedDepartureAt instanceof Date ? plannedDepartureAt : new Date(plannedDepartureAt);
  if (Number.isNaN(departure.getTime())) {
    return {
      otherInfo: baseOtherInfo || null,
      dof: null,
      injected: false,
      reason: "invalid_departure_time",
    };
  }

  const timeZone = operationalTimeZone || "UTC";
  const nowKey = formatOperationalDateKey(now, timeZone);
  const departureKey = formatOperationalDateKey(departure, timeZone);
  const dof = formatIcaoDof(departure);
  if (!nowKey || !departureKey || !dof) {
    return {
      otherInfo: baseOtherInfo || null,
      dof: null,
      injected: false,
      reason: "date_key_unavailable",
    };
  }

  const futureDated = departureKey > nowKey;
  const withoutExistingDof = normalizeOtherInfoSpacing(stripOtherInfoSubfield(baseOtherInfo, "DOF"));
  if (!futureDated) {
    return {
      otherInfo: withoutExistingDof || null,
      dof: null,
      injected: false,
      reason: "same_operational_day",
    };
  }

  const merged = normalizeOtherInfoSpacing([withoutExistingDof, `DOF/${dof}`].filter(Boolean).join(" "));
  return {
    otherInfo: merged || `DOF/${dof}`,
    dof,
    injected: true,
    reason: "future_operational_day",
  };
};

const hasMeaningfulRouteToken = (tokenKind: FiledRouteTokenKind) =>
  tokenKind !== "direct" && tokenKind !== "unknown";

export const normalizeRouteForProvider = (input?: string | null) => {
  const localEnteredRoute = normalizeRouteText(String(input || ""));
  if (!localEnteredRoute) {
    return {
      localEnteredRoute: null,
      normalizedRoute: null,
      changed: false,
      notes: [] as string[],
      hasValidToken: false,
    };
  }

  const rawTokens = parseFiledRouteTokens(localEnteredRoute);
  const notes: string[] = [];
  if (!rawTokens.length) {
    return {
      localEnteredRoute,
      normalizedRoute: null,
      changed: false,
      notes: ["Route did not contain any recognizable filing tokens."],
      hasValidToken: false,
    };
  }

  const dedupedTokens = rawTokens.filter((token, index, arr) =>
    !(token.token === "DCT" && arr[index - 1]?.token === "DCT")
  );
  const normalizedTokens: string[] = [];
  let insertedDirect = false;

  const pushDirectIfNeeded = () => {
    if (normalizedTokens[normalizedTokens.length - 1] !== "DCT") {
      normalizedTokens.push("DCT");
      insertedDirect = true;
    }
  };

  for (let index = 0; index < dedupedTokens.length; index += 1) {
    const token = dedupedTokens[index];
    if (token.token === "DCT") {
      pushDirectIfNeeded();
      continue;
    }

    const previous = dedupedTokens[index - 1];
    const next = dedupedTokens[index + 1];
    const isValueToken = ICAO_ROUTE_VALUE_KINDS.has(token.kind);
    const isStructuralToken = ICAO_ROUTE_STRUCTURAL_KINDS.has(token.kind);
    const previousIsValue = previous ? ICAO_ROUTE_VALUE_KINDS.has(previous.kind) : false;
    const nextIsValue = next ? ICAO_ROUTE_VALUE_KINDS.has(next.kind) : false;

    if (
      isValueToken &&
      (index === 0 || previous?.token === "DCT" || previousIsValue)
    ) {
      pushDirectIfNeeded();
    }

    normalizedTokens.push(token.token);

    if (
      isValueToken &&
      (!next || next.token === "DCT" || nextIsValue)
    ) {
      pushDirectIfNeeded();
    }

    if (isStructuralToken && normalizedTokens[normalizedTokens.length - 1] === "DCT") {
      normalizedTokens.pop();
    }
  }

  const normalizedRoute = normalizeRouteText(normalizedTokens.join(" "));
  const hasValidToken = rawTokens.some((token) => hasMeaningfulRouteToken(token.kind));
  if (!hasValidToken) {
    notes.push("Route must contain at least one recognized airport, fix, navaid, airway, or procedure token.");
  }
  if (insertedDirect) {
    notes.push("RSF added DCT segments so the transmitted route is ATC-safe.");
  }
  if (dedupedTokens.length !== rawTokens.length) {
    notes.push("RSF removed duplicate DCT tokens before transmission.");
  }

  return {
    localEnteredRoute,
    normalizedRoute: normalizedRoute || null,
    changed: normalizeRouteText(localEnteredRoute) !== normalizeRouteText(normalizedRoute),
    notes,
    hasValidToken,
  };
};

export const toDisplayString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return normalizeMessageText(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  return null;
};

export const buildFilingFieldDiffs = ({
  localRoute,
  transmittedRoute,
  providerRoute,
  localOtherInfo,
  transmittedOtherInfo,
  providerOtherInfo,
  dof,
}: {
  localRoute?: string | null;
  transmittedRoute?: string | null;
  providerRoute?: string | null;
  localOtherInfo?: string | null;
  transmittedOtherInfo?: string | null;
  providerOtherInfo?: string | null;
  dof?: string | null;
}): FilingFieldDiff[] => {
  const routeLocal = normalizeMessageText(localRoute);
  const routeTransmitted = normalizeMessageText(transmittedRoute);
  const routeProvider = normalizeMessageText(providerRoute);
  const otherInfoLocal = normalizeMessageText(localOtherInfo);
  const otherInfoTransmitted = normalizeMessageText(transmittedOtherInfo);
  const otherInfoProvider = normalizeMessageText(providerOtherInfo);
  const dofLocal = normalizeMessageText(dof);

  return [
    {
      field: "route",
      localValue: routeLocal,
      transmittedValue: routeTransmitted,
      providerValue: routeProvider,
      changedForTransmission: routeLocal !== routeTransmitted,
      changedByProvider: routeTransmitted !== routeProvider && Boolean(routeProvider),
    },
    {
      field: "otherInfo",
      localValue: otherInfoLocal,
      transmittedValue: otherInfoTransmitted,
      providerValue: otherInfoProvider,
      changedForTransmission: otherInfoLocal !== otherInfoTransmitted,
      changedByProvider: otherInfoTransmitted !== otherInfoProvider && Boolean(otherInfoProvider),
    },
    {
      field: "dof",
      localValue: dofLocal,
      transmittedValue: dofLocal,
      providerValue: dofLocal,
      changedForTransmission: Boolean(dofLocal),
      changedByProvider: false,
    },
  ];
};

export const mergeProviderMessages = (
  existing: unknown,
  incoming: FilingProviderMessage[],
  maxEntries = 50,
) => {
  const current = Array.isArray(existing) ? existing.filter(Boolean) as FilingProviderMessage[] : [];
  const merged = [...incoming, ...current];
  const deduped = new Map<string, FilingProviderMessage>();
  for (const entry of merged) {
    const id = entry.id || buildFilingEventId(entry.timestamp, entry.title, entry.details);
    if (!deduped.has(id)) {
      deduped.set(id, { ...entry, id });
    }
  }
  return Array.from(deduped.values())
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, maxEntries);
};
