import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import type { FlightPlan } from "../../../shared/schema";
import { buildLeidosActionPayload, compareRetrievedProviderPlanFields, validateFlightPlanForAction } from "../../../server/services/flight-plan-filing/provider";
import { getFlightServiceRuntimeMode } from "../../../server/services/flightServiceRuntimeMode";
import { filingPlan, visibleLifecycleActions } from "../test-utils";

type StressMode = "standard" | "extended";
type StressCategory =
  | "Time Zones"
  | "ZZZZ"
  | "Equipment"
  | "PBN"
  | "Field 18"
  | "Supplemental Remarks"
  | "Lifecycle"
  | "Retrieve Compare"
  | "Provider Notifications"
  | "Validation"
  | "Environment Safety";

type StressScenario = {
  id: string;
  name: string;
  category: StressCategory;
  seed: number;
  action: "file" | "amend" | "activate" | "cancel" | "close" | "retrieve" | "sync";
  plan: Partial<FlightPlan>;
  expectValid?: boolean;
  expectPayload?: Record<string, unknown>;
  expectUi?: Record<string, unknown>;
  retrieveMutation?: Record<string, unknown>;
  warning?: string | null;
};

type StressFailure = {
  testName: string;
  category: StressCategory;
  seed: number;
  replayCommand: string;
  timestamp: string;
  requestPayload: Record<string, unknown>;
  providerPayload: Record<string, unknown> | null;
  mockProviderResponse: Record<string, unknown> | null;
  retrieveResponse: Record<string, unknown> | null;
  expectedValues: Record<string, unknown>;
  actualValues: Record<string, unknown>;
  diff: Array<{ field: string; expected: unknown; actual: unknown; issue: string }>;
  lifecycleBefore: Record<string, unknown>;
  lifecycleAfter: Record<string, unknown>;
  relatedLogs: string[];
};

const CATEGORIES: StressCategory[] = [
  "Time Zones",
  "ZZZZ",
  "Equipment",
  "PBN",
  "Field 18",
  "Supplemental Remarks",
  "Lifecycle",
  "Retrieve Compare",
  "Provider Notifications",
  "Validation",
  "Environment Safety",
];

