import test from "node:test";
import assert from "node:assert/strict";
import { getProviderDepartureInstantForPlan } from "../../server/services/flight-plan-filing/provider";
import { filingPlan, payloadFields } from "./test-utils";

test("changed planned departure date is used immediately in payload source", () => {
  const plan = filingPlan({
    plannedDepartureAt: new Date("2026-06-24T15:00:00.000Z"),
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-06-29T10:00",
    },
  });
  assert.equal(getProviderDepartureInstantForPlan(plan), "2026-06-29T15:00:00.000Z");
  assert.equal(payloadFields(plan).departureInstant, "2026-06-29T15:00:00.000Z");
});

test("phone and home base are included in provider payload", () => {
  const fields = payloadFields(filingPlan({
    filingPilotPhone: "15124121762",
    filingAircraftHomeBase: "KEDC",
  }));
  assert.equal(fields.pilotPhone, "15124121762");
  assert.equal(fields.aircraftHomeBase, "KEDC");
  assert.match(fields.pilotData, /Cert Pilot/);
  assert.match(fields.pilotData, /PHONE 15124121762/);
  assert.match(fields.pilotData, /HOME BASE KEDC/);
});
