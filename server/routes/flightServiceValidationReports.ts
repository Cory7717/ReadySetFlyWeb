import type { Express } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { isAdmin, isAuthenticated } from "../auth";
import { flightServiceValidationReports } from "@shared/schema";
import { removeRestrictedProviderBranding, validatePublicValidationReport } from "@shared/config/flightServiceValidationReports";

const MAX_REPORT_BYTES = 2 * 1024 * 1024;

function validateBody(body: unknown) {
  const bytes = Buffer.byteLength(JSON.stringify(body ?? null), "utf8");
  if (bytes > MAX_REPORT_BYTES) return { ok: false as const, status: 413, error: "Validation report exceeds the 2 MB limit." };
  const validated = validatePublicValidationReport(body);
  if (!validated.ok) return { ok: false as const, status: 400, error: validated.error, details: validated.details };
  return { ok: true as const, report: validated.report };
}

function requestUserId(req: any) {
  return String(req.user?.id || req.user?.claims?.sub || req.session?.userId || "") || null;
}

export function registerFlightServiceValidationReportRoutes(app: Express) {
  app.get("/api/public/flight-service-validation/reports", async (_req, res, next) => {
    try {
      const rows = await db.select({ reportId: flightServiceValidationReports.reportId, reportJson: flightServiceValidationReports.reportJson, isCurrent: flightServiceValidationReports.isCurrent, publishedAt: flightServiceValidationReports.publishedAt })
        .from(flightServiceValidationReports).orderBy(desc(flightServiceValidationReports.isCurrent), desc(flightServiceValidationReports.publishedAt));
      res.json({ reports: rows.map((row) => ({ ...row, reportJson: removeRestrictedProviderBranding(row.reportJson) })) });
    } catch (error) { next(error); }
  });

  app.get("/api/public/flight-service-validation/reports/:reportId", async (req, res, next) => {
    try {
      const [row] = await db.select().from(flightServiceValidationReports).where(eq(flightServiceValidationReports.reportId, String(req.params.reportId))).limit(1);
      if (!row) return res.status(404).json({ error: "Validation report not found." });
      res.json({ report: removeRestrictedProviderBranding(row.reportJson), isCurrent: row.isCurrent, publishedAt: row.publishedAt });
    } catch (error) { next(error); }
  });

  app.get("/api/public/flight-service-validation/reports/:reportId/download", async (req, res, next) => {
    try {
      const [row] = await db.select().from(flightServiceValidationReports).where(eq(flightServiceValidationReports.reportId, String(req.params.reportId))).limit(1);
      if (!row) return res.status(404).json({ error: "Validation report not found." });
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${row.reportId}.json"`);
      res.send(`${JSON.stringify(removeRestrictedProviderBranding(row.reportJson), null, 2)}\n`);
    } catch (error) { next(error); }
  });

  app.post("/api/admin/flight-service-validation/reports/preview", isAuthenticated, isAdmin, (req, res) => {
    const result = validateBody(req.body);
    if (!result.ok) return res.status(result.status).json({ error: result.error, validation: result.details });
    const report = result.report;
    const metadata = report.metadata as Record<string, unknown>;
    res.json({ preview: { reportId: report.reportId, title: report.title, environment: metadata.environment ?? null, validationDate: metadata.validationDate ?? null, overallStatus: metadata.overallStatus ?? null, lifecycleTimeline: report.lifecycleTimeline, validationResultCount: report.validationResults.length, evidenceItemCount: report.evidence.length, openItemCount: report.openItems.length }, report });
  });

  app.post("/api/admin/flight-service-validation/reports/publish", isAuthenticated, isAdmin, async (req: any, res, next) => {
    try {
      const result = validateBody(req.body?.report);
      if (!result.ok) return res.status(result.status).json({ error: result.error, validation: result.details });
      const report = result.report;
      const [existing] = await db.select({ id: flightServiceValidationReports.id }).from(flightServiceValidationReports).where(eq(flightServiceValidationReports.reportId, report.reportId)).limit(1);
      if (existing && req.body?.replace !== true) return res.status(409).json({ error: "A report with this reportId already exists. Confirm replacement to continue.", code: "REPLACEMENT_CONFIRMATION_REQUIRED" });
      const row = await db.transaction(async (tx) => {
        await tx.update(flightServiceValidationReports).set({ isCurrent: false });
        if (existing) {
          const [updated] = await tx.update(flightServiceValidationReports).set({ reportJson: report, isCurrent: true, publishedByUserId: requestUserId(req), publishedAt: new Date(), updatedAt: new Date() }).where(eq(flightServiceValidationReports.id, existing.id)).returning();
          return updated;
        }
        const [created] = await tx.insert(flightServiceValidationReports).values({ reportId: report.reportId, reportJson: report, isCurrent: true, publishedByUserId: requestUserId(req) }).returning();
        return created;
      });
      res.status(existing ? 200 : 201).json({ report: row.reportJson, isCurrent: row.isCurrent });
    } catch (error) { next(error); }
  });
}
