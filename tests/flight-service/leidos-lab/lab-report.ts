import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

export const writeLabReport = (report: Record<string, any>) => {
  const dir = join("tests", "flight-service", "leidos-lab", "reports");
  const history = join(dir, "history");
  const failures = join("tests", "flight-service", "leidos-lab", "failures");
  mkdirSync(history, { recursive: true });
  mkdirSync(failures, { recursive: true });
  const html = buildLabHtml(report);
  writeFileSync(join(dir, "latest.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(dir, "latest.html"), html);
  writeFileSync(join(history, `${report.runId}.json`), JSON.stringify(report, null, 2));
  writeFileSync(join(history, `${report.runId}.html`), html);
  for (const failure of report.failures || []) {
    writeFileSync(join(failures, `${report.runId}-${failure.scenarioId}.json`), JSON.stringify(failure, null, 2));
  }
};

export const buildLabCsv = (report: Record<string, any>) => [
  "runId,mode,status,total,passed,failed,warnings,providerNormalized,needsClarification,durationMs",
  [report.runId, report.mode, report.status, report.totalScenarios, report.passed, report.failed, report.warnings, report.providerNormalized, report.needsLeidosClarification, report.durationMs].join(","),
  "",
  "scenarioId,name,category,status,providerPlanId,versionStamp",
  ...(report.scenarios || []).map((scenario: any) => [
    scenario.scenarioId,
    scenario.name,
    scenario.category,
    scenario.status,
    scenario.providerPlanId || "",
    scenario.versionStamp || "",
  ].map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")),
  "",
  "failure,category,classification,replayCommand",
  ...(report.failures || []).map((failure: any) => [
    failure.scenarioName,
    failure.category,
    failure.classification,
    failure.replayCommand,
  ].map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")),
].join("\n");

export const buildLabHtml = (report: Record<string, any>) => `<!doctype html><html><head><meta charset="utf-8"><title>RSF Leidos LAB Certification</title><style>
body{margin:0;background:#0f141b;color:#edf4ff;font-family:Inter,Arial,sans-serif}main{max-width:1180px;margin:auto;padding:32px}.card{border:1px solid #2d3748;background:#151c26;border-radius:12px;padding:18px;margin:12px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.big{font-size:32px;font-weight:800}.pass{color:#86efac}.fail{color:#fca5a5}.warn{color:#fde68a}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #2d3748;padding:10px;text-align:left}pre{white-space:pre-wrap;word-break:break-word;background:#0b1017;border-radius:8px;padding:12px}
</style></head><body><main>
<section class="card"><div>RSF Leidos LAB Certification</div><div class="big ${report.status === "passed" ? "pass" : "fail"}">${escapeHtml(String(report.status || "").toUpperCase())}</div><p>Environment: ${escapeHtml(report.environmentSafety?.environment)} | Production Filing: ${report.environmentSafety?.productionFilingDisabled ? "Disabled" : "Enabled"} | Provider Calls: ${escapeHtml(report.environmentSafety?.providerCalls)}</p></section>
<section class="grid">${[
  ["Total", report.totalScenarios],
  ["Passed", report.passed],
  ["Failed", report.failed],
  ["Warnings", report.warnings],
  ["Provider normalized", report.providerNormalized],
  ["Needs clarification", report.needsLeidosClarification],
].map(([label, value]) => `<div class="card"><div>${label}</div><div class="big">${value}</div></div>`).join("")}</section>
<h2>Scenarios</h2><table><thead><tr><th>Scenario</th><th>Category</th><th>Status</th><th>Provider Plan</th><th>Version</th></tr></thead><tbody>${(report.scenarios || []).map((scenario: any) => `<tr><td>${escapeHtml(scenario.name)}</td><td>${escapeHtml(scenario.category)}</td><td>${escapeHtml(scenario.status)}</td><td>${escapeHtml(scenario.providerPlanId)}</td><td>${escapeHtml(scenario.versionStamp)}</td></tr>`).join("")}</tbody></table>
<h2>Failures</h2>${(report.failures || []).length ? (report.failures || []).map((failure: any) => `<div class="card"><h3>${escapeHtml(failure.scenarioName)}</h3><div>${escapeHtml(failure.classification)}</div><pre>${escapeHtml(JSON.stringify(failure.diff, null, 2))}</pre><code>${escapeHtml(failure.replayCommand)}</code></div>`).join("") : "<div class='card pass'>No LAB certification failures.</div>"}
</main></body></html>`;
