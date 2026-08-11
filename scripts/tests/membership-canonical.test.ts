import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PREMIUM_ANNUAL_PRICE,
  PREMIUM_ANNUAL_SAVINGS,
  PREMIUM_ANNUAL_SAVINGS_PERCENT,
  PREMIUM_MONTHLY_PRICE,
  PREMIUM_TRIAL_DAYS,
  membershipPlanOptions,
  normalizeMembershipTier,
} from "../../shared/membership-plans";

process.env.PAYPAL_PLAN_PREMIUM_MONTHLY = "paypal-premium-monthly";
process.env.PAYPAL_PLAN_PROPLUS_ANNUAL = "paypal-legacy-proplus-annual";
process.env.PAYPAL_PLAN_PRO_MONTHLY = "paypal-legacy-pro-monthly";

const membershipModule = await import("../../server/membership");
const {
  getEntitlementsForUser,
  resolveMembershipFromPlanId,
  resolvePayPalPlanId,
} = membershipModule;

const activeUser = (tier: string, interval: "monthly" | "annual" = "monthly") => ({
  id: "user-1",
  email: "pilot@example.com",
  membershipTier: tier,
  membershipStatus: "active",
  membershipInterval: interval,
});

test("canonical membership pricing is RSF Basic free and RSF Premium monthly or annual", () => {
  assert.equal(normalizeMembershipTier("free"), "free");
  assert.equal(normalizeMembershipTier("premium"), "premium");
  assert.equal(PREMIUM_MONTHLY_PRICE, 4.99);
  assert.equal(PREMIUM_ANNUAL_PRICE, 49.99);
  assert.equal(PREMIUM_TRIAL_DAYS, 14);
  assert.equal(PREMIUM_ANNUAL_SAVINGS, 9.89);
  assert.equal(PREMIUM_ANNUAL_SAVINGS_PERCENT, 17);

  assert.deepEqual(
    membershipPlanOptions.premium.map((option) => option.interval),
    ["monthly", "annual"],
  );
});

test("legacy paid tiers normalize to RSF Premium entitlement", () => {
  for (const tier of ["premium", "pro", "core", "pro_core", "pro_plus"]) {
    assert.equal(normalizeMembershipTier(tier), "premium");
    const entitlements = getEntitlementsForUser(activeUser(tier) as any);
    assert.equal(entitlements.tier, "premium");
    assert.equal(entitlements.canUseLogbook, true);
    assert.equal(entitlements.canUseUnlimitedActiveFlightPlans, true);
  }
});

test("inactive, cancelled, or expired paid records do not retain Premium entitlement", () => {
  for (const status of ["inactive", "cancelled", "past_due"]) {
    const entitlements = getEntitlementsForUser({
      ...activeUser("premium"),
      membershipStatus: status,
      membershipEndsAt: null,
    } as any);
    assert.equal(entitlements.tier, "free");
    assert.equal(entitlements.canUseLogbook, false);
  }
});

test("active admin membership grants return RSF Premium entitlement", () => {
  const entitlements = getEntitlementsForUser({
    ...activeUser("free"),
    membershipStatus: "inactive",
    membershipGrantTier: "premium",
    membershipGrantEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    logbookProStatus: "inactive",
  } as any);

  assert.equal(entitlements.tier, "premium");
  assert.equal(entitlements.canUseUnlimitedActiveFlightPlans, true);
  assert.equal(entitlements.canUseLogbook, true);
});

test("expired admin membership grants do not retain RSF Premium entitlement", () => {
  const entitlements = getEntitlementsForUser({
    ...activeUser("free"),
    membershipStatus: "inactive",
    membershipGrantTier: "premium",
    membershipGrantEndsAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    logbookProStatus: "inactive",
  } as any);

  assert.equal(entitlements.tier, "free");
  assert.equal(entitlements.canUseUnlimitedActiveFlightPlans, false);
  assert.equal(entitlements.canUseLogbook, false);
});

test("monthly and annual PayPal plan IDs map to the same Premium entitlement", () => {
  assert.equal(resolvePayPalPlanId("premium", "monthly"), "paypal-premium-monthly");
  assert.equal(resolvePayPalPlanId("premium", "annual"), "paypal-legacy-proplus-annual");
  assert.deepEqual(resolveMembershipFromPlanId("paypal-premium-monthly"), {
    tier: "premium",
    interval: "monthly",
  });
  assert.deepEqual(resolveMembershipFromPlanId("paypal-legacy-proplus-annual"), {
    tier: "premium",
    interval: "annual",
  });
  assert.deepEqual(resolveMembershipFromPlanId("paypal-legacy-pro-monthly"), {
    tier: "premium",
    interval: "monthly",
  });
});

test("membership UI and AI limits prefer canonical Premium vocabulary", () => {
  const membershipPage = readFileSync("client/src/pages/logbook-pro.tsx", "utf8");
  const appRoutes = readFileSync("client/src/App.tsx", "utf8");
  const aiTools = readFileSync("server/routes/aiTools.ts", "utf8");

  assert.match(membershipPage, /entitlements\?\.tier \|\| \(user as any\)\?\.membershipTier/);
  assert.match(membershipPage, /offerBasePath = "\/membership"/);
  assert.match(appRoutes, /path="\/membership" component=\{\(\) => <LogbookPro \/>\}/);
  assert.match(appRoutes, /path="\/logbook\/pro" component=\{\(\) => <LogbookPro \/>\}/);
  assert.match(appRoutes, /path="\/membership\/success" component=\{LogbookProSuccess\}/);
  assert.match(appRoutes, /path="\/logbook\/pro\/success" component=\{LogbookProSuccess\}/);
  assert.match(aiTools, /isPremium: entitlements\.tier === "premium"/);
  assert.match(aiTools, /requiresPremium: true/);
  assert.match(aiTools, /requiresPro: true, \/\/ Deprecated response alias/);
  assert.doesNotMatch(aiTools, /identity\.isPro/);
});
