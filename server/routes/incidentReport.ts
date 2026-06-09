import express, { type Express, type RequestHandler } from "express";
import bcrypt from "bcrypt";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { courtyardIncidentReports, tipsKioskSettings, tipsUsers } from "@shared/schema";

const PROPERTY_ID = "courtyard-austin-lakeline";

const pinSchema = z.object({
  pin: z.string().regex(/^\d{5}$/, "PIN must be exactly 5 digits"),
});

const incidentSchema = z.object({
  incidentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  incidentTime: z.string().min(1).max(20),
  location: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  severity: z.enum(["low", "moderate", "high", "critical"]).default("moderate"),
  reportedByName: z.string().min(1).max(150),
  reportedByPosition: z.string().max(150).optional().default(""),
  peopleInvolved: z.string().max(3000).optional().default(""),
  guestRooms: z.string().max(500).optional().default(""),
  witnesses: z.string().max(3000).optional().default(""),
  description: z.string().min(10).max(15000),
  immediateActions: z.string().min(2).max(10000),
  injuries: z.string().max(5000).optional().default(""),
  propertyDamage: z.string().max(5000).optional().default(""),
  vehicleDetails: z.string().max(5000).optional().default(""),
  emergencyServices: z.string().max(3000).optional().default(""),
  policeReportNumber: z.string().max(200).optional().default(""),
  notifications: z.string().max(3000).optional().default(""),
  followUpRequired: z.string().max(5000).optional().default(""),
  managerNotes: z.string().max(5000).optional().default(""),
});

async function getSessionUser(req: any) {
  const userId = req.session?.tipsUserId;
  if (!userId) return null;
  const [user] = await db.select().from(tipsUsers).where(eq(tipsUsers.id, String(userId))).limit(1);
  return user && !user.disabledAt ? user : null;
}

async function getSharedPinHash() {
  const [tipsRow] = await db.select().from(tipsKioskSettings).where(eq(tipsKioskSettings.key, "pin_hash")).limit(1);
  if (tipsRow?.value) return tipsRow.value;
  const [opsRow] = await db.select().from(tipsKioskSettings).where(eq(tipsKioskSettings.key, "ops_report_pin_hash")).limit(1);
  return opsRow?.value || "";
}

async function hasSharedPin() {
  return Boolean(await getSharedPinHash() || process.env.TIPS_KIOSK_PIN || process.env.OPS_REPORT_PIN);
}

async function verifySharedPin(pin: string) {
  const hash = await getSharedPinHash();
  if (hash) return bcrypt.compare(pin, hash);
  return Boolean(
    (process.env.TIPS_KIOSK_PIN && process.env.TIPS_KIOSK_PIN === pin)
    || (process.env.OPS_REPORT_PIN && process.env.OPS_REPORT_PIN === pin),
  );
}

async function requireIncidentAccess(req: any, res: any, next: any) {
  try {
    if (req.session?.incidentReportUnlocked) {
      req.incidentUser = await getSessionUser(req);
      return next();
    }
    return res.status(401).json({ error: "Incident report PIN required." });
  } catch (error) {
    next(error);
  }
}

