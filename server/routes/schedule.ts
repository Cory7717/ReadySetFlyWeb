import express, { type Express, type RequestHandler } from "express";
import crypto from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { and, asc, desc, eq, inArray, isNull, lte, lt } from "drizzle-orm";
import { db } from "../db";
import { createSoftAuthRateLimiter } from "../middleware/rateLimit";
import {
  scheduleAuditLog,
  scheduleEmployees,
  scheduleForecastDays,
  scheduleShareLinks,
  scheduleShiftAssignments,
  scheduleShiftTypes,
  tipsUsers,
  weeklySchedules,
} from "@shared/schema";

const SCHEDULE_ADMIN_EMAILS = new Set(
  (process.env.SCHEDULE_ADMIN_EMAILS || "coryarmer@gmail.com,cory.armer@marriott.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

const PROPERTY_NAME = process.env.SCHEDULE_PROPERTY_NAME || "Courtyard Austin Lakeline";
const DEPARTMENTS = ["Managers", "Front Desk", "Bistro", "Maintenance", "Housekeeping"];
const DAY_MS = 86_400_000;

const DEFAULT_SHIFT_TYPES = [
  { label: "AM", startTime: "07:00", endTime: "15:00", color: "#dbeafe", textColor: "#0f172a", departmentHint: "Front Desk" },
  { label: "PM", startTime: "15:00", endTime: "23:00", color: "#ede9fe", textColor: "#1e1b4b", departmentHint: "Front Desk" },
  { label: "AUDIT", startTime: "23:00", endTime: "07:00", color: "#111827", textColor: "#ffffff", departmentHint: "Front Desk", isOvernight: true },
  { label: "MID", startTime: "10:00", endTime: "18:00", color: "#e0f2fe", textColor: "#0c4a6e", departmentHint: "Front Desk" },
  { label: "BISTRO AM", startTime: "06:00", endTime: "14:00", color: "#fef3c7", textColor: "#713f12", departmentHint: "Bistro" },
  { label: "BISTRO PM", startTime: "14:00", endTime: "22:00", color: "#fed7aa", textColor: "#7c2d12", departmentHint: "Bistro" },
  { label: "BREAKFAST", startTime: "06:00", endTime: "12:00", color: "#fde68a", textColor: "#713f12", departmentHint: "Bistro" },
  { label: "HOUSEKEEPING", startTime: "09:00", endTime: "17:00", color: "#dcfce7", textColor: "#14532d", departmentHint: "Housekeeping" },
  { label: "LAUNDRY", startTime: "08:00", endTime: "16:00", color: "#ccfbf1", textColor: "#134e4a", departmentHint: "Housekeeping" },
  { label: "MAINTENANCE", startTime: "08:00", endTime: "16:00", color: "#e5e7eb", textColor: "#111827", departmentHint: "Maintenance" },
  { label: "MOD", startTime: null, endTime: null, color: "#f5d0fe", textColor: "#581c87", departmentHint: "Managers" },
  { label: "TRAINING", startTime: null, endTime: null, color: "#cffafe", textColor: "#164e63", departmentHint: "Managers" },
  { label: "PTO", startTime: null, endTime: null, color: "#fce7f3", textColor: "#831843", departmentHint: "Managers" },
  { label: "OFF", startTime: null, endTime: null, color: "#f3f4f6", textColor: "#374151", departmentHint: "Managers" },
  { label: "CALL OFF", startTime: null, endTime: null, color: "#fee2e2", textColor: "#7f1d1d", departmentHint: "Managers" },
  { label: "OPEN SHIFT", startTime: null, endTime: null, color: "#fff7ed", textColor: "#9a3412", departmentHint: "Managers" },
].map((shift, index) => ({ ...shift, unpaidBreakMinutes: 0, active: true, sortOrder: index + 1, isOvernight: Boolean((shift as any).isOvernight) }));

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number) {
  const date = parseDateKey(dateKey)!;
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

function mondayFor(date = new Date()) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - day + 1);
  return toDateKey(utc);
}

function weekDays(start: string) {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function normalizeDepartment(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("leadership") || normalized.includes("mod") || normalized.includes("manager")) return "Managers";
  if (normalized.includes("front") || normalized.includes("audit")) return "Front Desk";
  if (normalized.includes("bistro") || normalized.includes("breakfast")) return "Bistro";
  if (normalized.includes("engineer") || normalized.includes("maintenance")) return "Maintenance";
  if (normalized.includes("house") || normalized.includes("laundry")) return "Housekeeping";
  return DEPARTMENTS.includes(String(value || "")) ? String(value) : "Front Desk";
}

