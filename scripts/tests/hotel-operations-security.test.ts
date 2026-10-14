import assert from "node:assert/strict";
import test from "node:test";
import { canAccessHotelOpsProperty, canInviteHotelOpsRole, safeHotelOpsReturnPath } from "../../server/hotelOperationsPolicy";
import { canTransitionSupportStatus, dedupeSupportRecipients, effectiveSupportPresence, shouldEscalateFirstResponse, supportRetryDelayMs } from "../../server/hotelOperationsSupportPolicy";
import { readFileSync } from "node:fs";

test("hotel operations roles cannot escalate privilege", () => {
  assert.equal(canInviteHotelOpsRole("platform_owner", "above_property_admin"), true);
  assert.equal(canInviteHotelOpsRole("above_property_admin", "platform_owner"), false);
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
