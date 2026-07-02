import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FlightPlan, FlightPlanFilingAction } from "../../../shared/schema";
import { storage } from "../../../server/storage";
import {
  buildLeidosActionPayload,
  flightPlanFilingProvider,
  getLeidosFlightServiceDiagnostics,
  validateFlightPlanForAction,
} from "../../../server/services/flight-plan-filing/provider";

type CaseAction = FlightPlanFilingAction;

type LiveLabCase = {
  seed: number;
  name: string;
  actions: CaseAction[];
  buildPlan: () => FlightPlan;
  skipReason?: string;
};

const MAX_CASES = 15;
const CERT_REMARK = "RSF LEIDOS LAB CERTIFICATION TEST - DO NOT TREAT AS LIVE OPERATIONAL FLIGHT";

const arg = (name: string, fallback = "") => {
  const flag = `--${name}`;
  if (process.argv.includes(flag) && !process.argv[process.argv.indexOf(flag) + 1]?.startsWith("--")) {
    return process.argv[process.argv.indexOf(flag) + 1];
  }
  const prefixed = process.argv.find((value) => value.startsWith(`${flag}=`));
  return prefixed ? prefixed.slice(flag.length + 1) : fallback;
};

const hasFlag = (name: string) => process.argv.includes(`--${name}`);
const boolEnv = (value?: string | null) => /^(true|1|yes|on)$/i.test(String(value || "").trim());
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

const normalizePhone = (value?: string | null) => String(value || "").replace(/\D/g, "");

const assertLabEndpoint = () => {
  const diagnostics = getLeidosFlightServiceDiagnostics();
  const endpoint = String(diagnostics.baseUrl || "").toLowerCase();
  const productionLike = endpoint.includes("lmfsweb.afss.com") || endpoint.includes("production") || endpoint.includes("prod");
  const labLike = endpoint.includes("ffspelabs") || endpoint.includes("lab");
  if (diagnostics.environment === "production" || productionLike || !labLike) {
    throw new Error(`Refusing to run: configured Leidos endpoint is not LAB. baseUrl=${diagnostics.baseUrl}`);
  }
  return diagnostics;
};

