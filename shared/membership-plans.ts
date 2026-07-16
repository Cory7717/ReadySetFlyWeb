export type MembershipInterval = "annual" | "biannual" | "monthly";
export type MembershipTier = "premium";
export type LegacyMembershipTier = "pro" | "pro_plus" | "pro_core" | "core";
export type StoredMembershipTier = "free" | MembershipTier | LegacyMembershipTier;

export type MembershipPlanOption = {
  interval: MembershipInterval;
  label: string;
  price: number;
  badge?: string;
  trialDays?: number;
};

export const BASIC_TIER_LABEL = "RSF Basic";
export const PREMIUM_TIER_LABEL = "RSF Premium";
export const PREMIUM_MONTHLY_PRICE = 4.99;
export const PREMIUM_ANNUAL_PRICE = 49.99;
export const PREMIUM_TRIAL_DAYS = 14;
export const PREMIUM_ANNUAL_MONTHLY_EQUIVALENT = PREMIUM_MONTHLY_PRICE * 12;
export const PREMIUM_ANNUAL_SAVINGS = Number((PREMIUM_ANNUAL_MONTHLY_EQUIVALENT - PREMIUM_ANNUAL_PRICE).toFixed(2));
export const PREMIUM_ANNUAL_SAVINGS_PERCENT = Math.round((PREMIUM_ANNUAL_SAVINGS / PREMIUM_ANNUAL_MONTHLY_EQUIVALENT) * 100);

export const isPremiumTier = (tier?: string | null) =>
  ["premium", "pro", "pro_plus", "pro_core", "core"].includes(String(tier || "").toLowerCase());

export const normalizeMembershipTier = (tier?: string | null): "free" | "premium" =>
  isPremiumTier(tier) ? "premium" : "free";

export const membershipTierInfo: Record<MembershipTier, { title: string; subtitle: string; features: string[] }> = {
  premium: {
    title: PREMIUM_TIER_LABEL,
    subtitle: "Unlock the complete Ready Set Fly aviation ecosystem.",
    features: [
      "Unlimited active flight plans.",
      "AI Weather and NOTAM tools.",
      "Student Hub, CFI tools, and flight school management.",
      "Digital logbook, currency tracking, and compliance monitoring.",
      "Synthetic vision, ADS-B enhancements, premium marketplace features, and advanced analytics.",
    ],
  },
};

export const membershipPlanOptions: Record<MembershipTier, MembershipPlanOption[]> = {
  premium: [
    { interval: "monthly", label: "Monthly", price: PREMIUM_MONTHLY_PRICE, trialDays: PREMIUM_TRIAL_DAYS },
    { interval: "annual", label: "Annual", price: PREMIUM_ANNUAL_PRICE, badge: `${PREMIUM_ANNUAL_SAVINGS_PERCENT}% savings`, trialDays: PREMIUM_TRIAL_DAYS },
  ],
};
