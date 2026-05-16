import express, { type Express, type RequestHandler } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import bcrypt from "bcrypt";
import { z } from "zod";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "../db";
import { createSoftAuthRateLimiter } from "../middleware/rateLimit";
import { getUncachableResendClient } from "../resendClient";
import {
  tipAdminActions,
  tipEntries,
  tipEntryAttachments,
  tipPeriodSubmissions,
  tipsUsers,
} from "@shared/schema";

const TIPS_SUPER_ADMIN_EMAILS = new Set(
  (process.env.TIPS_SUPER_ADMIN_EMAILS || "coryarmer@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

// TODO: set the actual Courtyard Bistro current pay period start date in env/admin settings.
const TIPS_PAY_PERIOD_SEED = process.env.TIPS_PAY_PERIOD_START_DATE || "2026-05-16";
const TIPS_SUBMISSION_RECIPIENT = process.env.TIPS_SUBMISSION_RECIPIENT || "cory.armer@marriott.com";
const PRIVATE_TIPS_ROOT = path.resolve(process.cwd(), "private-uploads", "tips");
const REPORTS_DIR = path.join(PRIVATE_TIPS_ROOT, "reports");
const PDFS_DIR = path.join(PRIVATE_TIPS_ROOT, "pdfs");

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.mkdirSync(PDFS_DIR, { recursive: true });

type TipsUserSession = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeDisplayName: string;
  position: string | null;
  role: "employee" | "manager" | "super_admin";
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(value: string) {
  const match = value.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getPayPeriodForDate(date = new Date()) {
  const seed = parseDateKey(TIPS_PAY_PERIOD_SEED) || parseDateKey("2026-05-16")!;
  const target = parseDateKey(toDateKey(date)) || date;
  const diffDays = Math.floor((target.getTime() - seed.getTime()) / 86_400_000);
  const offset = ((diffDays % 14) + 14) % 14;
  const start = addUtcDays(target, -offset);
  const end = addUtcDays(start, 13);
  return {
    start: toDateKey(start),
    end: toDateKey(end),
    dayNumber: offset + 1,
    days: Array.from({ length: 14 }, (_, index) => toDateKey(addUtcDays(start, index))),
  };
}

function getPayPeriodForEntryDate(entryDate: string) {
  const parsed = parseDateKey(entryDate);
  if (!parsed) return null;
  return getPayPeriodForDate(parsed);
}

function moneyNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function moneyString(value: unknown) {
  return moneyNumber(value).toFixed(2);
}

function resolveTipsRole(user: any): "employee" | "manager" | "super_admin" {
  const email = String(user.email || "").toLowerCase();
  if (TIPS_SUPER_ADMIN_EMAILS.has(email)) return "super_admin";
  if (user.role === "manager" || user.role === "super_admin") return user.role;
  return "employee";
}

function isTipsManager(user: any) {
  const role = resolveTipsRole(user);
  return role === "manager" || role === "super_admin";
}

function isTipsSuperAdmin(user: any) {
  return resolveTipsRole(user) === "super_admin";
}

function publicTipsUser(user: any): TipsUserSession & { isAdmin: boolean; isSuperAdmin: boolean } {
  const email = String(user.email || "");
  const role = resolveTipsRole(user);
  return {
    id: user.id,
    email,
    firstName: user.firstName,
    lastName: user.lastName,
    employeeDisplayName: user.employeeDisplayName,
    position: user.position ?? null,
    role,
    isAdmin: role === "manager" || role === "super_admin",
    isSuperAdmin: role === "super_admin",
  };
}

async function getTipsUserBySession(req: any) {
  const userId = req.session?.tipsUserId;
  if (!userId) return null;
  const [user] = await db.select().from(tipsUsers).where(eq(tipsUsers.id, String(userId))).limit(1);
  return user || null;
}

const requireTipsAuth: RequestHandler = async (req: any, res, next) => {
  try {
    const user = await getTipsUserBySession(req);
    if (!user) return res.status(401).json({ error: "Tips login required" });
    req.tipsUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

const requireTipsAdmin: RequestHandler = async (req: any, res, next) => {
  try {
    const user = await getTipsUserBySession(req);
    if (!user) return res.status(401).json({ error: "Tips login required" });
    if (!isTipsManager(user)) {
      return res.status(403).json({ error: "Tips manager access required" });
    }
    req.tipsUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

const requireTipsSuperAdmin: RequestHandler = async (req: any, res, next) => {
  try {
    const user = await getTipsUserBySession(req);
    if (!user) return res.status(401).json({ error: "Tips login required" });
    if (!isTipsSuperAdmin(user)) return res.status(403).json({ error: "Tips super admin access required" });
    req.tipsUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

const tipsAuthRateLimiter = createSoftAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  anonMax: 20,
  authMax: 40,
  key: "tips_auth",
});

const tipsUploadRateLimiter = createSoftAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  anonMax: 0,
  authMax: 40,
  key: "tips_upload",
});

const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().email(),
  employeeDisplayName: z.string().trim().min(1).max(140).optional(),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const entrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tipAmount: z.coerce.number().min(0).max(100000),
  cashTips: z.coerce.number().min(0).max(100000).default(0),
  creditTips: z.coerce.number().min(0).max(100000).default(0),
  grossSales: z.coerce.number().min(0).max(1000000).default(0),
  coversServed: z.coerce.number().int().min(0).max(10000).optional().nullable(),
  shiftType: z.enum(["breakfast", "lunch", "dinner", "bar", "other"]).default("other"),
  notes: z.string().max(2000).optional().nullable(),
});

const periodSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const updateTipsUserPositionSchema = z.object({
  position: z.string().trim().max(120).nullable().optional(),
});

const updateTipsUserRoleSchema = z.object({
  role: z.enum(["employee", "manager", "super_admin"]),
});

const adminCreateTipsUserSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().email(),
  employeeDisplayName: z.string().trim().min(1).max(140).optional(),
  position: z.string().trim().max(120).optional().nullable(),
  role: z.enum(["employee", "manager", "super_admin"]).default("employee"),
  password: z.string().min(8).max(200),
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, REPORTS_DIR),
    filename: (req: any, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `${req.tipsUser.id}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only image or PDF sales reports are allowed"));
    }
  },
});

function computeTotals(entries: any[], period: ReturnType<typeof getPayPeriodForDate>) {
  const byDate = new Map(entries.map((entry) => [String(entry.entryDate), entry]));
  let week1Total = 0;
  let week2Total = 0;
  const days = period.days.map((date, index) => {
    const entry = byDate.get(date);
    const tipAmount = moneyNumber(entry?.tipAmount);
    if (index < 7) week1Total += tipAmount;
    else week2Total += tipAmount;
    return {
      date,
      dayNumber: index + 1,
      entry: entry
        ? {
            ...entry,
            tipAmount: moneyString(entry.tipAmount),
            cashTips: moneyString(entry.cashTips),
            creditTips: moneyString(entry.creditTips),
            grossSales: moneyString(entry.grossSales),
            attachments: entry.attachments || [],
          }
        : null,
    };
  });
  return {
    days,
    week1Total: moneyString(week1Total),
    week2Total: moneyString(week2Total),
    totalTips: moneyString(week1Total + week2Total),
  };
}

async function getEntriesForPeriod(userId: string, start: string, end: string) {
  const rows = await db
    .select()
    .from(tipEntries)
    .where(and(eq(tipEntries.userId, userId), gte(tipEntries.entryDate, start), lte(tipEntries.entryDate, end)))
    .orderBy(asc(tipEntries.entryDate));

  const attachments = rows.length
    ? await db
        .select()
        .from(tipEntryAttachments)
        .where(inArray(tipEntryAttachments.tipEntryId, rows.map((row) => row.id)))
    : [];
  const attachmentsByEntry = new Map<string, any[]>();
  for (const attachment of attachments) {
    const list = attachmentsByEntry.get(attachment.tipEntryId) || [];
    list.push(attachment);
    attachmentsByEntry.set(attachment.tipEntryId, list);
  }
  return rows.map((row) => ({
    ...row,
    tipAmount: moneyString(row.tipAmount),
    cashTips: moneyString(row.cashTips),
    creditTips: moneyString(row.creditTips),
    grossSales: moneyString(row.grossSales),
    attachments: attachmentsByEntry.get(row.id) || [],
  }));
}

async function getSubmission(userId: string, start: string, end: string) {
  const [submission] = await db
    .select()
    .from(tipPeriodSubmissions)
    .where(and(eq(tipPeriodSubmissions.userId, userId), eq(tipPeriodSubmissions.payPeriodStart, start), eq(tipPeriodSubmissions.payPeriodEnd, end)))
    .limit(1);
  return submission || null;
}

async function buildDashboard(userId: string, requestedStart?: string) {
  const period = requestedStart
    ? { ...getPayPeriodForDate(parseDateKey(requestedStart) || new Date()), start: requestedStart }
    : getPayPeriodForDate();
  const entries = await getEntriesForPeriod(userId, period.start, period.end);
  const submission = await getSubmission(userId, period.start, period.end);
  const totals = computeTotals(entries, period);
  return {
    period: { start: period.start, end: period.end, dayNumber: period.dayNumber },
    entries,
    submission: submission ? { ...submission, week1Total: moneyString(submission.week1Total), week2Total: moneyString(submission.week2Total), totalTips: moneyString(submission.totalTips) } : null,
    ...totals,
  };
}

async function generateTipsPdf(user: any, dashboard: any, submission: any | null) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 742;
  const draw = (text: string, x = 48, size = 10, isBold = false) => {
    if (y < 64) {
      page = pdf.addPage([612, 792]);
      y = 742;
    }
    page.drawText(text.slice(0, 105), { x, y, size, font: isBold ? bold : font, color: rgb(0.08, 0.09, 0.11) });
    y -= size + 8;
  };

  draw("Courtyard Tips Tracker", 48, 18, true);
  draw(`Employee: ${user.employeeDisplayName} (${user.firstName} ${user.lastName})`, 48, 11);
  draw(`Position: ${user.position || "Unassigned"}`, 48, 11);
  draw(`Email: ${user.email}`, 48, 11);
  draw(`Pay period: ${dashboard.period.start} to ${dashboard.period.end}`, 48, 11);
  draw(`Submission status: ${submission?.status || "draft"}`, 48, 11);
  if (submission?.submittedAt) draw(`Submitted: ${new Date(submission.submittedAt).toLocaleString()}`, 48, 11);
  y -= 8;
  draw("Daily Tips", 48, 13, true);
  draw("Date          Tips       Cash       Card       Sales      Covers  Shift      Photo", 48, 9, true);
  dashboard.days.forEach((day: any) => {
    const entry = day.entry;
    draw(
      `${day.date}   $${moneyString(entry?.tipAmount)}   $${moneyString(entry?.cashTips)}   $${moneyString(entry?.creditTips)}   $${moneyString(entry?.grossSales)}   ${entry?.coversServed ?? "-"}   ${entry?.shiftType || "-"}   ${(entry?.attachments?.length || 0) > 0 ? "Yes" : "No"}`,
      48,
      9,
    );
    if (entry?.notes) draw(`Notes: ${String(entry.notes).replace(/\s+/g, " ")}`, 64, 8);
  });
  y -= 8;
  draw(`Week 1 total: $${dashboard.week1Total}`, 48, 12, true);
  draw(`Week 2 total: $${dashboard.week2Total}`, 48, 12, true);
  draw(`Grand total: $${dashboard.totalTips}`, 48, 13, true);
  y -= 8;
  draw("Employee confirmation:", 48, 11, true);
  draw("I confirm these tip amounts are accurate to the best of my knowledge and match the uploaded sales reports.", 48, 9);
  y -= 16;
  draw("Manager review: ________________________________  Date: ________________", 48, 10);

  const bytes = await pdf.save();
  const fileName = `${user.id}-${dashboard.period.start}-${dashboard.period.end}.pdf`;
  const absolutePath = path.join(PDFS_DIR, fileName);
  await fs.promises.writeFile(absolutePath, bytes);
  return path.relative(process.cwd(), absolutePath);
}

async function sendTipsSubmissionEmail(user: any, dashboard: any, submission: any, pdfPath: string) {
  const { client, fromEmail } = await getUncachableResendClient();
  const rows = dashboard.days
    .map((day: any) => {
      const entry = day.entry;
      return `${day.date}: total $${moneyString(entry?.tipAmount)} | cash $${moneyString(entry?.cashTips)} | card $${moneyString(entry?.creditTips)} | sales $${moneyString(entry?.grossSales)} | covers ${entry?.coversServed ?? "-"} | shift ${entry?.shiftType || "-"} | photo ${(entry?.attachments?.length || 0) > 0 ? "yes" : "no"} | notes: ${entry?.notes || ""}`;
    })
    .join("\n");
  const subject = `Tips Submission - ${user.employeeDisplayName} - ${dashboard.period.start} to ${dashboard.period.end}`;
  const adminUrl = new URL("/tips/admin", process.env.FRONTEND_BASE_URL || "https://readysetfly.us").toString();

  await client.emails.send({
    from: fromEmail,
    to: TIPS_SUBMISSION_RECIPIENT,
    subject,
    text: [
      `Employee: ${user.employeeDisplayName}`,
      `Position: ${user.position || "Unassigned"}`,
      `Email: ${user.email}`,
      `Pay period: ${dashboard.period.start} to ${dashboard.period.end}`,
      `Week 1 total: $${dashboard.week1Total}`,
      `Week 2 total: $${dashboard.week2Total}`,
      `Grand total: $${dashboard.totalTips}`,
      `PDF path: ${pdfPath}`,
      `Manager review: ${adminUrl}`,
      "",
      "Daily tips:",
      rows,
      "",
      "The PDF summary and sales report images are available through the protected Tips admin view.",
    ].join("\n"),
  });
}

async function sendTipsAssociateCreatedEmail(params: {
  email: string;
  firstName: string;
  employeeDisplayName: string;
  temporaryPassword: string;
  createdByName: string;
}) {
  const { client, fromEmail } = await getUncachableResendClient();
  const tipsUrl = new URL("/tips", process.env.FRONTEND_BASE_URL || "https://readysetfly.us").toString();

  await client.emails.send({
    from: fromEmail,
    to: params.email,
    subject: "Courtyard Tips Tracker account created",
    text: [
      `Hi ${params.firstName},`,
      "",
      `${params.createdByName} created a Courtyard Tips Tracker account for ${params.employeeDisplayName}.`,
      "",
      `Sign in here: ${tipsUrl}`,
      `Email: ${params.email}`,
      `Temporary password: ${params.temporaryPassword}`,
      "",
      "After signing in, enter your daily tips and upload the sales report photo for each day.",
    ].join("\n"),
  });
}

function resolvePrivateFile(storagePath: string) {
  const absolute = path.resolve(process.cwd(), storagePath);
  if (!absolute.startsWith(PRIVATE_TIPS_ROOT + path.sep)) return null;
  return absolute;
}

export function registerTipsRoutes(app: Express) {
  const router = express.Router();

  router.post("/auth/register", tipsAuthRateLimiter, async (req: any, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid registration details", validation: parsed.error.format() });
      const email = normalizeEmail(parsed.data.email);
      const existing = await db.select({ id: tipsUsers.id }).from(tipsUsers).where(eq(tipsUsers.email, email)).limit(1);
      if (existing.length) return res.status(409).json({ error: "An account already exists for this email." });
      const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
      const displayName = parsed.data.employeeDisplayName?.trim() || `${parsed.data.firstName} ${parsed.data.lastName}`.trim();
      const [user] = await db
        .insert(tipsUsers)
        .values({
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          email,
          employeeDisplayName: displayName,
          role: TIPS_SUPER_ADMIN_EMAILS.has(email) ? "super_admin" : "employee",
          hashedPassword,
        })
        .returning();
      req.session.tipsUserId = user.id;
      req.session.save(() => res.status(201).json({ user: publicTipsUser(user) }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/auth/login", tipsAuthRateLimiter, async (req: any, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid login details" });
      const [user] = await db.select().from(tipsUsers).where(eq(tipsUsers.email, normalizeEmail(parsed.data.email))).limit(1);
      if (!user || !(await bcrypt.compare(parsed.data.password, user.hashedPassword))) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      req.session.tipsUserId = user.id;
      req.session.save(() => res.json({ user: publicTipsUser(user) }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/auth/logout", (req: any, res) => {
    if (req.session) delete req.session.tipsUserId;
    req.session?.save(() => res.json({ ok: true }));
  });

  router.get("/auth/me", async (req: any, res, next) => {
    try {
      const user = await getTipsUserBySession(req);
      res.json({ user: user ? publicTipsUser(user) : null });
    } catch (error) {
      next(error);
    }
  });

  router.get("/dashboard", requireTipsAuth, async (req: any, res, next) => {
    try {
      const parsed = periodSchema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: "Invalid pay period" });
      res.json(await buildDashboard(req.tipsUser.id, parsed.data.start));
    } catch (error) {
      next(error);
    }
  });

  router.post("/entries", requireTipsAuth, async (req: any, res, next) => {
    try {
      const parsed = entrySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid tip entry", validation: parsed.error.format() });
      const period = getPayPeriodForEntryDate(parsed.data.entryDate);
      if (!period) return res.status(400).json({ error: "Invalid entry date" });
      const currentPeriod = getPayPeriodForDate();
      if (period.start !== currentPeriod.start) {
        const existingSubmission = await getSubmission(req.tipsUser.id, period.start, period.end);
        if (!existingSubmission || existingSubmission.status !== "reopened") {
          return res.status(400).json({ error: "Tip date must be in the active pay period unless a manager reopened it." });
        }
      }
      const submission = await getSubmission(req.tipsUser.id, period.start, period.end);
      if (submission && submission.status !== "reopened") return res.status(423).json({ error: "This pay period is locked." });

      const [entry] = await db
        .insert(tipEntries)
        .values({
          userId: req.tipsUser.id,
          entryDate: parsed.data.entryDate,
          payPeriodStart: period.start,
          payPeriodEnd: period.end,
          tipAmount: parsed.data.tipAmount.toFixed(2),
          cashTips: parsed.data.cashTips.toFixed(2),
          creditTips: parsed.data.creditTips.toFixed(2),
          grossSales: parsed.data.grossSales.toFixed(2),
          coversServed: parsed.data.coversServed ?? null,
          shiftType: parsed.data.shiftType,
          notes: parsed.data.notes || null,
          status: "saved",
        })
        .onConflictDoUpdate({
          target: [tipEntries.userId, tipEntries.entryDate],
          set: {
            tipAmount: parsed.data.tipAmount.toFixed(2),
            cashTips: parsed.data.cashTips.toFixed(2),
            creditTips: parsed.data.creditTips.toFixed(2),
            grossSales: parsed.data.grossSales.toFixed(2),
            coversServed: parsed.data.coversServed ?? null,
            shiftType: parsed.data.shiftType,
            notes: parsed.data.notes || null,
            status: "saved",
            updatedAt: new Date(),
          },
        })
        .returning();
      res.json({
        entry: {
          ...entry,
          tipAmount: moneyString(entry.tipAmount),
          cashTips: moneyString(entry.cashTips),
          creditTips: moneyString(entry.creditTips),
          grossSales: moneyString(entry.grossSales),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/entries/:entryId/attachment", requireTipsAuth, tipsUploadRateLimiter, upload.single("salesReport"), async (req: any, res, next) => {
    try {
      const [entry] = await db
        .select()
        .from(tipEntries)
        .where(and(eq(tipEntries.id, req.params.entryId), eq(tipEntries.userId, req.tipsUser.id)))
        .limit(1);
      if (!entry) return res.status(404).json({ error: "Tip entry not found" });
      const submission = await getSubmission(req.tipsUser.id, entry.payPeriodStart, entry.payPeriodEnd);
      if (submission && submission.status !== "reopened") return res.status(423).json({ error: "This pay period is locked." });
      if (!req.file) return res.status(400).json({ error: "Sales report file is required" });

      await db.delete(tipEntryAttachments).where(eq(tipEntryAttachments.tipEntryId, entry.id));
      const [attachment] = await db
        .insert(tipEntryAttachments)
        .values({
          tipEntryId: entry.id,
          storagePath: path.relative(process.cwd(), req.file.path),
          originalFileName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
        })
        .returning();
      res.status(201).json({ attachment });
    } catch (error) {
      next(error);
    }
  });

  router.get("/attachments/:attachmentId/view", requireTipsAuth, async (req: any, res, next) => {
    try {
      const [row] = await db
        .select({ attachment: tipEntryAttachments, entry: tipEntries })
        .from(tipEntryAttachments)
        .innerJoin(tipEntries, eq(tipEntryAttachments.tipEntryId, tipEntries.id))
        .where(eq(tipEntryAttachments.id, req.params.attachmentId))
        .limit(1);
      if (!row) return res.status(404).json({ error: "Attachment not found" });
      const isOwner = row.entry.userId === req.tipsUser.id;
      const isAdmin = isTipsManager(req.tipsUser);
      if (!isOwner && !isAdmin) return res.status(403).json({ error: "Forbidden" });
      const absolute = resolvePrivateFile(row.attachment.storagePath);
      if (!absolute || !fs.existsSync(absolute)) return res.status(404).json({ error: "Attachment file not found" });
      res.type(row.attachment.mimeType);
      res.sendFile(absolute);
    } catch (error) {
      next(error);
    }
  });

  router.post("/submissions", requireTipsAuth, async (req: any, res, next) => {
    try {
      const parsed = periodSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: "Invalid pay period" });
      const dashboard = await buildDashboard(req.tipsUser.id, parsed.data.start);
      const missingImages = dashboard.days.filter((day: any) => day.entry && (!day.entry.attachments || day.entry.attachments.length === 0));
      if (missingImages.length > 0) return res.status(400).json({ error: "Every saved tip entry needs a sales report photo before final submission." });
      const existing = await getSubmission(req.tipsUser.id, dashboard.period.start, dashboard.period.end);
      if (existing && existing.status !== "reopened") return res.status(409).json({ error: "This pay period has already been submitted." });

      let [submission] = await db
        .insert(tipPeriodSubmissions)
        .values({
          userId: req.tipsUser.id,
          payPeriodStart: dashboard.period.start,
          payPeriodEnd: dashboard.period.end,
          week1Total: dashboard.week1Total,
          week2Total: dashboard.week2Total,
          totalTips: dashboard.totalTips,
          status: "submitted",
          submittedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [tipPeriodSubmissions.userId, tipPeriodSubmissions.payPeriodStart, tipPeriodSubmissions.payPeriodEnd],
          set: {
            week1Total: dashboard.week1Total,
            week2Total: dashboard.week2Total,
            totalTips: dashboard.totalTips,
            status: "submitted",
            submittedAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();

      const pdfPath = await generateTipsPdf(req.tipsUser, dashboard, submission);
      [submission] = await db
        .update(tipPeriodSubmissions)
        .set({ pdfPath, updatedAt: new Date() })
        .where(eq(tipPeriodSubmissions.id, submission.id))
        .returning();
      await db
        .update(tipEntries)
        .set({ status: "submitted", updatedAt: new Date() })
        .where(and(eq(tipEntries.userId, req.tipsUser.id), eq(tipEntries.payPeriodStart, dashboard.period.start), eq(tipEntries.payPeriodEnd, dashboard.period.end)));

      void sendTipsSubmissionEmail(req.tipsUser, dashboard, submission, pdfPath).catch((error) => {
        console.error("Failed to send tips submission email:", error);
      });

      res.status(201).json({ submission: { ...submission, week1Total: moneyString(submission.week1Total), week2Total: moneyString(submission.week2Total), totalTips: moneyString(submission.totalTips) } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/submissions/pdf", requireTipsAuth, async (req: any, res, next) => {
    try {
      const parsed = periodSchema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: "Invalid pay period" });
      const dashboard = await buildDashboard(req.tipsUser.id, parsed.data.start);
      const submission = await getSubmission(req.tipsUser.id, dashboard.period.start, dashboard.period.end);
      const pdfPath = submission?.pdfPath || (await generateTipsPdf(req.tipsUser, dashboard, submission));
      const absolute = resolvePrivateFile(pdfPath);
      if (!absolute || !fs.existsSync(absolute)) return res.status(404).json({ error: "PDF not found" });
      res.download(absolute, `courtyard-tips-${dashboard.period.start}-${dashboard.period.end}.pdf`);
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/submissions", requireTipsAdmin, async (_req: any, res, next) => {
    try {
      const rows = await db
        .select({ submission: tipPeriodSubmissions, user: tipsUsers })
        .from(tipPeriodSubmissions)
        .innerJoin(tipsUsers, eq(tipPeriodSubmissions.userId, tipsUsers.id))
        .orderBy(desc(tipPeriodSubmissions.payPeriodStart), asc(tipsUsers.employeeDisplayName));
      res.json({ submissions: rows.map((row) => ({ ...row.submission, user: publicTipsUser(row.user), week1Total: moneyString(row.submission.week1Total), week2Total: moneyString(row.submission.week2Total), totalTips: moneyString(row.submission.totalTips) })) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/users", requireTipsAdmin, async (_req: any, res, next) => {
    try {
      const users = await db.select().from(tipsUsers).orderBy(asc(tipsUsers.employeeDisplayName));
      res.json({ users: users.map(publicTipsUser) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/users", requireTipsAdmin, async (req: any, res, next) => {
    try {
      const parsed = adminCreateTipsUserSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid associate details", validation: parsed.error.format() });
      const email = normalizeEmail(parsed.data.email);
      const existing = await db.select({ id: tipsUsers.id }).from(tipsUsers).where(eq(tipsUsers.email, email)).limit(1);
      if (existing.length) return res.status(409).json({ error: "An associate already exists for this email." });
      const requestedRole = isTipsSuperAdmin(req.tipsUser) ? parsed.data.role : "employee";
      const [created] = await db.insert(tipsUsers).values({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email,
        employeeDisplayName: parsed.data.employeeDisplayName?.trim() || `${parsed.data.firstName} ${parsed.data.lastName}`.trim(),
        position: parsed.data.position?.trim() || null,
        role: TIPS_SUPER_ADMIN_EMAILS.has(email) ? "super_admin" : requestedRole,
        hashedPassword: await bcrypt.hash(parsed.data.password, 12),
      }).returning();
      await db.insert(tipAdminActions).values({
        actorUserId: req.tipsUser.id,
        targetUserId: created.id,
        action: "user_created",
        metadataJson: { role: created.role, position: created.position },
      });
      void sendTipsAssociateCreatedEmail({
        email,
        firstName: created.firstName,
        employeeDisplayName: created.employeeDisplayName,
        temporaryPassword: parsed.data.password,
        createdByName: req.tipsUser.employeeDisplayName || req.tipsUser.email,
      }).catch((error) => {
        console.error("Failed to send tips associate created email:", error);
      });
      res.status(201).json({ user: publicTipsUser(created) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/users/:id/position", requireTipsSuperAdmin, async (req: any, res, next) => {
    try {
      const parsed = updateTipsUserPositionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid position" });
      const normalizedPosition = parsed.data.position?.trim() || null;
      const [updated] = await db
        .update(tipsUsers)
        .set({ position: normalizedPosition, updatedAt: new Date() })
        .where(eq(tipsUsers.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ error: "Tips user not found" });
      await db.insert(tipAdminActions).values({
        actorUserId: req.tipsUser.id,
        targetUserId: updated.id,
        action: "user_position_updated",
        metadataJson: { position: normalizedPosition },
      });
      res.json({ user: publicTipsUser(updated) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/users/:id/role", requireTipsSuperAdmin, async (req: any, res, next) => {
    try {
      const parsed = updateTipsUserRoleSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid role" });
      const [target] = await db.select().from(tipsUsers).where(eq(tipsUsers.id, req.params.id)).limit(1);
      if (!target) return res.status(404).json({ error: "Tips user not found" });
      const targetEmail = String(target.email || "").toLowerCase();
      const nextRole = TIPS_SUPER_ADMIN_EMAILS.has(targetEmail) ? "super_admin" : parsed.data.role;
      const [updated] = await db.update(tipsUsers).set({ role: nextRole, updatedAt: new Date() }).where(eq(tipsUsers.id, target.id)).returning();
      await db.insert(tipAdminActions).values({
        actorUserId: req.tipsUser.id,
        targetUserId: updated.id,
        action: "user_role_updated",
        metadataJson: { role: nextRole },
      });
      res.json({ user: publicTipsUser(updated) });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/admin/users/:id", requireTipsSuperAdmin, async (req: any, res, next) => {
    try {
      const [target] = await db.select().from(tipsUsers).where(eq(tipsUsers.id, req.params.id)).limit(1);
      if (!target) return res.status(404).json({ error: "Tips user not found" });
      if (isTipsSuperAdmin(target)) return res.status(400).json({ error: "The Tips super admin cannot be deleted." });
      await db.insert(tipAdminActions).values({
        actorUserId: req.tipsUser.id,
        targetUserId: null,
        action: "user_deleted",
        metadataJson: { deletedUserId: target.id, email: target.email },
      });
      await db.delete(tipsUsers).where(eq(tipsUsers.id, target.id));
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/submissions/:id/status", requireTipsAdmin, async (req: any, res, next) => {
    try {
      const status = z.enum(["reopened", "approved", "exported"]).parse(req.body?.status);
      const [submission] = await db.update(tipPeriodSubmissions).set({
        status,
        reviewedAt: new Date(),
        reviewedBy: req.tipsUser.id,
        updatedAt: new Date(),
      }).where(eq(tipPeriodSubmissions.id, req.params.id)).returning();
      if (!submission) return res.status(404).json({ error: "Submission not found" });
      if (status === "reopened") {
        await db.update(tipEntries).set({ status: "saved", updatedAt: new Date() }).where(and(eq(tipEntries.userId, submission.userId), eq(tipEntries.payPeriodStart, submission.payPeriodStart), eq(tipEntries.payPeriodEnd, submission.payPeriodEnd)));
      }
      await db.insert(tipAdminActions).values({
        actorUserId: req.tipsUser.id,
        targetUserId: submission.userId,
        action: `submission_${status}`,
        metadataJson: { submissionId: submission.id, payPeriodStart: submission.payPeriodStart, payPeriodEnd: submission.payPeriodEnd },
      });
      res.json({ submission });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/submissions/:id/pdf", requireTipsAdmin, async (req: any, res, next) => {
    try {
      const [row] = await db
        .select({ submission: tipPeriodSubmissions, user: tipsUsers })
        .from(tipPeriodSubmissions)
        .innerJoin(tipsUsers, eq(tipPeriodSubmissions.userId, tipsUsers.id))
        .where(eq(tipPeriodSubmissions.id, req.params.id))
        .limit(1);
      if (!row) return res.status(404).json({ error: "Submission not found" });
      const dashboard = await buildDashboard(row.user.id, row.submission.payPeriodStart);
      const pdfPath = row.submission.pdfPath || (await generateTipsPdf(row.user, dashboard, row.submission));
      const absolute = resolvePrivateFile(pdfPath);
      if (!absolute || !fs.existsSync(absolute)) return res.status(404).json({ error: "PDF not found" });
      res.download(absolute, `courtyard-tips-${row.user.employeeDisplayName}-${row.submission.payPeriodStart}.pdf`);
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/export.csv", requireTipsAdmin, async (_req: any, res, next) => {
    try {
      const rows = await db
        .select({ submission: tipPeriodSubmissions, user: tipsUsers })
        .from(tipPeriodSubmissions)
        .innerJoin(tipsUsers, eq(tipPeriodSubmissions.userId, tipsUsers.id))
        .orderBy(desc(tipPeriodSubmissions.payPeriodStart), asc(tipsUsers.employeeDisplayName));
      const csv = [
        ["employee", "email", "position", "period_start", "period_end", "week1_total", "week2_total", "total_tips", "status", "submitted_at"].join(","),
        ...rows.map((row) =>
          [
            JSON.stringify(row.user.employeeDisplayName),
            JSON.stringify(row.user.email),
            JSON.stringify(row.user.position || ""),
            row.submission.payPeriodStart,
            row.submission.payPeriodEnd,
            moneyString(row.submission.week1Total),
            moneyString(row.submission.week2Total),
            moneyString(row.submission.totalTips),
            row.submission.status,
            row.submission.submittedAt ? new Date(row.submission.submittedAt).toISOString() : "",
          ].join(","),
        ),
      ].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=\"courtyard-tips-export.csv\"");
      res.send(csv);
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/export-daily.csv", requireTipsAdmin, async (_req: any, res, next) => {
    try {
      const rows = await db
        .select({ entry: tipEntries, user: tipsUsers })
        .from(tipEntries)
        .innerJoin(tipsUsers, eq(tipEntries.userId, tipsUsers.id))
        .orderBy(desc(tipEntries.payPeriodStart), asc(tipsUsers.employeeDisplayName), asc(tipEntries.entryDate));
      const csv = [
        ["employee", "email", "position", "entry_date", "period_start", "period_end", "shift_type", "gross_sales", "cash_tips", "credit_tips", "total_tips", "covers_served", "notes", "status"].join(","),
        ...rows.map((row) =>
          [
            JSON.stringify(row.user.employeeDisplayName),
            JSON.stringify(row.user.email),
            JSON.stringify(row.user.position || ""),
            row.entry.entryDate,
            row.entry.payPeriodStart,
            row.entry.payPeriodEnd,
            row.entry.shiftType || "other",
            moneyString(row.entry.grossSales),
            moneyString(row.entry.cashTips),
            moneyString(row.entry.creditTips),
            moneyString(row.entry.tipAmount),
            row.entry.coversServed ?? "",
            JSON.stringify(row.entry.notes || ""),
            row.entry.status,
          ].join(","),
        ),
      ].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=\"courtyard-tips-daily-export.csv\"");
      res.send(csv);
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/tips", router);
}
