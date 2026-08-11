import assert from "node:assert/strict";
import test from "node:test";
import {
  mapPayPalStatusToMembership,
  resolveMembershipFromStoreSignals,
} from "../../server/membership";

test("RevenueCat Premium and legacy product names resolve to canonical Premium", () => {
  const cases = [
    { id: "rsf_premium_monthly", interval: "monthly" },
    { id: "rsf_premium_annual", interval: "annual" },
    { id: "rsf_pro_monthly", interval: "monthly" },
    { id: "rsf_pro_plus_annual", interval: "annual" },
    { id: "rsf_proplus_6month", interval: "biannual" },
  ] as const;

  for (const item of cases) {
    assert.deepEqual(
      resolveMembershipFromStoreSignals({ productIds: [item.id] }),
      { tier: "premium", interval: item.interval },
    );
  }
});

test("RevenueCat entitlement names resolve to Premium without exposing legacy tiers", () => {
  assert.deepEqual(
    resolveMembershipFromStoreSignals({
      entitlementIds: ["pro_plus_access"],
    }),
    { tier: "premium", interval: "monthly" },
  );
  assert.deepEqual(
    resolveMembershipFromStoreSignals({
      productIds: ["rsf_pro_monthly"],
      entitlementIds: ["rsf_premium_annual_access"],
    }),
    { tier: "premium", interval: "annual" },
  );
});

test("unrelated store products do not grant Premium", () => {
  assert.equal(
    resolveMembershipFromStoreSignals({
      productIds: ["aircraft_listing_basic"],
      entitlementIds: ["free_access"],
    }),
    null,
  );
  assert.equal(resolveMembershipFromStoreSignals({}), null);
});

test("PayPal lifecycle statuses map consistently to membership access states", () => {
  assert.equal(mapPayPalStatusToMembership("ACTIVE"), "active");
  assert.equal(mapPayPalStatusToMembership("APPROVED"), "active");
  assert.equal(mapPayPalStatusToMembership("CANCELLED"), "cancelled");
  assert.equal(mapPayPalStatusToMembership("EXPIRED"), "cancelled");
  assert.equal(mapPayPalStatusToMembership("SUSPENDED"), "cancelled");
  assert.equal(mapPayPalStatusToMembership("PAST_DUE"), "past_due");
  assert.equal(mapPayPalStatusToMembership("UNKNOWN"), "inactive");
});
