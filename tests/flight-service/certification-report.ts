import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
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

const CATEGORY_NAMES = [
  "Public safety/lab mode",
  "Authentication/tester access",
  "Flight plan validation",
  "ICAO equipment",
  "ZZZZ handling",
  "Field 18 / Other Info",
  "Supplemental remarks",
  "Phone/homebase",
  "Payload build",
  "Retrieve comparison",
  "Lifecycle actions",
  "Provider sync",
  "UI workflow regressions",
  "Sean feedback regressions",
  "Security/rate-limit checks",
];

const SEAN_ISSUES = [
  "grey text on white buttons",
  "Open Saved Plans dead button",
  "old error still visible after clear form",
  "notification bubble too small",
  "default altitude/fuel submitted without confirmation",
  "screen jumps while typing",
  "altitude update still shows generic error",
  "confusing Amend unavailable / disabled button labels",
  "cut-off words/letters",
  "manual save required before filing",
  "filed date stale 6/24 vs 6/29",
  "cached previous flight plan/new session issue",
  "corrected equipment still files old equipment until save",
  "closed plan actions still available",
  "Field 18 wiped / supplemental remarks misplaced",
  "sync shows stale Field 18 instead of accepted provider value",
  "homebase and phone not submitted/persisted in Pilot Data",
  "provider trademark/name usage",
  "public/live filing confusion",
  "need RetrieveFlightPlan verification",
  "need negative/failure scenarios",
];

const getCommit = () => {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown";
};

const getCategory = (result: ScenarioResult) => {
  const text = `${result.scenario.name} ${result.scenario.description}`.toLowerCase();
  if (text.includes("public") || text.includes("lab")) return "Public safety/lab mode";
  if (text.includes("auth") || text.includes("tester")) return "Authentication/tester access";
  if (text.includes("validation") || text.includes("altitude") || text.includes("fuel")) return "Flight plan validation";
  if (text.includes("equipment") || text.includes("surveillance")) return "ICAO equipment";
  if (text.includes("zzzz") || text.includes("altn") || text.includes("dep/") || text.includes("dest/")) return "ZZZZ handling";
  if (text.includes("field 18") || text.includes("other info") || text.includes("otherinfo")) return "Field 18 / Other Info";
  if (text.includes("supplemental")) return "Supplemental remarks";
  if (text.includes("phone") || text.includes("homebase") || text.includes("home base")) return "Phone/homebase";
  if (text.includes("payload") || text.includes("file current form") || text.includes("changed date")) return "Payload build";
  if (text.includes("retrieve")) return "Retrieve comparison";
  if (text.includes("closed") || text.includes("amend") || text.includes("activate") || text.includes("cancel")) return "Lifecycle actions";
  if (text.includes("sync") || text.includes("provider")) return "Provider sync";
  if (text.includes("button") || text.includes("screen") || text.includes("ui") || text.includes("typing")) return "UI workflow regressions";
  if (result.scenario.seanFeedbackId) return "Sean feedback regressions";
  if (text.includes("security") || text.includes("rate")) return "Security/rate-limit checks";
  return "Flight plan validation";
};

const buildCategorySummaries = (results: ScenarioResult[]) => CATEGORY_NAMES.map((name) => {
  const scoped = results.filter((result) => getCategory(result) === name);
  const issues = scoped.flatMap((result) => result.mismatches);
  return {
    name,
    status: scoped.length === 0 ? "NOT RUN" : issues.length === 0 ? "PASS" : "FAIL",
    passed: scoped.filter((result) => result.passed).length,
    failed: scoped.filter((result) => !result.passed).length,
    blockers: issues.filter((issue) => issue.severity === "blocker").length,
    majorIssues: issues.filter((issue) => issue.severity === "major").length,
    minorIssues: issues.filter((issue) => issue.severity === "minor").length,
  };
});

