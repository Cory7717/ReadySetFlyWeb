import test from "node:test";
import assert from "node:assert/strict";
import { filingPlan, payloadFields } from "./test-utils";
import { validateLeidosOtherInfoForTransmission } from "../../server/services/flight-plan-filing/provider";

test("ZZZZ alternate with FAA code generates only ALTN/85TX", () => {
  const fields = payloadFields(filingPlan({
    departure: "KDWH",
    destination: "KSDL",
    alternate: "ZZZZ",
    filingRemarks: "ZZZZ ALTERNATE VALIDATION TEST",
    filingAlternateName: "Rutherford Ranch Airport",
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-07-02T10:00",
      planningReferenceAlternateAirport: "KSDL",
      actualAlternateLocationMode: "identifier",
      actualAlternateLocation: "85TX",
    },
  }));
  assert.equal(fields.altDestination1, "ZZZZ");
  assert.match(String(fields.otherInfo), /\bALTN\/85TX\b/);
  assert.equal(String(fields.otherInfo).match(/\bALTN\//g)?.length, 1);
  assert.doesNotMatch(String(fields.otherInfo), /RUTHERFORD/i);
  assert.equal(validateLeidosOtherInfoForTransmission(String(fields.otherInfo)).valid, true);
});

test("ZZZZ departure with FAA code generates only DEP/85TX", () => {
  const fields = payloadFields(filingPlan({
    departure: "ZZZZ",
    destination: "KSDL",
    filingDepartureName: "Rutherford Ranch Airport",
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-07-02T10:00",
      planningReferenceDepartureAirport: "KDWH",
      actualDepartureLocationMode: "identifier",
      actualDepartureLocation: "85TX",
    },
  }));
  assert.equal(fields.departure, "ZZZZ");
  assert.match(String(fields.otherInfo), /\bDEP\/85TX\b/);
  assert.equal(String(fields.otherInfo).match(/\bDEP\//g)?.length, 1);
  assert.doesNotMatch(String(fields.otherInfo), /RUTHERFORD/i);
  assert.equal(validateLeidosOtherInfoForTransmission(String(fields.otherInfo)).valid, true);
});

test("ZZZZ destination with FAA code generates only DEST/85TX", () => {
  const fields = payloadFields(filingPlan({
    departure: "KDWH",
    destination: "ZZZZ",
    filingDestinationName: "Rutherford Ranch Airport",
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-07-02T10:00",
      planningReferenceDestinationAirport: "KSDL",
      actualDestinationLocationMode: "identifier",
      actualDestinationLocation: "85TX",
    },
  }));
  assert.equal(fields.destination, "ZZZZ");
  assert.match(String(fields.otherInfo), /\bDEST\/85TX\b/);
  assert.equal(String(fields.otherInfo).match(/\bDEST\//g)?.length, 1);
  assert.doesNotMatch(String(fields.otherInfo), /RUTHERFORD/i);
  assert.equal(validateLeidosOtherInfoForTransmission(String(fields.otherInfo)).valid, true);
});
