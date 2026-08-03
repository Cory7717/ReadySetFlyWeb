import { isGenuineFilingProviderPlanId } from "@shared/flight-plan-filing";
import type { FlightPlan } from "@shared/schema";

const terminalStatuses = new Set(["cancelled", "canceled", "closed"]);

export const planNeedsProviderWebhookRecovery = (
  plan: FlightPlan | null | undefined,
) => {
  if (!plan || !isGenuineFilingProviderPlanId(plan.filingProviderPlanId)) {
    return false;
  }
  const snapshot =
    plan.filingProviderSnapshot &&
    typeof plan.filingProviderSnapshot === "object" &&
    !Array.isArray(plan.filingProviderSnapshot)
      ? (plan.filingProviderSnapshot as Record<string, unknown>)
      : {};
  const status = String(plan.filingStatus || "").trim().toLowerCase();
  return (
    snapshot.providerWebhookRetrievalPending === true &&
    !terminalStatuses.has(status) &&
    plan.isCertificationTest !== true &&
    String(plan.source || "") !== "leidos-certification"
  );
};