const loadDedicatedTestContext = async () => {
  const email = String(process.env.LEIDOS_TEST_USER_EMAIL || "").trim().toLowerCase();
  if (!email) throw new Error("LEIDOS_TEST_USER_EMAIL is required.");
  const user = await storage.getUserByEmail(email);
  if (!user) throw new Error(`No RSF user found for LEIDOS_TEST_USER_EMAIL=${email}.`);
  if ((user as any).isSuperAdmin) throw new Error("Refusing to run: LEIDOS_TEST_USER_EMAIL belongs to a Super Admin.");
  if ((user as any).isAdmin) throw new Error("Refusing to run: LEIDOS_TEST_USER_EMAIL belongs to an Admin. Use a normal test user account.");
  const phone = normalizePhone((user as any).phone);
  const homeBase = String((user as any).homeBase || "").trim().toUpperCase();
  const name = `${String((user as any).firstName || "").trim()} ${String((user as any).lastName || "").trim()}`.trim();
  const missing: string[] = [];
  if (!name) missing.push("user first/last name");
  if (phone.length < 10) missing.push("phone number");
  if (!/^[A-Z0-9]{3,4}$/.test(homeBase)) missing.push("home base");
  const profiles = await storage.getAircraftProfilesByUser(user.id);
  const profile = profiles.find((item) => String(item.tailNumber || "").trim()) || profiles[0];
  if (!profile) missing.push("default aircraft profile");
  let aircraftType = "";
  if (profile?.typeId) {
    const type = await storage.getAircraftTypeById(profile.typeId);
    aircraftType = String(type?.icaoType || "").trim().toUpperCase();
  }
  if (!aircraftType) aircraftType = String(profile?.name || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const aircraftMissing: string[] = [];
  if (!String(profile?.tailNumber || "").trim()) aircraftMissing.push("tail number");
  if (!aircraftType) aircraftMissing.push("ICAO aircraft type");
  if (!String(profile?.filingEquipmentDefault || "").trim()) aircraftMissing.push("aircraft equipment default");
  if (!String(profile?.filingSurveillanceEquipmentDefault || "").trim()) aircraftMissing.push("surveillance equipment default");
  if (!String(profile?.filingWakeTurbulenceDefault || "").trim()) aircraftMissing.push("wake turbulence default");
  if (!String(profile?.filingAircraftColorDefault || "").trim()) aircraftMissing.push("aircraft color default");
  if (aircraftMissing.length) missing.push(`aircraft profile missing ${aircraftMissing.join(", ")}`);
  if (missing.length) {
    throw new Error(`Dedicated Leidos test account is incomplete. Fix: ${missing.join("; ")}.`);
  }
  return { user, profile: profile!, aircraftType, phone, homeBase, pilotName: name };
};

const dryRunContext = () => ({
  user: { id: "dry-run-user", email: "dry-run@example.test", isAdmin: false, isSuperAdmin: false } as any,
  profile: {
    id: "dry-run-aircraft",
    userId: "dry-run-user",
    name: "C172",
    tailNumber: "N123TX",
    typeId: null,
    filingEquipmentDefault: "S",
    filingSurveillanceEquipmentDefault: "C",
    filingWakeTurbulenceDefault: "LIGHT",
    filingAircraftColorDefault: "WHITE BLUE",
    filingSoulsOnBoardDefault: "2",
    filingPilotNameDefault: "RSF Cert Pilot",
    filingTypeOfFlightDefault: "G",
  } as any,
  aircraftType: "C172",
  phone: "5125550100",
  homeBase: "KEDC",
  pilotName: "RSF Cert Pilot",
});

const createBasePlanFactory = (context: Awaited<ReturnType<typeof loadDedicatedTestContext>>, runId: string) => (seed: number, name: string, overrides: Partial<FlightPlan> = {}): FlightPlan => {
  const profile = context.profile;
  return {
    id: `live-lab-${seed}`,
    userId: context.user.id,
    title: `RSF Live LAB ${seed} ${name}`,
    departure: "KEDC",
    destination: "KDAL",
    alternate: "KACT",
    route: "DCT",
    plannedDepartureAt: new Date("2026-07-15T15:00:00.000Z"),
    plannedArrivalAt: new Date("2026-07-15T16:00:00.000Z"),
    aircraftType: context.aircraftType,
    tailNumber: String(profile.tailNumber || "").trim().toUpperCase(),
    fuelOnBoard: "40",
    fuelRequired: "15",
    filingFlightRules: "VFR",
    filingEquipment: String(profile.filingEquipmentDefault || "S").trim().toUpperCase(),
    filingSoulsOnBoard: String(profile.filingSoulsOnBoardDefault || "2").trim(),
    filingAircraftColor: String(profile.filingAircraftColorDefault || "WHITE BLUE").trim(),
    filingPilotName: String(profile.filingPilotNameDefault || context.pilotName).trim(),
    filingPilotPhone: context.phone,
    filingAircraftHomeBase: context.homeBase,
    filingRemarks: `${CERT_REMARK} ${runId} SEED ${seed}`,
    filingWakeTurbulence: String(profile.filingWakeTurbulenceDefault || "LIGHT").trim().toUpperCase(),
    filingTypeOfFlight: String(profile.filingTypeOfFlightDefault || "G").trim().toUpperCase(),
    filingSurveillanceEquipment: String(profile.filingSurveillanceEquipmentDefault || "N").trim().toUpperCase(),
    filingOtherInfo: `PBN/A1 RMK/${CERT_REMARK} ${runId} SEED ${seed}`,
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
    plannerState: { departureTimeZone: "America/Chicago", userDisplayDepartureTimeLocal: "2026-07-15T10:00" },
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as FlightPlan;
};

const buildCases = (context: Awaited<ReturnType<typeof loadDedicatedTestContext>>, runId: string): LiveLabCase[] => {
  const plan = createBasePlanFactory(context, runId);
  return [
    { seed: 1, name: "Normal VFR ICAO file", actions: ["file"], buildPlan: () => plan(1, "Normal VFR") },
    { seed: 2, name: "Normal IFR ICAO file", actions: ["file"], buildPlan: () => plan(2, "Normal IFR", { filingFlightRules: "IFR", route: "DCT KDWH DCT", filingPlannedAltitudeFt: 7000 }) },
    { seed: 3, name: "ZZZZ destination lat/long description", actions: ["file"], buildPlan: () => plan(3, "ZZZZ Destination", { destination: "ZZZZ", filingDestinationName: "PRIVATE STRIP", plannerState: { departureTimeZone: "America/Chicago", userDisplayDepartureTimeLocal: "2026-07-15T10:00", planningReferenceDestinationAirport: "KSDL", actualDestinationLocationMode: "latlong", actualDestinationLocation: "3839N09045W" } }) },
    { seed: 4, name: "ZZZZ departure lat/long description", actions: ["file"], buildPlan: () => plan(4, "ZZZZ Departure", { departure: "ZZZZ", filingDepartureName: "PRIVATE STRIP", plannerState: { departureTimeZone: "America/Chicago", userDisplayDepartureTimeLocal: "2026-07-15T10:00", planningReferenceDepartureAirport: "KDWH", actualDepartureLocationMode: "latlong", actualDepartureLocation: "3839N09045W" } }) },
    { seed: 5, name: "ZZZZ alternate destination", actions: ["file"], buildPlan: () => plan(5, "ZZZZ Alternate", { alternate: "ZZZZ", filingAlternateName: "PRIVATE STRIP", plannerState: { departureTimeZone: "America/Chicago", userDisplayDepartureTimeLocal: "2026-07-15T10:00", planningReferenceAlternateAirport: "KACT", actualAlternateLocationMode: "identifier", actualAlternateLocation: "85TX" } }) },
    { seed: 6, name: "Aircraft ID ZZZZ unsupported safety check", actions: [], skipReason: "RSF does not currently support aircraft identifier ZZZZ certification. Flight Service clarified aircraft type ZZZZ is the supported workflow.", buildPlan: () => plan(6, "Aircraft ID ZZZZ", { tailNumber: "ZZZZ" }) },
    { seed: 7, name: "Other Info RMK retained", actions: ["file"], buildPlan: () => plan(7, "RMK Retained", { filingOtherInfo: `PBN/A1 RMK/${CERT_REMARK} RMK RETAINED ${runId}` }) },
    { seed: 8, name: "PBN R equipment validation", actions: ["file"], buildPlan: () => plan(8, "PBN R", { filingEquipment: "R", filingOtherInfo: `PBN/A1 RMK/${CERT_REMARK} PBN R ${runId}` }) },
    { seed: 9, name: "Timezone boundary local to Zulu", actions: ["file"], buildPlan: () => plan(9, "TZ Boundary", { plannedDepartureAt: new Date("2026-03-09T04:30:00.000Z"), plannerState: { departureTimeZone: "America/Chicago", userDisplayDepartureTimeLocal: "2026-03-08T23:30" } }) },
    { seed: 10, name: "Phoenix Arizona no-DST", actions: ["file"], buildPlan: () => plan(10, "Phoenix No DST", { departure: "KPHX", destination: "KLAS", plannedDepartureAt: new Date("2026-07-15T16:00:00.000Z"), plannerState: { departureTimeZone: "America/Phoenix", userDisplayDepartureTimeLocal: "2026-07-15T09:00" } }) },
    { seed: 11, name: "VFR file then activate", actions: ["file", "activate"], buildPlan: () => plan(11, "VFR Activate") },
    { seed: 12, name: "VFR file activate close", actions: ["file", "activate", "close"], buildPlan: () => plan(12, "VFR Close", { filingCloseLocation: "KDAL" } as any) },
    { seed: 13, name: "IFR file then amend", actions: ["file", "amend"], buildPlan: () => plan(13, "IFR Amend", { filingFlightRules: "IFR", route: "DCT KDWH DCT", filingPlannedAltitudeFt: 7000 }) },
    { seed: 14, name: "File then cancel", actions: ["file", "cancel"], buildPlan: () => plan(14, "Cancel") },
    { seed: 15, name: "Provider update versionStamp preservation", actions: ["file", "amend"], buildPlan: () => plan(15, "Version Stamp", { route: "DCT KDWH DCT" }) },
  ];
};

const summarizePayload = (plan: FlightPlan, action: FlightPlanFilingAction) => {
  if (action !== "file" && action !== "amend") return null;
  const payload = Object.fromEntries(buildLeidosActionPayload(plan, action, { otherInfo: null } as any).params.entries());
  return {
    aircraftIdentifier: payload.aircraftIdentifier,
    aircraftType: payload.aircraftType,
    flightRules: payload.flightRules,
    departure: payload.departure,
    destination: payload.destination,
    altDestination1: payload.altDestination1,
    route: payload.route,
    otherInfo: payload.otherInfo,
    departureInstant: payload.departureInstant,
  };
};

const simulateDryRunProviderState = (plan: FlightPlan, action: FlightPlanFilingAction, seed: number): FlightPlan => {
  const providerPlanId = plan.filingProviderPlanId || `dry-provider-${seed}`;
  const versionStamp = `20260702${String(seed).padStart(6, "0")}`;
  const nextStatus =
    action === "file" || action === "amend" ? "filed" :
    action === "activate" ? "activated" :
    action === "cancel" ? "cancelled" :
    action === "close" ? "closed" :
    plan.filingStatus;
  const lifecycle =
    nextStatus === "activated" ? "activated" :
    nextStatus === "cancelled" ? "cancelled" :
    nextStatus === "closed" ? "closed" :
    "proposed";
  return {
    ...plan,
    filingProviderPlanId: providerPlanId,
    filingStatus: nextStatus,
    filingIsLive: true,
    filingRaw: {
      ...(plan.filingRaw && typeof plan.filingRaw === "object" ? plan.filingRaw as Record<string, unknown> : {}),
      providerPlanId,
      versionStamp,
      response: { flightIdentifier: providerPlanId, versionStamp },
    },
    filingProviderSnapshot: {
      ...(plan.filingProviderSnapshot && typeof plan.filingProviderSnapshot === "object" ? plan.filingProviderSnapshot as Record<string, unknown> : {}),
      providerPlanId,
      versionStamp,
      providerLifecycleStatus: lifecycle,
      providerActionAvailability: {
        activate: lifecycle === "proposed",
        cancel: lifecycle === "proposed",
        close: lifecycle === "activated",
        requiresSync: false,
      },
    },
  } as FlightPlan;
};

const countdown = async (minutes: number, nextName: string) => {
  const seconds = Math.max(0, Math.round(minutes * 60));
  for (let remaining = seconds; remaining > 0; remaining -= 30) {
    console.log(`Next case "${nextName}" in ${Math.ceil(remaining / 60)} minute(s)...`);
    await sleep(Math.min(30, remaining) * 1000);
  }
};

const run = async () => {
  const dryRun = hasFlag("dry-run") || !hasFlag("confirm-leidos-lab");
  const limit = Math.min(MAX_CASES, Math.max(1, Number(arg("limit", "15")) || 15));
  const delayMinutes = Math.max(0, Number(arg("delay-minutes", process.env.LEIDOS_LAB_DELAY_MINUTES || "3")) || 3);
  const replay = arg("replay", "");
  const runId = `leidos-live-lab-${stamp()}`;

  const diagnostics = assertLabEndpoint();
  if (!dryRun && !boolEnv(process.env.LEIDOS_LAB_TEST_ENABLED)) {
    throw new Error("Refusing to run: LEIDOS_LAB_TEST_ENABLED=true is required for live LAB certification.");
  }
  if (!dryRun && boolEnv(process.env.FLIGHT_SERVICE_OPERATIONAL_FILING_ENABLED || process.env.FLIGHT_FILING_OPERATIONAL_ENABLED)) {
    throw new Error("Refusing to run: production/operational filing flag is enabled.");
  }

  const context = dryRun && !process.env.LEIDOS_TEST_USER_EMAIL
    ? dryRunContext()
    : await loadDedicatedTestContext();
  const cases = buildCases(context, runId)
    .filter((item) => !replay || String(item.seed) === replay)
    .slice(0, replay ? 1 : limit);
  if (cases.length === 0) throw new Error(`No live LAB test case matched replay=${replay}.`);

  console.log(`Leidos live LAB certification ${dryRun ? "DRY RUN" : "CONFIRMED"}`);
  console.log(`Endpoint: ${diagnostics.baseUrl}`);
  console.log(`Test user: ${process.env.LEIDOS_TEST_USER_EMAIL}`);
  console.log(`Cases: ${cases.length}/${MAX_CASES}`);
  console.log(`Delay: ${delayMinutes} minute(s)`);

  const results: any[] = [];
  for (const [index, testCase] of cases.entries()) {
    if (!dryRun && index > 0) await countdown(delayMinutes, testCase.name);
    let plan = testCase.buildPlan();
    console.log(`[${index + 1}/${cases.length}] ${testCase.name} seed=${testCase.seed}`);
    const caseResult = {
      testName: testCase.name,
      seed: testCase.seed,
      actions: [] as any[],
      pass: true,
      skipped: Boolean(testCase.skipReason),
      warnings: [] as string[],
      errors: [] as string[],
    };
    if (testCase.skipReason) {
      caseResult.warnings.push(testCase.skipReason);
      caseResult.actions.push({ action: "skip", payloadSummary: null, responseStatus: "skipped", providerPlanId: null, versionStamp: null, warnings: [testCase.skipReason], errors: [], elapsedMs: 0 });
      results.push(caseResult);
      continue;
    }
    for (const action of testCase.actions) {
      const started = Date.now();
      const validation = validateFlightPlanForAction(plan, action);
      const payloadSummary = summarizePayload(plan, action);
      if (!validation.ready) {
        caseResult.pass = false;
        caseResult.errors.push(`Validation failed before ${action}: ${validation.errors.join(" | ")}`);
        caseResult.actions.push({ action, payloadSummary, responseStatus: "validation_failed", warnings: validation.warnings, errors: validation.errors, elapsedMs: Date.now() - started });
        break;
      }
      if (dryRun) {
        caseResult.actions.push({ action, payloadSummary, responseStatus: "dry_run", providerPlanId: null, versionStamp: null, warnings: validation.warnings, errors: [], elapsedMs: Date.now() - started });
        plan = simulateDryRunProviderState(plan, action, testCase.seed);
        continue;
      }
      const response = await flightPlanFilingProvider.stageAction(plan, action);
      const versionStamp = String(response.raw?.versionStamp || response.providerSnapshot?.versionStamp || "");
      caseResult.actions.push({
        action,
        payloadSummary,
        responseStatus: response.live ? "accepted" : "staged",
        providerPlanId: response.providerPlanId || null,
        versionStamp,
        warnings: response.warnings || [],
        errors: response.live ? [] : [response.message],
        elapsedMs: Date.now() - started,
      });
      if (!response.live) {
        caseResult.pass = false;
        caseResult.errors.push(response.message);
        break;
      }
      plan = {
        ...plan,
        filingProviderPlanId: response.providerPlanId || plan.filingProviderPlanId,
        filingStatus: response.nextStatus,
        filingIsLive: response.live,
        filingRaw: response.raw,
        filingPayload: response.payloadSnapshot?.transmittedFields || plan.filingPayload,
        filingProviderSnapshot: response.providerSnapshot || plan.filingProviderSnapshot,
      } as FlightPlan;
    }
    results.push(caseResult);
    if (!caseResult.pass && !dryRun) {
      console.error(`Stopping after failure in ${testCase.name}: ${caseResult.errors.join(" | ")}`);
      break;
    }
  }

  const output = {
    runId,
    dryRun,
    endpoint: diagnostics.baseUrl,
    testUserEmail: process.env.LEIDOS_TEST_USER_EMAIL,
    limit,
    delayMinutes,
    totalCases: results.length,
    passed: results.filter((item) => item.pass).length,
    failed: results.filter((item) => !item.pass).length,
    results,
    createdAt: new Date().toISOString(),
  };
  const dir = join("certification-results", "leidos-live-lab");
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${runId}.json`);
  writeFileSync(filePath, JSON.stringify(output, null, 2));
  console.log(`Saved results: ${filePath}`);
  if (output.failed > 0 && !dryRun) process.exitCode = 1;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
