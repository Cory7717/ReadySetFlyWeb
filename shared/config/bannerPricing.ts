export const BANNER_AD_CREATION_FEE = 40.00;

export const BANNER_AD_TIERS = {
  "1month": {
    label: "1 Month",
    months: 1,
    monthlyRate: 75.00,
    totalPrice: 75.00,
    description: "Entry-level, test water",
  },
  "3months": {
    label: "3 Months",
    months: 3,
    monthlyRate: 60.00,
    totalPrice: 180.00,
    description: "Most purchased",
    badge: "Popular",
  },
  "6months": {
    label: "6 Months",
    months: 6,
    monthlyRate: 50.00,
    totalPrice: 300.00,
    description: "Best long-term value",
    badge: "Best Value",
  },
  "12months": {
    label: "12 Months",
    months: 12,
    monthlyRate: 45.00,
    totalPrice: 540.00,
    description: "Commitment tier",
  },
} as const;

export type BannerAdTier = keyof typeof BANNER_AD_TIERS;

export function calculateBannerAdPricing(tier: BannerAdTier, includeCreationFee: boolean = true) {
  const tierData = BANNER_AD_TIERS[tier];
  const subscriptionTotal = tierData.totalPrice;
  const creationFee = includeCreationFee ? BANNER_AD_CREATION_FEE : 0;
  const grandTotal = subscriptionTotal + creationFee;

  return {
    tier,
    monthlyRate: tierData.monthlyRate,
    months: tierData.months,
    subscriptionTotal,
    creationFee,
    grandTotal,
    label: tierData.label,
    description: tierData.description,
    badge: 'badge' in tierData ? tierData.badge : undefined,
  };
}
