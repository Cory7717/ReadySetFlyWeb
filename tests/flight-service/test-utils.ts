import type { FlightPlan } from "../../shared/schema";
import { buildLeidosActionPayload } from "../../server/services/flight-plan-filing/provider";

export function filingPlan(overrides: Partial<FlightPlan> = {}): FlightPlan {
  return {
    id: "cert-plan",
    userId: "cert-user",
    title: "Certification plan",
    departure: "KEDC",
    destination: "KDAL",
    route: "DCT",
    alternate: null,
    plannedDepartureAt: new Date("2026-06-22T15:00:00.000Z"),
    plannedArrivalAt: new Date("2026-06-22T16:00:00.000Z"),
    aircraftType: "C172",
    tailNumber: "N123RS",
    fuelOnBoard: "40",
    fuelRequired: "15",
    filingFlightRules: "VFR",
    filingEquipment: "S",
    filingSoulsOnBoard: "2",
    filingAircraftColor: "WHITE BLUE",
    filingPilotName: "Cert Pilot",
    filingPilotPhone: "5125550100",
    filingAircraftHomeBase: "KEDC",
    filingRemarks: "CERTIFICATION TEST",
    filingWakeTurbulence: "LIGHT",
    filingTypeOfFlight: "G",
    filingSurveillanceEquipment: "C",
    filingOtherInfo: "PBN/A1",
    filingTrueAirspeedKtas: 110,
    filingPlannedAltitudeFt: 5500,
    filingEstimatedEnrouteMinutes: 60,
    filingEnduranceMinutes: 240,
    filingStatus: "draft",
    filingProvider: "leidos_flight_service",
    filingProviderPlanId: null,
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
    plannerState: {
      departureTimeZone: "America/Chicago",
      userDisplayDepartureTimeLocal: "2026-06-22T10:00",
    },
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as FlightPlan;
}

export function payloadFields(plan: FlightPlan, action: "file" | "amend" = "file") {
  return Object.fromEntries(
    buildLeidosActionPayload(plan, action, { otherInfo: null } as any).params.entries(),
  );
}

export function visibleLifecycleActions(plan: Pick<FlightPlan, "filingStatus" | "filingIsLive" | "filingProviderPlanId">) {
  const status = String(plan.filingStatus || "").toLowerCase();
  const hasLiveProviderPlan = Boolean(plan.filingIsLive && plan.filingProviderPlanId);
  const terminal = ["cancelled", "closed"].includes(status);
  return {
    file: !hasLiveProviderPlan && !["filed", "activated", "cancelled", "closed"].includes(status),
    amend: hasLiveProviderPlan && !terminal && ["filed", "activated"].includes(status),
    activate: hasLiveProviderPlan && !terminal && status === "filed",
    cancel: hasLiveProviderPlan && !terminal && status === "filed",
    close: hasLiveProviderPlan && !terminal && status === "activated",
  };
}

export function resetPlannerState() {
  return {
    activeTab: "route",
    providerUpdatesPlan: null,
    filingActionFeedback: null,
    filingPreview: null,
    showFilingPayload: false,
    draftPlanId: null,
    editingPlan: null,
  };
}
