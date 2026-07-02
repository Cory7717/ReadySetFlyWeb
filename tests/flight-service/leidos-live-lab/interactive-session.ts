import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { FlightPlan, FlightPlanFilingAction } from "../../../shared/schema";
import {
  appendCertificationAudit,
  assertLabEndpoint,
  boolEnv,
  buildCases,
  compareGeneratedSentReturned,
  getVersionStamp,
  isCleanupBlockingError,
  loadCertificationPlansForRun,
  loadDedicatedTestContext,
  MAX_CASES,
  persistCertificationPlan,
  simulateDryRunProviderState,
  sleep,
  summarizePayload,
  updateCertificationPlan,
  type LiveLabCase,
} from "./live-lab-runner";
import {
  flightPlanFilingProvider,
  validateFlightPlanForAction,
} from "../../../server/services/flight-plan-filing/provider";

type SessionState = {
  certificationRunId: string;
  dryRun: boolean;
  delayMinutes: number;
  replaySeed?: string | null;
  completedCaseIds: string[];
  skippedCaseIds: string[];
  failedCaseIds: string[];
  createdPlanIds: string[];
  status: "created" | "running" | "paused" | "aborted" | "cleanup" | "complete";
  updatedAt: string;
};

const RESULT_DIR = join("certification-results", "leidos-live-lab");
const SESSION_DIR = join(RESULT_DIR, "sessions");
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
const arg = (name: string, fallback = "") => {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")) return process.argv[index + 1];
  const prefixed = process.argv.find((value) => value.startsWith(`${flag}=`));
  return prefixed ? prefixed.slice(flag.length + 1) : fallback;
};
const hasFlag = (name: string) => process.argv.includes(`--${name}`);
const numberArg = (name: string, fallback: string) => {
  const parsed = Number(arg(name, fallback));
  return Number.isFinite(parsed) ? parsed : Number(fallback);
};

const rl = readline.createInterface({ input, output });

const ask = async (question: string) => (await rl.question(question)).trim();
const askChoice = async (question: string, valid: string[]) => {
  const allowed = new Set(valid.map((item) => item.toLowerCase()));
  while (true) {
    const answer = (await ask(question)).toLowerCase();
    if (allowed.has(answer)) return answer;
    console.log(`Enter one of: ${valid.join(", ")}`);
  }
};

const saveSessionState = (state: SessionState) => {
  mkdirSync(SESSION_DIR, { recursive: true });
  const next = { ...state, updatedAt: new Date().toISOString() };
  writeFileSync(join(SESSION_DIR, `${state.certificationRunId}.json`), JSON.stringify(next, null, 2));
  return next;
};

const loadLatestSession = (): SessionState | null => {
  if (!existsSync(SESSION_DIR)) return null;
  const files = readdirSync(SESSION_DIR).filter((file) => file.endsWith(".json")).sort().reverse();
  for (const file of files) {
    const state = JSON.parse(readFileSync(join(SESSION_DIR, file), "utf8")) as SessionState;
    if (!["complete", "aborted"].includes(state.status)) return state;
  }
  return null;
};

const latestResult = (): any | null => {
  if (!existsSync(RESULT_DIR)) return null;
  const files = readdirSync(RESULT_DIR)
    .filter((file) => file.endsWith(".json") && !file.includes("-cleanup-"))
    .sort()
    .reverse();
  if (!files[0]) return null;
  return JSON.parse(readFileSync(join(RESULT_DIR, files[0]), "utf8"));
};

const caseId = (testCase: LiveLabCase) => `case-${String(testCase.seed).padStart(2, "0")}`;

const printBanner = (context: Awaited<ReturnType<typeof loadDedicatedTestContext>>, diagnostics: ReturnType<typeof assertLabEndpoint>, cases: LiveLabCase[], delayMinutes: number) => {
  console.log("=========================================================");
  console.log("READY SET FLY");
  console.log("Leidos Flight Service Certification Session");
  console.log(`Environment: ${String(diagnostics.environment || "LAB").toUpperCase()}`);
  console.log(`Operator: ${context.user.email || process.env.LEIDOS_TEST_USER_EMAIL || "-"}`);
  console.log(`Cases: ${cases.length}`);
  console.log(`Delay Between Cases: ${delayMinutes} minutes`);
  console.log("=========================================================");
  console.log("");
  cases.forEach((item, index) => {
    console.log(`${index + 1}. ${item.name} (${item.actions.length ? item.actions.join(" -> ").toUpperCase() : "SKIP"})`);
  });
  console.log("");
};

