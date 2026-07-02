import type { FlightPlan } from "../../shared/schema";
import type { FlightServiceScenario, ProviderRetrieveMode } from "./scenario-runner";

export interface ScenarioGeneratorOptions {
  seed?: number;
  count?: number;
}

const AIRPORTS = ["KEDC", "KDWH", "KSDL", "KDAL", "KAUS", "KPHX", "KLAS", "KMIA", "KPBI"];
const ROUTES = ["DCT", "DCT KDWH DCT", "KEDC DCT KBPT DCT KGAO", "DCT LCH DCT KEYW", ""];
const EQUIPMENT = ["S", "SC", "R", "SCE", ""];
const SURVEILLANCE = ["C", "S", "N", "B2", ""];
const RETRIEVE_MODES: ProviderRetrieveMode[] = [
  "match",
  "omit-phone",
  "omit-home-base",
  "supplemental-in-other-info",
  "modified-route",
  "different-lifecycle",
  "notices",
  "stale-version",
  "corrected-equipment",
  "reject-invalid-equipment",
  "reject-invalid-field18",
];

const makeRng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const pick = <T>(rng: () => number, values: T[]) => values[Math.floor(rng() * values.length)];

const expectedMismatchFieldsForMode = (mode: ProviderRetrieveMode | undefined) => {
  switch (mode) {
    case "omit-phone":
      return ["pilotPhone"];
    case "omit-home-base":
      return ["aircraftHomeBase"];
    case "supplemental-in-other-info":
      return ["otherInfo"];
    case "modified-route":
      return ["route"];
    case "corrected-equipment":
      return [];
    case "reject-invalid-equipment":
    case "reject-invalid-field18":
    case "different-lifecycle":
    case "notices":
    case "stale-version":
    case "match":
    default:
      return [];
  }
};

const zzzzState = (kind: "departure" | "destination" | "alternate", mode: "identifier" | "latlong") => {
  const title = kind[0].toUpperCase() + kind.slice(1);
  const locationKey = `actual${title === "Alternate" ? "Alternate" : title}Location`;
  const modeKey = `actual${title === "Alternate" ? "Alternate" : title}LocationMode`;
  const referenceKey = `planningReference${title === "Alternate" ? "Alternate" : title}Airport`;
  return {
    [referenceKey]: kind === "departure" ? "KDWH" : "KSDL",
    [modeKey]: mode,
    [locationKey]: mode === "identifier" ? "85TX" : "3839N09045W",
  };
};

