import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import type { FlightPlan, FlightPlanFilingAction } from "../../../shared/schema";
import {
  buildLeidosActionPayload,
  flightPlanFilingProvider,
  syncLeidosPlanMetadata,
  validateFlightPlanForAction,
} from "../../../server/services/flight-plan-filing/provider";
import { buildLabScenarios, type LabScenario } from "./lab-scenarios";
import { compareLabRetrieve } from "./lab-compare";
import { formatLabSafetyFailure, getLabSafetySnapshot } from "./lab-safety";
import { writeLabReport } from "./lab-report";

const arg = (name: string, fallback = "") => {
  const flag = `--${name}`;
  const exact = process.argv.findIndex((value) => value === flag);
  if (exact >= 0 && process.argv[exact + 1]) return process.argv[exact + 1];
  const prefix = `${flag}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

const getCommit = () => {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown";
};

const payloadFor = (plan: FlightPlan, action: FlightPlanFilingAction) => {
  if (action !== "file" && action !== "amend") return null;
  return Object.fromEntries(buildLeidosActionPayload(plan, action, { otherInfo: null } as any).params.entries());
};

const withProviderState = (plan: FlightPlan, result: any): FlightPlan => ({
  ...plan,
  filingProviderPlanId: result.providerPlanId || plan.filingProviderPlanId || null,
  filingStatus: result.nextStatus || plan.filingStatus,
  filingIsLive: result.live ?? plan.filingIsLive,
  filingRaw: result.raw || plan.filingRaw,
  filingPayload: result.payloadSnapshot?.transmittedFields || plan.filingPayload,
  filingProviderSnapshot: result.providerSnapshot || plan.filingProviderSnapshot,
  filingLastProviderSyncAt: new Date(),
}) as FlightPlan;

const runScenario = async (scenario: LabScenario, runId: string) => {
  let plan = scenario.plan;
  const providerResponses: Record<string, unknown>[] = [];
  const retrieveResponses: Record<string, unknown>[] = [];
  const payloads: Record<string, unknown>[] = [];
  const diffs: any[] = [];
  let providerPlanId: string | null = null;
  let versionStamp: string | null = null;

  for (const action of scenario.actions) {
    const validation = validateFlightPlanForAction(plan, action);
    if (!validation.ready) {
      diffs.push({
        field: "validation",
        expected: "ready",
        actual: validation.errors,
        classification: "RSF_BUG",
        suggestedLikelyCause: "RSF",
        issue: `Local validation blocked ${action.toUpperCase()} before LAB call.`,
      });
      break;
    }
    const requestPayload = payloadFor(plan, action);
    if (requestPayload) payloads.push({ action, ...requestPayload });
    const providerResult = await flightPlanFilingProvider.stageAction(plan, action);
    providerResponses.push({ action, ...providerResult.raw });
    plan = withProviderState(plan, providerResult);
    providerPlanId = providerResult.providerPlanId || providerPlanId;
    versionStamp = String(providerResult.raw?.versionStamp || providerResult.providerSnapshot?.versionStamp || versionStamp || "");

    if (!providerResult.live) {
      diffs.push({
        field: "providerLive",
        expected: "accepted LAB response",
        actual: providerResult.message,
        classification: "MISMATCH",
        suggestedLikelyCause: "unclear",
        issue: `Provider action ${action.toUpperCase()} did not complete as a live LAB action.`,
      });
      break;
    }

    if (providerPlanId) {
      const retrieve = await syncLeidosPlanMetadata(plan);
      retrieveResponses.push({ action, ...retrieve });
      const latestPayload = requestPayload || (plan.filingPayload && typeof plan.filingPayload === "object" ? plan.filingPayload as Record<string, unknown> : {});
      diffs.push(...compareLabRetrieve({
        submittedFields: latestPayload,
        retrievedProviderPlan: retrieve.raw || retrieve.providerSnapshot || null,
        expectedOtherInfoIncludes: scenario.expectedOtherInfoIncludes || [],
      }));
      versionStamp = String(retrieve.versionStamp || versionStamp || "");
      plan = {
        ...plan,
        filingRaw: {
          ...(plan.filingRaw && typeof plan.filingRaw === "object" ? plan.filingRaw as Record<string, unknown> : {}),
          versionStamp,
          response: retrieve.raw || null,
        },
      } as FlightPlan;
    }
  }

  const blockingDiffs = diffs.filter((diff) => diff.classification !== "PROVIDER_NORMALIZED" && diff.classification !== "WARNING");
  return {
    scenarioId: scenario.id,
    name: scenario.name,
    category: scenario.category,
    seed: scenario.seed,
    status: blockingDiffs.length ? "failed" : "passed",
    providerPlanId,
    versionStamp,
    providerResponses,
    retrieveResponses,
    requestPayloads: payloads,
    diff: diffs,
    replayCommand: `npm run certification:leidos -- --replay ${scenario.seed}`,
    runId,
  };
};

export const runLeidosLabCertification = async () => {
  const safety = getLabSafetySnapshot();
  if (!safety.ok) {
    console.error(formatLabSafetyFailure(safety));
    process.exitCode = 2;
    return null;
  }

  const mode = arg("mode", "smoke");
  const replay = arg("replay", "");
  const runId = `leidos-lab-${stamp()}`;
  const started = Date.now();
  const scenarios = replay
    ? buildLabScenarios(runId, "extended").filter((scenario) => String(scenario.seed) === replay || scenario.id === replay)
    : buildLabScenarios(runId, mode);
  if (scenarios.length === 0) {
    throw new Error(`No Leidos LAB scenarios matched ${replay || mode}.`);
  }
  const results = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(scenario, runId));
  }
  const failures = results.filter((result) => result.status !== "passed").map((result) => ({
    runId,
    scenarioId: result.scenarioId,
    scenarioName: result.name,
    category: result.category,
    seed: result.seed,
    replayCommand: result.replayCommand,
    timestamp: new Date().toISOString(),
    environmentSafetySnapshot: safety,
    requestPayload: result.requestPayloads,
    providerPayload: result.requestPayloads.at(-1) || null,
    providerResponses: result.providerResponses,
    retrieveResponses: result.retrieveResponses,
    expectedValues: {},
    actualValues: {},
    diff: result.diff,
    classification: result.diff[0]?.classification || "MISMATCH",
    suggestedLikelyCause: result.diff[0]?.suggestedLikelyCause || "unclear",
  }));
  const completed = Date.now();
  const report = {
    runId,
    suiteType: "leidos_lab",
    providerMode: "leidos_lab",
    buildCommit: getCommit(),
    status: failures.length ? "failed" : "passed",
    labEndpointConfirmation: safety.labEndpointConfirmed,
    productionDisabledConfirmation: safety.productionFilingDisabled,
    environmentSafety: safety,
    mode: replay ? "replay" : mode,
    startTime: new Date(started).toISOString(),
    endTime: new Date(completed).toISOString(),
    durationMs: completed - started,
    totalScenarios: results.length,
    passed: results.filter((result) => result.status === "passed").length,
    failed: failures.length,
    warnings: results.flatMap((result) => result.diff).filter((diff) => diff.classification === "WARNING").length,
    providerNormalized: results.flatMap((result) => result.diff).filter((diff) => diff.classification === "PROVIDER_NORMALIZED").length,
    needsLeidosClarification: results.flatMap((result) => result.diff).filter((diff) => diff.classification === "NEEDS_LEIDOS_CLARIFICATION").length,
    scenarioCategoryCoverage: Array.from(new Set(results.map((result) => result.category))),
    providerPlanIds: results.map((result) => result.providerPlanId).filter(Boolean),
    versionStamps: results.map((result) => result.versionStamp).filter(Boolean),
    scenarios: results,
    failures,
    replayCommands: failures.map((failure) => failure.replayCommand),
  };
  writeLabReport(report);
  console.log("RSF Leidos LAB Certification");
  console.log(`Environment: Leidos LAB`);
  console.log(`Production Filing: Disabled`);
  console.log(`Certification Mode: Enabled`);
  console.log(`Provider Calls: Real LAB`);
  console.log(`Run: ${runId}`);
  console.log(`Status: ${report.status}`);
  console.log(`Scenarios: ${report.passed}/${report.totalScenarios} passed`);
  return report;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runLeidosLabCertification()
    .then((report) => {
      if (!report) return;
      process.exit(report.failed ? 1 : 0);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
