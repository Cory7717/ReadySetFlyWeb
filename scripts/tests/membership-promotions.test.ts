import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeMembershipPromoCode } from "../../server/services/membershipPromotions";

const schemaSource = readFileSync("shared/schema.ts", "utf8");
const migrationSource = readFileSync("migrations/0111_add_membership_promotions.sql", "utf8");
const serviceSource = readFileSync("server/services/membershipPromotions.ts", "utf8");
const routesSource = readFileSync("server/routes.ts", "utf8");
const registerSource = readFileSync("client/src/pages/register.tsx", "utf8");
const redeemSource = readFileSync("client/src/pages/redeem.tsx", "utf8");
const appSource = readFileSync("client/src/App.tsx", "utf8");

test("membership promotion schema is separate from listing promo codes", () => {
  assert.match(schemaSource, /export const promoCodes = pgTable\("promo_codes"/);
  assert.match(schemaSource, /export const membershipPromotions = pgTable\("membership_promotions"/);
  assert.match(schemaSource, /export const membershipPromotionRedemptions = pgTable\("membership_promotion_redemptions"/);
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS membership_promotions/);
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS membership_promotion_redemptions/);
  assert.doesNotMatch(routesSource, /validatePromoCodeForContext\(code,\s*"membership"/);
});

test("membership promotion codes normalize safely", () => {
  assert.equal(normalizeMembershipPromoCode(" abs2026winner "), "ABS2026WINNER");
  assert.equal(normalizeMembershipPromoCode("abs 2026 winner"), "ABS2026WINNER");
});

test("ABS campaign is seeded through migration, not application source", () => {
  assert.match(migrationSource, /ABS2026WINNER/);
  assert.match(migrationSource, /max_total_redemptions[\s\S]*5/);
  assert.match(migrationSource, /membership_duration_months[\s\S]*12/);
  assert.doesNotMatch(serviceSource, /ABS2026WINNER/);
  assert.doesNotMatch(registerSource, /ABS2026WINNER/);
});

test("redemption service uses atomic transaction and existing membership grant overlay", () => {
  assert.match(serviceSource, /BEGIN/);
  assert.match(serviceSource, /FOR UPDATE/);
  assert.match(serviceSource, /ON CONFLICT \(promotion_id, user_id\) DO NOTHING/);
  assert.match(serviceSource, /redemption_count = redemption_count \+ 1/);
  assert.match(serviceSource, /membership_grant_tier/);
  assert.doesNotMatch(serviceSource, /paypal_subscription_id/i);
});

test("registration and redeem page support optional membership promo codes", () => {
  assert.match(registerSource, /promoCode: z\.string\(\)\.max\(120\)\.optional\(\)/);
  assert.match(registerSource, /Have a partner, event, or giveaway code\? Enter it here\./);
  assert.match(routesSource, /\/api\/membership-promotions\/redeem/);
  assert.match(redeemSource, /PENDING_PROMO_KEY/);
  assert.match(redeemSource, /Continue with Google/);
  assert.match(appSource, /path="\/redeem" component=\{Redeem\}/);
});

test("super admin membership promotions are distinct from listing promo admin", () => {
  assert.match(routesSource, /\/api\/admin\/membership-promotions", isAuthenticated, isSuperAdmin/);
  assert.match(appSource, /super-admin\/membership-promotions/);
  assert.match(readFileSync("client/src/pages/membership-promotions-admin.tsx", "utf8"), /Membership Promotions/);
});