export const seanRegressionScenarios: FlightServiceScenario[] = [
  {
    name: "Sean - grey text and button contrast flagged for UI review",
    description: "Presentation issue is tracked as a minor certification scenario for manual visual review.",
    userActions: ["new"],
    expectedProviderBehavior: "not-applicable",
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
    seanFeedbackId: "SF-43",
  },
  {
    name: "Sean - Open Saved Plans button opens visible state",
    description: "Saved plan drawer must be reachable and visible.",
    userActions: ["openSaved"],
    expectedProviderBehavior: "not-applicable",
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
    seanFeedbackId: "SF-41",
  },
  {
    name: "Sean - Clear form clears prior errors",
    description: "Clear form resets validation and provider error state.",
    userActions: ["new", "providerReject", "clear"],
    expectedProviderBehavior: "not-applicable",
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
    seanFeedbackId: "SF-05",
  },
  {
    name: "Sean - Long provider errors render without clipping",
    description: "Long provider messages must remain readable.",
    userActions: ["providerReject"],
    providerRejectMessage: "OtherInfo.invalidMessage: Long provider certification error should wrap without clipping.",
    expectedProviderBehavior: "rejected",
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
    seanFeedbackId: "SF-43",
  },
  {
    name: "Sean - Default altitude and fuel require user confirmation",
    description: "Missing altitude/fuel blocks local filing.",
    visibleForm: { filingPlannedAltitudeFt: null, filingEnduranceMinutes: null } as Partial<FlightPlan>,
    userActions: ["file"],
    providerCallShouldBeBlocked: true,
    expectedValidationResult: "invalid",
    seanFeedbackId: "SF-08",
  },
  {
    name: "Sean - Screen does not jump while typing",
    description: "Typing into airport fields should not force plates or layout jump.",
    userActions: ["edit"],
    expectedProviderBehavior: "not-applicable",
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
    seanFeedbackId: "SF-22",
  },
  {
    name: "Sean - Field-specific validation highlights offending fields",
    description: "Missing departure and destination create specific validation errors.",
    visibleForm: { departure: "", destination: "" },
    userActions: ["file"],
    providerCallShouldBeBlocked: true,
    expectedValidationResult: "invalid",
    seanFeedbackId: "SF-06",
  },
  {
    name: "Sean - Amend unavailable before filing",
    description: "Draft plan should not expose amend as an available lifecycle action.",
    initialPlan: { filingStatus: "draft", filingIsLive: false, filingProviderPlanId: null },
    userActions: ["new"],
    expectedUiState: { amend: false, activate: false, cancel: false },
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
    seanFeedbackId: "SF-39",
  },
  {
    name: "Sean - Closed plan hides operational actions",
    description: "Closed plans must not expose File, Amend, Activate, or Cancel.",
    initialPlan: { filingStatus: "closed", filingIsLive: true, filingProviderPlanId: "provider-1" },
    userActions: ["openSaved"],
    expectedUiState: { file: false, amend: false, activate: false, cancel: false },
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
    seanFeedbackId: "SF-39",
  },
  {
    name: "Sean - User can file current form state without manual save",
    description: "Visible edited form is the submitted source of truth.",
    savedPlan: { destination: "KDAL" },
    visibleForm: { destination: "KSDL" },
    userActions: ["edit", "file"],
    expectedPayload: { destination: "KSDL" },
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
    seanFeedbackId: "SF-09",
  },
  {
    name: "Sean - Changed date is used immediately",
    description: "Changed visible date is used immediately.",
    savedPlan: {
      plannedDepartureAt: new Date("2026-07-15T15:00:00.000Z"),
      plannerState: { departureTimeZone: "America/Chicago", userDisplayDepartureTimeLocal: "2026-07-15T10:00" },
    },
    visibleForm: {
      plannedDepartureAt: new Date("2026-07-16T15:00:00.000Z"),
      plannerState: { departureTimeZone: "America/Chicago", userDisplayDepartureTimeLocal: "2026-07-16T10:00" },
    },
    userActions: ["edit", "file"],
    expectedPayload: { departureInstant: "2026-07-16T15:00:00.000Z" },
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
    seanFeedbackId: "SF-09",
  },
  {
    name: "Sean - New session does not inherit previous filed plan",
    description: "New planner state is detached from previous provider identifiers.",
    initialPlan: { filingStatus: "draft", filingIsLive: false, filingProviderPlanId: null, filingProviderMessages: [] },
    userActions: ["browserRefresh", "new"],
    expectedUiState: { amend: false, activate: false, cancel: false },
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
    seanFeedbackId: "SF-04",
  },
  {
    name: "Sean - Corrected equipment files corrected value immediately",
    description: "Visible corrected equipment overrides stale saved equipment.",
    savedPlan: { filingEquipment: "SCE" },
    visibleForm: { filingEquipment: "SC", filingOtherInfo: "RMK/CORRECTED EQUIPMENT TEST" },
    userActions: ["staleSavedState", "edit", "file"],
    expectedPayload: { aircraftEquipment: "SC" },
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
    seanFeedbackId: "SF-12",
  },
  {
    name: "Sean - Field 18 and supplemental remarks do not overwrite each other",
    description: "Retrieve comparison keeps Field 18 and supplemental remarks separate.",
    initialPlan: { filingOtherInfo: "PBN/A1 RMK/FIELD 18 TEST", filingRemarks: "SUPPLEMENTAL TEST" },
    userActions: ["file", "retrieve"],
    providerRetrieveMode: "match",
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
    seanFeedbackId: "SF-18",
  },
  {
    name: "Sean - Retrieve sync does not accept stale local Field 18 as provider value",
    description: "Provider modified route/other info must be surfaced as a mismatch.",
    userActions: ["file", "retrieve", "sync"],
    providerRetrieveMode: "modified-route",
    expectedMismatchFields: ["route"],
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
    seanFeedbackId: "SF-33",
  },
  {
    name: "Sean - Phone and homebase verified through retrieve",
    description: "Retrieve omissions are flagged, not silently accepted.",
    userActions: ["file", "retrieve"],
    providerRetrieveMode: "omit-phone",
    expectedMismatchFields: ["pilotPhone"],
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
    seanFeedbackId: "SF-20",
  },
  {
    name: "Sean - User-facing provider trademark text removed",
    description: "Provider label should be FAA Flight Service in UI review.",
    userActions: ["openSaved"],
    expectedProviderBehavior: "not-applicable",
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
    seanFeedbackId: "SF-42",
  },
  {
    name: "Sean - Public users cannot think lab filing is live operational filing",
    description: "Public/lab safety copy and gating are certification blockers.",
    userActions: ["file"],
    providerCallShouldBeBlocked: true,
    expectedValidationResult: "invalid",
    visibleForm: { filingPilotPhone: null },
    seanFeedbackId: "SF-01",
  },
];

