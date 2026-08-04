import { z } from "zod";

const record = z.record(z.unknown());
const textOrRecord = z.union([z.string(), record]);

export const flightServiceValidationReportImportSchema = z.object({
  schemaVersion: z.enum(["1.0", "1.0.0"]),
  reportType: z.literal("rsf-flight-service-validation"),
  reportId: z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9._-]+$/),
  title: z.string().trim().min(1).max(240),
  subtitle: z.string().trim().max(500).default(""),
  visibility: z.enum(["public", "public-sanitized"]),
  metadata: record,
  executiveSummary: z.union([z.string(), z.array(z.string())]),
  testScenario: textOrRecord,
  lifecycleTimeline: z.array(z.union([z.string(), record])),
  validationResults: z.array(record),
  evidence: z.array(record),
  engineeringObservations: z.union([z.string(), z.array(z.string()), record]),
  openItems: z.array(z.union([z.string(), record])),
  conclusion: record,
}).strict();

export type FlightServiceValidationReportImport = z.infer<typeof flightServiceValidationReportImportSchema>;

const sensitiveKey = /(^|\.)(authorization|password|passwd|secret|api.?key|access.?token|database.?url|webhook.?url|provider.?plan.?id|internal.?plan.?id|flight.?identifier|user.?id|request.?id|event.?hash|stack|stack.?trace)$/i;
const safeRedaction = /^\s*(?:\[REDACTED\]|\[REMOVED\]|PII restricted|null|none|not applicable)\s*$/i;
const sensitiveValues: Array<{ label: string; pattern: RegExp }> = [
  { label: "authorization credential", pattern: /\b(?:basic|bearer)\s+[A-Za-z0-9+/_=.:-]{8,}/i },
  { label: "email address", pattern: /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/ },
  { label: "phone number", pattern: /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/ },
  { label: "IP address", pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/ },
  { label: "webhook URL", pattern: /https?:\/\/[^\s"']*webhook[^\s"']*/i },
  { label: "database URL", pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\//i },
  { label: "stack trace", pattern: /(?:\n|^)\s*at\s+[\w$.<>]+\s*\(/ },
];

export function findSensitiveValidationReportValue(value: unknown, path = "$"): { path: string; reason: string } | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const finding = findSensitiveValidationReportValue(value[index], `${path}[${index}]`);
      if (finding) return finding;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const nestedPath = `${path}.${key}`;
      if (sensitiveKey.test(nestedPath) && nested != null && String(nested).trim() && !safeRedaction.test(String(nested))) return { path: nestedPath, reason: "sensitive field" };
      const finding = findSensitiveValidationReportValue(nested, nestedPath);
      if (finding) return finding;
    }
    return null;
  }
  if (typeof value === "string") {
    for (const candidate of sensitiveValues) if (candidate.pattern.test(value)) return { path, reason: candidate.label };
  }
  return null;
}

export function validatePublicValidationReport(value: unknown) {
  const parsed = flightServiceValidationReportImportSchema.safeParse(value);
  if (!parsed.success) return { ok: false as const, error: "The report does not match the supported v1 validation-report schema.", details: parsed.error.flatten() };
  const finding = findSensitiveValidationReportValue(parsed.data);
  if (finding) return { ok: false as const, error: `Sensitive-looking content detected at ${finding.path}: ${finding.reason}.` };
  return { ok: true as const, report: parsed.data };
}
