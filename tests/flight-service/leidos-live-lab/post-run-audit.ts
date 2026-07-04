import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildCertificationVersion,
  buildCleanupSummary,
  buildCleanupVerification,
  buildReadinessAssessment,
  buildRoundTripSummary,
  buildValidationSummary,
  compareGeneratedSentReturned,
  loadCertificationPlansForRun,
  writeCertificationArtifacts,
} from "./live-lab-runner";

const RESULT_DIR = join("certification-results", "leidos-live-lab");

const arg = (name: string, fallback = "") => {
  const flag = `--${name}`;
  if (process.argv.includes(flag) && !process.argv[process.argv.indexOf(flag) + 1]?.startsWith("--")) {
    return process.argv[process.argv.indexOf(flag) + 1];
  }
  const prefixed = process.argv.find((value) => value.startsWith(`${flag}=`));
  return prefixed ? prefixed.slice(flag.length + 1) : fallback;
};

const latestRunFile = () => {
  if (!existsSync(RESULT_DIR)) return null;
  const files = readdirSync(RESULT_DIR)
    .filter((file) => file.endsWith(".json") && !file.includes("-cleanup-") && !file.includes("-post-run-audit") && file !== "latest-session.json")
    .map((file) => ({ file, path: join(RESULT_DIR, file), mtime: readFileSync(join(RESULT_DIR, file)).byteLength }))
    .sort((a, b) => a.file.localeCompare(b.file));
  return files.at(-1)?.path || null;
};

const loadReport = () => {
  const runId = arg("run-id") || arg("certificationRunId");
  const file = arg("file") || (runId ? join(RESULT_DIR, `${runId}.json`) : latestRunFile());
  if (!file || !existsSync(file)) {
    throw new Error("No certification report found. Pass --run-id <certificationRunId> or run certification:leidos-live-lab first.");
  }
  return { file, report: JSON.parse(readFileSync(file, "utf8")) };
};

const statusTransitionAudit = (actions: any[]) => {
  const statuses = actions.map((action) => ({
    action: action.action,
    responseStatus: action.responseStatus,
    providerLifecycle: action.providerLifecycle || null,
    providerPlanId: action.providerPlanId || null,
    versionStamp: action.versionStamp || null,
  }));
  const providerPlanIds = Array.from(new Set(statuses.map((item) => item.providerPlanId).filter(Boolean)));
  const versionStamps = statuses.map((item) => item.versionStamp).filter(Boolean);
  return {
    statuses,
    providerPlanIdContinuity: providerPlanIds.length <= 1 ? "PASS" : "FAIL",
    versionStampContinuity: versionStamps.length <= 1 || new Set(versionStamps).size > 1 ? "PASS" : "FAIL",
    hasAmend: statuses.some((item) => item.action === "amend"),
    hasActivation: statuses.some((item) => item.action === "activate"),
    hasClose: statuses.some((item) => item.action === "close"),
    hasCancel: statuses.some((item) => item.action === "cancel"),
  };
};

