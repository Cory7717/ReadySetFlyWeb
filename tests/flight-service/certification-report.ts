import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCertificationScenarios } from "./scenario-generator";
import { runFlightServiceScenarios, summarizeScenarioResults, type ScenarioResult } from "./scenario-runner";

const argValue = (name: string, fallback: string) => {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

export const readCertificationArgs = () => ({
  seed: Number(argValue("seed", "20260701")),
  count: Number(argValue("count", "50")),
});

const timestamp = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
};

const severityLines = (results: ScenarioResult[]) => results
  .filter((result) => !result.passed)
  .map((result) => {
    const issues = result.mismatches.map((issue) => `  - ${issue.severity}: ${issue.field} - ${issue.issue}`).join("\n");
    const steps = result.reproductionSteps.map((step) => `  ${step}`).join("\n");
    return `### ${result.scenario.name}\n\n${result.scenario.description}\n\nIssues:\n${issues}\n\nReproduction:\n${steps}\n`;
  })
  .join("\n");

export const runCertificationReport = ({ writeReport = false }: { writeReport?: boolean } = {}) => {
  const args = readCertificationArgs();
  const scenarios = buildCertificationScenarios(args);
  const results = runFlightServiceScenarios(scenarios);
  const summary = summarizeScenarioResults(results);
  const remainingRisks = [
    "Live provider lifecycle calls remain manual/lab-gated.",
    "Visual UI items require browser screenshot evidence.",
    "Realtime provider push notification behavior requires an integration or browser harness.",
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    seed: args.seed,
    count: args.count,
    summary,
    remainingRisks,
    failures: results.filter((result) => !result.passed).map((result) => ({
      name: result.scenario.name,
      description: result.scenario.description,
      reproductionSteps: result.reproductionSteps,
      mismatches: result.mismatches,
      validationErrors: result.validationErrors,
      providerCallAttempted: result.providerCallAttempted,
      providerCallBlocked: result.providerCallBlocked,
    })),
  };

  if (writeReport) {
    const dir = join("certification-reports", "flight-service");
    mkdirSync(dir, { recursive: true });
    const stamp = timestamp();
    const jsonPath = join(dir, `${stamp}-certification-report.json`);
    const mdPath = join(dir, `${stamp}-certification-report.md`);
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    writeFileSync(mdPath, [
      "# Flight Service Certification Report",
      "",
      `Generated: ${report.generatedAt}`,
      `Seed: ${report.seed}`,
      `Random count: ${report.count}`,
      "",
      "## Summary",
      "",
      `- Total scenarios: ${summary.totalScenarios}`,
      `- Passed: ${summary.passed}`,
      `- Failed: ${summary.failed}`,
      `- Blockers: ${summary.blockers}`,
      `- Major issues: ${summary.majorIssues}`,
      `- Minor issues: ${summary.minorIssues}`,
      `- Provider calls attempted: ${summary.providerCallsAttempted}`,
      `- Provider calls blocked: ${summary.providerCallsBlocked}`,
      `- Sean feedback items covered: ${summary.seanFeedbackCoverage}`,
      "",
      "## Remaining Risks",
      "",
      ...remainingRisks.map((risk) => `- ${risk}`),
      "",
      "## Failures",
      "",
      severityLines(results) || "No failures.",
      "",
    ].join("\n"));
    return { report, jsonPath, mdPath };
  }

  return { report, jsonPath: null, mdPath: null };
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const writeReport = process.argv.includes("--write");
  const { report, jsonPath, mdPath } = runCertificationReport({ writeReport });
  console.log("Flight Service certification engine");
  console.log(`Total scenarios: ${report.summary.totalScenarios}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log(`Blockers: ${report.summary.blockers}`);
  console.log(`Major issues: ${report.summary.majorIssues}`);
  console.log(`Minor issues: ${report.summary.minorIssues}`);
  console.log(`Provider calls attempted: ${report.summary.providerCallsAttempted}`);
  console.log(`Provider calls blocked: ${report.summary.providerCallsBlocked}`);
  if (jsonPath && mdPath) {
    console.log(`JSON report: ${jsonPath}`);
    console.log(`Markdown report: ${mdPath}`);
  }
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
}
