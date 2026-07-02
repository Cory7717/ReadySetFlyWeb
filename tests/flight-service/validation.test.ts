import test from "node:test";
import assert from "node:assert/strict";
import { validateFlightPlanForAction } from "../../server/services/flight-plan-filing/provider";
import { getFlightServiceRuntimeMode, hasFlightServiceTestAcknowledgement } from "../../server/services/flightServiceRuntimeMode";
import { filingPlan, resetPlannerState } from "./test-utils";

test("invalid equipment SCE is blocked before provider call", () => {
  const result = validateFlightPlanForAction(filingPlan({
    filingEquipment: "SCE",
    filingSurveillanceEquipment: "S",
  }), "file");
  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) => /invalid ICAO code/i.test(error)));
});

test("R equipment without PBN is blocked before provider call", () => {
  const result = validateFlightPlanForAction(filingPlan({
    filingEquipment: "SR",
    filingOtherInfo: "RMK/R CODE WITHOUT PBN",
  }), "file");
  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) => /PBN/i.test(error)));
});

test("PBN without R equipment is blocked before provider call", () => {
  const result = validateFlightPlanForAction(filingPlan({
    filingEquipment: "S",
    filingOtherInfo: "PBN/A1 RMK/PBN WITHOUT R",
  }), "file");
  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) => /PBN.*Aircraft Equipment|Aircraft Equipment.*R/i.test(error)));
});

test("sensor-specific PBN without matching equipment is blocked before provider call", () => {
  const result = validateFlightPlanForAction(filingPlan({
    filingEquipment: "SR",
    filingOtherInfo: "PBN/B2 RMK/GNSS MISSING",
  }), "file");
  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) => /PBN\/B2.*GNSS/i.test(error)));
});

test("invalid ADS-B surveillance combination is blocked before provider call", () => {
  const result = validateFlightPlanForAction(filingPlan({
    filingSurveillanceEquipment: "B2",
  }), "file");
  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) => /ADS-B|Surveillance Equipment/i.test(error)));
});

test("missing phone is blocked before provider call", () => {
  const result = validateFlightPlanForAction(filingPlan({
    filingPilotPhone: "",
  }), "file");
  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) => /phone/i.test(error)));
});

test("missing home base is blocked before provider call", () => {
  const result = validateFlightPlanForAction(filingPlan({
    filingAircraftHomeBase: "",
  }), "file");
  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) => /home base/i.test(error)));
});

test("invalid ZZZZ coordinate is blocked before provider call", () => {
  const result = validateFlightPlanForAction(filingPlan({
    departure: "ZZZZ",
    filingDepartureName: "Private Strip",
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-07-15T10:00",
      planningReferenceDepartureAirport: "KEDC",
      actualDepartureLocation: "BADCOORD",
    },
  }), "file");
  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) => /ZZZZ|actual departure/i.test(error)));
});

test("departure time in the past is blocked before provider call", () => {
  const result = validateFlightPlanForAction(filingPlan({
    plannedDepartureAt: new Date("2026-01-01T15:00:00.000Z"),
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-01-01T09:00",
    },
  }), "file");
  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) => /past/i.test(error)));
});

test("missing IFR required equipment is blocked before provider call", () => {
  const result = validateFlightPlanForAction(filingPlan({
    filingFlightRules: "IFR",
    filingEquipment: "N",
    filingOtherInfo: "RMK/IFR NO EQUIPMENT",
  }), "file");
  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) => /IFR.*equipment|COM\/NAV/i.test(error)));
});

test("missing altitude is blocked before provider call", () => {
  const result = validateFlightPlanForAction(filingPlan({
    filingPlannedAltitudeFt: null,
  }), "file");
  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) => /planned altitude/i.test(error)));
});

test("missing fuel endurance is blocked before provider call", () => {
  const result = validateFlightPlanForAction(filingPlan({
    filingEnduranceMinutes: null,
  }), "file");
  assert.equal(result.ready, false);
  assert.ok(result.errors.some((error) => /endurance/i.test(error)));
});

test("new plan reset state does not retain stale provider errors", () => {
  const reset = resetPlannerState();
  assert.equal(reset.filingActionFeedback, null);
  assert.equal(reset.providerUpdatesPlan, null);
  assert.equal(reset.filingPreview, null);
  assert.equal(reset.draftPlanId, null);
  assert.equal(reset.editingPlan, null);
});

test("clear form clears validation and provider error state", () => {
  const reset = resetPlannerState();
  assert.equal(reset.filingActionFeedback, null);
  assert.equal(reset.showFilingPayload, false);
});

test("Flight Service environment defaults to LAB with acknowledgement required", () => {
  const mode = getFlightServiceRuntimeMode({});
  assert.equal(mode.environment, "LAB");
  assert.equal(mode.operationalFilingEnabled, false);
  assert.equal(mode.providerTestModeEnabled, true);
  assert.equal(mode.acknowledgementRequired, true);
});

test("Flight Service production requires explicit operational filing flag", () => {
  const withoutFlag = getFlightServiceRuntimeMode({ FLIGHT_SERVICE_ENVIRONMENT: "PRODUCTION" });
  assert.equal(withoutFlag.environment, "PRODUCTION");
  assert.equal(withoutFlag.operationalFilingEnabled, false);
  assert.equal(withoutFlag.acknowledgementRequired, true);

  const withFlag = getFlightServiceRuntimeMode({
    FLIGHT_SERVICE_ENVIRONMENT: "PRODUCTION",
    FLIGHT_FILING_OPERATIONAL_ENABLED: "true",
  });
  assert.equal(withFlag.operationalFilingEnabled, true);
  assert.equal(withFlag.acknowledgementRequired, false);
});

test("Flight Service test acknowledgement must match environment and expire after 24 hours", () => {
  const now = Date.parse("2026-07-01T12:00:00.000Z");
  const acknowledgedAt = new Date(now - 60_000).toISOString();
  assert.equal(hasFlightServiceTestAcknowledgement({
    testAcknowledgement: {
      accepted: true,
      environment: "LAB",
      acknowledgedAt,
    },
  }, "LAB", now), true);
  assert.equal(hasFlightServiceTestAcknowledgement({
    testAcknowledgement: {
      accepted: true,
      environment: "TEST",
      acknowledgedAt,
    },
  }, "LAB", now), false);
  assert.equal(hasFlightServiceTestAcknowledgement({
    testAcknowledgement: {
      accepted: true,
      environment: "LAB",
      acknowledgedAt: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
    },
  }, "LAB", now), false);
});