const run = async () => {
  const { file, report } = loadReport();
  const runId = String(report.certificationRunId || "").trim();
  if (!runId) throw new Error(`Report ${file} is missing certificationRunId.`);

  const storedPlans = await loadCertificationPlansForRun(runId);
  const storedByCase = new Map(storedPlans.map((plan: any) => [String(plan.certificationCaseId || ""), plan]));
  const auditResults = (report.results || []).map((caseResult: any) => {
    const storedPlan = storedByCase.get(String(caseResult.certificationCaseId || ""));
    const actionAudits = (caseResult.actions || []).map((action: any) => {
      if (!storedPlan || action.blockedBeforeLeidos) {
        return {
          action: action.action,
          auditStatus: action.blockedBeforeLeidos ? "BLOCKED_BEFORE_PROVIDER" : "NO_STORED_PLAN",
          comparison: action.comparison || null,
        };
      }
      const comparison = compareGeneratedSentReturned(
        action.generatedPayload || null,
        action.providerPayload || action.payloadSentToLeidos || null,
        storedPlan,
      );
      return {
        action: action.action,
        auditStatus: comparison.pass ? "PASS" : "FAIL",
        generatedPayload: action.generatedPayload || null,
        providerPayload: action.providerPayload || action.payloadSentToLeidos || null,
        storedPayload: comparison.stored,
        comparison,
        comparisonResult: comparison.pass ? "MATCH" : "DIFFERENCE",
        fieldComparisons: comparison.fieldComparisons,
      };
    });
    const lifecycle = statusTransitionAudit(caseResult.actions || []);
    return {
      certificationCaseId: caseResult.certificationCaseId,
      testName: caseResult.testName,
      testType: caseResult.testType,
      storedPlanFound: Boolean(storedPlan),
      lifecycle,
      pass: actionAudits.every((item: any) => ["PASS", "BLOCKED_BEFORE_PROVIDER"].includes(item.auditStatus))
        && lifecycle.providerPlanIdContinuity === "PASS"
        && lifecycle.versionStampContinuity === "PASS",
      actionAudits,
    };
  });

  const validationSummary = buildValidationSummary(report.results || [], []);
  const cleanupSummary = buildCleanupSummary(report.cleanupResults || [], report.results || []);
  const cleanupVerification = buildCleanupVerification(report.cleanupResults || [], report.results || []);
  const providerRoundTrip = buildRoundTripSummary(report.results || []);
  const certificationVersion = {
    ...(report.certificationVersion || {}),
    postRunAuditGeneratedTimestamp: new Date().toISOString(),
    auditSourceReport: file,
    ...buildCertificationVersion(),
  };
  const readinessAssessment = buildReadinessAssessment(validationSummary, cleanupSummary, cleanupVerification, providerRoundTrip);
  const failedAudits = auditResults.filter((item: any) => !item.pass);
  const output = {
    ...report,
    mode: "post-run-audit",
    sourceReport: file,
    postRunAudit: {
      certificationRunId: runId,
      storedPlansLoaded: storedPlans.length,
      auditedCases: auditResults.length,
      passed: auditResults.length - failedAudits.length,
      failed: failedAudits.length,
      result: failedAudits.length === 0 ? "PASS" : "FAIL",
      auditResults,
    },
    cleanupSummary,
    cleanupVerification,
    validationSummary,
    providerRoundTrip,
    certificationVersion,
    readinessAssessment: {
      ...readinessAssessment,
      overallStatus: failedAudits.length === 0 && readinessAssessment.criticalFailures === 0
        ? readinessAssessment.overallStatus
        : "NOT READY FOR LEIDOS LAB EXECUTION",
    },
    finalSummary: {
      ...(report.finalSummary || {}),
      postRunAudit: failedAudits.length === 0 ? "PASS" : "FAIL",
      finalResult: failedAudits.length === 0 && readinessAssessment.criticalFailures === 0
        ? readinessAssessment.overallStatus
        : "NOT READY FOR LEIDOS LAB EXECUTION",
    },
  };

  mkdirSync(RESULT_DIR, { recursive: true });
  const auditPath = join(RESULT_DIR, `${runId}-post-run-audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const artifacts = await writeCertificationArtifacts(output, auditPath);
  console.log("Post-Run Audit");
  console.log("--------------");
  console.log(`Run: ${runId}`);
  console.log(`Stored Plans Loaded: ${storedPlans.length}`);
  console.log(`Audited Cases: ${auditResults.length}`);
  console.log(`PASS/FAIL: ${output.postRunAudit.result}`);
  console.log(`JSON: ${artifacts.jsonPath}`);
  console.log(`HTML: ${artifacts.htmlPath}`);
  console.log(`PDF: ${artifacts.pdfPath}`);
  if (failedAudits.length > 0) process.exitCode = 1;
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
