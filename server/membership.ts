import type { User } from "@shared/schema";
import { normalizeMembershipTier, type StoredMembershipTier } from "@shared/membership-plans";

export type MembershipTier = "free" | "premium" | "pro" | "pro_plus" | "pro_core" | "core";
export type MembershipStatus = "active" | "inactive" | "cancelled" | "past_due" | "trialing";
export type BillingInterval = "monthly" | "biannual" | "annual";

type MembershipPlanInfo = { tier: MembershipTier; interval: BillingInterval };

const SUPER_ADMIN_EMAILS = new Set(
  (process.env.RSF_SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

export function isSuperAdminEmail(email?: string | null) {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return false;
  return normalized.endsWith("@readysetfly.us") || SUPER_ADMIN_EMAILS.has(normalized);
}

const PLAN_ENV_MAP: Record<string, MembershipPlanInfo> = {};
const STORE_PRODUCT_ENV_MAP: Record<string, MembershipPlanInfo> = {};

function addPlan(planId: string | undefined, tier: MembershipTier, interval: BillingInterval) {
  if (!planId) return;
  PLAN_ENV_MAP[planId] = { tier, interval };
}

function addStoreProduct(productId: string | undefined, tier: MembershipTier, interval: BillingInterval) {
  if (!productId) return;
  STORE_PRODUCT_ENV_MAP[productId] = { tier, interval };
}

// RSF Premium plans
addPlan(process.env.PAYPAL_PLAN_PREMIUM_MONTHLY, "premium", "monthly");

// Legacy paid plan IDs now grant RSF Premium.
addPlan(process.env.PAYPAL_PLAN_PRO_MONTHLY, "pro", "monthly");
addPlan(process.env.PAYPAL_PLAN_PRO_BIANNUAL, "pro", "biannual");
addPlan(process.env.PAYPAL_PLAN_PRO_ANNUAL, "pro", "annual");

// Legacy higher-tier paid plan IDs now grant RSF Premium.
addPlan(process.env.PAYPAL_PLAN_PROPLUS_MONTHLY, "pro_plus", "monthly");
addPlan(process.env.PAYPAL_PLAN_PROPLUS_BIANNUAL, "pro_plus", "biannual");
addPlan(process.env.PAYPAL_PLAN_PROPLUS_ANNUAL, "pro_plus", "annual");

// Legacy logbook plan IDs now grant RSF Premium.
addPlan(process.env.PAYPAL_LOGBOOK_PLAN_MONTHLY_ID, "pro", "monthly");
addPlan(process.env.PAYPAL_LOGBOOK_PLAN_BIANNUAL_ID, "pro", "biannual");
addPlan(process.env.PAYPAL_LOGBOOK_PLAN_YEARLY_ID, "pro", "annual");

// RevenueCat / native store products
addStoreProduct(process.env.REVENUECAT_PRO_MONTHLY_PRODUCT_ID, "pro", "monthly");
addStoreProduct(process.env.REVENUECAT_PRO_BIANNUAL_PRODUCT_ID, "pro", "biannual");
addStoreProduct(process.env.REVENUECAT_PRO_ANNUAL_PRODUCT_ID, "pro", "annual");
addStoreProduct(process.env.REVENUECAT_PROPLUS_MONTHLY_PRODUCT_ID, "pro_plus", "monthly");
addStoreProduct(process.env.REVENUECAT_PROPLUS_BIANNUAL_PRODUCT_ID, "pro_plus", "biannual");
addStoreProduct(process.env.REVENUECAT_PROPLUS_ANNUAL_PRODUCT_ID, "pro_plus", "annual");
addStoreProduct(process.env.REVENUECAT_PREMIUM_MONTHLY_PRODUCT_ID, "premium", "monthly");

export function resolvePayPalPlanId(tier: "premium" | "pro" | "pro_plus", interval: BillingInterval): string {
  const normalizedTier = normalizeMembershipTier(tier) === "premium" ? "premium" : tier;
  const mapping: Record<"premium" | "pro" | "pro_plus", Record<BillingInterval, string | undefined>> = {
    premium: {
      monthly: process.env.PAYPAL_PLAN_PREMIUM_MONTHLY || process.env.PAYPAL_PLAN_PROPLUS_MONTHLY || process.env.PAYPAL_PLAN_PRO_MONTHLY,
      biannual: undefined,
      annual: undefined,
    },
    pro: {
      monthly: process.env.PAYPAL_PLAN_PRO_MONTHLY,
      biannual: process.env.PAYPAL_PLAN_PRO_BIANNUAL,
      annual: process.env.PAYPAL_PLAN_PRO_ANNUAL,
    },
    pro_plus: {
      monthly: process.env.PAYPAL_PLAN_PROPLUS_MONTHLY,
      biannual: process.env.PAYPAL_PLAN_PROPLUS_BIANNUAL,
      annual: process.env.PAYPAL_PLAN_PROPLUS_ANNUAL,
    },
  };

  const planId = mapping[normalizedTier]?.[interval];
  if (!planId) {
    throw new Error("Missing PayPal plan ID for selected tier and interval");
  }
  return planId;
}

export function resolveMembershipFromPlanId(planId?: string | null): MembershipPlanInfo | null {
  if (!planId) return null;
  return PLAN_ENV_MAP[planId] || null;
}

function inferMembershipFromIdentifier(identifier: string): MembershipPlanInfo | null {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return null;

  const tier: MembershipTier | null = normalized.includes("pro_plus") || normalized.includes("proplus")
    ? "pro_plus"
    : normalized.includes("pro")
      ? "pro"
      : null;
  if (!tier) return null;

  const interval: BillingInterval = normalized.includes("biannual") ||
    normalized.includes("6month") ||
    normalized.includes("6-month") ||
    normalized.includes("semiannual") ||
    normalized.includes("sixmonth")
    ? "biannual"
    : normalized.includes("annual") || normalized.includes("year")
      ? "annual"
      : "monthly";

  return { tier, interval };
}

export function resolveMembershipFromStoreSignals(args: {
  productIds?: string[] | null;
  entitlementIds?: string[] | null;
}): MembershipPlanInfo | null {
  const identifiers = [
    ...(args.productIds || []),
    ...(args.entitlementIds || []),
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => !!value);

  for (const identifier of identifiers) {
    const direct = STORE_PRODUCT_ENV_MAP[identifier];
    if (direct) return direct;
  }

  let best: MembershipPlanInfo | null = null;
  const rank = (info: MembershipPlanInfo) =>
    (info.tier === "pro_plus" ? 10 : 0) +
    (info.interval === "annual" ? 3 : info.interval === "biannual" ? 2 : 1);

  for (const identifier of identifiers) {
    const inferred = inferMembershipFromIdentifier(identifier);
    if (!inferred) continue;
    if (!best || rank(inferred) > rank(best)) {
      best = inferred;
    }
  }

  return best;
}

function mapLegacyStatus(status?: string | null): MembershipStatus {
  const normalized = (status || "free").toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "trialing") return "trialing";
  if (["cancelled", "canceled", "expired", "suspended"].includes(normalized)) return "cancelled";
  if (["payment_failed", "past_due"].includes(normalized)) return "past_due";
  return "inactive";
}

export function mapPayPalStatusToMembership(status?: string | null): MembershipStatus {
  const normalized = (status || "UNKNOWN").toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "trialing") return "trialing";
  if (normalized === "approved") return "active";
  if (["cancelled", "canceled", "expired", "suspended"].includes(normalized)) return "cancelled";
  if (["payment_failed", "past_due"].includes(normalized)) return "past_due";
  return "inactive";
}