const printCaseHeader = (testCase: LiveLabCase, plan: FlightPlan, action: FlightPlanFilingAction, index: number, total: number) => {
  console.log("---------------------------------------------------------");
  console.log(`Case ${index + 1} of ${total}`);
  console.log("");
  console.log(testCase.name);
  console.log(`Seed: ${testCase.seed}`);
  console.log("");
  console.log("Aircraft:");
  console.log(plan.tailNumber || "-");
  console.log("");
  console.log("Departure:");
  console.log(plan.departure || "-");
  console.log("");
  console.log("Destination:");
  console.log(plan.destination || "-");
  console.log("");
  console.log("Planned Action:");
  console.log(action.toUpperCase());
  console.log("");
  console.log("Expected Result:");
  console.log("Flight accepted");
  console.log("Provider Plan ID returned");
  console.log("VersionStamp returned");
  console.log("---------------------------------------------------------");
};

const printPayloadReview = (payload: Record<string, any> | null, plan: FlightPlan) => {
  console.log("");
  console.log("RSF Generated Payload");
  console.log("---------------------");
  console.log(`Flight Rules: ${payload?.flightRules || plan.filingFlightRules || "-"}`);
  console.log(`Departure: ${payload?.departure || plan.departure || "-"}`);
  console.log(`Destination: ${payload?.destination || plan.destination || "-"}`);
  console.log(`Alternate: ${payload?.altDestination1 || plan.alternate || "-"}`);
  console.log(`Equipment: ${payload?.aircraftEquipment || plan.filingEquipment || "-"}`);
  console.log(`PBN: ${String(payload?.otherInfo || "").match(/(?:^|\s)(PBN\/[^\s]+)/i)?.[1] || "-"}`);
  console.log(`Other Info: ${payload?.otherInfo || plan.filingOtherInfo || "-"}`);
  console.log(`Pilot Phone: ${payload?.pilotPhone || plan.filingPilotPhone || "-"}`);
  console.log(`Home Base: ${payload?.aircraftHomeBase || plan.filingAircraftHomeBase || "-"}`);
  console.log(`Departure Time: ${(plan.plannerState as any)?.userDisplayDepartureTimeLocal || plan.plannedDepartureAt || "-"}`);
  console.log(`Zulu Time: ${payload?.departureInstant || "-"}`);
  console.log("");
};

const waitBetweenCases = async (delayMinutes: number) => {
  const seconds = Math.round(delayMinutes * 60);
  if (seconds <= 0) return "next";
  console.log(`Waiting ${seconds} seconds before next certification case...`);
  const normalized = await askChoice("[N] Run Next Now  [S] Skip Delay  [P] Pause Session  [Q] Abort Session  [W] Wait: ", ["n", "s", "p", "q", "w", ""]);
  if (normalized === "q") return "abort";
  if (normalized === "p") {
    await ask("Session paused. Press Enter to resume, or Ctrl+C to abort.");
    return "next";
  }
  if (normalized === "n" || normalized === "s") return "next";
  for (let remaining = seconds; remaining > 0; remaining -= 1) {
    process.stdout.write(`\r${remaining}   `);
    await sleep(1000);
  }
  process.stdout.write("\n");
  return "next";
};

const ensureLiveSafety = (dryRun: boolean, diagnostics: ReturnType<typeof assertLabEndpoint>) => {
  if (dryRun) return;
  if (!hasFlag("confirm-leidos-lab")) throw new Error("Refusing live session: --confirm-leidos-lab is required.");
  if (!boolEnv(process.env.LEIDOS_LAB_TEST_ENABLED)) throw new Error("Refusing live session: LEIDOS_LAB_TEST_ENABLED=true is required.");
  if (boolEnv(process.env.FLIGHT_SERVICE_OPERATIONAL_FILING_ENABLED || process.env.FLIGHT_FILING_OPERATIONAL_ENABLED)) {
    throw new Error("Refusing live session: operational filing flag is enabled.");
  }
  const endpoint = String(diagnostics.baseUrl || "").toLowerCase();
  if (endpoint.includes("lmfsweb.afss.com") || endpoint.includes("production") || endpoint.includes("prod")) {
    throw new Error(`Refusing live session: production-like endpoint detected (${diagnostics.baseUrl}).`);
  }
};

