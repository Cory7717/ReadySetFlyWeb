import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateMarketplaceListingFee,
  getBasePrice,
} from "../../shared/config/listingPricing.js";

test("marketplace listing fee discounts apply to Pro tiers", () => {
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

  const proBreakdown = calculateMarketplaceListingFee({
    category: "aircraft-sale",
    tier: "basic",
    membershipTier: "pro",
    isTraditionalMarketplace: true,
  });

  assert.equal(proBreakdown.membershipDiscountPct, 10);
  assert.equal(proBreakdown.membershipDiscountAmount, 2.5);
  assert.equal(proBreakdown.finalListingFee, 22.5);

  const proPlusBreakdown = calculateMarketplaceListingFee({
    category: "aircraft-sale",
    tier: "basic",
    membershipTier: "pro_plus",
    isTraditionalMarketplace: true,
  });

  assert.equal(proPlusBreakdown.membershipDiscountPct, 20);
  assert.equal(proPlusBreakdown.membershipDiscountAmount, 5);
  assert.equal(proPlusBreakdown.finalListingFee, 20);
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
