import type { FlightPlan } from "../../shared/schema";
import {
  buildLeidosActionPayload,
  compareRetrievedProviderPlanFields,
  validateFlightPlanForAction,
} from "../../server/services/flight-plan-filing/provider";
import { filingPlan, resetPlannerState, visibleLifecycleActions } from "./test-utils";

export type ScenarioSeverity = "blocker" | "major" | "minor";
export type ScenarioAction =
  | "new"
  | "openSaved"
  | "edit"
  | "clear"
  | "file"
  | "amend"
  | "activate"
  | "cancel"
  | "close"
  | "retrieve"
  | "sync"
  | "providerReject"
  | "browserRefresh"
  | "unsavedLocalEdit"
  | "staleSavedState"
  | "duplicateFileClick"
  | "rapidButtonClick";

export type ProviderRetrieveMode =
  | "match"
  | "omit-phone"
  | "omit-home-base"
  | "supplemental-in-other-info"
  | "modified-route"
  | "different-lifecycle"
  | "notices"
  | "stale-version"
  | "corrected-equipment"
  | "reject-invalid-equipment"
  | "reject-invalid-field18";

export interface ScenarioMismatch {
  field: string;
  visibleValue: unknown;
  savedValue: unknown;
  submittedValue: unknown;
  retrievedValue: unknown;
  displayedValue: unknown;
  issue: string;
  severity: ScenarioSeverity;
}

export interface FlightServiceScenario {
  name: string;
  description: string;
  initialPlan?: Partial<FlightPlan>;
  visibleForm?: Partial<FlightPlan>;
  savedPlan?: Partial<FlightPlan>;
  userActions: ScenarioAction[];
  action?: "file" | "amend" | "activate" | "cancel" | "close";
  providerRetrieveMode?: ProviderRetrieveMode;
  providerRejectMessage?: string;
  expectedPayload?: Record<string, unknown>;
  expectedUiState?: Record<string, unknown>;
  expectedProviderBehavior?: "called" | "blocked" | "rejected" | "not-applicable";
  expectedValidationResult?: "valid" | "invalid";
  providerCallShouldBeBlocked?: boolean;
  seanFeedbackId?: string;
  expectedMismatchFields?: string[];
  expectedMismatchMinimum?: number;
}

export interface ScenarioResult {
  scenario: FlightServiceScenario;
  passed: boolean;
  providerCallAttempted: boolean;
  providerCallBlocked: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  payload: Record<string, unknown> | null;
  retrievedProviderPlan: Record<string, unknown> | null;
  persistedState: Record<string, unknown>;
  displayedState: Record<string, unknown>;
  mismatches: ScenarioMismatch[];
  reproductionSteps: string[];
}

const PROVIDER_ACTIONS = new Set<ScenarioAction>(["file", "amend", "activate", "cancel", "close"]);

const comparable = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value).trim().toUpperCase().replace(/\s+/g, " ");
};

const extractPayload = (plan: FlightPlan, action: "file" | "amend") => {
  return Object.fromEntries(buildLeidosActionPayload(plan, action, { otherInfo: null } as any).params.entries());
};

const clonePlan = (plan: FlightPlan): FlightPlan => ({
  ...plan,
  plannedDepartureAt: plan.plannedDepartureAt ? new Date(plan.plannedDepartureAt) : null,
  plannedArrivalAt: plan.plannedArrivalAt ? new Date(plan.plannedArrivalAt) : null,
  plannerState: plan.plannerState && typeof plan.plannerState === "object" && !Array.isArray(plan.plannerState)
    ? { ...(plan.plannerState as Record<string, unknown>) }
    : plan.plannerState,
}) as FlightPlan;

const scenarioPlan = (scenario: FlightServiceScenario) => filingPlan({
  ...scenario.initialPlan,
  ...scenario.savedPlan,
}) as FlightPlan;

const visiblePlan = (scenario: FlightServiceScenario, saved: FlightPlan) => ({
  ...clonePlan(saved),
  ...scenario.visibleForm,
}) as FlightPlan;

