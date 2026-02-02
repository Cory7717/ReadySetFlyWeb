export type MembershipInterval = "annual" | "biannual" | "monthly";
export type MembershipTier = "pro" | "pro_plus";

export type MembershipPlanOption = {
  interval: MembershipInterval;
  label: string;
  price: number;
  badge?: string;
};

export const membershipTierInfo: Record<MembershipTier, { title: string; subtitle: string }> = {
  pro: {
    title: "RSF Pro (Core)",
    subtitle: "Save, alerts, analytics, and pro training tools.",
  },
  pro_plus: {
    title: "RSF Pro+ (Advanced / Power Pilot)",
    subtitle: "Advanced analytics, trends, and power-user tooling.",
  },
};

export const membershipPlanOptions: Record<MembershipTier, MembershipPlanOption[]> = {
  pro: [
    { interval: "annual", label: "Annual", price: 149.0, badge: "Best Value" },
    { interval: "biannual", label: "6 Months", price: 79.99 },
    { interval: "monthly", label: "Monthly", price: 14.99 },
  ],
  pro_plus: [
    { interval: "annual", label: "Annual", price: 249.0, badge: "Best Value" },
    { interval: "biannual", label: "6 Months", price: 139.99 },
    { interval: "monthly", label: "Monthly", price: 24.99 },
  ],
};