const executeAction = async (plan: FlightPlan, action: FlightPlanFilingAction, testCase: LiveLabCase, dryRun: boolean) => {
  const started = Date.now();
  const validation = validateFlightPlanForAction(plan, action);
  const generatedPayload = summarizePayload(plan, action) as Record<string, any> | null;
  if (!validation.ready) {
    const actionResult = { action, generatedPayload, payloadSentToLeidos: null, leidosResponse: null, responseStatus: "validation_failed", warnings: validation.warnings, errors: validation.errors, elapsedMs: Date.now() - started };
    const updated = await appendCertificationAudit(plan, "action", actionResult, dryRun);
    return { plan: updated, actionResult, pass: false, blocking: false };
  }

  if (dryRun) {
    const simulated = simulateDryRunProviderState(plan, action, testCase.seed);
    const comparison = compareGeneratedSentReturned(generatedPayload, generatedPayload, simulated);
    const actionResult = { action, generatedPayload, payloadSentToLeidos: generatedPayload, leidosResponse: { dryRun: true }, responseStatus: "dry_run", providerPlanId: simulated.filingProviderPlanId, versionStamp: getVersionStamp(simulated), warnings: validation.warnings, errors: [], comparison, elapsedMs: Date.now() - started };
    const updated = await appendCertificationAudit(simulated, "action", actionResult, dryRun);
    return { plan: updated, actionResult, pass: true, blocking: false };
  }

  try {
    const response = await flightPlanFilingProvider.stageAction(plan, action);
    let updated = {
      ...plan,
      filingProviderPlanId: response.providerPlanId || plan.filingProviderPlanId,
      filingStatus: response.nextStatus,
      filingIsLive: response.live,
      filingRaw: response.raw,
      filingPayload: response.payloadSnapshot?.transmittedFields || plan.filingPayload,
      filingProviderSnapshot: response.providerSnapshot || plan.filingProviderSnapshot,
      filingProviderMessages: response.providerMessages || plan.filingProviderMessages,
    } as FlightPlan;
    updated = await updateCertificationPlan(updated, {
      filingProviderPlanId: updated.filingProviderPlanId,
      filingStatus: updated.filingStatus,
      filingIsLive: updated.filingIsLive,
      filingRaw: updated.filingRaw,
      filingPayload: updated.filingPayload,
      filingProviderSnapshot: updated.filingProviderSnapshot,
      filingProviderMessages: updated.filingProviderMessages,
      filedAt: action === "file" ? new Date() : updated.filedAt,
      activatedAt: action === "activate" ? new Date() : updated.activatedAt,
      cancelledAt: action === "cancel" ? new Date() : updated.cancelledAt,
      closedAt: action === "close" ? new Date() : updated.closedAt,
    } as any, dryRun);
    const sentPayload = response.raw?.requestPayload || response.payloadSnapshot?.transmittedFields || null;
    const comparison = compareGeneratedSentReturned(generatedPayload, sentPayload, updated);
    const actionResult = {
      action,
      generatedPayload,
      payloadSentToLeidos: sentPayload,
      leidosResponse: response.raw?.response || response.raw || null,
      responseStatus: response.live ? "accepted" : "staged",
      providerPlanId: response.providerPlanId || null,
      versionStamp: String(response.raw?.versionStamp || response.providerSnapshot?.versionStamp || ""),
      warnings: response.warnings || [],
      errors: response.live ? [] : [response.message],
      comparison,
      elapsedMs: Date.now() - started,
    };
    updated = await appendCertificationAudit(updated, "action", actionResult, dryRun);
    return { plan: updated, actionResult, pass: response.live, blocking: false };
  } catch (error) {
    const message = String((error as any)?.message || error);
    const actionResult = { action, generatedPayload, payloadSentToLeidos: null, leidosResponse: null, responseStatus: "error", warnings: validation.warnings, errors: [message], elapsedMs: Date.now() - started };
    const updated = await appendCertificationAudit(plan, "action", actionResult, dryRun);
    return { plan: updated, actionResult, pass: false, blocking: isCleanupBlockingError(error) };
  }
};

