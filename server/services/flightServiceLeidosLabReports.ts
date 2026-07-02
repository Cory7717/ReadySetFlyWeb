import fs from "fs";
import path from "path";

const REPORT_DIR = path.resolve(process.cwd(), "tests", "flight-service", "leidos-lab", "reports");
const HISTORY_DIR = path.join(REPORT_DIR, "history");
const LIVE_LAB_RESULT_DIR = path.resolve(process.cwd(), "certification-results", "leidos-live-lab");

const redactKey = (key: string) => /phone|pilot|email|secret|token|password|credential|authorization/i.test(key);

const redactValue = (key: string, value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (redactKey(key)) return "[redacted]";
  if (Array.isArray(value)) return value.map((item) => redactValue(key, item));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redactValue(childKey, childValue),
      ]),
    );
  }
  return value;
};

const safeReadJson = (filePath: string) => redactValue("", JSON.parse(fs.readFileSync(filePath, "utf8"))) as Record<string, any>;

const reportId = (report: Record<string, any>) => String(report.runId || report.certificationRunId || "");

const summaryFor = (report: Record<string, any>) => ({
  id: reportId(report),
  runId: reportId(report),
  suiteType: String(report.mode || "").includes("interactive") ? "leidos_lab_session" : "leidos_lab",
  providerMode: "leidos_lab",
  mode: String(report.mode || (report.certificationRunId ? "live-lab" : "smoke")),
  status: String(report.status || (Number(report.failed || 0) > 0 ? "failed" : "complete")),
  startedAt: report.startTime || null,
  completedAt: report.endTime || report.createdAt || null,
  durationMs: Number(report.durationMs || 0),
  totalScenarios: Number(report.totalScenarios || report.totalCases || 0),
  passed: Number(report.passed || 0),
  failed: Number(report.failed || 0),
  warnings: Number(report.warnings || 0),
  providerNormalized: Number(report.providerNormalized || 0),
  needsLeidosClarification: Number(report.needsLeidosClarification || 0),
  providerPlanIds: Array.isArray(report.providerPlanIds) ? report.providerPlanIds : [],
  versionStamps: Array.isArray(report.versionStamps) ? report.versionStamps : [],
  scenarioCategoryCoverage: Array.isArray(report.scenarioCategoryCoverage) ? report.scenarioCategoryCoverage : [],
  environmentSafety: report.environmentSafety || null,
  failureCount: Array.isArray(report.failures) ? report.failures.length : 0,
  downloads: {
    json: `/api/admin/flight-service-certification/leidos-lab/runs/${encodeURIComponent(reportId(report))}/export.json`,
    csv: `/api/admin/flight-service-certification/leidos-lab/runs/${encodeURIComponent(reportId(report))}/export.csv`,
    html: `/api/admin/flight-service-certification/leidos-lab/runs/${encodeURIComponent(reportId(report))}/export.html`,
  },
});

const ensureHistory = () => fs.existsSync(HISTORY_DIR) ? fs.readdirSync(HISTORY_DIR) : [];
const ensureLiveLabResults = () => fs.existsSync(LIVE_LAB_RESULT_DIR) ? fs.readdirSync(LIVE_LAB_RESULT_DIR) : [];

const jsonPathFor = (id: string) => {
  const clean = path.basename(id || "");
  const historyPath = path.join(HISTORY_DIR, `${clean}.json`);
  if (fs.existsSync(historyPath)) return historyPath;
  const liveLabPath = path.join(LIVE_LAB_RESULT_DIR, `${clean}.json`);
  if (fs.existsSync(liveLabPath)) return liveLabPath;
  const latestSessionPath = path.join(LIVE_LAB_RESULT_DIR, "latest-session.json");
  if (clean === "latest-session" && fs.existsSync(latestSessionPath)) return latestSessionPath;
  const latest = path.join(REPORT_DIR, "latest.json");
  if (clean === "latest" && fs.existsSync(latest)) return latest;
  return null;
};

