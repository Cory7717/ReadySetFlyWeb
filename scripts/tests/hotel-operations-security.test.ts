import assert from "node:assert/strict";
import test from "node:test";
import { canAccessHotelOpsProperty, canInviteHotelOpsRole, safeHotelOpsReturnPath } from "../../server/hotelOperationsPolicy";
import { canTransitionSupportStatus, dedupeSupportRecipients, effectiveSupportPresence, shouldEscalateFirstResponse, supportRetryDelayMs } from "../../server/hotelOperationsSupportPolicy";
import { readFileSync } from "node:fs";

test("hotel operations roles cannot escalate privilege", () => {
  assert.equal(canInviteHotelOpsRole("platform_owner", "above_property_admin"), true);
  assert.equal(canInviteHotelOpsRole("above_property_admin", "platform_owner"), false);
  assert.equal(canInviteHotelOpsRole("above_property_admin", "regional_admin"), true);
  assert.equal(canInviteHotelOpsRole("regional_admin", "property_admin"), true);
  assert.equal(canInviteHotelOpsRole("regional_admin", "regional_admin"), false);
  assert.equal(canInviteHotelOpsRole("regional_admin", "above_property_admin"), false);
  assert.equal(canInviteHotelOpsRole("property_admin", "above_property_admin"), false);
  assert.equal(canInviteHotelOpsRole("property_manager", "property_employee"), true);
  assert.equal(canInviteHotelOpsRole("property_manager", "property_manager"), false);
  assert.equal(canInviteHotelOpsRole("property_employee", "property_employee"), false);
});

test("property-scoped roles cannot access another hotel", () => {
  assert.equal(canAccessHotelOpsProperty("property_admin", ["hotel-a"], "hotel-a"), true);
  assert.equal(canAccessHotelOpsProperty("property_admin", ["hotel-a"], "hotel-b"), false);
  assert.equal(canAccessHotelOpsProperty("property_employee", [], "hotel-a"), false);
  assert.equal(canAccessHotelOpsProperty("above_property_admin", [], "hotel-b"), true);
  assert.equal(canAccessHotelOpsProperty("platform_owner", [], "hotel-b"), true);
  assert.equal(canAccessHotelOpsProperty("regional_admin", ["hotel-a"], "hotel-a"), true);
  assert.equal(canAccessHotelOpsProperty("regional_admin", ["hotel-a"], "hotel-b"), false);
});

test("post-login redirects remain inside the hotel operations portal", () => {
  assert.equal(safeHotelOpsReturnPath("/hoteloperations/dashboard?hotelId=abc"), "/hoteloperations/dashboard?hotelId=abc");
  assert.equal(safeHotelOpsReturnPath("//evil.example/steal"), "/hoteloperations/dashboard");
  assert.equal(safeHotelOpsReturnPath("https://evil.example/steal"), "/hoteloperations/dashboard");
  assert.equal(safeHotelOpsReturnPath("/flight-planner"), "/hoteloperations/dashboard");
});

test("support presence expires and away status is explicit", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  assert.equal(effectiveSupportPresence({ enabled: true, presenceStatus: "online", lastHeartbeatAt: new Date(now.getTime() - 30_000) }, now), "online");
  assert.equal(effectiveSupportPresence({ enabled: true, presenceStatus: "online", lastHeartbeatAt: new Date(now.getTime() - 91_000) }, now), "offline");
  assert.equal(effectiveSupportPresence({ enabled: true, presenceStatus: "away", lastHeartbeatAt: now }, now), "away");
});

test("only unanswered live chats past their database deadline escalate", () => {
  const now = new Date("2026-10-14T12:02:00Z");
  assert.equal(shouldEscalateFirstResponse({ type: "live_chat", firstHumanResponseAt: null, deadlineAt: new Date("2026-10-14T12:02:00Z") }, now), true);
  assert.equal(shouldEscalateFirstResponse({ type: "live_chat", firstHumanResponseAt: new Date(), deadlineAt: new Date("2026-10-14T12:02:00Z") }, now), false);
  assert.equal(shouldEscalateFirstResponse({ type: "ticket", firstHumanResponseAt: null, deadlineAt: new Date("2026-10-14T12:02:00Z") }, now), false);
});

test("support transitions, recipients, and retries are bounded", () => {
  assert.equal(canTransitionSupportStatus("waiting", "active"), true);
  assert.equal(canTransitionSupportStatus("resolved", "waiting"), false);
  assert.deepEqual(dedupeSupportRecipients(["Owner@Example.com", " owner@example.com ", "agent@example.com"]), ["owner@example.com", "agent@example.com"]);
  assert.equal(supportRetryDelayMs(1), 30_000);
  assert.equal(supportRetryDelayMs(99), 900_000);
});

test("phase 2 uses durable unique support jobs and password confirmation", () => {
  const migration = readFileSync("migrations/0155_add_hotel_operations_phase2.sql", "utf8");
  const routes = readFileSync("server/routes/hotelOperations.ts", "utf8");
  const worker = readFileSync("server/services/hotelOperationsSupportWorker.ts", "utf8");
  const page = readFileSync("client/src/pages/hotel-operations.tsx", "utf8");
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS uniq_hotel_ops_support_notification/);
  assert.match(worker, /FOR UPDATE OF n SKIP LOCKED/);
  assert.doesNotMatch(worker, /ORDER BY n\.next_attempt_at FOR UPDATE SKIP LOCKED/);
  assert.match(worker, /first_human_response_at/);
  assert.match(routes, /passwordConfirmation/);
  assert.match(page, /Confirm password/);
  assert.match(page, /SupportWidget/);
});

