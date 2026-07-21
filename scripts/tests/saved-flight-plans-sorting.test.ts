import test from "node:test";
import assert from "node:assert/strict";
import type { FlightPlan } from "../../shared/schema";
import { getSavedPlanStatusChip, groupSavedFlightPlans } from "../../client/src/components/flight-planner/savedPlanSorting";

const plan = (overrides: Partial<FlightPlan> & Record<string, unknown>): FlightPlan => ({
  id: String(overrides.id || "plan"),
  userId: "user-1",
  title: String(overrides.title || overrides.id || "Plan"),
  departure: "KAUS",
  destination: "KDAL",
  route: "DCT",
  alternate: null,
  plannedDepartureAt: null,
  plannedArrivalAt: null,
  aircraftType: null,
  tailNumber: null,
  fuelOnBoard: null,
  fuelRequired: null,
  filingProvider: "leidos_flight_service",
  filingProviderPlanId: null,
  filingFlightRules: "VFR",
  filingEquipment: null,
  filingDepartureName: null,
  filingDestinationName: null,
  filingAlternateName: null,
  filingCloseLocation: null,
  filingSoulsOnBoard: null,
  filingAircraftColor: null,
  filingPilotName: null,
  filingPilotPhone: null,
  filingAircraftHomeBase: null,
  filingRemarks: null,
  filingWakeTurbulence: null,
  filingTypeOfFlight: null,
  filingSurveillanceEquipment: null,
  filingOtherInfo: null,
  filingTrueAirspeedKtas: null,
  filingPlannedAltitudeFt: null,
  filingEstimatedEnrouteMinutes: null,
  filingEnduranceMinutes: null,
  filingStatus: "draft",
  filingPendingAction: null,
  filingIsLive: false,
  filedAt: null,
  activatedAt: null,
  cancelledAt: null,
  closedAt: null,
  filingLastProviderSyncAt: null,
  filingPayload: null,
  filingProviderSnapshot: null,
  filingProviderMessages: [],
  filingAssignedBeaconCode: null,
  filingRaw: null,
  filingActionHistory: [],
  plannerState: null,
  notes: null,
  createdAt: new Date("2026-06-20T12:00:00.000Z"),
  updatedAt: new Date("2026-06-20T12:00:00.000Z"),
  ...overrides,
} as FlightPlan);

test("active plan appears in Current / Active Plans", () => {
  const grouped = groupSavedFlightPlans([
    plan({ id: "active", filingStatus: "activated", activatedAt: new Date("2026-06-25T12:00:00.000Z") }),
  ]);
  assert.deepEqual(grouped.currentPlans.map((entry) => entry.id), ["active"]);
  assert.equal(grouped.pastPlans.length, 0);
  assert.equal(getSavedPlanStatusChip(grouped.currentPlans[0]).label, "Active");
});

test("closed plan appears in Past Flight Plans", () => {
  const grouped = groupSavedFlightPlans([
    plan({ id: "closed", filingStatus: "closed", closedAt: new Date("2026-06-25T12:00:00.000Z") }),
  ]);
  assert.equal(grouped.currentPlans.length, 0);
  assert.deepEqual(grouped.pastPlans.map((entry) => entry.id), ["closed"]);
  assert.equal(getSavedPlanStatusChip(grouped.pastPlans[0]).label, "Closed");
});

test("cancelled plan appears in Past Flight Plans", () => {
  const grouped = groupSavedFlightPlans([
    plan({ id: "cancelled", filingStatus: "cancelled", cancelledAt: new Date("2026-06-25T12:00:00.000Z") }),
  ]);
  assert.equal(grouped.currentPlans.length, 0);
  assert.deepEqual(grouped.pastPlans.map((entry) => entry.id), ["cancelled"]);
  assert.equal(getSavedPlanStatusChip(grouped.pastPlans[0]).label, "Cancelled");
});

test("terminal plan with stale provider-review flag remains past and terminal", () => {
  const grouped = groupSavedFlightPlans([
    plan({
      id: "review",
      filingStatus: "closed",
      filingProviderSnapshot: { providerPendingReview: true },
    }),
  ]);
  assert.equal(grouped.currentPlans.length, 0);
  assert.deepEqual(grouped.pastPlans.map((entry) => entry.id), ["review"]);
  assert.equal(getSavedPlanStatusChip(grouped.pastPlans[0]).label, "Closed");
});

test("provider terminal lifecycle overrides stale filed status and review flag", () => {
  const grouped = groupSavedFlightPlans([
    plan({
      id: "provider-closed",
      filingStatus: "filed",
      filingProviderSnapshot: {
        providerLifecycleStatus: "closed",
        providerPendingReview: true,
      },
    }),
  ]);
  assert.equal(grouped.currentPlans.length, 0);
  assert.deepEqual(grouped.pastPlans.map((entry) => entry.id), ["provider-closed"]);
  assert.equal(getSavedPlanStatusChip(grouped.pastPlans[0]).label, "Closed");
});

test("provider-review-needed filed plan remains current", () => {
  const grouped = groupSavedFlightPlans([
    plan({
      id: "review",
      filingStatus: "filed",
      filingProviderSnapshot: { providerPendingReview: true },
    }),
  ]);
  assert.deepEqual(grouped.currentPlans.map((entry) => entry.id), ["review"]);
  assert.equal(grouped.pastPlans.length, 0);
  assert.equal(getSavedPlanStatusChip(grouped.currentPlans[0]).label, "Provider Updated");
});

test("sorting places review and active plans ahead of drafts", () => {
  const grouped = groupSavedFlightPlans([
    plan({ id: "draft", filingStatus: "draft", updatedAt: new Date("2026-06-25T15:00:00.000Z") }),
    plan({ id: "active", filingStatus: "activated", updatedAt: new Date("2026-06-25T13:00:00.000Z") }),
    plan({
      id: "review",
      filingStatus: "filed",
      updatedAt: new Date("2026-06-25T12:00:00.000Z"),
      filingProviderSnapshot: { providerPendingReview: true },
    }),
  ]);
  assert.deepEqual(grouped.currentPlans.map((entry) => entry.id), ["review", "active", "draft"]);
});
