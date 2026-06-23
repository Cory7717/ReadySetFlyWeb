import type { FlightPlan } from "./schema";

export const ACTIVE_FLIGHT_PLAN_STATUSES = new Set([
  "draft",
  "staged",
  "filed",
  "proposed",
  "activated",
  "open",
  "awaiting_action",
  "awaiting-action",
  "pending",
]);

export const CLOSED_FLIGHT_PLAN_STATUSES = new Set([
  "closed",
  "cancelled",
  "canceled",
  "completed",
  "expired",
]);

export const ACTIVE_FLIGHT_PLAN_LIMIT_MESSAGE =
  "You currently have an active flight plan. Close, cancel, or complete that plan before creating another active flight plan, or upgrade to RSF Premium for unlimited active flight plans.";

export function isActiveFlightPlan(plan: Pick<FlightPlan, "filingStatus"> | null | undefined) {
  const status = String(plan?.filingStatus || "draft").trim().toLowerCase();
  if (CLOSED_FLIGHT_PLAN_STATUSES.has(status)) return false;
  if (ACTIVE_FLIGHT_PLAN_STATUSES.has(status)) return true;
  return true;
}

export function getActiveFlightPlans(plans: FlightPlan[], exceptPlanId?: string | null) {
  return plans.filter((plan) => plan.id !== exceptPlanId && isActiveFlightPlan(plan));
}

export function canCreateAnotherActiveFlightPlan(args: {
  isPremium: boolean;
  existingPlans: FlightPlan[];
  exceptPlanId?: string | null;
}) {
  if (args.isPremium) {
    return { allowed: true, activeCount: 0, message: null as string | null };
  }

  const activePlans = getActiveFlightPlans(args.existingPlans, args.exceptPlanId);
  return {
    allowed: activePlans.length < 1,
    activeCount: activePlans.length,
    message: activePlans.length < 1 ? null : ACTIVE_FLIGHT_PLAN_LIMIT_MESSAGE,
  };
}
