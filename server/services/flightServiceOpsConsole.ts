import type { FlightPlan, User } from "@shared/schema";

const TERMINAL_STATUSES = new Set(["closed", "cancelled", "canceled", "completed", "expired"]);
const SENSITIVE_HISTORY_KEYS = new Set([
  "raw",
  "providerRaw",
  "request",
  "response",
  "payload",
  "payloadSnapshot",
  "transmittedFields",
  "pilotData",
  "pilotInCommandExtended",
  "pilotPhone",
  "suppRemarksExtended",
]);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];

const iso = (value: Date | string | null | undefined) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const valueOrNull = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

export const formatFlightServiceOpsDisplayValue = (value: unknown) => valueOrNull(value) || "Not available";

const statusOf = (plan: FlightPlan) => String(plan.filingStatus || "draft").trim().toLowerCase();

const latestVersionStamp = (plan: FlightPlan) => {
  const snapshot = asRecord(plan.filingProviderSnapshot);
  const snapshotVersion = valueOrNull(snapshot.versionStamp);
  if (snapshotVersion) return snapshotVersion;

  const history = asArray(plan.filingActionHistory).slice().reverse();
  for (const entry of history) {
    const direct = valueOrNull(entry.versionStamp);
    if (direct) return direct;
    const providerPlanVersion = valueOrNull(asRecord(entry.providerResult).versionStamp);
    if (providerPlanVersion) return providerPlanVersion;
  }

  const raw = asRecord(plan.filingRaw);
  return valueOrNull(raw.versionStamp);
};

const latestProviderStatus = (plan: FlightPlan) => {
  const snapshot = asRecord(plan.filingProviderSnapshot);
  return (
    valueOrNull(snapshot.providerLifecycleStatus) ||
    valueOrNull(snapshot.lifecycleStatus) ||
    valueOrNull(snapshot.providerStatus)
  );
};

const latestProviderFlightState = (plan: FlightPlan) => {
  const snapshot = asRecord(plan.filingProviderSnapshot);
  return valueOrNull(snapshot.providerFlightState) || valueOrNull(snapshot.providerStatus);
};

const latestKnownArtccState = (plan: FlightPlan) => {
  const snapshot = asRecord(plan.filingProviderSnapshot);
  return valueOrNull(snapshot.lastKnownArtccState) || valueOrNull(snapshot.artccState);
};

const providerRetrievalState = (plan: FlightPlan) => {
  const snapshot = asRecord(plan.filingProviderSnapshot);
  return valueOrNull(snapshot.providerRetrievalState) || "not_attempted";
};

const sanitizeOperationalHistoryEntry = (entry: Record<string, unknown>) => {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (SENSITIVE_HISTORY_KEYS.has(key)) continue;
    if (value && typeof value === "object") {
      if (Array.isArray(value)) {
        safe[key] = value
          .filter((item) => !item || typeof item !== "object")
          .slice(0, 10);
      } else {
        const nested = asRecord(value);
        const nestedSafe: Record<string, unknown> = {};
        for (const [nestedKey, nestedValue] of Object.entries(nested)) {
          if (!SENSITIVE_HISTORY_KEYS.has(nestedKey) && typeof nestedValue !== "object") {
            nestedSafe[nestedKey] = nestedValue;
          }
        }
        if (Object.keys(nestedSafe).length > 0) safe[key] = nestedSafe;
      }
    } else {
      safe[key] = value;
    }
  }
  return safe;
};

const timelineEvent = (
  timestamp: string | null,
  type: string,
  label: string,
  details: Record<string, unknown> = {},
) => ({ timestamp, type, label, details });

export const classifyFlightServiceOperationalState = (plan: FlightPlan, now = new Date()) => {
  const status = statusOf(plan);
  if (TERMINAL_STATUSES.has(status)) return status === "canceled" ? "cancelled" : status;
  const arrival = plan.plannedArrivalAt ? new Date(plan.plannedArrivalAt) : null;
  if (arrival && !Number.isNaN(arrival.getTime()) && arrival.getTime() < now.getTime() && ["filed", "activated"].includes(status)) {
    return "overdue-like";
  }
  if (["filed", "activated", "staged", "pending"].includes(status)) return "open";
  return "inactive";
};