test("hotel operations invitations distinguish provider acceptance from inbox delivery", () => {
  const routes = readFileSync("server/routes/hotelOperations.ts", "utf8");
  const phase2 = readFileSync("server/routes/hotelOperationsPhase2.ts", "utf8");
  const portal = readFileSync("client/src/pages/hotel-operations.tsx", "utf8");
  const admin = readFileSync("client/src/pages/hotel-operations-admin.tsx", "utf8");

  assert.match(routes, /hotel_ops_invitation_email_accepted/);
  assert.match(routes, /hotel_ops_invitation_email_failed/);
  assert.match(routes, /emailStatus: emailAccepted \? "accepted" : "failed"/);
  assert.match(routes, /providerMessageId/);
  assert.match(phase2, /hotel_ops_invitation_resend_email_accepted/);
  assert.match(phase2, /hotel_ops_invitation_resend_email_failed/);
  assert.match(phase2, /portalEmailFailureCode\(emailError\)/);
  assert.match(portal, /accepted by the email provider/);
  assert.match(admin, /Inbox delivery may still be pending/);
  assert.match(admin, /the email provider did not accept it/);
  assert.match(admin, /aria-live="polite"/);
  assert.match(admin, /fixed bottom-5/);
});

test("hotel operations onboarding is explicitly organization and property scoped", () => {
  const routes = readFileSync("server/routes/hotelOperations.ts", "utf8");
  const phase2 = readFileSync("server/routes/hotelOperationsPhase2.ts", "utf8");
  const portal = readFileSync("client/src/pages/hotel-operations.tsx", "utf8");

  assert.match(routes, /function selectedOrg\(context: HotelOpsContext/);
  assert.match(routes, /organizationId: z\.string\(\)\.uuid\(\),\s*email:/);
  assert.match(routes, /"above_property_admin",\s*"regional_admin",\s*"property_admin"/);
  assert.match(routes, /invitation\.role !== "above_property_admin"/);
  assert.match(routes, /invitation_property_scope_required/);
  assert.match(routes, /returnTo: `\/hoteloperations\/dashboard\?\$\{returnParams\.toString\(\)\}`/);
  assert.match(phase2, /role: "platform_owner"/);
  assert.match(phase2, /hotel_required_for_role/);
  assert.match(portal, /organizationId,\s*hotels,\s*regions,\s*actorRole/);
  assert.match(portal, /Create at least one hotel and property code/);
  assert.match(portal, /initial property context/);
  assert.match(portal, /\[organizationId\]/);
  assert.match(portal, /result\?\.returnTo \|\| "\/hoteloperations\/dashboard"/);
});

test("regional portfolio scope is additive and backend enforced", () => {
  const migration = readFileSync(
    "migrations/0158_add_hotel_operations_regions.sql",
    "utf8",
  );
  const schema = readFileSync("shared/schema.ts", "utf8");
  const policy = readFileSync("server/hotelOperationsPolicy.ts", "utf8");
  const routes = readFileSync("server/routes/hotelOperations.ts", "utf8");
  const phase2 = readFileSync("server/routes/hotelOperationsPhase2.ts", "utf8");
  const portal = readFileSync("client/src/pages/hotel-operations.tsx", "utf8");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS hotel_ops_regions/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS hotel_ops_region_memberships/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS region_id/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS region_ids jsonb/);
  assert.match(schema, /export const hotelOpsRegions/);
  assert.match(schema, /export const hotelOpsRegionMemberships/);
  assert.match(policy, /"regional_admin"/);
  assert.match(routes, /async function authorizedRegions/);
  assert.match(routes, /membership\.role === "regional_admin"/);
  assert.match(routes, /initial_hotel_must_match_region/);
  assert.match(routes, /invitation_region_scope_changed/);
  assert.match(routes, /region_hotel_mismatch/);
  assert.match(routes, /regional_invitation_denied/);
  assert.match(routes, /hotel_region_reassigned/);
  assert.match(routes, /regional_access_updated/);
  assert.match(phase2, /context\.regionMemberships/);
  assert.match(portal, /Regional Administrator \/ RVP/);
  assert.match(portal, /Regional portfolio structure/);
  assert.match(portal, /All authorized regions/);
});

test("regional access isolates a representative 100-property portfolio", () => {
  const organizationAHotels = Array.from({ length: 100 }, (_, index) =>
    `org-a-hotel-${index + 1}`,
  );
  const rvpAHotels = organizationAHotels.slice(0, 10);
  const rvpBHotels = organizationAHotels.slice(10, 20);
  const organizationBHotel = "org-b-hotel-1";

  assert.equal(
    canAccessHotelOpsProperty(
      "above_property_admin",
      organizationAHotels,
      organizationAHotels[99],
    ),
    true,
  );
  assert.equal(
    canAccessHotelOpsProperty("regional_admin", rvpAHotels, rvpAHotels[4]),
    true,
  );
  assert.equal(
    canAccessHotelOpsProperty("regional_admin", rvpAHotels, rvpBHotels[0]),
    false,
  );
  assert.equal(
    canAccessHotelOpsProperty("regional_admin", rvpAHotels, organizationBHotel),
    false,
  );

  const movedHotel = rvpAHotels[0];
  const rvpAAfterMove = rvpAHotels.filter((id) => id !== movedHotel);
  const rvpBAfterMove = [...rvpBHotels, movedHotel];
  assert.equal(
    canAccessHotelOpsProperty("regional_admin", rvpAAfterMove, movedHotel),
    false,
  );
  assert.equal(
    canAccessHotelOpsProperty("regional_admin", rvpBAfterMove, movedHotel),
    true,
  );
  assert.equal(
    canAccessHotelOpsProperty("property_admin", [movedHotel], movedHotel),
    true,
  );
});
