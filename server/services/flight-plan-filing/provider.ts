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

export interface FlightPlanFilingProvider {
  stageAction(plan: FlightPlan, action: FlightPlanFilingAction): Promise<FilingServiceResult>;
}

const buildWarnings = (plan: FlightPlan, action: FlightPlanFilingAction) => {
  const warnings: string[] = [];
  if (!plan.tailNumber) warnings.push("Aircraft ID / tail number should be set before provider handoff.");
  if (!plan.departure) warnings.push("Departure airport is missing.");
  if (!plan.destination) warnings.push("Destination airport is missing.");
  if ((plan.filingFlightRules || "VFR").toUpperCase() === "IFR" && !plan.route) {
    warnings.push("IFR routes should be verified before staging the provider request.");
  }
  if ((action === "activate" || action === "close") && (plan.filingFlightRules || "VFR").toUpperCase() !== "VFR") {
    warnings.push(`${action === "activate" ? "Activation" : "Closure"} is only applicable to VFR plans.`);
  }
  return warnings;
};

export class StubFlightPlanFilingProvider implements FlightPlanFilingProvider {
  async stageAction(plan: FlightPlan, action: FlightPlanFilingAction): Promise<FilingServiceResult> {
    const providerPlanId = plan.filingProviderPlanId || `staged-${plan.id}-${action}`;
    const warnings = buildWarnings(plan, action);
    return {
      live: false,
      provider: "Leidos Flight Service",
      action,
      accepted: true,
      message: `RSF staged the ${action.toUpperCase()} request. Live provider submission remains disabled until vendor authorization is complete.`,
      nextStatus: "staged",
      warnings,
      providerUrl: "https://www.1800wxbrief.com/",
      providerPlanId,
      raw: {
        action,
        planId: plan.id,
        filingFlightRules: plan.filingFlightRules || "VFR",
        departure: plan.departure,
        destination: plan.destination,
        route: plan.route || null,
        alternate: plan.alternate || null,
      },
    };
  }
}

export const flightPlanFilingProvider = new StubFlightPlanFilingProvider();
