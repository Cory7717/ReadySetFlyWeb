import express, { type Express, type RequestHandler } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import bcrypt from "bcrypt";
import { and, desc, eq } from "drizzle-orm";
import { createRequire } from "module";
import { db } from "../db";
import {
  scheduleEmployees,
  scheduleShiftAssignments,
  scheduleShiftTypes,
  courtyardOpsReportDrafts,
  courtyardOpsReportUserSettings,
  tipsKioskSettings,
  tipsUsers,
  weeklySchedules,
} from "@shared/schema";

const require = createRequire(import.meta.url);
const laborUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname)) return cb(null, true);
    cb(new Error("Upload a PDF labor summary."));
  },
});
const reportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls") || file.mimetype === "text/csv" || file.mimetype.includes("spreadsheet")) return cb(null, true);
    cb(new Error("Upload a CSV or XLSX ops report."));
  },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const pinSchema = z.object({
  pin: z.string().regex(/^\d{5}$/, "PIN must be exactly 5 digits"),
});
const draftSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekLabel: z.string().min(1).default("Week 1"),
  payload: z.record(z.unknown()),
  uploadedReports: z.array(z.record(z.unknown())).default([]),
});

const OPS_REPORT_ADMIN_EMAILS = new Set(
  (process.env.OPS_REPORT_ADMIN_EMAILS || "coryarmer@gmail.com,cory.armer@marriott.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function publicOpsUser(user: any) {
  const email = normalizeEmail(String(user.email || ""));
  const role = OPS_REPORT_ADMIN_EMAILS.has(email) || user.role === "super_admin" ? "super_admin" : user.role === "manager" ? "manager" : "employee";
  const explicitAccess = getExplicitToolAccess(user, "opsreport");
  const unlocked = explicitAccess ?? (role === "manager" || role === "super_admin");
  return {
    id: user.id,
    email,
    employeeDisplayName: user.employeeDisplayName,
    role,
    isAdmin: unlocked,
    isSuperAdmin: role === "super_admin",
    toolAccess: getToolAccess(user),
    disabledAt: user.disabledAt ?? null,
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

function getToolAccess(user: any): Record<string, boolean> {
  const access = user?.toolAccessJson;
  return access && typeof access === "object" && !Array.isArray(access) ? access as Record<string, boolean> : {};
}

function getExplicitToolAccess(user: any, tool: "schedule" | "tips" | "opsreport") {
  const value = getToolAccess(user)[tool];
  return typeof value === "boolean" ? value : null;
}

async function getUserBySession(req: any) {
  const userId = req.session?.tipsUserId;
  if (!userId) return null;
  const [user] = await db.select().from(tipsUsers).where(eq(tipsUsers.id, String(userId))).limit(1);
  return user || null;
}

async function getStoredPinHash() {
  const [opsRow] = await db.select().from(tipsKioskSettings).where(eq(tipsKioskSettings.key, "ops_report_pin_hash")).limit(1);
  if (opsRow?.value) return opsRow.value;
  const [tipsRow] = await db.select().from(tipsKioskSettings).where(eq(tipsKioskSettings.key, "pin_hash")).limit(1);
  return tipsRow?.value || "";
}

async function hasOpsPin() {
  return Boolean(await getStoredPinHash() || process.env.OPS_REPORT_PIN || process.env.TIPS_KIOSK_PIN);
}

async function verifyOpsPin(pin: string) {
  const hash = await getStoredPinHash();
  if (hash) return bcrypt.compare(pin, hash);
  return Boolean((process.env.OPS_REPORT_PIN && process.env.OPS_REPORT_PIN === pin) || (process.env.TIPS_KIOSK_PIN && process.env.TIPS_KIOSK_PIN === pin));
}

async function requireOpsManager(req: any, res: any, next: any) {
  try {
    const user = await getUserBySession(req);
    if (user && !user.disabledAt) {
      const publicUser = publicOpsUser(user);
      if (publicUser.mustChangePassword) return res.status(403).json({ error: "Password change required." });
      if (publicUser.isAdmin) {
        req.opsUser = publicUser;
        return next();
      }
    }
    if (req.session?.opsReportUnlocked) {
      req.opsUser = null;
      return next();
    }
    return res.status(401).json({ error: "Ops report PIN required." });
  } catch (error) {
    next(error);
  }
}

function minutesFromTime(value?: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function shiftHours(assignment: any, shiftType: any) {
  const label = String(assignment?.roleWorked || shiftType?.label || "").trim().toUpperCase();
  if (["OFF", "PTO", "CALL OFF", "OPEN SHIFT"].includes(label)) return 0;
  const start = minutesFromTime(assignment.customStartTime || shiftType?.startTime);
  const end = minutesFromTime(assignment.customEndTime || shiftType?.endTime);
  if (start == null || end == null) return 0;
  let duration = end - start;
  if (duration <= 0 || shiftType?.isOvernight || label.includes("AUDIT") || label.includes("NIGHT")) duration += 24 * 60;
  const breakMinutes = assignment.unpaidBreakMinutes ?? shiftType?.unpaidBreakMinutes ?? 0;
  return Math.max(0, (duration - breakMinutes) / 60);
}

function opsDepartmentForSchedule(employee: any, assignment: any, shiftType: any) {
  const value = String(assignment?.roleWorked || shiftType?.departmentHint || shiftType?.label || employee?.department || "").toLowerCase();
  if (value.includes("audit") || value.includes("night") || value.includes("front") || value.includes("fd ") || value.includes("desk")) return "FRONT DESK / NIGHT AUDIT HOURS";
  if (value.includes("house") || value.includes("hk") || value.includes("laundry") || value.includes("room attendant") || value.includes("inspector")) return "HOUSEKEEPING HOURS";
  if (value.includes("bistro") || value.includes("breakfast") || value.includes("barista") || value.includes("cook") || value.includes("f&b") || value.includes("restaurant")) return "BREAKFAST / BISTRO HOURS";
  if (value.includes("maintenance") || value.includes("engineer") || value.includes("r&m")) return "MAINTENANCE HOURS";
  return "OTHER";
}

function addDepartmentHours(target: Record<string, number>, department: string, hours: number) {
  target[department] = Number(((target[department] || 0) + hours).toFixed(2));
}

function numberFromText(value: string) {
  return Number(String(value || "").replace(/,/g, ""));
}

function numeric(value: unknown) {
  const raw = String(value ?? "").trim();
  const negative = /^\(.*\)$/.test(raw);
  const cleaned = raw.replace(/Avg:/i, "").replace(/[$,%(),]/g, "").replace(/,/g, "").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? (negative ? -Math.abs(n) : n) : 0;
}

function round(value: number, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
}

function parseCsvRows(text: string) {
  return text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    const result: string[] = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"' && quoted && line[i + 1] === '"') { current += '"'; i += 1; }
      else if (ch === '"') quoted = !quoted;
      else if (ch === "," && !quoted) { result.push(current.trim()); current = ""; }
      else current += ch;
    }
    result.push(current.trim());
    return result;
  });
}

function excelDateToIso(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  const n = Number(raw);
  if (Number.isFinite(n) && n > 20000) {
    const date = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return "";
}

function colIndex(ref: string) {
  const letters = (ref || "").match(/[A-Z]+/)?.[0] || "";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function readInlineText(value: any): string {
  if (!value) return "";
  const runs = value.r ? (Array.isArray(value.r) ? value.r : [value.r]) : [];
  if (runs.length) return runs.map((run: any) => typeof run.t === "string" ? run.t : run.t?.["#text"] || "").join("");
  return typeof value.t === "string" ? value.t : value.t?.["#text"] || "";
}

function parseXlsxSheets(buffer: Buffer) {
  const zip = new AdmZip(buffer);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false });
  const entry = (name: string) => zip.getEntry(name)?.getData().toString("utf8") || "";
  const workbookEntry = (target: unknown) => {
    const normalized = String(target || "").replace(/^\//, "");
    return entry(normalized) || entry(`xl/${normalized}`);
  };
  const workbook = parser.parse(entry("xl/workbook.xml"));
  const rels = parser.parse(entry("xl/_rels/workbook.xml.rels"));
  const sharedXml = entry("xl/sharedStrings.xml");
  const shared = sharedXml ? ([] as any[]).concat(parser.parse(sharedXml).sst?.si || []).map((si) => readInlineText(si) || String(si.t || "")) : [];
  const relMap = new Map(([] as any[]).concat(rels.Relationships?.Relationship || []).map((rel) => [rel["@_Id"], String(rel["@_Target"]).replace(/^\//, "")]));
  const sheets = ([] as any[]).concat(workbook.workbook?.sheets?.sheet || []);
  return sheets.map((sheet) => {
    const sheetName = String(sheet["@_name"] || "");
    const target = relMap.get(sheet["@_r:id"]);
    const xml = target ? workbookEntry(target) : "";
    const parsed = xml ? parser.parse(xml) : null;
    const rows = ([] as any[]).concat(parsed?.worksheet?.sheetData?.row || []).map((row) => {
      const cells: string[] = [];
      for (const cell of ([] as any[]).concat(row.c || [])) {
        const value = cell["@_t"] === "s" ? shared[Number(cell.v)] || "" : cell["@_t"] === "inlineStr" ? readInlineText(cell.is) : String(cell.v ?? "");
        cells[colIndex(cell["@_r"])] = value;
      }
      return cells;
    });
    return { name: sheetName, rows };
  });
}

function parseOtbCsv(text: string) {
  const rows = parseCsvRows(text);
  const header = rows[0] || [];
  const index = (label: string) => header.findIndex((h) => h.trim().toLowerCase() === label.toLowerCase());
  const idx = {
    date: index("Date"),
    roomsSold: index("Rms Sold"),
    occupancy: index("Occ %"),
    arrivals: index("Arr"),
    departures: index("Dept"),
    adrSold: index("ADR Sold ($)"),
    roomRevenue: index("Rm Rev ($)"),
  };
  if (idx.date < 0 || idx.roomsSold < 0 || idx.roomRevenue < 0) return null;
  const dataRows = rows.slice(1).filter((row) => row[idx.date] && !/^total$/i.test(row[idx.date]));
  const datedRows = dataRows.map((row) => ({
    date: excelDateToIso(row[idx.date]),
    roomsSold: numeric(row[idx.roomsSold]),
    occupancy: numeric(row[idx.occupancy]),
    arrivals: numeric(row[idx.arrivals]),
    departures: numeric(row[idx.departures]),
    adr: numeric(row[idx.adrSold]),
    roomRevenue: numeric(row[idx.roomRevenue]),
  })).filter((row) => row.date);
  const totalRow = rows.find((row) => /^total$/i.test(row[idx.date] || ""));
  const roomsSold = totalRow ? numeric(totalRow[idx.roomsSold]) : datedRows.reduce((sum, row) => sum + row.roomsSold, 0);
  const roomRevenue = totalRow ? numeric(totalRow[idx.roomRevenue]) : datedRows.reduce((sum, row) => sum + row.roomRevenue, 0);
  const arrivals = totalRow ? numeric(totalRow[idx.arrivals]) : datedRows.reduce((sum, row) => sum + row.arrivals, 0);
  const departures = totalRow ? numeric(totalRow[idx.departures]) : datedRows.reduce((sum, row) => sum + row.departures, 0);
  const occupancy = totalRow ? numeric(totalRow[idx.occupancy]) : datedRows.length ? datedRows.reduce((sum, row) => sum + row.occupancy, 0) / datedRows.length : 0;
  const adr = totalRow ? numeric(totalRow[idx.adrSold]) : roomsSold ? roomRevenue / roomsSold : 0;
  const weekStart = datedRows[0]?.date || "";
  const weekEnd = datedRows[datedRows.length - 1]?.date || "";
  const reportType = datedRows.length <= 10 ? "otb_weekly" : "otb_month";
  return {
    reportType,
    weekly: reportType === "otb_weekly" ? { weekStart, weekEnd, roomsSold: round(roomsSold, 0), occupancy: round(occupancy, 2), arrivals: round(arrivals, 0), departures: round(departures, 0), adr: round(adr, 2), roomRevenue: round(roomRevenue, 2) } : undefined,
    monthly: reportType === "otb_month" ? { monthStart: weekStart, monthEnd: weekEnd, rooms: round(roomsSold, 0), occupancy: round(occupancy / 100, 4), adr: round(adr, 2), revenue: round(roomRevenue, 2), arrivals: round(arrivals, 0), departures: round(departures, 0) } : undefined,
    daily: datedRows,
  };
}

function latestMonthValue(row: string[]) {
  for (let index = 6; index >= 1; index -= 1) {
    const value = row[index];
    if (String(value ?? "").trim()) return numeric(value);
  }
  return 0;
}

function monthColumnForWeek(rows: string[][], weekStart?: string) {
  if (!weekStart) return null;
  const date = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const monthLabel = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toLowerCase();
  const header = rows.find((row) => row.some((cell) => String(cell || "").trim().toLowerCase() === monthLabel));
  if (!header) return null;
  const index = header.findIndex((cell) => String(cell || "").trim().toLowerCase() === monthLabel);
  return index >= 0 ? index : null;
}

function parseGssSummary(rows: string[][], weekStart?: string) {
  const wanted: Record<string, string> = {
    "Intent to Recommend (Property)": "ITR",
    "Elite Appreciation": "Elite Appreciation",
    "Cleanliness": "Cleanliness",
    "Staff Service": "Staff Service",
    "Maintenance and Upkeep": "Maintenance",
    "Food and Beverage": "Food & Beverage",
    "Internet": "Internet",
  };
  const monthIndex = monthColumnForWeek(rows, weekStart);
  const gssRows = rows.flatMap((row) => {
    const metric = String(row[0] || "").trim();
    const label = wanted[metric];
    if (!label) return [];
    const hotel = monthIndex != null ? numeric(row[monthIndex]) : latestMonthValue(row);
    const total = numeric(row[7]);
    const benchmark = numeric(row[8]);
    const difference = String(row[9] ?? "").trim() ? numeric(row[9]) : total - benchmark;
    const monthNote = monthIndex != null && weekStart ? `${new Date(`${weekStart}T00:00:00`).toLocaleString("en-US", { month: "long", timeZone: "UTC" })} score` : "Latest month score";
    return [{ label, hotel: round(hotel, 1).toString(), brand: round(benchmark, 1).toString(), variance: round(hotel - benchmark, 1).toString(), sply: round(difference, 1).toString(), comments: total ? `${monthNote}; YTD total ${round(total, 1)}` : monthNote }];
  });
  return gssRows.length ? { reportType: "gss_summary", gssRows } : null;
}

function isWithinReportWeek(value: unknown, weekStart?: string, weekEnd?: string) {
  if (!weekStart || !weekEnd) return true;
  const iso = excelDateToIso(value);
  return Boolean(iso && iso >= weekStart && iso <= weekEnd);
}

function parseGssResponses(rows: string[][], weekStart?: string, weekEnd?: string) {
  const headerIndex = rows.findIndex((row) => row.some((cell) => String(cell || "").trim() === "Intent to Recommend (Property)") && row.some((cell) => String(cell || "").trim() === "Overall Comment"));
  if (headerIndex < 0) return null;
  const header = rows[headerIndex].map((value) => String(value || "").trim());
  const find = (...labels: string[]) => header.findIndex((h) => labels.some((label) => h.toLowerCase() === label.toLowerCase()));
  const idx = {
    name: find("Name", "Guest Name"),
    responseDate: find("Response Date"),
    source: find("Social Media Source", "Source"),
    score: find("Intent to Recommend (Property)", "Overall Score"),
    comment: find("Overall Comment", "Social Comment"),
    problem: find("Problems Comment"),
  };
  const parsed = rows.slice(headerIndex + 1).filter((row) => isWithinReportWeek(row[idx.responseDate], weekStart, weekEnd)).map((row) => {
    const score = numeric(row[idx.score]);
    const comment = String(row[idx.comment] || row[idx.problem] || "").trim();
    return {
      source: String(row[idx.name] || row[idx.source] || "Guest").trim(),
      score: score ? String(score) : "",
      comment,
    };
  }).filter((row) => row.comment);
  const positiveReviews = parsed.filter((row) => numeric(row.score) >= 9).slice(0, 5);
  const negativeReviews = parsed.filter((row) => numeric(row.score) > 0 && numeric(row.score) <= 7).slice(0, 5);
  return { reportType: "gss_responses", positiveReviews, negativeReviews };
}

function parseOpsReportFile(file: Express.Multer.File, context: { weekStart?: string; weekEnd?: string } = {}) {
  const name = file.originalname.toLowerCase();
  if (name.endsWith(".csv")) {
    const otb = parseOtbCsv(file.buffer.toString("utf8"));
    if (otb) return { originalFileName: file.originalname, ...otb };
  }
  const sheets = parseXlsxSheets(file.buffer);
  const allRows = sheets.flatMap((sheet) => sheet.rows);
  const summary = parseGssSummary(allRows, context.weekStart);
  if (summary) return { originalFileName: file.originalname, ...summary };
  const responses = parseGssResponses(allRows, context.weekStart, context.weekEnd);
  if (responses) return { originalFileName: file.originalname, ...responses };
  throw new Error("This report format was not recognized. Upload an OTB CSV, GSS summary XLSX, or Marriott responses XLSX.");
}

function publicDraft(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    weekStart: row.weekStart,
    weekEnd: row.weekEnd,
    weekLabel: row.weekLabel,
    payload: row.payloadJson || {},
    uploadedReports: row.uploadedReportsJson || [],
    updatedAt: row.updatedAt,
  };
}

function parseLaborSummaryText(text: string) {
  const departments: Record<string, number> = {
    "FRONT DESK / NIGHT AUDIT HOURS": 0,
    "HOUSEKEEPING HOURS": 0,
    "BREAKFAST / BISTRO HOURS": 0,
    "MAINTENANCE HOURS": 0,
    OTHER: 0,
  };
  const seenBlocks = new Set<string>();
  const blockRegex = /Department\(([^)]+)\)(?:\s*~\s*Position\(([^)]+)\))?\s+Totals([\s\S]*?)(?=Department\(|Grand Totals|$)/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(text))) {
    const departmentLabel = match[1] || "";
    const positionLabel = match[2] || "";
    const body = match[3] || "";
    const key = `${departmentLabel}|${positionLabel}`;
    if (seenBlocks.has(key)) continue;
    if (!positionLabel) continue;
    const totalMatch = body.match(/Total Earnings\s*([0-9,]+\.[0-9]{2})/);
    if (!totalMatch) continue;
    seenBlocks.add(key);
    const hours = numberFromText(totalMatch[1]);
    if (!Number.isFinite(hours) || hours <= 0) continue;

    const department = departmentLabel.toLowerCase();
    const position = positionLabel.toLowerCase();
    if (department.includes("f&b") || department.includes("restaurant")) addDepartmentHours(departments, "BREAKFAST / BISTRO HOURS", hours);
    else if (department.includes("r&m") || department.includes("maintenance") || department.includes("engineering")) addDepartmentHours(departments, "MAINTENANCE HOURS", hours);
    else if (position.includes("front desk") || position.includes("night audit")) addDepartmentHours(departments, "FRONT DESK / NIGHT AUDIT HOURS", hours);
    else if (position.includes("room attendant") || position.includes("housekeeping") || position.includes("houseman") || position.includes("laundry")) addDepartmentHours(departments, "HOUSEKEEPING HOURS", hours);
    else addDepartmentHours(departments, "OTHER", hours);
  }
  return departments;
}

async function parsePdfText(buffer: Buffer) {
  const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buffer: Buffer) => Promise<{ text?: string }>;
  const parsed = await pdfParse(buffer);
  return parsed.text || "";
}

export function registerOpsReportRoutes(app: Express) {
  const router = express.Router();

  router.get("/access", async (req: any, res, next) => {
    try {
      const user = await getUserBySession(req);
      if (!user || user.disabledAt) return res.json({ unlocked: Boolean(req.session?.opsReportUnlocked), user: null, hasPin: await hasOpsPin() });
      const publicUser = publicOpsUser(user);
      if (publicUser.mustChangePassword) return res.json({ unlocked: false, user: publicUser, passwordChangeRequired: true });
      res.json({ unlocked: Boolean(req.session?.opsReportUnlocked || publicUser.isAdmin), user: publicUser, hasPin: await hasOpsPin() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/pin-login", async (req: any, res, next) => {
    try {
      const parsed = pinSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Enter the 5 digit PIN." });
      if (!(await verifyOpsPin(parsed.data.pin))) return res.status(401).json({ error: "Invalid PIN." });
      req.session.opsReportUnlocked = true;
      req.session.save(() => res.json({ unlocked: true }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/access", async (req: any, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Email and password are required." });
      // Login is handled by /api/tips/auth/login. This endpoint remains for compatibility
      // with the initial invite-code gate and simply reports the current session state.
      const user = await getUserBySession(req);
      if (!user || user.disabledAt) return res.status(401).json({ error: "Courtyard login required." });
      const publicUser = publicOpsUser(user);
      if (!publicUser.isAdmin) return res.status(403).json({ error: "Ops report manager access required." });
      res.json({ unlocked: true, user: publicUser });
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", (req: any, res) => {
    if (req.session) delete req.session.opsReportUnlocked;
    req.session?.save(() => res.json({ ok: true }));
  });

  router.get("/draft", requireOpsManager as RequestHandler, async (req: any, res, next) => {
    try {
      const requestedWeekStart = typeof req.query.weekStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.weekStart) ? req.query.weekStart : "";
      let weekStart = requestedWeekStart;
      if (!weekStart) {
        if (req.opsUser?.id) {
          const [settings] = await db.select().from(courtyardOpsReportUserSettings).where(eq(courtyardOpsReportUserSettings.userId, req.opsUser.id)).limit(1);
          weekStart = settings?.lastWeekStart || "";
        } else {
          weekStart = req.session?.opsReportLastWeekStart || "";
        }
      }
      let draft: any = null;
      if (weekStart) {
        [draft] = await db
          .select()
          .from(courtyardOpsReportDrafts)
          .where(and(eq(courtyardOpsReportDrafts.propertyId, "courtyard-austin-lakeline"), eq(courtyardOpsReportDrafts.weekStart, weekStart)))
          .limit(1);
      }
      if (!draft) {
        [draft] = await db.select().from(courtyardOpsReportDrafts).where(eq(courtyardOpsReportDrafts.propertyId, "courtyard-austin-lakeline")).orderBy(desc(courtyardOpsReportDrafts.updatedAt)).limit(1);
      }
      res.json({ draft: publicDraft(draft) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/draft", requireOpsManager as RequestHandler, async (req: any, res, next) => {
    try {
      const parsed = draftSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
      const data = parsed.data;
      const [draft] = await db
        .insert(courtyardOpsReportDrafts)
        .values({
          propertyId: "courtyard-austin-lakeline",
          weekStart: data.weekStart,
          weekEnd: data.weekEnd,
          weekLabel: data.weekLabel,
          payloadJson: data.payload,
          uploadedReportsJson: data.uploadedReports,
          updatedBy: req.opsUser?.id || null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [courtyardOpsReportDrafts.propertyId, courtyardOpsReportDrafts.weekStart],
          set: {
            weekEnd: data.weekEnd,
            weekLabel: data.weekLabel,
            payloadJson: data.payload,
            uploadedReportsJson: data.uploadedReports,
            updatedBy: req.opsUser?.id || null,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (req.opsUser?.id) {
        await db
          .insert(courtyardOpsReportUserSettings)
          .values({ userId: req.opsUser.id, lastWeekStart: data.weekStart, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: courtyardOpsReportUserSettings.userId,
            set: { lastWeekStart: data.weekStart, updatedAt: new Date() },
          });
      } else {
        req.session.opsReportLastWeekStart = data.weekStart;
        req.session.save(() => undefined);
      }
      res.json({ draft: publicDraft(draft) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/import", requireOpsManager as RequestHandler, (req, res, next) => {
    reportUpload.array("opsReport", 8)(req, res, (error: any) => {
      try {
        if (error) return res.status(400).json({ error: error.message || "Unable to upload ops report." });
        const files = (req as any).files as Express.Multer.File[] | undefined;
        if (!files?.length) return res.status(400).json({ error: "At least one ops report file is required." });
        const context = {
          weekStart: typeof req.body?.weekStart === "string" ? req.body.weekStart : undefined,
          weekEnd: typeof req.body?.weekEnd === "string" ? req.body.weekEnd : undefined,
        };
        res.json({ reports: files.map((file) => parseOpsReportFile(file, context)) });
      } catch (uploadError) {
        next(uploadError);
      }
    });
  });

  router.get("/labor/scheduled", requireOpsManager as RequestHandler, async (req, res, next) => {
    try {
      const parsed = z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: "Valid weekStart is required." });
      const [schedule] = await db.select().from(weeklySchedules).where(eq(weeklySchedules.weekStartDate, parsed.data.weekStart)).limit(1);
      const departments: Record<string, number> = {
        "FRONT DESK / NIGHT AUDIT HOURS": 0,
        "HOUSEKEEPING HOURS": 0,
        "BREAKFAST / BISTRO HOURS": 0,
        "MAINTENANCE HOURS": 0,
        OTHER: 0,
      };
      if (!schedule) return res.json({ weekStart: parsed.data.weekStart, scheduleId: null, departments });

      const [assignments, employees, shiftTypes] = await Promise.all([
        db.select().from(scheduleShiftAssignments).where(eq(scheduleShiftAssignments.scheduleId, schedule.id)),
        db.select().from(scheduleEmployees),
        db.select().from(scheduleShiftTypes),
      ]);
      const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
      const shiftTypeById = new Map(shiftTypes.map((shiftType) => [shiftType.id, shiftType]));
      for (const assignment of assignments) {
        if (assignment.isOpenShift) continue;
        const employee = assignment.employeeId ? employeeById.get(assignment.employeeId) : null;
        const shiftType = assignment.shiftTypeId ? shiftTypeById.get(assignment.shiftTypeId) : null;
        const hours = shiftHours(assignment, shiftType);
        if (hours <= 0) continue;
        addDepartmentHours(departments, opsDepartmentForSchedule(employee, assignment, shiftType), hours);
      }
      res.json({ weekStart: parsed.data.weekStart, scheduleId: schedule.id, departments });
    } catch (error) {
      next(error);
    }
  });

  router.post("/labor/actual-upload", requireOpsManager as RequestHandler, (req, res, next) => {
    laborUpload.single("laborSummary")(req, res, async (error: any) => {
      try {
        if (error) return res.status(400).json({ error: error.message || "Unable to upload labor summary." });
        const file = (req as any).file as Express.Multer.File | undefined;
        if (!file) return res.status(400).json({ error: "Labor summary PDF is required." });
        const text = await parsePdfText(file.buffer);
        const departments = parseLaborSummaryText(text);
        res.json({ originalFileName: file.originalname, departments });
      } catch (uploadError) {
        next(uploadError);
      }
    });
  });

  app.use("/api/opsreport", router);
}