export const coreCertificationScenarios: FlightServiceScenario[] = [
  {
    name: "Invalid equipment SCE is blocked",
    description: "Invalid aircraft equipment should never reach provider.",
    visibleForm: { filingEquipment: "SCE", filingSurveillanceEquipment: "S" },
    userActions: ["file"],
    providerCallShouldBeBlocked: true,
    expectedValidationResult: "invalid",
  },
  {
    name: "Invalid surveillance B2 is blocked",
    description: "Flight Service surveillance field allows only supported compact codes.",
    visibleForm: { filingSurveillanceEquipment: "B2" },
    userActions: ["file"],
    providerCallShouldBeBlocked: true,
    expectedValidationResult: "invalid",
  },
  {
    name: "ZZZZ alternate FAA code ALTN only",
    description: "FAA/private alternate code does not append airport name or duplicate ALTN.",
    initialPlan: {
      departure: "KDWH",
      destination: "KSDL",
      alternate: "ZZZZ",
      filingAlternateName: "Rutherford Ranch Airport",
      plannerState: {
        departureTimeZone: "America/Chicago",
        userDisplayDepartureTimeLocal: "2026-07-02T10:00",
        planningReferenceAlternateAirport: "KSDL",
        actualAlternateLocationMode: "identifier",
        actualAlternateLocation: "85TX",
      },
    },
    userActions: ["file"],
    expectedPayload: { altDestination1: "ZZZZ" },
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
  },
  {
    name: "ZZZZ departure FAA code DEP only",
    description: "FAA/private departure code does not append airport name or duplicate DEP.",
    initialPlan: {
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
    },
    userActions: ["file"],
    expectedPayload: { departure: "ZZZZ" },
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
  },
  {
    name: "ZZZZ destination FAA code DEST only",
    description: "FAA/private destination code does not append airport name or duplicate DEST.",
    initialPlan: {
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
    },
    userActions: ["file"],
    expectedPayload: { destination: "ZZZZ" },
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
  },
  {
    name: "Closed plan blocks operational actions",
    description: "Closed lifecycle state is read-only for provider actions.",
    initialPlan: { filingStatus: "closed", filingIsLive: true, filingProviderPlanId: "provider-closed" },
    userActions: ["openSaved", "file", "amend", "activate", "cancel"],
    expectedUiState: { file: false, amend: false, activate: false, cancel: false },
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
  },
  {
    name: "Provider retrieve omits home base",
    description: "Missing home base in RetrieveFlightPlan is flagged.",
    userActions: ["file", "retrieve"],
    providerRetrieveMode: "omit-home-base",
    expectedMismatchFields: ["aircraftHomeBase"],
    providerCallShouldBeBlocked: false,
    expectedValidationResult: "valid",
  },
];

