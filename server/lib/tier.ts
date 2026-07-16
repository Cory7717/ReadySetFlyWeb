import type { User } from "@shared/schema";
import { getEntitlementsForUser } from "../membership";

export enum PlanTier {
  FREE = "FREE",
  PREMIUM = "PREMIUM",
}

export type TfmsAccessType = "alerts" | "overlay" | "risk";

export function getPlanTier(user?: User | null): PlanTier {
  const entitlements = getEntitlementsForUser(user || null);
  if (entitlements.tier === "premium") return PlanTier.PREMIUM;
  return PlanTier.FREE;
}

export function canAccessTfmsAlerts(user?: User | null): boolean {
  return getPlanTier(user) !== PlanTier.FREE;
}

export function canAccessTfmsOverlay(user?: User | null): boolean {
  return getPlanTier(user) === PlanTier.PREMIUM;
}

export function canAccessTfmsRiskScore(user?: User | null): boolean {
  return getPlanTier(user) === PlanTier.PREMIUM;
}

export function resolveTfmsAccess(user: User | null | undefined, accessType: TfmsAccessType) {
  const tier = getPlanTier(user || null);
  const requiredTier = PlanTier.PREMIUM;
  const allowed = accessType === "alerts"
    ? canAccessTfmsAlerts(user || null)
    : accessType === "overlay"
      ? canAccessTfmsOverlay(user || null)
      : canAccessTfmsRiskScore(user || null);

  return { allowed, tier, requiredTier };
}
