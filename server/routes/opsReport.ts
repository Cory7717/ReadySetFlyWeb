import express, { type Express, type RequestHandler } from "express";
import multer from "multer";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRequire } from "module";
import { db } from "../db";
import {
  scheduleEmployees,
  scheduleShiftAssignments,
  scheduleShiftTypes,
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

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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

async function requireOpsManager(req: any, res: any, next: any) {
  try {
    const user = await getUserBySession(req);
    if (!user || user.disabledAt) return res.status(401).json({ error: "Courtyard login required." });
    const publicUser = publicOpsUser(user);
    if (publicUser.mustChangePassword) return res.status(403).json({ error: "Password change required." });
    if (!publicUser.isAdmin) return res.status(403).json({ error: "Ops report manager access required." });
    req.opsUser = publicUser;
    next();
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
  if (value.includes("audit") || value.includes("night") || value.includes("front") || value.includes("fd ") || value.includes("desk")) return "FRONT DESK HOURS";
  if (value.includes("house") || value.includes("hk") || value.includes("laundry") || value.includes("room attendant") || value.includes("inspector")) return "HOUSEKEEPING HOURS";
  if (value.includes("bistro") || value.includes("breakfast") || value.includes("barista") || value.includes("cook") || value.includes("f&b") || value.includes("restaurant")) return "BREAKFAST";
  if (value.includes("maintenance") || value.includes("engineer") || value.includes("r&m")) return "MAINTENANCE";
  return "OTHER";
}

function addDepartmentHours(target: Record<string, number>, department: string, hours: number) {
  target[department] = Number(((target[department] || 0) + hours).toFixed(2));
}

function numberFromText(value: string) {
  return Number(String(value || "").replace(/,/g, ""));
}

function parseLaborSummaryText(text: string) {
  const departments: Record<string, number> = {
    "FRONT DESK HOURS": 0,
    "HOUSEKEEPING HOURS": 0,
    BREAKFAST: 0,
    MAINTENANCE: 0,
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
    if (department.includes("f&b") || department.includes("restaurant")) addDepartmentHours(departments, "BREAKFAST", hours);
    else if (department.includes("r&m") || department.includes("maintenance") || department.includes("engineering")) addDepartmentHours(departments, "MAINTENANCE", hours);
    else if (position.includes("front desk") || position.includes("night audit")) addDepartmentHours(departments, "FRONT DESK HOURS", hours);
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
      if (!user || user.disabledAt) return res.json({ unlocked: false, user: null });
      const publicUser = publicOpsUser(user);
      if (publicUser.mustChangePassword) return res.json({ unlocked: false, user: publicUser, passwordChangeRequired: true });
      res.json({ unlocked: publicUser.isAdmin, user: publicUser });
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
    if (req.session) delete req.session.tipsUserId;
    req.session?.save(() => res.json({ ok: true }));
  });

  router.get("/labor/scheduled", requireOpsManager as RequestHandler, async (req, res, next) => {
    try {
      const parsed = z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: "Valid weekStart is required." });
      const [schedule] = await db.select().from(weeklySchedules).where(eq(weeklySchedules.weekStartDate, parsed.data.weekStart)).limit(1);
      const departments: Record<string, number> = {
        "FRONT DESK HOURS": 0,
        "HOUSEKEEPING HOURS": 0,
        BREAKFAST: 0,
        MAINTENANCE: 0,
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
