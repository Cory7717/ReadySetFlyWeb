export type MembershipInterval = "annual" | "biannual" | "monthly";
export type MembershipTier = "pro" | "pro_plus";

export type MembershipPlanOption = {
  interval: MembershipInterval;
  label: string;
  price: number;
  badge?: string;
};

export const membershipTierInfo: Record<MembershipTier, { title: string; subtitle: string; features: string[] }> = {
  pro: {
    title: "RSF Pro (Core)",
    subtitle: "Save, alerts, analytics, and pro training tools.",
    features: [
      "Save logbook entries, flight plans, and training history with cloud sync.",
      "Currency tracking + expiration alerts (medical, flight review, IPC).",
      "Endorsement tracking and instructor sign-offs.",
      "Radio Comms Trainer with full scenarios and scoring.",
      "Core analytics and export-ready summaries.",
    ],
  },
  pro_plus: {
    title: "RSF Pro+ (Advanced / Power Pilot)",
    subtitle: "Advanced analytics, trends, and power-user tooling.",
    features: [
      "Everything in RSF Pro (Core).",
      "Advanced analytics, trend analysis, and proficiency trends.",
      "Expanded reporting and long-range proficiency tracking.",
      "Priority access to power-user tooling as it ships.",
    ],
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
