import express, { type Express, type RequestHandler } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { desc, eq, inArray } from "drizzle-orm";
import { pipeline } from "stream/promises";
import { z } from "zod";
import { db } from "../db";
import { courtyardIncidentEvidence, courtyardIncidentReports, tipsKioskSettings, tipsUsers } from "@shared/schema";
import { getUncachableResendClient } from "../resendClient";

const PROPERTY_ID = "courtyard-austin-lakeline";
const DEFAULT_INCIDENT_RECIPIENTS = "coryarmer@gmail.com,cory.armer@marriott.com";
const INCIDENT_EVIDENCE_PREFIX = "uploads/courtyard-incidents";
const incidentEvidenceDir = path.resolve(process.cwd(), "uploads", "courtyard-incidents");
fs.mkdirSync(incidentEvidenceDir, { recursive: true });

const evidenceUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, incidentEvidenceDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(10).toString("hex")}${ext}`);
    },
  }),
  limits: { files: 20, fileSize: 300 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/i.test(file.mimetype) || /^(video\/mp4|video\/quicktime)$/i.test(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error("Evidence must be a JPEG, PNG, WebP, MP4, or QuickTime file."));
  },
});

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
    emailSentAt: row.emailSentAt,
    emailError: row.emailError || "",
    evidence: Array.isArray(row.evidence) ? row.evidence.map(publicEvidence) : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function publicEvidence(row: any) {
  return {
    id: row.id,
    evidenceType: row.evidenceType,
    originalFileName: row.originalFileName,
    mimeType: row.mimeType,
    size: row.size,
    durationSeconds: row.durationSeconds,
    uploadedAt: row.uploadedAt,
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
  if (incident.evidence?.length) {
    field("Digital evidence retained", incident.evidence.map((item: any) => {
      const duration = item.durationSeconds ? ` (${item.durationSeconds} seconds)` : "";
      return `${item.evidenceType}: ${item.originalFileName}${duration}`;
    }).join("\n"));
  }

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

async function readBoxHeader(handle: fs.promises.FileHandle, position: number, boundary: number) {
  if (position + 8 > boundary) return null;
  const header = Buffer.alloc(16);
  const { bytesRead } = await handle.read(header, 0, 16, position);
  if (bytesRead < 8) return null;
  let size = header.readUInt32BE(0);
  const type = header.toString("ascii", 4, 8);
  let headerSize = 8;
  if (size === 1) {
    if (bytesRead < 16) return null;
    const largeSize = header.readBigUInt64BE(8);
    if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(largeSize);
    headerSize = 16;
  } else if (size === 0) {
    size = boundary - position;
  }
  if (size < headerSize || position + size > boundary) return null;
  return { position, size, type, headerSize };
}

async function mp4DurationSeconds(filePath: string) {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const stats = await handle.stat();
    let topPosition = 0;
    while (topPosition < stats.size) {
      const box = await readBoxHeader(handle, topPosition, stats.size);
      if (!box) break;
      if (box.type === "moov") {
        let childPosition = box.position + box.headerSize;
        const boundary = box.position + box.size;
        while (childPosition < boundary) {
          const child = await readBoxHeader(handle, childPosition, boundary);
          if (!child) break;
          if (child.type === "mvhd") {
            const data = Buffer.alloc(32);
            const { bytesRead } = await handle.read(data, 0, data.length, child.position + child.headerSize);
            if (bytesRead < 20) throw new Error("The video duration could not be read.");
            const version = data.readUInt8(0);
            if (version === 1 && bytesRead < 32) throw new Error("The video duration could not be read.");
            const timescale = version === 1 ? data.readUInt32BE(20) : data.readUInt32BE(12);
            const duration = version === 1 ? Number(data.readBigUInt64BE(24)) : data.readUInt32BE(16);
            if (!timescale || !Number.isFinite(duration)) throw new Error("The video duration could not be read.");
            return Math.ceil(duration / timescale);
          }
          childPosition += child.size;
        }
      }
      topPosition += box.size;
    }
    throw new Error("The uploaded video is not a supported MP4 or QuickTime file.");
  } finally {
    await handle.close();
  }
}

async function removeUploadedFiles(files: Express.Multer.File[]) {
  await Promise.allSettled(files.map((file) => fs.promises.unlink(file.path)));
}

async function incidentWithEvidence(row: any) {
  const evidence = await db.select().from(courtyardIncidentEvidence)
    .where(eq(courtyardIncidentEvidence.incidentId, row.id))
    .orderBy(courtyardIncidentEvidence.uploadedAt);
  return { ...row, evidence };
}

function incidentEmailRecipients() {
  return (process.env.INCIDENT_REPORT_RECIPIENTS || DEFAULT_INCIDENT_RECIPIENTS)
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function emailIncidentReport(row: any) {
  const incident = publicIncident(await incidentWithEvidence(row));
  const recipients = incidentEmailRecipients();
  if (!recipients.length) throw new Error("No incident report email recipients are configured.");

  const pdf = await buildIncidentPdf(incident);
  const { client, fromEmail } = await getUncachableResendClient();
  const subject = `Incident Report ${incident.incidentNumber}: ${incident.category}`;
  const text = [
    `A Courtyard incident report was submitted by ${incident.reportedByName}.`,
    "",
    `Incident: ${incident.incidentNumber}`,
    `Date and time: ${incident.incidentDate} at ${incident.incidentTime}`,
    `Location: ${incident.location}`,
    `Category: ${incident.category}`,
    `Severity: ${incident.severity}`,
    "",
    "The complete, printable incident report is attached as a PDF.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#201814;line-height:1.5">
      <h2 style="color:#243746">Courtyard Incident Report</h2>
      <p>A new incident report was submitted by <strong>${escapeHtml(incident.reportedByName)}</strong>.</p>
      <table style="border-collapse:collapse;width:100%;max-width:650px">
        <tr><td style="padding:6px;border:1px solid #d7c8b5"><strong>Incident</strong></td><td style="padding:6px;border:1px solid #d7c8b5">${escapeHtml(incident.incidentNumber)}</td></tr>
        <tr><td style="padding:6px;border:1px solid #d7c8b5"><strong>Date / time</strong></td><td style="padding:6px;border:1px solid #d7c8b5">${escapeHtml(incident.incidentDate)} at ${escapeHtml(incident.incidentTime)}</td></tr>
        <tr><td style="padding:6px;border:1px solid #d7c8b5"><strong>Location</strong></td><td style="padding:6px;border:1px solid #d7c8b5">${escapeHtml(incident.location)}</td></tr>
        <tr><td style="padding:6px;border:1px solid #d7c8b5"><strong>Category</strong></td><td style="padding:6px;border:1px solid #d7c8b5">${escapeHtml(incident.category)}</td></tr>
        <tr><td style="padding:6px;border:1px solid #d7c8b5"><strong>Severity</strong></td><td style="padding:6px;border:1px solid #d7c8b5">${escapeHtml(incident.severity)}</td></tr>
      </table>
      <p>The complete, printable incident report is attached as a PDF and can be forwarded directly.</p>
    </div>
  `;

  await client.emails.send({
    from: fromEmail,
    to: recipients,
    subject,
    text,
    html,
    attachments: [{ filename: `${incident.incidentNumber}.pdf`, content: pdf }],
  });
}