export function getEffectiveMembership(user?: User | null) {
  if (!user) {
    return {
      tier: "free" as MembershipTier,
      status: "inactive" as MembershipStatus,
      endsAt: null as Date | null,
      trialEndsAt: null as Date | null,
      nextBillingAt: null as Date | null,
      interval: null as BillingInterval | null,
      provider: null as string | null,
      paypalSubscriptionId: null as string | null,
      paypalPlanId: null as string | null,
    };
  }

  let tier = (user.membershipTier || "free") as MembershipTier;
  let status = (user.membershipStatus || "inactive") as MembershipStatus;
  let endsAt = user.membershipEndsAt ? new Date(user.membershipEndsAt) : null;
  let trialEndsAt = user.membershipTrialEndsAt ? new Date(user.membershipTrialEndsAt) : null;
  let nextBillingAt = user.membershipNextBillingAt ? new Date(user.membershipNextBillingAt) : null;
  let interval = (user.membershipInterval || null) as BillingInterval | null;
  let provider = user.membershipProvider || null;
  let paypalSubscriptionId = user.paypalSubscriptionId || user.logbookProSubscriptionId || null;
  let paypalPlanId = user.paypalPlanId || null;
  const now = new Date();

  const legacyStatus = mapLegacyStatus(user.logbookProStatus);
  const legacyEndsAt = user.logbookProEndsAt ? new Date(user.logbookProEndsAt) : null;

  if (tier === "free" || status === "inactive") {
    if (legacyStatus !== "inactive") {
      tier = "premium";
      status = legacyStatus;
      endsAt = legacyEndsAt || endsAt;
      interval = interval || (user.logbookProPlan as BillingInterval | null);
      provider = provider || "paypal";
      paypalSubscriptionId = paypalSubscriptionId || user.logbookProSubscriptionId || null;
    }
  }

  const grantTierRaw = user.membershipGrantTier;
  const grantTier =
    normalizeMembershipTier(grantTierRaw as StoredMembershipTier) === "premium"
      ? "premium"
      : null;
  const grantEndsAt = user.membershipGrantEndsAt
    ? new Date(user.membershipGrantEndsAt)
    : null;
  const grantActive = !!grantTier && !!grantEndsAt && grantEndsAt > now;
  const tierRank = (value: MembershipTier | "free") =>
    normalizeMembershipTier(value) === "premium" ? 1 : 0;

  if (grantActive) {
    const currentRank = tierRank(tier);
    const grantRank = tierRank(grantTier);
    const shouldApplyGrant =
      status === "inactive" ||
      grantRank > currentRank ||
      (grantRank === currentRank && (!endsAt || grantEndsAt > endsAt));

    if (shouldApplyGrant) {
      tier = grantTier;
      status = "active";
      endsAt = grantEndsAt;
      trialEndsAt = null;
      nextBillingAt = null;
      interval = null;
      provider = "admin_grant";
      paypalSubscriptionId = null;
      paypalPlanId = null;
    }
  }

  return {
    tier,
    status,
    endsAt,
    trialEndsAt,
    nextBillingAt,
    interval,
    provider,
    paypalSubscriptionId,
    paypalPlanId,
  };
}