function publicIncident(row: any) {
  return {
    id: row.id,
    incidentNumber: row.incidentNumber,
    incidentDate: row.incidentDate,
    incidentTime: row.incidentTime,
    location: row.location,
    category: row.category,
    severity: row.severity,
    status: row.status,
    reportedByName: row.reportedByName,
    reportedByPosition: row.reportedByPosition || "",
    peopleInvolved: row.peopleInvolved || "",
    guestRooms: row.guestRooms || "",
    witnesses: row.witnesses || "",
    description: row.description,
    immediateActions: row.immediateActions,
    injuries: row.injuries || "",
    propertyDamage: row.propertyDamage || "",
    vehicleDetails: row.vehicleDetails || "",
    emergencyServices: row.emergencyServices || "",
    policeReportNumber: row.policeReportNumber || "",
    notifications: row.notifications || "",
    followUpRequired: row.followUpRequired || "",
    managerNotes: row.managerNotes || "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function incidentNumber(date: string) {
  const compact = date.replace(/-/g, "");
  return `CY-AUSNL-${compact}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of String(text || "None reported").split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line || " ");
  }
  return lines;
}

async function buildIncidentPdf(incident: any) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [612, 792];
  const margin = 42;
  const contentWidth = pageSize[0] - margin * 2;
  let page!: PDFPage;
  let y!: number;

  const newPage = () => {
    page = pdf.addPage(pageSize);
    y = pageSize[1] - margin;
    page.drawText("COURTYARD AUSTIN NORTHWEST / LAKELINE", { x: margin, y, size: 9, font: bold, color: rgb(0.18, 0.37, 0.27) });
    page.drawText("CONFIDENTIAL INCIDENT REPORT", { x: pageSize[0] - margin - 174, y, size: 9, font: bold, color: rgb(0.18, 0.22, 0.27) });
    y -= 18;
    page.drawLine({ start: { x: margin, y }, end: { x: pageSize[0] - margin, y }, thickness: 1, color: rgb(0.73, 0.64, 0.51) });
    y -= 18;
  };

  const ensureSpace = (height: number) => {
    if (y - height < margin + 24) newPage();
  };

  const field = (label: string, value: unknown, options: { half?: boolean } = {}) => {
    const width = options.half ? (contentWidth - 14) / 2 : contentWidth;
    const lines = wrapText(String(value || "None reported"), regular, 9.5, width - 16);
    const height = 27 + lines.length * 12;
    ensureSpace(height);
    page.drawRectangle({ x: margin, y: y - height + 5, width, height, borderWidth: 0.7, borderColor: rgb(0.82, 0.76, 0.67), color: rgb(0.99, 0.98, 0.95) });
    page.drawText(label.toUpperCase(), { x: margin + 8, y: y - 10, size: 7.5, font: bold, color: rgb(0.36, 0.29, 0.23) });
    let textY = y - 24;
    for (const line of lines) {
      page.drawText(line, { x: margin + 8, y: textY, size: 9.5, font: regular, color: rgb(0.12, 0.1, 0.08) });
      textY -= 12;
    }
    y -= height + 8;
  };

  newPage();
  page.drawText("Hotel Incident Report", { x: margin, y, size: 22, font: bold, color: rgb(0.14, 0.22, 0.27) });
  y -= 20;
  page.drawText(`Incident ${incident.incidentNumber}`, { x: margin, y, size: 11, font: regular, color: rgb(0.36, 0.29, 0.23) });
  y -= 22;

  field("Incident date / time", `${incident.incidentDate} at ${incident.incidentTime}`);
  field("Location", incident.location);
  field("Category / severity / status", `${incident.category} / ${incident.severity} / ${incident.status}`);
  field("Reported by", `${incident.reportedByName}${incident.reportedByPosition ? `, ${incident.reportedByPosition}` : ""}`);
  field("People involved", incident.peopleInvolved);
  field("Guest room(s)", incident.guestRooms);
  field("Witnesses", incident.witnesses);
  field("Detailed incident narrative", incident.description);
  field("Immediate actions taken", incident.immediateActions);
  field("Injuries / medical response", incident.injuries);
  field("Property damage", incident.propertyDamage);
  field("Vehicle details", incident.vehicleDetails);
  field("Police / fire / EMS involvement", incident.emergencyServices);
  field("Police or case report number", incident.policeReportNumber);
  field("Notifications made", incident.notifications);
  field("Required follow-up", incident.followUpRequired);
  field("Manager notes", incident.managerNotes);

  ensureSpace(80);
  y -= 12;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + 220, y }, thickness: 0.8, color: rgb(0.25, 0.25, 0.25) });
  page.drawLine({ start: { x: margin + 290, y }, end: { x: pageSize[0] - margin, y }, thickness: 0.8, color: rgb(0.25, 0.25, 0.25) });
  page.drawText("Reporter signature / date", { x: margin, y: y - 13, size: 8, font: regular });
  page.drawText("Manager signature / date", { x: margin + 290, y: y - 13, size: 8, font: regular });
  page.drawText("This report documents observed facts and actions taken. Preserve related video, photos, statements, and external case numbers according to hotel policy.", {
    x: margin,
    y: margin - 2,
    size: 7,
    font: regular,
    color: rgb(0.38, 0.38, 0.38),
    maxWidth: contentWidth,
    lineHeight: 9,
  });
  return Buffer.from(await pdf.save());
}

export function registerIncidentReportRoutes(app: Express) {
  const router = express.Router();

  router.get("/access", async (req: any, res, next) => {
    try {
      const user = await getSessionUser(req);
      res.json({
        unlocked: Boolean(req.session?.incidentReportUnlocked),
        user: user ? { id: user.id, employeeDisplayName: user.employeeDisplayName, position: user.position || "", email: user.email } : null,
        hasPin: await hasSharedPin(),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/pin-login", async (req: any, res, next) => {
    try {
      const parsed = pinSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Enter the established 5 digit team PIN." });
      if (!(await verifySharedPin(parsed.data.pin))) return res.status(401).json({ error: "Invalid PIN." });
      req.session.incidentReportUnlocked = true;
      req.session.save(() => res.json({ unlocked: true }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", (req: any, res) => {
    if (req.session) delete req.session.incidentReportUnlocked;
    req.session?.save(() => res.json({ ok: true }));
  });

  router.get("/", requireIncidentAccess as RequestHandler, async (_req, res, next) => {
    try {
      const rows = await db.select().from(courtyardIncidentReports)
        .where(eq(courtyardIncidentReports.propertyId, PROPERTY_ID))
        .orderBy(desc(courtyardIncidentReports.incidentDate), desc(courtyardIncidentReports.createdAt))
        .limit(100);
      res.json({ incidents: rows.map(publicIncident) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", requireIncidentAccess as RequestHandler, async (req, res, next) => {
    try {
      const [row] = await db.select().from(courtyardIncidentReports).where(eq(courtyardIncidentReports.id, req.params.id)).limit(1);
      if (!row) return res.status(404).json({ error: "Incident report not found." });
      res.json({ incident: publicIncident(row) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", requireIncidentAccess as RequestHandler, async (req: any, res, next) => {
    try {
      const parsed = incidentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
      const data = parsed.data;
      const [row] = await db.insert(courtyardIncidentReports).values({
        propertyId: PROPERTY_ID,
        incidentNumber: incidentNumber(data.incidentDate),
        incidentDate: data.incidentDate,
        incidentTime: data.incidentTime,
        location: data.location,
        category: data.category,
        severity: data.severity,
        status: "open",
        reportedByName: data.reportedByName,
        reportedByPosition: data.reportedByPosition,
        reportedByUserId: req.incidentUser?.id || null,
        peopleInvolved: data.peopleInvolved,
        guestRooms: data.guestRooms,
        witnesses: data.witnesses,
        description: data.description,
        immediateActions: data.immediateActions,
        injuries: data.injuries,
        propertyDamage: data.propertyDamage,
        vehicleDetails: data.vehicleDetails,
        emergencyServices: data.emergencyServices,
        policeReportNumber: data.policeReportNumber,
        notifications: data.notifications,
        followUpRequired: data.followUpRequired,
        managerNotes: data.managerNotes,
        payloadJson: {},
        updatedAt: new Date(),
      }).returning();
      res.status(201).json({ incident: publicIncident(row) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/status", requireIncidentAccess as RequestHandler, async (req, res, next) => {
    try {
      const parsed = z.object({ status: z.enum(["open", "under_review", "closed"]) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Valid incident status is required." });
      const [row] = await db.update(courtyardIncidentReports)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(eq(courtyardIncidentReports.id, req.params.id))
        .returning();
      if (!row) return res.status(404).json({ error: "Incident report not found." });
      res.json({ incident: publicIncident(row) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/pdf", requireIncidentAccess as RequestHandler, async (req, res, next) => {
    try {
      const [row] = await db.select().from(courtyardIncidentReports).where(eq(courtyardIncidentReports.id, req.params.id)).limit(1);
      if (!row) return res.status(404).json({ error: "Incident report not found." });
      const pdf = await buildIncidentPdf(publicIncident(row));
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${row.incidentNumber}.pdf"`);
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/incidentreport", router);
}