function minutesFromTime(value?: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function hoursForShift(assignment: any, shiftType: any) {
  const label = String(shiftType?.label || "").toUpperCase();
  if (!shiftType || ["OFF", "PTO", "CALL OFF", "OPEN SHIFT"].includes(label)) return 0;
  const start = minutesFromTime(assignment.customStartTime || shiftType.startTime);
  const end = minutesFromTime(assignment.customEndTime || shiftType.endTime);
  if (start == null || end == null) return 0;
  let duration = end - start;
  if (duration <= 0 || assignment.isOvernight || shiftType.isOvernight) duration += 24 * 60;
  const breakMinutes = assignment.unpaidBreakMinutes ?? shiftType.unpaidBreakMinutes ?? 0;
  return Math.max(0, (duration - breakMinutes) / 60);
}

function publicScheduleUser(user: any) {
  const email = normalizeEmail(String(user.email || ""));
  const role = SCHEDULE_ADMIN_EMAILS.has(email) || user.role === "super_admin" ? "super_admin" : user.role === "manager" ? "manager" : "employee";
  return {
    id: user.id,
    email,
    firstName: user.firstName,
    lastName: user.lastName,
    employeeDisplayName: user.employeeDisplayName,
    role,
    isAdmin: role === "manager" || role === "super_admin",
    isSuperAdmin: role === "super_admin",
    disabledAt: user.disabledAt ?? null,
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

async function getUserBySession(req: any) {
  const userId = req.session?.tipsUserId;
  if (!userId) return null;
  const [user] = await db.select().from(tipsUsers).where(eq(tipsUsers.id, String(userId))).limit(1);
  return user || null;
}

function isManager(user: any) {
  return publicScheduleUser(user).isAdmin;
}

const requireScheduleAuth: RequestHandler = async (req: any, res, next) => {
  try {
    const user = await getUserBySession(req);
    if (!user) return res.status(401).json({ error: "Schedule login required" });
    if (user.disabledAt) return res.status(403).json({ error: "This account is disabled." });
    if (user.mustChangePassword) return res.status(403).json({ error: "Password change required before continuing.", code: "PASSWORD_CHANGE_REQUIRED" });
    req.scheduleUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

const requireScheduleManager: RequestHandler = async (req: any, res, next) => {
  try {
    const user = await getUserBySession(req);
    if (!user) return res.status(401).json({ error: "Schedule login required" });
    if (user.disabledAt) return res.status(403).json({ error: "This account is disabled." });
    if (user.mustChangePassword) return res.status(403).json({ error: "Password change required before continuing.", code: "PASSWORD_CHANGE_REQUIRED" });
    if (!isManager(user)) return res.status(403).json({ error: "Schedule manager access required" });
    req.scheduleUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

const scheduleRateLimiter = createSoftAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  anonMax: 20,
  authMax: 200,
  key: "schedule",
});

const employeeSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  displayName: z.string().trim().min(1).max(140).optional(),
  department: z.string().trim().min(1).max(120).default("Front Desk"),
  position: z.string().trim().max(120).optional().nullable(),
  defaultShiftType: z.string().trim().max(80).optional().nullable(),
  maxWeeklyHours: z.coerce.number().min(0).max(168).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  active: z.boolean().default(true),
  availabilityJson: z.any().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const shiftTypeSchema = z.object({
  label: z.string().trim().min(1).max(80),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  unpaidBreakMinutes: z.coerce.number().int().min(0).max(240).default(0),
  color: z.string().trim().min(4).max(24),
  textColor: z.string().trim().min(4).max(24),
  departmentHint: z.string().trim().max(120).optional().nullable(),
  isOvernight: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const createWeekSchema = z.object({
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  propertyName: z.string().trim().min(1).max(160).default(PROPERTY_NAME),
  mode: z.enum(["blank", "copyPrevious"]).default("blank"),
});

const forecastSchema = z.object({
  days: z.array(z.object({
    forecastDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    roomsSold: z.coerce.number().int().min(0).max(10000).default(0),
    occupancyPercent: z.coerce.number().min(0).max(100).default(0),
    arrivals: z.coerce.number().int().min(0).max(10000).default(0),
    departures: z.coerce.number().int().min(0).max(10000).default(0),
    stayovers: z.coerce.number().int().min(0).max(10000).default(0),
    groupsEventsNotes: z.string().max(2000).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  })).min(1).max(7),
});

const shiftAssignmentSchema = z.object({
  employeeId: z.string().optional().nullable(),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftTypeId: z.string().optional().nullable(),
  customStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  customEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  unpaidBreakMinutes: z.coerce.number().int().min(0).max(240).optional().nullable(),
  roleNote: z.string().max(300).optional().nullable(),
  managerNote: z.string().max(1000).optional().nullable(),
  isOpenShift: z.boolean().default(false),
  clear: z.boolean().default(false),
});

async function seedShiftTypes() {
  const existing = await db.select({ label: scheduleShiftTypes.label }).from(scheduleShiftTypes);
  const labels = new Set(existing.map((row) => row.label));
  const missing = DEFAULT_SHIFT_TYPES.filter((shift) => !labels.has(shift.label));
  if (missing.length) await db.insert(scheduleShiftTypes).values(missing as any);
}

async function audit(scheduleId: string | null, actorUserId: string | null, action: string, metadataJson?: any) {
  await db.insert(scheduleAuditLog).values({ scheduleId, actorUserId, action, metadataJson: metadataJson || null });
}

async function getScheduleOr404(id: string) {
  const [schedule] = await db.select().from(weeklySchedules).where(eq(weeklySchedules.id, id)).limit(1);
  return schedule || null;
}

async function buildSchedulePayload(scheduleId: string) {
  await seedShiftTypes();
  const schedule = await getScheduleOr404(scheduleId);
  if (!schedule) return null;
  const days = weekDays(schedule.weekStartDate);
  const [employees, shiftTypes, forecast, assignments] = await Promise.all([
    db.select().from(scheduleEmployees).orderBy(asc(scheduleEmployees.department), asc(scheduleEmployees.displayName)),
    db.select().from(scheduleShiftTypes).orderBy(asc(scheduleShiftTypes.sortOrder), asc(scheduleShiftTypes.label)),
    db.select().from(scheduleForecastDays).where(eq(scheduleForecastDays.scheduleId, scheduleId)).orderBy(asc(scheduleForecastDays.forecastDate)),
    db.select().from(scheduleShiftAssignments).where(eq(scheduleShiftAssignments.scheduleId, scheduleId)).orderBy(asc(scheduleShiftAssignments.shiftDate)),
  ]);
  const totals = calculateTotals(days, employees, shiftTypes, forecast, assignments);
  return { schedule, days, departments: DEPARTMENTS, employees, shiftTypes, forecast, assignments, totals };
}

function calculateTotals(days: string[], employees: any[], shiftTypes: any[], forecast: any[], assignments: any[]) {
  const shiftTypeById = new Map(shiftTypes.map((shift) => [shift.id, shift]));
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const employeeWeeklyHours: Record<string, number> = {};
  const departmentDailyHours: Record<string, Record<string, number>> = {};
  const departmentWeeklyHours: Record<string, number> = {};
  const dailyLaborHours: Record<string, number> = Object.fromEntries(days.map((day) => [day, 0]));
  const coverage: Record<string, Record<string, number>> = Object.fromEntries(days.map((day) => [day, { AM: 0, PM: 0, AUDIT: 0, MOD: 0 }]));
  let openShiftCount = 0;
  const warnings: string[] = [];
  const assignmentKeys = new Set<string>();

  for (const assignment of assignments) {
    const shiftType = shiftTypeById.get(assignment.shiftTypeId);
    const employee = assignment.employeeId ? employeeById.get(assignment.employeeId) : null;
    const department = normalizeDepartment(employee?.department || shiftType?.departmentHint);
    const hours = hoursForShift(assignment, shiftType);
    if (assignment.isOpenShift || shiftType?.label === "OPEN SHIFT") openShiftCount += 1;
    if (employee?.id) {
      const key = `${employee.id}:${assignment.shiftDate}`;
      if (assignmentKeys.has(key)) warnings.push(`${employee.displayName} has duplicate shifts on ${assignment.shiftDate}.`);
      assignmentKeys.add(key);
      employeeWeeklyHours[employee.id] = (employeeWeeklyHours[employee.id] || 0) + hours;
    }
    departmentDailyHours[department] ||= {};
    departmentDailyHours[department][assignment.shiftDate] = (departmentDailyHours[department][assignment.shiftDate] || 0) + hours;
    departmentWeeklyHours[department] = (departmentWeeklyHours[department] || 0) + hours;
    dailyLaborHours[assignment.shiftDate] = (dailyLaborHours[assignment.shiftDate] || 0) + hours;
    const label = String(shiftType?.label || "").toUpperCase();
    if (coverage[assignment.shiftDate]?.[label] != null) coverage[assignment.shiftDate][label] += 1;
  }

  for (const employee of employees) {
    const max = Number(employee.maxWeeklyHours || 0);
    const total = employeeWeeklyHours[employee.id] || 0;
    if (max > 0 && total > max) warnings.push(`${employee.displayName} is scheduled ${total.toFixed(1)} hours, over max ${max}.`);
  }
  for (const day of days) {
    if ((coverage[day]?.AUDIT || 0) < 1) warnings.push(`No audit scheduled on ${day}.`);
    if ((coverage[day]?.MOD || 0) < 1) warnings.push(`No MOD scheduled on ${day}.`);
  }
  for (const day of forecast) {
    const fdHours = departmentDailyHours["Front Desk"]?.[day.forecastDate] || 0;
    const hkHours = departmentDailyHours["Housekeeping"]?.[day.forecastDate] || 0;
    if (Number(day.occupancyPercent || 0) >= 85 && fdHours < 16) warnings.push(`High occupancy on ${day.forecastDate} with low Front Desk coverage.`);
    if (Number(day.departures || 0) >= 45 && hkHours < 24) warnings.push(`High departures on ${day.forecastDate} with low Housekeeping coverage.`);
  }
  if (openShiftCount > 0) warnings.push(`${openShiftCount} open shift(s) remaining.`);

  return {
    employeeWeeklyHours: roundRecord(employeeWeeklyHours),
    departmentDailyHours: roundNestedRecord(departmentDailyHours),
    departmentWeeklyHours: roundRecord(departmentWeeklyHours),
    dailyLaborHours: roundRecord(dailyLaborHours),
    totalWeeklyLaborHours: Object.values(dailyLaborHours).reduce((sum, value) => sum + value, 0).toFixed(2),
    coverage,
    openShiftCount,
    warnings,
  };
}

function roundRecord(record: Record<string, number>) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, Number(value.toFixed(2))]));
}

function roundNestedRecord(record: Record<string, Record<string, number>>) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, roundRecord(value)]));
}