export function getEntitlementsForUser(user?: User | null) {
  const isGuest = !user;
  if (user) {
    if (user.isSuperAdmin || isSuperAdminEmail(user.email)) {
      return {
        isGuest: false,
        tier: "premium" as const,
        canPersist: true,
        canUseFlightPlanner: true,
        canUseUnlimitedActiveFlightPlans: true,
        canUseLogbook: true,
        canUseAlerts: true,
        canUseHistory: true,
        canUseAnalytics: true,
        canUseScenarioScoring: true,
        canUseAdvancedTrends: true,
        canUseGpsSims: true,
        canCreateEvents: true,
        canCreateListings: true,
        canUseVorGuided: true,
        canUseCfi: true,
        membershipEndsAt: undefined,
        membershipTrialEndsAt: undefined,
        membershipNextBillingAt: undefined,
        membershipInterval: undefined,
        cfiTrialEndsAt: undefined,
        cfiGrantEndsAt: undefined,
        cfiAccessEndsAt: undefined,
      };
    }
  }

  const membership = getEffectiveMembership(user || null);
  const now = new Date();
  const hasTimeRemaining = membership.endsAt ? membership.endsAt > now : false;
  const isActive =
    membership.status === "active" ||
    membership.status === "trialing" ||
    (membership.status !== "inactive" && hasTimeRemaining);
  const tier = isActive ? membership.tier : "free";
  const normalizedTier = normalizeMembershipTier(tier);
  const isPremium = normalizedTier === "premium";
  const cfiTrialEndsAt = user?.cfiTrialEndsAt ? new Date(user.cfiTrialEndsAt) : null;
  const cfiGrantEndsAt = user?.cfiGrantEndsAt ? new Date(user.cfiGrantEndsAt) : null;
  const cfiTrialActive = cfiTrialEndsAt ? cfiTrialEndsAt > now : false;
  const cfiGrantActive = cfiGrantEndsAt ? cfiGrantEndsAt > now : false;
  const cfiAccessEndsAt = [cfiTrialEndsAt, cfiGrantEndsAt]
    .filter((value): value is Date => !!value)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const canUseCfi = isPremium || cfiTrialActive || cfiGrantActive;

  return {
    isGuest,
    tier: normalizedTier,
    legacyTier: tier,
    canPersist: !isGuest,
    canUseFlightPlanner: !isGuest,
    canUseUnlimitedActiveFlightPlans: isPremium,
    canUseLogbook: isPremium,
    canUseAlerts: isPremium,
    canUseHistory: isPremium,
    canUseAnalytics: isPremium,
    canUseScenarioScoring: isPremium,
    canUseAdvancedTrends: isPremium,
    canUseGpsSims: isPremium,
    canCreateEvents: !isGuest,
    canCreateListings: isPremium,
    canUseVorGuided: isPremium,
    canUseCfi,
    membershipEndsAt: membership.endsAt ? membership.endsAt.toISOString() : undefined,
    membershipTrialEndsAt: membership.trialEndsAt ? membership.trialEndsAt.toISOString() : undefined,
    membershipNextBillingAt: membership.nextBillingAt ? membership.nextBillingAt.toISOString() : undefined,
    membershipInterval: membership.interval || undefined,
    cfiTrialEndsAt: cfiTrialEndsAt ? cfiTrialEndsAt.toISOString() : undefined,
    cfiGrantEndsAt: cfiGrantEndsAt ? cfiGrantEndsAt.toISOString() : undefined,
    cfiAccessEndsAt: cfiAccessEndsAt ? cfiAccessEndsAt.toISOString() : undefined,
  };
}
