import express, { type Express, type RequestHandler } from "express";
import multer from "multer";
import bcrypt from "bcrypt";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { courtyardComptrollerReports, tipsKioskSettings, tipsUsers } from "@shared/schema";
import { calculateComptrollerReports, comptrollerSummaryCsv, COMPTROLLER_PROPERTY_ID } from "../comptrollerTax";

const COMPTROLLER_ADMIN_EMAILS = new Set(
  (
    process.env.COMPTROLLER_ADMIN_EMAILS ||
    process.env.OPS_REPORT_ADMIN_EMAILS ||
    process.env.SCHEDULE_ADMIN_EMAILS ||
    "coryarmer@gmail.com,cory.armer@marriott.com"
  )
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (name.endsWith(".xlsx") || file.mimetype.includes("spreadsheet")) return cb(null, true);
    cb(new Error("Only XLSX STAY reports are supported."));
  },
});

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function getToolAccess(user: any): Record<string, boolean> {
  const access = user?.toolAccessJson;
  return access && typeof access === "object" && !Array.isArray(access) ? access as Record<string, boolean> : {};
}

async function getUserBySession(req: any) {
  const userId = req.session?.tipsUserId;
  if (userId) {
    const [user] = await db.select().from(tipsUsers).where(eq(tipsUsers.id, String(userId))).limit(1);
    if (user) return user;
  }
  const authEmail = normalizeEmail(req.user?.claims?.email || req.user?.email || "");
  if (!authEmail) return null;
  const [user] = await db.select().from(tipsUsers).where(eq(tipsUsers.email, authEmail)).limit(1);
  return user || null;
}

async function getStoredPinHash() {
  const [row] = await db.select().from(tipsKioskSettings).where(eq(tipsKioskSettings.key, "ops_report_pin_hash")).limit(1);
  if (row?.value) return row.value;
  const [tipsRow] = await db.select().from(tipsKioskSettings).where(eq(tipsKioskSettings.key, "pin_hash")).limit(1);
  return tipsRow?.value || "";
}

async function verifyPin(pin: string) {
  const hash = await getStoredPinHash();
  if (hash) return bcrypt.compare(pin, hash);
  return Boolean((process.env.OPS_REPORT_PIN && process.env.OPS_REPORT_PIN === pin) || (process.env.TIPS_KIOSK_PIN && process.env.TIPS_KIOSK_PIN === pin));
}