const providerResponseFor = (
  mode: ProviderRetrieveMode | undefined,
  payload: Record<string, unknown> | null,
  plan: FlightPlan,
) => {
  if (!payload) return null;
  const response: Record<string, unknown> = {
    ...payload,
    providerLifecycleStatus: plan.filingStatus || "filed",
    versionStamp: "20260701120000000",
    notices: [],
  };

  switch (mode) {
    case "omit-phone":
      delete response.pilotPhone;
      break;
    case "omit-home-base":
      delete response.aircraftHomeBase;
      break;
    case "supplemental-in-other-info":
      response.otherInfo = `${payload.otherInfo || ""} ${payload.suppRemarksExtended || "SUPPLEMENTAL TEST"}`.trim();
      delete response.suppRemarksExtended;
      break;
    case "modified-route":
      response.route = "DCT KBPT DCT LCH DCT KEYW";
      break;
    case "different-lifecycle":
      response.providerLifecycleStatus = "activated";
      break;
    case "notices":
      response.notices = ["Provider notice received for certification test"];
      break;
    case "stale-version":
      response.versionStamp = "20260624120000000";
      break;
    case "corrected-equipment":
      response.aircraftEquipment = "SC";
      break;
    case "reject-invalid-equipment":
      response.returnStatus = false;
      response.returnMessage = ["AircraftEquipment.invalid"];
      break;
    case "reject-invalid-field18":
      response.returnStatus = false;
      response.returnMessage = ["OtherInfo.invalidMessage"];
      break;
    case "match":
    default:
      break;
  }
  return response;
};

const expectedPayloadMismatches = (
  expectedPayload: Record<string, unknown> | undefined,
  payload: Record<string, unknown> | null,
  visible: FlightPlan,
  saved: FlightPlan,
): ScenarioMismatch[] => {
  if (!expectedPayload) return [];
  return Object.entries(expectedPayload).flatMap(([field, expected]) => {
    const submitted = payload?.[field];
    if (comparable(submitted) === comparable(expected)) return [];
    return [{
      field,
      visibleValue: (visible as Record<string, unknown>)[field],
      savedValue: (saved as Record<string, unknown>)[field],
      submittedValue: submitted,
      retrievedValue: null,
      displayedValue: null,
      issue: `Expected submitted ${field} to equal ${String(expected)}`,
      severity: "blocker" as ScenarioSeverity,
    }];
  });
};

const retrieveMismatches = (
  payload: Record<string, unknown> | null,
  retrievedProviderPlan: Record<string, unknown> | null,
  visible: FlightPlan,
  saved: FlightPlan,
): ScenarioMismatch[] => {
  if (!payload || !retrievedProviderPlan) return [];
  const comparison = compareRetrievedProviderPlanFields({ submittedFields: payload, retrievedProviderPlan });
  return comparison.mismatchedFields.map((entry) => ({
    field: entry.field,
    visibleValue: (visible as Record<string, unknown>)[entry.field],
    savedValue: (saved as Record<string, unknown>)[entry.field],
    submittedValue: entry.submitted,
    retrievedValue: entry.retrieved,
    displayedValue: null,
    issue: entry.issue,
    severity: entry.issue === "missing_from_retrieve" ? "major" : "blocker",
  }));
};

const lifecycleMismatches = (scenario: FlightServiceScenario, plan: FlightPlan): ScenarioMismatch[] => {
  const ui = visibleLifecycleActions(plan);
  if (!scenario.expectedUiState) return [];
  return Object.entries(scenario.expectedUiState).flatMap(([field, expected]) => {
    const actual = (ui as Record<string, unknown>)[field];
    if (actual === expected) return [];
    return [{
      field,
      visibleValue: actual,
      savedValue: (plan as Record<string, unknown>)[field],
      submittedValue: null,
      retrievedValue: null,
      displayedValue: actual,
      issue: `Expected UI state ${field} to equal ${String(expected)}`,
      severity: "blocker" as ScenarioSeverity,
    }];
  });
};

