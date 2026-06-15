import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FilingProviderUpdatesList, FilingProviderWorkspace } from "../../client/src/components/flight-planner/FilingProviderWorkspace";
import type { FlightPlan } from "../../shared/schema";

const plan = {
  id: "plan-1",
  userId: "user-1",
  title: "Austin to Vegas",
  departure: "KEDC",
  destination: "KVGT",
  route: "KBPG KSRR KINW",
  alternate: null,
  plannedDepartureAt: new Date("2026-04-26T12:30:00.000Z"),
  plannedArrivalAt: new Date("2026-04-26T15:30:00.000Z"),
  aircraftType: "SR22",
  tailNumber: "N123RS",
  fuelOnBoard: null,
  fuelRequired: null,
  filingProvider: "leidos_flight_service",
  filingProviderPlanId: "ABC123",
  filingFlightRules: "IFR",
  filingEquipment: "SDFG",
  filingSoulsOnBoard: "2",
  filingAircraftColor: null,
  filingPilotName: "Pilot",
  filingRemarks: "Internal note",
  filingWakeTurbulence: null,
  filingTypeOfFlight: "G",
  filingSurveillanceEquipment: "N",
  filingOtherInfo: "PBN/A1B2",
  filingTrueAirspeedKtas: 180,
  filingPlannedAltitudeFt: 21000,
  filingEstimatedEnrouteMinutes: 120,
  filingEnduranceMinutes: 240,
  filingStatus: "filed",
  filingPendingAction: null,
  filingIsLive: true,
  filedAt: new Date("2026-04-23T13:00:00.000Z"),
  activatedAt: null,
  cancelledAt: null,
  closedAt: null,
  filingLastProviderSyncAt: new Date("2026-04-23T13:05:00.000Z"),
  filingPayload: {
    dof: "260426",
    dofInjected: true,
    builtAt: "2026-04-23T13:00:00.000Z",
    otherInfo: "PBN/A1B2 DOF/260426",
    route: {
      normalizedTransmittedRoute: "DCT KBPG DCT KSRR DCT KINW DCT",
    },
  },
  filingProviderSnapshot: {
    syncedAt: "2026-04-23T13:05:00.000Z",
    providerStatus: "PROPOSED",
    artccState: "ROGERED",
    route: {
      providerRoute: "DCT KBPG DCT TCC DCT KINW DCT",
    },
    fieldDiffs: [
      { field: "route", changedForTransmission: true, changedByProvider: true },
    ],
  },
  filingProviderMessages: [
    {
      id: "msg-1",
      timestamp: "2026-04-23T13:05:00.000Z",
      severity: "warning",
      title: "Provider route changed",
      details: "Leidos returned an expectedRoute with TCC inserted.",
      providerPlanId: "ABC123",
    },
  ],
  filingRaw: null,
  filingActionHistory: [],
  plannerState: null,
  notes: "Internal note",
  createdAt: new Date("2026-04-23T12:55:00.000Z"),
  updatedAt: new Date("2026-04-23T13:05:00.000Z"),
} as unknown as FlightPlan;

test("provider workspace renders local, filed, and provider route views", () => {
  const html = renderToStaticMarkup(<FilingProviderWorkspace plan={plan} />);
  assert.ok(html.includes("Local Plan"));
  assert.ok(html.includes("Filed Payload Summary"));
  assert.ok(html.includes("Provider Sync / Effective Plan"));
  assert.ok(html.includes("KBPG KSRR KINW"));
  assert.ok(html.includes("DCT KBPG DCT KSRR DCT KINW DCT"));
  assert.ok(html.includes("DCT KBPG DCT TCC DCT KINW DCT"));
  assert.ok(html.includes("Updated by provider"));
  assert.ok(html.includes("260426"));
});

test("provider updates list renders event entries", () => {
  const html = renderToStaticMarkup(<FilingProviderUpdatesList plan={plan} />);
  assert.ok(html.includes("Provider route changed"));
  assert.ok(html.includes("Leidos returned an expectedRoute with TCC inserted."));
  assert.ok(html.includes("Provider reference: ABC123"));
});
