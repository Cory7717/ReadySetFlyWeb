import test from "node:test";
import assert from "node:assert/strict";
import type { FlightPlan } from "../../shared/schema";
import {
  ACTIVE_FLIGHT_PLAN_LIMIT_MESSAGE,
  canCreateAnotherActiveFlightPlan,
  isActiveFlightPlan,
} from "../../shared/flight-plan-access";

const plan = (id: string, filingStatus: string): FlightPlan => ({
  id,
  filingStatus,
} as FlightPlan);

test("free users may maintain only one active flight plan", () => {
  const result = canCreateAnotherActiveFlightPlan({
    isPremium: false,
    existingPlans: [plan("active-1", "draft")],
  });

  assert.equal(result.allowed, false);
  assert.equal(result.activeCount, 1);
  assert.equal(result.message, ACTIVE_FLIGHT_PLAN_LIMIT_MESSAGE);
});

test("historical flight plans do not count against free active plan limit", () => {
  const result = canCreateAnotherActiveFlightPlan({
    isPremium: false,
    existingPlans: [
      plan("closed-1", "closed"),
      plan("cancelled-1", "cancelled"),
      plan("completed-1", "completed"),
      plan("expired-1", "expired"),
    ],
  });

  assert.equal(result.allowed, true);
  assert.equal(result.activeCount, 0);
});

test("premium users can maintain unlimited active flight plans", () => {
  const result = canCreateAnotherActiveFlightPlan({
    isPremium: true,
    existingPlans: [plan("active-1", "draft"), plan("active-2", "activated")],
  });

  assert.equal(result.allowed, true);
});

test("active status mapping includes provider lifecycle terms", () => {
  assert.equal(isActiveFlightPlan(plan("proposed", "proposed")), true);
  assert.equal(isActiveFlightPlan(plan("open", "open")), true);
  assert.equal(isActiveFlightPlan(plan("closed", "closed")), false);
});
