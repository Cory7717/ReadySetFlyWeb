import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeMembershipPromoCode } from "../../server/services/membershipPromotions";

const schemaSource = readFileSync("shared/schema.ts", "utf8");
const migrationSource = readFileSync("migrations/0111_add_membership_promotions.sql", "utf8");
const absPartnerMigrationSource = readFileSync("migrations/0069_seed_abs_partner_offer.sql", "utf8");
const serviceSource = readFileSync("server/services/membershipPromotions.ts", "utf8");
const routesSource = readFileSync("server/routes.ts", "utf8");
const registerSource = readFileSync("client/src/pages/register.tsx", "utf8");
const redeemSource = readFileSync("client/src/pages/redeem.tsx", "utf8");
const absRedeemSource = readFileSync("client/src/pages/abs-redeem.tsx", "utf8");
const appSource = readFileSync("client/src/App.tsx", "utf8");
const logbookProSource = readFileSync("client/src/pages/logbook-pro.tsx", "utf8");
const landingSource = readFileSync("client/src/pages/landing.tsx", "utf8");

test("membership promotion schema is separate from listing promo codes", () => {
  assert.match(schemaSource, /export const promoCodes = pgTable\("promo_codes"/);
  assert.match(schemaSource, /export const membershipPromotions = pgTable\(\s*"membership_promotions"/);
  assert.match(schemaSource, /export const membershipPromotionRedemptions = pgTable\(\s*"membership_promotion_redemptions"/);
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
  assert.match(migrationSource, /max_redemptions_per_user[\s\S]*1/);
  assert.match(migrationSource, /membership_tier[\s\S]*'premium'/);
  assert.match(migrationSource, /expires_at[\s\S]*'2026-12-31 23:59:59'/);
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
  assert.match(routesSource, /app\.post\(\s*"\/api\/membership-promotions\/redeem",\s*isAuthenticated/);
  assert.match(redeemSource, /PENDING_PROMO_KEY/);
  assert.match(redeemSource, /Continue with Google/);
  assert.match(redeemSource, /setLocation\(`\/register\?code=\$\{encodeURIComponent\(code\.trim\(\)\)\}&returnTo=/);
  assert.match(registerSource, /window\.location\.href = apiUrl\(withReturnTo\('\/api\/auth\/google', redirectTarget\)\)/);
  assert.match(registerSource, /fetch\(apiUrl\('\/api\/auth\/web-register'\)/);
  assert.match(registerSource, /promoCode/);
  assert.match(readFileSync("server/unified-auth-routes.ts", "utf8"), /redeemMembershipPromotion\(\{\s*code: promoCode/s);
  assert.match(appSource, /path="\/redeem" component=\{Redeem\}/);
});

test("super admin membership promotions are distinct from listing promo admin", () => {
  assert.match(routesSource, /"\/api\/admin\/membership-promotions",\s*isAuthenticated,\s*isSuperAdmin/);
  assert.match(appSource, /super-admin\/membership-promotions/);
  assert.match(readFileSync("client/src/pages/membership-promotions-admin.tsx", "utf8"), /Membership Promotions/);
});

test("ABS 2 month partner offer is seeded and surfaced through the partner flow", () => {
  assert.match(absPartnerMigrationSource, /ABS 2 Months Free RSF Premium/);
  assert.match(absPartnerMigrationSource, /American Bonanza Society/);
  assert.match(absPartnerMigrationSource, /'abs-2mo-pro-plus'/);
  assert.match(absPartnerMigrationSource, /'premium'/);
  assert.match(absPartnerMigrationSource, /duration_days[\s\S]*60/);
  assert.match(absPartnerMigrationSource, /is_active[\s\S]*true/);
  assert.match(landingSource, /\/api\/membership-partner-offers\/featured/);
  assert.match(landingSource, /\/abs\/redeem/);
  assert.match(logbookProSource, /\/api\/membership-partner-offers\/\$\{offerSlug\}/);
  assert.match(logbookProSource, /\/api\/membership-partner-offers\/validate-member/);
  assert.match(logbookProSource, /\/api\/membership-partner-offers\/redeem/);
  assert.match(absRedeemSource, /offerSlugOverride="abs-premium"/);
  assert.match(appSource, /path="\/abs\/redeem" component=\{AbsRedeem\}/);
  assert.match(appSource, /path="\/logbook\/pro" component=\{\(\) => <LogbookPro \/>\}/);
});

test("partner offer public aliases preserve legacy storage slugs and direct links", () => {
  assert.match(routesSource, /"cpa-premium": "cpa-3mo-pro-plus"/);
  assert.match(routesSource, /"abs-premium": "abs-2mo-pro-plus"/);
  assert.match(routesSource, /resolveMembershipPartnerOfferStorageSlug/);
  assert.match(routesSource, /getMembershipPartnerOfferPublicSlug/);
  assert.match(routesSource, /app\.get\("\/api\/membership-partner-offers\/featured"/);
  assert.match(routesSource, /app\.get\("\/api\/membership-partner-offers\/:slug"/);
  assert.doesNotMatch(landingSource, /LANDING_PARTNER_OFFER_SLUGS/);
});

test("membership plan selector uses explicit dark-panel contrast colors", () => {
  assert.match(logbookProSource, /Choose Free or RSF Premium/);
  assert.match(logbookProSource, /bg-\[#121923\]/);
  assert.match(logbookProSource, /bg-\[#18263a\]/);
  assert.match(logbookProSource, /text-\[#F5F8FC\]/);
  assert.match(logbookProSource, /text-\[#A9BBCD\]/);
  assert.match(logbookProSource, /PREMIUM_MONTHLY_PRICE/);
  assert.match(logbookProSource, /PREMIUM_ANNUAL_PRICE/);
  assert.doesNotMatch(logbookProSource, /\$7\.99/);
  assert.doesNotMatch(logbookProSource, /bg-white\/7[02]/);
  assert.doesNotMatch(logbookProSource, /text-slate-900/);
  assert.doesNotMatch(logbookProSource, /text-slate-700/);
});

test("ABS flexible member identifiers are persisted before redemption to prevent reuse", () => {
  assert.match(routesSource, /FLEXIBLE_PARTNER_IDENTIFIER_SLUGS = new Set\(\["abs-2mo-pro-plus"\]\)/);
  assert.match(routesSource, /buildFlexiblePartnerIdentifier\(\s*selfAttestedValue \|\| normalizedMemberNumber,?\s*\)/);
  assert.match(routesSource, /storage\.addMembershipPartnerOfferMembers\(offer\.id, \[\s*\{/);
  assert.match(routesSource, /normalizedMemberNumber = flexibleIdentifier/);
  assert.match(routesSource, /member = await storage\.getMembershipPartnerOfferMemberByNumber\(\s*offer\.id,\s*normalizedMemberNumber,?\s*\)/);
  assert.match(routesSource, /if \(member\?\.redeemedAt \|\| member\?\.redeemedByUserId\)/);
  assert.match(routesSource, /storage\.redeemMembershipPartnerOfferMember\(\s*member\.id,\s*userId,?\s*\)/);
});

test("membership grants do not mutate recurring billing state", () => {
  const promotionUpdateMatch = serviceSource.match(/UPDATE users\s+SET[\s\S]*?WHERE id = \$5/);
  assert.ok(promotionUpdateMatch, "expected membership promotion user update");
  assert.doesNotMatch(promotionUpdateMatch[0], /paypal|membership_provider|membership_status/i);

  const partnerGrantMatch = routesSource.match(/const updated = await storage\.updateUser\(userId, \{[\s\S]*?membershipGrantReason: reason,[\s\S]*?\}\);/);
  assert.ok(partnerGrantMatch, "expected partner offer grant update");
  assert.doesNotMatch(partnerGrantMatch[0], /paypal|membershipProvider|membershipStatus/i);
});