async function publicComptrollerUser(user: any) {
  const email = normalizeEmail(user.email);
  const isSuperAdmin = COMPTROLLER_ADMIN_EMAILS.has(email) || user.role === "super_admin";
  const explicit = getToolAccess(user).comptroller;
  const opsExplicit = getToolAccess(user).opsreport;
  const isAdmin = explicit ?? opsExplicit ?? isSuperAdmin;
  return {
    id: user.id,
    email,
    employeeDisplayName: user.employeeDisplayName,
    isAdmin: Boolean(isAdmin),
    isSuperAdmin,
    disabledAt: user.disabledAt ?? null,
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

async function requireComptrollerAccess(req: any, res: any, next: any) {
  try {
    const user = await getUserBySession(req);
    if (user && !user.disabledAt) {
      const publicUser = await publicComptrollerUser(user);
      if (publicUser.mustChangePassword) return res.status(403).json({ error: "Password change required." });
      if (publicUser.isAdmin) {
        req.comptrollerUser = publicUser;
        return next();
      }
    }
    if (req.session?.opsReportUnlocked) {
      req.comptrollerUser = null;
      return next();
    }
    return res.status(401).json({ error: "Comptroller access required." });
  } catch (error) {
    next(error);
  }
}

function publicReport(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    propertyId: row.propertyId,
    reportMonth: row.reportMonth,
    payload: row.payloadJson || {},
    uploadedReports: row.uploadedReportsJson || [],
    settings: row.settingsJson || {},
    updatedAt: row.updatedAt,
  };
}

export function registerComptrollerRoutes(app: Express) {
  const router = express.Router();

  router.get("/access", async (req: any, res, next) => {
    try {
      const user = await getUserBySession(req);
      if (!user || user.disabledAt) return res.json({ unlocked: Boolean(req.session?.opsReportUnlocked), user: null });
      const publicUser = await publicComptrollerUser(user);
      res.json({ unlocked: Boolean(req.session?.opsReportUnlocked || publicUser.isAdmin), user: publicUser });
    } catch (error) {
      next(error);
    }
  });

  router.post("/pin-login", async (req: any, res, next) => {
    try {
      const parsed = z.object({ pin: z.string().regex(/^\d{5}$/) }).safeParse(req.body);
      if (!parsed.success || !(await verifyPin(parsed.data.pin))) return res.status(401).json({ error: "Invalid PIN." });
      req.session.opsReportUnlocked = true;
      res.json({ unlocked: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/report", requireComptrollerAccess as RequestHandler, async (req, res, next) => {
    try {
      const parsed = z.object({
        propertyId: z.string().default(COMPTROLLER_PROPERTY_ID),
        reportMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      }).safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: "Invalid report query." });
      const query = parsed.data.reportMonth
        ? db.select().from(courtyardComptrollerReports).where(and(
            eq(courtyardComptrollerReports.propertyId, parsed.data.propertyId),
            eq(courtyardComptrollerReports.reportMonth, parsed.data.reportMonth),
          )).limit(1)
        : db.select().from(courtyardComptrollerReports).where(eq(courtyardComptrollerReports.propertyId, parsed.data.propertyId)).orderBy(desc(courtyardComptrollerReports.updatedAt)).limit(1);
      const [report] = await query;
      res.json({ report: publicReport(report) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/process", requireComptrollerAccess as RequestHandler, (req, res, next) => {
    upload.fields([
      { name: "taxPostings", maxCount: 1 },
      { name: "taxExemptions", maxCount: 1 },
      { name: "accountingInterface", maxCount: 1 },
    ])(req, res, async (error: any) => {
      try {
        if (error) return res.status(400).json({ error: error.message || "Unable to upload comptroller reports." });
        const files = req.files as Record<string, Express.Multer.File[]> | undefined;
        const parsedBody = z.object({
          propertyId: z.string().default(COMPTROLLER_PROPERTY_ID),
          reportMonth: z.string().regex(/^\d{4}-\d{2}$/).optional().or(z.literal("")),
          overwrite: z.coerce.boolean().default(false),
          includeMeetingRoomTaxInStateHOT: z.coerce.boolean().default(true),
        }).parse(req.body || {});
        const payload = calculateComptrollerReports({
          taxPostings: files?.taxPostings?.[0],
          taxExemptions: files?.taxExemptions?.[0],
          accountingInterface: files?.accountingInterface?.[0],
        }, {
          propertyId: parsedBody.propertyId,
          reportMonth: parsedBody.reportMonth || undefined,
          includeMeetingRoomTaxInStateHOT: parsedBody.includeMeetingRoomTaxInStateHOT,
        });
        const reportMonth = payload.reportingMonth || parsedBody.reportMonth;
        if (!reportMonth) return res.status(400).json({ error: "Unable to detect reporting month from uploaded files. Select a month and try again." });
        const [existing] = await db.select().from(courtyardComptrollerReports).where(and(
          eq(courtyardComptrollerReports.propertyId, parsedBody.propertyId),
          eq(courtyardComptrollerReports.reportMonth, reportMonth),
        )).limit(1);
        if (existing && !parsedBody.overwrite) return res.status(409).json({ error: "A report already exists for this property and month. Confirm overwrite to replace it.", existing: publicReport(existing) });
        const [saved] = await db.insert(courtyardComptrollerReports).values({
          propertyId: parsedBody.propertyId,
          reportMonth,
          payloadJson: payload,
          uploadedReportsJson: payload.uploadedReports,
          settingsJson: payload.settings,
          updatedBy: (req as any).comptrollerUser?.id || null,
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: [courtyardComptrollerReports.propertyId, courtyardComptrollerReports.reportMonth],
          set: {
            payloadJson: payload,
            uploadedReportsJson: payload.uploadedReports,
            settingsJson: payload.settings,
            updatedBy: (req as any).comptrollerUser?.id || null,
            updatedAt: new Date(),
          },
        }).returning();
        console.info(JSON.stringify({
          event: "comptroller_reports_processed",
          userId: (req as any).comptrollerUser?.id || null,
          propertyId: parsedBody.propertyId,
          reportMonth,
          uploadedReports: payload.uploadedReports.map((file) => file.originalFileName),
          warnings: payload.warnings.length,
        }));
        res.json({ report: publicReport(saved) });
      } catch (uploadError) {
        next(uploadError);
      }
    });
  });

  router.delete("/report/:propertyId/:reportMonth", requireComptrollerAccess as RequestHandler, async (req, res, next) => {
    try {
      const parsed = z.object({ propertyId: z.string(), reportMonth: z.string().regex(/^\d{4}-\d{2}$/) }).safeParse(req.params);
      if (!parsed.success) return res.status(400).json({ error: "Invalid report identifier." });
      await db.delete(courtyardComptrollerReports).where(and(
        eq(courtyardComptrollerReports.propertyId, parsed.data.propertyId),
        eq(courtyardComptrollerReports.reportMonth, parsed.data.reportMonth),
      ));
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/report/:propertyId/:reportMonth/export.csv", requireComptrollerAccess as RequestHandler, async (req, res, next) => {
    try {
      const [report] = await db.select().from(courtyardComptrollerReports).where(and(
        eq(courtyardComptrollerReports.propertyId, req.params.propertyId),
        eq(courtyardComptrollerReports.reportMonth, req.params.reportMonth),
      )).limit(1);
      if (!report) return res.status(404).json({ error: "Report not found." });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="comptroller-${req.params.propertyId}-${req.params.reportMonth}.csv"`);
      res.send(comptrollerSummaryCsv(report.payloadJson));
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/comptroller", router);
}
