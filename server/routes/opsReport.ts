import express, { type Express, type RequestHandler } from "express";
import multer from "multer";
import { z } from "zod";
import bcrypt from "bcrypt";
import { and, desc, eq } from "drizzle-orm";
import { createRequire } from "module";
import { randomUUID } from "crypto";
import { db } from "../db";
import {
  scheduleEmployees,
  scheduleShiftAssignments,
  scheduleShiftTypes,
  courtyardOpsReportDrafts,
  courtyardOpsMonthlySummaries,
  courtyardOpsReportUserSettings,
  tipsKioskSettings,
  tipsUsers,
  weeklySchedules,
} from "@shared/schema";
import { parseOpsReportFile } from "../opsReportParsers";
import {
  buildMonthlySummaryDocx,
  buildMonthlySummaryPdf,
  type OpsMonthlySummaryPayload,
} from "../opsMonthlySummaryDocuments";

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
    if (name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".pdf") || /\.(png|jpe?g|webp)$/.test(name) || file.mimetype === "text/csv" || file.mimetype === "application/pdf" || file.mimetype.includes("spreadsheet") || /^image\/(png|jpeg|webp)$/i.test(file.mimetype)) return cb(null, true);
    cb(new Error("Upload a CSV, XLSX, PDF, PNG, JPG, or WebP ops report."));
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
const monthlyAccountSchema = z.object({
  name: z.string().default(""),
  roomNights: z.string().default(""),
});
const monthlySummaryPayloadSchema = z.object({
  reportMonth: z.string().regex(/^\d{4}-\d{2}$/),
  presentedTo: z.string().default("Globiwest Hospitality - Corporate Office"),
  hotelName: z.string().default("Courtyard Austin Lakeline"),
  generalManager: z.string().default(""),
  issuedBy: z.string().default(""),
  issueDate: z.string().default(""),
  occupancyRate: z.string().default(""),
  occupancyComparison: z.string().default(""),
  adr: z.string().default(""),
  adrComparison: z.string().default(""),
  revpar: z.string().default(""),
  revparComparison: z.string().default(""),
  totalRevenue: z.string().default(""),
  totalRevenueComparison: z.string().default(""),
  guestSatisfaction: z.string().default(""),
  increasedOccupancy: z.string().default(""),
  enhancedGuestExperience: z.string().default(""),
  staffPerformance: z.string().default(""),
  seasonalVariability: z.string().default(""),
  operationalCosts: z.string().default(""),
  marketingStrategies: z.string().default(""),
  costManagement: z.string().default(""),
  guestEngagement: z.string().default(""),
  forecastComment: z.string().default(""),
  forecastKeyDrivers: z.string().default(""),
  risksAndChallenges: z.string().default(""),
  opportunitiesForGrowth: z.string().default(""),
  currentRoomNights: z.string().default(""),
  currentAccountRevenue: z.string().default(""),
  previousRoomNights: z.string().default(""),
  roomNightVariance: z.string().default(""),
  previousAccountRevenue: z.string().default(""),
  accountRevenueVariance: z.string().default(""),
  corporateAccounts: z.array(monthlyAccountSchema).max(10).default([]),
  groups: z.array(monthlyAccountSchema).max(10).default([]),
  salesNotes: z.array(z.string()).max(4).default([]),
});
const monthlySummarySchema = z.object({
  reportMonth: z.string().regex(/^\d{4}-\d{2}$/),
  payload: monthlySummaryPayloadSchema,
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

function resolveOpsShiftTypeFromRole(role: string, shiftTypeByLabel: Map<string, any>) {
  const normalized = String(role || "").trim().toUpperCase();
  if (!normalized) return null;
  return shiftTypeByLabel.get(normalized)
    || (normalized.includes("FRONT DESK SUPERVISOR") ? shiftTypeByLabel.get("FRONT DESK SUPERVISOR") : null)
    || (normalized.includes("AUDIT") || normalized.includes("NIGHT") ? shiftTypeByLabel.get("NIGHT AUDIT") || shiftTypeByLabel.get("AUDIT") : null)
    || (normalized.includes("FD AM") ? shiftTypeByLabel.get("FD AM") : null)
    || (normalized.includes("FD PM") ? shiftTypeByLabel.get("FD PM") : null)
    || (normalized.includes("FRONT DESK") ? shiftTypeByLabel.get("FD AM") || shiftTypeByLabel.get("FRONT DESK") : null)
    || (normalized.includes("BISTRO AM") ? shiftTypeByLabel.get("BISTRO AM") : null)
    || (normalized.includes("BISTRO PM") ? shiftTypeByLabel.get("BISTRO PM") : null)
    || (normalized.includes("BREAKFAST") ? shiftTypeByLabel.get("BREAKFAST") : null)
    || (normalized.includes("ROOM ATTENDANT") ? shiftTypeByLabel.get("ROOM ATTENDANT") || shiftTypeByLabel.get("HOUSEKEEPING") : null)
    || (normalized.includes("EXECUTIVE HOUSEKEEPER") || normalized.includes("EXEC HK") ? shiftTypeByLabel.get("EXEC HK") || shiftTypeByLabel.get("HOUSEKEEPING") : null)
    || (normalized.includes("LAUNDRY") ? shiftTypeByLabel.get("LAUNDRY") : null)
    || (normalized.includes("HOUSEPERSON") || normalized.includes("HOUSEMAN") ? shiftTypeByLabel.get("HOUSEPERSON") : null)
    || (normalized.includes("INSPECTOR") ? shiftTypeByLabel.get("ROOM INSPECTOR") : null)
    || (normalized.includes("MAINTENANCE") ? shiftTypeByLabel.get("MAINTENANCE") : null)
    || null;
}

function resolveOpsShiftTypeForAssignment(assignment: any, directShiftType: any, shiftTypeByLabel: Map<string, any>) {
  const roleResolved = resolveOpsShiftTypeFromRole(assignment?.roleWorked || "", shiftTypeByLabel);
  if (!roleResolved) return directShiftType;
  const roleDepartment = String(roleResolved.departmentHint || roleResolved.label || "").trim().toLowerCase();
  const directDepartment = String(directShiftType?.departmentHint || directShiftType?.label || "").trim().toLowerCase();
  if (!directShiftType || roleDepartment && roleDepartment !== directDepartment) return roleResolved;
  if (String(assignment?.roleWorked || "").trim().toLowerCase() === String(roleResolved.label || "").trim().toLowerCase()) return roleResolved;
  return directShiftType;
}

function opsLaborBucketForSchedule(employee: any, assignment: any, shiftType: any) {
  const shiftText = [assignment?.roleWorked, shiftType?.label, shiftType?.departmentHint].filter(Boolean).join(" ");
  if (isFrontDeskSupervisorForOps(employee) || isFrontDeskSupervisorText(shiftText)) {
    return {
      department: "OTHER",
      label: employee?.displayName ? `Front Desk Supervisor (${employee.displayName})` : "Front Desk Supervisor",
    };
  }
  if (isBistroManagerForOps(employee) && isBistroText(shiftText || employee?.department)) {
    return { department: "BREAKFAST / BISTRO HOURS", label: "Bistro Manager" };
  }
  const text = String(shiftText || employee?.department || "").toLowerCase();
  if (text.includes("audit") || text.includes("night")) return { department: "FRONT DESK / NIGHT AUDIT HOURS", label: "Night Audit" };
  if (text.includes("front") || text.includes("fd ") || text === "fd" || text.includes("desk")) return { department: "FRONT DESK / NIGHT AUDIT HOURS", label: "Front Desk" };
  const department = opsDepartmentFromText(text);
  const labelText = department === "OTHER"
    ? [text, employee?.department, employee?.position, ...(Array.isArray(employee?.rolesJson) ? employee.rolesJson : [])].filter(Boolean).join(" ")
    : text;
  return { department, label: canonicalOpsLaborLabel(labelText) };
}

function canonicalOpsLaborLabel(value: unknown) {
  const text = String(value || "").toLowerCase();
  if (text.includes("general manager") || /\bgm\b/.test(text)) return "GM";
  if (text.includes("director of sales") || /\bdos\b/.test(text) || text.includes("sales")) return "DOS";
  if (text.includes("house") || text.includes("hk") || text.includes("laundry") || text.includes("room attendant") || text.includes("inspector")) {
    if (text.includes("exec hk") || text.includes("executive housekeeper")) return "Exec HK";
    if (text.includes("laundry")) return "Laundry";
    if (text.includes("houseperson") || text.includes("houseman")) return "Houseperson";
    if (text.includes("inspector")) return "Room Inspector";
    return "Room Attendant";
  }
  if (text.includes("bistro") || text.includes("breakfast") || text.includes("barista") || text.includes("cook") || text.includes("f&b") || text.includes("restaurant")) {
    if (text.includes("manager") || text.includes("supervisor") || text.includes("lead")) return "Bistro Manager";
    if (text.includes("attendant")) return "Bistro Attendant";
    return "Breakfast / Bistro";
  }
  if (text.includes("maintenance") || text.includes("engineer") || text.includes("r&m")) return "Maintenance";
  return "Other";
}

function isFrontDeskSupervisorText(value: unknown) {
  const text = String(value || "").toLowerCase();
  return (text.includes("front desk") || text.includes("front office") || /\bfd\b/.test(text))
    && (text.includes("supervisor") || text.includes("manager") || text.includes("lead"));
}

function isFrontDeskSupervisorForOps(employee: any) {
  const roles = Array.isArray(employee?.rolesJson) ? employee.rolesJson.join(" ") : "";
  if (employee?.isDepartmentManager && isFrontDeskText(employee?.department)) return true;
  return isFrontDeskSupervisorText([employee?.department, employee?.position, roles].filter(Boolean).join(" "));
}

function isFrontDeskText(value: unknown) {
  const text = String(value || "").toLowerCase();
  return text.includes("front desk") || text.includes("front office") || /\bfd\b/.test(text) || text.includes("desk");
}

function isBistroText(value: unknown) {
  const text = String(value || "").toLowerCase();
  return text.includes("bistro") || text.includes("breakfast") || text.includes("barista") || text.includes("cook") || text.includes("f&b") || text.includes("restaurant");
}

function isBistroManagerForOps(employee: any) {
  const roles = Array.isArray(employee?.rolesJson) ? employee.rolesJson.join(" ") : "";
  const text = [employee?.department, employee?.position, roles].filter(Boolean).join(" ").toLowerCase();
  return isBistroText(text) && (employee?.isDepartmentManager || text.includes("manager") || text.includes("supervisor") || text.includes("lead"));
}

function opsDepartmentFromText(value: string) {
  const text = String(value || "").toLowerCase();
  if (isFrontDeskSupervisorText(text)) return "OTHER";
  if (text.includes("audit") || text.includes("night") || text.includes("front") || text.includes("fd ") || text.includes("desk")) return "FRONT DESK / NIGHT AUDIT HOURS";
  if (text.includes("house") || text.includes("hk") || text.includes("laundry") || text.includes("room attendant") || text.includes("inspector")) return "HOUSEKEEPING HOURS";
  if (text.includes("bistro") || text.includes("breakfast") || text.includes("barista") || text.includes("cook") || text.includes("f&b") || text.includes("restaurant")) return "BREAKFAST / BISTRO HOURS";
  if (text.includes("maintenance") || text.includes("engineer") || text.includes("r&m")) return "MAINTENANCE HOURS";
  return "OTHER";
}

function opsDepartmentForEmployee(employee: any) {
  const roles = Array.isArray(employee?.rolesJson) ? employee.rolesJson.join(" ") : "";
  const value = [employee?.department, employee?.position, employee?.displayName, roles].filter(Boolean).join(" ");
  return opsDepartmentFromText(value);
}

function normalizePersonName(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z,\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function employeeNameKeys(employee: any) {
  const first = normalizePersonName(employee?.firstName).replace(/,/g, "");
  const last = normalizePersonName(employee?.lastName).replace(/,/g, "");
  const display = normalizePersonName(employee?.displayName);
  return new Set([
    display,
    `${first} ${last}`.trim(),
    `${last}, ${first}`.trim(),
    `${last} ${first}`.trim(),
  ].filter((key) => key.length >= 3));
}

function laborReportNameKeys(name: string) {
  const normalized = normalizePersonName(name);
  const [lastName, rest = ""] = normalized.split(",").map((part) => part.trim());
  const firstName = rest.split(" ").filter(Boolean)[0] || "";
  return new Set([
    normalized,
    `${firstName} ${lastName}`.trim(),
    `${lastName}, ${firstName}`.trim(),
    `${lastName} ${firstName}`.trim(),
  ].filter((key) => key.length >= 3));
}

function findLaborEmployeeMatch(name: string, employees: any[]) {
  const reportKeys = laborReportNameKeys(name);
  for (const employee of employees) {
    const keys = employeeNameKeys(employee);
    for (const key of Array.from(reportKeys)) {
      if (keys.has(key)) return employee;
    }
  }
  const [lastName, rest = ""] = normalizePersonName(name).split(",").map((part) => part.trim().replace(/,/g, ""));
  const firstInitial = rest.trim()[0] || "";
  if (lastName) {
    const sameLastName = employees.filter((employee) => normalizePersonName(employee?.lastName).replace(/,/g, "") === lastName);
    const sameInitial = sameLastName.filter((employee) => normalizePersonName(employee?.firstName).replace(/,/g, "")[0] === firstInitial);
    if (sameInitial.length === 1) return sameInitial[0];
    if (sameLastName.length === 1) return sameLastName[0];
  }
  return null;
}

function emptyLaborDepartments() {
  return {
    "FRONT DESK / NIGHT AUDIT HOURS": 0,
    "HOUSEKEEPING HOURS": 0,
    "BREAKFAST / BISTRO HOURS": 0,
    "MAINTENANCE HOURS": 0,
    OTHER: 0,
  } as Record<string, number>;
}

function emptyLaborBreakdown() {
  return Object.fromEntries(Object.keys(emptyLaborDepartments()).map((department) => [department, []])) as Record<string, Array<{ label: string; hours: number }>>;
}

function addLaborBreakdown(breakdown: Record<string, Array<{ label: string; hours: number }>>, department: string, label: string, hours: number) {
  const target = breakdown[department] || (breakdown[department] = []);
  const normalizedLabel = String(label || department).trim() || department;
  const existing = target.find((item) => item.label === normalizedLabel);
  if (existing) existing.hours += hours;
  else target.push({ label: normalizedLabel, hours });
}

function parseEmployeeLaborTotals(text: string, employees: any[], departments: Record<string, number>) {
  const employeeHours: Array<{ name: string; employeeNumber: string; hours: number; department: string; matchedEmployeeId: string | null }> = [];
  const unmatchedEmployees: Array<{ name: string; employeeNumber: string; hours: number }> = [];
  const regex = /([^\n]+?)\s+Emp#:\s*(\d+)[\s\S]*?Total Earnings\s*([0-9,]+\.[0-9]{2})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    const name = String(match[1] || "").trim();
    const employeeNumber = String(match[2] || "").trim();
    const hours = numberFromText(match[3] || "");
    if (!name || !Number.isFinite(hours) || hours <= 0) continue;
    const employee = findLaborEmployeeMatch(name, employees);
    const department = employee ? opsDepartmentForEmployee(employee) : "OTHER";
    addDepartmentHours(departments, department, hours);
    employeeHours.push({
      name,
      employeeNumber,
      hours,
      department,
      matchedEmployeeId: employee?.id || null,
    });
    if (!employee) unmatchedEmployees.push({ name, employeeNumber, hours });
  }
  return { employeeHours, unmatchedEmployees };
}

function parseLaborSummaryText(text: string, employees: any[] = []) {
  const departments: Record<string, number> = emptyLaborDepartments();
  const seenBlocks = new Set<string>();
  let blockHoursFound = false;
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

    blockHoursFound = true;
    addDepartmentHours(departments, opsDepartmentFromText(`${departmentLabel} ${positionLabel}`), hours);
  }

  const employeeResult = blockHoursFound
    ? { employeeHours: [], unmatchedEmployees: [] }
    : parseEmployeeLaborTotals(text, employees, departments);
  return {
    departments,
    employeeHours: employeeResult.employeeHours,
    unmatchedEmployees: employeeResult.unmatchedEmployees,
  };
}

function addDepartmentHours(target: Record<string, number>, department: string, hours: number) {
  target[department] = Number(((target[department] || 0) + hours).toFixed(2));
}

function numberFromText(value: string) {
  return Number(String(value || "").replace(/,/g, ""));
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

function publicMonthlySummary(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    reportMonth: row.reportMonth,
    payload: row.payloadJson || {},
    updatedAt: row.updatedAt,
  };
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
      if (!draft && requestedWeekStart) return res.json({ draft: null });
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

  router.get("/monthly-summary/:reportMonth", requireOpsManager as RequestHandler, async (req, res, next) => {
    try {
      if (!/^\d{4}-\d{2}$/.test(req.params.reportMonth)) return res.status(400).json({ error: "Valid report month is required." });
      const [summary] = await db
        .select()
        .from(courtyardOpsMonthlySummaries)
        .where(and(
          eq(courtyardOpsMonthlySummaries.propertyId, "courtyard-austin-lakeline"),
          eq(courtyardOpsMonthlySummaries.reportMonth, req.params.reportMonth),
        ))
        .limit(1);
      res.json({ summary: publicMonthlySummary(summary) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/monthly-summary", requireOpsManager as RequestHandler, async (req: any, res, next) => {
    try {
      const parsed = monthlySummarySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Monthly summary data is invalid.", validation: parsed.error.format() });
      const data = parsed.data;
      const [summary] = await db
        .insert(courtyardOpsMonthlySummaries)
        .values({
          propertyId: "courtyard-austin-lakeline",
          reportMonth: data.reportMonth,
          payloadJson: data.payload,
          updatedBy: req.opsUser?.id || null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [courtyardOpsMonthlySummaries.propertyId, courtyardOpsMonthlySummaries.reportMonth],
          set: {
            payloadJson: data.payload,
            updatedBy: req.opsUser?.id || null,
            updatedAt: new Date(),
          },
        })
        .returning();
      res.json({ summary: publicMonthlySummary(summary) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/monthly-summary/:reportMonth/:format", requireOpsManager as RequestHandler, async (req, res, next) => {
    try {
      const parsedParams = z.object({
        reportMonth: z.string().regex(/^\d{4}-\d{2}$/),
        format: z.enum(["docx", "pdf"]),
      }).safeParse(req.params);
      if (!parsedParams.success) return res.status(400).json({ error: "Valid report month and export format are required." });
      const [summary] = await db
        .select()
        .from(courtyardOpsMonthlySummaries)
        .where(and(
          eq(courtyardOpsMonthlySummaries.propertyId, "courtyard-austin-lakeline"),
          eq(courtyardOpsMonthlySummaries.reportMonth, parsedParams.data.reportMonth),
        ))
        .limit(1);
      if (!summary) return res.status(404).json({ error: "Save this monthly summary before downloading it." });
      const payloadResult = monthlySummaryPayloadSchema.safeParse(summary.payloadJson);
      if (!payloadResult.success) return res.status(422).json({ error: "The saved monthly summary is incomplete." });
      const payload = payloadResult.data as OpsMonthlySummaryPayload;
      const hotelSlug = String(payload.hotelName || "Hotel").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
      const baseName = `Monthly-Performance-Summary-${hotelSlug}-${parsedParams.data.reportMonth}`;
      if (parsedParams.data.format === "docx") {
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="${baseName}.docx"`);
        return res.send(buildMonthlySummaryDocx(payload));
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${baseName}.pdf"`);
      return res.send(await buildMonthlySummaryPdf(payload));
    } catch (error) {
      next(error);
    }
  });

  router.post("/import", requireOpsManager as RequestHandler, (req, res, next) => {
    reportUpload.array("opsReport", 8)(req, res, async (error: any) => {
      try {
        if (error) return res.status(400).json({ error: error.message || "Unable to upload ops report." });
        const files = (req as any).files as Express.Multer.File[] | undefined;
        if (!files?.length) return res.status(400).json({ error: "At least one ops report file is required." });
        const context = {
          weekStart: typeof req.body?.weekStart === "string" ? req.body.weekStart : undefined,
          weekEnd: typeof req.body?.weekEnd === "string" ? req.body.weekEnd : undefined,
          reportMonth: typeof req.body?.reportMonth === "string" ? req.body.reportMonth : undefined,
          businessDate: typeof req.body?.businessDate === "string" ? req.body.businessDate : undefined,
          totalRooms: Number(req.body?.totalRooms || 0) || undefined,
        };
        const reports = await Promise.all(files.map(async (file) => {
          try {
            return await parseOpsReportFile(file, context);
          } catch (error) {
            return {
              uploadId: randomUUID(),
              originalFileName: file.originalname,
              sourceFileName: file.originalname,
              reportType: "unknown",
              status: "failed",
              warnings: [error instanceof Error ? error.message : "Unable to parse this report."],
              selectedWeek: context.weekStart && context.weekEnd ? `${context.weekStart}/${context.weekEnd}` : "",
              weekStartDate: context.weekStart || "",
              weekEndDate: context.weekEnd || "",
              reportMonth: context.reportMonth || "",
              createdAt: new Date().toISOString(),
              preview: [],
              mapping: {},
            };
          }
        }));
        res.json({ reports });
      } catch (uploadError) {
        next(uploadError);
      }
    });
  });

  router.delete("/uploads/:uploadId", requireOpsManager as RequestHandler, async (req: any, res, next) => {
    try {
      const parsed = z.object({
        weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        weekEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        weekLabel: z.string().min(1),
        payload: z.record(z.unknown()),
        uploadedReports: z.array(z.record(z.unknown())),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
      if (parsed.data.uploadedReports.some((report) => report.uploadId === req.params.uploadId)) {
        return res.status(400).json({ error: "Removed upload is still present in uploadedReports." });
      }
      const [draft] = await db
        .insert(courtyardOpsReportDrafts)
        .values({
          propertyId: "courtyard-austin-lakeline",
          weekStart: parsed.data.weekStart,
          weekEnd: parsed.data.weekEnd,
          weekLabel: parsed.data.weekLabel,
          payloadJson: parsed.data.payload,
          uploadedReportsJson: parsed.data.uploadedReports,
          updatedBy: req.opsUser?.id || null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [courtyardOpsReportDrafts.propertyId, courtyardOpsReportDrafts.weekStart],
          set: {
            weekEnd: parsed.data.weekEnd,
            weekLabel: parsed.data.weekLabel,
            payloadJson: parsed.data.payload,
            uploadedReportsJson: parsed.data.uploadedReports,
            updatedBy: req.opsUser?.id || null,
            updatedAt: new Date(),
          },
        })
        .returning();
      res.json({ draft: publicDraft(draft) });
    } catch (error) {
      next(error);
    }
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
      const breakdown = emptyLaborBreakdown();
      if (!schedule) return res.json({ weekStart: parsed.data.weekStart, scheduleId: null, departments, breakdown });

      const [assignments, employees, shiftTypes] = await Promise.all([
        db.select().from(scheduleShiftAssignments).where(eq(scheduleShiftAssignments.scheduleId, schedule.id)),
        db.select().from(scheduleEmployees),
        db.select().from(scheduleShiftTypes),
      ]);
      const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
      const shiftTypeById = new Map(shiftTypes.map((shiftType) => [shiftType.id, shiftType]));
      const shiftTypeByLabel = new Map(shiftTypes.map((shiftType) => [String(shiftType.label || "").trim().toUpperCase(), shiftType]));
      for (const assignment of assignments) {
        if (assignment.isOpenShift) continue;
        const employee = assignment.employeeId ? employeeById.get(assignment.employeeId) : null;
        const directShiftType = assignment.shiftTypeId ? shiftTypeById.get(assignment.shiftTypeId) : null;
        const shiftType = resolveOpsShiftTypeForAssignment(assignment, directShiftType, shiftTypeByLabel);
        const hours = shiftHours(assignment, shiftType);
        if (hours <= 0) continue;
        const bucket = opsLaborBucketForSchedule(employee, assignment, shiftType);
        addDepartmentHours(departments, bucket.department, hours);
        const detailLabel = bucket.department === "FRONT DESK / NIGHT AUDIT HOURS" && employee?.displayName
          ? `${bucket.label} (${employee.displayName}, ${assignment.shiftDate})`
          : bucket.label;
        addLaborBreakdown(breakdown, bucket.department, detailLabel, hours);
      }
      for (const items of Object.values(breakdown)) items.sort((a, b) => b.hours - a.hours || a.label.localeCompare(b.label));
      res.json({ weekStart: parsed.data.weekStart, scheduleId: schedule.id, departments, breakdown });
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
        const employees = await db.select().from(scheduleEmployees);
        const parsed = parseLaborSummaryText(text, employees);
        res.json({ originalFileName: file.originalname, ...parsed });
      } catch (uploadError) {
        next(uploadError);
      }
    });
  });

  app.use("/api/opsreport", router);
}
