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

export const PREMIUM_MONTHLY_PRICE = 7.99;

export const isPremiumTier = (tier?: string | null) =>
  ["premium", "pro", "pro_plus", "pro_core", "core"].includes(String(tier || "").toLowerCase());

export const normalizeMembershipTier = (tier?: string | null): "free" | "premium" =>
  isPremiumTier(tier) ? "premium" : "free";

export const membershipTierInfo: Record<MembershipTier, { title: string; subtitle: string; features: string[] }> = {
  premium: {
    title: "RSF Premium",
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
    { interval: "monthly", label: "Monthly", price: PREMIUM_MONTHLY_PRICE },
  ],
};