export const logFlightServiceOpsAuditEvent = (
  event: "flight_service_ops_search" | "flight_service_ops_view" | "flight_service_ops_sar_report",
  payload: {
    adminUserId?: string | null;
    searchType?: string | null;
    selectedPlanId?: string | null;
    resultCount?: number | null;
  },
) => {
  console.log(JSON.stringify({
    event,
    adminUserId: payload.adminUserId || null,
    searchType: payload.searchType || null,
    selectedPlanId: payload.selectedPlanId || null,
    resultCount: payload.resultCount ?? null,
    timestamp: new Date().toISOString(),
  }));
};

export const buildFlightServiceOpsSearchResult = (plan: FlightPlan, user?: Pick<User, "email"> | null) => ({
  id: plan.id,
  tailNumber: plan.tailNumber || null,
  pilotName: plan.filingPilotName || null,
  pilotEmail: user?.email || null,
  departure: plan.departure,
  destination: plan.destination,
  etdZulu: iso(plan.plannedDepartureAt),
  etdLocal: iso(plan.plannedDepartureAt),
  currentRsfStatus: plan.filingStatus,
  operationalState: classifyFlightServiceOperationalState(plan),
  providerPlanId: plan.filingProviderPlanId || null,
  lastProviderSync: iso(plan.filingLastProviderSyncAt),
});