async function ensureForecast(scheduleId: string, start: string) {
  const rows = weekDays(start).map((day) => ({ scheduleId, forecastDate: day }));
  for (const row of rows) {
    await db.insert(scheduleForecastDays).values(row as any).onConflictDoNothing();
  }
}

function scheduleCellText(assignment: any, shiftType: any) {
  if (!assignment || !shiftType) return "";
  const start = assignment.customStartTime || shiftType.startTime;
  const end = assignment.customEndTime || shiftType.endTime;
  const time = start && end ? `${start.slice(0, 5)}-${end.slice(0, 5)}` : shiftType.label;
  return [time, assignment.roleNote].filter(Boolean).join(" ");
}

async function renderSchedulePdf(payload: any) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([792, 612]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 568;
  const draw = (text: string, x: number, size = 8, isBold = false) => {
    if (y < 44) {
      page = pdf.addPage([792, 612]);
      y = 568;
    }
    page.drawText(String(text).slice(0, 120), { x, y, size, font: isBold ? bold : font, color: rgb(0.08, 0.09, 0.11) });
  };
  draw(`${payload.schedule.propertyName} Schedule`, 36, 16, true);
  draw(`${payload.schedule.weekStartDate} to ${payload.schedule.weekEndDate} - ${payload.schedule.status.toUpperCase()}`, 36, 10);
  if (payload.schedule.publishedAt) draw(`Published: ${new Date(payload.schedule.publishedAt).toLocaleString()}`, 540, 8);
  y -= 28;
  draw("Forecast", 36, 11, true);
  y -= 14;
  payload.forecast.forEach((day: any) => {
    draw(`${day.forecastDate}: Rooms ${day.roomsSold || 0}, Occ ${day.occupancyPercent || 0}%, Arr ${day.arrivals || 0}, Dep ${day.departures || 0} ${day.notes || ""}`, 44, 7);
    y -= 10;
  });
  y -= 8;
  const assignmentsByEmployeeDay = new Map(payload.assignments.map((assignment: any) => [`${assignment.employeeId}:${assignment.shiftDate}`, assignment]));
  const shiftTypeById = new Map(payload.shiftTypes.map((shift: any) => [shift.id, shift]));
  for (const department of payload.departments) {
    const employees = payload.employees.filter((employee: any) => employee.department === department && employee.active);
    if (!employees.length) continue;
    draw(department, 36, 11, true);
    y -= 14;
    draw(["Employee", ...payload.days.map((day: string) => day.slice(5)), "Hrs"].join("   "), 44, 7, true);
    y -= 11;
    for (const employee of employees) {
      const cells = payload.days.map((day: string) => {
        const assignment: any = assignmentsByEmployeeDay.get(`${employee.id}:${day}`);
        return scheduleCellText(assignment, shiftTypeById.get(assignment?.shiftTypeId)) || "-";
      });
      draw([employee.displayName, ...cells, payload.totals.employeeWeeklyHours[employee.id] || 0].join(" | "), 44, 6);
      y -= 10;
    }
    y -= 8;
  }
  y -= 8;
  draw(`Total weekly labor hours: ${payload.totals.totalWeeklyLaborHours}`, 36, 10, true);
  return Buffer.from(await pdf.save());
}

