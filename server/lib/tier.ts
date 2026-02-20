import type { User } from "@shared/schema";
import { getEntitlementsForUser } from "../membership";

export enum PlanTier {
  FREE = "FREE",
  PRO_CORE = "PRO_CORE",
  PRO_PLUS = "PRO_PLUS",
}

export type TfmsAccessType = "alerts" | "overlay" | "risk";

export function getPlanTier(user?: User | null): PlanTier {
  const entitlements = getEntitlementsForUser(user || null);
  if (entitlements.tier === "pro_plus") return PlanTier.PRO_PLUS;
  if (entitlements.tier === "pro") return PlanTier.PRO_CORE;
  return PlanTier.FREE;
}

export function canAccessTfmsAlerts(user?: User | null): boolean {
  return getPlanTier(user) !== PlanTier.FREE;
}

export function canAccessTfmsOverlay(user?: User | null): boolean {
  return getPlanTier(user) === PlanTier.PRO_PLUS;
}

export function canAccessTfmsRiskScore(user?: User | null): boolean {
  return getPlanTier(user) === PlanTier.PRO_PLUS;
}

export function resolveTfmsAccess(user: User | null | undefined, accessType: TfmsAccessType) {
  const tier = getPlanTier(user || null);
  const requiredTier = accessType === "alerts" ? PlanTier.PRO_CORE : PlanTier.PRO_PLUS;
  const allowed = accessType === "alerts"
    ? canAccessTfmsAlerts(user || null)
    : accessType === "overlay"
      ? canAccessTfmsOverlay(user || null)
      : canAccessTfmsRiskScore(user || null);

  return { allowed, tier, requiredTier };
}
