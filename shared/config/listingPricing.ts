// Shared pricing configuration for marketplace listings
// Used by both frontend and backend for consistent pricing calculations

export const TAX_RATE = 0.0825; // 8.25% sales tax

// Category-specific pricing (base price before tax)
export const CATEGORY_PRICING: Record<string, Record<string, number> | number> = {
  'aircraft-sale': {
    basic: 25,
    standard: 40,
    premium: 100,
  },
  'charter': 250,
  'cfi': 30,
  'flight-school': 250,
  'mechanic': 40,
  'job': 40,      // Backward compatibility - legacy key
  'jobs': 40,     // New key for consistency
};

// Tier information for aircraft-sale category
export const TIER_INFO = {
  basic: {
    id: 'basic',
    label: 'Basic',
    price: 25,
    description: 'Essential features for smaller listings',
    features: ['30-day listing', 'Basic visibility', 'Up to 3 images']
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    price: 40,
    description: 'Enhanced features for better exposure',
    features: ['30-day listing', 'Enhanced visibility', 'Up to 5 images', 'Featured badge']
  },
  premium: {
    id: 'premium',
    label: 'Premium',
    price: 100,
    description: 'Maximum visibility and features',
    features: ['30-day listing', 'Top placement', 'Up to 10 images', 'Featured badge', 'Priority support']
  },
};

export const VALID_TIERS = ['basic', 'standard', 'premium'] as const;
export type TierType = typeof VALID_TIERS[number];

// Helper to get base price for a listing
export function getBasePrice(category: string, tier?: string): number {
  const categoryPricing = CATEGORY_PRICING[category];
  
  if (typeof categoryPricing === 'object' && tier) {
    return categoryPricing[tier] || categoryPricing.basic || 25;
  } else if (typeof categoryPricing === 'number') {
    return categoryPricing;
  }
  return 25; // Default fallback
}

// Calculate upgrade delta between two tiers
export function getUpgradeDelta(category: string, currentTier: string, newTier: string): number {
  const currentPrice = getBasePrice(category, currentTier);
  const newPrice = getBasePrice(category, newTier);
  return newPrice - currentPrice;
}

// Calculate total with tax
export function calculateTotalWithTax(baseAmount: number): number {
  return baseAmount + (baseAmount * TAX_RATE);
}

// Get tier index (for comparison)
export function getTierIndex(tier: string): number {
  return VALID_TIERS.indexOf(tier as TierType);
}

// Check if upgrade is valid (going up in tier)
export function isValidUpgrade(currentTier: string, newTier: string): boolean {
  const currentIndex = getTierIndex(currentTier);
  const newIndex = getTierIndex(newTier);
  return currentIndex !== -1 && newIndex !== -1 && newIndex > currentIndex;
}
