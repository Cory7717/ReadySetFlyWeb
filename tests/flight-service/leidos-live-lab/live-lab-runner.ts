import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { execSync } from "node:child_process";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { and, eq } from "drizzle-orm";
import type { FlightPlan, FlightPlanFilingAction } from "../../../shared/schema";
import { flightPlans } from "../../../shared/schema";
import { db } from "../../../server/db";
import { storage } from "../../../server/storage";
import { resolveDepartureAirportTimezone } from "../../../shared/airport-timezones";
import {
  buildLeidosActionPayload,
  flightPlanFilingProvider,
  getLeidosFlightServiceDiagnostics,
  syncLeidosPlanMetadata,
  validateLeidosOtherInfoForTransmission,
  validateFlightPlanForAction,
  zonedLocalDateTimeToUtcIso,
} from "../../../server/services/flight-plan-filing/provider";

export type CaseAction = FlightPlanFilingAction;
export type LiveLabTestType = "Positive" | "Negative" | "Lifecycle" | "Cleanup" | "Round Trip";
export type LiveLabSuiteDesignation = "core" | "extended";
export type LiveLabCaseClassification = "positive" | "negative" | "lifecycle" | "time" | "zzzz" | "resilience" | "round-trip";

export type LiveLabCase = {
  seed: number;
  stableId?: string;
  name: string;
  testType: LiveLabTestType;
  suite?: LiveLabSuiteDesignation;
  classification?: LiveLabCaseClassification;
  actions: CaseAction[];
  buildPlan: () => FlightPlan;
  expectedBlockedBeforeLeidos?: boolean;
  expectedFinalState?: string;
  recommendedFix?: string;
  skipReason?: string;
};

export const MAX_CASES = 15;
export const CORE_CERTIFICATION_SUITE_VERSION = "core-15";
export const EXTENDED_EDGE_PACK_VERSION = "extended-edge-pack-2026-07";
const EXPECTED_TEST_ACCOUNT_EMAIL = "generalmanager.atx@gmail.com";
const CERT_REMARK = "RSF LEIDOS LAB CERTIFICATION TEST - DO NOT TREAT AS LIVE OPERATIONAL FLIGHT";
const providerSafeRmk = (seed: number, suffix = "") => `RMK/RSF LAB TEST SEED ${seed}${suffix ? ` ${suffix}` : ""}`;
const DETERMINISTIC_DEPARTURE_BASE_UTC = Date.parse("2026-07-15T15:00:00.000Z");

const getDeterministicCaseDeparture = (seed: number) => {
  const instant = new Date(DETERMINISTIC_DEPARTURE_BASE_UTC + (seed - 1) * 10 * 60_000);
  return {
    instant,
    arrival: new Date(instant.getTime() + 60 * 60_000),
    local: `2026-07-15T${String(10 + Math.floor((seed - 1) / 6)).padStart(2, "0")}:${String(((seed - 1) % 6) * 10).padStart(2, "0")}`,
  };
};

const arg = (name: string, fallback = "") => {
  const flag = `--${name}`;
  if (process.argv.includes(flag) && !process.argv[process.argv.indexOf(flag) + 1]?.startsWith("--")) {
    return process.argv[process.argv.indexOf(flag) + 1];
  }
  const prefixed = process.argv.find((value) => value.startsWith(`${flag}=`));
  return prefixed ? prefixed.slice(flag.length + 1) : fallback;
};

const hasFlag = (name: string) => process.argv.includes(`--${name}`);
const KNOWN_FLAGS = new Set([
  "dry-run",
  "confirm-leidos-lab",
  "limit",
  "delay-minutes",
  "start-case",
  "end-case",
  "only-cases",
  "static-departure-time",
  "skip-cleanup",
  "cleanup-only",
  "replay",
  "suite",
]);

const validateCliArgs = () => {
  const unknown = process.argv
    .slice(2)
    .filter((value) => value.startsWith("--"))
    .map((value) => value.replace(/^--/, "").split("=")[0])
    .filter((name) => !KNOWN_FLAGS.has(name));
  if (unknown.length) {
    const suggestions = unknown.includes("comfirm-leidos-lab")
      ? " Did you mean --confirm-leidos-lab?"
      : "";
    throw new Error(`Unknown option(s): ${unknown.map((name) => `--${name}`).join(", ")}.${suggestions}`);
  }
};
export const boolEnv = (value?: string | null) => /^(true|1|yes|on)$/i.test(String(value || "").trim());
const numberArg = (name: string, fallback: string) => {
  const raw = arg(name, fallback);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number(fallback);
};
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
const CERTIFICATION_SUITE_VERSION = "2026.07.16-post-run-cleanup-evidence";
const FLIGHT_SERVICE_MODULE_VERSION = "flight-service-filing-v1";
const LIFECYCLE_DYNAMIC_TIME_OFFSET_MINUTES = 15;
const FILE_DYNAMIC_TIME_BASE_OFFSET_MINUTES = 60;
const CASE_DYNAMIC_TIME_SPACING_MINUTES = 10;
const ACTIVATION_WINDOW_MINUTES = 30;
const DEFAULT_TERMINAL_EVIDENCE_POLL_TIMEOUT_MS = 45_000;
const DEFAULT_TERMINAL_EVIDENCE_POLL_INTERVAL_MS = 3_000;

const pad2 = (value: string | number) => String(value).padStart(2, "0");

const formatLocalDateTimeForZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value || "";
  const hour = part("hour") === "24" ? "00" : part("hour");
  return `${part("year")}-${pad2(part("month"))}-${pad2(part("day"))}T${pad2(hour)}:${pad2(part("minute"))}`;
};

const formatProviderZulu = (date: Date) =>
  `${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}Z`;

const getPlannerStateRecord = (plan: FlightPlan) =>
  plan.plannerState && typeof plan.plannerState === "object" && !Array.isArray(plan.plannerState)
    ? plan.plannerState as Record<string, any>
    : {};

const getDepartureTimeZone = (plan: FlightPlan) => {
  const plannerState = getPlannerStateRecord(plan);
  const planningReferenceDepartureAirport = String(plannerState.planningReferenceDepartureAirport || "").trim().toUpperCase();
  const resolution = resolveDepartureAirportTimezone({
    departureAirport: { icao: plan.departure || null },
    planningReferenceDepartureAirport: planningReferenceDepartureAirport
      ? { icao: planningReferenceDepartureAirport }
      : null,
  });
  if (!resolution.timezone) {
    throw new Error(`Unable to resolve departure timezone for ${plan.departure || "unknown departure"}${planningReferenceDepartureAirport ? ` using planning reference ${planningReferenceDepartureAirport}` : ""}.`);
  }
  return resolution.timezone;
};

const lifecycleUsesActivationWindow = (testCase: LiveLabCase) =>
  testCase.actions.includes("activate") || testCase.actions.includes("close");

const isTerminalAction = (action: CaseAction) => action === "cancel" || action === "close";

const expectedTerminalStatusForAction = (action: CaseAction) =>
  action === "close" ? "closed" : action === "cancel" ? "cancelled" : null;

export const isAmbiguousProviderTerminalRejection = (action: CaseAction | FlightPlanFilingAction | "verify" | "none", value: unknown) => {
  const text = String(value || "").trim();
  if (!text || !["cancel", "close"].includes(String(action))) return false;
  return /Webservice\.Cannot|CannotCancel|CannotClose|not in the PROPOSED state|could not be cancelled|could not be closed/i.test(text);
};

const isTerminalProviderStatus = (value: unknown, action: CaseAction) => {
  const status = String(value || "").trim().toLowerCase();
  if (!status) return null;
  if (action === "close") return status === "closed" || status === "close";
  if (action === "cancel") return status === "cancelled" || status === "canceled" || status === "cancel";
  return false;
};

type LifecycleEvidenceKind =
  | "explicit_provider_webhook"
  | "explicit_provider_retrieve"
  | "accepted_provider_action"
  | "local_derived_state"
  | "missing_provider_state"
  | "conflicting_provider_evidence";

const explicitProviderLifecycleSources = new Set(["leidos_webhook", "provider_retrieve", "provider_response"]);
const terminalLifecycleStatuses = new Set(["cancelled", "canceled", "closed"]);
const nonterminalLifecycleStatuses = new Set(["unknown", "proposed", "filed", "active", "activated", "amended"]);

const normalizeLifecycleStatus = (value: unknown) => {
  const status = String(value || "").trim().toLowerCase();
  if (status === "canceled") return "cancelled";
  if (status === "active") return "activated";
  return status || null;
};

const compareVersionStamp = (left: unknown, right: unknown) => {
  const a = String(left || "").trim();
  const b = String(right || "").trim();
  if (!a || !b) return 0;
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    if (a.length !== b.length) return a.length > b.length ? 1 : -1;
    return a === b ? 0 : a > b ? 1 : -1;
  }
  return a.localeCompare(b);
};

export const classifyLifecycleEvidence = (
  snapshotInput: unknown,
  expectedTerminalStatus?: string | null,
) => {
  const snapshot = snapshotInput && typeof snapshotInput === "object" && !Array.isArray(snapshotInput)
    ? snapshotInput as Record<string, any>
    : {};
  const lifecycle = String(snapshot.providerLifecycleStatus || "").trim().toLowerCase() || null;
  const source = String(snapshot.providerLifecycleSource || "").trim() || null;
  const reason = String(snapshot.providerLifecycleReason || "").trim() || null;
  const rawProviderState = String(snapshot.providerFlightState || snapshot.providerStatus || "").trim() || null;
  const hasExplicitProviderEvidence = Boolean(
    lifecycle &&
    lifecycle !== "unknown" &&
    explicitProviderLifecycleSources.has(source || "") &&
    (rawProviderState || (reason && /^explicit_provider_/.test(reason)))
  );
  const expected = String(expectedTerminalStatus || "").trim().toLowerCase();
  const conflictsWithExpected = Boolean(hasExplicitProviderEvidence && expected && lifecycle !== expected);
  const kind: LifecycleEvidenceKind = conflictsWithExpected
    ? "conflicting_provider_evidence"
    : hasExplicitProviderEvidence && source === "leidos_webhook"
      ? "explicit_provider_webhook"
      : hasExplicitProviderEvidence && source === "provider_retrieve"
        ? "explicit_provider_retrieve"
        : hasExplicitProviderEvidence
          ? "accepted_provider_action"
          : lifecycle && lifecycle !== "unknown"
            ? "local_derived_state"
            : "missing_provider_state";

  return {
    kind,
    lifecycle: normalizeLifecycleStatus(lifecycle),
    source,
    reason,
    rawProviderState,
    explicitLifecycleValue: hasExplicitProviderEvidence ? normalizeLifecycleStatus(lifecycle) : null,
    hasExplicitProviderEvidence,
    conflictsWithExpected,
    versionStamp: String(snapshot.versionStamp || snapshot.providerVersionStamp || "").trim() || null,
    eventHash: String(snapshot.providerEventHash || snapshot.eventHash || snapshot.lastWebhookEventHash || "").trim() || null,
    providerEventTimestamp: String(snapshot.providerEventTimestamp || snapshot.messageDateTime || "").trim() || null,
    rsfReceiptTimestamp: String(snapshot.rsfReceiptTimestamp || snapshot.lastProviderUpdateAt || "").trim() || null,
    webhookProcessingTimestamp: String(snapshot.webhookProcessingTimestamp || snapshot.lastProviderUpdateAt || "").trim() || null,
    evidenceTime: String(snapshot.lastProviderUpdateAt || snapshot.lastProviderDataAt || snapshot.lastProviderRetrieveAt || snapshot.syncedAt || "").trim() || null,
    latestRetrieveIncludedLifecycle: Boolean(
      source === "provider_retrieve" &&
      lifecycle &&
      lifecycle !== "unknown" &&
      (rawProviderState || (reason && /^explicit_provider_/.test(reason)))
    ),
  };
};

export type TerminalActionEvidenceBaseline = {
  providerPlanId: string | null;
  versionStamp: string | null;
  lifecycle: string | null;
  eventHash: string | null;
  evidenceTime: string | null;
  evidenceSource: string | null;
  actionStartedAt: string;
};

export const captureTerminalActionEvidenceBaseline = (
  plan: FlightPlan,
  actionStartedAt = new Date().toISOString(),
): TerminalActionEvidenceBaseline => {
  const snapshot = plan.filingProviderSnapshot && typeof plan.filingProviderSnapshot === "object" && !Array.isArray(plan.filingProviderSnapshot)
    ? plan.filingProviderSnapshot as Record<string, any>
    : {};
  const evidence = classifyLifecycleEvidence(snapshot, null);
  return {
    providerPlanId: String(snapshot.providerPlanId || plan.filingProviderPlanId || "").trim() || null,
    versionStamp: String(snapshot.versionStamp || getVersionStamp(plan) || "").trim() || null,
    lifecycle: normalizeLifecycleStatus(evidence.lifecycle),
    eventHash: String(evidence.eventHash || "").trim() || null,
    evidenceTime: evidence.evidenceTime || evidence.webhookProcessingTimestamp || evidence.rsfReceiptTimestamp || evidence.providerEventTimestamp || null,
    evidenceSource: evidence.source || null,
    actionStartedAt,
  };
};

export const evaluateTerminalEvidenceObservation = ({
  evidence,
  expectedStatus,
  baseline,
}: {
  evidence: ReturnType<typeof classifyLifecycleEvidence>;
  expectedStatus: string | null;
  baseline?: TerminalActionEvidenceBaseline | null;
}) => {
  const expected = normalizeLifecycleStatus(expectedStatus);
  const lifecycle = normalizeLifecycleStatus(evidence.lifecycle);
  const isTerminal = Boolean(lifecycle && terminalLifecycleStatuses.has(lifecycle));
  const isMatchingTerminal = Boolean(expected && lifecycle === expected && evidence.hasExplicitProviderEvidence);
  const isContradictoryTerminal = Boolean(expected && isTerminal && lifecycle !== expected);
  const sameEvent = Boolean(baseline?.eventHash && evidence.eventHash && baseline.eventHash === evidence.eventHash);
  const versionOrder = baseline?.versionStamp && evidence.versionStamp
    ? compareVersionStamp(evidence.versionStamp, baseline.versionStamp)
    : 0;
  const predatesBaselineByVersion = Boolean(baseline?.versionStamp && evidence.versionStamp && versionOrder < 0);
  const sameBaselineVersion = Boolean(baseline?.versionStamp && evidence.versionStamp && versionOrder === 0);
  const evidenceTime = Date.parse(String(evidence.evidenceTime || evidence.webhookProcessingTimestamp || evidence.rsfReceiptTimestamp || evidence.providerEventTimestamp || ""));
  const actionStartTime = Date.parse(String(baseline?.actionStartedAt || ""));
  const predatesBaselineByTime = Number.isFinite(evidenceTime) && Number.isFinite(actionStartTime) && evidenceTime < actionStartTime;
  const predatesAction = Boolean(sameEvent || predatesBaselineByVersion || predatesBaselineByTime);
  const baselineAlreadyTerminal = Boolean(terminalLifecycleStatuses.has(normalizeLifecycleStatus(baseline?.lifecycle) || ""));
  const matchingEvidenceIsCurrent = Boolean(
    isMatchingTerminal &&
    (
      !sameBaselineVersion ||
      baselineAlreadyTerminal ||
      !baseline?.versionStamp ||
      !evidence.versionStamp
    )
  );
  const transitional = Boolean(
    !evidence.hasExplicitProviderEvidence ||
    !isTerminal ||
    (lifecycle && nonterminalLifecycleStatuses.has(lifecycle))
  );
  const decision = !evidence.hasExplicitProviderEvidence
    ? "missing_provider_state"
    : predatesAction && !isMatchingTerminal
      ? "pre_action_evidence_ignored"
      : matchingEvidenceIsCurrent
        ? "matching_terminal_evidence"
        : isContradictoryTerminal && !predatesAction && !sameBaselineVersion
            ? "contradictory_terminal_evidence"
            : transitional
              ? "transitional_nonterminal_evidence"
              : "missing_provider_state";

  return {
    decision,
    lifecycle,
    expectedStatus: expected,
    isTerminal,
    isMatchingTerminal,
    isContradictoryTerminal,
    predatesAction,
    transitional: decision === "transitional_nonterminal_evidence" || decision === "pre_action_evidence_ignored",
    versionOrder,
    sameEvent,
    sameBaselineVersion,
  };
};

type LifecycleDynamicTimingMetadata = {
  lifecycleDynamicTimeEnabled: boolean;
  lifecycleDepartureTimeStrategy: string;
  activationWindowCheckPassed: boolean | null;
  effectiveTimeGeneratedAt?: string;
  offsetMinutes?: number;
  originalPlannedLocalTime?: string | null;
  dynamicLifecycleLocalTime?: string | null;
  effectiveDepartureLocalTime?: string | null;
  departureTimeZone?: string;
  departureInstantUtc?: string;
  expectedProviderZulu?: string;
  activationWindowCheckedAt?: string;
  activationWindowProviderRejected?: boolean;
  departureDateLocal?: string;
  departureTimeLocal?: string;
  localCalendarDate?: string;
  utcCalendarDate?: string;
  dateBoundaryExpected?: boolean;
  dateBoundaryObserved?: boolean;
  dateBoundaryCheckPassed?: boolean | null;
  currentDateAtDepartureAirport?: string;
  futureDateExpected?: boolean;
  futureDateObserved?: boolean;
  futureDateCheckPassed?: boolean | null;
  dofExpected?: string | null;
  dofInjected?: boolean;
  dofTransmitted?: string | null;
  dofEntryCount?: number;
  dofCheckPassed?: boolean | null;
};

const dynamicDepartureOffsetMinutesForCase = (testCase: LiveLabCase) =>
  lifecycleUsesActivationWindow(testCase)
    ? LIFECYCLE_DYNAMIC_TIME_OFFSET_MINUTES
    : FILE_DYNAMIC_TIME_BASE_OFFSET_MINUTES + (Math.max(1, testCase.seed) - 1) * CASE_DYNAMIC_TIME_SPACING_MINUTES;

const buildDateBoundaryMetadata = (localDateTime: string, departureInstantUtc: string) => {
  const departureDateLocal = localDateTime.slice(0, 10);
  const departureTimeLocal = localDateTime.slice(11, 16);
  const utcCalendarDate = departureInstantUtc.slice(0, 10);
  const dateBoundaryObserved = departureDateLocal !== utcCalendarDate;
  return {
    departureDateLocal,
    departureTimeLocal,
    localCalendarDate: departureDateLocal,
    utcCalendarDate,
    dateBoundaryExpected: true,
    dateBoundaryObserved,
    dateBoundaryCheckPassed: dateBoundaryObserved,
  };
};

const nextFutureLocalDateTimeAt = ({
  now,
  timeZone,
  localTime,
  minimumLeadMinutes,
}: {
  now: Date;
  timeZone: string;
  localTime: string;
  minimumLeadMinutes: number;
}) => {
  for (let dayOffset = 0; dayOffset <= 10; dayOffset += 1) {
    const candidateDateProbe = new Date(now.getTime() + dayOffset * 24 * 60 * 60_000);
    const localDate = formatLocalDateTimeForZone(candidateDateProbe, timeZone).slice(0, 10);
    const candidateLocal = `${localDate}T${localTime}`;
    const candidateUtc = zonedLocalDateTimeToUtcIso(candidateLocal, timeZone);
    const candidateInstant = new Date(candidateUtc);
    if (candidateInstant.getTime() >= now.getTime() + minimumLeadMinutes * 60_000) {
      return { candidateLocal, candidateInstant };
    }
  }
  throw new Error(`Unable to calculate a future ${localTime} departure for ${timeZone}.`);
};

