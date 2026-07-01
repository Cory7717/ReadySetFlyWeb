import fs from "fs";
import path from "path";

const REPORT_DIR = path.resolve(process.cwd(), "certification-reports", "flight-service");
const JSON_SUFFIX = "-certification-report.json";
const MD_SUFFIX = "-certification-report.md";

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

const safeReadJson = (filePath: string) => {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return redactValue("", parsed) as Record<string, unknown>;
};

const ensureReportDir = () => {
  if (!fs.existsSync(REPORT_DIR)) return [];
  return fs.readdirSync(REPORT_DIR);
};

const reportIdFromJson = (fileName: string) => fileName.slice(0, -JSON_SUFFIX.length);

const recommendationFor = (report: Record<string, any>) => {
  if (report.productionRecommendation) return String(report.productionRecommendation);
  const blockers = Number(report.summary?.blockers || 0);
  const failed = Number(report.summary?.failed || 0);
  if (blockers > 0 || failed > 0) return "NOT READY";
  return "READY FOR LIMITED REVIEW ONLY";
};

const readinessFor = (report: Record<string, any>) => {
  if (Number.isFinite(Number(report.readinessPercent))) return Number(report.readinessPercent);
  const total = Number(report.summary?.totalScenarios || 0);
  const passed = Number(report.summary?.passed || 0);
  return total > 0 ? Math.round((passed / total) * 100) : 0;
};

export const listFlightServiceCertificationReports = () => {
  const files = ensureReportDir()
    .filter((file) => file.endsWith(JSON_SUFFIX))
    .sort()
    .reverse();

  return files.map((file) => {
    const id = reportIdFromJson(file);
    const filePath = path.join(REPORT_DIR, file);
    const report = safeReadJson(filePath) as Record<string, any>;
    return {
      id,
      fileName: file,
      generatedAt: report.generatedAt || null,
      buildCommit: report.buildCommit || "unknown",
      mode: report.mode || "mocked",
      readinessPercent: readinessFor(report),
      productionRecommendation: recommendationFor(report),
      totalScenarios: Number(report.summary?.totalScenarios || 0),
      passed: Number(report.summary?.passed || 0),
      failed: Number(report.summary?.failed || 0),
      blockers: Number(report.summary?.blockers || 0),
      majorIssues: Number(report.summary?.majorIssues || 0),
      minorIssues: Number(report.summary?.minorIssues || 0),
      providerCallsAttempted: Number(report.summary?.providerCallsAttempted || 0),
      providerCallsBlocked: Number(report.summary?.providerCallsBlocked || 0),
      providerCallsSimulated: Number(report.summary?.providerCallsSimulated || 0),
      seanFeedbackCoverage: report.seanFeedbackCoverage || {
        covered: Number(report.summary?.seanFeedbackCoverage || 0),
        total: null,
        items: [],
      },
      downloads: {
        json: `/api/admin/certification/reports/${encodeURIComponent(id)}/download/json`,
        markdown: `/api/admin/certification/reports/${encodeURIComponent(id)}/download/markdown`,
        html: `/api/admin/certification/reports/${encodeURIComponent(id)}/download/html`,
      },
    };
  });
};

export const getFlightServiceCertificationReport = (id: string) => {
  const cleanId = path.basename(id || "");
  const filePath = path.join(REPORT_DIR, `${cleanId}${JSON_SUFFIX}`);
  if (!fs.existsSync(filePath)) return null;
  const report = safeReadJson(filePath);
  return {
    id: cleanId,
    ...report,
    readinessPercent: readinessFor(report),
    productionRecommendation: recommendationFor(report),
    downloads: {
      json: `/api/admin/certification/reports/${encodeURIComponent(cleanId)}/download/json`,
      markdown: `/api/admin/certification/reports/${encodeURIComponent(cleanId)}/download/markdown`,
      html: `/api/admin/certification/reports/${encodeURIComponent(cleanId)}/download/html`,
    },
  };
};

export const getLatestFlightServiceCertificationReport = () => {
  const [latest] = listFlightServiceCertificationReports();
  if (!latest) return null;
  const detail = getFlightServiceCertificationReport(latest.id);
  return detail ? { summary: latest, report: detail } : null;
};

export const resolveFlightServiceCertificationDownload = (id: string, format: string) => {
  const cleanId = path.basename(id || "");
  const cleanFormat = String(format || "").toLowerCase();
  const latestHtml = path.join(REPORT_DIR, "latest.html");
  if (cleanFormat === "html") {
    if (!fs.existsSync(latestHtml)) return null;
    return {
      path: latestHtml,
      contentType: "text/html; charset=utf-8",
      fileName: "latest-flight-service-certification.html",
    };
  }
  if (cleanFormat === "json") {
    const filePath = path.join(REPORT_DIR, `${cleanId}${JSON_SUFFIX}`);
    if (!fs.existsSync(filePath)) return null;
    return { path: filePath, contentType: "application/json", fileName: `${cleanId}${JSON_SUFFIX}` };
  }
  if (cleanFormat === "markdown" || cleanFormat === "md") {
    const filePath = path.join(REPORT_DIR, `${cleanId}${MD_SUFFIX}`);
    if (!fs.existsSync(filePath)) return null;
    return { path: filePath, contentType: "text/markdown; charset=utf-8", fileName: `${cleanId}${MD_SUFFIX}` };
  }
  return null;
};
