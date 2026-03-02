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
    subtitle: "Save your planning and logbook workflow after a 14-day trial.",
    features: [
      "14-day free trial on the monthly plan to test the full workflow before you pay.",
      "Save flight plans, aircraft profiles, and digital logbook entries with cloud sync.",
      "Currency tracking with alerts (medical, flight review, IPC) and instructor sign-offs.",
      "Saved training progress, radio comms scoring history, and export-ready summaries.",
      "10% listing-fee discount on traditional marketplace listings.",
    ],
  },
  pro_plus: {
    title: "RSF Pro+ (Advanced / Power Pilot)",
    subtitle: "Advanced planning workspace for heavier-use pilots.",
    features: [
      "Everything in RSF Pro (Core).",
      "14-day free trial on the monthly plan before billing starts.",
      "Advanced planning overlays and power-user tooling as they ship.",
      "Priority access to beta releases and higher-end workflow tools.",
      "20% listing-fee discount on traditional marketplace listings.",
    ],
  },
};

export const membershipPlanOptions: Record<MembershipTier, MembershipPlanOption[]> = {
  pro: [
    { interval: "annual", label: "Annual", price: 59.99, badge: "Best Value" },
    { interval: "biannual", label: "6 Months", price: 32.99 },
    { interval: "monthly", label: "Monthly", price: 5.99, trialDays: 14 },
  ],
  pro_plus: [
    { interval: "annual", label: "Annual", price: 119.99, badge: "Best Value" },
    { interval: "biannual", label: "6 Months", price: 64.99 },
    { interval: "monthly", label: "Monthly", price: 11.99, trialDays: 14 },
  ],
};