export const buildFlightServiceOpsDetail = (plan: FlightPlan, user?: Pick<User, "email" | "firstName" | "lastName" | "phone" | "homeBase"> | null) => {
  const history = asArray(plan.filingActionHistory);
  const messages = asArray(plan.filingProviderMessages).map((message) => ({
    action: valueOrNull(message.action),
    result: valueOrNull(message.result || message.status),
    message: valueOrNull(message.message || message.text || message.notice),
    code: valueOrNull(message.code),
    providerPlanId: valueOrNull(message.providerPlanId) || plan.filingProviderPlanId || null,
    versionStamp: valueOrNull(message.versionStamp),
    timestamp: valueOrNull(message.timestamp || message.createdAt),
  }));
  const snapshot = asRecord(plan.filingProviderSnapshot);
  const routeSnapshot = asRecord(snapshot.route);
  const pbnMatch = String(plan.filingOtherInfo || "").match(/(?:^|\s)PBN\/([^\s]+)/);

  const timeline = [
    timelineEvent(iso(plan.createdAt), "created", "Planner created"),
    plan.filedAt ? timelineEvent(iso(plan.filedAt), "filed", "FILE accepted", { providerPlanId: plan.filingProviderPlanId || null }) : null,
    plan.activatedAt ? timelineEvent(iso(plan.activatedAt), "activated", "ACTIVATE accepted") : null,
    plan.filingLastProviderSyncAt ? timelineEvent(iso(plan.filingLastProviderSyncAt), "sync", "Provider sync pulled", { providerStatus: latestProviderStatus(plan) }) : null,
    ...history.map((entry) => timelineEvent(
      valueOrNull(entry.stagedAt || entry.timestamp || entry.createdAt),
      String(entry.action || "provider_action"),
      `${String(entry.action || "Provider action").toUpperCase()} ${entry.live === false ? "staged" : "submitted"}`,
      sanitizeOperationalHistoryEntry(entry),
    )),
    snapshot.providerPendingReview ? timelineEvent(iso(plan.updatedAt), "provider_review", "Provider change pending review") : null,
    plan.closedAt ? timelineEvent(iso(plan.closedAt), "closed", "CLOSE accepted") : null,
    plan.cancelledAt ? timelineEvent(iso(plan.cancelledAt), "cancelled", "CANCEL accepted") : null,
  ]
    .filter((event): event is ReturnType<typeof timelineEvent> => Boolean(event))
    .sort((a, b) => String((a as any).timestamp || "").localeCompare(String((b as any).timestamp || "")));

  return {
    planId: plan.id,
    generatedAt: new Date().toISOString(),
    retentionNotice: "TODO: Confirm Flight Service operational support retention period with business/legal before changing retained data.",
    status: {
      currentRsfStatus: plan.filingStatus,
      currentProviderStatus: latestProviderStatus(plan),
      providerLifecycle: latestProviderStatus(plan),
      providerFlightState: latestProviderFlightState(plan),
      lastKnownArtccState: latestKnownArtccState(plan),
      providerRetrievalState: providerRetrievalState(plan),
      operationalState: classifyFlightServiceOperationalState(plan),
      filed: Boolean(plan.filedAt || plan.filingProviderPlanId),
      active: statusOf(plan) === "activated",
      closed: statusOf(plan) === "closed",
      cancelled: ["cancelled", "canceled"].includes(statusOf(plan)),
      pendingReview: Boolean(snapshot.providerPendingReview),
      lastSyncTime: iso(plan.filingLastProviderSyncAt),
      providerPlanId: plan.filingProviderPlanId || null,
      versionStamp: latestVersionStamp(plan),
    },
    summary: {
      tailNumber: plan.tailNumber || null,
      aircraftType: plan.aircraftType || null,
      aircraftColor: plan.filingAircraftColor || null,
      fuelEnduranceMinutes: plan.filingEnduranceMinutes || null,
      personsOnBoard: plan.filingSoulsOnBoard || null,
      wakeTurbulence: plan.filingWakeTurbulence || null,
      equipment: plan.filingEquipment || null,
      surveillance: plan.filingSurveillanceEquipment || null,
      pbn: pbnMatch ? valueOrNull(pbnMatch[1]) : null,
      departure: plan.departure,
      destination: plan.destination,
      alternate: plan.alternate || null,
      route: plan.route || null,
      altitude: plan.filingPlannedAltitudeFt || null,
      speed: plan.filingTrueAirspeedKtas || null,
      flightRules: plan.filingFlightRules || null,
      typeOfFlight: plan.filingTypeOfFlight || null,
      otherInfo: plan.filingOtherInfo || null,
      supplementalRemarks: plan.filingRemarks || null,
      pilotPhone: plan.filingPilotPhone || user?.phone || null,
      aircraftHomeBase: plan.filingAircraftHomeBase || user?.homeBase || null,
      etdZulu: iso(plan.plannedDepartureAt),
      etaZulu: iso(plan.plannedArrivalAt),
    },
    pilot: {
      name: plan.filingPilotName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null,
      phone: plan.filingPilotPhone || user?.phone || null,
      email: user?.email || null,
      secondaryEmergencyContact: null,
    },
    timeline,
    amendmentHistory: history.map(sanitizeOperationalHistoryEntry),
    providerCommunication: {
      messages,
      providerRoute: valueOrNull(routeSnapshot.providerRoute),
      routeChangedByProvider: routeSnapshot.changedByProvider === true,
      retrievalStatus: providerRetrievalState(plan),
      providerLifecycle: latestProviderStatus(plan),
      providerFlightState: latestProviderFlightState(plan),
      lastKnownArtccState: latestKnownArtccState(plan),
      lastSyncTime: iso(plan.filingLastProviderSyncAt),
    },
    lastKnownRsfActivity: {
      lastLogin: null,
      lastPlannerUpdate: iso(plan.updatedAt),
      lastSavedPlanUpdate: iso(plan.updatedAt),
      lastWeatherBriefingToolActivity: null,
    },
  };
};

export const buildFlightServiceSarReport = (plan: FlightPlan, user?: Pick<User, "email" | "firstName" | "lastName" | "phone" | "homeBase"> | null) => {
  const detail = buildFlightServiceOpsDetail(plan, user);
  return {
    generatedAt: new Date().toISOString(),
    supportContact: "RSF support contact placeholder",
    note: "Generated from RSF records for operational support. Verify against Leidos/provider records before relying on this report.",
    plan: detail,
  };
};
