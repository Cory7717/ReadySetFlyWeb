import fs from "fs";
import path from "path";

const REPORT_DIR = path.resolve(process.cwd(), "tests", "flight-service", "reports");
const HISTORY_DIR = path.join(REPORT_DIR, "history");

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

const summaryFor = (report: Record<string, any>) => ({
  id: String(report.runId || ""),
  runId: String(report.runId || ""),
  mode: String(report.mode || "standard"),
  status: String(report.status || "unknown"),
  startedAt: report.startTime || null,
  completedAt: report.endTime || null,
  durationMs: Number(report.durationMs || 0),
  totalScenarios: Number(report.totalScenarios || 0),
  passed: Number(report.passed || 0),
  failed: Number(report.failed || 0),
  warnings: Number(report.warnings || 0),
  skipped: Number(report.skipped || 0),
  categoriesTested: Array.isArray(report.categoriesTested) ? report.categoriesTested : [],
  coverageSummary: Array.isArray(report.coverageSummary) ? report.coverageSummary : [],
  failureCount: Array.isArray(report.failures) ? report.failures.length : 0,
  environmentSafetyStatus: report.environmentSafetyStatus || null,
  downloads: {
    json: `/api/admin/flight-service-certification/runs/${encodeURIComponent(String(report.runId || ""))}/export.json`,
    csv: `/api/admin/flight-service-certification/runs/${encodeURIComponent(String(report.runId || ""))}/export.csv`,
    html: `/api/admin/flight-service-certification/runs/${encodeURIComponent(String(report.runId || ""))}/export.html`,
  },
});

const ensureHistory = () => fs.existsSync(HISTORY_DIR) ? fs.readdirSync(HISTORY_DIR) : [];

const jsonPathFor = (id: string) => {
  const clean = path.basename(id || "");
  const historyPath = path.join(HISTORY_DIR, `${clean}.json`);
  if (fs.existsSync(historyPath)) return historyPath;
  const latest = path.join(REPORT_DIR, "latest.json");
  if (clean === "latest" && fs.existsSync(latest)) return latest;
  return null;
};

const csvForReport = (report: Record<string, any>) => [
  "runId,mode,status,total,passed,failed,warnings,durationMs",
  [report.runId, report.mode, report.status, report.totalScenarios, report.passed, report.failed, report.warnings, report.durationMs].join(","),
  "",
  "category,total,passed,failed",
  ...(Array.isArray(report.coverageSummary) ? report.coverageSummary : []).map((item: any) => [
    item.category,
    item.total,
    item.passed,
    item.failed,
  ].join(",")),
  "",
  "failure,category,seed,replayCommand",
  ...(Array.isArray(report.failures) ? report.failures : []).map((failure: any) => [
    failure.testName,
    failure.category,
    failure.seed,
    failure.replayCommand,
  ].map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")),
].join("\n");

export const listFlightServiceStressRuns = () => ensureHistory()
  .filter((file) => file.endsWith(".json"))
  .sort()
  .reverse()
  .map((file) => {
    const report = safeReadJson(path.join(HISTORY_DIR, file));
    return summaryFor(report);
  });

export const getLatestFlightServiceStressRun = () => {
  const latestPath = path.join(REPORT_DIR, "latest.json");
  if (!fs.existsSync(latestPath)) return null;
  const report = safeReadJson(latestPath);
  return { summary: summaryFor(report), report: { ...report, downloads: summaryFor(report).downloads } };
};

export const getFlightServiceStressRun = (id: string) => {
  const filePath = jsonPathFor(id);
  if (!filePath) return null;
  const report = safeReadJson(filePath);
  return { ...(report as Record<string, any>), downloads: summaryFor(report).downloads } as Record<string, any>;
};

export const getFlightServiceStressRunFailures = (id: string) => {
  const report = getFlightServiceStressRun(id);
  if (!report) return null;
  return Array.isArray(report.failures) ? report.failures : [];
};

export const resolveFlightServiceStressExport = (id: string, format: string) => {
  const cleanFormat = String(format || "").toLowerCase();
  const cleanId = path.basename(id || "");
  const jsonPath = jsonPathFor(cleanId);
  if (!jsonPath) return null;
  if (cleanFormat === "json") {
    return { contentType: "application/json", fileName: `${cleanId}.json`, body: fs.readFileSync(jsonPath, "utf8") };
  }
  if (cleanFormat === "csv") {
    return { contentType: "text/csv; charset=utf-8", fileName: `${cleanId}.csv`, body: csvForReport(safeReadJson(jsonPath)) };
  }
  if (cleanFormat === "html") {
    const htmlPath = path.join(HISTORY_DIR, `${cleanId}.html`);
    const latestHtml = path.join(REPORT_DIR, "latest.html");
    const filePath = fs.existsSync(htmlPath) ? htmlPath : latestHtml;
    if (!fs.existsSync(filePath)) return null;
    return { contentType: "text/html; charset=utf-8", fileName: `${cleanId}.html`, body: fs.readFileSync(filePath, "utf8") };
  }
  return null;
};