function renderScheduleExcelHtml(payload: any) {
  const shiftTypeById = new Map(payload.shiftTypes.map((shift: any) => [shift.id, shift]));
  const assignmentsByEmployeeDay = new Map(payload.assignments.map((assignment: any) => [`${assignment.employeeId}:${assignment.shiftDate}`, assignment]));
  const rows: string[] = [];
  rows.push(`<h1>${payload.schedule.propertyName} Schedule</h1><p>${payload.schedule.weekStartDate} to ${payload.schedule.weekEndDate}</p>`);
  rows.push("<table border='1'><tr><th>Forecast</th>" + payload.days.map((day: string) => `<th>${day}</th>`).join("") + "</tr>");
  for (const metric of ["roomsSold", "occupancyPercent", "arrivals", "departures", "stayovers"]) {
    rows.push(`<tr><td>${metric}</td>${payload.days.map((day: string) => `<td>${payload.forecast.find((f: any) => f.forecastDate === day)?.[metric] || 0}</td>`).join("")}</tr>`);
  }
  rows.push("</table><br/><table border='1'><tr><th>Department</th><th>Employee</th>" + payload.days.map((day: string) => `<th>${day}</th>`).join("") + "<th>Total</th></tr>");
  for (const department of payload.departments) {
    for (const employee of payload.employees.filter((item: any) => item.department === department && item.active)) {
      rows.push(`<tr><td>${department}</td><td>${employee.displayName}</td>${payload.days.map((day: string) => {
        const assignment: any = assignmentsByEmployeeDay.get(`${employee.id}:${day}`);
        const shiftType: any = shiftTypeById.get(assignment?.shiftTypeId);
        const style = shiftType ? ` style="background:${shiftType.color};color:${shiftType.textColor}"` : "";
        return `<td${style}>${scheduleCellText(assignment, shiftType)}</td>`;
      }).join("")}<td>${payload.totals.employeeWeeklyHours[employee.id] || 0}</td></tr>`);
    }
  }
  rows.push("</table>");
  return rows.join("\n");
}