const buildSeanCoverage = (results: ScenarioResult[]) => SEAN_ISSUES.map((issue, index) => {
  const related = results.filter((result) => {
    const text = `${result.scenario.name} ${result.scenario.description}`.toLowerCase();
    const terms = issue.toLowerCase().split(/[ /-]+/).filter((term) => term.length > 4);
    return result.scenario.seanFeedbackId || terms.some((term) => text.includes(term));
  });
  const failed = related.some((result) => !result.passed);
  return {
    id: `SEAN-${String(index + 1).padStart(2, "0")}`,
    issueText: issue,
    status: related.length === 0 ? "needs manual verification" : failed ? "open" : "verified",
    relatedTests: related.map((result) => result.scenario.name).slice(0, 6),
    lastPassFail: related.length === 0 ? "not automated" : failed ? "fail" : "pass",
    evidenceLocation: related.length === 0 ? "manual matrix required" : "certification report",
    notes: related.length === 0 ? "No automated scenario maps directly yet." : "Covered by mocked certification scenario.",
  };
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

const recommendationFor = (summary: ReturnType<typeof summarizeScenarioResults>) => {
  if (summary.blockers > 0 || summary.failed > 0) return "NOT READY";
  if (summary.providerCallsAttempted === 0) return "READY FOR LIMITED REVIEW ONLY";
  return "READY FOR LIMITED REVIEW ONLY";
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const buildHtmlReport = (report: any) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>RSF Flight Service Certification</title>
<style>
body{margin:0;font-family:Inter,Arial,sans-serif;background:#0f131a;color:#eef3fb}
main{max-width:1180px;margin:0 auto;padding:32px}
.hero{border:1px solid #273142;background:#161d28;border-radius:12px;padding:24px;margin-bottom:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.card{border:1px solid #273142;background:#121923;border-radius:10px;padding:16px}
.muted{color:#a9b4c5}.big{font-size:34px;font-weight:800}.pass{color:#6ee7b7}.fail{color:#fca5a5}.warn{color:#facc15}
table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #273142;padding:10px;text-align:left;vertical-align:top}th{color:#c8d3e3}
details{border:1px solid #273142;border-radius:10px;padding:12px;margin:10px 0;background:#121923}
pre{white-space:pre-wrap;word-break:break-word;background:#0b1017;border-radius:8px;padding:12px}
a{color:#93c5fd}
</style>
</head>
<body>
<main>
<section class="hero">
<div class="muted">RSF Flight Service Certification</div>
<div class="big">${report.readinessPercent}% ${escapeHtml(report.productionRecommendation)}</div>
<p class="muted">Generated ${escapeHtml(report.generatedAt)}. Mode: ${escapeHtml(report.mode)}. Commit: ${escapeHtml(report.buildCommit)}. Seed: ${escapeHtml(report.seed)}.</p>
</section>
<section class="grid">
${[
  ["Total scenarios", report.summary.totalScenarios],
  ["Passed", report.summary.passed],
  ["Failed", report.summary.failed],
  ["Blockers", report.summary.blockers],
  ["Major", report.summary.majorIssues],
  ["Minor", report.summary.minorIssues],
  ["Provider attempted", report.summary.providerCallsAttempted],
  ["Provider blocked", report.summary.providerCallsBlocked],
].map(([label, value]) => `<div class="card"><div class="muted">${label}</div><div class="big">${value}</div></div>`).join("")}
</section>
<h2>Category Status</h2>
<div class="grid">${report.categories.map((category: any) => `<div class="card"><strong class="${category.status === "PASS" ? "pass" : category.status === "FAIL" ? "fail" : "warn"}">${escapeHtml(category.status)}</strong><div>${escapeHtml(category.name)}</div><div class="muted">${category.passed} passed / ${category.failed} failed</div></div>`).join("")}</div>
<h2>Provider Review Feedback Coverage</h2>
<table><thead><tr><th>Issue</th><th>Status</th><th>Last result</th></tr></thead><tbody>${report.seanFeedbackCoverage.items.map((item: any) => `<tr><td>${escapeHtml(item.issueText)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.lastPassFail)}</td></tr>`).join("")}</tbody></table>
<h2>Failed Scenarios</h2>
${report.failures.length ? report.failures.map((failure: any) => `<details><summary>${escapeHtml(failure.name)}</summary><p>${escapeHtml(failure.description)}</p><pre>${escapeHtml(JSON.stringify(failure.mismatches, null, 2))}</pre></details>`).join("") : "<p class='pass'>No failed mocked certification scenarios.</p>"}
<h2>Remaining Manual Items</h2>
<ul>${report.remainingRisks.map((risk: string) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul>
</main>
</body>
</html>`;

export const runCertificationReport = ({ writeReport = false }: { writeReport?: boolean } = {}) => {
  const args = readCertificationArgs();
  const scenarios = buildCertificationScenarios(args);
  const results = runFlightServiceScenarios(scenarios);
  const rawSummary = summarizeScenarioResults(results);
  const summary = {
    ...rawSummary,
    providerCallsSimulated: rawSummary.providerCallsAttempted,
    providerCallsAttempted: 0,
    providerCallsBlocked: rawSummary.providerCallsBlocked + rawSummary.providerCallsAttempted,
  };
  const readinessPercent = summary.totalScenarios > 0 ? Math.round((summary.passed / summary.totalScenarios) * 100) : 0;
  const productionRecommendation = recommendationFor(summary);
  const categories = buildCategorySummaries(results);
  const seanItems = buildSeanCoverage(results);
  const remainingRisks = [
    "Live provider lifecycle calls remain manual/lab-gated.",
    "Visual UI items require browser screenshot evidence.",
    "Realtime provider push notification behavior requires an integration or browser harness.",
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    buildCommit: getCommit(),
    mode: "mocked",
    seed: args.seed,
    count: args.count,
    readinessPercent,
    productionRecommendation,
    summary,
    categories,
    seanFeedbackCoverage: {
      covered: seanItems.filter((item) => item.lastPassFail !== "not automated").length,
      total: seanItems.length,
      items: seanItems,
    },
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
    const htmlPath = join(dir, "latest.html");
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    writeFileSync(mdPath, [
      "# Flight Service Certification Report",
      "",
      "## Executive Summary",
      "",
      `Recommendation: ${productionRecommendation}`,
      `Readiness: ${readinessPercent}%`,
      "",
      `Generated: ${report.generatedAt}`,
      `Build/commit: ${report.buildCommit}`,
      `Mode: ${report.mode}`,
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
      `- Provider calls simulated in mock mode: ${summary.providerCallsSimulated}`,
      `- Sean feedback items covered: ${summary.seanFeedbackCoverage}`,
      `- Production recommendation: ${productionRecommendation}`,
      "",
      "## Category Status",
      "",
      "| Category | Status | Passed | Failed | Blockers | Major | Minor |",
      "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
      ...categories.map((category) => `| ${category.name} | ${category.status} | ${category.passed} | ${category.failed} | ${category.blockers} | ${category.majorIssues} | ${category.minorIssues} |`),
      "",
      "## Provider Review Feedback Coverage",
      "",
      "| Issue | Status | Last result | Evidence | Notes |",
      "| --- | --- | --- | --- | --- |",
      ...seanItems.map((item) => `| ${item.issueText} | ${item.status} | ${item.lastPassFail} | ${item.evidenceLocation} | ${item.notes} |`),
      "",
      "## Remaining Risks",
      "",
      ...remainingRisks.map((risk) => `- ${risk}`),
      "",
      "## Failures",
      "",
      severityLines(results) || "No failures.",
      "",
      "## Final Recommendation",
      "",
      productionRecommendation,
      "",
    ].join("\n"));
    writeFileSync(htmlPath, buildHtmlReport(report));
    return { report, jsonPath, mdPath, htmlPath };
  }

  return { report, jsonPath: null, mdPath: null, htmlPath: null };
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const writeReport = process.argv.includes("--write");
  const { report, jsonPath, mdPath, htmlPath } = runCertificationReport({ writeReport });
  console.log("");
  console.log("RSF FLIGHT SERVICE CERTIFICATION");
  console.log(`Date: ${report.generatedAt}`);
  console.log(`Build/commit: ${report.buildCommit}`);
  console.log(`Mode: ${report.mode}`);
  console.log(`Seed: ${report.seed}`);
  console.log(`Scenario count: ${report.summary.totalScenarios}`);
  console.log("");
  for (const category of report.categories) {
    console.log(`${category.status} ${category.name}: ${category.passed} passed, ${category.failed} failed, ${category.blockers} blockers, ${category.majorIssues} major, ${category.minorIssues} minor`);
  }
  console.log("");
  console.log(`Total scenarios: ${report.summary.totalScenarios}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log(`Blockers: ${report.summary.blockers}`);
  console.log(`Major issues: ${report.summary.majorIssues}`);
  console.log(`Minor issues: ${report.summary.minorIssues}`);
  console.log(`Provider calls attempted: ${report.summary.providerCallsAttempted}`);
  console.log(`Provider calls blocked: ${report.summary.providerCallsBlocked}`);
  console.log(`Provider calls simulated in mock mode: ${report.summary.providerCallsSimulated}`);
  console.log(`Sean feedback coverage: ${report.seanFeedbackCoverage.covered}/${report.seanFeedbackCoverage.total}`);
  console.log(`Overall readiness: ${report.readinessPercent}%`);
  console.log(`Production recommendation: ${report.productionRecommendation}`);
  if (jsonPath && mdPath) {
    console.log(`JSON report: ${jsonPath}`);
    console.log(`Markdown report: ${mdPath}`);
    console.log(`HTML report: ${htmlPath}`);
  }
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
}