const buildLabCsv = (report: Record<string, any>) => [
  "runId,mode,status,total,passed,failed,warnings,providerNormalized,needsClarification,durationMs",
  [reportId(report), report.mode, report.status || (Number(report.failed || 0) > 0 ? "failed" : "complete"), report.totalScenarios || report.totalCases, report.passed, report.failed, report.warnings, report.providerNormalized, report.needsLeidosClarification, report.durationMs].join(","),
  "",
  "scenarioId,name,category,status,providerPlanId,versionStamp",
  ...(Array.isArray(report.scenarios) ? report.scenarios : Array.isArray(report.results) ? report.results : []).map((scenario: any) => [
    scenario.scenarioId,
    scenario.name || scenario.testName,
    scenario.category,
    scenario.status || (scenario.pass ? "passed" : scenario.skipped ? "skipped" : "failed"),
    scenario.providerPlanId || scenario.actions?.find((action: any) => action.providerPlanId)?.providerPlanId || "",
    scenario.versionStamp || scenario.actions?.find((action: any) => action.versionStamp)?.versionStamp || "",
  ].map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")),
  "",
  "failure,category,classification,replayCommand",
  ...(Array.isArray(report.failures) ? report.failures : []).map((failure: any) => [
    failure.scenarioName,
    failure.category,
    failure.classification,
    failure.replayCommand,
  ].map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")),
].join("\n");

export const listLeidosLabCertificationRuns = () => [
  ...ensureHistory()
    .filter((file) => file.endsWith(".json"))
    .map((file) => safeReadJson(path.join(HISTORY_DIR, file))),
  ...ensureLiveLabResults()
    .filter((file) => file.endsWith(".json") && file !== "latest-session.json" && !file.includes("-cleanup-"))
    .map((file) => safeReadJson(path.join(LIVE_LAB_RESULT_DIR, file))),
]
  .map(summaryFor)
  .sort((a, b) => String(b.completedAt || b.startedAt || b.runId).localeCompare(String(a.completedAt || a.startedAt || a.runId)));

export const getLatestLeidosLabCertificationRun = () => {
  const runs = listLeidosLabCertificationRuns();
  const latestRun = runs[0];
  if (latestRun) {
    const report = getLeidosLabCertificationRun(latestRun.runId);
    if (report) return { summary: latestRun, report: { ...report, downloads: latestRun.downloads } };
  }
  const latest = path.join(REPORT_DIR, "latest.json");
  if (!fs.existsSync(latest)) return null;
  const report = safeReadJson(latest);
  return { summary: summaryFor(report), report: { ...report, downloads: summaryFor(report).downloads } };
};

export const getLeidosLabCertificationRun = (id: string) => {
  const filePath = jsonPathFor(id);
  if (!filePath) return null;
  const report = safeReadJson(filePath);
  return { ...report, downloads: summaryFor(report).downloads } as Record<string, any>;
};

export const getLeidosLabCertificationRunFailures = (id: string) => {
  const report = getLeidosLabCertificationRun(id);
  if (!report) return null;
  return Array.isArray(report.failures) ? report.failures : [];
};

export const resolveLeidosLabCertificationExport = (id: string, format: string) => {
  const cleanId = path.basename(id || "");
  const cleanFormat = String(format || "").toLowerCase();
  const jsonPath = jsonPathFor(cleanId);
  if (!jsonPath) return null;
  if (cleanFormat === "json") {
    return { contentType: "application/json", fileName: `${cleanId}.json`, body: fs.readFileSync(jsonPath, "utf8") };
  }
  if (cleanFormat === "csv") {
    return { contentType: "text/csv; charset=utf-8", fileName: `${cleanId}.csv`, body: buildLabCsv(safeReadJson(jsonPath)) };
  }
  if (cleanFormat === "html") {
    const historyPath = path.join(HISTORY_DIR, `${cleanId}.html`);
    const latestPath = path.join(REPORT_DIR, "latest.html");
    const filePath = fs.existsSync(historyPath) ? historyPath : latestPath;
    if (!fs.existsSync(filePath)) {
      const report = safeReadJson(jsonPath);
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${cleanId}</title></head><body><h1>Leidos Certification Session</h1><pre>${JSON.stringify(report, null, 2).replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char] || char))}</pre></body></html>`;
      return { contentType: "text/html; charset=utf-8", fileName: `${cleanId}.html`, body: html };
    }
    return { contentType: "text/html; charset=utf-8", fileName: `${cleanId}.html`, body: fs.readFileSync(filePath, "utf8") };
  }
  return null;
};
