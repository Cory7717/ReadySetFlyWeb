import type { User } from "@shared/schema";

export type MembershipTier = "free" | "pro" | "pro_plus";
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

function addPlan(planId: string | undefined, tier: MembershipTier, interval: BillingInterval) {
  if (!planId) return;
  PLAN_ENV_MAP[planId] = { tier, interval };
}

// RSF Pro plans
addPlan(process.env.PAYPAL_PLAN_PRO_MONTHLY, "pro", "monthly");
addPlan(process.env.PAYPAL_PLAN_PRO_BIANNUAL, "pro", "biannual");
addPlan(process.env.PAYPAL_PLAN_PRO_ANNUAL, "pro", "annual");

// RSF Pro+ plans
addPlan(process.env.PAYPAL_PLAN_PROPLUS_MONTHLY, "pro_plus", "monthly");
addPlan(process.env.PAYPAL_PLAN_PROPLUS_BIANNUAL, "pro_plus", "biannual");
addPlan(process.env.PAYPAL_PLAN_PROPLUS_ANNUAL, "pro_plus", "annual");

// Legacy Logbook Pro plans (map to RSF Pro core)
addPlan(process.env.PAYPAL_LOGBOOK_PLAN_MONTHLY_ID, "pro", "monthly");
addPlan(process.env.PAYPAL_LOGBOOK_PLAN_BIANNUAL_ID, "pro", "biannual");
addPlan(process.env.PAYPAL_LOGBOOK_PLAN_YEARLY_ID, "pro", "annual");

export function resolvePayPalPlanId(tier: "pro" | "pro_plus", interval: BillingInterval): string {
  const mapping: Record<"pro" | "pro_plus", Record<BillingInterval, string | undefined>> = {
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

  const planId = mapping[tier]?.[interval];
  if (!planId) {
    throw new Error("Missing PayPal plan ID for selected tier and interval");
  }
  return planId;
}

export function resolveMembershipFromPlanId(planId?: string | null): MembershipPlanInfo | null {
  if (!planId) return null;
  return PLAN_ENV_MAP[planId] || null;
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

  const legacyStatus = mapLegacyStatus(user.logbookProStatus);
  const legacyEndsAt = user.logbookProEndsAt ? new Date(user.logbookProEndsAt) : null;

  if (tier === "free" || status === "inactive") {
    if (legacyStatus !== "inactive") {
      tier = "pro";
      status = legacyStatus;
      endsAt = legacyEndsAt || endsAt;
      interval = interval || (user.logbookProPlan as BillingInterval | null);
      provider = provider || "paypal";
      paypalSubscriptionId = paypalSubscriptionId || user.logbookProSubscriptionId || null;
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
        tier: "pro_plus" as MembershipTier,
        canPersist: true,
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
        membershipEndsAt: undefined,
        membershipTrialEndsAt: undefined,
        membershipNextBillingAt: undefined,
        membershipInterval: undefined,
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
  const isPro = tier === "pro" || tier === "pro_plus";
  const isProPlus = tier === "pro_plus";

  return {
    isGuest,
    tier,
    canPersist: isPro,
    canUseLogbook: isPro,
    canUseAlerts: isPro,
    canUseHistory: isPro,
    canUseAnalytics: isPro,
    canUseScenarioScoring: isPro,
    canUseAdvancedTrends: isProPlus,
    canUseGpsSims: isPro,
    canCreateEvents: isPro,
    canCreateListings: isPro,
    canUseVorGuided: isPro,
    membershipEndsAt: membership.endsAt ? membership.endsAt.toISOString() : undefined,
    membershipTrialEndsAt: membership.trialEndsAt ? membership.trialEndsAt.toISOString() : undefined,
    membershipNextBillingAt: membership.nextBillingAt ? membership.nextBillingAt.toISOString() : undefined,
    membershipInterval: membership.interval || undefined,
  };
}
