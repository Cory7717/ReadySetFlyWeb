// Shared pricing configuration for marketplace listings
// JS shim for Node test imports.

export const TAX_RATE = 0.0825; // 8.25% sales tax

// Category-specific pricing (base price before tax)
export const CATEGORY_PRICING = {
  "aircraft-sale": {
    basic: 25,
    standard: 40,
    premium: 100,
  },
  charter: 250,
  cfi: 30,
  "flight-school": 250,
  mechanic: 40,
  job: 40,
  jobs: 40,
};

export function roundToCents(value) {
  return Math.round(value * 100) / 100;
}

export function isTraditionalMarketplaceCategory(category) {
  return Object.prototype.hasOwnProperty.call(CATEGORY_PRICING, category);
}

// Tier information for aircraft-sale category
export const TIER_INFO = {
  basic: {
    id: "basic",
    label: "Basic",
    price: 25,
    description: "Essential features for smaller listings",
    features: ["30-day listing", "Basic visibility", "Up to 3 images"],
  },
  standard: {
    id: "standard",
    label: "Standard",
    price: 40,
    description: "Enhanced features for better exposure",
    features: ["30-day listing", "Enhanced visibility", "Up to 5 images", "Featured badge"],
  },
  premium: {
    id: "premium",
    label: "Premium",
    price: 100,
    description: "Maximum visibility and features",
    features: ["30-day listing", "Top placement", "Up to 10 images", "Featured badge", "Priority support"],
  },
};

export const VALID_TIERS = ["basic", "standard", "premium"];

// Helper to get base price for a listing
export function getBasePrice(category, tier) {
  const categoryPricing = CATEGORY_PRICING[category];

  if (typeof categoryPricing === "object" && tier) {
    return categoryPricing[tier] || categoryPricing.basic || 25;
  }
  if (typeof categoryPricing === "number") {
    return categoryPricing;
  }
  return 25;
}

// Calculate upgrade delta between two tiers
export function getUpgradeDelta(category, currentTier, newTier) {
  const currentPrice = getBasePrice(category, currentTier);
  const newPrice = getBasePrice(category, newTier);
  return newPrice - currentPrice;
}

// Calculate total with tax
export function calculateTotalWithTax(baseAmount) {
  return baseAmount + baseAmount * TAX_RATE;
}

const resolveMembershipDiscountPct = (membershipTier) => {
  if (["premium", "pro", "pro_plus", "pro_core", "core"].includes(String(membershipTier || ""))) return 20;
  return 0;
};

export function calculateMarketplaceListingFee({
  category,
  tier,
  membershipTier = "free",
  isTraditionalMarketplace = true,
}) {
  const baseListingFee = getBasePrice(category, tier);
  const discountPct = isTraditionalMarketplace ? resolveMembershipDiscountPct(membershipTier) : 0;
  const discountAmount = roundToCents(baseListingFee * (discountPct / 100));
  const finalListingFee = roundToCents(baseListingFee - discountAmount);
  const membershipTierApplied = discountPct > 0 ? "premium" : "free";

  return {
    baseListingFee,
    membershipDiscountPct: discountPct,
    membershipDiscountAmount: discountAmount,
    finalListingFee,
    membershipTierApplied,
  };
}

// Get tier index (for comparison)
export function getTierIndex(tier) {
  return VALID_TIERS.indexOf(tier);
}

// Check if upgrade is valid (going up in tier)
export function isValidUpgrade(currentTier, newTier) {
  const currentIndex = getTierIndex(currentTier);
  const newIndex = getTierIndex(newTier);
  return currentIndex !== -1 && newIndex !== -1 && newIndex > currentIndex;
}