const promptedCleanup = async (plans: FlightPlan[], dryRun: boolean) => {
  const results: any[] = [];
  console.log("");
  console.log("Certification run complete.");
  console.log(`${plans.length} plans created.`);
  console.log("Beginning cleanup verification.");
  for (const plan of plans) {
    const status = String(plan.filingStatus || "").toLowerCase();
    const action: FlightPlanFilingAction | null = status === "activated" ? "close" : ["filed", "staged", "proposed", "amended"].includes(status) ? "cancel" : null;
    if (!action) {
      results.push({ planId: plan.id, status: plan.filingStatus, responseStatus: ["cancelled", "closed"].includes(status) ? "already_terminal" : "not_required", pass: true });
      continue;
    }
    const prompt = action === "close" ? "Close this plan? [Y/N] " : "Cancel this plan? [Y/N] ";
    const answer = await askChoice(`${plan.title} (${plan.filingStatus}) ${prompt}`, ["y", "n", "q"]);
    if (answer === "q") {
      results.push({ planId: plan.id, action, responseStatus: "cleanup_aborted_by_operator", pass: false });
      break;
    }
    if (answer !== "y") {
      results.push({ planId: plan.id, action, responseStatus: "cleanup_skipped_by_operator", pass: false });
      continue;
    }
    const result = await executeAction(plan, action, { seed: Number(plan.certificationSeed || 0), name: String(plan.certificationCaseName || "cleanup"), actions: [action], buildPlan: () => plan }, dryRun);
    results.push({ planId: result.plan.id, action, responseStatus: result.actionResult.responseStatus, providerPlanId: result.plan.filingProviderPlanId || null, versionStamp: getVersionStamp(result.plan), pass: result.pass, errors: result.actionResult.errors || [], elapsedMs: result.actionResult.elapsedMs });
  }
  return results;
};

const saveReport = (report: Record<string, unknown>) => {
  mkdirSync(RESULT_DIR, { recursive: true });
  const runId = String(report.certificationRunId || `leidos-session-${stamp()}`);
  const filePath = join(RESULT_DIR, `${runId}.json`);
  writeFileSync(filePath, JSON.stringify(report, null, 2));
  writeFileSync(join(RESULT_DIR, "latest-session.json"), JSON.stringify(report, null, 2));
  return filePath;
};

