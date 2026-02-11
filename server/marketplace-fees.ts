import type { User } from "@shared/schema";
import {
  TAX_RATE,
  calculateMarketplaceListingFee,
  isTraditionalMarketplaceCategory,
  roundToCents,
  type MembershipTier,
} from "@shared/config/listingPricing";
import { getEntitlementsForUser } from "./membership";

export type MarketplaceListingFeeBreakdown = ReturnType<typeof calculateMarketplaceListingFee> & {
  taxAmount: number;
  totalDue: number;
  isTraditionalMarketplace: boolean;
};

type FeeBreakdownInput = {
  category: string;
  tier?: string;
  membershipTier?: MembershipTier;
  user?: User | null;
};

export function resolveMembershipTierForDiscount(user?: User | null, overrideTier?: MembershipTier) {
  if (overrideTier) return overrideTier;
  const entitlements = getEntitlementsForUser(user || null);
  return (entitlements.tier || "free") as MembershipTier;
}

export function buildMarketplaceListingFeeBreakdown({
  category,
  tier,
  membershipTier,
  user,
}: FeeBreakdownInput): MarketplaceListingFeeBreakdown {
  const resolvedTier = resolveMembershipTierForDiscount(user, membershipTier);
  const isTraditional = isTraditionalMarketplaceCategory(category);
  const feeBreakdown = calculateMarketplaceListingFee({
    category,
    tier,
    membershipTier: resolvedTier,
    isTraditionalMarketplace: isTraditional,
  });

  const taxAmount = roundToCents(feeBreakdown.baseListingFee * TAX_RATE);
  const totalDue = roundToCents(feeBreakdown.finalListingFee + taxAmount);

  return {
    ...feeBreakdown,
    taxAmount,
    totalDue,
    isTraditionalMarketplace: isTraditional,
  };
}
