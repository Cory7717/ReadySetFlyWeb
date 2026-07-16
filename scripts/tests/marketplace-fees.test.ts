import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateMarketplaceListingFee,
  getBasePrice,
} from "../../shared/config/listingPricing";

test("marketplace listing fee discounts apply to Premium and legacy paid tiers", () => {
  const base = getBasePrice("aircraft-sale", "basic");

  const freeBreakdown = calculateMarketplaceListingFee({
    category: "aircraft-sale",
    tier: "basic",
    membershipTier: "free",
    isTraditionalMarketplace: true,
  });

  assert.equal(freeBreakdown.baseListingFee, base);
  assert.equal(freeBreakdown.membershipDiscountPct, 0);
  assert.equal(freeBreakdown.membershipDiscountAmount, 0);
  assert.equal(freeBreakdown.finalListingFee, base);

  const premiumBreakdown = calculateMarketplaceListingFee({
    category: "aircraft-sale",
    tier: "basic",
    membershipTier: "premium",
    isTraditionalMarketplace: true,
  });

  assert.equal(premiumBreakdown.membershipDiscountPct, 20);
  assert.equal(premiumBreakdown.membershipDiscountAmount, 5);
  assert.equal(premiumBreakdown.finalListingFee, 20);
  assert.equal(premiumBreakdown.membershipTierApplied, "premium");

  const legacyProPlusBreakdown = calculateMarketplaceListingFee({
    category: "aircraft-sale",
    tier: "basic",
    membershipTier: "pro_plus",
    isTraditionalMarketplace: true,
  });

  assert.equal(legacyProPlusBreakdown.membershipDiscountPct, 20);
  assert.equal(legacyProPlusBreakdown.membershipDiscountAmount, 5);
  assert.equal(legacyProPlusBreakdown.finalListingFee, 20);
  assert.equal(legacyProPlusBreakdown.membershipTierApplied, "premium");
});

test("membership discounts are disabled for non-traditional listings", () => {
  const breakdown = calculateMarketplaceListingFee({
    category: "rental",
    tier: "basic",
    membershipTier: "pro_plus",
    isTraditionalMarketplace: false,
  });

  assert.equal(breakdown.membershipDiscountPct, 0);
  assert.equal(breakdown.membershipDiscountAmount, 0);
  assert.equal(breakdown.finalListingFee, breakdown.baseListingFee);
});