export const runFlightServiceScenario = (scenario: FlightServiceScenario): ScenarioResult => {
  const saved = scenarioPlan(scenario);
  const visible = visiblePlan(scenario, saved);
  const providerAction = scenario.action || (scenario.userActions.find((action) => PROVIDER_ACTIONS.has(action)) as ScenarioResult["scenario"]["action"]) || "file";
  const validation = validateFlightPlanForAction(visible, providerAction);
  const invalid = validation.errors.length > 0;
  const providerCallBlocked = invalid || scenario.providerCallShouldBeBlocked === true;
  const providerCallAttempted = Boolean(PROVIDER_ACTIONS.has(providerAction) && !providerCallBlocked);

  let payload: Record<string, unknown> | null = null;
  if (!providerCallBlocked && (providerAction === "file" || providerAction === "amend")) {
    payload = extractPayload(visible, providerAction);
  }

  const retrievedProviderPlan = providerResponseFor(scenario.providerRetrieveMode, payload, visible);
  const displayedState = {
    ...resetPlannerState(),
    lifecycleActions: visibleLifecycleActions(visible),
    providerError: scenario.providerRejectMessage || null,
  };
  const persistedState = {
    filingStatus: visible.filingStatus,
    providerPlanId: visible.filingProviderPlanId,
    route: visible.route,
    otherInfo: payload?.otherInfo ?? visible.filingOtherInfo,
  };

  const observedMismatches: ScenarioMismatch[] = [
    ...expectedPayloadMismatches(scenario.expectedPayload, payload, visible, saved),
    ...retrieveMismatches(payload, retrievedProviderPlan, visible, saved),
    ...lifecycleMismatches(scenario, visible),
  ];

  const expectedMismatchFields = new Set(scenario.expectedMismatchFields || []);
  const expectedObserved = observedMismatches.filter((issue) => expectedMismatchFields.has(issue.field));
  const mismatches: ScenarioMismatch[] = observedMismatches.filter((issue) => !expectedMismatchFields.has(issue.field));

  for (const field of expectedMismatchFields) {
    if (!observedMismatches.some((issue) => issue.field === field)) {
      mismatches.push({
        field,
        visibleValue: (visible as Record<string, unknown>)[field],
        savedValue: (saved as Record<string, unknown>)[field],
        submittedValue: payload?.[field],
        retrievedValue: retrievedProviderPlan?.[field],
        displayedValue: null,
        issue: `Expected mismatch for ${field} was not detected`,
        severity: "blocker",
      });
    }
  }
  if (scenario.expectedMismatchMinimum && expectedObserved.length < scenario.expectedMismatchMinimum) {
    mismatches.push({
      field: "expectedMismatchMinimum",
      visibleValue: expectedObserved.length,
      savedValue: null,
      submittedValue: null,
      retrievedValue: null,
      displayedValue: null,
      issue: `Expected at least ${scenario.expectedMismatchMinimum} provider mismatches to be detected`,
      severity: "blocker",
    });
  }

  if (scenario.expectedValidationResult === "valid" && invalid) {
    mismatches.push({
      field: "validation",
      visibleValue: validation.errors,
      savedValue: null,
      submittedValue: null,
      retrievedValue: null,
      displayedValue: validation.errors,
      issue: "Scenario expected validation to pass",
      severity: "blocker",
    });
  }
  if (scenario.expectedValidationResult === "invalid" && !invalid) {
    mismatches.push({
      field: "validation",
      visibleValue: validation.errors,
      savedValue: null,
      submittedValue: null,
      retrievedValue: null,
      displayedValue: validation.errors,
      issue: "Scenario expected validation to fail",
      severity: "blocker",
    });
  }
  if (typeof scenario.providerCallShouldBeBlocked === "boolean" && providerCallBlocked !== scenario.providerCallShouldBeBlocked) {
    mismatches.push({
      field: "providerCallBlocked",
      visibleValue: providerCallBlocked,
      savedValue: null,
      submittedValue: providerCallAttempted,
      retrievedValue: null,
      displayedValue: providerCallBlocked,
      issue: `Expected provider blocked to be ${String(scenario.providerCallShouldBeBlocked)}`,
      severity: "blocker",
    });
  }

  return {
    scenario,
    passed: mismatches.length === 0,
    providerCallAttempted,
    providerCallBlocked,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
    payload,
    retrievedProviderPlan,
    persistedState,
    displayedState,
    mismatches,
    reproductionSteps: scenario.userActions.map((action, index) => `${index + 1}. ${action}`),
  };
};

export const runFlightServiceScenarios = (scenarios: FlightServiceScenario[]) => scenarios.map(runFlightServiceScenario);

export const summarizeScenarioResults = (results: ScenarioResult[]) => {
  const issues = results.flatMap((result) => result.mismatches);
  return {
    totalScenarios: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    blockers: issues.filter((issue) => issue.severity === "blocker").length,
    majorIssues: issues.filter((issue) => issue.severity === "major").length,
    minorIssues: issues.filter((issue) => issue.severity === "minor").length,
    providerCallsAttempted: results.filter((result) => result.providerCallAttempted).length,
    providerCallsBlocked: results.filter((result) => result.providerCallBlocked).length,
    seanFeedbackCoverage: new Set(results.map((result) => result.scenario.seanFeedbackId).filter(Boolean)).size,
  };
};