export const generateRandomScenarios = ({ seed = 20260701, count = 50 }: ScenarioGeneratorOptions = {}): FlightServiceScenario[] => {
  const rng = makeRng(seed);
  return Array.from({ length: count }, (_, index) => {
    const useZzzz = rng() < 0.25;
    const zzzzKind = pick(rng, ["departure", "destination", "alternate"] as const);
    const zzzzMode = pick(rng, ["identifier", "latlong"] as const);
    const departure = useZzzz && zzzzKind === "departure" ? "ZZZZ" : pick(rng, AIRPORTS);
    const destination = useZzzz && zzzzKind === "destination" ? "ZZZZ" : pick(rng, AIRPORTS.filter((airport) => airport !== departure));
    const alternate = useZzzz && zzzzKind === "alternate" ? "ZZZZ" : pick(rng, [null, "KPBI", "KVGT", "KDAL"] as const);
    const route = pick(rng, ROUTES);
    const equipment = pick(rng, EQUIPMENT);
    const surveillance = pick(rng, SURVEILLANCE);
    const otherInfo = equipment.includes("R")
      ? (rng() < 0.5 ? "PBN/A1" : "PBN/A1 RMK/RANDOM FIELD 18")
      : (rng() < 0.5 ? "RMK/RANDOM FIELD 18" : "");
    const missingAltitude = rng() < 0.12;
    const missingFuel = rng() < 0.12;
    const providerRetrieveMode = pick(rng, RETRIEVE_MODES);
    const zzzzPlannerState = useZzzz ? zzzzState(zzzzKind, zzzzMode) : {};
    const zzzzNames = useZzzz ? {
      filingDepartureName: zzzzKind === "departure" ? "Private Strip" : undefined,
      filingDestinationName: zzzzKind === "destination" ? "Private Strip" : undefined,
      filingAlternateName: zzzzKind === "alternate" ? "Private Strip" : undefined,
    } : {};

    const shouldBlock = equipment === "SCE" || surveillance === "B2" || surveillance === "" || equipment === "" || missingAltitude || missingFuel;

    return {
      name: `Generated ${String(index + 1).padStart(3, "0")} seed ${seed}`,
      description: "Deterministic randomized Flight Service certification scenario.",
      initialPlan: {
        departure,
        destination,
        alternate,
        route,
        filingEquipment: equipment,
        filingSurveillanceEquipment: surveillance,
        filingPlannedAltitudeFt: missingAltitude ? null : 5500,
        filingEnduranceMinutes: missingFuel ? null : 240,
        filingOtherInfo: otherInfo,
        filingRemarks: rng() < 0.5 ? "CERTIFICATION TEST" : "SUPPLEMENTAL TEST",
        plannerState: {
          departureTimeZone: "America/Chicago",
          userDisplayDepartureTimeLocal: "2026-07-02T10:00",
          ...zzzzPlannerState,
        },
        ...zzzzNames,
      },
      userActions: ["new", rng() < 0.5 ? "edit" : "openSaved", "file", "retrieve"],
      providerRetrieveMode,
      expectedMismatchFields: shouldBlock ? [] : expectedMismatchFieldsForMode(providerRetrieveMode),
      providerCallShouldBeBlocked: shouldBlock,
      expectedValidationResult: shouldBlock ? "invalid" : "valid",
    };
  });
};

export const buildCertificationScenarios = (options: ScenarioGeneratorOptions = {}) => [
  ...coreCertificationScenarios,
  ...seanRegressionScenarios,
  ...generateRandomScenarios(options),
];