export function registerScheduleRoutes(app: Express) {
  const router = express.Router();

  router.get("/auth/me", async (req: any, res, next) => {
    try {
      const user = await getUserBySession(req);
      res.json({ user: user && !user.disabledAt ? publicScheduleUser(user) : null });
    } catch (error) {
      next(error);
    }
  });

  router.get("/meta", requireScheduleAuth, async (_req, res, next) => {
    try {
      await seedShiftTypes();
      res.json({ propertyName: PROPERTY_NAME, departments: DEPARTMENTS });
    } catch (error) {
      next(error);
    }
  });

  router.get("/employees", requireScheduleAuth, async (_req: any, res, next) => {
    try {
      const employees = await db.select().from(scheduleEmployees).orderBy(asc(scheduleEmployees.department), asc(scheduleEmployees.displayName));
      res.json({ employees });
    } catch (error) {
      next(error);
    }
  });

  router.post("/employees", requireScheduleManager, scheduleRateLimiter, async (req: any, res, next) => {
    try {
      const parsed = employeeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid employee", validation: parsed.error.format() });
      const [employee] = await db.insert(scheduleEmployees).values({
        ...parsed.data,
        department: normalizeDepartment(parsed.data.department),
        displayName: parsed.data.displayName || `${parsed.data.firstName} ${parsed.data.lastName}`,
        email: parsed.data.email || null,
        maxWeeklyHours: parsed.data.maxWeeklyHours == null ? null : parsed.data.maxWeeklyHours.toFixed(2),
      } as any).returning();
      await audit(null, req.scheduleUser.id, "employee_created", { employeeId: employee.id });
      res.status(201).json({ employee });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/employees/:id", requireScheduleManager, async (req: any, res, next) => {
    try {
      const parsed = employeeSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid employee", validation: parsed.error.format() });
      const [employee] = await db.update(scheduleEmployees).set({
        ...parsed.data,
        department: parsed.data.department ? normalizeDepartment(parsed.data.department) : undefined,
        email: parsed.data.email === "" ? null : parsed.data.email,
        maxWeeklyHours: parsed.data.maxWeeklyHours == null ? undefined : parsed.data.maxWeeklyHours.toFixed(2),
        updatedAt: new Date(),
      } as any).where(eq(scheduleEmployees.id, req.params.id)).returning();
      if (!employee) return res.status(404).json({ error: "Employee not found" });
      await audit(null, req.scheduleUser.id, "employee_updated", { employeeId: employee.id });
      res.json({ employee });
    } catch (error) {
      next(error);
    }
  });

  router.get("/shift-types", requireScheduleAuth, async (_req, res, next) => {
    try {
      await seedShiftTypes();
      const shiftTypes = await db.select().from(scheduleShiftTypes).orderBy(asc(scheduleShiftTypes.sortOrder), asc(scheduleShiftTypes.label));
      res.json({ shiftTypes });
    } catch (error) {
      next(error);
    }
  });

  router.post("/shift-types", requireScheduleManager, async (req: any, res, next) => {
    try {
      const parsed = shiftTypeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid shift type", validation: parsed.error.format() });
      const [shiftType] = await db.insert(scheduleShiftTypes).values(parsed.data as any).returning();
      await audit(null, req.scheduleUser.id, "shift_type_created", { shiftTypeId: shiftType.id });
      res.status(201).json({ shiftType });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/shift-types/:id", requireScheduleManager, async (req: any, res, next) => {
    try {
      const parsed = shiftTypeSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid shift type", validation: parsed.error.format() });
      const [shiftType] = await db.update(scheduleShiftTypes).set({ ...parsed.data, updatedAt: new Date() } as any).where(eq(scheduleShiftTypes.id, req.params.id)).returning();
      if (!shiftType) return res.status(404).json({ error: "Shift type not found" });
      res.json({ shiftType });
    } catch (error) {
      next(error);
    }
  });

  router.get("/weeks", requireScheduleAuth, async (req: any, res, next) => {
    try {
      const rows = await db.select().from(weeklySchedules).orderBy(desc(weeklySchedules.weekStartDate)).limit(30);
      const user = publicScheduleUser(req.scheduleUser);
      res.json({ weeks: user.isAdmin ? rows : rows.filter((week) => week.status === "published") });
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks", requireScheduleManager, async (req: any, res, next) => {
    try {
      const parsed = createWeekSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid week", validation: parsed.error.format() });
      const weekStartDate = parsed.data.weekStartDate;
      const weekEndDate = addDays(weekStartDate, 6);
      const [schedule] = await db.insert(weeklySchedules).values({
        propertyName: parsed.data.propertyName,
        weekStartDate,
        weekEndDate,
        createdByUserId: req.scheduleUser.id,
      }).onConflictDoUpdate({
        target: weeklySchedules.weekStartDate,
        set: { propertyName: parsed.data.propertyName, updatedAt: new Date() },
      }).returning();
      await ensureForecast(schedule.id, schedule.weekStartDate);
      if (parsed.data.mode === "copyPrevious") {
        const [previous] = await db.select().from(weeklySchedules).where(lt(weeklySchedules.weekStartDate, weekStartDate)).orderBy(desc(weeklySchedules.weekStartDate)).limit(1);
        if (previous) {
          const previousAssignments = await db.select().from(scheduleShiftAssignments).where(eq(scheduleShiftAssignments.scheduleId, previous.id));
          const previousStart = parseDateKey(previous.weekStartDate)!;
          const nextStart = parseDateKey(weekStartDate)!;
          for (const assignment of previousAssignments) {
            const offset = Math.round((parseDateKey(assignment.shiftDate)!.getTime() - previousStart.getTime()) / DAY_MS);
            await db.insert(scheduleShiftAssignments).values({
              scheduleId: schedule.id,
              employeeId: assignment.employeeId,
              shiftDate: toDateKey(new Date(nextStart.getTime() + offset * DAY_MS)),
              shiftTypeId: assignment.shiftTypeId,
              customStartTime: assignment.customStartTime,
              customEndTime: assignment.customEndTime,
              unpaidBreakMinutes: assignment.unpaidBreakMinutes,
              roleNote: assignment.roleNote,
              managerNote: assignment.managerNote,
              isOpenShift: assignment.isOpenShift,
            } as any).onConflictDoNothing();
          }
        }
      }
      await audit(schedule.id, req.scheduleUser.id, "schedule_created", { mode: parsed.data.mode });
      res.status(201).json(await buildSchedulePayload(schedule.id));
    } catch (error) {
      next(error);
    }
  });

  router.get("/weeks/:id", requireScheduleAuth, async (req: any, res, next) => {
    try {
      const payload = await buildSchedulePayload(req.params.id);
      if (!payload) return res.status(404).json({ error: "Schedule not found" });
      if (!publicScheduleUser(req.scheduleUser).isAdmin && payload.schedule.status !== "published") return res.status(403).json({ error: "Schedule is not published" });
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.get("/share/:token", async (req, res, next) => {
    try {
      const [link] = await db.select().from(scheduleShareLinks).where(eq(scheduleShareLinks.token, req.params.token)).limit(1);
      if (!link || link.revokedAt) return res.status(404).json({ error: "Share link not found" });
      const payload = await buildSchedulePayload(link.scheduleId);
      if (!payload || payload.schedule.status !== "published") return res.status(404).json({ error: "Schedule is not published" });
      res.json({ ...payload, readOnly: true });
    } catch (error) {
      next(error);
    }
  });

  router.put("/weeks/:id/forecast", requireScheduleManager, async (req: any, res, next) => {
    try {
      const schedule = await getScheduleOr404(req.params.id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      const parsed = forecastSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid forecast", validation: parsed.error.format() });
      for (const day of parsed.data.days) {
        await db.insert(scheduleForecastDays).values({ scheduleId: schedule.id, ...day } as any).onConflictDoUpdate({
          target: [scheduleForecastDays.scheduleId, scheduleForecastDays.forecastDate],
          set: { ...day, updatedAt: new Date() } as any,
        });
      }
      await audit(schedule.id, req.scheduleUser.id, "forecast_updated");
      res.json(await buildSchedulePayload(schedule.id));
    } catch (error) {
      next(error);
    }
  });

  router.put("/weeks/:id/shifts", requireScheduleManager, async (req: any, res, next) => {
    try {
      const schedule = await getScheduleOr404(req.params.id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      if (schedule.status === "published") return res.status(423).json({ error: "Published schedules are locked. Reopen before editing." });
      const parsed = shiftAssignmentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid shift", validation: parsed.error.format() });
      const employeeId = parsed.data.employeeId || null;
      if (parsed.data.clear) {
        await db.delete(scheduleShiftAssignments).where(and(eq(scheduleShiftAssignments.scheduleId, schedule.id), eq(scheduleShiftAssignments.shiftDate, parsed.data.shiftDate), employeeId ? eq(scheduleShiftAssignments.employeeId, employeeId) : eq(scheduleShiftAssignments.isOpenShift, true)));
      } else {
        await db.insert(scheduleShiftAssignments).values({
          scheduleId: schedule.id,
          employeeId,
          shiftDate: parsed.data.shiftDate,
          shiftTypeId: parsed.data.shiftTypeId || null,
          customStartTime: parsed.data.customStartTime || null,
          customEndTime: parsed.data.customEndTime || null,
          unpaidBreakMinutes: parsed.data.unpaidBreakMinutes ?? null,
          roleNote: parsed.data.roleNote || null,
          managerNote: parsed.data.managerNote || null,
          isOpenShift: parsed.data.isOpenShift,
        } as any).onConflictDoUpdate({
          target: [scheduleShiftAssignments.scheduleId, scheduleShiftAssignments.employeeId, scheduleShiftAssignments.shiftDate],
          set: {
            shiftTypeId: parsed.data.shiftTypeId || null,
            customStartTime: parsed.data.customStartTime || null,
            customEndTime: parsed.data.customEndTime || null,
            unpaidBreakMinutes: parsed.data.unpaidBreakMinutes ?? null,
            roleNote: parsed.data.roleNote || null,
            managerNote: parsed.data.managerNote || null,
            isOpenShift: parsed.data.isOpenShift,
            updatedAt: new Date(),
          } as any,
        });
      }
      await audit(schedule.id, req.scheduleUser.id, "shift_updated", { employeeId, shiftDate: parsed.data.shiftDate });
      res.json(await buildSchedulePayload(schedule.id));
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/publish", requireScheduleManager, async (req: any, res, next) => {
    try {
      const [schedule] = await db.update(weeklySchedules).set({ status: "published", publishedAt: new Date(), updatedAt: new Date() }).where(eq(weeklySchedules.id, req.params.id)).returning();
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      await audit(schedule.id, req.scheduleUser.id, "schedule_published");
      res.json(await buildSchedulePayload(schedule.id));
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/reopen", requireScheduleManager, async (req: any, res, next) => {
    try {
      const reason = z.string().max(500).optional().parse(req.body?.reason || "");
      const [schedule] = await db.update(weeklySchedules).set({ status: "draft", updatedAt: new Date() }).where(eq(weeklySchedules.id, req.params.id)).returning();
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      await audit(schedule.id, req.scheduleUser.id, "schedule_reopened", { reason });
      res.json(await buildSchedulePayload(schedule.id));
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/archive", requireScheduleManager, async (req: any, res, next) => {
    try {
      const [schedule] = await db.update(weeklySchedules).set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() }).where(eq(weeklySchedules.id, req.params.id)).returning();
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      await audit(schedule.id, req.scheduleUser.id, "schedule_archived");
      res.json(await buildSchedulePayload(schedule.id));
    } catch (error) {
      next(error);
    }
  });

  router.get("/weeks/:id/pdf", requireScheduleAuth, async (req: any, res, next) => {
    try {
      const payload = await buildSchedulePayload(req.params.id);
      if (!payload) return res.status(404).json({ error: "Schedule not found" });
      if (!publicScheduleUser(req.scheduleUser).isAdmin && payload.schedule.status !== "published") return res.status(403).json({ error: "Schedule is not published" });
      const bytes = await renderSchedulePdf(payload);
      await audit(payload.schedule.id, req.scheduleUser.id, "schedule_pdf_exported");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="courtyard-schedule-${payload.schedule.weekStartDate}.pdf"`);
      res.send(bytes);
    } catch (error) {
      next(error);
    }
  });

  router.get("/weeks/:id/excel", requireScheduleAuth, async (req: any, res, next) => {
    try {
      const payload = await buildSchedulePayload(req.params.id);
      if (!payload) return res.status(404).json({ error: "Schedule not found" });
      if (!publicScheduleUser(req.scheduleUser).isAdmin && payload.schedule.status !== "published") return res.status(403).json({ error: "Schedule is not published" });
      await audit(payload.schedule.id, req.scheduleUser.id, "schedule_excel_exported");
      res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="courtyard-schedule-${payload.schedule.weekStartDate}.xls"`);
      res.send(renderScheduleExcelHtml(payload));
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/share-link", requireScheduleManager, async (req: any, res, next) => {
    try {
      const schedule = await getScheduleOr404(req.params.id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      if (schedule.status !== "published") return res.status(400).json({ error: "Publish the schedule before sharing." });
      const [existing] = await db.select().from(scheduleShareLinks).where(and(eq(scheduleShareLinks.scheduleId, schedule.id), isNull(scheduleShareLinks.revokedAt))).limit(1);
      const link = existing || (await db.insert(scheduleShareLinks).values({
        scheduleId: schedule.id,
        token: crypto.randomBytes(18).toString("hex"),
        createdByUserId: req.scheduleUser.id,
      }).returning())[0];
      const url = new URL(`/schedule?share=${link.token}`, process.env.FRONTEND_BASE_URL || "https://readysetfly.us").toString();
      await audit(schedule.id, req.scheduleUser.id, "schedule_share_link_created");
      res.json({ link, url });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/schedule", router);
}
