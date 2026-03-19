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
    subtitle: "For active pilots who want saved workflow, cleaner records, and fewer repeat steps.",
    features: [
      "Keep saved flight plans, aircraft profiles, and digital logbook entries synced across devices.",
      "Stop rebuilding repeat trips by reusing planning setups, notes, and saved aircraft assumptions.",
      "Track currency, medical, flight review, and IPC deadlines without a spreadsheet.",
      "Keep radio comms practice history, training progress, and export-ready summaries in one place.",
      "Includes a 14-day free monthly trial so pilots can test the workflow before paying.",
    ],
  },
  pro_plus: {
    title: "RSF Pro+ (Advanced / Power Pilot)",
    subtitle: "For heavier-use pilots who want deeper planning context and power-user tooling.",
    features: [
      "Everything in RSF Pro (Core), plus higher-end planning support as advanced tooling ships.",
      "Best fit for repeat IFR planning, workflow depth, and heavier training volume.",
      "Priority access to beta releases, advanced overlays, and new power-pilot features.",
      "Keeps your planning, training, and records workflow under one paid tier instead of scattered tools.",
      "Includes a 14-day free monthly trial before billing starts.",
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
