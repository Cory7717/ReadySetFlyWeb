import type { FlightPlan, FlightPlanFilingAction } from "@shared/schema";

export type FilingServiceResult = {
  live: false;
  provider: string;
  action: FlightPlanFilingAction;
  accepted: true;
  message: string;
  nextStatus: "staged";
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

export interface FlightPlanFilingProvider {
  stageAction(plan: FlightPlan, action: FlightPlanFilingAction): Promise<FilingServiceResult>;
}

const normalizeFlightRules = (value?: string | null) => (value || "VFR").toUpperCase();

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

  if (!plan.notes) {
    warnings.push("No filing remarks or notes are attached to this plan.");
  }

  return {
    ready: errors.length === 0,
    errors,
    warnings,
  };
};

export class StubFlightPlanFilingProvider implements FlightPlanFilingProvider {
  async stageAction(plan: FlightPlan, action: FlightPlanFilingAction): Promise<FilingServiceResult> {
    const providerPlanId = plan.filingProviderPlanId || `staged-${plan.id}-${action}`;
    const validation = validateFlightPlanForAction(plan, action);
    return {
      live: false,
      provider: "Leidos Flight Service",
      action,
      accepted: true,
      message: `RSF staged the ${action.toUpperCase()} request. Live provider submission remains disabled until vendor authorization is complete.`,
      nextStatus: "staged",
      warnings: validation.warnings,
      providerUrl: "https://www.1800wxbrief.com/",
      providerPlanId,
      raw: {
        action,
        planId: plan.id,
        filingFlightRules: normalizeFlightRules(plan.filingFlightRules),
        departure: plan.departure,
        destination: plan.destination,
        route: plan.route || null,
        alternate: plan.alternate || null,
        validation,
      },
    };
  }
}

export const flightPlanFilingProvider = new StubFlightPlanFilingProvider();
