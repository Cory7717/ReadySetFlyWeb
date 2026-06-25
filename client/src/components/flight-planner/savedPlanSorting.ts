import type { FlightPlan } from "@shared/schema";

export type SavedPlanSection = {
  currentPlans: FlightPlan[];
  pastPlans: FlightPlan[];
};

export type SavedPlanStatusChip = {
  label: string;
  tone: "current" | "past" | "review";
};

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const normalizeStatus = (plan: FlightPlan | null | undefined) =>
  String(plan?.filingStatus || "draft").trim().toLowerCase();

const dateMs = (value: unknown) => {
  if (!value) return 0;
  const ms = new Date(String(value)).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const latestHistoryMs = (plan: FlightPlan) => {
  const history = Array.isArray((plan as Record<string, unknown>).filingActionHistory)
    ? (plan as Record<string, unknown>).filingActionHistory as Array<Record<string, unknown>>
    : [];
  return history.reduce((latest, entry) => Math.max(
    latest,
    dateMs(entry.stagedAt) || dateMs(entry.timestamp) || dateMs(entry.createdAt),
  ), 0);
};

export const savedPlanNeedsProviderReview = (plan: FlightPlan | null | undefined) =>
  asRecord((plan as Record<string, unknown> | null | undefined)?.filingProviderSnapshot).providerPendingReview === true;

const isPastSavedPlan = (plan: FlightPlan) => {
  if (savedPlanNeedsProviderReview(plan)) return false;
  const status = normalizeStatus(plan);
  return ["closed", "cancelled", "canceled", "expired", "completed", "inactive"].includes(status);
};

const currentPriority = (plan: FlightPlan) => {
  if (savedPlanNeedsProviderReview(plan)) return 0;
  const status = normalizeStatus(plan);
  if (["activated", "active"].includes(status)) return 1;
  if (["filed", "proposed", "staged"].includes(status)) return 2;
  if (String(plan.filingPendingAction || "").trim()) return 3;
  return 4;
};

const currentRecencyMs = (plan: FlightPlan) => Math.max(
  dateMs(plan.filingLastProviderSyncAt),
  latestHistoryMs(plan),
  dateMs((plan as Record<string, unknown>).updatedAt),
  dateMs((plan as Record<string, unknown>).createdAt),
);

const pastRecencyMs = (plan: FlightPlan) => Math.max(
  dateMs((plan as Record<string, unknown>).closedAt),
  dateMs((plan as Record<string, unknown>).cancelledAt),
  latestHistoryMs(plan),
  dateMs((plan as Record<string, unknown>).updatedAt),
  dateMs((plan as Record<string, unknown>).createdAt),
);

const stableTitle = (plan: FlightPlan) => String(plan.title || plan.id || "");

export const groupSavedFlightPlans = (plans: FlightPlan[]): SavedPlanSection => {
  const currentPlans: FlightPlan[] = [];
  const pastPlans: FlightPlan[] = [];

  for (const plan of plans) {
    if (isPastSavedPlan(plan)) {
      pastPlans.push(plan);
    } else {
      currentPlans.push(plan);
    }
  }

  currentPlans.sort((a, b) =>
    currentPriority(a) - currentPriority(b) ||
    currentRecencyMs(b) - currentRecencyMs(a) ||
    stableTitle(a).localeCompare(stableTitle(b))
  );

  pastPlans.sort((a, b) =>
    pastRecencyMs(b) - pastRecencyMs(a) ||
    stableTitle(a).localeCompare(stableTitle(b))
  );

  return { currentPlans, pastPlans };
};

export const getSavedPlanStatusChip = (plan: FlightPlan): SavedPlanStatusChip => {
  if (savedPlanNeedsProviderReview(plan)) return { label: "Needs Review", tone: "review" };
  if (String(plan.filingPendingAction || "").trim()) return { label: "Amendment Pending", tone: "current" };

  switch (normalizeStatus(plan)) {
    case "activated":
    case "active":
      return { label: "Active", tone: "current" };
    case "filed":
      return { label: "Filed", tone: "current" };
    case "proposed":
    case "staged":
      return { label: "Proposed", tone: "current" };
    case "closed":
      return { label: "Closed", tone: "past" };
    case "cancelled":
    case "canceled":
      return { label: "Cancelled", tone: "past" };
    case "expired":
      return { label: "Expired", tone: "past" };
    case "completed":
      return { label: "Completed", tone: "past" };
    default:
      return { label: "Draft", tone: "current" };
  }
};
