import type { FlightPlan, FlightPlanFilingAction } from "../../../shared/schema";
import { filingPlan } from "../test-utils";

export type LabScenarioCategory =
  | "Lifecycle"
  | "ZZZZ"
  | "Field 18"
  | "Supplemental Remarks"
  | "Equipment"
  | "PBN"
  | "Time Zones"
  | "Retrieve Compare";

export type LabScenario = {
  id: string;
  name: string;
  category: LabScenarioCategory;
  seed: number;
  actions: FlightPlanFilingAction[];
  plan: FlightPlan;
  expectedOtherInfoIncludes?: string[];
};

const certPlan = (runId: string, scenarioId: string, overrides: Partial<FlightPlan> = {}) => filingPlan({
  id: `lab-${scenarioId}`,
  title: `RSF LAB CERT ${scenarioId}`,
  tailNumber: `N${String(Math.abs(scenarioId.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0))).slice(0, 4).padStart(4, "1")}CA`,
  filingPilotName: "RSF Cert Pilot",
  filingPilotPhone: "5125550100",
  filingAircraftHomeBase: "KEDC",
  filingAircraftColor: "WHITE BLUE",
  filingSoulsOnBoard: "2",
  filingRemarks: `RSF LAB CERT ${runId} ${scenarioId}`,
  filingOtherInfo: `PBN/A1 RMK/RSF LAB CERT ${runId} ${scenarioId}`,
  filingEnduranceMinutes: 240,
  filingEstimatedEnrouteMinutes: 60,
  filingPlannedAltitudeFt: 5500,
  filingTrueAirspeedKtas: 110,
  ...overrides,
}) as FlightPlan;

export const buildLabScenarios = (runId: string, mode: string): LabScenario[] => {
  const base: LabScenario[] = [
    {
      id: "vfr-full-lifecycle",
      name: "VFR file retrieve amend activate close",
      category: "Lifecycle",
      seed: 2001,
      actions: ["file", "amend", "activate", "close"],
      plan: certPlan(runId, "vfr-full-lifecycle", { filingFlightRules: "VFR", route: "DCT" }),
    },
    {
      id: "vfr-cancel",
      name: "VFR file retrieve cancel",
      category: "Lifecycle",
      seed: 2002,
      actions: ["file", "cancel"],
      plan: certPlan(runId, "vfr-cancel", { filingFlightRules: "VFR", route: "DCT" }),
    },
    {
      id: "ifr-file-amend-cancel",
      name: "IFR file retrieve amend cancel",
      category: "Lifecycle",
      seed: 2003,
      actions: ["file", "amend", "cancel"],
      plan: certPlan(runId, "ifr-file-amend-cancel", {
        filingFlightRules: "IFR",
        route: "DCT KDWH DCT",
        filingPlannedAltitudeFt: 7000,
      }),
    },
    {
      id: "zzzz-dep-identifier",
      name: "ZZZZ departure FAA/private identifier",
      category: "ZZZZ",
      seed: 2101,
      actions: ["file", "cancel"],
      plan: certPlan(runId, "zzzz-dep-identifier", {
        departure: "ZZZZ",
        filingDepartureName: "PRIVATE STRIP",
        plannerState: {
          departureTimeZone: "America/Chicago",
          userDisplayDepartureTimeLocal: "2026-06-22T10:00",
          planningReferenceDepartureAirport: "KDWH",
          actualDepartureLocationMode: "identifier",
          actualDepartureLocation: "85TX",
        },
      }),
      expectedOtherInfoIncludes: ["DEP/85TX"],
    },
    {
      id: "zzzz-dest-latlong",
      name: "ZZZZ destination lat/long with description",
      category: "ZZZZ",
      seed: 2102,
      actions: ["file", "cancel"],
      plan: certPlan(runId, "zzzz-dest-latlong", {
        destination: "ZZZZ",
        filingDestinationName: "PRIVATE STRIP",
        plannerState: {
          departureTimeZone: "America/Chicago",
          userDisplayDepartureTimeLocal: "2026-06-22T10:00",
          planningReferenceDestinationAirport: "KSDL",
          actualDestinationLocationMode: "latlong",
          actualDestinationLocation: "3839N09045W",
        },
      }),
      expectedOtherInfoIncludes: ["DEST/3839N09045W PRIVATE STRIP"],
    },
    {
      id: "zzzz-alt-identifier",
      name: "ZZZZ alternate FAA/private identifier",
      category: "ZZZZ",
      seed: 2103,
      actions: ["file", "cancel"],
      plan: certPlan(runId, "zzzz-alt-identifier", {
        alternate: "ZZZZ",
        filingAlternateName: "PRIVATE STRIP",
        plannerState: {
          departureTimeZone: "America/Chicago",
          userDisplayDepartureTimeLocal: "2026-06-22T10:00",
          planningReferenceAlternateAirport: "KSDL",
          actualAlternateLocationMode: "identifier",
          actualAlternateLocation: "85TX",
        },
      }),
      expectedOtherInfoIncludes: ["ALTN/85TX"],
    },
    {
      id: "aircraft-type-zzzz",
      name: "Aircraft type ZZZZ with TYP",
      category: "Field 18",
      seed: 2201,
      actions: ["file", "cancel"],
      plan: certPlan(runId, "aircraft-type-zzzz", {
        aircraftType: "ZZZZ",
        plannerState: {
          departureTimeZone: "America/Chicago",
          userDisplayDepartureTimeLocal: "2026-06-22T10:00",
          actualAircraftType: "TBM700",
        },
      }),
      expectedOtherInfoIncludes: ["TYP/TBM700"],
    },
    {
      id: "field18-supp-remarks",
      name: "Field 18 RMK and supplemental remarks remain separate",
      category: "Supplemental Remarks",
      seed: 2301,
      actions: ["file", "cancel"],
      plan: certPlan(runId, "field18-supp-remarks", {
        filingOtherInfo: `PBN/A1 RMK/RSF FIELD18 ${runId}`,
        filingRemarks: `RSF SUPPLEMENTAL ${runId}`,
      }),
      expectedOtherInfoIncludes: ["PBN/A1", "RMK/RSF FIELD18"],
    },
    {
      id: "central-midnight",
      name: "Central midnight UTC rollover",
      category: "Time Zones",
      seed: 2401,
      actions: ["file", "cancel"],
      plan: certPlan(runId, "central-midnight", {
        plannedDepartureAt: new Date("2026-03-09T04:30:00.000Z"),
        plannerState: { departureTimeZone: "America/Chicago", userDisplayDepartureTimeLocal: "2026-03-08T23:30" },
      }),
    },
  ];
  if (mode === "smoke") return base.slice(0, 1);
  if (mode === "extended") return base;
  return base.slice(0, 6);
};
