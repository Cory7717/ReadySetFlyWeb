export type MembershipInterval = "annual" | "biannual" | "monthly";
export type MembershipTier = "pro" | "pro_plus";

export type MembershipPlanOption = {
  interval: MembershipInterval;
  label: string;
  price: number;
  badge?: string;
  trialDays?: number;
};

export const membershipTierInfo: Record<MembershipTier, { title: string; subtitle: string; features: string[] }> = {
  pro: {
    title: "RSF Pro (Core)",
    subtitle: "Save, alerts, analytics, and pro training workflows.",
    features: [
      "Save flight plans, aircraft profiles, and logbook entries with cloud sync.",
      "Currency tracking with alerts (medical, flight review, IPC).",
      "Endorsements + instructor sign-offs inside the logbook.",
      "Radio Comms Trainer: full scenarios, scoring, and saved practice history.",
      "GPS sims + guided VOR training tools.",
      "Core analytics and export-ready summaries.",
      "10% listing-fee discount on traditional marketplace listings.",
    ],
  },
  pro_plus: {
    title: "RSF Pro+ (Advanced / Power Pilot)",
    subtitle: "Operational intelligence overlays + power-user tooling.",
    features: [
      "Everything in RSF Pro (Core).",
      "TFMS Operational Intelligence: congestion overlay + departure risk score.",
      "Priority access to power-user tools and beta releases.",
      "20% listing-fee discount on traditional marketplace listings.",
    ],
  },
};

export const membershipPlanOptions: Record<MembershipTier, MembershipPlanOption[]> = {
  pro: [
    { interval: "annual", label: "Annual", price: 149.0, badge: "Best Value" },
    { interval: "biannual", label: "6 Months", price: 79.99 },
    { interval: "monthly", label: "Monthly", price: 14.99, trialDays: 7 },
  ],
  pro_plus: [
    { interval: "annual", label: "Annual", price: 249.0, badge: "Best Value" },
    { interval: "biannual", label: "6 Months", price: 139.99 },
    { interval: "monthly", label: "Monthly", price: 24.99, trialDays: 7 },
  ],
};
