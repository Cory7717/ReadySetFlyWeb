import assert from "node:assert/strict";
import test from "node:test";
import { canAccessHotelOpsProperty, canInviteHotelOpsRole, safeHotelOpsReturnPath } from "../../server/hotelOperationsPolicy";

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