async function sendAndTrackIncidentEmail(row: any) {
  try {
    await emailIncidentReport(row);
    const sentAt = new Date();
    const [updated] = await db.update(courtyardIncidentReports)
      .set({ emailSentAt: sentAt, emailError: null, updatedAt: sentAt })
      .where(eq(courtyardIncidentReports.id, row.id))
      .returning();
    return { row: updated || row, sent: true, error: "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Incident report email could not be sent.";
    console.error(`[incident-report] Email failed for ${row.incidentNumber}:`, error);
    const [updated] = await db.update(courtyardIncidentReports)
      .set({ emailError: message, updatedAt: new Date() })
      .where(eq(courtyardIncidentReports.id, row.id))
      .returning();
    return { row: updated || row, sent: false, error: message };
  }
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
      const evidence = rows.length
        ? await db.select().from(courtyardIncidentEvidence).where(inArray(courtyardIncidentEvidence.incidentId, rows.map((row) => row.id)))
        : [];
      const byIncident = new Map<string, any[]>();
      for (const item of evidence) byIncident.set(item.incidentId, [...(byIncident.get(item.incidentId) || []), item]);
      res.json({ incidents: rows.map((row) => publicIncident({ ...row, evidence: byIncident.get(row.id) || [] })) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", requireIncidentAccess as RequestHandler, async (req, res, next) => {
    try {
      const [row] = await db.select().from(courtyardIncidentReports).where(eq(courtyardIncidentReports.id, req.params.id)).limit(1);
      if (!row) return res.status(404).json({ error: "Incident report not found." });
      res.json({ incident: publicIncident(await incidentWithEvidence(row)) });
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
      const delivery = await sendAndTrackIncidentEmail(row);
      res.status(201).json({
        incident: publicIncident(delivery.row),
        emailDelivery: { sent: delivery.sent, error: delivery.error },
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id", requireIncidentAccess as RequestHandler, async (req: any, res, next) => {
    try {
      const parsed = incidentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
      const [existing] = await db.select().from(courtyardIncidentReports)
        .where(eq(courtyardIncidentReports.id, req.params.id))
        .limit(1);
      if (!existing) return res.status(404).json({ error: "Incident report not found." });

      const data = parsed.data;
      const previousPayload = existing.payloadJson && typeof existing.payloadJson === "object" ? existing.payloadJson : {};
      const [row] = await db.update(courtyardIncidentReports).set({
        incidentDate: data.incidentDate,
        incidentTime: data.incidentTime,
        location: data.location,
        category: data.category,
        severity: data.severity,
        reportedByName: data.reportedByName,
        reportedByPosition: data.reportedByPosition,
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
        payloadJson: {
          ...previousPayload,
          lastEditedAt: new Date().toISOString(),
          lastEditedByUserId: req.incidentUser?.id || null,
        },
        updatedAt: new Date(),
      }).where(eq(courtyardIncidentReports.id, req.params.id)).returning();
      res.json({ incident: publicIncident(await incidentWithEvidence(row)) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/email", requireIncidentAccess as RequestHandler, async (req, res, next) => {
    try {
      const [row] = await db.select().from(courtyardIncidentReports).where(eq(courtyardIncidentReports.id, req.params.id)).limit(1);
      if (!row) return res.status(404).json({ error: "Incident report not found." });
      const delivery = await sendAndTrackIncidentEmail(row);
      if (!delivery.sent) return res.status(502).json({ error: delivery.error });
      res.json({ incident: publicIncident(delivery.row), emailDelivery: { sent: true } });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/evidence", requireIncidentAccess as RequestHandler, (req: any, res, next) => {
    evidenceUpload.array("evidence", 20)(req, res, async (uploadError: any) => {
      const files = ((req.files || []) as Express.Multer.File[]);
      try {
        if (uploadError) {
          await removeUploadedFiles(files);
          const message = uploadError instanceof multer.MulterError && uploadError.code === "LIMIT_FILE_SIZE"
            ? "An evidence file exceeds the 300 MB limit."
            : uploadError.message || "Evidence upload failed.";
          return res.status(400).json({ error: message });
        }
        const [incident] = await db.select().from(courtyardIncidentReports).where(eq(courtyardIncidentReports.id, req.params.id)).limit(1);
        if (!incident) {
          await removeUploadedFiles(files);
          return res.status(404).json({ error: "Incident report not found." });
        }
        if (!files.length) return res.status(400).json({ error: "Choose at least one image or video." });

        const existing = await db.select().from(courtyardIncidentEvidence).where(eq(courtyardIncidentEvidence.incidentId, incident.id));
        const imageFiles = files.filter((file) => file.mimetype.startsWith("image/"));
        const videoFiles = files.filter((file) => file.mimetype.startsWith("video/"));
        const existingImages = existing.filter((item) => item.evidenceType === "image").length;
        const existingVideoSeconds = existing
          .filter((item) => item.evidenceType === "video")
          .reduce((total, item) => total + Number(item.durationSeconds || 0), 0);
        if (existingImages + imageFiles.length > 10) {
          await removeUploadedFiles(files);
          return res.status(400).json({ error: "Each incident supports up to 10 images." });
        }

        const videoDurations = new Map<string, number>();
        let uploadedVideoSeconds = 0;
        for (const file of videoFiles) {
          const duration = await mp4DurationSeconds(file.path);
          uploadedVideoSeconds += duration;
          videoDurations.set(file.filename, duration);
        }
        if (existingVideoSeconds + uploadedVideoSeconds > 240) {
          await removeUploadedFiles(files);
          return res.status(400).json({ error: "Combined video evidence must be four minutes or less." });
        }

        const inserted = [];
        for (const file of files) {
          const storagePath = `${INCIDENT_EVIDENCE_PREFIX}/${file.filename}`;
          if (process.env.AWS_S3_BUCKET) {
            const { S3StorageService } = await import("../s3Storage.js");
            const s3Service = new S3StorageService();
            await s3Service.uploadFile({ key: storagePath, filePath: file.path, contentType: file.mimetype });
            await fs.promises.unlink(file.path);
          }
          const [evidence] = await db.insert(courtyardIncidentEvidence).values({
            incidentId: incident.id,
            evidenceType: file.mimetype.startsWith("video/") ? "video" : "image",
            storagePath,
            originalFileName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            durationSeconds: videoDurations.get(file.filename) || null,
            uploadedBy: req.incidentUser?.id || null,
          }).returning();
          inserted.push(publicEvidence(evidence));
        }
        res.status(201).json({ evidence: inserted });
      } catch (error) {
        await removeUploadedFiles(files);
        next(error);
      }
    });
  });

  router.get("/:id/evidence/:evidenceId", requireIncidentAccess as RequestHandler, async (req, res, next) => {
    try {
      const [row] = await db.select().from(courtyardIncidentEvidence)
        .where(eq(courtyardIncidentEvidence.id, req.params.evidenceId))
        .limit(1);
      if (!row || row.incidentId !== req.params.id) return res.status(404).json({ error: "Evidence file not found." });
      res.setHeader("Content-Type", row.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${path.basename(row.originalFileName).replace(/"/g, "")}"`);
      res.setHeader("Cache-Control", "private, max-age=3600");
      if (process.env.AWS_S3_BUCKET) {
        const { S3StorageService } = await import("../s3Storage.js");
        const s3Service = new S3StorageService();
        const { stream, contentLength } = await s3Service.getObjectStream({ key: row.storagePath });
        if (contentLength) res.setHeader("Content-Length", String(contentLength));
        await pipeline(stream, res);
        return;
      }
      const filePath = path.resolve(process.cwd(), row.storagePath);
      if (!filePath.startsWith(`${incidentEvidenceDir}${path.sep}`) || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Evidence file not found." });
      }
      res.sendFile(filePath);
    } catch (error: any) {
      if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
        return res.status(404).json({ error: "Evidence file not found." });
      }
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
      const pdf = await buildIncidentPdf(publicIncident(await incidentWithEvidence(row)));
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${row.incidentNumber}.pdf"`);
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/incidentreport", router);
}