const runSession = async () => {
  const diagnostics = assertLabEndpoint();
  const cliDryRun = hasFlag("dry-run") || !hasFlag("confirm-leidos-lab");
  const delayMinutes = Math.max(0, numberArg("delay-minutes", process.env.LEIDOS_LAB_DELAY_MINUTES || "3"));
  const limit = Math.min(MAX_CASES, Math.max(1, numberArg("limit", "15") || 15));
  const context = await loadDedicatedTestContext();
  const initialRunId = `leidos-session-${stamp()}`;
  let dryRun = cliDryRun;
  let replaySeed = arg("replay", "");
  let state: SessionState = {
    certificationRunId: initialRunId,
    dryRun,
    delayMinutes,
    replaySeed: replaySeed || null,
    completedCaseIds: [],
    skippedCaseIds: [],
    failedCaseIds: [],
    createdPlanIds: [],
    status: "created",
    updatedAt: new Date().toISOString(),
  };
  let cases = buildCases(context, state.certificationRunId).slice(0, limit);

  printBanner(context, diagnostics, cases, delayMinutes);
  const menuChoice = await askChoice("[1] Start Session  [2] Resume Previous Session  [3] Replay Failed Case  [4] Dry Run  [Q] Abort: ", ["1", "2", "3", "4", "q"]);
  if (menuChoice === "q") return;
  if (menuChoice === "2") {
    const previous = loadLatestSession();
    if (!previous) throw new Error("No resumable certification session was found.");
    state = previous;
    dryRun = previous.dryRun;
    cases = buildCases(context, state.certificationRunId).slice(0, limit);
  }
  if (menuChoice === "3") {
    const report = latestResult();
    const failed = (report?.results || []).filter((item: any) => item.pass === false);
    if (failed.length === 0) throw new Error("No failed case found in the latest certification report.");
    failed.forEach((item: any, index: number) => console.log(`${index + 1}. ${item.testName} seed=${item.seed}`));
    const selected = Number(await ask("Replay failed case number: "));
    const target = failed[selected - 1];
    if (!target) throw new Error("Invalid failed case selection.");
    replaySeed = String(target.seed);
    state.replaySeed = replaySeed;
    cases = buildCases(context, state.certificationRunId).filter((item) => String(item.seed) === replaySeed);
  }
  if (menuChoice === "4") {
    dryRun = true;
    state.dryRun = true;
  }

  ensureLiveSafety(dryRun, diagnostics);
  state.status = "running";
  state = saveSessionState(state);

  const results: any[] = [];
  const createdPlans: FlightPlan[] = [];
  for (const [index, testCase] of cases.entries()) {
    const id = caseId(testCase);
    if (state.completedCaseIds.includes(id) || state.skippedCaseIds.includes(id)) continue;
    let plan = await persistCertificationPlan(testCase.buildPlan(), state.certificationRunId, testCase, dryRun);
    createdPlans.push(plan);
    state.createdPlanIds = Array.from(new Set([...state.createdPlanIds, plan.id]));
    state = saveSessionState(state);

    const caseResult = { certificationRunId: state.certificationRunId, certificationCaseId: id, planId: plan.id, testName: testCase.name, seed: testCase.seed, actions: [] as any[], comparisons: [] as any[], pass: true, skipped: false, warnings: [] as string[], errors: [] as string[] };
    if (testCase.skipReason) {
      console.log(`Skipping ${testCase.name}: ${testCase.skipReason}`);
      caseResult.skipped = true;
      caseResult.warnings.push(testCase.skipReason);
      state.skippedCaseIds.push(id);
      results.push(caseResult);
      state = saveSessionState(state);
      continue;
    }

    for (const action of testCase.actions) {
      while (true) {
        printCaseHeader(testCase, plan, action, index, cases.length);
        const choice = await askChoice("[Y] Run Test  [S] Skip Test  [R] Review Payload  [Q] Abort Session: ", ["y", "s", "r", "q"]);
        if (choice === "q") {
          state.status = "aborted";
          saveSessionState(state);
          throw new Error("Certification session aborted by operator.");
        }
        if (choice === "s") {
          caseResult.skipped = true;
          caseResult.warnings.push(`Operator skipped ${action.toUpperCase()}.`);
          break;
        }
        if (choice === "r") {
          printPayloadReview(summarizePayload(plan, action) as Record<string, any> | null, plan);
          continue;
        }
        console.log(`Sending ${action.toUpperCase()}...`);
        const result = await executeAction(plan, action, testCase, dryRun);
        plan = result.plan;
        caseResult.actions.push(result.actionResult);
        if (result.actionResult.comparison) caseResult.comparisons.push(result.actionResult.comparison);
        console.log(result.pass ? "PASS" : "FAILED");
        console.log(`ProviderPlanId: ${plan.filingProviderPlanId || "-"}`);
        console.log(`VersionStamp: ${getVersionStamp(plan) || "-"}`);
        console.log(`Warnings: ${(result.actionResult.warnings || []).join(" | ") || "-"}`);
        console.log(`Elapsed Time: ${result.actionResult.elapsedMs}ms`);
        if (!result.pass) {
          caseResult.pass = false;
          caseResult.errors.push(...(result.actionResult.errors || []));
          if (result.blocking) {
            state.failedCaseIds.push(id);
            results.push(caseResult);
            state = saveSessionState(state);
            throw new Error(`Blocking provider/session failure: ${caseResult.errors.join(" | ")}`);
          }
        }
        break;
      }
      if (caseResult.skipped || !caseResult.pass) break;
    }

    if (caseResult.skipped) state.skippedCaseIds.push(id);
    else if (caseResult.pass) state.completedCaseIds.push(id);
    else state.failedCaseIds.push(id);
    results.push(caseResult);
    const createdIndex = createdPlans.findIndex((item) => item.id === plan.id);
    if (createdIndex >= 0) createdPlans[createdIndex] = plan;
    state = saveSessionState(state);

    if (!caseResult.pass) break;
    if (index < cases.length - 1) {
      const delayResult = await waitBetweenCases(delayMinutes);
      if (delayResult === "abort") {
        state.status = "aborted";
        saveSessionState(state);
        throw new Error("Certification session aborted during delay.");
      }
    }
  }

  state.status = "cleanup";
  state = saveSessionState(state);
  const cleanupPlans = dryRun ? createdPlans : await loadCertificationPlansForRun(state.certificationRunId);
  const cleanupResults = await promptedCleanup(cleanupPlans, dryRun);
  state.status = cleanupResults.some((item) => item.pass === false) ? "paused" : "complete";
  state = saveSessionState(state);

  const report = {
    certificationRunId: state.certificationRunId,
    mode: "interactive-session",
    dryRun,
    environment: diagnostics.environment,
    endpoint: diagnostics.baseUrl,
    operator: context.user.email || process.env.LEIDOS_TEST_USER_EMAIL,
    delayMinutes,
    totalCases: results.length,
    passed: results.filter((item) => item.pass).length,
    failed: results.filter((item) => !item.pass).length,
    skipped: results.filter((item) => item.skipped).length,
    results,
    cleanupResults,
    finalSummary: {
      cleanupTotal: cleanupResults.length,
      cleanupPassed: cleanupResults.filter((item) => item.pass !== false).length,
      cleanupFailed: cleanupResults.filter((item) => item.pass === false).length,
      noActiveCertificationPlansLeft: cleanupResults.every((item) => item.pass !== false),
    },
    createdAt: new Date().toISOString(),
  };
  const reportPath = saveReport(report);
  console.log(`Saved session report: ${reportPath}`);
  if (report.failed > 0 || report.finalSummary.cleanupFailed > 0) process.exitCode = dryRun ? 0 : 1;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runSession()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => rl.close());
}