const addCalendarDays = (localDate: string, days: number) => {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const buildDofForLocalDate = (localDate: string) =>
  localDate.replace(/-/g, "").slice(2);

const buildCase22DofEvidence = (
  plan: FlightPlan,
  localDateTime: string,
  departureTimeZone: string,
  now: Date,
) => {
  const payloadContext = buildLeidosActionPayload(plan, "file", { otherInfo: null } as any);
  const transmittedOtherInfo = String(payloadContext.payloadSnapshot?.otherInfo || payloadContext.payloadSnapshot?.transmittedFields?.otherInfo || "").trim();
  const dofEntries = transmittedOtherInfo.match(/\bDOF\/\d{6}\b/g) || [];
  const departureDateLocal = localDateTime.slice(0, 10);
  const currentDateAtDepartureAirport = formatLocalDateTimeForZone(now, departureTimeZone).slice(0, 10);
  const dofExpected = buildDofForLocalDate(departureDateLocal);
  const dofTransmitted = dofEntries[0]?.replace(/^DOF\//, "") || null;
  const futureDateObserved = departureDateLocal > currentDateAtDepartureAirport;
  return {
    currentDateAtDepartureAirport,
    futureDateExpected: true,
    futureDateObserved,
    futureDateCheckPassed: futureDateObserved,
    dofExpected,
    dofInjected: Boolean(payloadContext.payloadSnapshot?.dofInjected),
    dofTransmitted,
    dofEntryCount: dofEntries.length,
    dofCheckPassed: Boolean(
      payloadContext.payloadSnapshot?.dofInjected &&
      dofEntries.length === 1 &&
      dofTransmitted === dofExpected
    ),
  };
};

export const applyLiveLabEffectiveDepartureTime = (
  plan: FlightPlan,
  testCase: LiveLabCase,
  options: { dynamicTimingEnabled?: boolean; now?: Date | number | string } = {},
) => {
  const now = options.now instanceof Date
    ? options.now
    : options.now !== undefined
      ? new Date(options.now)
      : new Date();
  const originalInstant = plan.plannedDepartureAt ? new Date(plan.plannedDepartureAt) : null;
  const departureTimeZone = getDepartureTimeZone(plan);
  const originalLocal = originalInstant ? formatLocalDateTimeForZone(originalInstant, departureTimeZone) : null;

  if (!options.dynamicTimingEnabled) {
    const staticInstant = originalInstant && Number.isFinite(originalInstant.getTime()) ? originalInstant : null;
    const staticLocal = staticInstant ? formatLocalDateTimeForZone(staticInstant, departureTimeZone) : null;
    return {
      plan,
      metadata: {
        lifecycleDynamicTimeEnabled: false,
        lifecycleDepartureTimeStrategy: "static deterministic seed time",
        activationWindowCheckPassed: null,
        effectiveTimeGeneratedAt: now.toISOString(),
        offsetMinutes: 0,
        originalPlannedLocalTime: originalLocal,
        dynamicLifecycleLocalTime: null,
        effectiveDepartureLocalTime: staticLocal,
        departureTimeZone,
        departureInstantUtc: staticInstant?.toISOString(),
        expectedProviderZulu: staticInstant ? formatProviderZulu(staticInstant) : undefined,
      } satisfies LifecycleDynamicTimingMetadata,
    };
  }

  if (testCase.seed === 19) {
    const { candidateLocal, candidateInstant } = nextFutureLocalDateTimeAt({
      now,
      timeZone: departureTimeZone,
      localTime: "23:30",
      minimumLeadMinutes: FILE_DYNAMIC_TIME_BASE_OFFSET_MINUTES,
    });
    const plannerState = getPlannerStateRecord(plan);
    const dateBoundaryMetadata = buildDateBoundaryMetadata(candidateLocal, candidateInstant.toISOString());
    const nextPlan = {
      ...plan,
      plannedDepartureAt: candidateInstant,
      plannedArrivalAt: new Date(candidateInstant.getTime() + 3 * 60 * 60_000),
      plannerState: {
        ...plannerState,
        departureTimeZone,
        userDisplayDepartureTimeLocal: candidateLocal,
        lifecycleDynamicTimeEnabled: true,
        lifecycleDepartureTimeStrategy: "case-19 next future KLAS-local 23:30 date-boundary",
        lifecycleOriginalDepartureTimeLocal: originalLocal,
      },
    } as FlightPlan;
    const metadata: LifecycleDynamicTimingMetadata = {
      lifecycleDynamicTimeEnabled: true,
      lifecycleDepartureTimeStrategy: "case-19 next future KLAS-local 23:30 date-boundary",
      effectiveTimeGeneratedAt: now.toISOString(),
      offsetMinutes: Math.round((candidateInstant.getTime() - now.getTime()) / 60_000),
      originalPlannedLocalTime: originalLocal,
      dynamicLifecycleLocalTime: candidateLocal,
      effectiveDepartureLocalTime: candidateLocal,
      departureTimeZone,
      departureInstantUtc: candidateInstant.toISOString(),
      expectedProviderZulu: formatProviderZulu(candidateInstant),
      activationWindowCheckPassed: null,
      ...dateBoundaryMetadata,
    };
    console.info(JSON.stringify({
      event: "leidos_live_lab_effective_departure_time",
      caseSeed: testCase.seed,
      caseName: testCase.name,
      ...metadata,
    }));
    return { plan: nextPlan, metadata };
  }

  if (testCase.seed === 22) {
    const currentDateAtDepartureAirport = formatLocalDateTimeForZone(now, departureTimeZone).slice(0, 10);
    const futureLocalDate = addCalendarDays(currentDateAtDepartureAirport, 1);
    const dynamicLocal = `${futureLocalDate}T13:40`;
    const dynamicInstant = new Date(zonedLocalDateTimeToUtcIso(dynamicLocal, departureTimeZone));
    const plannerState = getPlannerStateRecord(plan);
    const nextPlan = {
      ...plan,
      plannedDepartureAt: dynamicInstant,
      plannedArrivalAt: new Date(dynamicInstant.getTime() + 2 * 60 * 60_000),
      plannerState: {
        ...plannerState,
        departureTimeZone,
        userDisplayDepartureTimeLocal: dynamicLocal,
        lifecycleDynamicTimeEnabled: true,
        lifecycleDepartureTimeStrategy: "case-22 next-day airport-local 13:40 future-date DOF",
        lifecycleOriginalDepartureTimeLocal: originalLocal,
      },
    } as FlightPlan;
    const dofEvidence = buildCase22DofEvidence(nextPlan, dynamicLocal, departureTimeZone, now);
    const metadata: LifecycleDynamicTimingMetadata = {
      lifecycleDynamicTimeEnabled: true,
      lifecycleDepartureTimeStrategy: "case-22 next-day airport-local 13:40 future-date DOF",
      effectiveTimeGeneratedAt: now.toISOString(),
      offsetMinutes: Math.round((dynamicInstant.getTime() - now.getTime()) / 60_000),
      originalPlannedLocalTime: originalLocal,
      dynamicLifecycleLocalTime: dynamicLocal,
      effectiveDepartureLocalTime: dynamicLocal,
      departureTimeZone,
      departureInstantUtc: dynamicInstant.toISOString(),
      expectedProviderZulu: formatProviderZulu(dynamicInstant),
      activationWindowCheckPassed: null,
      departureDateLocal: dynamicLocal.slice(0, 10),
      departureTimeLocal: dynamicLocal.slice(11, 16),
      localCalendarDate: dynamicLocal.slice(0, 10),
      utcCalendarDate: dynamicInstant.toISOString().slice(0, 10),
      dateBoundaryExpected: false,
      dateBoundaryCheckPassed: null,
      ...dofEvidence,
    };
    console.info(JSON.stringify({
      event: "leidos_live_lab_effective_departure_time",
      caseSeed: testCase.seed,
      caseName: testCase.name,
      ...metadata,
    }));
    return { plan: nextPlan, metadata };
  }

  const offsetMinutes = dynamicDepartureOffsetMinutesForCase(testCase);
  const dynamicInstant = new Date(now.getTime() + offsetMinutes * 60_000);
  const dynamicLocal = formatLocalDateTimeForZone(dynamicInstant, departureTimeZone);
  const plannerState = getPlannerStateRecord(plan);
  const nextPlan = {
    ...plan,
    plannedDepartureAt: dynamicInstant,
    plannedArrivalAt: new Date(dynamicInstant.getTime() + 60 * 60_000),
    plannerState: {
      ...plannerState,
      departureTimeZone,
      userDisplayDepartureTimeLocal: dynamicLocal,
      lifecycleDynamicTimeEnabled: true,
      lifecycleDepartureTimeStrategy: `just-in-time current time + ${offsetMinutes} minutes`,
      lifecycleOriginalDepartureTimeLocal: originalLocal,
    },
  } as FlightPlan;
  const metadata: LifecycleDynamicTimingMetadata = {
    lifecycleDynamicTimeEnabled: true,
    lifecycleDepartureTimeStrategy: `just-in-time current time + ${offsetMinutes} minutes`,
    effectiveTimeGeneratedAt: now.toISOString(),
    offsetMinutes,
    originalPlannedLocalTime: originalLocal,
    dynamicLifecycleLocalTime: dynamicLocal,
    effectiveDepartureLocalTime: dynamicLocal,
    departureTimeZone,
    departureInstantUtc: dynamicInstant.toISOString(),
    expectedProviderZulu: formatProviderZulu(dynamicInstant),
    departureDateLocal: dynamicLocal.slice(0, 10),
    departureTimeLocal: dynamicLocal.slice(11, 16),
    localCalendarDate: dynamicLocal.slice(0, 10),
    utcCalendarDate: dynamicInstant.toISOString().slice(0, 10),
    dateBoundaryExpected: testCase.seed === 19,
    dateBoundaryObserved: testCase.seed === 19 ? dynamicLocal.slice(0, 10) !== dynamicInstant.toISOString().slice(0, 10) : undefined,
    dateBoundaryCheckPassed: testCase.seed === 19 ? dynamicLocal.slice(0, 10) !== dynamicInstant.toISOString().slice(0, 10) : null,
    activationWindowCheckPassed: lifecycleUsesActivationWindow(testCase)
      ? Math.abs(dynamicInstant.getTime() - now.getTime()) <= ACTIVATION_WINDOW_MINUTES * 60_000
      : null,
  };
  console.info(JSON.stringify({
    event: "leidos_live_lab_effective_departure_time",
    caseSeed: testCase.seed,
    caseName: testCase.name,
    ...metadata,
  }));
  return { plan: nextPlan, metadata };
};

export const assertEffectiveDepartureTimeNotStale = (
  timing: ReturnType<typeof applyLiveLabEffectiveDepartureTime>,
  testCase: LiveLabCase,
  nowInput: Date | number | string = new Date(),
) => {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const departure = timing.plan.plannedDepartureAt ? new Date(timing.plan.plannedDepartureAt) : null;
  if (!departure || !Number.isFinite(departure.getTime()) || departure.getTime() < now.getTime() - 60_000) {
    throw new Error(
      `Refusing certification case ${testCase.seed}: effective departure time is stale or invalid. ` +
      `strategy=${timing.metadata.lifecycleDepartureTimeStrategy}; ` +
      `departureInstantUtc=${timing.metadata.departureInstantUtc || "-"}; now=${now.toISOString()}.`,
    );
  }
};

export const getLiveLabTestDesignFailure = (
  timing: ReturnType<typeof applyLiveLabEffectiveDepartureTime>,
  testCase: LiveLabCase,
) => {
  if (testCase.seed === 19 && timing.metadata.dateBoundaryCheckPassed !== true) {
    return `Test design failure: Case 19 must produce a KLAS local-to-UTC calendar date boundary. Local date ${timing.metadata.localCalendarDate || "-"} UTC date ${timing.metadata.utcCalendarDate || "-"}.`;
  }
  if (testCase.seed === 22) {
    const failures = [
      timing.metadata.futureDateCheckPassed === true ? null : "futureDateCheckPassed=false",
      timing.metadata.dofInjected === true ? null : "dofInjected=false",
      timing.metadata.dofCheckPassed === true ? null : `dofCheckPassed=false expected=${timing.metadata.dofExpected || "-"} transmitted=${timing.metadata.dofTransmitted || "-"} count=${timing.metadata.dofEntryCount ?? "-"}`,
    ].filter(Boolean);
    if (failures.length) {
      return `Test design failure: Case 22 must prove future-date DOF injection before provider submission. ${failures.join("; ")}.`;
    }
  }
  return null;
};

const isInternalFixtureValidationFailure = (plan: FlightPlan, validation: ReturnType<typeof validateFlightPlanForAction>) => {
  const equipment = String(plan.filingEquipment || "").trim().toUpperCase();
  const otherInfo = String(plan.filingOtherInfo || "").trim().toUpperCase();
  return Boolean(
    /\bPBN\//.test(otherInfo) &&
    !equipment.includes("R") &&
    validation.errors.some((error) => /PBN|equipment.*R|R.*PBN/i.test(error)),
  );
};

const isActivationWindowError = (message: string) =>
  /ActivateInvalidActivationTime|activation time was not within 30 minutes|activation window/i.test(message);

const checkActivationWindow = (plan: FlightPlan) => {
  const departure = plan.plannedDepartureAt ? new Date(plan.plannedDepartureAt) : null;
  if (!departure || Number.isNaN(departure.getTime())) return false;
  return Math.abs(departure.getTime() - Date.now()) <= ACTIVATION_WINDOW_MINUTES * 60_000;
};

const normalizePhone = (value?: string | null) => String(value || "").replace(/\D/g, "");
const normalizeEmail = (value?: string | null) => String(value || "").trim().toLowerCase();
const PROVIDER_SUBMISSION_ENV_VAR = "LEIDOS_FLIGHT_SERVICE_ENABLE_LIVE";
const PROVIDER_SUBMISSION_DISABLED_MESSAGE = "Provider submission disabled by configuration";
const isProviderSubmissionDisabledMessage = (value: unknown) =>
  /live provider submission remains disabled|enables leidos in environment configuration/i.test(String(value || ""));
const isAccountDisabled = (user: any) => {
  if (user?.isActive === false || user?.active === false || user?.disabled === true) return true;
  const status = String(user?.status || user?.accountStatus || "").trim().toLowerCase();
  return ["disabled", "suspended", "deleted", "inactive", "banned"].includes(status);
};

export const assertLabEndpoint = () => {
  const diagnostics = getLeidosFlightServiceDiagnostics();
  const endpoint = String(diagnostics.baseUrl || "").toLowerCase();
  const productionLike = endpoint.includes("lmfsweb.afss.com") || endpoint.includes("production") || endpoint.includes("prod");
  const labLike = endpoint.includes("ffspelabs") || endpoint.includes("lab");
  if (diagnostics.environment === "production" || productionLike || !labLike) {
    throw new Error(`Refusing to run: configured Leidos endpoint is not LAB. baseUrl=${diagnostics.baseUrl}`);
  }
  return diagnostics;
};

const printProviderSubmissionConfiguration = (diagnostics: ReturnType<typeof assertLabEndpoint>) => {
  console.log("Leidos LAB Provider Submission Configuration");
  console.log("-------------------------------------------");
  console.log(`Required env var for actual LAB submission: ${PROVIDER_SUBMISSION_ENV_VAR}=true`);
  console.log("This enables Leidos provider HTTP calls only after the runner verifies the endpoint is LAB.");
  console.log("Do not enable production filing here. Production operational filing is separately gated by FLIGHT_SERVICE_ENVIRONMENT=PRODUCTION and FLIGHT_FILING_OPERATIONAL_ENABLED=true.");
  console.log(`Current provider submission enabled: ${diagnostics.enabled}`);
  console.log(`Current Flight Service environment: ${diagnostics.environment}`);
  console.log(`Current Leidos base URL: ${diagnostics.baseUrl}`);
  console.log("");
};

export const loadDedicatedTestContext = async () => {
  const email = normalizeEmail(process.env.LEIDOS_TEST_USER_EMAIL);
  if (!email) throw new Error("✗ LEIDOS_TEST_USER_EMAIL is required.");
  if (email !== EXPECTED_TEST_ACCOUNT_EMAIL) {
    throw new Error(`✗ LEIDOS_TEST_USER_EMAIL must be ${EXPECTED_TEST_ACCOUNT_EMAIL}; configured value is ${email}.`);
  }
  console.log("=========================================");
  console.log("Leidos Certification Session");
  console.log("");
  console.log("Configured test account: [verified]");
  console.log("=========================================");
  console.log("");
  const user = await storage.getUserByEmail(email);
  if (!user) throw new Error("✗ Test account not found");
  if (normalizeEmail((user as any).email) !== email) throw new Error("✗ Configured email does not match loaded user");
  if (isAccountDisabled(user)) throw new Error("✗ User account is disabled or inactive");
  if ((user as any).isSuperAdmin) throw new Error("✗ User is Super Admin");
  if ((user as any).isAdmin) throw new Error("✗ User is Admin. Use a normal test user account.");
  const phone = normalizePhone((user as any).phone);
  const homeBase = String((user as any).homeBase || "").trim().toUpperCase();
  const name = `${String((user as any).firstName || "").trim()} ${String((user as any).lastName || "").trim()}`.trim();
  const missing: string[] = [];
  if (!name) missing.push("user first/last name");
  if (phone.length < 10) missing.push("phone number");
  if (!/^[A-Z0-9]{3,4}$/.test(homeBase)) missing.push("home base");
  const profiles = await storage.getAircraftProfilesByUser(user.id);
  const profile = profiles.find((item) => Boolean((item as any).isDefault));
  if (!profile) missing.push("default aircraft");
  let aircraftType = "";
  if (profile?.typeId) {
    const type = await storage.getAircraftTypeById(profile.typeId);
    aircraftType = String(type?.icaoType || "").trim().toUpperCase();
  }
  if (!aircraftType) aircraftType = String(profile?.name || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const aircraftMissing: string[] = [];
  if (!String(profile?.tailNumber || "").trim()) aircraftMissing.push("tail number");
  if (!aircraftType) aircraftMissing.push("ICAO aircraft type");
  if (!String(profile?.filingEquipmentDefault || "").trim()) aircraftMissing.push("aircraft equipment default");
  if (!String(profile?.filingSurveillanceEquipmentDefault || "").trim()) aircraftMissing.push("surveillance equipment default");
  if (!String(profile?.filingWakeTurbulenceDefault || "").trim()) aircraftMissing.push("wake turbulence default");
  if (!String(profile?.filingAircraftColorDefault || "").trim()) aircraftMissing.push("aircraft color default");
  if (aircraftMissing.length) missing.push(`aircraft profile missing ${aircraftMissing.join(", ")}`);
  if (missing.length) {
    const reason = missing.includes("phone number")
      ? "✗ Phone number missing"
      : missing.includes("home base")
        ? "✗ Home base missing"
        : missing.includes("default aircraft")
          ? "✗ Default aircraft missing"
          : missing.some((item) => item.includes("aircraft profile"))
            ? "✗ Aircraft profile is incomplete"
            : missing.includes("user first/last name")
              ? "✗ Pilot profile missing"
              : "✗ Dedicated Leidos test account is incomplete";
    throw new Error(`${reason}: ${missing.join("; ")}`);
  }
  const context = { user, profile: profile!, aircraftType, phone, homeBase, pilotName: name };
  printTestAccountVerification(context);
  return context;
};

export type DedicatedTestContext = Awaited<ReturnType<typeof loadDedicatedTestContext>>;

export const printTestAccountVerification = (context: {
  user: any;
  profile: any;
  aircraftType: string;
  phone: string;
  homeBase: string;
  pilotName: string;
}) => {
  const subscription = String(context.user.subscriptionStatus || context.user.subscriptionPlan || context.user.subscriptionTier || "unknown");
  console.log("✓ User Found");
  console.log("User identity: [verified]");
  console.log("Pilot profile: [verified]");
  console.log("Aircraft profile: [verified]");
  console.log("Contact fields: [verified]");
  console.log(`Subscription: ${subscription}`);
  console.log(`Admin Status: superAdmin=${Boolean(context.user.isSuperAdmin)} admin=${Boolean(context.user.isAdmin)}`);
  console.log("");
  console.log("✓ Email exactly matches LEIDOS_TEST_USER_EMAIL");
  console.log("✓ User exists");
  console.log("✓ User is active");
  console.log("✓ User is NOT Super Admin");
  console.log("✓ Pilot profile exists");
  console.log("✓ Default aircraft exists");
  console.log("✓ Phone number exists");
  console.log("✓ Home base exists");
  console.log("✓ Aircraft profile is complete");
  console.log("");
};

const createBasePlanFactory = (context: DedicatedTestContext, runId: string) => (seed: number, name: string, overrides: Partial<FlightPlan> = {}): FlightPlan => {
  const profile = context.profile;
  const departure = getDeterministicCaseDeparture(seed);
  const filingEquipment = String(profile.filingEquipmentDefault || "S").trim().toUpperCase();
  const baseOtherInfo = filingEquipment.includes("R")
    ? `PBN/A1 ${providerSafeRmk(seed)}`
    : providerSafeRmk(seed);
  return {
    id: `live-lab-${seed}`,
    userId: context.user.id,
    title: `RSF Live LAB ${seed} ${name}`,
    departure: "KEDC",
    destination: "KDAL",
    alternate: "KACT",
    route: "DCT",
    plannedDepartureAt: departure.instant,
    plannedArrivalAt: departure.arrival,
    aircraftType: context.aircraftType,
    tailNumber: String(profile.tailNumber || "").trim().toUpperCase(),
    fuelOnBoard: "40",
    fuelRequired: "15",
    filingFlightRules: "VFR",
    filingEquipment,
    filingSoulsOnBoard: String(profile.filingSoulsOnBoardDefault || "2").trim(),
    filingAircraftColor: String(profile.filingAircraftColorDefault || "WHITE BLUE").trim(),
    filingPilotName: String(profile.filingPilotNameDefault || context.pilotName).trim(),
    filingPilotPhone: context.phone,
    filingAircraftHomeBase: context.homeBase,
    filingRemarks: `RSF LAB TEST SEED ${seed}`,
    filingWakeTurbulence: String(profile.filingWakeTurbulenceDefault || "LIGHT").trim().toUpperCase(),
    filingTypeOfFlight: String(profile.filingTypeOfFlightDefault || "G").trim().toUpperCase(),
    filingSurveillanceEquipment: String(profile.filingSurveillanceEquipmentDefault || "N").trim().toUpperCase(),
    filingOtherInfo: baseOtherInfo,
    filingTrueAirspeedKtas: 110,
    filingPlannedAltitudeFt: 5500,
    filingEstimatedEnrouteMinutes: 60,
    filingEnduranceMinutes: 240,
    filingStatus: "draft",
    filingProvider: "leidos_flight_service",
    filingProviderPlanId: null,
    filingPendingAction: null,
    filingIsLive: false,
    filedAt: null,
    activatedAt: null,
    cancelledAt: null,
    closedAt: null,
    filingLastProviderSyncAt: null,
    filingPayload: null,
    filingProviderSnapshot: null,
    filingProviderMessages: [],
    filingAssignedBeaconCode: null,
    filingRaw: null,
    filingActionHistory: [],
    plannerState: { departureTimeZone: "America/Chicago", userDisplayDepartureTimeLocal: departure.local },
    notes: `${CERT_REMARK} ${runId} SEED ${seed}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as FlightPlan;
};

const withCaseMetadata = (testCase: LiveLabCase, suite: LiveLabSuiteDesignation): LiveLabCase => ({
  ...testCase,
  stableId: testCase.stableId || `case-${String(testCase.seed).padStart(2, "0")}`,
  suite,
  classification: testCase.classification || (
    testCase.expectedBlockedBeforeLeidos ? "negative" :
    testCase.testType === "Lifecycle" ? "lifecycle" :
    testCase.testType === "Round Trip" ? "round-trip" :
    /ZZZZ/i.test(testCase.name) ? "zzzz" :
    "positive"
  ),
});

export const buildCoreCaseMappingAudit = () => [
  { seed: 1, stableId: "case-01", name: "Normal VFR ICAO file", currentCoverage: "Baseline positive VFR ICAO FILE payload and cleanup.", disposition: "retained", reason: "Leidos-required baseline positive VFR filing coverage." },
  { seed: 2, stableId: "case-02", name: "Normal IFR ICAO file", currentCoverage: "Baseline positive IFR ICAO FILE payload and cleanup.", disposition: "retained", reason: "Leidos-required baseline positive IFR filing coverage and duplicate-risk anchor for Case 8." },
  { seed: 3, stableId: "case-03", name: "ZZZZ destination lat/long description", currentCoverage: "Destination ZZZZ with DEST/ location support.", disposition: "retained", reason: "Unique ZZZZ destination coverage." },
  { seed: 4, stableId: "case-04", name: "ZZZZ departure lat/long description", currentCoverage: "Departure ZZZZ with DEP/ location support and planning-reference timezone.", disposition: "retained", reason: "Unique ZZZZ departure coverage." },
  { seed: 5, stableId: "case-05", name: "ZZZZ alternate destination", currentCoverage: "Alternate ZZZZ with ALTN/ private field identifier.", disposition: "retained", reason: "Unique ZZZZ alternate coverage." },
  { seed: 6, stableId: "case-06", name: "Other Info RMK retained", currentCoverage: "Other Info/RMK normalization and DOF preservation.", disposition: "retained", reason: "Unique Field 18/RMK positive normalization coverage." },
  { seed: 7, stableId: "case-07", name: "VFR file activate close", currentCoverage: "VFR FILE -> ACTIVATE -> CLOSE lifecycle and terminal verification.", disposition: "retained", reason: "Lifecycle-critical case." },
  { seed: 8, stableId: "case-08", name: "IFR file then amend", currentCoverage: "IFR FILE -> AMEND with material mutation and cleanup.", disposition: "retained", reason: "Unique AMEND and version-stamp continuity coverage." },
  { seed: 9, stableId: "case-09", name: "Provider round-trip integrity lifecycle", currentCoverage: "Round-trip payload/route integrity through lifecycle.", disposition: "retained", reason: "Unique route-integrity and terminal comparison coverage." },
  { seed: 10, stableId: "case-10", name: "Negative - Equipment R with no PBN", currentCoverage: "Blocks Equipment R without PBN/ before provider submission.", disposition: "retained", reason: "Required negative PBN control." },
  { seed: 11, stableId: "case-11", name: "Negative - PBN present without Equipment R", currentCoverage: "Blocks PBN/ without Equipment R before provider submission.", disposition: "retained", reason: "Required reciprocal PBN/equipment validation." },
  { seed: 12, stableId: "case-12", name: "Negative - Invalid surveillance B2", currentCoverage: "Blocks unsupported compact surveillance value.", disposition: "retained", reason: "Unique surveillance validation coverage." },
  { seed: 13, stableId: "case-13", name: "Negative - Duplicate equipment codes", currentCoverage: "Blocks duplicate equipment codes with actionable copy.", disposition: "retained", reason: "Unique duplicate equipment validation coverage." },
  { seed: 14, stableId: "case-14", name: "Negative - Missing phone and home base", currentCoverage: "Blocks missing pilot phone/home base.", disposition: "retained", reason: "Unique required-contact validation coverage." },
  { seed: 15, stableId: "case-15", name: "Negative - Invalid Other Info", currentCoverage: "Blocks provider-unsafe Other Info text.", disposition: "retained", reason: "Required invalid Field 18 validation; explicitly preserved." },
];

export const buildCases = (context: DedicatedTestContext, runId: string): LiveLabCase[] => {
  const plan = createBasePlanFactory(context, runId);
  return [
    { seed: 1, name: "Normal VFR ICAO file", testType: "Positive", actions: ["file"], buildPlan: () => plan(1, "Normal VFR") },
    { seed: 2, name: "Normal IFR ICAO file", testType: "Positive", actions: ["file"], buildPlan: () => plan(2, "Normal IFR", { filingFlightRules: "IFR", route: "DCT KDWH DCT", filingPlannedAltitudeFt: 7000 }) },
    { seed: 3, name: "ZZZZ destination lat/long description", testType: "Positive", actions: ["file"], buildPlan: () => plan(3, "ZZZZ Destination", { destination: "ZZZZ", filingDestinationName: "PRIVATE STRIP", plannerState: { departureTimeZone: "America/Chicago", userDisplayDepartureTimeLocal: getDeterministicCaseDeparture(3).local, planningReferenceDestinationAirport: "KSDL", actualDestinationLocationMode: "latlong", actualDestinationLocation: "3839N09045W" } }) },
    { seed: 4, name: "ZZZZ departure lat/long description", testType: "Positive", actions: ["file"], buildPlan: () => plan(4, "ZZZZ Departure", { departure: "ZZZZ", filingDepartureName: "PRIVATE STRIP", plannerState: { departureTimeZone: "America/Chicago", userDisplayDepartureTimeLocal: getDeterministicCaseDeparture(4).local, planningReferenceDepartureAirport: "KDWH", actualDepartureLocationMode: "latlong", actualDepartureLocation: "3839N09045W" } }) },
    { seed: 5, name: "ZZZZ alternate destination", testType: "Positive", actions: ["file"], buildPlan: () => plan(5, "ZZZZ Alternate", { alternate: "ZZZZ", filingAlternateName: "PRIVATE STRIP", plannerState: { departureTimeZone: "America/Chicago", userDisplayDepartureTimeLocal: getDeterministicCaseDeparture(5).local, planningReferenceAlternateAirport: "KACT", actualAlternateLocationMode: "identifier", actualAlternateLocation: "85TX" } }) },
    { seed: 6, name: "Other Info RMK retained", testType: "Positive", actions: ["file"], buildPlan: () => plan(6, "RMK Retained", { filingOtherInfo: `DOF/260715 ${providerSafeRmk(6, "RMK")}` }) },
    { seed: 7, name: "VFR file activate close", testType: "Lifecycle", actions: ["file", "activate", "close"], expectedFinalState: "closed", buildPlan: () => plan(7, "VFR Close", { destination: "KACT", alternate: "KDAL", filingCloseLocation: "KACT" } as any) },
    { seed: 8, name: "IFR file then amend", testType: "Lifecycle", actions: ["file", "amend"], expectedFinalState: "filed after AMEND, then cancelled during immediate cleanup", buildPlan: () => plan(8, "IFR Amend", { filingFlightRules: "IFR", route: "DCT KDWH DCT", filingPlannedAltitudeFt: 7000 }) },
    { seed: 9, name: "Provider round-trip integrity lifecycle", testType: "Round Trip", actions: ["file", "amend", "activate", "close"], expectedFinalState: "closed", buildPlan: () => plan(9, "Round Trip", { route: "DCT KDWH DCT", filingCloseLocation: "KDAL" } as any) },
    { seed: 10, name: "Negative - Equipment R with no PBN", testType: "Negative", actions: ["file"], expectedBlockedBeforeLeidos: true, expectedFinalState: "blocked", recommendedFix: "Add the correct PBN/ capabilities or remove R if not PBN approved.", buildPlan: () => plan(10, "R Without PBN", { filingEquipment: "SR", filingOtherInfo: providerSafeRmk(10, "NO PBN") }) },
    { seed: 11, name: "Negative - PBN present without Equipment R", testType: "Negative", actions: ["file"], expectedBlockedBeforeLeidos: true, expectedFinalState: "blocked", recommendedFix: "Add R only if approved, otherwise remove PBN/.", buildPlan: () => plan(11, "PBN Without R", { filingEquipment: "S", filingOtherInfo: `PBN/A1 ${providerSafeRmk(11, "NO R")}` }) },
    { seed: 12, name: "Negative - Invalid surveillance B2", testType: "Negative", actions: ["file"], expectedBlockedBeforeLeidos: true, expectedFinalState: "blocked", recommendedFix: "Use supported compact surveillance values and put ADS-B detail in SUR/ if needed.", buildPlan: () => plan(12, "Invalid Surveillance", { filingSurveillanceEquipment: "B2" }) },
    { seed: 13, name: "Negative - Duplicate equipment codes", testType: "Negative", actions: ["file"], expectedBlockedBeforeLeidos: true, expectedFinalState: "blocked", recommendedFix: "Remove duplicate ICAO equipment codes.", buildPlan: () => plan(13, "Duplicate Equipment", { filingEquipment: "SRR", filingOtherInfo: `PBN/A1 ${providerSafeRmk(13, "DUP EQ")}` }) },
    { seed: 14, name: "Negative - Missing phone and home base", testType: "Negative", actions: ["file"], expectedBlockedBeforeLeidos: true, expectedFinalState: "blocked", recommendedFix: "Complete pilot phone and aircraft home base before filing.", buildPlan: () => plan(14, "Missing Contact", { filingPilotPhone: "", filingAircraftHomeBase: "" }) },
    { seed: 15, name: "Negative - Invalid Other Info", testType: "Negative", actions: ["file"], expectedBlockedBeforeLeidos: true, expectedFinalState: "blocked", recommendedFix: "Use short ICAO subfields with letters, numbers, spaces, and slash separators only.", buildPlan: () => plan(15, "Invalid Other Info", { filingOtherInfo: `DOF/260715 RMK/${CERT_REMARK} LEIDOS-LIVE-LAB-${runId} SEED 15` }) },
  ].map((testCase) => withCaseMetadata(testCase, "core"));
};

export const buildExtendedEdgeCases = (context: DedicatedTestContext, runId: string): LiveLabCase[] => {
  const plan = createBasePlanFactory(context, runId);
  return [
    { seed: 16, stableId: "edge-16", name: "IFR proposed cancellation", testType: "Lifecycle", classification: "lifecycle", actions: ["file", "cancel"], expectedFinalState: "cancelled", buildPlan: () => plan(16, "IFR Cancel", { filingFlightRules: "IFR", route: "DCT ACT DCT", filingPlannedAltitudeFt: 8000, destination: "KDTO", alternate: "KACT" }) },
    { seed: 17, stableId: "edge-17", name: "IFR amend then cancel with newest version stamp", testType: "Lifecycle", classification: "lifecycle", actions: ["file", "amend", "cancel"], expectedFinalState: "cancelled", buildPlan: () => plan(17, "IFR Amend Cancel", { filingFlightRules: "IFR", filingEquipment: "SC", route: "DCT CWK DCT", filingPlannedAltitudeFt: 7000, destination: "KDTO", alternate: "KACT" }) },
    { seed: 18, stableId: "edge-18", name: "Positive - Equipment R with valid PBN", testType: "Positive", classification: "positive", actions: ["file"], expectedFinalState: "filed, then cleanup cancel", buildPlan: () => plan(18, "R With PBN", { filingEquipment: "SR", filingOtherInfo: `PBN/A1 ${providerSafeRmk(18, "VALID PBN")}` }) },
    { seed: 19, stableId: "edge-19", name: "KLAS date-boundary timezone payload", testType: "Positive", classification: "time", actions: ["file"], expectedFinalState: "filed, then cleanup cancel", buildPlan: () => {
      const local = "2026-07-17T23:30";
      return plan(19, "KLAS Date Boundary", {
        departure: "KLAS",
        destination: "KDFW",
        route: "DCT DRK DCT",
        plannedDepartureAt: new Date("2026-07-18T06:30:00.000Z"),
        plannedArrivalAt: new Date("2026-07-18T09:30:00.000Z"),
        plannerState: { departureTimeZone: "America/Los_Angeles", userDisplayDepartureTimeLocal: local },
      });
    } },
    { seed: 20, stableId: "edge-20", name: "ZZZZ aircraft type with TYP", testType: "Positive", classification: "zzzz", actions: ["file", "amend"], expectedFinalState: "filed after AMEND, then cleanup cancel", buildPlan: () => plan(20, "ZZZZ Aircraft Type", { aircraftType: "ZZZZ", filingEquipment: "SC", filingOtherInfo: `TYP/TBM9 ${providerSafeRmk(20, "ZZZZ TYP")}`, plannerState: { departureTimeZone: "America/Chicago", userDisplayDepartureTimeLocal: getDeterministicCaseDeparture(20).local, actualAircraftType: "TBM9" } as any }) },
    { seed: 21, stableId: "edge-21", name: "VFR full lifecycle extended", testType: "Lifecycle", classification: "lifecycle", actions: ["file", "activate", "close"], expectedFinalState: "closed", buildPlan: () => plan(21, "VFR Full Lifecycle", { destination: "KACT", alternate: "KDAL", route: "DCT ACT DCT", filingCloseLocation: "KACT" } as any) },
    { seed: 22, stableId: "edge-22", name: "Future-date DOF positive control", testType: "Positive", classification: "time", actions: ["file"], expectedFinalState: "filed, then cleanup cancel", buildPlan: () => plan(22, "Future DOF", { filingEquipment: "SC", plannerState: { departureTimeZone: "America/Chicago", userDisplayDepartureTimeLocal: "2026-12-31T23:40" }, plannedDepartureAt: new Date("2027-01-01T05:40:00.000Z"), plannedArrivalAt: new Date("2027-01-01T07:10:00.000Z"), filingOtherInfo: providerSafeRmk(22, "YEAR ROLLOVER DOF") }) },
  ].map((testCase) => withCaseMetadata(testCase, "extended"));
};

export const buildCasesForSuite = (context: DedicatedTestContext, runId: string, suite: string): LiveLabCase[] => {
  const normalized = String(suite || "core").trim().toLowerCase();
  if (normalized === "extended" || normalized === "edge" || normalized === "edge-pack") return buildExtendedEdgeCases(context, runId);
  if (normalized === "all") return [...buildCases(context, runId), ...buildExtendedEdgeCases(context, runId)];
  return buildCases(context, runId);
};

export const buildLiveLabDuplicateRiskSignature = (plan: FlightPlan) => {
  const plannerState = plan.plannerState && typeof plan.plannerState === "object" && !Array.isArray(plan.plannerState)
    ? plan.plannerState as Record<string, unknown>
    : {};
  const selectedDeparture = String(
    plannerState.userDisplayDepartureTimeLocal ||
    plan.plannedDepartureAt?.toISOString?.() ||
    plan.plannedDepartureAt ||
    "",
  ).trim().slice(0, 16);
  const normalize = (value: unknown) => String(value || "").trim().toUpperCase().replace(/\s+/g, " ");

  return JSON.stringify([
    normalize(plan.tailNumber),
    normalize(plan.filingFlightRules),
    normalize(plan.departure),
    normalize(plan.destination),
    selectedDeparture,
    normalize(plan.route || "DCT"),
    Number(plan.filingPlannedAltitudeFt || 0),
  ]);
};

export const assertNoLiveLabDuplicateRisk = (
  candidates: Array<{ testCase: LiveLabCase; plan: FlightPlan }>,
) => {
  const submitted = candidates.filter(({ testCase }) =>
    testCase.actions.includes("file") && !testCase.expectedBlockedBeforeLeidos
  );
  const seen = new Map<string, number>();

  for (const { testCase, plan } of submitted) {
    const signature = buildLiveLabDuplicateRiskSignature(plan);
    const previousSeed = seen.get(signature);
    if (previousSeed !== undefined) {
      throw new Error(
        `Leidos duplicate-risk preflight failed: cases ${previousSeed} and ${testCase.seed} have the same pre-FILE signature.`,
      );
    }
    seen.set(signature, testCase.seed);
  }

  return {
    checkedCaseSeeds: submitted.map(({ testCase }) => testCase.seed),
    uniqueSignatureCount: seen.size,
  };
};

export const amendMutationForCase = (testCase: LiveLabCase): Partial<FlightPlan> | null => {
  if (!testCase.actions.includes("amend")) return null;
  if (testCase.seed === 8) {
    return {
      route: "DCT ACT DCT",
      filingPlannedAltitudeFt: 9000,
      alternate: "KACT",
      filingOtherInfo: `PBN/A1 ${providerSafeRmk(8, "AMENDED ROUTE ALT")}`,
      filingRemarks: "RSF LAB TEST SEED 8 AMENDED",
    } as Partial<FlightPlan>;
  }
  if (testCase.seed === 9) {
    return {
      route: "DCT ACT DCT",
      filingPlannedAltitudeFt: 6500,
      alternate: "KACT",
      filingOtherInfo: `PBN/A1 ${providerSafeRmk(9, "AMENDED INTEGRITY")}`,
      filingRemarks: "RSF LAB TEST SEED 9 AMENDED",
    } as Partial<FlightPlan>;
  }
  if (testCase.seed === 17) {
    return {
      route: "DCT ACT DCT SAT DCT",
      filingPlannedAltitudeFt: 9000,
      alternate: "KAUS",
      filingOtherInfo: providerSafeRmk(17, "AMENDED BEFORE CANCEL"),
      filingRemarks: "RSF LAB TEST SEED 17 AMENDED BEFORE CANCEL",
    } as Partial<FlightPlan>;
  }
  if (testCase.seed === 20) {
    return {
      route: "DCT CWK DCT",
      filingPlannedAltitudeFt: 8500,
      alternate: "KAUS",
      filingOtherInfo: `TYP/TBM9 ${providerSafeRmk(20, "ZZZZ TYP AMENDED")}`,
      filingRemarks: "RSF LAB TEST SEED 20 ZZZZ TYP AMENDED",
    } as Partial<FlightPlan>;
  }
  return null;
};

const applyAmendMutationIfNeeded = async (
  plan: FlightPlan,
  testCase: LiveLabCase,
  action: CaseAction,
  dryRun: boolean,
) => {
  if (action !== "amend") return { plan, mutation: null };
  const mutation = amendMutationForCase(testCase);
  if (!mutation) return { plan, mutation: null };
  const plannerState = getPlannerStateRecord(plan);
  const nextPlan = await updateCertificationPlan(plan, {
    ...mutation,
    plannerState: {
      ...plannerState,
      liveLabAmendMutationAppliedAt: new Date().toISOString(),
      liveLabAmendMutationFields: Object.keys(mutation),
    },
  } as any, dryRun);
  console.info(JSON.stringify({
    event: "leidos_live_lab_amend_mutation_applied",
    certificationCaseId: plan.certificationCaseId,
    planId: plan.id,
    seed: testCase.seed,
    fields: Object.keys(mutation),
    route: mutation.route || null,
    filingPlannedAltitudeFt: mutation.filingPlannedAltitudeFt || null,
    alternate: mutation.alternate || null,
  }));
  return { plan: nextPlan, mutation };
};

const parseOnlyCaseSeeds = (value: string) =>
  new Set(
    value
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item > 0),
  );

const selectRequestedCases = (allCases: LiveLabCase[], limit: number, replay: string) => {
  if (replay) {
    const replaySeed = Number(replay);
    const cases = allCases.filter((item) => item.seed === replaySeed).slice(0, 1);
    return {
      cases,
      skippedBySelection: allCases.filter((item) => item.seed !== replaySeed),
      request: { mode: "replay", replay: replaySeed },
    };
  }

  const onlyCasesRaw = arg("only-cases", "");
  const startCase = Math.max(1, Math.floor(numberArg("start-case", "1") || 1));
  const maxSeed = Math.max(...allCases.map((item) => item.seed), MAX_CASES);
  const endCase = Math.min(maxSeed, Math.floor(numberArg("end-case", String(maxSeed)) || maxSeed));
  const onlySeeds = onlyCasesRaw ? parseOnlyCaseSeeds(onlyCasesRaw) : null;
  const selected = allCases.filter((item) => {
    if (onlySeeds) return onlySeeds.has(item.seed);
    return item.seed >= startCase && item.seed <= endCase;
  });
  const limited = selected.slice(0, limit);
  const limitedSeeds = new Set(limited.map((item) => item.seed));
  return {
    cases: limited,
    skippedBySelection: allCases.filter((item) => !limitedSeeds.has(item.seed)),
    request: onlySeeds
      ? { mode: "only-cases", onlyCases: Array.from(onlySeeds).sort((a, b) => a - b), limit }
      : { mode: "range", startCase, endCase, limit },
  };
};

const loadPreviouslyPassedCaseSeeds = () => {
  const dir = join("certification-results", "leidos-live-lab");
  const passed = new Set<number>();
  try {
    for (const fileName of readdirSync(dir)) {
      if (!/\.json$/i.test(fileName) || /cleanup/i.test(fileName)) continue;
      const report = JSON.parse(readFileSync(join(dir, fileName), "utf8"));
      for (const result of Array.isArray(report.results) ? report.results : []) {
        const seed = Number(result.seed);
        if (Number.isInteger(seed) && result.pass === true) passed.add(seed);
      }
    }
  } catch {
    return passed;
  }
  return passed;
};

export const summarizePayload = (plan: FlightPlan, action: FlightPlanFilingAction) => {
  if (action !== "file" && action !== "amend") return null;
  const payloadContext = buildLeidosActionPayload(plan, action, { otherInfo: null } as any);
  const payload = Object.fromEntries(payloadContext.params.entries());
  return {
    aircraft: `${payload.aircraftIdentifier || plan.tailNumber || "-"} / ${payload.aircraftType || plan.aircraftType || "-"}`,
    aircraftIdentifier: payload.aircraftIdentifier,
    aircraftType: payload.aircraftType,
    equipment: payload.aircraftEquipment,
    surveillance: payload.surveillanceEquipment,
    pbn: pbnFromOtherInfo(payload.otherInfo),
    flightRules: payload.flightRules,
    departure: payload.departure,
    destination: payload.destination,
    altDestination1: payload.altDestination1,
    route: payload.route,
    remarks: payload.remarks,
    phone: payload.pilotPhone,
    homeBase: payload.aircraftHomeBase,
    otherInfo: payload.otherInfo,
    dof: payloadContext.payloadSnapshot?.dof || null,
    dofInjected: Boolean(payloadContext.payloadSnapshot?.dofInjected),
    departureInstant: payload.departureInstant,
  };
};

export const simulateDryRunProviderState = (plan: FlightPlan, action: FlightPlanFilingAction, seed: number): FlightPlan => {
  const providerPlanId = plan.filingProviderPlanId || `dry-provider-${seed}`;
  const actionOrder = { file: 1, amend: 2, activate: 3, cancel: 4, close: 5 } as Record<string, number>;
  const versionStamp = `20260702${String(seed).padStart(4, "0")}${String(actionOrder[action] || 0).padStart(2, "0")}`;
  const nextStatus =
    action === "file" || action === "amend" ? "filed" :
    action === "activate" ? "activated" :
    action === "cancel" ? "cancelled" :
    action === "close" ? "closed" :
    plan.filingStatus;
  const lifecycle =
    nextStatus === "activated" ? "activated" :
    nextStatus === "cancelled" ? "cancelled" :
    nextStatus === "closed" ? "closed" :
    "proposed";
  return {
    ...plan,
    filingProviderPlanId: providerPlanId,
    filingStatus: nextStatus,
    filingIsLive: true,
    filingRaw: {
      ...(plan.filingRaw && typeof plan.filingRaw === "object" ? plan.filingRaw as Record<string, unknown> : {}),
      providerPlanId,
      versionStamp,
      response: { flightIdentifier: providerPlanId, versionStamp },
    },
    filingProviderSnapshot: {
      ...(plan.filingProviderSnapshot && typeof plan.filingProviderSnapshot === "object" ? plan.filingProviderSnapshot as Record<string, unknown> : {}),
      providerPlanId,
      versionStamp,
      providerLifecycleStatus: lifecycle,
      providerActionAvailability: {
        activate: lifecycle === "proposed",
        cancel: lifecycle === "proposed",
        close: lifecycle === "activated",
        requiresSync: false,
      },
    },
  } as FlightPlan;
};

export const getVersionStamp = (plan: FlightPlan): string | null => {
  const raw = plan.filingRaw && typeof plan.filingRaw === "object" ? plan.filingRaw as Record<string, any> : {};
  const snapshot = plan.filingProviderSnapshot && typeof plan.filingProviderSnapshot === "object"
    ? plan.filingProviderSnapshot as Record<string, any>
    : {};
  return String(raw.versionStamp || snapshot.versionStamp || "").trim() || null;
};

const pbnFromOtherInfo = (value: unknown) => {
  const match = String(value || "").match(/(?:^|\s)PBN\/([^\s]+)/i);
  return match ? `PBN/${match[1].toUpperCase()}` : null;
};

const rmkFromOtherInfo = (value: unknown) => {
  const match = String(value || "").match(/(?:^|\s)RMK\/(.+)$/i);
  return match ? `RMK/${match[1].trim()}` : null;
};

const normalizeWhitespaceUpper = (value: unknown) => {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  return normalized || "";
};

const normalizeRouteCompareValue = (value: unknown) =>
  normalizeWhitespaceUpper(value).replace(/\s+/g, "");

const normalizeOtherInfoCompareValue = (value: unknown) =>
  normalizeWhitespaceUpper(value)
    .replace(/(?:^|\s)DOF\/\d{6}(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeTimeCompareValue = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    parsed.setUTCSeconds(0, 0);
    return parsed.toISOString();
  }
  const compactZulu = raw.match(/^(\d{2})(\d{2})Z$/i);
  if (compactZulu) return `${compactZulu[1]}:${compactZulu[2]}Z`;
  return normalizeWhitespaceUpper(raw).replace(/:00(?:\.000)?Z$/i, "Z");
};

const normalizeCompareValue = (field: unknown, value: unknown) => {
  const name = String(field);
  if (value === undefined || value === null) return "";
  if (name === "route") return normalizeRouteCompareValue(value);
  if (name === "Other Info / RMK" || name === "RMK" || name === "PBN") return normalizeOtherInfoCompareValue(value);
  if (name === "departureTimeZulu" || name === "departureTimeLocal") return normalizeTimeCompareValue(value);
  return normalizeWhitespaceUpper(value);
};

const meaningfulIntegrityFields = new Set([
  "departure",
  "destination",
  "route",
  "aircraftIdentifier",
  "aircraftType",
  "flightRules",
  "departureTimeZulu",
  "Other Info / RMK",
  "RMK",
]);

const routeValueKeys = [
  "providerRoute",
  "routeProvider",
  "providerReturnedRoute",
  "route",
  "routeText",
  "routeString",
  "expectedRoute",
  "expected_route",
  "currentRoute",
  "effectiveRoute",
  "normalizedTransmittedRoute",
];

const extractRouteString = (value: unknown, depth = 0, visited = new Set<unknown>()): string | null => {
  if (value === null || value === undefined || depth > 5) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value !== "object" || visited.has(value)) return null;
  visited.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const route = extractRouteString(item, depth + 1, visited);
      if (route) return route;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of routeValueKeys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const route = extractRouteString(record[key], depth + 1, visited);
      if (route) return route;
    }
  }

  for (const [key, child] of Object.entries(record)) {
    if (/route/i.test(key)) {
      const route = extractRouteString(child, depth + 1, visited);
      if (route) return route;
    }
  }
  return null;
};

const summarizeRouteObject = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    keys: Object.keys(record).slice(0, 30),
    route: extractRouteString(record.route),
    routeText: extractRouteString(record.routeText),
    routeString: extractRouteString(record.routeString),
    expectedRoute: extractRouteString(record.expectedRoute),
    currentRoute: extractRouteString(record.currentRoute),
    providerRoute: extractRouteString(record.providerRoute),
    routeProvider: extractRouteString(record.routeProvider),
    providerReturnedRoute: extractRouteString(record.providerReturnedRoute),
  };
};

const providerValue = (snapshot: unknown, keys: string[]) => {
  const source = snapshot && typeof snapshot === "object" ? snapshot as Record<string, any> : {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return null;
};

const providerReturnedRouteValue = (snapshot: Record<string, any>, routeSnapshot: Record<string, any>) => {
  const explicitRouteCandidates = [
    routeSnapshot.providerRoute,
    routeSnapshot.routeProvider,
    routeSnapshot.providerReturnedRoute,
    snapshot.providerRoute,
    snapshot.routeProvider,
    snapshot.providerReturnedRoute,
  ];
  for (const candidate of explicitRouteCandidates) {
    const route = extractRouteString(candidate);
    if (route) return route;
  }
  return null;
};

export const compareGeneratedSentReturned = (
  generatedPayload: Record<string, any> | null,
  sentPayload: Record<string, any> | null,
  plan: FlightPlan,
  options: { action?: CaseAction; terminalAction?: boolean } = {},
) => {
  const terminalAction = Boolean(options.terminalAction || (options.action && isTerminalAction(options.action)));
  const snapshot = plan.filingProviderSnapshot && typeof plan.filingProviderSnapshot === "object"
    ? plan.filingProviderSnapshot as Record<string, any>
    : {};
  const raw = plan.filingRaw && typeof plan.filingRaw === "object" ? plan.filingRaw as Record<string, any> : {};
  const routeSnapshot = snapshot.route && typeof snapshot.route === "object" ? snapshot.route as Record<string, any> : {};
  const providerRoute = providerReturnedRouteValue(snapshot, routeSnapshot);
  const localEnteredRoute = extractRouteString(routeSnapshot.localEnteredRoute) || String(plan.route || "").trim() || null;
  const normalizedTransmittedRoute =
    extractRouteString(routeSnapshot.normalizedTransmittedRoute) ||
    extractRouteString(sentPayload?.route) ||
    extractRouteString(generatedPayload?.route) ||
    String(plan.route || "").trim() ||
    null;
  const routeChangedByProvider = Boolean(routeSnapshot.changedByProvider);
  const returned = {
    departure: providerValue(snapshot, ["departure", "departureAirport"]) || plan.departure,
    destination: providerValue(snapshot, ["destination", "destinationAirport"]) || plan.destination,
    alternate: providerValue(snapshot, ["alternate", "altDestination1"]) || plan.alternate,
    route: providerRoute,
    aircraftIdentifier: providerValue(snapshot, ["aircraftIdentifier", "aircraftId"]) || plan.tailNumber,
    aircraftType: providerValue(snapshot, ["aircraftType"]) || plan.aircraftType,
    flightRules: providerValue(snapshot, ["flightRules"]) || plan.filingFlightRules,
    equipment: providerValue(snapshot, ["aircraftEquipment"]) || plan.filingEquipment,
    surveillance: providerValue(snapshot, ["surveillanceEquipment"]) || plan.filingSurveillanceEquipment,
    pbn: pbnFromOtherInfo(providerValue(snapshot, ["otherInfo"]) || sentPayload?.otherInfo || generatedPayload?.otherInfo),
    otherInfo: providerValue(snapshot, ["otherInfo"]) || sentPayload?.otherInfo || generatedPayload?.otherInfo,
    pilotPhone: providerValue(snapshot, ["pilotPhone"]) || plan.filingPilotPhone,
    homeBase: providerValue(snapshot, ["aircraftHomeBase"]) || plan.filingAircraftHomeBase,
    departureZulu: providerValue(snapshot, ["departureInstant"]) || sentPayload?.departureInstant || generatedPayload?.departureInstant,
    providerStatus: providerValue(snapshot, ["providerLifecycleStatus", "providerStatus"]) || plan.filingStatus,
    providerPlanId: plan.filingProviderPlanId || raw.providerPlanId || null,
    versionStamp: getVersionStamp(plan),
  };
  const stored = {
    departure: plan.departure,
    destination: plan.destination,
    alternate: plan.alternate,
    route: plan.route,
    aircraftIdentifier: plan.tailNumber,
    aircraftType: plan.aircraftType,
    flightRules: plan.filingFlightRules,
    equipment: plan.filingEquipment,
    surveillance: plan.filingSurveillanceEquipment,
    pbn: pbnFromOtherInfo(plan.filingOtherInfo),
    otherInfo: plan.filingOtherInfo,
    rmk: rmkFromOtherInfo(plan.filingOtherInfo),
    pilotPhone: plan.filingPilotPhone,
    homeBase: plan.filingAircraftHomeBase,
    departureTimeLocal: (plan.plannerState as any)?.userDisplayDepartureTimeLocal || null,
    departureTimeUtc: plan.plannedDepartureAt?.toISOString?.() || String(plan.plannedDepartureAt || ""),
    providerStatus: plan.filingStatus,
    providerPlanId: plan.filingProviderPlanId || raw.providerPlanId || null,
    versionStamp: getVersionStamp(plan),
  };

  const fields = [
    ["departure", generatedPayload?.departure, sentPayload?.departure, returned.departure],
    ["destination", generatedPayload?.destination, sentPayload?.destination, returned.destination],
    ["alternate", generatedPayload?.altDestination1, sentPayload?.altDestination1, returned.alternate],
    ["route", generatedPayload?.route, sentPayload?.route, returned.route],
    ["aircraftIdentifier", generatedPayload?.aircraftIdentifier, sentPayload?.aircraftIdentifier, returned.aircraftIdentifier],
    ["aircraftType", generatedPayload?.aircraftType, sentPayload?.aircraftType, returned.aircraftType],
    ["flightRules", generatedPayload?.flightRules, sentPayload?.flightRules, returned.flightRules],
    ["equipment", generatedPayload?.aircraftEquipment, sentPayload?.aircraftEquipment, returned.equipment],
    ["surveillance", generatedPayload?.surveillanceEquipment, sentPayload?.surveillanceEquipment, returned.surveillance],
    ["PBN", pbnFromOtherInfo(generatedPayload?.otherInfo), pbnFromOtherInfo(sentPayload?.otherInfo), returned.pbn],
    ["Other Info / RMK", generatedPayload?.otherInfo, sentPayload?.otherInfo, returned.otherInfo],
    ["RMK", rmkFromOtherInfo(generatedPayload?.otherInfo), rmkFromOtherInfo(sentPayload?.otherInfo), rmkFromOtherInfo(returned.otherInfo)],
    ["pilotPhone", generatedPayload?.pilotPhone, sentPayload?.pilotPhone, returned.pilotPhone],
    ["homeBase", generatedPayload?.aircraftHomeBase, sentPayload?.aircraftHomeBase, returned.homeBase],
    ["departureTimeLocal", (plan.plannerState as any)?.userDisplayDepartureTimeLocal, (plan.plannerState as any)?.userDisplayDepartureTimeLocal, stored.departureTimeLocal],
    ["departureTimeZulu", generatedPayload?.departureInstant, sentPayload?.departureInstant, returned.departureZulu],
    ["providerStatus", null, null, returned.providerStatus],
    ["providerPlanId", null, null, returned.providerPlanId],
    ["versionStamp", null, null, returned.versionStamp],
  ];

  const storedByField: Record<string, unknown> = {
    departure: stored.departure,
    destination: stored.destination,
    alternate: stored.alternate,
    route: stored.route,
    aircraftIdentifier: stored.aircraftIdentifier,
    aircraftType: stored.aircraftType,
    flightRules: stored.flightRules,
    equipment: stored.equipment,
    surveillance: stored.surveillance,
    PBN: stored.pbn,
    "Other Info / RMK": stored.otherInfo,
    RMK: stored.rmk,
    pilotPhone: stored.pilotPhone,
    homeBase: stored.homeBase,
    departureTimeLocal: stored.departureTimeLocal,
    departureTimeZulu: stored.departureTimeUtc,
    providerStatus: stored.providerStatus,
    providerPlanId: stored.providerPlanId,
    versionStamp: stored.versionStamp,
  };

  const differences = fields.flatMap(([field, generated, sent, returnedValue]) => {
    const fieldName = String(field);
    if (fieldName === "route") return [];
    const issues: Array<Record<string, unknown>> = [];
    const fieldIsMeaningful = meaningfulIntegrityFields.has(fieldName);
    const issueSeverity = fieldIsMeaningful ? "failure" : "warning";
    if (generated !== undefined && sent !== undefined && normalizeCompareValue(field, generated) !== normalizeCompareValue(field, sent)) {
      issues.push({ field, type: "generated_vs_sent", severity: issueSeverity, classification: "payload_generation_changed_before_send", generated, sent });
    }
    if (field !== "providerPlanId" && field !== "versionStamp" && sent !== undefined && returnedValue !== undefined && returnedValue !== null && normalizeCompareValue(field, sent) !== normalizeCompareValue(field, returnedValue)) {
      issues.push({ field, type: "sent_vs_returned", severity: issueSeverity, classification: fieldIsMeaningful ? "meaningful_provider_integrity_mismatch" : "provider_format_or_echo_difference", sent, returned: returnedValue });
    }
    const storedValue = storedByField[String(field)];
    if (!["providerStatus", "providerPlanId", "versionStamp"].includes(String(field)) && storedValue !== undefined && returnedValue !== undefined && returnedValue !== null && normalizeCompareValue(field, returnedValue) !== normalizeCompareValue(field, storedValue)) {
      issues.push({ field, type: "returned_vs_stored", severity: issueSeverity, classification: fieldIsMeaningful ? "meaningful_provider_integrity_mismatch" : "provider_format_or_echo_difference", returned: returnedValue, stored: storedValue });
    }
    if ((field === "providerPlanId" || field === "versionStamp") && !returnedValue) {
      issues.push({
        field,
        type: "missing_returned_value",
        severity: terminalAction && field === "versionStamp" ? "info" : "warning",
        classification: terminalAction && field === "versionStamp" ? "versionStamp_optional_missing_after_terminal_action" : "provider_reference_missing",
      });
    }
    if (terminalAction && !returnedValue && field !== "providerPlanId" && field !== "versionStamp") {
      issues.push({ field, type: "provider_did_not_echo_terminal_field", severity: "info", classification: "not_comparable_after_terminal_state" });
    }
    return issues;
  });
  const normalizedRouteComparison = {
    localEnteredRoute,
    normalizedTransmittedRoute,
    providerRoute,
    storedRoute: stored.route || null,
    routeChangedByProvider,
    normalizedLocalEnteredRoute: normalizeRouteCompareValue(localEnteredRoute),
    normalizedTransmittedRouteForComparison: normalizeRouteCompareValue(normalizedTransmittedRoute),
    normalizedProviderRoute: normalizeRouteCompareValue(providerRoute),
    normalizedStoredRoute: normalizeRouteCompareValue(stored.route),
  };
  const localMatchesTransmitted =
    !normalizedRouteComparison.normalizedLocalEnteredRoute ||
    !normalizedRouteComparison.normalizedTransmittedRouteForComparison ||
    normalizedRouteComparison.normalizedLocalEnteredRoute === normalizedRouteComparison.normalizedTransmittedRouteForComparison;
  const storedMatchesTransmitted =
    !normalizedRouteComparison.normalizedStoredRoute ||
    !normalizedRouteComparison.normalizedTransmittedRouteForComparison ||
    normalizedRouteComparison.normalizedStoredRoute === normalizedRouteComparison.normalizedTransmittedRouteForComparison;
  let routeComparisonResult = "PASS";
  let routeIssue: Record<string, unknown> | null = null;
  if (routeChangedByProvider) {
    routeComparisonResult = "provider_changed_route";
    routeIssue = {
      field: "route",
      type: "provider_route_changed_flag",
      severity: "failure",
      classification: "provider_changed_route",
      ...normalizedRouteComparison,
    };
  } else if (!providerRoute && localMatchesTransmitted && storedMatchesTransmitted) {
    routeComparisonResult = "provider_did_not_echo_route";
    routeIssue = {
      field: "route",
      type: "provider_route_missing_echo",
      severity: "info",
      classification: "provider_did_not_echo_route",
      ...normalizedRouteComparison,
    };
  } else if (!providerRoute) {
    routeComparisonResult = "provider_changed_route";
    routeIssue = {
      field: "route",
      type: "local_transmitted_route_mismatch_without_provider_echo",
      severity: "failure",
      classification: "provider_changed_route",
      ...normalizedRouteComparison,
    };
  } else if (providerRoute) {
    const providerMatchesTransmitted = normalizedRouteComparison.normalizedProviderRoute === normalizedRouteComparison.normalizedTransmittedRouteForComparison;
    const providerMatchesStored = normalizedRouteComparison.normalizedProviderRoute === normalizedRouteComparison.normalizedStoredRoute;
    if (!providerMatchesTransmitted || !providerMatchesStored) {
      routeComparisonResult = "provider_changed_route";
      routeIssue = {
        field: "route",
        type: "provider_route_material_difference",
        severity: "failure",
        classification: "provider_changed_route",
        ...normalizedRouteComparison,
      };
    } else if (providerRoute !== normalizedTransmittedRoute || providerRoute !== stored.route) {
      routeComparisonResult = "provider_normalized_route";
      routeIssue = {
        field: "route",
        type: "provider_route_normalized_format",
        severity: "info",
        classification: "provider_normalized_route",
        ...normalizedRouteComparison,
      };
    }
  }
  if (routeIssue) differences.push(routeIssue);
  console.info(JSON.stringify({
    event: "leidos_round_trip_route_comparison",
    action: options.action || null,
    localEnteredRoute,
    normalizedTransmittedRoute,
    providerRoute,
    providerRouteObject: summarizeRouteObject(routeSnapshot.providerRoute),
    providerRouteSnapshotObject: summarizeRouteObject((snapshot as any).route),
    routeChangedByProvider,
    comparisonResult: routeComparisonResult,
  }));
  const fieldComparisons = fields.map(([field, generated, sent, returnedValue]) => {
    const storedValue = storedByField[String(field)];
    const fieldDifferences = differences.filter((issue) => issue.field === field);
    return {
      field,
      generated,
      providerPayload: sent,
      providerResponse: returnedValue,
      stored: storedValue,
      comparisonResult: fieldDifferences.length === 0 ? "MATCH" : "DIFFERENCE",
      classification: field === "route"
        ? routeComparisonResult
        : fieldDifferences[0]?.classification || (fieldDifferences.length === 0 ? "PASS" : "DIFFERENCE"),
      severity: fieldDifferences.some((issue: any) => issue.severity === "failure")
        ? "failure"
        : fieldDifferences.some((issue: any) => issue.severity === "warning")
          ? "warning"
          : fieldDifferences.some((issue: any) => issue.severity === "info")
            ? "info"
            : "none",
      differences: fieldDifferences,
    };
  });
  const failureDifferences = differences.filter((issue: any) => issue.severity === "failure");
  const warningDifferences = differences.filter((issue: any) => issue.severity === "warning");
  const infoDifferences = differences.filter((issue: any) => issue.severity === "info");

  return {
    generated: generatedPayload,
    sent: sentPayload,
    returned,
    stored,
    routeComparison: {
      ...normalizedRouteComparison,
      comparisonResult: routeComparisonResult,
    },
    fieldComparisons,
    differences,
    failureDifferences,
    warningDifferences,
    infoDifferences,
    failureCount: failureDifferences.length,
    warningCount: warningDifferences.length,
    infoCount: infoDifferences.length,
    pass: failureDifferences.length === 0,
  };
};

const buildCertificationMetadata = (runId: string, testCase: LiveLabCase) => ({
  source: "leidos-certification",
  isCertificationTest: true,
  certificationRunId: runId,
  certificationCaseId: `case-${String(testCase.seed).padStart(2, "0")}`,
  certificationCaseName: testCase.name,
  certificationSeed: testCase.seed,
});

const formatPayloadReview = (payload: Record<string, any> | null, plan: FlightPlan) => ({
  Aircraft: plan.aircraftType || "-",
  Equipment: payload?.equipment || plan.filingEquipment || "-",
  Surveillance: payload?.surveillance || plan.filingSurveillanceEquipment || "-",
  PBN: payload?.pbn || pbnFromOtherInfo(plan.filingOtherInfo) || "-",
  Departure: payload?.departure || plan.departure || "-",
  Destination: payload?.destination || plan.destination || "-",
  Alternate: payload?.altDestination1 || plan.alternate || "-",
  "Flight Rules": payload?.flightRules || plan.filingFlightRules || "-",
  "Other Info": payload?.otherInfo || plan.filingOtherInfo ? "[present]" : "-",
  Remarks: payload?.remarks ? "[present]" : (plan.filingRemarks ? "[present]" : "-"),
  "Pilot Contact": plan.filingPilotPhone ? "[present]" : "-",
  "Aircraft Home Base": plan.filingAircraftHomeBase ? "[present]" : "-",
  "Zulu Time": payload?.departureInstant || "-",
});

const printPayloadReview = (payload: Record<string, any> | null, plan: FlightPlan) => {
  const review = formatPayloadReview(payload, plan);
  console.log("Payload Review");
  console.log("--------------");
  for (const [label, value] of Object.entries(review)) {
    console.log(`${label}: ${value}`);
  }
  console.log("");
};

const buildRouteReview = (plan: FlightPlan, payload: Record<string, any> | null, validation: ReturnType<typeof validateFlightPlanForAction>) => ({
  originalRoute: plan.route || "-",
  normalizedRoute: payload?.route || plan.route || "-",
  status: validation.ready ? "PASS" : "REVIEW",
});

const finalStateForCase = (testCase: LiveLabCase) => {
  if (testCase.expectedFinalState) return testCase.expectedFinalState;
  if (testCase.actions.includes("close")) return "closed";
  if (testCase.actions.includes("cancel")) return "cancelled";
  if (testCase.actions.includes("activate")) return "activated, then cleanup close";
  if (testCase.actions.includes("file")) return "filed, then cleanup cancel";
  return "no provider state";
};

const printCleanupPreview = (cases: LiveLabCase[]) => {
  console.log("");
  console.log("Cleanup Preview");
  console.log("---------------");
  for (const testCase of cases) {
    const cleanupAction = testCase.expectedBlockedBeforeLeidos
      ? "NO PROVIDER CLEANUP - blocked before Leidos"
      : testCase.actions.includes("close") || testCase.actions.includes("cancel")
        ? "VERIFY TERMINAL STATE"
        : testCase.actions.includes("activate")
          ? "CLOSE"
          : testCase.actions.includes("file")
            ? "CANCEL"
            : "NONE";
    console.log(`Case ${testCase.seed} [${testCase.testType}]: ${testCase.actions.join(" -> ").toUpperCase() || "SKIP"} -> ${cleanupAction}`);
    console.log(`Final expected state: ${finalStateForCase(testCase)}`);
  }
  console.log("");
};

const promptLiveConfirmation = async (context: DedicatedTestContext, diagnostics: ReturnType<typeof assertLabEndpoint>, limit: number, delayMinutes: number) => {
  const rl = readline.createInterface({ input, output });
  try {
    console.log("=========================================");
    console.log("");
    console.log("You are about to submit certification cases using:");
    console.log("");
    console.log("[verified test account]");
    console.log("");
    console.log(`Leidos Environment: ${String(diagnostics.environment || "LAB").toUpperCase()}`);
    console.log("");
    console.log(`Maximum Cases: ${limit}`);
    console.log("");
    console.log(`Delay: ${delayMinutes} minutes`);
    console.log("");
    console.log("=========================================");
    console.log("");
    const typed = (await rl.question("Type CONFIRM to begin: ")).trim();
    if (typed !== "CONFIRM") throw new Error("Live Leidos LAB certification aborted by operator.");
    const yn = (await rl.question("Continue with the verified LAB test account? [Y/N] ")).trim().toLowerCase();
    if (yn !== "y") throw new Error("Live Leidos LAB certification aborted by operator.");
  } finally {
    rl.close();
  }
};

const printValidationResult = (testCase: LiveLabCase, validation: ReturnType<typeof validateFlightPlanForAction>) => {
  const blocked = !validation.ready;
  console.log(`Validation Status: ${validation.ready ? "PASS" : "BLOCKED"}`);
  console.log(`validationResult: ${validation.ready ? "valid" : "invalid"}`);
  console.log(`blockedBeforeLeidos: ${blocked}`);
  if (blocked) {
    console.log(`Reason: ${validation.errors.join(" | ") || "-"}`);
    console.log(`Recommended Resolution: ${testCase.recommendedFix || validation.warnings.join(" | ") || "-"}`);
  }
  console.log("");
};

const compactJson = (value: unknown) => {
  const rendered = JSON.stringify(value);
  if (rendered === undefined) return "-";
  return rendered.length > 180 ? `${rendered.slice(0, 177)}...` : rendered;
};

const printRoundTripComparisonDetails = (summary: ReturnType<typeof buildRoundTripComparisonSummary>) => {
  console.log("Round Trip Comparison");
  console.log(`  Provider Action Success: ${summary.providerActionSuccessCount}`);
  console.log(`  Terminal State Success: ${summary.terminalStateSuccessCount}`);
  console.log(`  Failures: ${summary.failureCount}`);
  console.log(`  Warnings: ${summary.warningCount}`);
  console.log(`  Info: ${summary.infoCount}`);
  const printEntry = (label: string, entries: any[]) => {
    if (!entries.length) return;
    console.log(`  ${label}:`);
    for (const entry of entries) {
      const difference = entry.difference || {};
      console.log(`    ${entry.certificationCaseId} ${String(entry.action || "").toUpperCase()} field=${difference.field || "-"} type=${difference.type || "-"} severity=${difference.severity || "-"} classification=${difference.classification || "-"}`);
      console.log(`      generated=${compactJson(difference.generated)} sent=${compactJson(difference.sent)} returned=${compactJson(difference.returned)} stored=${compactJson(difference.stored)}`);
    }
  };
  printEntry("Failure Details", summary.failures);
  printEntry("Warning Details", summary.warnings);
};

const isNonNegativeCase = (testCase?: LiveLabCase) => testCase ? !testCase.expectedBlockedBeforeLeidos : false;

export const buildRoundTripSummary = (results: any[]) => {
  const roundTripResults = results.filter((item) => item.testType === "Round Trip");
  return {
    total: roundTripResults.length,
    passed: roundTripResults.filter((item) => item.pass).length,
    failed: roundTripResults.filter((item) => !item.pass).length,
    cases: roundTripResults.map((item) => ({
      certificationCaseId: item.certificationCaseId,
      testName: item.testName,
      pass: item.pass,
      providerPlanIds: Array.from(new Set((item.actions || []).map((action: any) => action.providerPlanId).filter(Boolean))),
      versionStamps: (item.actions || []).map((action: any) => action.versionStamp).filter(Boolean),
      versionStampUpdated: new Set((item.actions || []).map((action: any) => action.versionStamp).filter(Boolean)).size > 1,
      fieldComparisons: (item.comparisons || []).flatMap((comparison: any) => comparison?.fieldComparisons || []),
      comparisonFailures: (item.comparisons || []).flatMap((comparison: any) => comparison?.failureDifferences || []),
      comparisonWarnings: (item.comparisons || []).flatMap((comparison: any) => comparison?.warningDifferences || []),
      comparisonInfo: (item.comparisons || []).flatMap((comparison: any) => comparison?.infoDifferences || []),
    })),
  };
};

export const buildRoundTripComparisonSummary = (results: any[]) => {
  const entries = results
    .filter((item) => item.testType === "Round Trip")
    .flatMap((item) => (item.actions || []).map((action: any, index: number) => ({
      certificationCaseId: item.certificationCaseId,
      seed: item.seed,
      testName: item.testName,
      action: action.action,
      actionIndex: index + 1,
      providerActionAccepted: action.providerActionAccepted ?? ["accepted", "dry_run"].includes(String(action.responseStatus)),
      terminalAction: Boolean(action.terminalAction),
      terminalVerificationStatus: action.terminalVerification?.status || null,
      providerPlanId: action.providerPlanId || null,
      failureDifferences: action.comparison?.failureDifferences || [],
      warningDifferences: action.comparison?.warningDifferences || [],
      infoDifferences: action.comparison?.infoDifferences || [],
    })));
  const failures = entries.flatMap((entry) => entry.failureDifferences.map((difference: any) => ({ ...entry, difference })));
  const warnings = entries.flatMap((entry) => entry.warningDifferences.map((difference: any) => ({ ...entry, difference })));
  const informational = entries.flatMap((entry) => entry.infoDifferences.map((difference: any) => ({ ...entry, difference })));
  return {
    providerActionSuccessCount: entries.filter((entry) => entry.providerActionAccepted).length,
    terminalStateSuccessCount: entries.filter((entry) => entry.terminalAction && entry.terminalVerificationStatus === "PASS").length,
    failureCount: failures.length,
    warningCount: warnings.length,
    infoCount: informational.length,
    failures,
    warnings,
    informational,
  };
};

export const buildCleanupVerification = (cleanupResults: any[], results: any[]) => {
  const openFailures = cleanupResults.filter((item) => item.pass === false);
  const blockedCases = results.filter((item) => (item.actions || []).some((action: any) => action.blockedBeforeLeidos));
  const acceptedUnverified = cleanupResults.filter((item) => item.finalCleanupDisposition === "accepted_unverified");
  const summary = buildCleanupSummary(cleanupResults, results);
  const consistencyFailures = summary.consistencyChecks.filter((item: any) => item.pass === false);
  return {
    status: openFailures.length === 0 && consistencyFailures.length === 0 ? (acceptedUnverified.length > 0 ? "REVIEW" : "PASS") : "FAIL",
    noActiveCertificationFlightRemains: openFailures.length === 0 && consistencyFailures.length === 0,
    terminalOrBlockedCount: cleanupResults.filter((item) => item.pass !== false).length + blockedCases.length,
    blockedBeforeSubmissionCount: blockedCases.length,
    failures: openFailures,
    acceptedButTerminalEvidenceUnavailable: acceptedUnverified,
    consistencyFailures,
  };
};

export const buildCleanupSummary = (cleanupResults: any[], results: any[]) => {
  const actions = results.flatMap((item) => item.actions || []);
  const immediate = cleanupResults.filter((item) => item.cleanupPhase === "immediate_case_cleanup");
  const finalSweep = cleanupResults.filter((item) => item.cleanupPhase === "final_sweep");
  const unresolved = cleanupResults.filter((item) => item.pass === false);
  const cancelAccepted = cleanupResults.filter((item) => item.action === "cancel" && ["accepted", "dry_run"].includes(String(item.responseStatus)));
  const explicitlyVerified = cleanupResults.filter((item) => item.terminalVerificationMatched === true);
  const acceptedUnverified = cleanupResults.filter((item) => item.finalCleanupDisposition === "accepted_unverified");
  const providerPlanIdsCreated = Array.from(new Set(actions
    .filter((action: any) => action.action === "file" && action.providerPlanId && ["accepted", "dry_run"].includes(String(action.responseStatus)))
    .map((action: any) => String(action.providerPlanId))));
  const providerPlanIdForCleanup = (item: any) => String(item.providerPlanId || "").trim();
  const explicitPlanIds = new Set(explicitlyVerified.map(providerPlanIdForCleanup).filter(Boolean));
  const immediateExplicitPlanIds = new Set(immediate.filter((item) => item.terminalVerificationMatched === true).map(providerPlanIdForCleanup).filter(Boolean));
  const finalExplicitPlanIds = new Set(finalSweep.filter((item) => item.terminalVerificationMatched === true).map(providerPlanIdForCleanup).filter(Boolean));
  const finalSweepNewlyVerifiedPlanIds = Array.from(finalExplicitPlanIds).filter((providerPlanId) => !immediateExplicitPlanIds.has(providerPlanId));
  const finalSweepReconfirmedPlanIds = Array.from(finalExplicitPlanIds).filter((providerPlanId) => immediateExplicitPlanIds.has(providerPlanId));
  const cleanupEventsByProviderPlan = new Map<string, any[]>();
  for (const result of cleanupResults) {
    const providerPlanId = providerPlanIdForCleanup(result);
    if (!providerPlanId) continue;
    const events = cleanupEventsByProviderPlan.get(providerPlanId) || [];
    events.push(result);
    cleanupEventsByProviderPlan.set(providerPlanId, events);
  }
  const finalDispositions = providerPlanIdsCreated.map((providerPlanId) => {
    const events = cleanupEventsByProviderPlan.get(providerPlanId) || [];
    const disposition = events.some((event) => event.pass === false)
      ? "cleanup_failed"
      : events.some((event) => event.terminalVerificationMatched === true)
        ? "explicitly_terminal"
        : events.some((event) => event.finalCleanupDisposition === "accepted_unverified")
          ? "cancel_accepted_evidence_unavailable"
          : events.some((event) => ["not_required", "staged_only_not_submitted", "already_terminal", "dry_run"].includes(String(event.responseStatus)))
            ? "cleanup_not_required"
            : "unresolved";
    return {
      providerPlanId,
      disposition,
      verificationAttempts: events.filter((event) => event.terminalVerificationAttempted).length,
      cleanupEvents: events.length,
    };
  });
  const uniqueProviderPlansRequiringCleanup = finalDispositions.filter((item) => item.disposition !== "cleanup_not_required").length;
  const unresolvedProviderPlans = finalDispositions.filter((item) => ["cleanup_failed", "unresolved"].includes(item.disposition)).length;
  const consistencyChecks = [
    {
      name: "unique_terminal_verified_not_greater_than_provider_plans_created",
      pass: explicitPlanIds.size <= providerPlanIdsCreated.length,
      details: { uniqueVerified: explicitPlanIds.size, providerPlansCreated: providerPlanIdsCreated.length },
    },
    {
      name: "unique_terminal_verified_belongs_to_current_run",
      pass: Array.from(explicitPlanIds).every((providerPlanId) => providerPlanIdsCreated.includes(providerPlanId)),
      details: {
        verifiedProviderPlanIds: Array.from(explicitPlanIds),
        providerPlanIdsCreated,
      },
    },
    {
      name: "unresolved_provider_plans_not_negative",
      pass: unresolvedProviderPlans >= 0,
      details: { unresolvedProviderPlans },
    },
    {
      name: "every_provider_created_plan_has_one_final_disposition",
      pass: finalDispositions.length === providerPlanIdsCreated.length &&
        new Set(finalDispositions.map((item) => item.providerPlanId)).size === providerPlanIdsCreated.length,
      details: { finalDispositionCount: finalDispositions.length, providerPlansCreated: providerPlanIdsCreated.length },
    },
    {
      name: "verification_attempts_may_exceed_unique_plans",
      pass: true,
      details: {
        cleanupVerificationAttempts: cleanupResults.filter((item) => item.terminalVerificationAttempted).length,
        uniqueVerified: explicitPlanIds.size,
      },
    },
    {
      name: "all_provider_created_plans_have_allowed_final_disposition",
      pass: finalDispositions.every((item) => [
        "explicitly_terminal",
        "cleanup_not_required",
        "cancel_accepted_evidence_unavailable",
        "cleanup_failed",
        "unresolved",
      ].includes(item.disposition)),
      details: { finalDispositions },
    },
  ];
  return {
    providerPlansStaged: actions.filter((action: any) => action.responseStatus === "provider_submission_disabled_by_configuration" || action.responseStatus === "staged").length,
    providerPlansSubmitted: actions.filter((action: any) => action.action === "file" && ["accepted", "dry_run"].includes(String(action.responseStatus))).length,
    providerPlansCreated: providerPlanIdsCreated.length,
    providerPlanIdsCreated,
    uniqueProviderPlansRequiringCleanup,
    cleanupVerificationAttempts: cleanupResults.filter((item) => item.terminalVerificationAttempted).length,
    uniquePlansExplicitlyTerminalVerified: explicitPlanIds.size,
    providerPlansBlockedBeforeSubmission: actions.filter((action: any) => action.blockedBeforeLeidos).length,
    immediateCleanupTotal: immediate.length,
    immediateCleanupAttempted: immediate.filter((item) => item.cancelAttempted || item.action === "close").length,
    immediateCleanupCancelled: immediate.filter((item) => item.action === "cancel" && ["accepted", "dry_run"].includes(String(item.responseStatus))).length,
    immediateCleanupCancelAccepted: immediate.filter((item) => item.action === "cancel" && ["accepted", "dry_run"].includes(String(item.responseStatus))).length,
    immediateCleanupTerminalStateExplicitlyVerified: immediateExplicitPlanIds.size,
    immediateCleanupAcceptedButTerminalEvidenceUnavailable: immediate.filter((item) => item.finalCleanupDisposition === "accepted_unverified").length,
    immediateCleanupErrors: immediate.filter((item) => item.pass === false).length,
    finalSweepTotal: finalSweep.length,
    finalSweepCancelled: finalSweep.filter((item) => item.action === "cancel" && ["accepted", "dry_run"].includes(String(item.responseStatus))).length,
    finalSweepClosed: finalSweep.filter((item) => item.action === "close" && ["accepted", "dry_run"].includes(String(item.responseStatus))).length,
    finalSweepNewlyVerified: finalSweepNewlyVerifiedPlanIds.length,
    finalSweepReconfirmedAlreadyVerified: finalSweepReconfirmedPlanIds.length,
    cancelAccepted: cancelAccepted.length,
    terminalStateExplicitlyVerified: explicitPlanIds.size,
    acceptedButTerminalEvidenceUnavailable: acceptedUnverified.length,
    cancelled: cancelAccepted.length,
    closed: cleanupResults.filter((item) => item.action === "close" && ["accepted", "dry_run"].includes(String(item.responseStatus))).length,
    alreadyTerminal: cleanupResults.filter((item) => item.responseStatus === "already_terminal").length,
    cleanupNotRequired: cleanupResults.filter((item) => ["not_required", "staged_only_not_submitted"].includes(String(item.responseStatus))).length,
    cleanupErrors: cleanupResults.filter((item) => item.pass === false).length,
    unresolvedProviderPlans,
    cleanupFinalDispositions: finalDispositions,
    consistencyChecks,
    unresolvedPlans: unresolved.map((item) => ({
      certificationCaseId: item.certificationCaseId || null,
      planId: item.planId || null,
      providerPlanId: item.providerPlanId || null,
      flightRules: item.flightRules || null,
      departureTime: item.departureTime || null,
      currentLifecycle: item.priorStatus || null,
      cleanupActionAttempted: item.action || null,
      providerRejection: Array.isArray(item.errors) ? item.errors.join(" | ") : item.errors || null,
      recommendedHandling: item.recommendedHandling || "Review provider state, sync the plan, then run cleanup-only for this certification run.",
      automaticProviderClosureExpected: Boolean(item.automaticProviderClosureExpected),
    })),
  };
};

export const buildTerminalVerificationSummary = (results: any[]) => {
  const terminalActions = results
    .flatMap((item) => (item.actions || []).map((action: any) => ({
      certificationCaseId: item.certificationCaseId,
      seed: item.seed,
      testName: item.testName,
      action,
    })))
    .filter((item) => item.action?.terminalAction);
  const verifications = terminalActions
    .map((item) => item.action.terminalVerification)
    .filter(Boolean);
  return {
    totalTerminalActions: terminalActions.length,
    providerAccepted: terminalActions.filter((item) => item.action.providerActionAccepted).length,
    providerRejected: terminalActions.filter((item) => item.action.providerActionRejected).length,
    versionStampRequiredAndMissing: terminalActions.filter((item) => item.action.versionStampMissingClassification === "required_missing").length,
    versionStampOptionalMissingAfterTerminal: terminalActions.filter((item) => item.action.versionStampMissingClassification === "optional_missing_after_terminal_action").length,
    passed: verifications.filter((item) => item.status === "PASS").length,
    review: verifications.filter((item) => item.status === "REVIEW").length,
    failed: verifications.filter((item) => item.status === "FAIL").length,
    cases: terminalActions.map((item) => ({
      certificationCaseId: item.certificationCaseId,
      seed: item.seed,
      testName: item.testName,
      action: item.action.action,
      providerPlanId: item.action.providerPlanId,
      responseStatus: item.action.responseStatus,
      providerActionAccepted: item.action.providerActionAccepted,
      providerActionRejected: item.action.providerActionRejected,
      versionStampRequired: item.action.versionStampRequired,
      versionStampMissingClassification: item.action.versionStampMissingClassification,
      terminalVerification: item.action.terminalVerification || null,
    })),
  };
};

export const buildLifecycleEvidenceSummary = (results: any[]) => {
  const lifecycleCases = results.filter((item) => (item.actions || []).some((action: any) => action.action === "activate" || action.action === "close"));
  return {
    cases: lifecycleCases.map((item) => {
      const activateAction = (item.actions || []).find((action: any) => action.action === "activate") || {};
      const closeAction = (item.actions || []).find((action: any) => action.action === "close") || {};
      const activationVerification = activateAction.activationVerification || {};
      const closeVerification = closeAction.terminalVerification || {};
      return {
        certificationCaseId: item.certificationCaseId,
        seed: item.seed,
        testName: item.testName,
        activateAccepted: Boolean(activateAction.activateAccepted),
        activationVerificationAttempted: Boolean(activateAction.activationVerificationAttempted),
        activationVerificationMatched: Boolean(activateAction.activationVerificationMatched),
        activationEvidenceKind: activateAction.activationEvidenceKind || activationVerification.activationEvidenceKind || null,
        activationEvidenceSource: activateAction.activationEvidenceSource || activationVerification.activationEvidenceSource || null,
        activationPollCount: activateAction.activationPollCount ?? activationVerification.activationPollCount ?? null,
        activationTimedOut: Boolean(activateAction.activationTimedOut),
        activatedAt: activateAction.activatedAt || activationVerification.activatedAt || null,
        closeAccepted: Boolean(closeAction.closeAccepted),
        closeVerificationMatched: Boolean(closeAction.closeVerificationMatched),
        closeEvidenceKind: closeAction.closeEvidenceKind || closeVerification.evidenceKind || null,
        closeEvidenceSource: closeAction.closeEvidenceSource || closeVerification.evidenceSource || null,
        closedAt: closeAction.closedAt || null,
        lifecycleEvidenceComplete: Boolean(activateAction.activationVerificationMatched && closeAction.closeVerificationMatched),
      };
    }),
  };
};

const getTerminalEvidencePollingConfig = () => ({
  timeoutMs: Math.max(0, Number(process.env.LEIDOS_LAB_TERMINAL_EVIDENCE_TIMEOUT_MS || DEFAULT_TERMINAL_EVIDENCE_POLL_TIMEOUT_MS)),
  intervalMs: Math.max(250, Number(process.env.LEIDOS_LAB_TERMINAL_EVIDENCE_POLL_INTERVAL_MS || DEFAULT_TERMINAL_EVIDENCE_POLL_INTERVAL_MS)),
});

const waitForPersistedTerminalLifecycleEvidence = async ({
  planId,
  providerPlanId,
  expectedStatus,
  dryRun,
  baseline,
}: {
  planId: string;
  providerPlanId: string | null;
  expectedStatus: string | null;
  dryRun: boolean;
  baseline?: TerminalActionEvidenceBaseline | null;
}) => {
  const config = getTerminalEvidencePollingConfig();
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  let polls = 0;
  let lastPlan: FlightPlan | undefined;
  let lastEvidence = classifyLifecycleEvidence(null, expectedStatus);
  let lastObservation = evaluateTerminalEvidenceObservation({ evidence: lastEvidence, expectedStatus, baseline });
  const observations: any[] = [];
  console.info(JSON.stringify({
    event: "leidos_terminal_evidence_poll_started",
    planId,
    providerPlanId,
    expectedStatus,
    actionBaselineVersion: baseline?.versionStamp || null,
    baselineEventHash: baseline?.eventHash || null,
    baselineLifecycle: baseline?.lifecycle || null,
    actionStartedAt: baseline?.actionStartedAt || null,
    timeoutMs: config.timeoutMs,
    intervalMs: config.intervalMs,
    dryRun,
  }));

  if (dryRun || !planId || config.timeoutMs <= 0) {
    return {
      startedAt,
      completedAt: new Date().toISOString(),
      timeoutMs: config.timeoutMs,
      intervalMs: config.intervalMs,
      polls,
      timedOut: false,
      matched: false,
      decision: "not_attempted",
      observations,
      plan: lastPlan,
      evidence: lastEvidence,
    };
  }

  while (Date.now() - startedAtMs <= config.timeoutMs) {
    polls += 1;
    lastPlan = await storage.getFlightPlanById(planId);
    const snapshot = lastPlan?.filingProviderSnapshot;
    lastEvidence = classifyLifecycleEvidence(snapshot, expectedStatus);
    const persistedProviderPlanId = String((snapshot as any)?.providerPlanId || lastPlan?.filingProviderPlanId || "").trim();
    const providerPlanMatches = !providerPlanId || persistedProviderPlanId === providerPlanId;
    lastObservation = evaluateTerminalEvidenceObservation({ evidence: lastEvidence, expectedStatus, baseline });
    observations.push({
      poll: polls,
      lifecycle: lastEvidence.lifecycle || null,
      evidenceKind: lastEvidence.kind,
      evidenceSource: lastEvidence.source,
      versionStamp: lastEvidence.versionStamp || null,
      eventHash: lastEvidence.eventHash || null,
      decision: providerPlanMatches ? lastObservation.decision : "provider_plan_mismatch",
      predatesAction: lastObservation.predatesAction,
      transitional: lastObservation.transitional,
      matchingTerminal: lastObservation.isMatchingTerminal,
      contradictoryTerminal: lastObservation.isContradictoryTerminal,
      elapsedMs: Date.now() - startedAtMs,
    });
    if (providerPlanMatches && lastEvidence.hasExplicitProviderEvidence) {
      if (lastObservation.decision === "matching_terminal_evidence") {
        console.info(JSON.stringify({
          event: "leidos_terminal_evidence_poll_matched",
          planId,
          providerPlanId,
          expectedStatus,
          polls,
          evidenceKind: lastEvidence.kind,
          effectiveLifecycle: lastEvidence.lifecycle,
          evidenceSource: lastEvidence.source,
          observedEvidenceVersion: lastEvidence.versionStamp || null,
          observedEventHash: lastEvidence.eventHash || null,
          actionBaselineVersion: baseline?.versionStamp || null,
          baselineEventHash: baseline?.eventHash || null,
          decision: lastObservation.decision,
          elapsedMs: Date.now() - startedAtMs,
        }));
        return {
          startedAt,
          completedAt: new Date().toISOString(),
          timeoutMs: config.timeoutMs,
          intervalMs: config.intervalMs,
          polls,
          timedOut: false,
          matched: true,
          decision: lastObservation.decision,
          observations,
          plan: lastPlan,
          evidence: lastEvidence,
        };
      }
      if (lastObservation.decision === "contradictory_terminal_evidence") {
        console.info(JSON.stringify({
          event: "leidos_terminal_evidence_poll_contradicted",
          planId,
          providerPlanId,
          expectedStatus,
          polls,
          evidenceKind: lastEvidence.kind,
          effectiveLifecycle: lastEvidence.lifecycle,
          evidenceSource: lastEvidence.source,
          observedEvidenceVersion: lastEvidence.versionStamp || null,
          observedEventHash: lastEvidence.eventHash || null,
          actionBaselineVersion: baseline?.versionStamp || null,
          baselineEventHash: baseline?.eventHash || null,
          decision: lastObservation.decision,
          elapsedMs: Date.now() - startedAtMs,
        }));
        return {
          startedAt,
          completedAt: new Date().toISOString(),
          timeoutMs: config.timeoutMs,
          intervalMs: config.intervalMs,
          polls,
          timedOut: false,
          matched: false,
          decision: lastObservation.decision,
          observations,
          plan: lastPlan,
          evidence: lastEvidence,
        };
      }
      console.info(JSON.stringify({
        event: "leidos_terminal_evidence_poll_observed",
        planId,
        providerPlanId,
        expectedStatus,
        polls,
        evidenceKind: lastEvidence.kind,
        effectiveLifecycle: lastEvidence.lifecycle,
        evidenceSource: lastEvidence.source,
        observedEvidenceVersion: lastEvidence.versionStamp || null,
        observedEventHash: lastEvidence.eventHash || null,
        actionBaselineVersion: baseline?.versionStamp || null,
        baselineEventHash: baseline?.eventHash || null,
        predatesAction: lastObservation.predatesAction,
        transitional: lastObservation.transitional,
        decision: lastObservation.decision,
        elapsedMs: Date.now() - startedAtMs,
      }));
    }
    await sleep(Math.min(config.intervalMs, Math.max(0, config.timeoutMs - (Date.now() - startedAtMs))));
  }

  console.info(JSON.stringify({
    event: "leidos_terminal_evidence_poll_completed",
    planId,
    providerPlanId,
    expectedStatus,
    polls,
    timedOut: true,
    lastEvidenceKind: lastEvidence.kind,
    lastLifecycle: lastEvidence.lifecycle,
    finalDecisionReason: lastObservation.decision === "transitional_nonterminal_evidence"
      ? "terminal_verification_timeout_after_transitional_nonterminal_evidence"
      : "terminal_verification_timeout",
  }));
  return {
    startedAt,
    completedAt: new Date().toISOString(),
    timeoutMs: config.timeoutMs,
    intervalMs: config.intervalMs,
    polls,
    timedOut: true,
    matched: false,
    decision: lastObservation.decision === "contradictory_terminal_evidence" ? "contradictory_terminal_evidence" : "terminal_verification_timeout",
    observations,
    plan: lastPlan,
    evidence: lastEvidence,
  };
};

const verifyTerminalActionState = async (
  plan: FlightPlan,
  action: CaseAction,
  response: Awaited<ReturnType<typeof flightPlanFilingProvider.stageAction>>,
  dryRun: boolean,
  baseline?: TerminalActionEvidenceBaseline | null,
) => {
  const expectedStatus = expectedTerminalStatusForAction(action);
  const localStatus = String(plan.filingStatus || "").trim().toLowerCase();
  const localTerminalStateConfirmed = Boolean(expectedStatus && localStatus === expectedStatus);
  const providerPlanId = String(plan.filingProviderPlanId || response.providerPlanId || "").trim();
  const rawResponse = response.raw?.response && typeof response.raw.response === "object"
    ? response.raw.response as Record<string, any>
    : {};
  const returnStatus = typeof rawResponse.returnStatus === "boolean" ? rawResponse.returnStatus : null;
  const responseMessages = Array.isArray(response.providerMessages)
    ? response.providerMessages.map((message: any) => message?.message || message?.text || message?.summary).filter(Boolean)
    : [];

  let providerRetrieveStatus: "not_attempted" | "success" | "error" = dryRun || !providerPlanId ? "not_attempted" : "success";
  let providerLifecycleStatus: string | null = null;
  let providerStatus: string | null = null;
  let providerVersionStamp: string | null = null;
  let providerRetrieveMessage: string | null = null;
  let providerRetrieveError: string | null = null;
  let retrieveSnapshot: Record<string, any> | null = null;

  if (!dryRun && providerPlanId) {
    try {
      const sync = await syncLeidosPlanMetadata(plan);
      providerVersionStamp = sync.versionStamp || null;
      retrieveSnapshot = sync.providerSnapshot && typeof sync.providerSnapshot === "object" && !Array.isArray(sync.providerSnapshot)
        ? sync.providerSnapshot as Record<string, any>
        : null;
      providerLifecycleStatus = String(retrieveSnapshot?.providerLifecycleStatus || "").trim() || null;
      providerStatus = String(retrieveSnapshot?.providerStatus || "").trim() || null;
      providerRetrieveMessage = sync.message || null;
    } catch (error) {
      providerRetrieveStatus = "error";
      providerRetrieveError = String((error as any)?.message || error);
    }
  }

  const retrieveEvidence = classifyLifecycleEvidence(retrieveSnapshot, expectedStatus);
  const retrieveIncludedLifecycle = Boolean(retrieveEvidence.hasExplicitProviderEvidence);
  const pollResult = !dryRun && providerPlanId && expectedStatus && returnStatus !== false
    ? await waitForPersistedTerminalLifecycleEvidence({
      planId: plan.id,
      providerPlanId,
      expectedStatus,
      dryRun,
      baseline,
    })
    : null;
  const persistedEvidence = pollResult?.evidence || classifyLifecycleEvidence((plan.filingProviderSnapshot as any) || null, expectedStatus);
  const effectiveEvidence = retrieveEvidence.hasExplicitProviderEvidence
    ? retrieveEvidence
    : persistedEvidence.hasExplicitProviderEvidence
      ? persistedEvidence
      : persistedEvidence;
  const providerTerminalLifecycle = isTerminalProviderStatus(effectiveEvidence.lifecycle, action);
  const providerTerminalStatus = isTerminalProviderStatus(providerStatus, action);
  const pollDecision = String(pollResult?.decision || "").trim() || null;
  const providerTerminalStateConfirmed = Boolean(
    effectiveEvidence.hasExplicitProviderEvidence &&
    providerTerminalLifecycle === true
  );
  const terminalActionAccepted = returnStatus !== false && response.live;
  const verificationReason = !terminalActionAccepted
    ? "Provider terminal action was not accepted."
    : !localTerminalStateConfirmed
      ? "Local plan state did not match the expected terminal lifecycle."
      : effectiveEvidence.conflictsWithExpected
        ? "Explicit provider lifecycle conflicts with the expected terminal state."
        : pollDecision === "contradictory_terminal_evidence"
          ? "Explicit newer terminal provider lifecycle conflicts with the expected terminal state."
          : providerTerminalStateConfirmed
          ? retrieveEvidence.hasExplicitProviderEvidence
            ? `${action.toUpperCase()} was accepted by Leidos and the direct retrieve response explicitly reported ${String(effectiveEvidence.lifecycle || "").toUpperCase()}.`
            : `${action.toUpperCase()} was accepted by Leidos. The immediate retrieve response omitted flight state. A validated Leidos webhook subsequently reported ${String(effectiveEvidence.lifecycle || "").toUpperCase()}, satisfying terminal verification.`
          : `${action.toUpperCase()} was accepted and RSF transitioned locally to ${String(expectedStatus || "").toUpperCase()}, but no explicit matching provider lifecycle was received before the certification timeout.`;
  const status = !localTerminalStateConfirmed
    ? "FAIL"
    : !terminalActionAccepted || pollDecision === "contradictory_terminal_evidence" || providerTerminalStatus === false
      ? "FAIL"
      : providerTerminalStateConfirmed
        ? "PASS"
        : "REVIEW";

  const verification = {
    action,
    expectedLocalStatus: expectedStatus,
    expectedTerminalLifecycle: expectedStatus,
    localStatus,
    localTerminalStateConfirmed,
    providerPlanId: providerPlanId || null,
    providerRetrieveStatus,
    providerLifecycleStatus,
    providerStatus,
    explicitLifecycleValue: effectiveEvidence.explicitLifecycleValue,
    effectiveLifecycle: effectiveEvidence.lifecycle || localStatus || null,
    evidenceKind: effectiveEvidence.kind,
    evidenceSource: effectiveEvidence.source,
    evidenceReason: effectiveEvidence.reason,
    evidenceTime: effectiveEvidence.evidenceTime,
    providerEventTimestamp: effectiveEvidence.providerEventTimestamp,
    rsfReceiptTimestamp: effectiveEvidence.rsfReceiptTimestamp,
    webhookProcessingTimestamp: effectiveEvidence.webhookProcessingTimestamp,
    retrieveIncludedLifecycle,
    providerTerminalStateConfirmed,
    providerVersionStamp,
    providerVersionStampExpected: false,
    providerVersionStampMissingSeverity: providerVersionStamp ? "none" : "info",
    returnStatus,
    responseMessages,
    providerRetrieveMessage,
    providerRetrieveError,
    polling: pollResult
      ? {
        startedAt: pollResult.startedAt,
        completedAt: pollResult.completedAt,
        timeoutMs: pollResult.timeoutMs,
        intervalMs: pollResult.intervalMs,
        pollCount: pollResult.polls,
        timedOut: pollResult.timedOut,
        matched: pollResult.matched,
        decision: pollResult.decision,
        observations: pollResult.observations,
      }
      : {
        startedAt: null,
        completedAt: null,
        timeoutMs: getTerminalEvidencePollingConfig().timeoutMs,
        intervalMs: getTerminalEvidencePollingConfig().intervalMs,
        pollCount: 0,
        timedOut: false,
        matched: false,
        decision: null,
        observations: [],
      },
    actionBaseline: baseline || null,
    cleanupCancellationAttempted: false,
    cleanupActionExpected: localTerminalStateConfirmed ? "verify" : "review",
    reason: verificationReason,
    status,
  };

  console.info(JSON.stringify({
    event: "leidos_terminal_action_verification",
    action,
    providerPlanId: providerPlanId || null,
    returnStatus,
    responseMessages,
    terminalAction: true,
    versionStampExpected: false,
    providerVersionStampMissingSeverity: verification.providerVersionStampMissingSeverity,
    localStatus,
    expectedLocalStatus: expectedStatus,
    providerLifecycleStatus,
    providerStatus,
    providerRetrieveStatus,
    retrieveIncludedLifecycle,
    effectiveLifecycle: verification.effectiveLifecycle,
    evidenceKind: verification.evidenceKind,
    evidenceSource: verification.evidenceSource,
    reason: verificationReason,
    polling: verification.polling,
    cleanupCancellationAttempted: false,
    status,
  }));

  return verification;
};

export const verifyActivationActionState = async (
  plan: FlightPlan,
  response: Awaited<ReturnType<typeof flightPlanFilingProvider.stageAction>>,
  dryRun: boolean,
) => {
  const expectedStatus = "activated";
  const localStatus = String(plan.filingStatus || "").trim().toLowerCase();
  const localActivatedStateConfirmed = localStatus === expectedStatus;
  const providerPlanId = String(plan.filingProviderPlanId || response.providerPlanId || "").trim();
  const rawResponse = response.raw?.response && typeof response.raw.response === "object"
    ? response.raw.response as Record<string, any>
    : {};
  const returnStatus = typeof rawResponse.returnStatus === "boolean" ? rawResponse.returnStatus : null;
  const activationAccepted = returnStatus !== false && response.live;
  const pollResult = !dryRun && providerPlanId && activationAccepted
    ? await waitForPersistedTerminalLifecycleEvidence({
      planId: plan.id,
      providerPlanId,
      expectedStatus,
      dryRun,
    })
    : null;
  const evidence = pollResult?.evidence || classifyLifecycleEvidence((plan.filingProviderSnapshot as any) || null, expectedStatus);
  const activationVerificationMatched = Boolean(
    evidence.hasExplicitProviderEvidence &&
    evidence.lifecycle === expectedStatus
  );
  const status = !activationAccepted || evidence.conflictsWithExpected
    ? "FAIL"
    : activationVerificationMatched
      ? "PASS"
      : "REVIEW";
  const verification = {
    action: "activate",
    activateAccepted: activationAccepted,
    activationVerificationAttempted: Boolean(!dryRun && providerPlanId && activationAccepted),
    activationVerificationMatched,
    activationEvidenceKind: evidence.kind,
    activationEvidenceSource: evidence.source,
    activationEvidenceReason: evidence.reason,
    activationPollCount: pollResult?.polls || 0,
    activationTimedOut: Boolean(pollResult?.timedOut),
    activatedAt: activationVerificationMatched ? evidence.evidenceTime || evidence.webhookProcessingTimestamp || new Date().toISOString() : null,
    expectedLifecycle: expectedStatus,
    localStatus,
    localActivatedStateConfirmed,
    providerPlanId: providerPlanId || null,
    explicitLifecycleValue: evidence.explicitLifecycleValue,
    effectiveLifecycle: evidence.lifecycle || localStatus || null,
    hasExplicitProviderEvidence: evidence.hasExplicitProviderEvidence,
    status,
    reason: activationVerificationMatched
      ? "ACTIVATE was accepted and explicit provider lifecycle evidence reported ACTIVATED."
      : activationAccepted
        ? "ACTIVATE was accepted, but explicit provider ACTIVATED lifecycle evidence was not received before the certification timeout."
        : "ACTIVATE was not accepted by the provider.",
  };
  console.info(JSON.stringify({
    event: "leidos_activation_action_verification",
    action: "activate",
    providerPlanId: providerPlanId || null,
    activateAccepted: verification.activateAccepted,
    activationVerificationAttempted: verification.activationVerificationAttempted,
    activationVerificationMatched,
    activationEvidenceKind: verification.activationEvidenceKind,
    activationEvidenceSource: verification.activationEvidenceSource,
    activationPollCount: verification.activationPollCount,
    activationTimedOut: verification.activationTimedOut,
    localStatus,
    effectiveLifecycle: verification.effectiveLifecycle,
    status,
  }));
  return verification;
};

const safeExec = (command: string) => {
  try {
    return execSync(command, { cwd: process.cwd(), stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
};

export const buildCertificationVersion = (diagnostics?: ReturnType<typeof assertLabEndpoint>, context?: DedicatedTestContext) => {
  let database = "unknown";
  try {
    const raw = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
    database = raw ? `${raw.protocol}//${raw.hostname}${raw.pathname}` : "not configured";
  } catch {
    database = "configured";
  }
  return {
    rsfBuildVersion: process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version || "1.0.0",
    gitCommitHash: process.env.RENDER_GIT_COMMIT || safeExec("git rev-parse --short HEAD"),
    certificationSuiteVersion: CERTIFICATION_SUITE_VERSION,
    flightServiceModuleVersion: FLIGHT_SERVICE_MODULE_VERSION,
    environment: diagnostics?.environment || process.env.NODE_ENV || "unknown",
    database,
    generatedTimestamp: new Date().toISOString(),
    operator: context ? "verified LAB test account" : "unknown",
  };
};

const EVIDENCE_OMITTED_KEYS = new Set([
  "generatedpayload",
  "providerpayload",
  "payloadsenttoleidos",
  "leidosresponse",
  "requestpayload",
  "response",
  "raw",
  "filingraw",
  "filingpayload",
]);

const isSensitiveEvidenceKey = (key: string) =>
  /email|phone|pilotname|pilotdata|pilotincommand|password|credential|authorization|username|supplementalremarks|suppremark|operator|database|tailnumber|aircraftid|homebase|userid/i.test(key);

export const sanitizeCertificationEvidence = (value: unknown, sensitiveValues: string[] = [], key = ""): unknown => {
  const normalizedKey = key.toLowerCase();
  if (EVIDENCE_OMITTED_KEYS.has(normalizedKey)) return "[omitted from evidence artifact]";
  if (isSensitiveEvidenceKey(key)) {
    if (typeof value === "boolean") return value;
    return value == null ? value : "[redacted]";
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeCertificationEvidence(entry, sensitiveValues));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const comparisonField = String(record.field || "").toLowerCase();
    const redactComparison = /phone|pilot|supplemental|homebase/.test(comparisonField);
    return Object.fromEntries(Object.entries(record).map(([entryKey, entryValue]) => [
      entryKey,
      redactComparison && !["field", "issue", "classification", "severity", "comparisonResult"].includes(entryKey)
        ? "[redacted]"
        : sanitizeCertificationEvidence(entryValue, sensitiveValues, entryKey),
    ]));
  }
  if (typeof value === "string") {
    let sanitized = value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]");
    for (const sensitiveValue of sensitiveValues.filter((entry) => entry.length >= 3)) {
      sanitized = sanitized.replaceAll(sensitiveValue, "[redacted]");
    }
    return sanitized;
  }
  return value;
};

export const buildValidationSummary = (results: any[], cases: LiveLabCase[]) => {
  const caseBySeed = new Map(cases.map((testCase) => [testCase.seed, testCase]));
  const executed = results.length;
  const passed = results.filter((item) => item.pass).length;
  const failed = results.filter((item) => !item.pass).length;
  const skipped = results.filter((item) => item.skipped).length;
  const blocked = results.flatMap((item) => item.actions || []).filter((action) => action.blockedBeforeLeidos).length;
  const testDesignFailures = results.reduce((sum, item) => sum + (Array.isArray(item.testDesignFailures) ? item.testDesignFailures.length : 0), 0);
  const blockedActions = results.flatMap((item) => (item.actions || []).map((action: any) => ({ action, result: item }))).filter((item) => item.action.blockedBeforeLeidos);
  const expectedValidationBlocks = blockedActions.filter((item) => caseBySeed.get(item.result.seed)?.expectedBlockedBeforeLeidos).length;
  const unexpectedValidationFailures = blockedActions.filter((item) => !caseBySeed.get(item.result.seed)?.expectedBlockedBeforeLeidos).length;
  const payloadValidationFailures = unexpectedValidationFailures;
  return {
    executed,
    passed,
    blocked,
    failed,
    skipped,
    testDesignFailures,
    payloadValidationFailures,
    expectedValidationBlocks,
    unexpectedValidationFailures,
    positiveTestsPassed: results.filter((item) => {
      const testCase = caseBySeed.get(item.seed);
      return (testCase ? isNonNegativeCase(testCase) : item.testType !== "Negative") && item.pass;
    }).length,
    negativeTestsPassed: results.filter((item) => {
      const testCase = caseBySeed.get(item.seed);
      return (testCase ? Boolean(testCase.expectedBlockedBeforeLeidos) : item.testType === "Negative") && item.pass;
    }).length,
    byType: ["Positive", "Negative", "Lifecycle", "Cleanup", "Round Trip"].map((testType) => ({
      testType,
      total: results.filter((item) => item.testType === testType).length,
      passed: results.filter((item) => item.testType === testType && item.pass).length,
      failed: results.filter((item) => item.testType === testType && !item.pass).length,
      blocked: results.filter((item) => item.testType === testType).flatMap((item) => item.actions || []).filter((action) => action.blockedBeforeLeidos).length,
    })),
  };
};

export const buildReadinessAssessment = (validationSummary: any, cleanupSummary: any, cleanupVerification: any, providerRoundTrip: any) => {
  const positiveTotal = validationSummary.byType.find((item: any) => item.testType === "Positive")?.total || 0;
  const positivePassed = validationSummary.byType.find((item: any) => item.testType === "Positive")?.passed || 0;
  const negativeTotal = validationSummary.byType.find((item: any) => item.testType === "Negative")?.total || 0;
  const negativePassed = validationSummary.byType.find((item: any) => item.testType === "Negative")?.passed || 0;
  const lifecycleFailures = validationSummary.byType
    .filter((item: any) => ["Lifecycle", "Round Trip"].includes(item.testType))
    .reduce((sum: number, item: any) => sum + item.failed, 0);
  const criticalFailures = validationSummary.failed + cleanupSummary.cleanupErrors + providerRoundTrip.failed;
  const warnings = providerRoundTrip.cases.reduce((sum: number, item: any) => sum + (item.comparisonFailures?.length || 0), 0);
  const overallStatus = criticalFailures === 0
    ? "LAB EXECUTION COMPLETED - READY FOR LEIDOS REVIEW"
    : "LAB EXECUTION COMPLETED - REMEDIATION REQUIRED";
  return {
    title: "LEIDOS CERTIFICATION READINESS",
    environment: "LAB",
    positiveTests: `${positivePassed}/${positiveTotal}`,
    negativeValidation: `${negativePassed}/${negativeTotal}`,
    lifecycle: lifecycleFailures === 0 ? "PASS" : "FAIL",
    cleanup: cleanupVerification.status,
    providerRoundTrip: providerRoundTrip.failed === 0 ? "PASS" : "FAIL",
    criticalFailures,
    warnings,
    overallStatus,
  };
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const badge = (status: unknown) => {
  const text = String(status || "").toUpperCase();
  const cls = text === "PASS" || text.includes("READY") || text === "MATCH" ? "pass" : text === "BLOCKED" ? "blocked" : "fail";
  return `<span class="badge ${cls}">${escapeHtml(text || "-")}</span>`;
};

export const buildCertificationHtml = (report: any) => {
  const rows = (items: any[]) => items.map((item) => `
    <tr>
      <td>${escapeHtml(item.testName || item.certificationCaseId)}</td>
      <td>${escapeHtml(item.testType || "-")}</td>
      <td>${badge(item.pass ? "PASS" : "FAIL")}</td>
      <td>${escapeHtml((item.errors || []).join(" | ") || "-")}</td>
    </tr>
  `).join("");
  const fieldRows = (report.providerRoundTrip?.cases || []).flatMap((roundTrip: any) =>
    (roundTrip.fieldComparisons || []).map((comparison: any) => `
        <tr>
          <td>${escapeHtml(roundTrip.testName)}</td>
          <td>${escapeHtml(comparison.field)}</td>
          <td>${badge(comparison.comparisonResult)}</td>
          <td><pre>${escapeHtml(JSON.stringify({
            generated: comparison.generated,
            sent: comparison.providerPayload,
            returned: comparison.providerResponse,
            stored: comparison.stored,
          }, null, 2))}</pre></td>
        </tr>
      `)
  ).join("");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>RSF Leidos Certification Report</title>
  <style>
    body { font-family: Arial, sans-serif; color: #172033; margin: 32px; line-height: 1.45; }
    h1, h2 { color: #0b1220; }
    section { margin: 24px 0; page-break-inside: avoid; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #d8dee9; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #eef2f7; }
    pre { white-space: pre-wrap; margin: 0; font-size: 11px; }
    .badge { border-radius: 999px; padding: 3px 8px; font-size: 12px; font-weight: 700; }
    .pass { background: #dcfce7; color: #166534; }
    .fail { background: #fee2e2; color: #991b1b; }
    .blocked { background: #fef3c7; color: #92400e; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 24px; }
  </style>
</head>
<body>
  <h1>RSF Leidos Certification Report</h1>
  <section>
    <h2>${escapeHtml(report.readinessAssessment?.title || "LEIDOS CERTIFICATION READINESS")}</h2>
    <div class="grid">
      <div><strong>Environment:</strong> ${escapeHtml(report.readinessAssessment?.environment || report.environment)}</div>
      <div><strong>Overall Status:</strong> ${badge(report.readinessAssessment?.overallStatus || report.finalSummary?.finalResult)}</div>
      <div><strong>Positive Tests:</strong> ${escapeHtml(report.readinessAssessment?.positiveTests)}</div>
      <div><strong>Negative Validation:</strong> ${escapeHtml(report.readinessAssessment?.negativeValidation)}</div>
      <div><strong>Lifecycle:</strong> ${badge(report.readinessAssessment?.lifecycle)}</div>
      <div><strong>Cleanup:</strong> ${badge(report.readinessAssessment?.cleanup)}</div>
      <div><strong>Provider Round Trip:</strong> ${badge(report.readinessAssessment?.providerRoundTrip)}</div>
      <div><strong>Critical Failures:</strong> ${escapeHtml(report.readinessAssessment?.criticalFailures)}</div>
    </div>
  </section>
  <section><h2>Environment</h2><pre>${escapeHtml(JSON.stringify(report.environmentDetails || {}, null, 2))}</pre></section>
  <section><h2>Operator</h2><pre>${escapeHtml(JSON.stringify(report.operator || {}, null, 2))}</pre></section>
  <section><h2>Aircraft</h2><pre>${escapeHtml(JSON.stringify(report.aircraft || {}, null, 2))}</pre></section>
  <section><h2>Case Selection</h2><pre>${escapeHtml(JSON.stringify(report.suiteSelection || {}, null, 2))}</pre></section>
  <section><h2>Lifecycle Timing</h2><pre>${escapeHtml(JSON.stringify(report.lifecycleTiming || {}, null, 2))}</pre></section>
  <section><h2>Validation Summary</h2><pre>${escapeHtml(JSON.stringify(report.validationSummary || {}, null, 2))}</pre></section>
  <section><h2>Positive Tests</h2><table><thead><tr><th>Test</th><th>Type</th><th>Status</th><th>Errors</th></tr></thead><tbody>${rows(report.positiveTests || [])}</tbody></table></section>
  <section><h2>Negative Tests</h2><table><thead><tr><th>Test</th><th>Type</th><th>Status</th><th>Errors</th></tr></thead><tbody>${rows(report.negativeTests || [])}</tbody></table></section>
  <section><h2>Lifecycle Tests</h2><table><thead><tr><th>Test</th><th>Type</th><th>Status</th><th>Errors</th></tr></thead><tbody>${rows([...(report.lifecycleTests || []), ...(report.results || []).filter((item: any) => item.testType === "Round Trip")])}</tbody></table></section>
  <section><h2>Provider Round Trip</h2><pre>${escapeHtml(JSON.stringify(report.providerRoundTrip || {}, null, 2))}</pre></section>
  <section><h2>Round Trip Comparison</h2><pre>${escapeHtml(JSON.stringify(report.roundTripComparison || {}, null, 2))}</pre></section>
  <section><h2>Field Comparisons</h2><table><thead><tr><th>Test</th><th>Field</th><th>Result</th><th>Values</th></tr></thead><tbody>${fieldRows || "<tr><td colspan=\"4\">No field comparison differences.</td></tr>"}</tbody></table></section>
  <section><h2>Lifecycle Evidence</h2><pre>${escapeHtml(JSON.stringify(report.lifecycleEvidence || {}, null, 2))}</pre></section>
  <section><h2>Terminal Verification</h2><pre>${escapeHtml(JSON.stringify(report.terminalVerification || {}, null, 2))}</pre></section>
  <section><h2>Cleanup Summary</h2><pre>${escapeHtml(JSON.stringify(report.cleanupSummary || {}, null, 2))}</pre></section>
  <section><h2>Execution Timing</h2><pre>${escapeHtml(JSON.stringify(report.executionTiming || {}, null, 2))}</pre></section>
  <section><h2>Database Persistence</h2><pre>${escapeHtml(JSON.stringify(report.databasePersistence || {}, null, 2))}</pre></section>
  <section><h2>Certification Version</h2><pre>${escapeHtml(JSON.stringify(report.certificationVersion || {}, null, 2))}</pre></section>
  <section><h2>Final Result</h2>${badge(report.finalSummary?.finalResult)}</section>
</body>
</html>`;
};

export const writeCertificationPdf = async (report: any, filePath: string) => {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]);
  let y = 750;
  const draw = (text: string, opts: { bold?: boolean; size?: number; gap?: number } = {}) => {
    const size = opts.size || 10;
    const font = opts.bold ? bold : regular;
    const lines = String(text).split("\n").flatMap((line) => line.match(/.{1,92}/g) || [""]);
    for (const line of lines) {
      if (y < 48) {
        page = pdf.addPage([612, 792]);
        y = 750;
      }
      page.drawText(line, { x: 40, y, size, font, color: rgb(0.08, 0.11, 0.18) });
      y -= size + 4;
    }
    y -= opts.gap ?? 6;
  };
  draw("RSF Leidos Certification Report", { bold: true, size: 18, gap: 12 });
  draw("Executive Summary", { bold: true, size: 13 });
  draw(JSON.stringify(report.readinessAssessment || {}, null, 2));
  draw("Environment", { bold: true, size: 13 });
  draw(JSON.stringify(report.environmentDetails || {}, null, 2));
  draw("Operator", { bold: true, size: 13 });
  draw(JSON.stringify(report.operator || {}, null, 2));
  draw("Aircraft", { bold: true, size: 13 });
  draw(JSON.stringify(report.aircraft || {}, null, 2));
  draw("Case Selection", { bold: true, size: 13 });
  draw(JSON.stringify(report.suiteSelection || {}, null, 2));
  draw("Lifecycle Timing", { bold: true, size: 13 });
  draw(JSON.stringify(report.lifecycleTiming || {}, null, 2));
  draw("Test Results", { bold: true, size: 13 });
  draw(JSON.stringify(report.validationSummary || {}, null, 2));
  draw("Cleanup", { bold: true, size: 13 });
  draw(JSON.stringify(report.cleanupSummary || {}, null, 2));
  draw("Lifecycle Evidence", { bold: true, size: 13 });
  draw(JSON.stringify(report.lifecycleEvidence || {}, null, 2));
  draw("Terminal Verification", { bold: true, size: 13 });
  draw(JSON.stringify(report.terminalVerification || {}, null, 2));
  draw("Execution Timing", { bold: true, size: 13 });
  draw(JSON.stringify(report.executionTiming || {}, null, 2));
  draw("Database Persistence", { bold: true, size: 13 });
  draw(JSON.stringify(report.databasePersistence || {}, null, 2));
  draw("Round Trip", { bold: true, size: 13 });
  draw(JSON.stringify(report.providerRoundTrip || {}, null, 2));
  draw("Round Trip Comparison", { bold: true, size: 13 });
  draw(JSON.stringify(report.roundTripComparison || {}, null, 2));
  draw("Final Certification Status", { bold: true, size: 13 });
  draw(String(report.readinessAssessment?.overallStatus || report.finalSummary?.finalResult || "UNKNOWN"), { bold: true, size: 12 });
  writeFileSync(filePath, Buffer.from(await pdf.save()));
};

export const writeCertificationArtifacts = async (report: any, jsonPath: string) => {
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  const htmlPath = jsonPath.replace(/\.json$/i, ".html");
  const pdfPath = jsonPath.replace(/\.json$/i, ".pdf");
  writeFileSync(htmlPath, buildCertificationHtml(report));
  await writeCertificationPdf(report, pdfPath);
  return { jsonPath, htmlPath, pdfPath };
};

export const persistCertificationPlan = async (plan: FlightPlan, runId: string, testCase: LiveLabCase, dryRun: boolean) => {
  const metadata = buildCertificationMetadata(runId, testCase);
  const planWithMetadata = {
    ...plan,
    id: `${runId}-case-${String(testCase.seed).padStart(2, "0")}`,
    title: `[CERT] ${plan.title}`,
    ...metadata,
    certificationAudit: {
      certificationRunId: runId,
      certificationCaseId: metadata.certificationCaseId,
      certificationCaseName: testCase.name,
      testType: testCase.testType,
      seed: testCase.seed,
      dryRun,
      actions: [],
      cleanup: [],
      createdAt: new Date().toISOString(),
    },
  } as any;
  if (dryRun) return planWithMetadata as FlightPlan;
  return await storage.createFlightPlan(planWithMetadata) as FlightPlan;
};

export const updateCertificationPlan = async (plan: FlightPlan, updates: Partial<FlightPlan>, dryRun: boolean): Promise<FlightPlan> => {
  const next = { ...plan, ...updates } as FlightPlan;
  if (dryRun) return next;
  const updated = await storage.updateFlightPlan(plan.id, updates as any);
  return (updated || next) as FlightPlan;
};

export const appendCertificationAudit = async (plan: FlightPlan, entryType: "action" | "cleanup", entry: Record<string, unknown>, dryRun: boolean) => {
  const audit = plan.certificationAudit && typeof plan.certificationAudit === "object"
    ? plan.certificationAudit as Record<string, any>
    : {};
  const key = entryType === "action" ? "actions" : "cleanup";
  const nextAudit = {
    ...audit,
    [key]: [...(Array.isArray(audit[key]) ? audit[key] : []), entry],
    updatedAt: new Date().toISOString(),
  };
  return updateCertificationPlan(plan, { certificationAudit: nextAudit } as any, dryRun);
};

export const loadCertificationPlansForRun = async (runId: string): Promise<FlightPlan[]> => {
  return await db
    .select()
    .from(flightPlans)
    .where(and(eq(flightPlans.certificationRunId, runId), eq(flightPlans.isCertificationTest, true)));
};

export const isCleanupBlockingError = (error: unknown) => {
  const message = String((error as any)?.message || error || "").toLowerCase();
  return /auth|authorized|rate.?limit|too many|server|environment|production|not lab|html instead|redirected/.test(message);
};

export const cleanupCertificationPlans = async (plans: FlightPlan[], dryRun: boolean, cleanupPhase = "final_sweep") => {
  const cleanupResults: any[] = [];
  for (const plan of plans) {
    const started = Date.now();
    const status = String(plan.filingStatus || "").toLowerCase();
    const providerPlanId = String(plan.filingProviderPlanId || "").trim();
    const versionStamp = getVersionStamp(plan);
    let cleanupAction: FlightPlanFilingAction | "verify" | "none" = "none";
    if (["cancelled", "closed"].includes(status)) cleanupAction = "verify";
    else if (status === "activated") cleanupAction = "close";
    else if (["filed", "proposed", "amended"].includes(status)) cleanupAction = "cancel";
    else if (status === "staged") cleanupAction = providerPlanId && versionStamp ? "cancel" : "none";

    const base = {
      planId: plan.id,
      certificationRunId: plan.certificationRunId,
      certificationCaseId: plan.certificationCaseId,
      providerPlanId: providerPlanId || null,
      versionStamp,
      priorStatus: plan.filingStatus,
      flightRules: plan.filingFlightRules || null,
      departureTime: plan.plannedDepartureAt ? new Date(plan.plannedDepartureAt).toISOString() : null,
      action: cleanupAction,
      cleanupPhase,
      automaticProviderClosureExpected: String(plan.filingFlightRules || "").toUpperCase() === "IFR" && cleanupAction === "cancel",
    };

    if (cleanupAction === "none" || cleanupAction === "verify") {
      const expectedStatus = cleanupAction === "verify" ? status : null;
      const terminalRecheck = cleanupAction === "verify" && providerPlanId && expectedStatus && !dryRun
        ? await waitForPersistedTerminalLifecycleEvidence({
          planId: plan.id,
          providerPlanId,
          expectedStatus,
          dryRun,
        })
        : null;
      const terminalEvidence = terminalRecheck?.evidence || classifyLifecycleEvidence((plan.filingProviderSnapshot as any) || null, expectedStatus);
      const terminalVerificationMatched = cleanupAction === "verify"
        ? Boolean(terminalEvidence.hasExplicitProviderEvidence && terminalEvidence.lifecycle === expectedStatus)
        : false;
      cleanupResults.push({
        ...base,
        responseStatus: cleanupAction === "verify" ? "already_terminal" : (status === "staged" ? "staged_only_not_submitted" : "not_required"),
        pass: true,
        cancelAttempted: false,
        cancelAccepted: false,
        cancelReturnMessages: [],
        terminalVerificationAttempted: cleanupAction === "verify",
        terminalVerificationMatched,
        terminalEvidenceKind: cleanupAction === "verify" ? terminalEvidence.kind || "local_terminal_state" : "not_required",
        terminalEvidenceSource: cleanupAction === "verify" ? terminalEvidence.source || "local_plan_status" : null,
        effectiveLifecycle: cleanupAction === "verify" ? status : null,
        pollCount: terminalRecheck?.polls || 0,
        timedOut: Boolean(terminalRecheck?.timedOut),
        finalCleanupDisposition: cleanupAction === "verify"
          ? terminalVerificationMatched
            ? "explicitly_verified_terminal"
            : "already_terminal_local"
          : "not_required",
        cleanupCancellationAttempted: false,
        elapsedMs: Date.now() - started,
      });
      continue;
    }

    if (!providerPlanId || !versionStamp) {
      const result = { ...base, responseStatus: "blocked_missing_provider_reference", pass: false, errors: ["Cleanup requires providerPlanId and versionStamp from the same certification case."], elapsedMs: Date.now() - started };
      cleanupResults.push(result);
      await appendCertificationAudit(plan, "cleanup", result, dryRun);
      continue;
    }

    if (dryRun) {
      const result = {
        ...base,
        responseStatus: "dry_run",
        pass: true,
        cancelAttempted: cleanupAction === "cancel",
        cancelAccepted: cleanupAction === "cancel",
        cancelReturnMessages: [],
        terminalVerificationAttempted: false,
        terminalVerificationMatched: false,
        terminalEvidenceKind: "dry_run",
        terminalEvidenceSource: "dry_run",
        effectiveLifecycle: cleanupAction === "cancel" ? "cancelled" : cleanupAction === "close" ? "closed" : null,
        pollCount: 0,
        timedOut: false,
        finalCleanupDisposition: "dry_run",
        elapsedMs: Date.now() - started,
      };
      cleanupResults.push(result);
      continue;
    }

    try {
      const cleanupActionBaseline = ["cancel", "close"].includes(cleanupAction)
        ? captureTerminalActionEvidenceBaseline(plan, new Date().toISOString())
        : null;
      const response = await flightPlanFilingProvider.stageAction(plan, cleanupAction);
      const updated = await updateCertificationPlan(plan, {
        filingStatus: response.nextStatus,
        filingIsLive: response.live,
        filingRaw: response.raw,
        filingProviderSnapshot: response.providerSnapshot || plan.filingProviderSnapshot,
        filingProviderMessages: response.providerMessages || plan.filingProviderMessages,
        filingPayload: response.payloadSnapshot?.transmittedFields || plan.filingPayload,
        cancelledAt: cleanupAction === "cancel" ? new Date() : plan.cancelledAt,
        closedAt: cleanupAction === "close" ? new Date() : plan.closedAt,
      } as any, dryRun);
      const terminalVerification = response.live
        ? await verifyTerminalActionState(updated, cleanupAction, response, dryRun, cleanupActionBaseline)
        : null;
      const cancelReturnMessages = Array.isArray(response.providerMessages)
        ? response.providerMessages.map((message: any) => message?.message || message?.text || message?.summary).filter(Boolean)
        : [];
      const rejectedAmbiguousTerminalAction = !response.live && isAmbiguousProviderTerminalRejection(cleanupAction, `${response.message || ""} ${cancelReturnMessages.join(" ")}`);
      const ambiguousTerminalRecheck = rejectedAmbiguousTerminalAction && expectedTerminalStatusForAction(cleanupAction as CaseAction)
        ? await waitForPersistedTerminalLifecycleEvidence({
          planId: plan.id,
          providerPlanId,
          expectedStatus: expectedTerminalStatusForAction(cleanupAction as CaseAction),
          dryRun,
          baseline: cleanupActionBaseline,
        })
        : null;
      const terminalVerificationMatched = terminalVerification?.status === "PASS";
      const ambiguousCleanupVerified = ambiguousTerminalRecheck?.matched === true;
      const finalCleanupDisposition = ambiguousCleanupVerified
        ? "cleanup_rejected_but_terminal_verified"
        : rejectedAmbiguousTerminalAction
          ? "cleanup_rejected_terminal_unverified"
          : response.live
        ? terminalVerificationMatched
          ? "explicitly_verified_terminal"
          : "accepted_unverified"
        : "staged_not_submitted";
      const result = {
        ...base,
        responseStatus: ambiguousCleanupVerified
          ? "rejected_but_terminal_verified"
          : rejectedAmbiguousTerminalAction
            ? "rejected_terminal_unverified"
            : response.live
              ? "accepted"
              : "staged",
        pass: response.live || ambiguousCleanupVerified,
        cancelAttempted: cleanupAction === "cancel",
        cancelAccepted: response.live && cleanupAction === "cancel",
        cancelReturnMessages,
        terminalVerificationAttempted: response.live || rejectedAmbiguousTerminalAction,
        terminalVerificationMatched: terminalVerificationMatched || ambiguousCleanupVerified,
        terminalEvidenceKind: terminalVerification?.evidenceKind || ambiguousTerminalRecheck?.evidence?.kind || null,
        terminalEvidenceSource: terminalVerification?.evidenceSource || ambiguousTerminalRecheck?.evidence?.source || null,
        effectiveLifecycle: terminalVerification?.effectiveLifecycle || ambiguousTerminalRecheck?.evidence?.lifecycle || response.nextStatus || null,
        pollCount: terminalVerification?.polling?.pollCount || ambiguousTerminalRecheck?.polls || 0,
        timedOut: Boolean(terminalVerification?.polling?.timedOut || ambiguousTerminalRecheck?.timedOut),
        finalCleanupDisposition,
        terminalVerification,
        ambiguousCleanupRejection: rejectedAmbiguousTerminalAction,
        ambiguousCleanupVerification: ambiguousTerminalRecheck,
        warnings: response.warnings || [],
        errors: response.live || ambiguousCleanupVerified ? [] : [response.message],
        elapsedMs: Date.now() - started,
      };
      cleanupResults.push(result);
      await appendCertificationAudit(updated, "cleanup", result, dryRun);
    } catch (error) {
      const message = String((error as any)?.message || error);
      const rejectedAmbiguousTerminalAction = isAmbiguousProviderTerminalRejection(cleanupAction, message);
      const cleanupActionBaseline = ["cancel", "close"].includes(cleanupAction)
        ? captureTerminalActionEvidenceBaseline(plan, new Date().toISOString())
        : null;
      const expectedStatus = expectedTerminalStatusForAction(cleanupAction as CaseAction);
      const ambiguousTerminalRecheck = rejectedAmbiguousTerminalAction && expectedStatus
        ? await waitForPersistedTerminalLifecycleEvidence({
          planId: plan.id,
          providerPlanId,
          expectedStatus,
          dryRun,
          baseline: cleanupActionBaseline,
        })
        : null;
      const ambiguousCleanupVerified = ambiguousTerminalRecheck?.matched === true;
      const result = {
        ...base,
        responseStatus: ambiguousCleanupVerified
          ? "error_but_terminal_verified"
          : rejectedAmbiguousTerminalAction
            ? "error_terminal_unverified"
            : "error",
        pass: ambiguousCleanupVerified,
        errors: ambiguousCleanupVerified ? [] : [message],
        ambiguousCleanupRejection: rejectedAmbiguousTerminalAction,
        terminalVerificationAttempted: rejectedAmbiguousTerminalAction,
        terminalVerificationMatched: ambiguousCleanupVerified,
        terminalEvidenceKind: ambiguousTerminalRecheck?.evidence?.kind || null,
        terminalEvidenceSource: ambiguousTerminalRecheck?.evidence?.source || null,
        effectiveLifecycle: ambiguousTerminalRecheck?.evidence?.lifecycle || null,
        pollCount: ambiguousTerminalRecheck?.polls || 0,
        timedOut: Boolean(ambiguousTerminalRecheck?.timedOut),
        finalCleanupDisposition: ambiguousCleanupVerified ? "cleanup_rejected_but_terminal_verified" : "cleanup_failed",
        ambiguousCleanupVerification: ambiguousTerminalRecheck,
        elapsedMs: Date.now() - started,
      };
      cleanupResults.push(result);
      await appendCertificationAudit(plan, "cleanup", result, dryRun);
      if (!ambiguousCleanupVerified && isCleanupBlockingError(error)) break;
    }
  }
  return cleanupResults;
};

export const shouldCleanupImmediatelyAfterCase = (testCase: LiveLabCase, caseResult: any, plan: FlightPlan) => {
  if (!caseResult.pass || testCase.expectedBlockedBeforeLeidos) return false;
  if (!testCase.actions.includes("file")) return false;
  if (testCase.actions.some((action) => action === "activate" || action === "close" || action === "cancel")) return false;
  const status = String(plan.filingStatus || "").trim().toLowerCase();
  if (["closed", "cancelled", "canceled"].includes(status)) return false;
  return Boolean(plan.filingProviderPlanId);
};

const applyImmediateCaseCleanup = async (
  plan: FlightPlan,
  testCase: LiveLabCase,
  caseResult: any,
  dryRun: boolean,
) => {
  if (!shouldCleanupImmediatelyAfterCase(testCase, caseResult, plan)) return { plan, results: [] as any[] };
  console.info(JSON.stringify({
    event: "leidos_live_lab_immediate_cleanup_started",
    certificationCaseId: caseResult.certificationCaseId,
    planId: plan.id,
    providerPlanId: plan.filingProviderPlanId || null,
    status: plan.filingStatus || null,
    reason: "cleanup_positive_nonterminal_case_before_next_delay",
  }));
  const results = await cleanupCertificationPlans([plan], dryRun, "immediate_case_cleanup");
  const failed = results.some((item) => item.pass === false);
  if (failed) {
    caseResult.pass = false;
    caseResult.errors.push(`Immediate cleanup failed for ${caseResult.certificationCaseId}.`);
  } else {
    caseResult.warnings.push("Immediate cleanup completed before continuing to the next certification case.");
  }
  const refreshed = !dryRun ? await storage.getFlightPlanById(plan.id) : undefined;
  return { plan: (refreshed || plan) as FlightPlan, results };
};

const countdown = async (minutes: number, nextName: string) => {
  const seconds = Math.max(0, Math.round(minutes * 60));
  for (let remaining = seconds; remaining > 0; remaining -= 30) {
    console.log(`Next case "${nextName}" in ${Math.ceil(remaining / 60)} minute(s)...`);
    await sleep(Math.min(30, remaining) * 1000);
  }
};

const run = async () => {
  validateCliArgs();
  const dryRun = hasFlag("dry-run") || !hasFlag("confirm-leidos-lab");
  const suite = arg("suite", "core").trim().toLowerCase() || "core";
  const delayMinutes = Math.max(0, numberArg("delay-minutes", process.env.LEIDOS_LAB_DELAY_MINUTES || "3"));
  const replay = arg("replay", "");
  const skipCleanup = hasFlag("skip-cleanup");
  const useStaticDepartureTime = hasFlag("static-departure-time");
  const cleanupOnlyRunId = arg("cleanup-only", "");
  const runId = `leidos-live-lab-${stamp()}`;

  const diagnostics = assertLabEndpoint();
  printProviderSubmissionConfiguration(diagnostics);
  if (!dryRun && !boolEnv(process.env.LEIDOS_LAB_TEST_ENABLED)) {
    throw new Error("Refusing to run: LEIDOS_LAB_TEST_ENABLED=true is required for live LAB certification.");
  }
  if (!dryRun && boolEnv(process.env.FLIGHT_SERVICE_OPERATIONAL_FILING_ENABLED || process.env.FLIGHT_FILING_OPERATIONAL_ENABLED)) {
    throw new Error("Refusing to run: production/operational filing flag is enabled.");
  }

  if (cleanupOnlyRunId) {
    const context = await loadDedicatedTestContext();
    const plans = dryRun ? [] : await loadCertificationPlansForRun(cleanupOnlyRunId);
    const cleanupResults = dryRun
      ? [{ certificationRunId: cleanupOnlyRunId, responseStatus: "dry_run", plannedAction: "Would load certification plans for this run and cancel/close only non-terminal test plans." }]
      : await cleanupCertificationPlans(plans.filter((plan) => plan.userId === context.user.id), dryRun);
    const output = {
      certificationRunId: cleanupOnlyRunId,
      dryRun,
      mode: "cleanup-only",
      endpoint: diagnostics.baseUrl,
      testAccountEmail: context.user.email || process.env.LEIDOS_TEST_USER_EMAIL,
      cleanupResults,
      finalSummary: {
        cleanupTotal: cleanupResults.length,
        cleanupPassed: cleanupResults.filter((item) => item.pass !== false).length,
        cleanupFailed: cleanupResults.filter((item) => item.pass === false).length,
      },
      createdAt: new Date().toISOString(),
    };
    const dir = join("certification-results", "leidos-live-lab");
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, `${cleanupOnlyRunId}-cleanup-${stamp()}.json`);
    writeFileSync(filePath, JSON.stringify(output, null, 2));
    console.log(`Saved cleanup results: ${filePath}`);
    if (output.finalSummary.cleanupFailed > 0 && !dryRun) process.exitCode = 1;
    return;
  }

  const context = await loadDedicatedTestContext();
  const allCases = buildCasesForSuite(context, runId, suite);
  const defaultLimit = suite === "core" ? String(MAX_CASES) : String(allCases.length);
  const limit = Math.min(allCases.length, Math.max(1, numberArg("limit", defaultLimit) || Number(defaultLimit)));
  const caseSelection = selectRequestedCases(allCases, replay ? 1 : limit, replay);
  const cases = caseSelection.cases;
  if (cases.length === 0) throw new Error(`No live LAB test case matched replay=${replay}.`);
  const dynamicTimingEnabled = !useStaticDepartureTime;
  const preflightTimingNow = new Date();
  const preflightEffectiveCases = cases.map((testCase) => ({
    testCase,
    ...applyLiveLabEffectiveDepartureTime(testCase.buildPlan(), testCase, {
      dynamicTimingEnabled,
      now: preflightTimingNow,
    }),
  }));
  if (!dryRun) {
    for (const item of preflightEffectiveCases) {
      assertEffectiveDepartureTimeNotStale(item, item.testCase, preflightTimingNow);
    }
  }
  const duplicateRiskPreflight = assertNoLiveLabDuplicateRisk(
    preflightEffectiveCases.map(({ testCase, plan }) => ({ testCase, plan })),
  );
  const previouslyPassedSeeds = loadPreviouslyPassedCaseSeeds();
  const previouslyPassedRequestedSeeds = cases
    .filter((testCase) => previouslyPassedSeeds.has(testCase.seed))
    .map((testCase) => testCase.seed);

  if (!dryRun) await promptLiveConfirmation(context, diagnostics, cases.length, delayMinutes);
  const runModeLabel = dryRun
    ? "DRY RUN"
    : diagnostics.enabled
      ? "LIVE LAB SUBMISSION RUN"
      : "LIVE LAB VALIDATION RUN - PROVIDER SUBMISSION DISABLED";
  console.log(`Leidos live LAB certification ${runModeLabel}`);
  console.log(`Endpoint: ${diagnostics.baseUrl}`);
  console.log("Test user: [verified LAB test account]");
  console.log(`Suite: ${suite}`);
  console.log(`Cases: ${cases.length}/${allCases.length}`);
  console.log(`Case selection: ${JSON.stringify(caseSelection.request)}`);
  console.log(`Skipped by selection: ${caseSelection.skippedBySelection.map((item) => item.seed).join(", ") || "-"}`);
  console.log(`Duplicate-risk preflight: PASS (${duplicateRiskPreflight.uniqueSignatureCount} unique provider-submitted FILE signatures)`);
  console.log(`Departure timing: ${dynamicTimingEnabled ? "just-in-time dynamic before each case" : "static deterministic seed time (--static-departure-time)"}`);
  console.log(`Delay requested: ${delayMinutes} minute(s)`);
  console.log("Delay policy: applied before each certification case after the first during confirmed non-dry runs.");
  console.log(`RSF DB history persistence: ${dryRun ? "disabled for dry-run" : "enabled; certification plans are saved under the configured test user"}`);
  console.log(`Cleanup: ${skipCleanup ? "SKIPPED by flag" : "enabled"}`);
  printCleanupPreview(cases);

  const results: any[] = [];
  const createdPlans: FlightPlan[] = [];
  let stoppedEarly = false;
  let providerSubmissionDisabled = false;
  const delayApplications: Array<Record<string, unknown>> = [];
  const dbPersistenceRecords: Array<Record<string, unknown>> = [];
  const immediateCleanupResults: any[] = [];
  for (const [index, testCase] of cases.entries()) {
    if (!dryRun && index > 0) {
      const startedDelayAt = new Date();
      await countdown(delayMinutes, testCase.name);
      delayApplications.push({
        beforeCaseSeed: testCase.seed,
        beforeCaseName: testCase.name,
        requestedDelayMinutes: delayMinutes,
        startedAt: startedDelayAt.toISOString(),
        completedAt: new Date().toISOString(),
        applied: true,
      });
    }
    const lifecycleTiming = applyLiveLabEffectiveDepartureTime(testCase.buildPlan(), testCase, {
      dynamicTimingEnabled,
      now: new Date(),
    });
    if (!dryRun) assertEffectiveDepartureTimeNotStale(lifecycleTiming, testCase);
    let plan = await persistCertificationPlan(lifecycleTiming.plan, runId, testCase, dryRun);
    createdPlans.push(plan);
    dbPersistenceRecords.push({
      certificationCaseId: `case-${String(testCase.seed).padStart(2, "0")}`,
      testName: testCase.name,
      persisted: !dryRun,
      localFlightPlanId: plan.id,
      userId: plan.userId,
      providerPlanId: plan.filingProviderPlanId || null,
    });
    console.log(`[${index + 1}/${cases.length}] ${testCase.name} seed=${testCase.seed} type=${testCase.testType}`);
    const caseResult = {
      certificationRunId: runId,
      certificationCaseId: `case-${String(testCase.seed).padStart(2, "0")}`,
      stableCaseId: testCase.stableId || `case-${String(testCase.seed).padStart(2, "0")}`,
      planId: plan.id,
      testName: testCase.name,
      testType: testCase.testType,
      suite: testCase.suite || "core",
      classification: testCase.classification || null,
      seed: testCase.seed,
      actions: [] as any[],
      comparisons: [] as any[],
      pass: true,
      skipped: Boolean(testCase.skipReason),
      warnings: [] as string[],
      errors: [] as string[],
      lifecycleTiming: lifecycleTiming.metadata,
      testDesignFailures: [] as string[],
    };
    if (testCase.skipReason) {
      caseResult.warnings.push(testCase.skipReason);
      caseResult.actions.push({ action: "skip", payloadSummary: null, responseStatus: "skipped", providerPlanId: null, versionStamp: null, warnings: [testCase.skipReason], errors: [], elapsedMs: 0 });
      plan = await appendCertificationAudit(plan, "action", caseResult.actions[0], dryRun);
      results.push(caseResult);
      continue;
    }
    const preflightTestDesignFailure = getLiveLabTestDesignFailure(lifecycleTiming, testCase);
    if (preflightTestDesignFailure) {
      caseResult.pass = false;
      caseResult.testDesignFailures.push(preflightTestDesignFailure);
      caseResult.errors.push(preflightTestDesignFailure);
      const actionResult = {
        action: "preflight",
        generatedPayload: null,
        providerPayload: null,
        storedPayload: null,
        payloadSentToLeidos: null,
        leidosResponse: null,
        testType: testCase.testType,
        validationStatus: "BLOCKED",
        validationResult: "test_design_failure",
        blockedBeforeLeidos: true,
        blockedReason: "test_design_failure",
        routeReview: null,
        recommendedFix: "Repair the certification fixture timing before provider submission.",
        comparison: null,
        comparisonResult: "TEST_DESIGN_FAILURE",
        fieldComparisons: [],
        providerLifecycle: null,
        responseStatus: "test_design_failure",
        warnings: [],
        errors: [preflightTestDesignFailure],
        elapsedMs: 0,
      };
      caseResult.actions.push(actionResult);
      plan = await appendCertificationAudit(plan, "action", actionResult, dryRun);
      results.push(caseResult);
      continue;
    }
    for (const action of testCase.actions) {
      const started = Date.now();
      const amendMutation = await applyAmendMutationIfNeeded(plan, testCase, action, dryRun);
      plan = amendMutation.plan;
      let validation = validateFlightPlanForAction(plan, action);
      const generatedPayload = summarizePayload(plan, action) as Record<string, any> | null;
      if ((action === "file" || action === "amend") && generatedPayload?.otherInfo) {
        const otherInfoValidation = validateLeidosOtherInfoForTransmission(generatedPayload.otherInfo);
        if (!otherInfoValidation.valid) {
          validation = {
            ready: false,
            errors: [...validation.errors, ...otherInfoValidation.errors],
            warnings: validation.warnings,
          };
        }
      }
      const routeReview = buildRouteReview(plan, generatedPayload, validation);
      printPayloadReview(generatedPayload, plan);
      if (generatedPayload?.route || plan.route) {
        console.log("Route Review");
        console.log("------------");
        console.log(`Original Route: ${routeReview.originalRoute}`);
        console.log(`Normalized Route: ${routeReview.normalizedRoute}`);
        console.log(`Status: ${routeReview.status}`);
        console.log("");
      }
      printValidationResult(testCase, validation);
      if (action === "activate") {
        const activationWindowCheckPassed = checkActivationWindow(plan);
        caseResult.lifecycleTiming = {
          ...(caseResult.lifecycleTiming as LifecycleDynamicTimingMetadata),
          activationWindowCheckPassed,
          activationWindowCheckedAt: new Date().toISOString(),
        };
        if (!activationWindowCheckPassed) {
          caseResult.pass = false;
          const setupMessage = `Test setup failure: ACTIVATE planned departure ${plan.plannedDepartureAt ? new Date(plan.plannedDepartureAt).toISOString() : "-"} is outside the ${ACTIVATION_WINDOW_MINUTES}-minute Leidos LAB activation window.`;
          caseResult.errors.push(setupMessage);
          caseResult.testDesignFailures.push(setupMessage);
          const actionResult = {
            action,
            generatedPayload,
            providerPayload: null,
            storedPayload: null,
            payloadSentToLeidos: null,
            leidosResponse: null,
            testType: testCase.testType,
            validationStatus: "PASS",
            validationResult: "valid",
            blockedBeforeLeidos: true,
            blockedReason: "activation_window_test_setup_failure",
            routeReview,
            recommendedFix: "Use a lifecycle departure time within the Leidos LAB activation window.",
            comparison: null,
            comparisonResult: "TEST_SETUP_FAILURE",
            fieldComparisons: [],
            providerLifecycle: plan.filingStatus || null,
            responseStatus: "test_setup_activation_window_failed",
            warnings: validation.warnings,
            errors: [setupMessage],
            elapsedMs: Date.now() - started,
          };
          caseResult.actions.push(actionResult);
          plan = await appendCertificationAudit(plan, "action", actionResult, dryRun);
          break;
        }
      }
      if (!validation.ready) {
        const expectedBlock = Boolean(testCase.expectedBlockedBeforeLeidos);
        const internalFixtureFailure = !expectedBlock && isInternalFixtureValidationFailure(plan, validation);
        caseResult.pass = expectedBlock;
        if (!expectedBlock) {
          const validationMessage = `Validation failed before ${action}: ${validation.errors.join(" | ")}`;
          const classifiedMessage = internalFixtureFailure
            ? `Test design failure: certification fixture is internally inconsistent before ${action}. ${validation.errors.join(" | ")}`
            : validationMessage;
          caseResult.errors.push(classifiedMessage);
          if (internalFixtureFailure) caseResult.testDesignFailures.push(classifiedMessage);
        }
        const actionResult = {
          action,
          generatedPayload,
          providerPayload: null,
          storedPayload: null,
          payloadSentToLeidos: null,
          leidosResponse: null,
          testType: testCase.testType,
          validationStatus: "BLOCKED",
          validationResult: "invalid",
          blockedBeforeLeidos: true,
          blockedReason: internalFixtureFailure ? "test_design_fixture_inconsistent" : validation.errors.join(" | "),
          routeReview,
          recommendedFix: testCase.recommendedFix || validation.warnings.join(" | ") || null,
          comparison: null,
          comparisonResult: internalFixtureFailure ? "TEST_DESIGN_FAILURE" : "BLOCKED",
          fieldComparisons: [],
          providerLifecycle: null,
          responseStatus: expectedBlock ? "blocked_before_leidos_expected" : internalFixtureFailure ? "test_design_validation_failed" : "validation_failed",
          warnings: validation.warnings,
          errors: validation.errors,
          elapsedMs: Date.now() - started,
        };
        caseResult.actions.push(actionResult);
        plan = await appendCertificationAudit(plan, "action", actionResult, dryRun);
        break;
      }
      if (testCase.expectedBlockedBeforeLeidos) {
        caseResult.pass = false;
        caseResult.errors.push(`Expected local validation to block ${action}, but validation passed. Provider call was not sent.`);
        const actionResult = {
          action,
          generatedPayload,
          providerPayload: null,
          storedPayload: null,
          payloadSentToLeidos: null,
          leidosResponse: null,
          testType: testCase.testType,
          validationStatus: "PASS",
          validationResult: "valid",
          blockedBeforeLeidos: false,
          blockedReason: null,
          routeReview,
          recommendedFix: null,
          comparison: null,
          comparisonResult: "EXPECTED_BLOCK_MISSING",
          fieldComparisons: [],
          providerLifecycle: null,
          responseStatus: "expected_block_missing",
          warnings: validation.warnings,
          errors: caseResult.errors,
          elapsedMs: Date.now() - started,
        };
        caseResult.actions.push(actionResult);
        plan = await appendCertificationAudit(plan, "action", actionResult, dryRun);
        break;
      }
      const providerSnapshotBeforeAction = plan.filingProviderSnapshot && typeof plan.filingProviderSnapshot === "object"
        ? plan.filingProviderSnapshot as Record<string, any>
        : {};
      const acceptedSnapshotAvailable = Boolean(providerSnapshotBeforeAction.providerReviewAcceptedEffectivePlanSnapshot);
      const acceptedSnapshotVersionStamp = providerSnapshotBeforeAction.providerReviewAcceptedVersionStamp || null;
      const providerSnapshotAvailable = Object.keys(providerSnapshotBeforeAction).length > 0;
      const providerChangedFields = Array.isArray(providerSnapshotBeforeAction.providerEffectivePlanChangedFields)
        ? providerSnapshotBeforeAction.providerEffectivePlanChangedFields
        : [];
      const providerReviewDecisionReason = providerSnapshotBeforeAction.providerReviewDecisionReason || null;
      const providerPendingReviewBeforeClose = action === "close"
        ? Boolean(providerSnapshotBeforeAction.providerPendingReview)
        : undefined;
      if (dryRun) {
        const simulated = simulateDryRunProviderState(plan, action, testCase.seed);
        const comparison = compareGeneratedSentReturned(generatedPayload, generatedPayload, simulated, { action, terminalAction: isTerminalAction(action) });
        const actionResult = { action, generatedPayload, providerPayload: generatedPayload, storedPayload: comparison.stored, payloadSentToLeidos: generatedPayload, leidosResponse: { dryRun: true }, testType: testCase.testType, validationStatus: "PASS", validationResult: "valid", blockedBeforeLeidos: false, blockedReason: null, routeReview, recommendedFix: null, responseStatus: "dry_run", providerPlanId: simulated.filingProviderPlanId || null, versionStamp: getVersionStamp(simulated), acceptedSnapshotAvailable, acceptedSnapshotVersionStamp, providerSnapshotAvailable, providerChangedFields, providerPendingReviewBeforeClose, providerReviewDecisionReason, primaryCloseAttempted: action === "close", warnings: validation.warnings, errors: [], comparison, comparisonResult: comparison.pass ? "MATCH" : "DIFFERENCE", fieldComparisons: comparison.fieldComparisons, providerLifecycle: (simulated.filingProviderSnapshot as any)?.providerLifecycleStatus || simulated.filingStatus, elapsedMs: Date.now() - started };
        caseResult.actions.push(actionResult);
        caseResult.comparisons.push(comparison);
        plan = await appendCertificationAudit(simulated, "action", actionResult, dryRun);
        continue;
      }
      let response: Awaited<ReturnType<typeof flightPlanFilingProvider.stageAction>>;
      const terminalActionBaseline = isTerminalAction(action)
        ? captureTerminalActionEvidenceBaseline(plan, new Date().toISOString())
        : null;
      try {
        response = await flightPlanFilingProvider.stageAction(plan, action);
      } catch (error) {
        caseResult.pass = false;
        const message = String((error as any)?.message || error);
        const activationWindowSetupFailure = action === "activate" && isActivationWindowError(message);
        const classifiedMessage = activationWindowSetupFailure
          ? `Test setup failure: Leidos rejected ACTIVATE because the activation time was outside the ${ACTIVATION_WINDOW_MINUTES}-minute window. ${message}`
          : message;
        caseResult.errors.push(classifiedMessage);
        if (activationWindowSetupFailure) {
          caseResult.testDesignFailures.push(classifiedMessage);
          caseResult.lifecycleTiming = {
            ...(caseResult.lifecycleTiming as LifecycleDynamicTimingMetadata),
            activationWindowCheckPassed: false,
            activationWindowProviderRejected: true,
            activationWindowCheckedAt: new Date().toISOString(),
          };
        }
        const actionResult = { action, generatedPayload, providerPayload: null, storedPayload: null, payloadSentToLeidos: null, leidosResponse: null, testType: testCase.testType, validationStatus: "PASS", validationResult: "valid", blockedBeforeLeidos: false, blockedReason: activationWindowSetupFailure ? "activation_window_test_setup_failure" : null, routeReview, acceptedSnapshotAvailable, acceptedSnapshotVersionStamp, providerSnapshotAvailable, providerChangedFields, providerPendingReviewBeforeClose, providerReviewDecisionReason, primaryCloseAttempted: action === "close", primaryCloseAccepted: false, primaryCloseVerified: false, comparison: null, comparisonResult: activationWindowSetupFailure ? "TEST_SETUP_FAILURE" : "ERROR", fieldComparisons: [], providerLifecycle: null, responseStatus: activationWindowSetupFailure ? "test_setup_activation_window_failed" : "error", warnings: validation.warnings, errors: [classifiedMessage], elapsedMs: Date.now() - started };
        caseResult.actions.push(actionResult);
        plan = await appendCertificationAudit(plan, "action", actionResult, dryRun);
        if (isCleanupBlockingError(error)) stoppedEarly = true;
        break;
      }
      const versionStamp = String(response.raw?.versionStamp || response.providerSnapshot?.versionStamp || "");
      plan = {
        ...plan,
        filingProviderPlanId: response.providerPlanId || plan.filingProviderPlanId,
        filingStatus: response.nextStatus,
        filingIsLive: response.live,
        filingRaw: response.raw,
        filingPayload: response.payloadSnapshot?.transmittedFields || plan.filingPayload,
        filingProviderSnapshot: response.providerSnapshot || plan.filingProviderSnapshot,
        filingProviderMessages: response.providerMessages || plan.filingProviderMessages,
      } as FlightPlan;
      plan = await updateCertificationPlan(plan, {
        filingProviderPlanId: plan.filingProviderPlanId,
        filingStatus: plan.filingStatus,
        filingIsLive: plan.filingIsLive,
        filingRaw: plan.filingRaw,
        filingPayload: plan.filingPayload,
        filingProviderSnapshot: plan.filingProviderSnapshot,
        filingProviderMessages: plan.filingProviderMessages,
        filedAt: action === "file" ? new Date() : plan.filedAt,
        activatedAt: action === "activate" ? new Date() : plan.activatedAt,
        cancelledAt: action === "cancel" ? new Date() : plan.cancelledAt,
        closedAt: action === "close" ? new Date() : plan.closedAt,
      } as any, dryRun);
      const sentPayload = response.raw?.requestPayload || response.payloadSnapshot?.transmittedFields || null;
      const terminalAction = isTerminalAction(action);
      const comparison = compareGeneratedSentReturned(generatedPayload, sentPayload, plan, { action, terminalAction });
      const providerSubmissionDisabledForAction = !response.live && isProviderSubmissionDisabledMessage(response.message);
      const rawProviderResponse = response.raw?.response && typeof response.raw.response === "object"
        ? response.raw.response as Record<string, any>
        : {};
      const providerReturnStatus = typeof rawProviderResponse.returnStatus === "boolean" ? rawProviderResponse.returnStatus : null;
      const terminalVerification = response.live && terminalAction
        ? await verifyTerminalActionState(plan, action, response, dryRun, terminalActionBaseline)
        : null;
      const activationVerification = response.live && action === "activate"
        ? await verifyActivationActionState(plan, response, dryRun)
        : null;
      const versionStampMissingClassification = versionStamp
        ? "present"
        : terminalAction
          ? "optional_missing_after_terminal_action"
          : "required_missing";
      const actionResult = {
        action,
        generatedPayload,
        providerPayload: sentPayload,
        storedPayload: comparison.stored,
        payloadSentToLeidos: sentPayload,
        leidosResponse: response.raw?.response || response.raw || null,
        testType: testCase.testType,
        validationStatus: "PASS",
        validationResult: "valid",
        blockedBeforeLeidos: false,
        blockedReason: null,
        routeReview,
        recommendedFix: null,
        responseStatus: response.live ? "accepted" : providerSubmissionDisabledForAction ? "provider_submission_disabled_by_configuration" : "staged",
        providerActionAccepted: response.live,
        providerActionRejected: !response.live && !providerSubmissionDisabledForAction,
        providerReturnStatus,
        providerPlanId: response.providerPlanId || null,
        versionStamp,
        acceptedSnapshotAvailable,
        acceptedSnapshotVersionStamp,
        providerSnapshotAvailable,
        providerChangedFields,
        providerPendingReviewBeforeClose,
        providerReviewDecisionReason,
        primaryCloseAttempted: action === "close",
        primaryCloseAccepted: action === "close" ? Boolean(response.live && providerReturnStatus !== false) : undefined,
        primaryCloseVerified: action === "close" ? terminalVerification?.providerTerminalStateConfirmed === true : undefined,
        cleanupCloseAttempted: false,
        cleanupCloseAccepted: false,
        cleanupCloseVerified: false,
        versionStampRequired: !terminalAction,
        versionStampExpectedAfterAction: !terminalAction,
        versionStampMissingClassification,
        terminalAction,
        terminalVerification,
        activationVerification,
        activateAccepted: action === "activate" ? Boolean(response.live && providerReturnStatus !== false) : undefined,
        activationVerificationAttempted: activationVerification?.activationVerificationAttempted,
        activationVerificationMatched: activationVerification?.activationVerificationMatched,
        activationEvidenceKind: activationVerification?.activationEvidenceKind,
        activationEvidenceSource: activationVerification?.activationEvidenceSource,
        activationPollCount: activationVerification?.activationPollCount,
        activationTimedOut: activationVerification?.activationTimedOut,
        activatedAt: activationVerification?.activatedAt,
        closeAccepted: action === "close" ? Boolean(response.live && providerReturnStatus !== false) : undefined,
        closeVerificationMatched: action === "close" ? terminalVerification?.providerTerminalStateConfirmed : undefined,
        closeEvidenceKind: action === "close" ? terminalVerification?.evidenceKind : undefined,
        closeEvidenceSource: action === "close" ? terminalVerification?.evidenceSource : undefined,
        closedAt: action === "close" && terminalVerification?.status === "PASS" ? terminalVerification.evidenceTime || terminalVerification.webhookProcessingTimestamp || new Date().toISOString() : undefined,
        warnings: response.warnings || [],
        errors: response.live ? [] : providerSubmissionDisabledForAction ? [] : [response.message],
        instructions: providerSubmissionDisabledForAction
          ? [
              `${PROVIDER_SUBMISSION_DISABLED_MESSAGE}.`,
              `Set ${PROVIDER_SUBMISSION_ENV_VAR}=true to allow actual Leidos LAB submission.`,
              "Keep FLIGHT_SERVICE_ENVIRONMENT=LAB or LEIDOS_FLIGHT_SERVICE_ENV=LAB and confirm the base URL remains the Leidos LAB endpoint.",
              "Do not enable FLIGHT_FILING_OPERATIONAL_ENABLED for LAB certification.",
            ]
          : [],
        comparison,
        comparisonResult: comparison.pass ? "MATCH" : "DIFFERENCE",
        fieldComparisons: comparison.fieldComparisons,
        providerLifecycle: response.providerSnapshot?.providerLifecycleStatus || response.nextStatus,
        elapsedMs: Date.now() - started,
      };
      caseResult.actions.push(actionResult);
      caseResult.comparisons.push(comparison);
      plan = await appendCertificationAudit(plan, "action", actionResult, dryRun);
      if (terminalVerification?.status === "FAIL") {
        caseResult.pass = false;
        caseResult.errors.push(`Terminal verification failed after ${action.toUpperCase()}: local status is ${terminalVerification.localStatus || "-"}, expected ${terminalVerification.expectedLocalStatus || "-"}.`);
      } else if (terminalVerification?.status === "REVIEW") {
        caseResult.warnings.push(`Terminal verification needs review after ${action.toUpperCase()}: provider retrieval/status was inconclusive, but local terminal state was recorded.`);
      }
      if (activationVerification?.status === "FAIL") {
        caseResult.pass = false;
        caseResult.errors.push(`Activation verification failed after ACTIVATE: explicit provider lifecycle was ${activationVerification.effectiveLifecycle || "-"}, expected ACTIVATED.`);
      } else if (activationVerification?.status === "REVIEW") {
        caseResult.pass = false;
        caseResult.warnings.push("Activation verification needs review after ACTIVATE: provider accepted the action, but explicit ACTIVATED lifecycle evidence was not received before CLOSE.");
      }
      if (action === "activate" && activationVerification?.activationVerificationMatched && !dryRun) {
        const latestActivatedPlan = await storage.getFlightPlanById(plan.id);
        if (latestActivatedPlan) {
          plan = latestActivatedPlan as FlightPlan;
        }
      }
      if (!response.live) {
        if (providerSubmissionDisabledForAction) {
          providerSubmissionDisabled = true;
          stoppedEarly = true;
          caseResult.warnings.push(PROVIDER_SUBMISSION_DISABLED_MESSAGE);
          console.warn(PROVIDER_SUBMISSION_DISABLED_MESSAGE);
          console.warn(`Set ${PROVIDER_SUBMISSION_ENV_VAR}=true to submit to Leidos LAB after confirming the endpoint is LAB.`);
        } else {
          caseResult.pass = false;
          caseResult.errors.push(response.message);
        }
        break;
      }
      if (!comparison.pass) {
        caseResult.warnings.push(`Round-trip comparison failures after ${action}: ${comparison.failureCount}; warnings: ${comparison.warningCount}; info: ${comparison.infoCount}`);
      } else if (comparison.warningCount || comparison.infoCount) {
        caseResult.warnings.push(`Round-trip comparison non-failing differences after ${action}: warnings ${comparison.warningCount}; info ${comparison.infoCount}`);
      }
    }
    if (testCase.testType === "Round Trip") {
      const providerPlanIds = (caseResult.actions || []).map((action: any) => action.providerPlanId).filter(Boolean);
      const versionStamps = (caseResult.actions || []).map((action: any) => action.versionStamp).filter(Boolean);
      const uniqueProviderPlanIds = new Set(providerPlanIds);
      const uniqueVersionStamps = new Set(versionStamps);
      const comparisonFailures = (caseResult.comparisons || []).flatMap((comparison: any) => comparison?.failureDifferences || []);
      if (uniqueProviderPlanIds.size !== 1 || providerPlanIds.length === 0) {
        caseResult.pass = false;
        caseResult.errors.push("Round trip providerPlanId was not preserved across lifecycle actions.");
      }
      if (versionStamps.length > 1 && uniqueVersionStamps.size < 2) {
        caseResult.pass = false;
        caseResult.errors.push("Round trip versionStamp did not update across lifecycle actions.");
      }
      if (comparisonFailures.length) {
        caseResult.pass = false;
        caseResult.errors.push(`Round trip comparison found ${comparisonFailures.length} meaningful integrity mismatch(es).`);
      }
    }
    const immediateCleanup = !skipCleanup
      ? await applyImmediateCaseCleanup(plan, testCase, caseResult, dryRun)
      : { plan, results: [] as any[] };
    plan = immediateCleanup.plan;
    immediateCleanupResults.push(...immediateCleanup.results);
    results.push(caseResult);
    const createdIndex = createdPlans.findIndex((item) => item.id === plan.id);
    if (createdIndex >= 0) createdPlans[createdIndex] = plan;
    const persistenceRecord = dbPersistenceRecords.find((item) => item.localFlightPlanId === plan.id);
    if (persistenceRecord) {
      persistenceRecord.providerPlanId = plan.filingProviderPlanId || null;
      persistenceRecord.finalStatus = plan.filingStatus || null;
      persistenceRecord.filingIsLive = Boolean(plan.filingIsLive);
    }
    if ((!caseResult.pass || stoppedEarly) && !dryRun) {
      console.error(`Stopping after failure in ${testCase.name}: ${caseResult.errors.join(" | ")}`);
      break;
    }
  }

  let finalCleanupResults: any[] = [];
  if (skipCleanup) {
    finalCleanupResults = createdPlans.map((plan) => ({
      planId: plan.id,
      certificationRunId: runId,
      certificationCaseId: plan.certificationCaseId,
      providerPlanId: plan.filingProviderPlanId || null,
      versionStamp: getVersionStamp(plan),
      priorStatus: plan.filingStatus,
      responseStatus: "skipped_by_flag",
      cleanupPhase: "final_sweep",
      pass: true,
    }));
  } else {
    finalCleanupResults = await cleanupCertificationPlans(createdPlans, dryRun, "final_sweep");
  }
  const cleanupResults = [...immediateCleanupResults, ...finalCleanupResults];

  const openAfterCleanup = cleanupResults.filter((item) =>
    item.pass === false ||
    (item.responseStatus !== "already_terminal" && item.responseStatus !== "not_required" && item.responseStatus !== "staged_only_not_submitted" && item.responseStatus !== "dry_run" && item.responseStatus !== "accepted")
  );
  const validationSummary = buildValidationSummary(results, cases);
  const cleanupVerification = buildCleanupVerification(cleanupResults, results);
  const cleanupSummary = buildCleanupSummary(cleanupResults, results);
  const providerRoundTrip = buildRoundTripSummary(results);
  const roundTripComparison = buildRoundTripComparisonSummary(results);
  const terminalVerification = buildTerminalVerificationSummary(results);
  const lifecycleEvidence = buildLifecycleEvidenceSummary(results);
  const certificationVersion = buildCertificationVersion(diagnostics, context);
  const baseReadinessAssessment = buildReadinessAssessment(validationSummary, cleanupSummary, cleanupVerification, providerRoundTrip);
  const readinessAssessment = providerSubmissionDisabled
    ? {
        ...baseReadinessAssessment,
        overallStatus: "PROVIDER SUBMISSION DISABLED BY CONFIGURATION",
        providerSubmission: "DISABLED",
        requiredEnvironmentVariable: `${PROVIDER_SUBMISSION_ENV_VAR}=true`,
      }
    : baseReadinessAssessment;
  const executedCaseSeeds = results.map((item) => item.seed);
  const requestedCaseSeeds = cases.map((item) => item.seed);
  const skippedBySelectionSeeds = caseSelection.skippedBySelection.map((item) => item.seed);
  const lifecycleTimingResults = results
    .filter((item) => item.lifecycleTiming)
    .map((item) => ({
      seed: item.seed,
      certificationCaseId: item.certificationCaseId,
      testName: item.testName,
      ...item.lifecycleTiming,
    }));
  const activationWindowChecks = lifecycleTimingResults.filter((item: any) => item.activationWindowCheckPassed !== null && item.activationWindowCheckPassed !== undefined);
  const activationWindowCheckPassed = activationWindowChecks.length === 0
    ? true
    : activationWindowChecks.every((item: any) => item.activationWindowCheckPassed === true);

  const output = {
    certificationRunId: runId,
    dryRun,
    runModeLabel,
    environment: diagnostics.environment,
    endpoint: diagnostics.baseUrl,
    environmentDetails: {
      name: diagnostics.environment,
      endpoint: diagnostics.baseUrl,
      suite,
      suiteVersion: suite === "extended" || suite === "edge" || suite === "edge-pack" ? EXTENDED_EDGE_PACK_VERSION : CORE_CERTIFICATION_SUITE_VERSION,
      dryRun,
      delayMinutes,
      limit,
      dynamicTimingEnabled,
      staticDepartureTimeRequested: useStaticDepartureTime,
    },
    operator: {
      email: context.user.email || process.env.LEIDOS_TEST_USER_EMAIL,
      userId: context.user.id,
      pilotName: context.pilotName,
    },
    aircraft: {
      aircraftId: context.profile.id,
      tailNumber: context.profile.tailNumber,
      aircraftType: context.aircraftType,
      homeBase: context.homeBase,
      phonePresent: Boolean(context.phone),
    },
    testAccountEmail: context.user.email || process.env.LEIDOS_TEST_USER_EMAIL,
    limit,
    delayMinutes,
    skipCleanup,
    suiteSelection: {
      suite,
      suiteVersion: suite === "extended" || suite === "edge" || suite === "edge-pack" ? EXTENDED_EDGE_PACK_VERSION : CORE_CERTIFICATION_SUITE_VERSION,
      totalCasesInSuite: allCases.length,
      casesRequested: requestedCaseSeeds,
      casesExecuted: executedCaseSeeds,
      casesSkippedBecauseOfRangeSelection: skippedBySelectionSeeds,
      casesPassedInCurrentRun: results.filter((item) => item.pass).map((item) => item.seed),
      casesPreviouslyPassedIfKnown: Array.from(previouslyPassedSeeds).sort((a, b) => a - b),
      requestedCasesPreviouslyPassedIfKnown: previouslyPassedRequestedSeeds,
      coreCaseMappingAudit: buildCoreCaseMappingAudit(),
      requestedCaseMapping: cases.map((testCase) => ({
        seed: testCase.seed,
        stableId: testCase.stableId,
        suite: testCase.suite,
        name: testCase.name,
        testType: testCase.testType,
        classification: testCase.classification,
        actions: testCase.actions,
        expectedBlockedBeforeLeidos: Boolean(testCase.expectedBlockedBeforeLeidos),
      })),
      request: caseSelection.request,
    },
    duplicateRiskPreflight: {
      status: "PASS",
      ...duplicateRiskPreflight,
    },
    lifecycleTiming: {
      lifecycleDynamicTimeEnabled: dynamicTimingEnabled,
      lifecycleDepartureTimeStrategy: dynamicTimingEnabled
        ? `just-in-time per case: activation-window cases current time + ${LIFECYCLE_DYNAMIC_TIME_OFFSET_MINUTES} minutes; other cases current time + ${FILE_DYNAMIC_TIME_BASE_OFFSET_MINUTES} minutes plus ${CASE_DYNAMIC_TIME_SPACING_MINUTES} minutes per case seed`
        : "static deterministic seed time (--static-departure-time)",
      activationWindowCheckPassed,
      cases: lifecycleTimingResults,
    },
    totalCases: results.length,
    passed: validationSummary.passed,
    failed: validationSummary.failed,
    positiveTestsPassed: validationSummary.positiveTestsPassed,
    negativeTestsPassed: validationSummary.negativeTestsPassed,
    casesBlockedBeforeSubmission: validationSummary.blocked,
    positiveTests: results.filter((item) => item.testType === "Positive"),
    negativeTests: results.filter((item) => item.testType === "Negative"),
    lifecycleTests: results.filter((item) => item.testType === "Lifecycle"),
    providerRoundTrip,
    roundTripComparison,
    results,
    cleanupResults,
    cleanupSummary,
    cleanupVerification,
    terminalVerification,
    lifecycleEvidence,
    validationSummary,
    certificationVersion,
    readinessAssessment,
    providerSubmissionDisabled,
    executionTiming: {
      requestedDelayMinutes: delayMinutes,
      delayPolicy: "Applied before each certification case after the first during confirmed non-dry runs.",
      delayActuallyAppliedCount: delayApplications.length,
      delayActuallyApplied: delayApplications,
    },
    databasePersistence: {
      recordsCreated: !dryRun,
      persistMode: dryRun ? "dry_run_no_database_history" : "saved_to_flight_plan_history",
      testUserId: context.user.id,
      testUserEmail: context.user.email || process.env.LEIDOS_TEST_USER_EMAIL,
      mappings: dbPersistenceRecords,
    },
    providerSubmissionEnablement: {
      requiredEnvVar: PROVIDER_SUBMISSION_ENV_VAR,
      requiredValue: "true",
      currentEnabled: diagnostics.enabled,
      labOnlyGuard: "Runner refuses to run unless Leidos endpoint is LAB.",
      productionOperationalFlag: "FLIGHT_FILING_OPERATIONAL_ENABLED is production-only and must remain disabled for LAB certification.",
    },
    finalSummary: {
      executed: validationSummary.executed,
      passed: validationSummary.passed,
      blocked: validationSummary.blocked,
      failed: validationSummary.failed,
      skipped: validationSummary.skipped,
      payloadValidationFailures: validationSummary.payloadValidationFailures,
      expectedValidationBlocks: validationSummary.expectedValidationBlocks,
      unexpectedValidationFailures: validationSummary.unexpectedValidationFailures,
      testDesignFailures: validationSummary.testDesignFailures,
      testCount: results.length,
      cleanupTotal: cleanupResults.length,
      cleanupPassed: cleanupResults.filter((item) => item.pass !== false).length,
      cleanupFailed: cleanupResults.filter((item) => item.pass === false).length,
      cleanupVerification: cleanupVerification.status,
      terminalVerification: terminalVerification.failed === 0 ? (terminalVerification.review > 0 ? "REVIEW" : "PASS") : "FAIL",
      roundTripComparisonFailures: roundTripComparison.failureCount,
      roundTripComparisonWarnings: roundTripComparison.warningCount,
      providerRoundTrip: providerRoundTrip.failed === 0 ? "PASS" : "FAIL",
      openPlanWarnings: openAfterCleanup,
      finalResult: readinessAssessment.overallStatus,
    },
    createdAt: new Date().toISOString(),
  };
  const dir = join("certification-results", "leidos-live-lab");
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${runId}.json`);
  const sensitiveEvidenceValues = [
    context.user.email,
    context.pilotName,
    context.phone,
    context.homeBase,
    context.profile.tailNumber,
    process.env.LEIDOS_FLIGHT_SERVICE_USERNAME,
    process.env.LEIDOS_FLIGHT_SERVICE_PASSWORD,
    process.env.LEIDOS_FLIGHT_SERVICE_WEBHOOK_USERNAME,
    process.env.LEIDOS_FLIGHT_SERVICE_WEBHOOK_PASSWORD,
  ].map((entry) => String(entry || "").trim()).filter(Boolean);
  const evidenceOutput = sanitizeCertificationEvidence(output, sensitiveEvidenceValues) as typeof output;
  const artifacts = await writeCertificationArtifacts(evidenceOutput, filePath);
  console.log(`Saved JSON results: ${artifacts.jsonPath}`);
  console.log(`Saved HTML report: ${artifacts.htmlPath}`);
  console.log(`Saved PDF report: ${artifacts.pdfPath}`);
  console.log("");
  console.log("Certification Summary");
  console.log("---------------------");
  console.log("Environment");
  console.log(`  Name: Leidos LAB`);
  console.log(`  Endpoint: ${diagnostics.baseUrl}`);
  console.log("Operator");
  console.log("  Verified LAB test account");
  console.log("Aircraft");
  console.log(`  Aircraft Type: ${context.aircraftType}`);
  console.log("Case Selection");
  console.log(`  Total Cases In Suite: ${output.suiteSelection.totalCasesInSuite}`);
  console.log(`  Requested: ${output.suiteSelection.casesRequested.join(", ") || "-"}`);
  console.log(`  Executed: ${output.suiteSelection.casesExecuted.join(", ") || "-"}`);
  console.log(`  Skipped By Selection: ${output.suiteSelection.casesSkippedBecauseOfRangeSelection.join(", ") || "-"}`);
  console.log(`  Previously Passed If Known: ${output.suiteSelection.requestedCasesPreviouslyPassedIfKnown.join(", ") || "-"}`);
  console.log("Lifecycle Timing");
  console.log(`  Dynamic Time Enabled: ${output.lifecycleTiming.lifecycleDynamicTimeEnabled}`);
  console.log(`  Strategy: ${output.lifecycleTiming.lifecycleDepartureTimeStrategy}`);
  console.log(`  Activation Window Check Passed: ${output.lifecycleTiming.activationWindowCheckPassed}`);
  console.log("Validation Summary");
  console.log(`  Executed: ${validationSummary.executed}`);
  console.log(`  Cases Passed: ${validationSummary.passed}`);
  console.log(`  Blocked Before Submission: ${validationSummary.blocked}`);
  console.log(`  Failed: ${validationSummary.failed}`);
  console.log(`  Skipped: ${validationSummary.skipped}`);
  console.log(`  Expected Validation Blocks: ${validationSummary.expectedValidationBlocks}`);
  console.log(`  Unexpected Validation Failures: ${validationSummary.unexpectedValidationFailures}`);
  console.log(`  Test Design Failures: ${validationSummary.testDesignFailures}`);
  console.log("Positive Tests");
  console.log(`  Passed: ${output.positiveTestsPassed}`);
  console.log("Negative Tests");
  console.log(`  Passed: ${output.negativeTestsPassed}`);
  console.log(`  Blocked Before Submission: ${output.casesBlockedBeforeSubmission}`);
  console.log("Lifecycle Tests");
  console.log(`Expected Filed: ${results.filter((item) => (item.actions || []).some((action: any) => action.action === "file" && !action.blockedBeforeLeidos)).length}`);
  console.log(`Expected Amend: ${results.filter((item) => (item.actions || []).some((action: any) => action.action === "amend")).length}`);
  console.log(`Expected Activate: ${results.filter((item) => (item.actions || []).some((action: any) => action.action === "activate")).length}`);
  console.log(`Expected Close: ${results.filter((item) => (item.actions || []).some((action: any) => action.action === "close")).length}`);
  console.log(`Expected Case Lifecycle Cancel: ${results.filter((item) => (item.actions || []).some((action: any) => action.action === "cancel")).length}`);
  console.log("Provider Round Trip");
  console.log(`  Status: ${providerRoundTrip.failed === 0 ? "PASS" : "FAIL"}`);
  console.log(`  Cases: ${providerRoundTrip.total}`);
  printRoundTripComparisonDetails(roundTripComparison);
  console.log("Terminal Verification");
  console.log(`  Provider Accepted: ${terminalVerification.providerAccepted}`);
  console.log(`  Provider Rejected: ${terminalVerification.providerRejected}`);
  console.log(`  VersionStamp Required And Missing: ${terminalVerification.versionStampRequiredAndMissing}`);
  console.log(`  VersionStamp Optional Missing After Terminal: ${terminalVerification.versionStampOptionalMissingAfterTerminal}`);
  console.log(`  Passed: ${terminalVerification.passed}`);
  console.log(`  Review: ${terminalVerification.review}`);
  console.log(`  Failed: ${terminalVerification.failed}`);
  console.log("Lifecycle Evidence");
  for (const item of lifecycleEvidence.cases) {
    console.log(`  Case ${item.seed}: activateAccepted=${item.activateAccepted} activationVerified=${item.activationVerificationMatched} closeAccepted=${item.closeAccepted} closeVerified=${item.closeVerificationMatched} complete=${item.lifecycleEvidenceComplete}`);
  }
  console.log("Cleanup Summary");
  console.log(`  Provider Plans Staged: ${cleanupSummary.providerPlansStaged}`);
  console.log(`  Provider Plans Submitted: ${cleanupSummary.providerPlansSubmitted}`);
  console.log(`  Provider Plans Created: ${cleanupSummary.providerPlansCreated}`);
  console.log(`  Unique Provider Plans Requiring Cleanup: ${cleanupSummary.uniqueProviderPlansRequiringCleanup}`);
  console.log(`  Cleanup Verification Attempts: ${cleanupSummary.cleanupVerificationAttempts}`);
  console.log(`  Unique Plans Explicitly Terminal Verified: ${cleanupSummary.uniquePlansExplicitlyTerminalVerified}`);
  console.log(`  Provider Plans Blocked Before Submission: ${cleanupSummary.providerPlansBlockedBeforeSubmission}`);
  console.log(`  Immediate Cleanup Total: ${cleanupSummary.immediateCleanupTotal}`);
  console.log(`  Immediate Cleanup Attempted: ${cleanupSummary.immediateCleanupAttempted}`);
  console.log(`  Immediate Cleanup Cancel Accepted: ${cleanupSummary.immediateCleanupCancelAccepted}`);
  console.log(`  Immediate Cleanup Terminal Explicitly Verified: ${cleanupSummary.immediateCleanupTerminalStateExplicitlyVerified}`);
  console.log(`  Immediate Cleanup Accepted But Terminal Evidence Unavailable: ${cleanupSummary.immediateCleanupAcceptedButTerminalEvidenceUnavailable}`);
  console.log(`  Final Sweep Total: ${cleanupSummary.finalSweepTotal}`);
  console.log(`  Final Sweep Newly Verified: ${cleanupSummary.finalSweepNewlyVerified}`);
  console.log(`  Final Sweep Reconfirmed Already Verified: ${cleanupSummary.finalSweepReconfirmedAlreadyVerified}`);
  console.log(`  Automated Cleanup Cancel Accepted: ${cleanupSummary.cancelAccepted}`);
  console.log(`  Cleanup Terminal Explicitly Verified: ${cleanupSummary.terminalStateExplicitlyVerified}`);
  console.log(`  Cleanup Accepted But Terminal Evidence Unavailable: ${cleanupSummary.acceptedButTerminalEvidenceUnavailable}`);
  console.log(`  Automated Cleanup Closed: ${cleanupSummary.closed}`);
  console.log(`  Already Terminal: ${cleanupSummary.alreadyTerminal}`);
  console.log(`  Cleanup Not Required: ${cleanupSummary.cleanupNotRequired}`);
  console.log(`  Cleanup Errors: ${cleanupSummary.cleanupErrors}`);
  console.log(`  Unresolved Provider Plans: ${cleanupSummary.unresolvedProviderPlans}`);
  console.log(`  Cleanup Verification: ${cleanupVerification.status}`);
  console.log("Certification Version");
  console.log(`  RSF Build Version: ${certificationVersion.rsfBuildVersion}`);
  console.log(`  Git Commit Hash: ${certificationVersion.gitCommitHash}`);
  console.log(`  Certification Suite Version: ${certificationVersion.certificationSuiteVersion}`);
  console.log(`  Flight Service Module Version: ${certificationVersion.flightServiceModuleVersion}`);
  console.log("Final Result");
  console.log(`  ${readinessAssessment.overallStatus}`);
  console.log("Execution Timing");
  console.log(`  Delay Setting Requested: ${delayMinutes} minute(s)`);
  console.log(`  Delay Actually Applied: ${delayApplications.length} time(s)`);
  console.log("Database Persistence");
  console.log(`  RSF DB Records Created: ${dryRun ? "No" : "Yes"}`);
  for (const record of dbPersistenceRecords) {
    console.log(`  ${record.certificationCaseId}: persisted=${Boolean(record.localFlightPlanId)} providerPlanCreated=${Boolean(record.providerPlanId)}`);
  }
  if (providerSubmissionDisabled) {
    console.log("");
    console.log(PROVIDER_SUBMISSION_DISABLED_MESSAGE);
    console.log(`To submit to Leidos LAB, set ${PROVIDER_SUBMISSION_ENV_VAR}=true and keep FLIGHT_SERVICE_ENVIRONMENT=LAB.`);
    console.log("Do not set FLIGHT_FILING_OPERATIONAL_ENABLED for LAB certification.");
  }
  console.log(`Report Location: ${artifacts.jsonPath}`);
  if ((output.failed > 0 || output.finalSummary.cleanupFailed > 0 || providerSubmissionDisabled) && !dryRun) process.exitCode = 1;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