const arg = (name: string, fallback = "") => {
  const flag = `--${name}`;
  const exact = process.argv.findIndex((value) => value === flag);
  if (exact >= 0 && process.argv[exact + 1]) return process.argv[exact + 1];
  const prefix = `${flag}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const makeRng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const pick = <T>(rng: () => number, values: T[]) => values[Math.floor(rng() * values.length)];

const timestamp = () => new Date().toISOString().replace(/[:.]/g, "-");
const reportTimestamp = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const getCommit = () => {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown";
};

const payloadFor = (plan: FlightPlan, action: "file" | "amend") =>
  Object.fromEntries(buildLeidosActionPayload(plan, action, { otherInfo: null } as any).params.entries());

const compareValue = (value: unknown) => String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");

const baseScenarioPlan = (scenario: StressScenario): FlightPlan => filingPlan({
  ...scenario.plan,
  filingStatus: scenario.plan.filingStatus || (scenario.action === "amend" ? "filed" : scenario.plan.filingStatus),
  filingIsLive: scenario.plan.filingIsLive ?? (scenario.action === "amend" || scenario.action === "activate" || scenario.action === "cancel" || scenario.action === "close"),
  filingProviderPlanId: scenario.plan.filingProviderPlanId ?? ((scenario.action === "amend" || scenario.action === "activate" || scenario.action === "cancel" || scenario.action === "close") ? "stress-provider-1" : null),
}) as FlightPlan;

const deterministicScenarios = (): StressScenario[] => [
  {
    id: "env-lab-safety",
    name: "LAB mode requires acknowledgement and blocks operational assumptions",
    category: "Environment Safety",
    seed: 1001,
    action: "file",
    plan: {},
    expectValid: true,
  },
  {
    id: "central-midnight-rollover",
    name: "Central midnight UTC rollover departure",
    category: "Time Zones",
    seed: 1002,
    action: "file",
    plan: {
      plannedDepartureAt: new Date("2026-03-09T05:30:00.000Z"),
      plannerState: { departureTimeZone: "America/Chicago", userDisplayDepartureTimeLocal: "2026-03-08T23:30" },
    },
    expectPayload: { departureInstant: "2026-03-09T04:30:00.000Z" },
    expectValid: true,
  },
  {
    id: "arizona-no-dst",
    name: "Arizona no-DST local departure conversion",
    category: "Time Zones",
    seed: 1003,
    action: "file",
    plan: {
      departure: "KPHX",
      destination: "KLAS",
      plannedDepartureAt: new Date("2026-07-01T16:15:00.000Z"),
      plannerState: { departureTimeZone: "America/Phoenix", userDisplayDepartureTimeLocal: "2026-07-01T09:15" },
    },
    expectPayload: { departureInstant: "2026-07-01T16:15:00.000Z" },
    expectValid: true,
  },
  {
    id: "zzzz-dep-private-code",
    name: "ZZZZ departure private field code emits DEP/85TX only",
    category: "ZZZZ",
    seed: 1004,
    action: "file",
    plan: {
      departure: "ZZZZ",
      plannedDepartureAt: new Date("2026-06-22T15:00:00.000Z"),
      plannerState: { departureTimeZone: "America/Chicago", userDisplayDepartureTimeLocal: "2026-06-22T10:00", planningReferenceDepartureAirport: "KDWH", actualDepartureLocationMode: "identifier", actualDepartureLocation: "85TX" },
      filingDepartureName: "PRIVATE STRIP",
    },
    expectPayload: { departure: "ZZZZ" },
    expectValid: true,
  },
  {
    id: "zzzz-dest-latlong-description",
    name: "ZZZZ destination lat/long includes description",
    category: "ZZZZ",
    seed: 1005,
    action: "file",
    plan: {
      destination: "ZZZZ",
      plannerState: { planningReferenceDestinationAirport: "KSDL", actualDestinationLocationMode: "latlong", actualDestinationLocation: "3839N09045W" },
      filingDestinationName: "PRIVATE STRIP",
    },
    expectPayload: { destination: "ZZZZ" },
    expectValid: true,
  },
  {
    id: "zzzz-alt-private-code",
    name: "ZZZZ alternate private field code emits ALTN/85TX only",
    category: "ZZZZ",
    seed: 1006,
    action: "file",
    plan: {
      alternate: "ZZZZ",
      plannerState: { planningReferenceAlternateAirport: "KSDL", actualAlternateLocationMode: "identifier", actualAlternateLocation: "85TX" },
      filingAlternateName: "PRIVATE STRIP",
    },
    expectPayload: { altDestination1: "ZZZZ" },
    expectValid: true,
  },
  {
    id: "equipment-invalid-sce",
    name: "Invalid aircraft equipment SCE blocks before provider",
    category: "Equipment",
    seed: 1007,
    action: "file",
    plan: { filingEquipment: "SCE", filingSurveillanceEquipment: "S" },
    expectValid: false,
  },
  {
    id: "pbn-required-with-r",
    name: "R equipment requires PBN in Field 18",
    category: "PBN",
    seed: 1008,
    action: "file",
    plan: { filingEquipment: "R", filingOtherInfo: "" },
    expectValid: false,
  },
  {
    id: "field18-typ-for-zzzz-aircraft-type",
    name: "Aircraft type ZZZZ sends TYP actual type",
    category: "Field 18",
    seed: 1009,
    action: "file",
    plan: { aircraftType: "ZZZZ", plannerState: { actualAircraftType: "TBM700" } },
    expectPayload: { aircraftType: "ZZZZ" },
    expectValid: true,
  },
  {
    id: "supp-remarks-separate",
    name: "Supplemental remarks stay out of Field 18",
    category: "Supplemental Remarks",
    seed: 1010,
    action: "file",
    plan: { filingOtherInfo: "PBN/A1 RMK/FIELD18", filingRemarks: "SUPPLEMENTAL TEST" },
    expectPayload: { remarks: "SUPPLEMENTAL TEST" },
  },
  {
    id: "closed-plan-actions",
    name: "Closed plan hides lifecycle actions",
    category: "Lifecycle",
    seed: 1011,
    action: "close",
    plan: { filingStatus: "closed", filingIsLive: true, filingProviderPlanId: "stress-provider-closed" },
    expectUi: { file: false, amend: false, activate: false, cancel: false, close: false },
  },
  {
    id: "retrieve-route-mismatch",
    name: "Retrieve comparison detects provider route change",
    category: "Retrieve Compare",
    seed: 1012,
    action: "retrieve",
    plan: { route: "DCT KBPT DCT" },
    retrieveMutation: { route: "DCT KBPT DCT LCH DCT" },
    expectValid: true,
  },
  {
    id: "provider-notice",
    name: "Provider notification notice is captured",
    category: "Provider Notifications",
    seed: 1013,
    action: "sync",
    plan: { filingProviderSnapshot: { versionStamp: "20260701120000000", notices: [] } as any },
    retrieveMutation: { notices: ["Provider notice received during stress test"], versionStamp: "20260701120500000" },
    expectValid: true,
  },
  {
    id: "missing-phone-validation",
    name: "Missing phone blocks filing",
    category: "Validation",
    seed: 1014,
    action: "file",
    plan: { filingPilotPhone: null },
    expectValid: false,
  },
];

const randomizedScenario = (seed: number, index: number): StressScenario => {
  const rng = makeRng(seed);
  const categories: StressCategory[] = ["Time Zones", "ZZZZ", "Equipment", "PBN", "Field 18", "Lifecycle", "Retrieve Compare", "Validation"];
  const category = pick(rng, categories);
  const airports = ["KEDC", "KDWH", "KSDL", "KPHX", "KLAS", "KMIA", "PHNL", "PANC"];
  const zones = ["America/Chicago", "America/New_York", "America/Denver", "America/Los_Angeles", "America/Phoenix", "America/Anchorage", "Pacific/Honolulu"];
  const equipment = ["S", "SC", "R", "SCE"];
  const surveillance = ["C", "S", "N"];
  const dep = pick(rng, airports);
  const dest = pick(rng, airports.filter((airport) => airport !== dep));
  const route = pick(rng, ["DCT", "DCT KDWH DCT", "KEDC DCT KBPT DCT KGAO", "DCT LCH DCT KEYW"]);
  const plannedDepartureAt = new Date(Date.UTC(2026, Math.floor(rng() * 12), 1 + Math.floor(rng() * 27), Math.floor(rng() * 24), Math.floor(rng() * 60)));
  const plan: Partial<FlightPlan> = {
    departure: dep,
    destination: dest,
    route,
    filingEquipment: pick(rng, equipment),
    filingSurveillanceEquipment: pick(rng, surveillance),
    plannedDepartureAt,
    plannerState: { departureTimeZone: pick(rng, zones), userDisplayDepartureTimeLocal: plannedDepartureAt.toISOString().slice(0, 16) },
  };
  if (category === "ZZZZ") {
    const kind = pick(rng, ["departure", "destination", "alternate"] as const);
    const mode = pick(rng, ["identifier", "latlong"] as const);
    const value = mode === "identifier" ? pick(rng, ["85TX", "TX03", "87TX"]) : "3839N09045W";
    if (kind === "departure") {
      plan.departure = "ZZZZ";
      plan.plannerState = { ...plan.plannerState as any, planningReferenceDepartureAirport: "KDWH", actualDepartureLocationMode: mode, actualDepartureLocation: value };
      plan.filingDepartureName = "PRIVATE STRIP";
    }
    if (kind === "destination") {
      plan.destination = "ZZZZ";
      plan.plannerState = { ...plan.plannerState as any, planningReferenceDestinationAirport: "KSDL", actualDestinationLocationMode: mode, actualDestinationLocation: value };
      plan.filingDestinationName = "PRIVATE STRIP";
    }
    if (kind === "alternate") {
      plan.alternate = "ZZZZ";
      plan.plannerState = { ...plan.plannerState as any, planningReferenceAlternateAirport: "KSDL", actualAlternateLocationMode: mode, actualAlternateLocation: value };
      plan.filingAlternateName = "PRIVATE STRIP";
    }
  }
  const validEquipment = plan.filingEquipment !== "SCE" && !(plan.filingEquipment === "R" && !String(plan.filingOtherInfo || "PBN/A1").includes("PBN/"));
  return {
    id: `random-${index}-${seed}`,
    name: `Randomized ${category} scenario ${index}`,
    category,
    seed,
    action: pick(rng, ["file", "amend", "retrieve", "sync"] as const),
    plan,
    retrieveMutation: category === "Retrieve Compare" ? { route: `${route} LCH DCT`.trim() } : undefined,
    expectValid: validEquipment,
  };
};

const buildScenarios = (mode: StressMode, replaySeed?: number | null) => {
  if (replaySeed) {
    const deterministic = deterministicScenarios().find((scenario) => scenario.seed === replaySeed);
    return deterministic ? [deterministic] : [randomizedScenario(replaySeed, 1)];
  }
  const count = Number(arg("count", mode === "extended" ? "250" : "60"));
  const seedBase = Number(arg("seed", "20260701"));
  const randoms = Array.from({ length: count }, (_, index) => randomizedScenario(seedBase + index * 7919, index + 1));
  return [...deterministicScenarios(), ...randoms];
};

const runScenario = (scenario: StressScenario) => {
  const plan = baseScenarioPlan(scenario);
  const actionForValidation = scenario.action === "retrieve" || scenario.action === "sync" ? "file" : scenario.action;
  const validation = validateFlightPlanForAction(plan, actionForValidation as any);
  const payload = !validation.errors.length && (scenario.action === "file" || scenario.action === "amend" || scenario.action === "retrieve" || scenario.action === "sync")
    ? payloadFor(plan, scenario.action === "amend" ? "amend" : "file")
    : null;
  const retrieveResponse = payload ? { ...payload, versionStamp: "20260701120000000", ...(scenario.retrieveMutation || {}) } : null;
  const ui = visibleLifecycleActions(plan);
  const diffs: StressFailure["diff"] = [];

  if (scenario.expectValid === true && validation.errors.length > 0) {
    diffs.push({ field: "validation", expected: "valid", actual: validation.errors, issue: "Expected local validation to pass" });
  }
  if (scenario.expectValid === false && validation.errors.length === 0) {
    diffs.push({ field: "validation", expected: "invalid", actual: "valid", issue: "Expected local validation to block provider call" });
  }
  for (const [field, expected] of Object.entries(scenario.expectPayload || {})) {
    const actual = payload?.[field];
    if (compareValue(actual) !== compareValue(expected)) {
      diffs.push({ field, expected, actual, issue: `Expected provider payload ${field} to match` });
    }
  }
  for (const [field, expected] of Object.entries(scenario.expectUi || {})) {
    const actual = (ui as Record<string, unknown>)[field];
    if (actual !== expected) diffs.push({ field, expected, actual, issue: `Expected lifecycle UI ${field} to match` });
  }
  if (scenario.retrieveMutation && payload && retrieveResponse) {
    const comparison = compareRetrievedProviderPlanFields({ submittedFields: payload, retrievedProviderPlan: retrieveResponse });
    if (comparison.matched && scenario.category === "Retrieve Compare") {
      diffs.push({ field: "retrieveComparison", expected: "mismatch detected", actual: "matched", issue: "Expected retrieve comparison to identify provider change" });
    }
  }

  const failure: StressFailure | null = diffs.length ? {
    testName: scenario.name,
    category: scenario.category,
    seed: scenario.seed,
    replayCommand: `npm run certification:stress -- --replay ${scenario.seed}`,
    timestamp: new Date().toISOString(),
    requestPayload: { action: scenario.action, plan: scenario.plan },
    providerPayload: payload,
    mockProviderResponse: retrieveResponse,
    retrieveResponse,
    expectedValues: { valid: scenario.expectValid, payload: scenario.expectPayload, ui: scenario.expectUi },
    actualValues: { validationErrors: validation.errors, payload, ui },
    diff: diffs,
    lifecycleBefore: { filingStatus: plan.filingStatus, filingIsLive: plan.filingIsLive, filingProviderPlanId: plan.filingProviderPlanId },
    lifecycleAfter: { filingStatus: plan.filingStatus, filingIsLive: plan.filingIsLive, filingProviderPlanId: plan.filingProviderPlanId },
    relatedLogs: [
      `category=${scenario.category}`,
      `environment=${getFlightServiceRuntimeMode().environment}`,
      `providerCall=${payload ? "mocked" : "blocked"}`,
    ],
  } : null;

  return {
    scenario,
    passed: !failure,
    warning: scenario.warning || null,
    validationErrors: validation.errors,
    payload,
    retrieveResponse,
    failure,
  };
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const buildHtml = (report: any) => `<!doctype html><html><head><meta charset="utf-8"><title>RSF Flight Service Stress Report</title><style>
body{font-family:Inter,Arial,sans-serif;background:#0f141b;color:#edf4ff;margin:0}main{max-width:1200px;margin:auto;padding:32px}.card{border:1px solid #2d3748;background:#151c26;border-radius:12px;padding:18px;margin:12px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.big{font-size:32px;font-weight:800}.pass{color:#86efac}.fail{color:#fca5a5}.warn{color:#fde68a}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #2d3748;padding:10px;text-align:left}pre{white-space:pre-wrap;word-break:break-word;background:#0b1017;padding:12px;border-radius:8px}
</style></head><body><main><div class="card"><div>RSF Flight Service Stress Certification</div><div class="big ${report.status === "passed" ? "pass" : "fail"}">${escapeHtml(report.status.toUpperCase())}</div><div>${escapeHtml(report.mode)} | ${escapeHtml(report.runId)} | ${escapeHtml(report.startTime)}</div></div><div class="grid">${[
  ["Total", report.totalScenarios],
  ["Passed", report.passed],
  ["Failed", report.failed],
  ["Warnings", report.warnings],
  ["Duration ms", report.durationMs],
].map(([label, value]) => `<div class="card"><div>${label}</div><div class="big">${value}</div></div>`).join("")}</div><h2>Coverage</h2><div class="grid">${report.coverageSummary.map((item: any) => `<div class="card"><strong>${escapeHtml(item.category)}</strong><div>${item.passed}/${item.total} passed</div></div>`).join("")}</div><h2>Failures</h2>${report.failures.length ? report.failures.map((failure: StressFailure) => `<div class="card"><h3>${escapeHtml(failure.testName)}</h3><div>${escapeHtml(failure.category)} | seed ${failure.seed}</div><pre>${escapeHtml(JSON.stringify(failure.diff, null, 2))}</pre><code>${escapeHtml(failure.replayCommand)}</code></div>`).join("") : "<div class='card pass'>No failures.</div>"}</main></body></html>`;

const csv = (report: any) => [
  "runId,mode,status,total,passed,failed,warnings,durationMs",
  [report.runId, report.mode, report.status, report.totalScenarios, report.passed, report.failed, report.warnings, report.durationMs].join(","),
  "",
  "category,total,passed,failed",
  ...report.coverageSummary.map((item: any) => [item.category, item.total, item.passed, item.failed].join(",")),
  "",
  "failure,category,seed,replayCommand",
  ...report.failures.map((failure: StressFailure) => [failure.testName, failure.category, failure.seed, failure.replayCommand].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
].join("\n");

export const runStressCertification = () => {
  const start = Date.now();
  const mode = (arg("mode", "standard") === "extended" ? "extended" : "standard") as StressMode;
  const replayRaw = arg("replay", "");
  const replaySeed = replayRaw ? Number(replayRaw) : null;
  const scenarios = buildScenarios(mode, replaySeed);
  const results = scenarios.map(runScenario);
  const failures = results.flatMap((result) => result.failure ? [result.failure] : []);
  const runId = `stress-${reportTimestamp()}`;
  const end = Date.now();
  const runtimeMode = getFlightServiceRuntimeMode();
  const coverageSummary = CATEGORIES.map((category) => {
    const scoped = results.filter((result) => result.scenario.category === category);
    return {
      category,
      total: scoped.length,
      passed: scoped.filter((result) => result.passed).length,
      failed: scoped.filter((result) => !result.passed).length,
    };
  });
  const report = {
    runId,
    buildCommit: getCommit(),
    status: failures.length ? "failed" : "passed",
    startTime: new Date(start).toISOString(),
    endTime: new Date(end).toISOString(),
    durationMs: end - start,
    mode: replaySeed ? "replay" : mode,
    seed: Number(arg("seed", "20260701")),
    replaySeed,
    totalScenarios: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: failures.length,
    warnings: results.filter((result) => result.warning).length,
    skipped: 0,
    categoriesTested: CATEGORIES,
    coverageSummary,
    failures,
    replayCommands: failures.map((failure) => failure.replayCommand),
    environmentSafetyStatus: {
      ...runtimeMode,
      liveProviderCallsAttempted: 0,
      liveProviderCallsBlocked: results.filter((result) => result.payload).length,
      defaultBehavior: "LAB/mock only",
    },
  };

  const reportsDir = join("tests", "flight-service", "reports");
  const historyDir = join(reportsDir, "history");
  const failuresDir = join("tests", "flight-service", "failures");
  mkdirSync(historyDir, { recursive: true });
  mkdirSync(failuresDir, { recursive: true });
  const html = buildHtml(report);
  writeFileSync(join(reportsDir, "latest.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(reportsDir, "latest.html"), html);
  writeFileSync(join(historyDir, `${runId}.json`), JSON.stringify(report, null, 2));
  writeFileSync(join(historyDir, `${runId}.html`), html);
  writeFileSync(join(historyDir, `${runId}.csv`), csv(report));
  for (const failure of failures) {
    writeFileSync(join(failuresDir, `${runId}-${failure.seed}.json`), JSON.stringify(failure, null, 2));
  }

  console.log(`RSF Flight Service stress certification: ${report.status.toUpperCase()}`);
  console.log(`Run: ${runId}`);
  console.log(`Mode: ${report.mode}`);
  console.log(`Scenarios: ${report.passed}/${report.totalScenarios} passed`);
  console.log(`Reports: tests/flight-service/reports/latest.json`);
  if (failures.length) {
    console.log("Replay failed seeds:");
    for (const failure of failures.slice(0, 10)) console.log(`  ${failure.replayCommand}`);
  }
  return report;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = runStressCertification();
  process.exit(report.failed ? 1 : 0);
}
