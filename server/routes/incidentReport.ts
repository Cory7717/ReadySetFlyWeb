import express, { type Express, type RequestHandler } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { pipeline } from "stream/promises";
import { z } from "zod";
import { db } from "../db";
import { courtyardIncidentEvidence, courtyardIncidentReports, courtyardIncidentShareLinks, tipsKioskSettings, tipsUsers } from "@shared/schema";
import { getUncachableResendClient } from "../resendClient";

const PROPERTY_ID = "courtyard-austin-lakeline";
const PROPERTY_NAME = "Courtyard Austin Lakeline";
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

const directEvidenceSchema = z.object({
  storagePath: z.string().startsWith(`${INCIDENT_EVIDENCE_PREFIX}/`).max(500),
  originalFileName: z.string().min(1).max(255),
  mimeType: z.string().refine((value) => /^image\/(jpeg|png|webp)$/i.test(value) || /^(video\/mp4|video\/quicktime)$/i.test(value)),
  size: z.number().int().positive().max(1024 * 1024 * 1024),
  durationSeconds: z.number().int().positive().max(240).nullable().optional(),
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

function shareTokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function publicBaseUrl(req: express.Request) {
  const configured = (process.env.FRONTEND_BASE_URL || process.env.APP_BASE_URL || process.env.WEB_BASE_URL || "").trim();
  if (/^https?:\/\//i.test(configured)) return configured.replace(/\/+$/, "");
  const protocol = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
  return `${protocol}://${req.get("host")}`.replace(/\/+$/, "");
}

async function activeShare(token: string) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const [share] = await db.select().from(courtyardIncidentShareLinks)
    .where(and(
      eq(courtyardIncidentShareLinks.tokenHash, shareTokenHash(token)),
      isNull(courtyardIncidentShareLinks.revokedAt),
      gt(courtyardIncidentShareLinks.expiresAt, new Date()),
    ))
    .limit(1);
  return share || null;
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
    page.drawText(PROPERTY_NAME.toUpperCase(), { x: margin, y, size: 9, font: bold, color: rgb(0.18, 0.37, 0.27) });
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

function incidentFromEmail(configuredFrom: string) {
  const override = process.env.INCIDENT_REPORT_FROM?.trim();
  if (override) return override;
  const addressMatch = configuredFrom.match(/<([^>]+)>/);
  const address = addressMatch?.[1]?.trim() || configuredFrom.trim();
  return `${PROPERTY_NAME} <${address}>`;
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
  const subject = `${PROPERTY_NAME} Incident Report ${incident.incidentNumber}: ${incident.category}`;
  const text = [
    `A ${PROPERTY_NAME} incident report was submitted by ${incident.reportedByName}.`,
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
      <h2 style="color:#243746">${PROPERTY_NAME}</h2>
      <p style="font-weight:bold;color:#765f48">Incident Report</p>
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
    from: incidentFromEmail(fromEmail),
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

  router.get("/share/:token", requireIncidentAccess as RequestHandler, async (req, res, next) => {
    try {
      const share = await activeShare(req.params.token);
      if (!share) return res.status(404).json({ error: "This incident report link is invalid, expired, or revoked." });
      const [row] = await db.select().from(courtyardIncidentReports).where(eq(courtyardIncidentReports.id, share.incidentId)).limit(1);
      if (!row) return res.status(404).json({ error: "Incident report not found." });
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ incident: publicIncident(await incidentWithEvidence(row)), expiresAt: share.expiresAt });
    } catch (error) {
      next(error);
    }
  });

  router.get("/share/:token/pdf", requireIncidentAccess as RequestHandler, async (req, res, next) => {
    try {
      const share = await activeShare(req.params.token);
      if (!share) return res.status(404).json({ error: "This incident report link is invalid, expired, or revoked." });
      const [row] = await db.select().from(courtyardIncidentReports).where(eq(courtyardIncidentReports.id, share.incidentId)).limit(1);
      if (!row) return res.status(404).json({ error: "Incident report not found." });
      const pdf = await buildIncidentPdf(publicIncident(await incidentWithEvidence(row)));
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${row.incidentNumber}.pdf"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  });

  router.get("/share/:token/evidence/:evidenceId", requireIncidentAccess as RequestHandler, async (req, res, next) => {
    try {
      const share = await activeShare(req.params.token);
      if (!share) return res.status(404).json({ error: "This incident report link is invalid, expired, or revoked." });
      const [row] = await db.select().from(courtyardIncidentEvidence)
        .where(and(
          eq(courtyardIncidentEvidence.id, req.params.evidenceId),
          eq(courtyardIncidentEvidence.incidentId, share.incidentId),
        ))
        .limit(1);
      if (!row) return res.status(404).json({ error: "Evidence file not found." });
      res.setHeader("Content-Type", row.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${path.basename(row.originalFileName).replace(/"/g, "")}"`);
      res.setHeader("Cache-Control", "private, no-store");
      if (process.env.AWS_S3_BUCKET) {
        const { S3StorageService } = await import("../s3Storage.js");
        const { stream, contentLength } = await new S3StorageService().getObjectStream({ key: row.storagePath });
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

  router.post("/:id/share", requireIncidentAccess as RequestHandler, async (req: any, res, next) => {
    try {
      const [incident] = await db.select().from(courtyardIncidentReports).where(eq(courtyardIncidentReports.id, req.params.id)).limit(1);
      if (!incident) return res.status(404).json({ error: "Incident report not found." });
      await db.update(courtyardIncidentShareLinks)
        .set({ revokedAt: new Date() })
        .where(and(
          eq(courtyardIncidentShareLinks.incidentId, incident.id),
          isNull(courtyardIncidentShareLinks.revokedAt),
        ));
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.insert(courtyardIncidentShareLinks).values({
        incidentId: incident.id,
        tokenHash: shareTokenHash(token),
        expiresAt,
        createdBy: req.incidentUser?.id || null,
      });
      res.status(201).json({
        shareUrl: `${publicBaseUrl(req)}/incidentreport/share/${token}`,
        expiresAt,
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id/share", requireIncidentAccess as RequestHandler, async (req, res, next) => {
    try {
      await db.update(courtyardIncidentShareLinks)
        .set({ revokedAt: new Date() })
        .where(and(
          eq(courtyardIncidentShareLinks.incidentId, req.params.id),
          isNull(courtyardIncidentShareLinks.revokedAt),
        ));
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/evidence/upload-url", requireIncidentAccess as RequestHandler, async (req, res, next) => {
    try {
      if (!process.env.AWS_S3_BUCKET) return res.status(501).json({ error: "Direct evidence upload is not configured." });
      const parsed = z.object({
        mimeType: z.string().refine((value) => /^image\/(jpeg|png|webp)$/i.test(value) || /^(video\/mp4|video\/quicktime)$/i.test(value)),
        size: z.number().int().positive().max(1024 * 1024 * 1024),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Unsupported evidence file or file size." });
      const [incident] = await db.select().from(courtyardIncidentReports).where(eq(courtyardIncidentReports.id, req.params.id)).limit(1);
      if (!incident) return res.status(404).json({ error: "Incident report not found." });
      const { S3StorageService } = await import("../s3Storage.js");
      const { uploadURL, key } = await new S3StorageService().getPresignedUploadUrlForKey({
        prefix: `${INCIDENT_EVIDENCE_PREFIX}/${incident.id}`,
        contentType: parsed.data.mimeType,
        expiresInSeconds: 3600,
      });
      res.json({ uploadURL, storagePath: key });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/evidence/complete", requireIncidentAccess as RequestHandler, async (req: any, res, next) => {
    try {
      if (!process.env.AWS_S3_BUCKET) return res.status(501).json({ error: "Direct evidence upload is not configured." });
      const parsed = directEvidenceSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid evidence upload details." });
      const [incident] = await db.select().from(courtyardIncidentReports).where(eq(courtyardIncidentReports.id, req.params.id)).limit(1);
      if (!incident) return res.status(404).json({ error: "Incident report not found." });
      const data = parsed.data;
      const evidenceType = data.mimeType.startsWith("video/") ? "video" : "image";
      if (!data.storagePath.startsWith(`${INCIDENT_EVIDENCE_PREFIX}/${incident.id}/`)) {
        return res.status(400).json({ error: "The evidence upload does not belong to this incident." });
      }
      if (evidenceType === "video" && !data.durationSeconds) {
        return res.status(400).json({ error: "Video duration is required." });
      }

      const existing = await db.select().from(courtyardIncidentEvidence).where(eq(courtyardIncidentEvidence.incidentId, incident.id));
      const existingImages = existing.filter((item) => item.evidenceType === "image").length;
      const existingVideoSeconds = existing
        .filter((item) => item.evidenceType === "video")
        .reduce((total, item) => total + Number(item.durationSeconds || 0), 0);
      if (evidenceType === "image" && existingImages >= 10) return res.status(400).json({ error: "This incident already has 10 images." });
      if (evidenceType === "video" && existingVideoSeconds + Number(data.durationSeconds) > 240) {
        return res.status(400).json({ error: "Combined video evidence must be four minutes or less." });
      }

      const { S3StorageService } = await import("../s3Storage.js");
      const object = await new S3StorageService().headObject(data.storagePath);
      if (!object.contentLength || object.contentLength !== data.size) {
        return res.status(400).json({ error: "The uploaded evidence file could not be verified." });
      }
      if (object.contentType && object.contentType !== data.mimeType) {
        return res.status(400).json({ error: "The uploaded evidence file type could not be verified." });
      }

      const [evidence] = await db.insert(courtyardIncidentEvidence).values({
        incidentId: incident.id,
        evidenceType,
        storagePath: data.storagePath,
        originalFileName: data.originalFileName,
        mimeType: data.mimeType,
        size: data.size,
        durationSeconds: evidenceType === "video" ? data.durationSeconds : null,
        uploadedBy: req.incidentUser?.id || null,
      }).returning();
      res.status(201).json({ evidence: publicEvidence(evidence) });
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
