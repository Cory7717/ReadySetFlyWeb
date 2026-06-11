import express, { type Express, type RequestHandler } from "express";
import crypto from "crypto";
import multer from "multer";
import AdmZip from "adm-zip";
import OpenAI from "openai";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import bcrypt from "bcrypt";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { and, asc, desc, eq, inArray, isNull, lte, lt } from "drizzle-orm";
import { db } from "../db";
import { createSoftAuthRateLimiter } from "../middleware/rateLimit";
import { getUncachableResendClient } from "../resendClient";
import {
  scheduleAuditLog,
  scheduleActualHours,
  scheduleEmployees,
  scheduleForecastDays,
  scheduleHousekeepingBoards,
  scheduleRequests,
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
const DEPARTMENTS = ["Managers", "Front Desk", "Night Audit", "Bistro", "Maintenance", "Housekeeping"];
const REQUIRED_DEPARTMENTS = ["Front Desk", "Night Audit", "Bistro", "Maintenance", "Housekeeping"];
const SCHEDULE_ROLES = ["GM", "DOS", "DOS / Sales", "Sales", "MOD", "Executive Housekeeper", "Exec HK", "FD AM", "FD PM", "Night Audit", "Bistro AM", "Bistro PM", "Breakfast", "Maintenance", "Room Attendant", "Laundry", "Room Inspector", "Houseperson"];
const SCHEDULE_DAY_LABELS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_MS = 86_400_000;
const TARGET_OCCUPANCY_PERCENT = Number(process.env.SCHEDULE_TARGET_OCCUPANCY_PERCENT || 65);
const TARGET_HPOR = Number(process.env.SCHEDULE_TARGET_HPOR || 1.4);
const TARGET_HK_MPOR_MIN = Number(process.env.SCHEDULE_TARGET_HK_MPOR_MIN || 25);
const TARGET_HK_MPOR_MAX = Number(process.env.SCHEDULE_TARGET_HK_MPOR_MAX || 30);
const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const openaiBaseUrl = (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || "").trim();
const openai = openaiApiKey
  ? new OpenAI({
      apiKey: openaiApiKey,
      ...(openaiBaseUrl && openaiBaseUrl.startsWith("http") ? { baseURL: openaiBaseUrl } : {}),
    })
  : null;

const BISTRO_LABOR_SCALE = [
  { minOcc: 0, maxOcc: 49.99, minHours: 90, maxHours: 100, label: "Minimal Coverage" },
  { minOcc: 50, maxOcc: 59.99, minHours: 100, maxHours: 110, label: "Lean Operations" },
  { minOcc: 60, maxOcc: 69.99, minHours: 115, maxHours: 115, label: "Standard Lean Model" },
  { minOcc: 70, maxOcc: 79.99, minHours: 125, maxHours: 135, label: "Moderate Overlap" },
  { minOcc: 80, maxOcc: 89.99, minHours: 140, maxHours: 155, label: "Increased Peak Staffing" },
  { minOcc: 90, maxOcc: 100, minHours: 160, maxHours: 180, label: "Full Staffing" },
];

const DEFAULT_SHIFT_TYPES = [
  { label: "FD AM", startTime: "07:00", endTime: "15:00", color: "#dbeafe", textColor: "#0f172a", departmentHint: "Front Desk" },
  { label: "FD PM", startTime: "15:00", endTime: "23:00", color: "#ede9fe", textColor: "#1e1b4b", departmentHint: "Front Desk" },
  { label: "Night Audit", startTime: "23:00", endTime: "07:00", color: "#111827", textColor: "#ffffff", departmentHint: "Night Audit", isOvernight: true },
  { label: "AM", startTime: "07:00", endTime: "15:00", color: "#dbeafe", textColor: "#0f172a", departmentHint: "Front Desk" },
  { label: "PM", startTime: "15:00", endTime: "23:00", color: "#ede9fe", textColor: "#1e1b4b", departmentHint: "Front Desk" },
  { label: "AUDIT", startTime: "23:00", endTime: "07:00", color: "#111827", textColor: "#ffffff", departmentHint: "Night Audit", isOvernight: true },
  { label: "MID", startTime: "10:00", endTime: "18:00", color: "#e0f2fe", textColor: "#0c4a6e", departmentHint: "Front Desk" },
  { label: "BISTRO AM", startTime: "06:00", endTime: "14:00", color: "#fef3c7", textColor: "#713f12", departmentHint: "Bistro" },
  { label: "BISTRO PM", startTime: "14:00", endTime: "22:00", color: "#fed7aa", textColor: "#7c2d12", departmentHint: "Bistro" },
  { label: "BREAKFAST", startTime: "06:00", endTime: "12:00", color: "#fde68a", textColor: "#713f12", departmentHint: "Bistro" },
  { label: "HOUSEKEEPING", startTime: "09:00", endTime: "17:00", color: "#dcfce7", textColor: "#14532d", departmentHint: "Housekeeping" },
  { label: "Room Attendant", startTime: "09:00", endTime: "17:00", color: "#dcfce7", textColor: "#14532d", departmentHint: "Housekeeping" },
  { label: "LAUNDRY", startTime: "08:00", endTime: "15:00", color: "#ccfbf1", textColor: "#134e4a", departmentHint: "Housekeeping" },
  { label: "Laundry", startTime: "08:00", endTime: "15:00", color: "#ccfbf1", textColor: "#134e4a", departmentHint: "Housekeeping" },
  { label: "Houseperson", startTime: "09:00", endTime: "16:00", color: "#fef9c3", textColor: "#713f12", departmentHint: "Housekeeping" },
  { label: "Room Inspector", startTime: "09:00", endTime: "16:00", color: "#e0e7ff", textColor: "#312e81", departmentHint: "Housekeeping" },
  { label: "MAINTENANCE", startTime: "08:00", endTime: "16:00", color: "#e5e7eb", textColor: "#111827", departmentHint: "Maintenance" },
  { label: "GM", startTime: "09:00", endTime: "17:00", color: "#e9d5ff", textColor: "#3b0764", departmentHint: "Managers" },
  { label: "DOS / Sales", startTime: "09:00", endTime: "17:00", color: "#dbeafe", textColor: "#1e3a8a", departmentHint: "Managers" },
  { label: "MOD", startTime: null, endTime: null, color: "#f5d0fe", textColor: "#581c87", departmentHint: "Managers" },
  { label: "TRAINING", startTime: null, endTime: null, color: "#cffafe", textColor: "#164e63", departmentHint: "Managers" },
  { label: "PTO", startTime: null, endTime: null, color: "#fce7f3", textColor: "#831843", departmentHint: "Managers" },
  { label: "OFF", startTime: null, endTime: null, color: "#f3f4f6", textColor: "#374151", departmentHint: "Managers" },
  { label: "CALL OFF", startTime: null, endTime: null, color: "#fee2e2", textColor: "#7f1d1d", departmentHint: "Managers" },
  { label: "OPEN SHIFT", startTime: null, endTime: null, color: "#fff7ed", textColor: "#9a3412", departmentHint: "Managers" },
].map((shift, index) => ({ ...shift, unpaidBreakMinutes: 0, active: true, sortOrder: index + 1, isOvernight: Boolean((shift as any).isOvernight) }));

const HOUSEKEEPING_ROLE_SHIFT_FALLBACKS: Record<string, any> = {
  "ROOM ATTENDANT": { label: "Room Attendant", startTime: "09:00", endTime: "17:00", unpaidBreakMinutes: 0, departmentHint: "Housekeeping" },
  HOUSEKEEPING: { label: "HOUSEKEEPING", startTime: "09:00", endTime: "17:00", unpaidBreakMinutes: 0, departmentHint: "Housekeeping" },
  LAUNDRY: { label: "Laundry", startTime: "08:00", endTime: "15:00", unpaidBreakMinutes: 0, departmentHint: "Housekeeping" },
  HOUSEPERSON: { label: "Houseperson", startTime: "09:00", endTime: "16:00", unpaidBreakMinutes: 0, departmentHint: "Housekeeping" },
  HOUSEMAN: { label: "Houseperson", startTime: "09:00", endTime: "16:00", unpaidBreakMinutes: 0, departmentHint: "Housekeeping" },
  "ROOM INSPECTOR": { label: "Room Inspector", startTime: "09:00", endTime: "16:00", unpaidBreakMinutes: 0, departmentHint: "Housekeeping" },
  INSPECTOR: { label: "Room Inspector", startTime: "09:00", endTime: "16:00", unpaidBreakMinutes: 0, departmentHint: "Housekeeping" },
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isSalariedScheduleManager(employee: any) {
  return Boolean(employee?.isSalaried);
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

function dateRange(start: string, end: string) {
  const span = daysBetween(start, end);
  if (span < 0) return [];
  return Array.from({ length: span + 1 }, (_, index) => addDays(start, index));
}

function todayDateKey() {
  const now = new Date();
  return toDateKey(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

function daysBetween(start: string, end: string) {
  const startDate = parseDateKey(start);
  const endDate = parseDateKey(end);
  if (!startDate || !endDate) return 0;
  return Math.floor((endDate.getTime() - startDate.getTime()) / DAY_MS);
}

function requestEndDate(request: any) {
  return request?.requestEndDate || request?.requestDate;
}

function dateInRequestRange(request: any, dateKey: string) {
  return dateKey >= request.requestDate && dateKey <= requestEndDate(request);
}

function requestRangesOverlap(left: any, right: any) {
  return left.requestDate <= requestEndDate(right) && requestEndDate(left) >= right.requestDate;
}

function normalizeDepartment(value?: string | null) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();
  if (DEPARTMENTS.includes(raw)) return raw;
  if (normalized.includes("audit") || normalized.includes("night")) return "Night Audit";
  if (normalized.includes("front") || normalized.includes("fd ") || normalized === "fd am" || normalized === "fd pm" || normalized.includes("desk")) return "Front Desk";
  if (normalized.includes("bistro") || normalized.includes("breakfast")) return "Bistro";
  if (normalized.includes("engineer") || normalized.includes("maintenance")) return "Maintenance";
  if (normalized.includes("house") || normalized.includes("hk") || normalized.includes("laundry") || normalized.includes("room attendant") || normalized.includes("inspector")) return "Housekeeping";
  if (normalized.includes("leadership") || normalized.includes("mod") || normalized.includes("general manager") || normalized === "gm" || normalized.includes("director of sales") || normalized === "dos" || normalized.includes("sales") || normalized.includes("manager")) return "Managers";
  return "Front Desk";
}

function hasHousekeepingManagerRole(roles: unknown) {
  return rolesArray(roles).some((role) => {
    const normalized = role.toLowerCase();
    return normalized.includes("executive housekeeper") || normalized === "exec hk" || normalized.includes("housekeeping manager");
  });
}

function hasBistroScheduleRole(value: unknown) {
  const normalized = String(value || "").toLowerCase();
  return normalized.includes("bistro") || normalized.includes("breakfast");
}

function rolesArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function employeeDepartmentCandidates(employee: any, fallback?: string | null) {
  return [employee?.department, employee?.position, ...rolesArray(employee?.rolesJson), fallback].filter(Boolean).map((item) => normalizeDepartment(String(item)));
}

function primaryOperationalDepartment(employee: any, fallback?: string | null) {
  const candidates = employeeDepartmentCandidates(employee, fallback);
  return candidates.find((department) => department !== "Managers") || candidates[0] || "Front Desk";
}

function employeeScheduleDepartments(employee: any) {
  return Array.from(new Set([
    normalizeDepartment(employee?.department),
    ...rolesArray(employee?.rolesJson).map((role) => normalizeDepartment(role)).filter(Boolean),
  ]));
}

function employeeApprovedForDepartment(employee: any, department: string, roleWorked?: string | null) {
  const normalizedDepartment = normalizeDepartment(department);
  if (employeeScheduleDepartments(employee).includes(normalizedDepartment)) return true;
  const normalizedRole = String(roleWorked || "").trim().toLowerCase();
  return Boolean(normalizedRole && rolesArray(employee?.rolesJson).some((role) => role.toLowerCase() === normalizedRole));
}

function hasManagerAccessRole(employee: any, user?: any) {
  const values = [
    employee?.department,
    employee?.position,
    user?.position,
    ...rolesArray(employee?.rolesJson),
    ...rolesArray(user?.scheduleRoles),
  ].map((item) => String(item || "").toLowerCase());
  return values.some((value) =>
    value.includes("executive housekeeper")
    || value === "exec hk"
    || value.includes("supervisor")
    || value.includes("manager")
    || value.includes("department lead")
  );
}

function findEmployeeForUserInList(user: any, employees: any[] = []) {
  const email = normalizeEmail(String(user?.email || ""));
  if (email) {
    const byEmail = employees.find((employee) => normalizeEmail(String(employee.email || "")) === email);
    if (byEmail) return byEmail;
  }

  const first = String(user?.firstName || "").trim().toLowerCase();
  const last = String(user?.lastName || "").trim().toLowerCase();
  const display = String(user?.employeeDisplayName || [user?.firstName, user?.lastName].filter(Boolean).join(" ")).trim().toLowerCase();
  const nameMatches = employees.filter((employee) => {
    const employeeFirst = String(employee.firstName || "").trim().toLowerCase();
    const employeeLast = String(employee.lastName || "").trim().toLowerCase();
    const employeeDisplay = String(employee.displayName || "").trim().toLowerCase();
    return Boolean(
      (first && last && employeeFirst === first && employeeLast === last)
      || (display && employeeDisplay === display)
    );
  });
  return nameMatches.length === 1 ? nameMatches[0] : null;
}

function managerDepartmentsForUser(user: any, employees: any[] = []) {
  const publicUser = publicScheduleUser(user);
  if (publicUser.isSuperAdmin) return DEPARTMENTS;
  const employee = findEmployeeForUserInList(user, employees);
  const managerDepartment = primaryOperationalDepartment(employee, user.position);
  if (employee?.isDepartmentManager || publicUser.isAdmin || hasManagerAccessRole(employee, user)) {
    return managerDepartment === "Front Desk" ? ["Front Desk", "Night Audit"] : [managerDepartment];
  }
  return [];
}

function minutesFromTime(value?: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function hoursForShift(assignment: any, shiftType: any) {
  const roleLabel = String(assignment?.roleWorked || "").trim().toUpperCase();
  const fallbackShift = HOUSEKEEPING_ROLE_SHIFT_FALLBACKS[roleLabel];
  const effectiveShift = shiftType || fallbackShift;
  const label = String(effectiveShift?.label || assignment?.roleWorked || "").toUpperCase();
  if (["OFF", "PTO", "CALL OFF", "OPEN SHIFT"].includes(label)) return 0;
  const start = minutesFromTime(assignment.customStartTime || effectiveShift?.startTime);
  const end = minutesFromTime(assignment.customEndTime || effectiveShift?.endTime);
  if (start == null || end == null) return 0;
  let duration = end - start;
  if (duration <= 0 || assignment.isOvernight || effectiveShift?.isOvernight || label.includes("AUDIT") || label.includes("NIGHT")) duration += 24 * 60;
  const breakMinutes = assignment.unpaidBreakMinutes ?? effectiveShift?.unpaidBreakMinutes ?? 0;
  return Math.max(0, (duration - breakMinutes) / 60);
}

function isNonWorkingShiftLabel(value?: string | null) {
  return ["OFF", "PTO", "CALL OFF"].includes(String(value || "").trim().toUpperCase());
}

function isRoomAttendantWork(assignment: any, shiftType: any, employee?: any) {
  if (isExecutiveHousekeeperEmployee(employee)) return false;
  const text = [
    assignment?.roleWorked,
    assignment?.roleNote,
    shiftType?.label,
    shiftType?.departmentHint,
  ].filter(Boolean).join(" ").toLowerCase();
  if (/(laundry|houseperson|houseman|inspector|executive housekeeper|exec hk|housekeeping manager)/.test(text)) return false;
  return text.includes("room attendant") || text.includes("housekeeping");
}

function assignmentRoleText(assignment: any, shiftType: any) {
  return [assignment?.roleWorked, assignment?.roleNote, shiftType?.label, shiftType?.departmentHint].filter(Boolean).join(" ").toLowerCase();
}

function isRoomInspectorWork(assignment: any, shiftType: any) {
  return assignmentRoleText(assignment, shiftType).includes("inspector");
}

function isLaundryWork(assignment: any, shiftType: any) {
  return assignmentRoleText(assignment, shiftType).includes("laundry");
}

function isHousepersonWork(assignment: any, shiftType: any) {
  const text = assignmentRoleText(assignment, shiftType);
  return text.includes("houseperson") || text.includes("houseman");
}

function isExecutiveHousekeeperEmployee(employee: any) {
  const text = [employee?.department, employee?.position, ...rolesArray(employee?.rolesJson)].filter(Boolean).join(" ").toLowerCase();
  return text.includes("executive housekeeper") || text.includes("exec hk") || text.includes("housekeeping manager");
}

function coverageKeyForShift(assignment: any, shiftType: any) {
  const label = String(assignment?.roleWorked || shiftType?.label || "").toUpperCase();
  if (label.includes("AUDIT") || label.includes("NIGHT")) return "AUDIT";
  if (label.includes("MOD") || /\bGM\b/.test(label) || label.includes("GENERAL MANAGER")) return "MOD";
  if (label.includes("PM")) return "PM";
  if (label.includes("AM")) return "AM";
  return "";
}

function resolveShiftTypeFromRole(role: string, shiftTypeByLabel: Map<string, any>) {
  const normalized = String(role || "").trim().toUpperCase();
  if (!normalized) return null;
  return shiftTypeByLabel.get(normalized)
    || (normalized.includes("AUDIT") || normalized.includes("NIGHT") ? shiftTypeByLabel.get("NIGHT AUDIT") || shiftTypeByLabel.get("AUDIT") : null)
    || (normalized.includes("DOS") || normalized.includes("SALES") ? shiftTypeByLabel.get("DOS / SALES") : null)
    || (normalized.includes("ROOM ATTENDANT") ? shiftTypeByLabel.get("ROOM ATTENDANT") || shiftTypeByLabel.get("HOUSEKEEPING") : null)
    || (normalized.includes("LAUNDRY") ? shiftTypeByLabel.get("LAUNDRY") : null)
    || (normalized.includes("HOUSEPERSON") || normalized.includes("HOUSEMAN") ? shiftTypeByLabel.get("HOUSEPERSON") : null)
    || (normalized.includes("INSPECTOR") ? shiftTypeByLabel.get("ROOM INSPECTOR") : null)
    || (normalized.includes("MAINTENANCE") ? shiftTypeByLabel.get("MAINTENANCE") : null)
    || (normalized.includes("BISTRO AM") ? shiftTypeByLabel.get("BISTRO AM") : null)
    || (normalized.includes("BISTRO PM") ? shiftTypeByLabel.get("BISTRO PM") : null)
    || (normalized.includes("BREAKFAST") ? shiftTypeByLabel.get("BREAKFAST") : null)
    || (normalized.includes("FD AM") ? shiftTypeByLabel.get("FD AM") : null)
    || (normalized.includes("FD PM") ? shiftTypeByLabel.get("FD PM") : null)
    || (normalized.includes("FRONT DESK") ? shiftTypeByLabel.get("FD AM") || shiftTypeByLabel.get("FRONT DESK") : null)
    || (normalized.includes("GM") ? shiftTypeByLabel.get("GM") : null)
    || HOUSEKEEPING_ROLE_SHIFT_FALLBACKS[normalized]
    || null;
}

function resolveShiftTypeForAssignment(assignment: any, shiftTypeById: Map<any, any>, shiftTypeByLabel: Map<string, any>) {
  const direct = shiftTypeById.get(assignment?.shiftTypeId);
  const role = String(assignment?.roleWorked || "").trim().toUpperCase();
  const roleResolved = resolveShiftTypeFromRole(role, shiftTypeByLabel);
  if (roleResolved) {
    const roleDepartment = normalizeDepartment(roleResolved.departmentHint || roleResolved.label);
    const directDepartment = normalizeDepartment(direct?.departmentHint || direct?.label);
    if (!direct || (roleDepartment && roleDepartment !== directDepartment)) return roleResolved;
  }
  return direct || roleResolved;
}

function assignmentRenderDepartment(assignment: any, employee: any, shiftType: any) {
  if (!assignment) return "";
  return normalizeDepartment(assignment.roleWorked || shiftType?.departmentHint || shiftType?.label || employee?.department);
}

function assignmentBelongsToDepartment(assignment: any, employee: any, shiftType: any, department: string) {
  return assignmentRenderDepartment(assignment, employee, shiftType) === normalizeDepartment(department);
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
    toolAccess: getToolAccess(user),
    isAdmin: role === "manager" || role === "super_admin",
    isSuperAdmin: role === "super_admin",
    scheduleRoles: rolesArray(user.scheduleRoles),
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

function scheduleDisplayName(user: any) {
  return user.employeeDisplayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Associate";
}

async function getUserBySession(req: any) {
  const userId = req.session?.tipsUserId;
  if (!userId) return null;
  const [user] = await db.select().from(tipsUsers).where(eq(tipsUsers.id, String(userId))).limit(1);
  return user || null;
}

async function isScheduleManager(user: any) {
  const publicUser = publicScheduleUser(user);
  if (publicUser.isAdmin) return true;
  const employee = await getScheduleEmployeeForUser(user);
  return Boolean(employee?.isDepartmentManager || hasManagerAccessRole(employee, user));
}

async function getScheduleEmployeeByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  const employees = await db.select().from(scheduleEmployees).where(eq(scheduleEmployees.active, true));
  return employees.find((employee) => normalizeEmail(String(employee.email || "")) === normalizedEmail) || null;
}

async function getScheduleEmployeeForUser(user: any) {
  const employees = await db.select().from(scheduleEmployees).where(eq(scheduleEmployees.active, true));
  return findEmployeeForUserInList(user, employees);
}

async function publicScheduleUserWithProfile(user: any) {
  const scheduleEmployee = await getScheduleEmployeeForUser(user);
  const baseUser = publicScheduleUser(user);
  const isDepartmentManager = Boolean(scheduleEmployee?.isDepartmentManager || hasManagerAccessRole(scheduleEmployee, user));
  const isAdmin = baseUser.isAdmin || isDepartmentManager;
  const scheduleRoles = rolesArray(scheduleEmployee?.rolesJson || user.position);
  const explicitTipsAccess = getExplicitToolAccess(user, "tips");
  const canAccessTips = explicitTipsAccess ?? (
    baseUser.isSuperAdmin
      || hasBistroScheduleRole(user.position)
      || hasBistroScheduleRole(scheduleEmployee?.department)
      || hasBistroScheduleRole(scheduleEmployee?.position)
      || scheduleRoles.some(hasBistroScheduleRole)
  );
  return {
    ...baseUser,
    role: isAdmin && baseUser.role === "employee" ? "manager" : baseUser.role,
    isAdmin,
    scheduleRoles,
    canAccessSchedule: getExplicitToolAccess(user, "schedule") !== false,
    canAccessTips,
    canAccessOpsReport: getExplicitToolAccess(user, "opsreport") ?? baseUser.isAdmin,
    department: scheduleEmployee ? primaryOperationalDepartment(scheduleEmployee, user.position) : null,
    isDepartmentManager,
  };
}

function employeeProfileMatches(employee: any, input: { email?: string; phone?: string; firstName?: string; lastName?: string }) {
  const emailMatch = input.email && normalizeEmail(String(employee.email || "")) === normalizeEmail(input.email);
  const phoneMatch = input.phone && String(employee.phone || "").replace(/\D/g, "") === String(input.phone || "").replace(/\D/g, "");
  const nameMatch = input.firstName && input.lastName &&
    String(employee.firstName || "").trim().toLowerCase() === input.firstName.trim().toLowerCase() &&
    String(employee.lastName || "").trim().toLowerCase() === input.lastName.trim().toLowerCase();
  return Boolean(emailMatch || phoneMatch || nameMatch);
}

async function upsertScheduleEmployeeForUser(user: any, profile: any) {
  const employees = await db.select().from(scheduleEmployees);
  const existing = employees.find((employee) => employeeProfileMatches(employee, profile));
  const isHousekeepingManager = hasHousekeepingManagerRole(profile.rolesJson);
  const department = isHousekeepingManager ? "Housekeeping" : normalizeDepartment(profile.department);
  const values = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    displayName: profile.employeeDisplayName || `${profile.firstName} ${profile.lastName}`,
    email: normalizeEmail(profile.email),
    phone: profile.phone,
    department,
    position: profile.position || (isHousekeepingManager ? "Executive Housekeeper" : rolesArray(profile.rolesJson).join(", ")),
    rolesJson: rolesArray(profile.rolesJson),
    isDepartmentManager: isHousekeepingManager || Boolean(existing?.isDepartmentManager),
    updatedAt: new Date(),
  } as any;
  if (existing) {
    const [employee] = await db.update(scheduleEmployees).set(values).where(eq(scheduleEmployees.id, existing.id)).returning();
    return employee;
  }
  const nextSort = employees.filter((employee) => normalizeDepartment(employee.department) === department).length + 1;
  const [employee] = await db.insert(scheduleEmployees).values({ ...values, sortOrder: nextSort, active: true } as any).returning();
  return employee;
}

async function getScheduleRequestDepartment(user: any) {
  const employee = await getScheduleEmployeeForUser(user);
  return primaryOperationalDepartment(employee, user.position);
}

async function getDepartmentManagerEmails(department: string) {
  const users = await db.select().from(tipsUsers);
  const employees = await db.select().from(scheduleEmployees).where(eq(scheduleEmployees.active, true));
  const managerEmails: string[] = [];
  const fallbackEmails = new Set<string>(SCHEDULE_ADMIN_EMAILS);
  const targetDepartment = normalizeDepartment(department);

  for (const user of users) {
    const email = normalizeEmail(String(user.email || ""));
    if (!email || user.disabledAt) continue;
    const publicUser = publicScheduleUser(user);
    const employee = findEmployeeForUserInList(user, employees);
    if (!publicUser.isAdmin && !employee?.isDepartmentManager && !hasManagerAccessRole(employee, user)) continue;
    const managedDepartments = managerDepartmentsForUser(user, employees);
    if (managedDepartments.includes(targetDepartment)) managerEmails.push(email);
    if (publicUser.isSuperAdmin) fallbackEmails.add(email);
  }

  const selected = managerEmails.length > 0 ? managerEmails : Array.from(fallbackEmails);
  return Array.from(new Set(selected.filter(Boolean)));
}

async function getScheduleRequestDepartmentsForManager(user: any) {
  const employees = await db.select().from(scheduleEmployees).where(eq(scheduleEmployees.active, true));
  return managerDepartmentsForUser(user, employees);
}

async function sendScheduleRequestEmail(request: any, requester: any, managerEmails: string[]) {
  if (!managerEmails.length) return false;
  const { client, fromEmail } = await getUncachableResendClient();
  const requesterName = scheduleDisplayName(requester);
  const timeWindow = [request.startTime?.slice(0, 5), request.endTime?.slice(0, 5)].filter(Boolean).join(" - ") || "Full day / not specified";
  const rangeLabel = request.requestEndDate && request.requestEndDate !== request.requestDate
    ? `${request.requestDate} to ${request.requestEndDate}`
    : request.requestDate;
  const latePolicyWarning = daysBetween(todayDateKey(), request.requestDate) < 14;

  await client.emails.send({
    from: fromEmail,
    to: managerEmails,
    subject: `Schedule Request - ${requesterName} - ${rangeLabel}`,
    text: [
      `Associate: ${requesterName}`,
      `Email: ${requester.email}`,
      `Department: ${request.department}`,
      `Request date(s): ${rangeLabel}`,
      `Request type: ${String(request.requestType || "").replace(/_/g, " ")}`,
      `Time: ${timeWindow}`,
      latePolicyWarning ? "Policy warning: This request was submitted inside the hotel's 14-day request window and is subject to manager approval." : "",
      "",
      "Notes:",
      request.notes || "",
      "",
      `Review in Schedule Admin: ${(process.env.FRONTEND_BASE_URL || "https://readysetfly.us").replace(/\/$/, "")}/schedule`,
    ].join("\n"),
  });

  return true;
}

async function getOrCreateScheduleShareLink(schedule: any, userId: string) {
  const [existing] = await db
    .select()
    .from(scheduleShareLinks)
    .where(and(eq(scheduleShareLinks.scheduleId, schedule.id), isNull(scheduleShareLinks.revokedAt)))
    .limit(1);

  const link = existing || (await db.insert(scheduleShareLinks).values({
    scheduleId: schedule.id,
    token: crypto.randomBytes(18).toString("hex"),
    createdByUserId: userId,
  }).returning())[0];

  const url = new URL(`/schedule?share=${link.token}`, process.env.FRONTEND_BASE_URL || "https://readysetfly.us").toString();
  return { link, url };
}

async function getActiveScheduleRecipientEmails() {
  const employees = await db.select().from(scheduleEmployees).where(eq(scheduleEmployees.active, true));
  const activeEmployeeEmails = new Set(employees.map((employee) => normalizeEmail(String(employee.email || ""))).filter(Boolean));
  const users = await db.select().from(tipsUsers).where(isNull(tipsUsers.disabledAt));
  return Array.from(new Set(
    users
      .map((user) => normalizeEmail(String(user.email || "")))
      .filter((email) => activeEmployeeEmails.has(email) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
  ));
}

async function sendPublishedScheduleEmails(schedule: any, url: string, recipients: string[]) {
  if (!recipients.length) return { sent: 0, failed: 0 };
  const { client, fromEmail } = await getUncachableResendClient();
  const subject = `${schedule.propertyName || PROPERTY_NAME} Schedule - ${schedule.weekStartDate} to ${schedule.weekEndDate}`;
  const html = `
    <div style="margin:0;padding:0;background:#f6efe6;font-family:Arial,Helvetica,sans-serif;color:#221814;">
      <div style="max-width:640px;margin:0 auto;padding:28px 18px;">
        <div style="background:#2a211c;color:#fff;border-radius:14px 14px 0 0;padding:24px 26px;">
          <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#d5bd91;">Courtyard Austin Lakeline</div>
          <h1 style="margin:8px 0 0;font-size:26px;line-height:1.2;">Weekly Schedule Published</h1>
          <p style="margin:10px 0 0;color:#eadfce;">${schedule.weekStartDate} to ${schedule.weekEndDate}</p>
        </div>
        <div style="background:#fffaf2;border:1px solid #dbc9b4;border-top:0;border-radius:0 0 14px 14px;padding:24px 26px;">
          <p style="margin:0 0 18px;font-size:15px;line-height:1.5;">The published schedule for <strong>${schedule.propertyName || PROPERTY_NAME}</strong> is ready to view.</p>
          <a href="${url}" style="display:inline-block;background:#28624f;color:#fff;text-decoration:none;border-radius:10px;padding:12px 18px;font-weight:700;">View Published Schedule</a>
          <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#6b5b4d;">This is a read-only schedule link. Contact your supervisor if you have a schedule question or need a correction.</p>
        </div>
      </div>
    </div>
  `;
  const text = [
    `${schedule.propertyName || PROPERTY_NAME} schedule is ready.`,
    "",
    `Week: ${schedule.weekStartDate} to ${schedule.weekEndDate}`,
    "",
    "View the published schedule here:",
    url,
    "",
    "This is a read-only schedule link. Contact your supervisor if you have a scheduling question.",
  ].join("\n");

  let sent = 0;
  let failed = 0;
  for (const email of recipients) {
    try {
      await client.emails.send({ from: fromEmail, to: email, subject, html, text });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error("schedule_email_send_failed", { scheduleId: schedule.id, email, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { sent, failed };
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendScheduleTeamMessage(schedule: any, url: string, recipients: string[], subjectInput: string, messageInput: string, sender: any) {
  if (!recipients.length) return { sent: 0, failed: 0 };
  const { client, fromEmail } = await getUncachableResendClient();
  const subject = subjectInput || `${schedule.propertyName || PROPERTY_NAME} Schedule Message`;
  const messageHtml = escapeHtml(messageInput).replace(/\n/g, "<br />");
  const senderName = escapeHtml(scheduleDisplayName(sender));
  const html = `
    <div style="margin:0;padding:0;background:#f6efe6;font-family:Arial,Helvetica,sans-serif;color:#221814;">
      <div style="max-width:640px;margin:0 auto;padding:28px 18px;">
        <div style="background:#2a211c;color:#fff;border-radius:14px 14px 0 0;padding:24px 26px;">
          <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#d5bd91;">Courtyard Austin Lakeline</div>
          <h1 style="margin:8px 0 0;font-size:25px;line-height:1.2;">Schedule Team Message</h1>
          <p style="margin:10px 0 0;color:#eadfce;">${escapeHtml(schedule.weekStartDate)} to ${escapeHtml(schedule.weekEndDate)}</p>
        </div>
        <div style="background:#fffaf2;border:1px solid #dbc9b4;border-top:0;border-radius:0 0 14px 14px;padding:24px 26px;">
          <div style="font-size:15px;line-height:1.55;margin-bottom:20px;">${messageHtml}</div>
          <a href="${escapeHtml(url)}" style="display:inline-block;background:#28624f;color:#fff;text-decoration:none;border-radius:10px;padding:12px 18px;font-weight:700;">View Schedule</a>
          <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#6b5b4d;">Sent by ${senderName}. Contact your supervisor if you have a schedule question.</p>
        </div>
      </div>
    </div>
  `;
  const text = [
    `${schedule.propertyName || PROPERTY_NAME} schedule message`,
    `Week: ${schedule.weekStartDate} to ${schedule.weekEndDate}`,
    "",
    messageInput,
    "",
    "View the schedule:",
    url,
    "",
    `Sent by ${scheduleDisplayName(sender)}.`,
  ].join("\n");

  let sent = 0;
  let failed = 0;
  for (const email of recipients) {
    try {
      await client.emails.send({ from: fromEmail, to: email, subject, html, text });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error("schedule_team_message_send_failed", { scheduleId: schedule.id, email, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { sent, failed };
}

const requireScheduleAuth: RequestHandler = async (req: any, res, next) => {
  try {
    const user = await getUserBySession(req);
    if (!user) return res.status(401).json({ error: "Schedule login required" });
    if (user.disabledAt) return res.status(403).json({ error: "This account is disabled." });
    if (user.mustChangePassword) return res.status(403).json({ error: "Password change required before continuing.", code: "PASSWORD_CHANGE_REQUIRED" });
    if (getExplicitToolAccess(user, "schedule") === false) return res.status(403).json({ error: "Schedule access has not been enabled for this account." });
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
    if (getExplicitToolAccess(user, "schedule") === false) return res.status(403).json({ error: "Schedule access has not been enabled for this account." });
    if (!(await isScheduleManager(user))) return res.status(403).json({ error: "Schedule manager access required" });
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

const forecastUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.toLowerCase().endsWith(".csv")) return cb(null, true);
    cb(new Error("Only CSV forecast reports are supported."));
  },
});

const payrollUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (file.mimetype === "application/pdf" || name.endsWith(".pdf") || file.mimetype === "text/plain" || name.endsWith(".txt")) return cb(null, true);
    cb(new Error("Only PDF or text payroll register files are supported."));
  },
});

const hoursDetailUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (
      name.endsWith(".xlsx") ||
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) return cb(null, true);
    cb(new Error("Only XLSX hours detail files are supported."));
  },
});

const employeeSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  displayName: z.string().trim().min(1).max(140).optional(),
  department: z.string().trim().min(1).max(120).default("Front Desk"),
  position: z.string().trim().max(120).optional().nullable(),
  rolesJson: z.array(z.string().trim().min(1).max(80)).optional().nullable(),
  isSalaried: z.boolean().optional().default(false),
  isDepartmentManager: z.boolean().optional().default(false),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  defaultShiftType: z.string().trim().max(80).optional().nullable(),
  maxWeeklyHours: z.coerce.number().min(0).max(168).optional().nullable(),
  hourlyRate: z.coerce.number().min(0).max(500).optional().nullable(),
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
    dndRooms: z.coerce.number().int().min(0).max(10000).optional().default(0),
    roomRevenue: z.coerce.number().min(0).max(10000000).optional().nullable(),
    popupGroupRooms: z.coerce.number().int().min(0).max(10000).optional().default(0),
    popupGroupNotes: z.string().max(2000).optional().nullable(),
    groupsEventsNotes: z.string().max(2000).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  })).min(1).max(7),
});

const popupGroupSchema = z.object({
  forecastDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  popupGroupRooms: z.coerce.number().int().min(0).max(10000).default(0),
  popupGroupNotes: z.string().trim().max(2000).optional().nullable(),
});

const housekeepingBoardSchema = z.object({
  employeeId: z.string().trim().min(1),
  boardDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  actualHours: z.coerce.number().min(0).max(24).default(0),
  checkoutRooms: z.coerce.number().int().min(0).max(500).default(0),
  stayoverRooms: z.coerce.number().int().min(0).max(500).default(0),
  dndRooms: z.coerce.number().int().min(0).max(500).default(0),
  oooRooms: z.coerce.number().int().min(0).max(500).default(0),
  deepCleanRooms: z.coerce.number().int().min(0).max(500).default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const actualHoursSchema = z.object({
  employeeId: z.string().trim().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  actualHours: z.coerce.number().min(0).max(24),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const timeInputSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 5) : null;
}, z.string().regex(/^\d{2}:\d{2}$/).nullable());

const scheduleRegisterSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  employeeDisplayName: z.string().trim().max(140).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  phone: z.string().trim().min(7).max(40),
  department: z.string().trim().min(1).max(120),
  rolesJson: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  position: z.string().trim().max(120).optional().nullable(),
});

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const headers = splitCsvLine(lines[0] || "").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseReportDate(value: string) {
  const parsed = new Date(`${value.replace(/^"|"$/g, "").trim()} 00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateKey(new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())));
}

function parseReportNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function occupancyTargetForDate(dateKey: string) {
  const day = parseDateKey(dateKey)?.getUTCDay();
  if (day === 0) return 50; // Sunday is typically softer than the weekly target.
  if (day === 5 || day === 6) return TARGET_OCCUPANCY_PERCENT;
  return Math.max(55, Math.min(TARGET_OCCUPANCY_PERCENT, 60));
}

function pickupRoomsForDemand(leadDays: number, occupancyPercent: number) {
  const leadWindowPickup = leadDays <= 1 ? 4 : leadDays <= 3 ? 15 : leadDays <= 5 ? 12 : 8;
  const occupancyPickup =
    occupancyPercent < 35 ? 15 :
    occupancyPercent < 50 ? 12 :
    occupancyPercent < 60 ? 8 :
    occupancyPercent < TARGET_OCCUPANCY_PERCENT ? 5 :
    0;
  return Math.min(leadWindowPickup, occupancyPickup);
}

function forecastFromOnTheBooksCsv(text: string, scheduleDays: string[]) {
  const rows = parseCsv(text);
  const today = todayDateKey();
  const forecastByDate = new Map<string, any>();

  for (const row of rows) {
    if (String(row.Date || "").trim().toUpperCase() === "TOTAL") continue;
    const forecastDate = parseReportDate(String(row.Date || ""));
    if (!forecastDate || !scheduleDays.includes(forecastDate)) continue;
    const roomsSoldOtb = parseReportNumber(row["Rms Sold"]);
    const occOtb = parseReportNumber(row["Occ %"]);
    const activeRooms = parseReportNumber(row["Rms Active"]);
    const outOfOrder = parseReportNumber(row.OOO);
    const capacity = Math.max(1, activeRooms - outOfOrder);
    const leadDays = Math.max(0, daysBetween(today, forecastDate));
    const occupancyPercent = occOtb || Number(((roomsSoldOtb / capacity) * 100).toFixed(1));
    const targetOccupancyPercent = occupancyTargetForDate(forecastDate);
    const pickupRooms = pickupRoomsForDemand(leadDays, occupancyPercent);
    const targetRooms = Math.ceil(capacity * (targetOccupancyPercent / 100));
    const suggestedForecastRooms = Math.min(capacity, Math.min(targetRooms, roomsSoldOtb + pickupRooms));
    const suggestedPickup = Math.max(0, suggestedForecastRooms - roomsSoldOtb);
    const arrivals = parseReportNumber(row.Arr);
    const departures = parseReportNumber(row.Dept);
    const stayovers = Math.max(0, roomsSoldOtb - arrivals);
    const roomRevenueOtb = parseReportNumber(row["Rm Rev ($)"]);

    forecastByDate.set(forecastDate, {
      forecastDate,
      roomsSold: roomsSoldOtb,
      occupancyPercent,
      arrivals,
      departures,
      stayovers,
      otbRoomsSold: roomsSoldOtb,
      otbOccupancyPercent: occOtb,
      otbArrivals: parseReportNumber(row.Arr),
      otbDepartures: parseReportNumber(row.Dept),
      otbRoomRevenue: roomRevenueOtb,
      roomRevenue: roomRevenueOtb,
      notes: `Imported OTB: ${roomsSoldOtb} rooms / ${occupancyPercent}%. Suggested pickup is +${suggestedPickup} rooms toward ${targetOccupancyPercent}% ${targetOccupancyPercent === TARGET_OCCUPANCY_PERCENT ? "weekly" : "day"} target using the ${leadDays}-day pickup window.`,
    });
  }

  return scheduleDays.map((day) => forecastByDate.get(day)).filter(Boolean);
}

function actualizedFromOnTheBooksCsv(text: string, scheduleDays: string[]) {
  const rows = parseCsv(text);
  const actualByDate = new Map<string, any>();
  for (const row of rows) {
    if (String(row.Date || "").trim().toUpperCase() === "TOTAL") continue;
    const forecastDate = parseReportDate(String(row.Date || ""));
    if (!forecastDate || !scheduleDays.includes(forecastDate)) continue;
    actualByDate.set(forecastDate, {
      forecastDate,
      actualRoomsSold: parseReportNumber(row["Rms Sold"]),
      actualOccupancyPercent: parseReportNumber(row["Occ %"]),
      actualArrivals: parseReportNumber(row.Arr),
      actualDepartures: parseReportNumber(row.Dept),
      actualRoomRevenue: parseReportNumber(row["Rm Rev ($)"]),
    });
  }
  return scheduleDays.map((day) => actualByDate.get(day)).filter(Boolean);
}

const shiftAssignmentSchema = z.object({
  employeeId: z.string().optional().nullable(),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftTypeId: z.string().optional().nullable(),
  customStartTime: timeInputSchema.optional(),
  customEndTime: timeInputSchema.optional(),
  unpaidBreakMinutes: z.coerce.number().int().min(0).max(240).optional().nullable(),
  roleWorked: z.string().max(120).optional().nullable(),
  roleNote: z.string().max(300).optional().nullable(),
  managerNote: z.string().max(1000).optional().nullable(),
  isOpenShift: z.boolean().default(false),
  clear: z.boolean().default(false),
});

const copyPreviousScheduleSchema = z.object({
  scope: z.enum(["all", "employee"]).default("all"),
  employeeId: z.string().optional().nullable(),
  department: z.string().trim().max(120).optional().nullable(),
});

const aiDraftApplySchema = z.object({
  mode: z.enum(["frontDesk", "housekeeping"]).optional(),
  assignments: z.array(z.object({
    employeeId: z.string().min(1),
    shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    shiftTypeId: z.string().min(1),
    customStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    customEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    unpaidBreakMinutes: z.coerce.number().int().min(0).max(240).optional().nullable(),
    roleWorked: z.string().max(120).optional().nullable(),
    roleNote: z.string().max(200).optional().nullable(),
    managerNote: z.string().max(2000).optional().nullable(),
    isOpenShift: z.boolean().default(false),
  })).min(1).max(250),
});

const scheduleRequestSchema = z.object({
  requestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requestEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  requestType: z.enum(["time_off", "preferred_shift", "availability", "other"]).default("time_off"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  notes: z.string().trim().min(1).max(2000),
});

const scheduleRequestStatusSchema = z.object({
  status: z.enum(["submitted", "approved", "denied", "cancelled"]),
});

const scheduleTeamMessageSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(5000),
});

async function seedShiftTypes() {
  const existing = await db.select({ label: scheduleShiftTypes.label }).from(scheduleShiftTypes);
  const labels = new Set(existing.map((row) => row.label));
  const missing = DEFAULT_SHIFT_TYPES.filter((shift) => !labels.has(shift.label));
  if (missing.length) await db.insert(scheduleShiftTypes).values(missing as any);
  await db.update(scheduleShiftTypes).set({ endTime: "15:00", updatedAt: new Date() } as any).where(inArray(scheduleShiftTypes.label, ["LAUNDRY", "Laundry"]));
}

async function audit(scheduleId: string | null, actorUserId: string | null, action: string, metadataJson?: any) {
  await db.insert(scheduleAuditLog).values({ scheduleId, actorUserId, action, metadataJson: metadataJson || null });
}

async function getScheduleOr404(id: string) {
  const [schedule] = await db.select().from(weeklySchedules).where(eq(weeklySchedules.id, id)).limit(1);
  return schedule || null;
}

async function canManageDepartment(user: any, department: string) {
  const publicUser = publicScheduleUser(user);
  if (publicUser.isSuperAdmin) return true;
  const employees = await db.select().from(scheduleEmployees).where(eq(scheduleEmployees.active, true));
  return managerDepartmentsForUser(user, employees).includes(normalizeDepartment(department));
}

function sectionCompleted(schedule: any, department: string) {
  const status = (schedule.departmentStatusJson || {})[normalizeDepartment(department)];
  return Boolean(status?.completedAt);
}

async function buildSchedulePayload(scheduleId: string) {
  await seedShiftTypes();
  const schedule = await getScheduleOr404(scheduleId);
  if (!schedule) return null;
  const days = weekDays(schedule.weekStartDate);
  const [employees, shiftTypes, forecast, assignments, housekeepingBoards, actualHours, approvedRequestRows] = await Promise.all([
    db.select().from(scheduleEmployees).orderBy(asc(scheduleEmployees.department), asc(scheduleEmployees.sortOrder), asc(scheduleEmployees.displayName)),
    db.select().from(scheduleShiftTypes).orderBy(asc(scheduleShiftTypes.sortOrder), asc(scheduleShiftTypes.label)),
    db.select().from(scheduleForecastDays).where(eq(scheduleForecastDays.scheduleId, scheduleId)).orderBy(asc(scheduleForecastDays.forecastDate)),
    db.select().from(scheduleShiftAssignments).where(eq(scheduleShiftAssignments.scheduleId, scheduleId)).orderBy(asc(scheduleShiftAssignments.shiftDate)),
    db.select().from(scheduleHousekeepingBoards).where(eq(scheduleHousekeepingBoards.scheduleId, scheduleId)).orderBy(asc(scheduleHousekeepingBoards.boardDate)),
    db.select().from(scheduleActualHours).where(eq(scheduleActualHours.scheduleId, scheduleId)).orderBy(asc(scheduleActualHours.workDate)),
    db
      .select({ request: scheduleRequests, user: tipsUsers })
      .from(scheduleRequests)
      .innerJoin(tipsUsers, eq(scheduleRequests.requesterUserId, tipsUsers.id))
      .where(eq(scheduleRequests.status, "approved")),
  ]);
  const employeeByEmail = new Map(employees.map((employee) => [normalizeEmail(String(employee.email || "")), employee]));
  const approvedRequests = approvedRequestRows
    .flatMap((row) => {
      const employee = employeeByEmail.get(normalizeEmail(String(row.user.email || "")));
      if (!employee) return [];
      return dateRange(row.request.requestDate, requestEndDate(row.request))
        .filter((requestDate) => days.includes(requestDate))
        .map((requestDate) => ({
        ...row.request,
        requestDate,
        originalRequestDate: row.request.requestDate,
        requestEndDate: requestEndDate(row.request),
        employeeId: employee.id,
        employeeName: employee.displayName,
        requester: publicScheduleUser(row.user),
      }));
    })
    .filter(Boolean);
  const totals = calculateTotals(days, employees, shiftTypes, forecast, assignments);
  const employeeById = new Map<string, any>(employees.map((employee) => [employee.id, employee]));
  const shiftTypeById = new Map<string, any>(shiftTypes.map((shift) => [shift.id, shift]));
  const assignmentByEmployeeDay = new Map<string, any>(
    assignments
      .filter((assignment) => assignment.employeeId)
      .map((assignment) => [`${assignment.employeeId}:${assignment.shiftDate}`, assignment]),
  );
  const actualHousekeepingHours = actualHours.reduce((sum, row) => {
    const employee = employeeById.get(row.employeeId);
    if (!employee) return sum;
    const assignment = assignmentByEmployeeDay.get(`${row.employeeId}:${row.workDate}`);
    const shiftType = assignment?.shiftTypeId ? shiftTypeById.get(assignment.shiftTypeId) : null;
    const department = assignment
      ? assignmentRenderDepartment(assignment, employee, shiftType)
      : normalizeDepartment(employee.department);
    return department === "Housekeeping" ? sum + Number(row.actualHours || 0) : sum;
  }, 0);
  const scheduledHousekeepingHours = assignments.reduce((sum, assignment) => {
    if (assignment.isOpenShift) return sum;
    const employee = assignment.employeeId ? employeeById.get(assignment.employeeId) : null;
    const shiftType = assignment.shiftTypeId ? shiftTypeById.get(assignment.shiftTypeId) : null;
    const department = assignmentRenderDepartment(assignment, employee, shiftType);
    return department === "Housekeeping" ? sum + hoursForShift(assignment, shiftType) : sum;
  }, 0);
  const forecastRooms = Number(totals.laborMetrics?.weekly.roomsSold || 0);
  const actualRoomsComplete = days.every((day) => forecast.some((row) => row.forecastDate === day && row.actualRoomsSold != null));
  const actualRooms = actualRoomsComplete
    ? forecast.reduce((sum, row) => sum + Number(row.actualRoomsSold || 0), 0)
    : 0;
  if (totals.laborMetrics?.weekly) {
    (totals.laborMetrics.weekly as any).fullDepartmentHousekeepingMpor = {
      target: 30,
      forecastHours: Number(scheduledHousekeepingHours.toFixed(2)),
      forecastRooms,
      forecastMpor: Number((forecastRooms > 0 ? (scheduledHousekeepingHours * 60) / forecastRooms : 0).toFixed(1)),
      actualHours: Number(actualHousekeepingHours.toFixed(2)),
      actualRooms,
      actualMpor: actualHousekeepingHours > 0 && actualRooms > 0
        ? Number(((actualHousekeepingHours * 60) / actualRooms).toFixed(1))
        : null,
      actualReady: actualHousekeepingHours > 0 && actualRoomsComplete && actualRooms > 0,
    };
  }
  return { schedule, days, departments: DEPARTMENTS, requiredDepartments: REQUIRED_DEPARTMENTS, employees, shiftTypes, forecast, assignments, actualHours, housekeepingBoards: housekeepingBoards.map(summarizeHousekeepingBoard), approvedRequests, totals, departmentStatus: schedule.departmentStatusJson || {} };
}

function summarizeHousekeepingBoard(board: any) {
  const actualHours = Number(board.actualHours || 0);
  const checkoutRooms = Number(board.checkoutRooms || 0);
  const stayoverRooms = Number(board.stayoverRooms || 0);
  const dndRooms = Number(board.dndRooms || 0);
  const deepCleanRooms = Number(board.deepCleanRooms || 0);
  const serviceStayovers = Math.max(0, stayoverRooms - dndRooms);
  const roomCredits = Math.max(0, checkoutRooms + serviceStayovers * 0.5 + deepCleanRooms);
  const standardMinutes = Math.max(0, checkoutRooms * 30 + serviceStayovers * 15 + deepCleanRooms * 30);
  const mpor = roomCredits > 0 ? (actualHours * 60) / roomCredits : 0;
  return {
    ...board,
    actualHours,
    roomCredits: Number(roomCredits.toFixed(2)),
    standardMinutes,
    mpor: Number(mpor.toFixed(2)),
  };
}

function stripPrivateScheduleRates(payload: any, user: any) {
  const publicUser = publicScheduleUser(user);
  const editableDepartments = managerDepartmentsForUser(user, payload.employees);
  const enriched = { ...payload, currentUserPermissions: { editableDepartments, canPublishFinal: publicUser.isSuperAdmin } };
  if (publicUser.isSuperAdmin) return enriched;
  const {
    totalWeeklyLaborDollars,
    totalWeeklyLaborDollarsIncludingSalary,
    totalWeeklySalariedLaborDollars,
    totalWeeklyLaborPercentOfRoomRevenue,
    totalWeeklyLaborPercentOfRoomRevenueIncludingSalary,
    dailyLaborDollars,
    dailyLaborDollarsIncludingSalary,
    dailySalariedLaborDollars,
    departmentWeeklyLaborDollars,
    departmentWeeklyLaborDollarsIncludingSalary,
    laborMetrics,
    ...publicTotals
  } = payload.totals || {};
  return {
    ...enriched,
    employees: payload.employees.map(({ hourlyRate, ...employee }: any) => employee),
    totals: {
      ...publicTotals,
      laborMetrics: laborMetrics
        ? {
            ...laborMetrics,
            daily: Object.fromEntries(Object.entries(laborMetrics.daily || {}).map(([day, metrics]: [string, any]) => {
              const { laborDollars, ...publicMetrics } = metrics;
              return [day, publicMetrics];
            })),
            weekly: (() => {
              const { laborDollars, roomRevenue, actualRoomRevenue, ...publicWeekly } = laborMetrics.weekly || {};
              return publicWeekly;
            })(),
          }
        : undefined,
    },
  };
}

function stripPrivateEmployeeRates(employees: any[], user: any) {
  if (publicScheduleUser(user).isSuperAdmin) return employees;
  return employees.map(({ hourlyRate, ...employee }: any) => employee);
}

async function addRequestConflictInfo(rows: Array<{ request: any; user: any }>) {
  const approved = await db.select().from(scheduleRequests).where(eq(scheduleRequests.status, "approved"));
  return rows.map((row) => {
    const conflicts = approved.filter((request) =>
      request.department === row.request.department &&
      requestRangesOverlap(request, row.request) &&
      request.id !== row.request.id,
    );
    return {
      ...row.request,
      requester: publicScheduleUser(row.user),
      conflictCount: conflicts.length,
    };
  });
}

async function getApprovedRequestForEmployeeDate(employeeId: string, requestDate: string) {
  const [employee] = await db.select().from(scheduleEmployees).where(eq(scheduleEmployees.id, employeeId)).limit(1);
  const employeeEmail = normalizeEmail(String(employee?.email || ""));
  if (!employeeEmail) return null;
  const rows = await db
    .select({ request: scheduleRequests, user: tipsUsers })
    .from(scheduleRequests)
    .innerJoin(tipsUsers, eq(scheduleRequests.requesterUserId, tipsUsers.id))
    .where(eq(scheduleRequests.status, "approved"));
  return rows.find((row) =>
    normalizeEmail(String(row.user.email || "")) === employeeEmail &&
    dateInRequestRange(row.request, requestDate)
  )?.request || null;
}

function calculateTotals(days: string[], employees: any[], shiftTypes: any[], forecast: any[], assignments: any[]) {
  const shiftTypeById = new Map(shiftTypes.map((shift) => [shift.id, shift]));
  const shiftTypeByLabel = new Map(shiftTypes.map((shift) => [String(shift.label || "").toUpperCase(), shift]));
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const employeeWeeklyHours: Record<string, number> = {};
  const employeeDepartmentWeeklyHours: Record<string, Record<string, number>> = {};
  const departmentDailyHours: Record<string, Record<string, number>> = {};
  const departmentWeeklyHours: Record<string, number> = {};
  const dailyLaborHours: Record<string, number> = Object.fromEntries(days.map((day) => [day, 0]));
  const dailyLaborHoursIncludingSalary: Record<string, number> = Object.fromEntries(days.map((day) => [day, 0]));
  const dailySalariedLaborHours: Record<string, number> = Object.fromEntries(days.map((day) => [day, 0]));
  const dailyLaborDollars: Record<string, number> = Object.fromEntries(days.map((day) => [day, 0]));
  const dailyLaborDollarsIncludingSalary: Record<string, number> = Object.fromEntries(days.map((day) => [day, 0]));
  const dailySalariedLaborDollars: Record<string, number> = Object.fromEntries(days.map((day) => [day, 0]));
  const departmentWeeklyLaborDollars: Record<string, number> = {};
  const departmentWeeklyLaborDollarsIncludingSalary: Record<string, number> = {};
  const roomAttendantDailyHours: Record<string, number> = Object.fromEntries(days.map((day) => [day, 0]));
  const coverage: Record<string, Record<string, number>> = Object.fromEntries(days.map((day) => [day, { AM: 0, PM: 0, AUDIT: 0, MOD: 0 }]));
  let openShiftCount = 0;
  const warnings: string[] = [];
  const assignmentKeys = new Set<string>();

  for (const assignment of assignments) {
    const shiftType = resolveShiftTypeForAssignment(assignment, shiftTypeById, shiftTypeByLabel);
    const employee = assignment.employeeId ? employeeById.get(assignment.employeeId) : null;
    const department = normalizeDepartment(assignment.roleWorked || employee?.department || shiftType?.departmentHint);
    const hours = hoursForShift(assignment, shiftType);
    const isSalaried = employee ? isSalariedScheduleManager(employee) : false;
    const laborDollarsIncludingSalary = hours * Number(employee?.hourlyRate || 0);
    const laborDollars = isSalaried ? 0 : laborDollarsIncludingSalary;
    const salariedLaborDollars = isSalaried ? laborDollarsIncludingSalary : 0;
    const hourlyHours = isSalaried ? 0 : hours;
    const salariedHours = isSalaried ? hours : 0;
    if (assignment.isOpenShift || shiftType?.label === "OPEN SHIFT") openShiftCount += 1;
    if (employee?.id) {
      const key = `${employee.id}:${assignment.shiftDate}`;
      if (assignmentKeys.has(key)) warnings.push(`${employee.displayName} has duplicate shifts on ${assignment.shiftDate}.`);
      assignmentKeys.add(key);
      employeeWeeklyHours[employee.id] = (employeeWeeklyHours[employee.id] || 0) + hourlyHours;
      employeeDepartmentWeeklyHours[employee.id] ||= {};
      employeeDepartmentWeeklyHours[employee.id][department] = (employeeDepartmentWeeklyHours[employee.id][department] || 0) + hourlyHours;
    }
    departmentDailyHours[department] ||= {};
    departmentDailyHours[department][assignment.shiftDate] = (departmentDailyHours[department][assignment.shiftDate] || 0) + hourlyHours;
    departmentWeeklyHours[department] = (departmentWeeklyHours[department] || 0) + hourlyHours;
    departmentWeeklyLaborDollars[department] = (departmentWeeklyLaborDollars[department] || 0) + laborDollars;
    departmentWeeklyLaborDollarsIncludingSalary[department] = (departmentWeeklyLaborDollarsIncludingSalary[department] || 0) + laborDollarsIncludingSalary;
    if (department === "Housekeeping" && isRoomAttendantWork(assignment, shiftType, employee)) {
      roomAttendantDailyHours[assignment.shiftDate] = (roomAttendantDailyHours[assignment.shiftDate] || 0) + hourlyHours;
    }
    dailyLaborHours[assignment.shiftDate] = (dailyLaborHours[assignment.shiftDate] || 0) + hourlyHours;
    dailyLaborHoursIncludingSalary[assignment.shiftDate] = (dailyLaborHoursIncludingSalary[assignment.shiftDate] || 0) + hours;
    dailySalariedLaborHours[assignment.shiftDate] = (dailySalariedLaborHours[assignment.shiftDate] || 0) + salariedHours;
    dailyLaborDollars[assignment.shiftDate] = (dailyLaborDollars[assignment.shiftDate] || 0) + laborDollars;
    dailyLaborDollarsIncludingSalary[assignment.shiftDate] = (dailyLaborDollarsIncludingSalary[assignment.shiftDate] || 0) + laborDollarsIncludingSalary;
    dailySalariedLaborDollars[assignment.shiftDate] = (dailySalariedLaborDollars[assignment.shiftDate] || 0) + salariedLaborDollars;
    const coverageKey = coverageKeyForShift(assignment, shiftType);
    if (coverageKey && coverage[assignment.shiftDate]?.[coverageKey] != null) coverage[assignment.shiftDate][coverageKey] += 1;
  }

  for (const employee of employees) {
    const max = Number(employee.maxWeeklyHours || 0);
    const total = employeeWeeklyHours[employee.id] || 0;
    if (max > 0 && total > max) warnings.push(`${employee.displayName} is scheduled ${total.toFixed(1)} hours, over max ${max}.`);
  }
  for (const day of days) {
    if ((coverage[day]?.AUDIT || 0) < 1) warnings.push(`No audit scheduled on ${day}.`);
  }
  for (const day of forecast) {
    const fdHours = departmentDailyHours["Front Desk"]?.[day.forecastDate] || 0;
    const hkHours = departmentDailyHours["Housekeeping"]?.[day.forecastDate] || 0;
    if (Number(day.occupancyPercent || 0) >= 85 && fdHours < 16) warnings.push(`High occupancy on ${day.forecastDate} with low Front Desk coverage.`);
    if (Number(day.departures || 0) >= 45 && hkHours < 24) warnings.push(`High departures on ${day.forecastDate} with low Housekeeping coverage.`);
  }
  if (openShiftCount > 0) warnings.push(`${openShiftCount} open shift(s) remaining.`);
  const laborMetrics = calculateLaborMetrics(days, forecast, dailyLaborHours, departmentDailyHours, roomAttendantDailyHours, dailyLaborDollars);
  const bistroLabor = calculateBistroLaborTarget(forecast, departmentWeeklyHours["Bistro"] || 0);
  if (laborMetrics.weekly.hpor > TARGET_HPOR) warnings.push(`Weekly HPOR ${laborMetrics.weekly.hpor.toFixed(2)} is above target ${TARGET_HPOR}.`);
  if (laborMetrics.weekly.hkMpor > TARGET_HK_MPOR_MAX) warnings.push(`Scheduled Room Attendant MPOR ${laborMetrics.weekly.hkMpor.toFixed(1)} is above target ${TARGET_HK_MPOR_MIN}-${TARGET_HK_MPOR_MAX}.`);
  const totalWeeklyLaborDollars = Object.values(dailyLaborDollars).reduce((sum, value) => sum + value, 0);
  const totalWeeklyLaborDollarsIncludingSalary = Object.values(dailyLaborDollarsIncludingSalary).reduce((sum, value) => sum + value, 0);
  const totalWeeklySalariedLaborDollars = Object.values(dailySalariedLaborDollars).reduce((sum, value) => sum + value, 0);
  const weeklyRoomRevenue = Number(laborMetrics.weekly.roomRevenue || 0);
  const laborPercentOfRoomRevenue = weeklyRoomRevenue > 0 ? (totalWeeklyLaborDollars / weeklyRoomRevenue) * 100 : 0;
  const laborPercentOfRoomRevenueIncludingSalary = weeklyRoomRevenue > 0 ? (totalWeeklyLaborDollarsIncludingSalary / weeklyRoomRevenue) * 100 : 0;
  if (bistroLabor.status === "under") warnings.push(`Bistro scheduled hours ${bistroLabor.scheduledHours} are below ${bistroLabor.model} target ${bistroLabor.targetMinHours}-${bistroLabor.targetMaxHours}.`);
  if (bistroLabor.status === "over") warnings.push(`Bistro scheduled hours ${bistroLabor.scheduledHours} are above ${bistroLabor.model} target ${bistroLabor.targetMinHours}-${bistroLabor.targetMaxHours}.`);
  if (laborPercentOfRoomRevenueIncludingSalary > 32) {
    warnings.push(`Projected labor is ${laborPercentOfRoomRevenueIncludingSalary.toFixed(1)}% of room revenue. Recommend reducing scheduled hours or having managers cover appropriate shifts.`);
  } else if (laborPercentOfRoomRevenueIncludingSalary > 25) {
    warnings.push(`Projected labor is ${laborPercentOfRoomRevenueIncludingSalary.toFixed(1)}% of room revenue, above the 25% target.`);
  }

  return {
    employeeWeeklyHours: roundRecord(employeeWeeklyHours),
    employeeDepartmentWeeklyHours: roundNestedRecord(employeeDepartmentWeeklyHours),
    departmentDailyHours: roundNestedRecord(departmentDailyHours),
    departmentWeeklyHours: roundRecord(departmentWeeklyHours),
    departmentWeeklyLaborDollars: roundRecord(departmentWeeklyLaborDollars),
    departmentWeeklyLaborDollarsIncludingSalary: roundRecord(departmentWeeklyLaborDollarsIncludingSalary),
    dailyLaborHours: roundRecord(dailyLaborHours),
    dailyLaborHoursIncludingSalary: roundRecord(dailyLaborHoursIncludingSalary),
    dailySalariedLaborHours: roundRecord(dailySalariedLaborHours),
    dailyLaborDollars: roundRecord(dailyLaborDollars),
    dailyLaborDollarsIncludingSalary: roundRecord(dailyLaborDollarsIncludingSalary),
    dailySalariedLaborDollars: roundRecord(dailySalariedLaborDollars),
    totalWeeklyLaborHours: Object.values(dailyLaborHours).reduce((sum, value) => sum + value, 0).toFixed(2),
    totalWeeklyLaborHoursIncludingSalary: Object.values(dailyLaborHoursIncludingSalary).reduce((sum, value) => sum + value, 0).toFixed(2),
    totalWeeklySalariedLaborHours: Object.values(dailySalariedLaborHours).reduce((sum, value) => sum + value, 0).toFixed(2),
    totalWeeklyLaborDollars: totalWeeklyLaborDollars.toFixed(2),
    totalWeeklyLaborDollarsIncludingSalary: totalWeeklyLaborDollarsIncludingSalary.toFixed(2),
    totalWeeklySalariedLaborDollars: totalWeeklySalariedLaborDollars.toFixed(2),
    totalWeeklyLaborPercentOfRoomRevenue: laborPercentOfRoomRevenue.toFixed(1),
    totalWeeklyLaborPercentOfRoomRevenueIncludingSalary: laborPercentOfRoomRevenueIncludingSalary.toFixed(1),
    coverage,
    openShiftCount,
    warnings,
    laborMetrics,
    bistroLabor,
  };
}

function calculateLaborMetrics(
  days: string[],
  forecast: any[],
  dailyLaborHours: Record<string, number>,
  departmentDailyHours: Record<string, Record<string, number>>,
  roomAttendantDailyHours: Record<string, number>,
  dailyLaborDollars: Record<string, number>,
) {
  const forecastByDay = new Map(forecast.map((day) => [day.forecastDate, day]));
  const daily: Record<string, any> = {};
  let weeklyLaborHours = 0;
  let weeklyRooms = 0;
  let weeklyRoomCredits = 0;
  let weeklyStandardHousekeepingMinutes = 0;
  let weeklyHkHours = 0;
  let weeklyRoomAttendantHours = 0;
  let weeklyRoomRevenue = 0;
  let weeklyActualRoomRevenue = 0;
  let weeklyLaborDollars = 0;

  for (const day of days) {
    const forecastDay = forecastByDay.get(day) || {};
    const roomsSold = Number(forecastDay.roomsSold || 0) + Number(forecastDay.popupGroupRooms || 0);
    const arrivals = Number(forecastDay.arrivals || 0);
    const departures = Number(forecastDay.departures || 0);
    const stayovers = Number(forecastDay.stayovers || Math.max(0, roomsSold - arrivals));
    const dndRooms = Number(forecastDay.dndRooms || 0);
    const laborHours = Number(dailyLaborHours[day] || 0);
    const laborDollars = Number(dailyLaborDollars[day] || 0);
    const hkHours = Number(departmentDailyHours["Housekeeping"]?.[day] || 0);
    const roomAttendantHours = Number(roomAttendantDailyHours[day] || 0);
    const serviceStayovers = Math.max(0, stayovers - dndRooms);
    const roomCredits = Math.max(0, departures + serviceStayovers * 0.5);
    const standardMinutes = Math.max(0, departures * 30 + serviceStayovers * 15);
    const targetRoomAttendantHours = standardMinutes / 60;
    const targetLaundryHours = 7;
    const targetHousepersonHours = 7;
    const hpor = roomsSold > 0 ? laborHours / roomsSold : 0;
    const hkMpor = roomCredits > 0 ? (roomAttendantHours * 60) / roomCredits : 0;
    const roomRevenue = Number(forecastDay.roomRevenue || 0);
    const actualRoomRevenue = Number(forecastDay.actualRoomRevenue || 0);
    daily[day] = {
      roomsSold,
      pickupRooms: forecastDay.actualRoomsSold != null && forecastDay.otbRoomsSold != null ? Number(forecastDay.actualRoomsSold || 0) - Number(forecastDay.otbRoomsSold || 0) : null,
      popupGroupRooms: Number(forecastDay.popupGroupRooms || 0),
      laborHours: Number(laborHours.toFixed(2)),
      laborDollars: Number(laborDollars.toFixed(2)),
      hpor: Number(hpor.toFixed(2)),
      housekeepingHours: Number(hkHours.toFixed(2)),
      roomAttendantHours: Number(roomAttendantHours.toFixed(2)),
      roomCredits: Number(roomCredits.toFixed(1)),
      serviceStayovers,
      dndRooms,
      standardHousekeepingMinutes: standardMinutes,
      hkMpor: Number(hkMpor.toFixed(1)),
      targetHousekeepingHoursMin: Number(((roomCredits * TARGET_HK_MPOR_MIN) / 60).toFixed(2)),
      targetHousekeepingHoursMax: Number(((roomCredits * TARGET_HK_MPOR_MAX) / 60).toFixed(2)),
      targetRoomAttendantHours: Number(targetRoomAttendantHours.toFixed(2)),
      targetLaundryHours,
      targetHousepersonHours,
      targetTotalHousekeepingOperatingHours: Number((targetRoomAttendantHours + targetLaundryHours + targetHousepersonHours).toFixed(2)),
    };
    weeklyLaborHours += laborHours;
    weeklyLaborDollars += laborDollars;
    weeklyRooms += roomsSold;
    weeklyRoomCredits += roomCredits;
    weeklyStandardHousekeepingMinutes += standardMinutes;
    weeklyHkHours += hkHours;
    weeklyRoomAttendantHours += roomAttendantHours;
    weeklyRoomRevenue += roomRevenue;
    weeklyActualRoomRevenue += actualRoomRevenue;
  }

  return {
    targets: { hpor: TARGET_HPOR, hkMporMin: TARGET_HK_MPOR_MIN, hkMporMax: TARGET_HK_MPOR_MAX },
    daily,
    weekly: {
      roomsSold: weeklyRooms,
      laborHours: Number(weeklyLaborHours.toFixed(2)),
      laborDollars: Number(weeklyLaborDollars.toFixed(2)),
      roomRevenue: Number(weeklyRoomRevenue.toFixed(2)),
      actualRoomRevenue: Number(weeklyActualRoomRevenue.toFixed(2)),
      hpor: Number((weeklyRooms > 0 ? weeklyLaborHours / weeklyRooms : 0).toFixed(2)),
      housekeepingHours: Number(weeklyHkHours.toFixed(2)),
      roomAttendantHours: Number(weeklyRoomAttendantHours.toFixed(2)),
      roomCredits: Number(weeklyRoomCredits.toFixed(1)),
      hkMpor: Number((weeklyRoomCredits > 0 ? (weeklyRoomAttendantHours * 60) / weeklyRoomCredits : 0).toFixed(1)),
      targetHousekeepingHoursMin: Number(((weeklyRoomCredits * TARGET_HK_MPOR_MIN) / 60).toFixed(2)),
      targetHousekeepingHoursMax: Number(((weeklyRoomCredits * TARGET_HK_MPOR_MAX) / 60).toFixed(2)),
      standardHousekeepingMinutes: Number(weeklyStandardHousekeepingMinutes.toFixed(0)),
      targetRoomAttendantHours: Number((weeklyStandardHousekeepingMinutes / 60).toFixed(2)),
      targetLaundryHours: Number((days.length * 7).toFixed(2)),
      targetHousepersonHours: Number((days.length * 7).toFixed(2)),
      targetTotalHousekeepingOperatingHours: Number(((weeklyStandardHousekeepingMinutes / 60) + (days.length * 14)).toFixed(2)),
    },
  };
}

function calculateBistroLaborTarget(forecast: any[], bistroWeeklyHours: number) {
  const occupiedRooms = forecast.reduce((sum, day) => sum + Number(day.roomsSold || 0) + Number(day.popupGroupRooms || 0), 0);
  const roomNights = forecast.length * 118;
  const weeklyOcc = roomNights > 0 ? (occupiedRooms / roomNights) * 100 : 0;
  const scale = BISTRO_LABOR_SCALE.find((item) => weeklyOcc >= item.minOcc && weeklyOcc <= item.maxOcc) || BISTRO_LABOR_SCALE[BISTRO_LABOR_SCALE.length - 1];
  return {
    weeklyOccupancyPercent: Number(weeklyOcc.toFixed(1)),
    occupiedRooms,
    scheduledHours: Number(bistroWeeklyHours.toFixed(2)),
    targetMinHours: scale.minHours,
    targetMaxHours: scale.maxHours,
    model: scale.label,
    status: bistroWeeklyHours < scale.minHours ? "under" : bistroWeeklyHours > scale.maxHours ? "over" : "on_target",
  };
}

function normalizePersonName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z,\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function payrollNameMatches(employee: any, payrollName: string) {
  const normalized = normalizePersonName(payrollName);
  const direct = normalizePersonName(`${employee.lastName}, ${employee.firstName}`);
  const display = normalizePersonName(employee.displayName || "");
  return normalized === direct || normalized === display || normalized.includes(direct) || direct.includes(normalized);
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

function parseWorkbookRows(buffer: Buffer) {
  const zip = new AdmZip(buffer);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false });
  const entry = (name: string) => zip.getEntry(name)?.getData().toString("utf8") || "";
  const workbook = parser.parse(entry("xl/workbook.xml"));
  const rels = parser.parse(entry("xl/_rels/workbook.xml.rels"));
  const sharedXml = entry("xl/sharedStrings.xml");
  const shared = sharedXml ? ([] as any[]).concat(parser.parse(sharedXml).sst?.si || []).map((si) => readInlineText(si) || String(si.t || "")) : [];
  const relMap = new Map(([] as any[]).concat(rels.Relationships?.Relationship || []).map((rel) => [rel["@_Id"], String(rel["@_Target"]).replace(/^\//, "")]));
  const sheet = ([] as any[]).concat(workbook.workbook?.sheets?.sheet || [])[0];
  const target = sheet ? relMap.get(sheet["@_r:id"]) : "worksheets/sheet1.xml";
  const worksheetPath = String(target || "worksheets/sheet1.xml").replace(/^xl\//, "");
  const xml = entry(`xl/${worksheetPath}`);
  if (!xml) return [];
  const parsed = parser.parse(xml);
  return ([] as any[]).concat(parsed.worksheet?.sheetData?.row || []).map((row) => {
    const cells: string[] = [];
    for (const cell of ([] as any[]).concat(row.c || [])) {
      const value = cell["@_t"] === "s" ? shared[Number(cell.v)] || "" : cell["@_t"] === "inlineStr" ? readInlineText(cell.is) : String(cell.v ?? "");
      cells[colIndex(cell["@_r"])] = value;
    }
    return cells;
  });
}

function excelDateToKey(value: string) {
  const serial = Number(value);
  if (Number.isFinite(serial) && serial > 20000) {
    const date = new Date(Date.UTC(1899, 11, 30));
    date.setUTCDate(date.getUTCDate() + Math.floor(serial));
    return toDateKey(date);
  }
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return toDateKey(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())));
  return "";
}

function parseHoursDetailWorkbook(buffer: Buffer) {
  const rows = parseWorkbookRows(buffer);
  const header = (rows[0] || []).map((cell) => String(cell || "").trim().toLowerCase());
  const index = (label: string) => header.findIndex((cell) => cell === label.toLowerCase());
  const idx = {
    employeeNumber: index("employee number"),
    lastName: index("employee last name"),
    firstName: index("employee first name"),
    date: index("date"),
    hours: index("hours"),
    department: index("department"),
    position: index("position"),
    notes: index("notes"),
  };
  if (idx.firstName < 0 || idx.lastName < 0 || idx.date < 0 || idx.hours < 0) return [];
  return rows.slice(1).map((row) => {
    const firstName = String(row[idx.firstName] || "").trim();
    const lastName = String(row[idx.lastName] || "").trim();
    const hours = Number(row[idx.hours] || 0);
    return {
      employeeNumber: String(row[idx.employeeNumber] || "").trim(),
      firstName,
      lastName,
      payrollName: `${lastName}, ${firstName}`.trim(),
      displayName: [firstName, lastName].filter(Boolean).join(" "),
      date: excelDateToKey(String(row[idx.date] || "")),
      hours: Number.isFinite(hours) ? hours : 0,
      department: String(row[idx.department] || "").trim(),
      position: String(row[idx.position] || "").trim(),
      notes: String(row[idx.notes] || "").trim(),
    };
  }).filter((row) => row.firstName && row.lastName && row.date && row.hours > 0);
}

function addHours(target: Record<string, number>, key: string, hours: number) {
  target[key] = Number(((target[key] || 0) + hours).toFixed(2));
}

async function upsertScheduleActualHours(scheduleId: string, employeeId: string, workDate: string, actualHours: number, notes: string | null, source: string, enteredByUserId?: string | null) {
  await db.insert(scheduleActualHours).values({
    scheduleId,
    employeeId,
    workDate,
    actualHours: actualHours.toFixed(2),
    notes,
    source,
    enteredByUserId: enteredByUserId || null,
  } as any).onConflictDoUpdate({
    target: [scheduleActualHours.scheduleId, scheduleActualHours.employeeId, scheduleActualHours.workDate],
    set: {
      actualHours: actualHours.toFixed(2),
      notes,
      source,
      enteredByUserId: enteredByUserId || null,
      updatedAt: new Date(),
    } as any,
  });
}

async function upsertHousekeepingBoardActualHours(scheduleId: string, employeeId: string, boardDate: string, actualHours: number, notes: string | null, enteredByUserId?: string | null) {
  await db.insert(scheduleHousekeepingBoards).values({
    scheduleId,
    employeeId,
    boardDate,
    actualHours: String(actualHours),
    notes,
    enteredByUserId: enteredByUserId || null,
  } as any).onConflictDoUpdate({
    target: [scheduleHousekeepingBoards.scheduleId, scheduleHousekeepingBoards.employeeId, scheduleHousekeepingBoards.boardDate],
    set: {
      actualHours: String(actualHours),
      notes,
      enteredByUserId: enteredByUserId || null,
      updatedAt: new Date(),
    } as any,
  });
}

function compareScheduledToActualHours(schedule: any, employees: any[], shiftTypes: any[], assignments: any[], actualRows: ReturnType<typeof parseHoursDetailWorkbook>) {
  const days = weekDays(schedule.weekStartDate);
  const daySet = new Set(days);
  const shiftTypeById = new Map(shiftTypes.map((shift) => [shift.id, shift]));
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const results = new Map<string, any>();
  const ensure = (key: string, defaults: any) => {
    if (!results.has(key)) results.set(key, { scheduledByDay: {}, actualByDay: {}, notes: [], ...defaults });
    return results.get(key);
  };

  for (const assignment of assignments) {
    if (assignment.isOpenShift || !assignment.employeeId || !daySet.has(assignment.shiftDate)) continue;
    const employee = employeeById.get(assignment.employeeId);
    if (!employee) continue;
    const shiftType = assignment.shiftTypeId ? shiftTypeById.get(assignment.shiftTypeId) : null;
    const hours = hoursForShift(assignment, shiftType);
    if (hours <= 0) continue;
    const row = ensure(employee.id, {
      employeeId: employee.id,
      employeeName: employee.displayName,
      department: employee.department,
      matched: true,
      scheduledHours: 0,
      actualHours: 0,
    });
    row.scheduledHours += hours;
    addHours(row.scheduledByDay, assignment.shiftDate, hours);
  }

  for (const actual of actualRows) {
    if (!daySet.has(actual.date)) continue;
    const employee = employees.find((item) => payrollNameMatches(item, actual.payrollName));
    const key = employee?.id || `actual:${normalizePersonName(actual.payrollName)}`;
    const row = ensure(key, {
      employeeId: employee?.id || null,
      employeeName: employee?.displayName || actual.displayName,
      department: employee?.department || [actual.department, actual.position].filter(Boolean).join(" / ") || "Unmatched",
      matched: Boolean(employee),
      scheduledHours: 0,
      actualHours: 0,
    });
    row.actualHours += actual.hours;
    addHours(row.actualByDay, actual.date, actual.hours);
    if (actual.notes) row.notes.push(`${actual.date}: ${actual.notes}`);
  }

  return Array.from(results.values()).map((row) => ({
    ...row,
    scheduledHours: Number(row.scheduledHours.toFixed(2)),
    actualHours: Number(row.actualHours.toFixed(2)),
    variance: Number((row.actualHours - row.scheduledHours).toFixed(2)),
    scheduledByDay: roundRecord(row.scheduledByDay),
    actualByDay: roundRecord(row.actualByDay),
    notes: Array.from(new Set(row.notes)).slice(0, 5),
  })).sort((a, b) => a.department.localeCompare(b.department) || a.employeeName.localeCompare(b.employeeName));
}

function parsePayrollRegisterText(text: string) {
  const blocks = text.split(/Emp #:/g).slice(1);
  const rows: Array<{ employeeNumber: string; payrollName: string; hourlyRate: number; grossWage: number | null }> = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const employeeNumber = lines[0] || "";
    const payrollName = lines[1] || "";
    const hourlyMatch = block.match(/Hourly Rate:\s*(?:[\s\S]{0,80}?)\n\s*([0-9]+\.[0-9]{2,4})/);
    const salaryMatch = block.match(/Per Pay Salary:\s*(?:[\s\S]{0,80}?)\n\s*([0-9,]+\.[0-9]{2})/);
    const grossMatch = block.match(/Gross Wage:\s*\n?\s*([0-9,]+\.[0-9]{2})/);
    const hourlyRate = hourlyMatch
      ? Number(hourlyMatch[1])
      : salaryMatch
        ? Number(String(salaryMatch[1]).replace(/,/g, "")) / 80
        : 0;
    if (!payrollName || !hourlyRate) continue;
    rows.push({
      employeeNumber,
      payrollName,
      hourlyRate: Number(hourlyRate.toFixed(2)),
      grossWage: grossMatch ? Number(String(grossMatch[1]).replace(/,/g, "")) : null,
    });
  }
  return rows;
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
  const time = start && end ? `${formatTimeCompact(start)} - ${formatTimeCompact(end)}` : shiftType.label;
  return [time, usefulShiftNote(assignment.roleNote, assignment.roleWorked, shiftType)].filter(Boolean).join("\n");
}

function usefulShiftNote(note: string | null | undefined, roleWorked: string | null | undefined, shiftType: any) {
  const value = String(note || "").trim();
  if (!value) return "";
  const normalized = value.toLowerCase();
  const role = String(roleWorked || "").trim().toLowerCase();
  const shiftLabel = String(shiftType?.label || "").trim().toLowerCase();
  const department = String(shiftType?.departmentHint || "").trim().toLowerCase();
  if (normalized === role || normalized === shiftLabel || normalized === department) return "";
  if (/^(gm|dos|dos \/ sales|sales|mod|manager|managers|front desk|fd am|fd pm|night audit|bistro|bistro am|bistro pm|breakfast|maintenance|housekeeping|room attendant|laundry|room inspector|houseperson)$/i.test(value)) return "";
  return value;
}

function formatTime12(value?: string | null) {
  if (!value) return "";
  const [hh, mm] = value.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return value;
  const period = hh >= 12 ? "PM" : "AM";
  const hour = hh % 12 || 12;
  return `${hour}:${String(mm).padStart(2, "0")} ${period}`;
}

function formatTimeCompact(value?: string | null) {
  if (!value) return "";
  const [hh, mm] = value.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return value;
  const period = hh >= 12 ? "PM" : "AM";
  const hour = hh % 12 || 12;
  return mm === 0 ? `${hour} ${period}` : `${hour}:${String(mm).padStart(2, "0")} ${period}`;
}

function frontDeskShiftPreference(employee: any) {
  const text = [employee?.displayName, employee?.position, employee?.department, ...rolesArray(employee?.rolesJson)].join(" ").toLowerCase();
  if (text.includes("fd pm") || text.includes("front desk pm") || text.includes(" pm")) return "FD PM";
  return "FD AM";
}

function weekRotationNumber(weekStart: string) {
  const parsed = parseDateKey(weekStart);
  return parsed ? Math.floor(parsed.getTime() / (DAY_MS * 7)) : 0;
}

function buildFrontDeskAiAssignments(payload: any, shiftByLabel: Map<string, any>, approvedByEmployeeDay: Set<string>, assignedByEmployeeDay: Set<string>, warnings: string[]) {
  const fdAm = shiftByLabel.get("FD AM") || shiftByLabel.get("AM");
  const fdPm = shiftByLabel.get("FD PM") || shiftByLabel.get("PM");
  if (!fdAm || !fdPm) {
    warnings.push("Front Desk AI needs FD AM and FD PM shift types before it can generate coverage.");
    return [];
  }
  const employees = payload.employees
    .filter((employee: any) => employee.active && employeeScheduleDepartments(employee).includes("Front Desk") && normalizeDepartment(employee.department) !== "Managers")
    .sort((a: any, b: any) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.displayName || "").localeCompare(String(b.displayName || "")));
  if (employees.length < 3) {
    warnings.push("Front Desk AI needs at least 3 available Front Desk associates to cover AM/PM while giving two back-to-back days off.");
  }

  const rotation = weekRotationNumber(payload.schedule.weekStartDate);
  const offByEmployee = new Map<string, Set<string>>();
  const weekendPair = payload.days.length >= 2 ? [payload.days[0], payload.days[1]] : [];
  const weekdayPairs = payload.days.slice(2, -1).map((day: string, index: number) => [day, payload.days[index + 3]]).filter((pair: string[]) => pair[0] && pair[1]);
  const maxWeekendOff = Math.max(0, employees.length - 2);
  employees.forEach((employee: any, index: number) => {
    const weekendGroup = (index % 2) === (rotation % 2);
    const canTakeWeekendOff = weekendPair.length === 2 && weekendGroup && Array.from(offByEmployee.values()).filter((days) => days.has(weekendPair[0]) || days.has(weekendPair[1])).length < maxWeekendOff;
    const pair = canTakeWeekendOff
      ? weekendPair
      : weekdayPairs[(rotation + index) % Math.max(weekdayPairs.length, 1)] || [];
    offByEmployee.set(employee.id, new Set(pair));
  });

  const assignments: any[] = [];
  const workedCount = new Map<string, number>();
  const labelByEmployeeDay = new Map<string, string>();
  const hasTurnaround = (employeeId: string, dayIndex: number, shiftLabel: string) => {
    if (shiftLabel !== "FD AM" || dayIndex <= 0) return false;
    return labelByEmployeeDay.get(`${employeeId}:${payload.days[dayIndex - 1]}`) === "FD PM";
  };
  const addCoverage = (day: string, dayIndex: number, shiftLabel: "FD AM" | "FD PM", shift: any) => {
    const candidates = employees
      .filter((employee: any) => {
        const employeeDayKey = `${employee.id}:${day}`;
        return !approvedByEmployeeDay.has(employeeDayKey)
          && !assignedByEmployeeDay.has(employeeDayKey)
          && !offByEmployee.get(employee.id)?.has(day)
          && !hasTurnaround(employee.id, dayIndex, shiftLabel);
      })
      .sort((a: any, b: any) => {
        const aPref = frontDeskShiftPreference(a) === shiftLabel ? 0 : 1;
        const bPref = frontDeskShiftPreference(b) === shiftLabel ? 0 : 1;
        return aPref - bPref || (workedCount.get(a.id) || 0) - (workedCount.get(b.id) || 0) || String(a.displayName || "").localeCompare(String(b.displayName || ""));
      });
    const employee = candidates[0];
    if (!employee) {
      warnings.push(`Front Desk AI could not cover ${shiftLabel} on ${day} without using an approved request, scheduled day off, duplicate day, or PM-to-AM turnaround.`);
      return;
    }
    assignedByEmployeeDay.add(`${employee.id}:${day}`);
    workedCount.set(employee.id, (workedCount.get(employee.id) || 0) + 1);
    labelByEmployeeDay.set(`${employee.id}:${day}`, shiftLabel);
    assignments.push({
      employeeId: employee.id,
      shiftDate: day,
      shiftTypeId: shift.id,
      customStartTime: null,
      customEndTime: null,
      unpaidBreakMinutes: shift.unpaidBreakMinutes ?? 0,
      roleWorked: shiftLabel,
      roleNote: null,
      managerNote: "AI draft - Front Desk rotation",
      isOpenShift: false,
    });
  };

  payload.days.forEach((day: string, dayIndex: number) => {
    addCoverage(day, dayIndex, "FD AM", fdAm);
    addCoverage(day, dayIndex, "FD PM", fdPm);
  });
  const proposedHours = assignments.reduce((sum, assignment) => {
    const shift = assignment.shiftTypeId === fdAm.id ? fdAm : assignment.shiftTypeId === fdPm.id ? fdPm : null;
    return sum + hoursForShift(assignment, shift);
  }, 0);
  if (proposedHours > 112) warnings.push(`Front Desk AI proposed ${proposedHours.toFixed(1)} hours. Budget is 112 hours: 8 AM + 8 PM daily. Review before applying.`);

  for (const employee of employees) {
    const daysOff = offByEmployee.get(employee.id) || new Set();
    const approvedDays = payload.days.filter((day: string) => approvedByEmployeeDay.has(`${employee.id}:${day}`));
    if (approvedDays.length) continue;
    if (daysOff.size < 2) warnings.push(`${employee.displayName} does not have two back-to-back days off in this AI draft.`);
  }
  if (weekendPair.length === 2 && employees.length >= 4) {
    warnings.push("Front Desk AI alternates Saturday/Sunday weekend-off groups by week while preserving AM/PM coverage.");
  }
  return assignments;
}

function buildAiScheduleDraft(payload: any, scopeDepartment?: string | string[]) {
  const shiftByLabel = new Map<string, any>(payload.shiftTypes.map((shift: any) => [String(shift.label).toUpperCase(), shift]));
  const employeesByDepartment = new Map<string, any[]>();
  for (const department of DEPARTMENTS) {
    employeesByDepartment.set(department, payload.employees.filter((employee: any) => employee.active && employeeScheduleDepartments(employee).includes(department)));
  }
  const approvedByEmployeeDay = new Set<string>((payload.approvedRequests || []).map((request: any) => `${request.employeeId}:${request.requestDate}`));
  const assignedByEmployeeDay = new Set<string>();
  const assignments: any[] = [];
  const warnings: string[] = [];
  const counters: Record<string, number> = {};
  const proposedBistroHours = () => assignments.reduce((sum, assignment) => {
    const shift = payload.shiftTypes.find((item: any) => item.id === assignment.shiftTypeId);
    if (normalizeDepartment(shift?.departmentHint) !== "Bistro") return sum;
    return sum + hoursForShift(assignment, shift);
  }, 0);

  const add = (department: string, shiftLabel: string, shiftDate: string, roleNote?: string) => {
    const shift = shiftByLabel.get(shiftLabel);
    if (!shift) {
      warnings.push(`Missing shift type ${shiftLabel}.`);
      return;
    }
    const employees = employeesByDepartment.get(department) || [];
    const key = `${department}:${shiftDate}`;
    for (let attempt = 0; attempt < employees.length; attempt += 1) {
      const index = ((counters[key] || 0) + attempt) % employees.length;
      const employee = employees[index];
      const employeeDayKey = `${employee.id}:${shiftDate}`;
      if (!approvedByEmployeeDay.has(employeeDayKey) && !assignedByEmployeeDay.has(employeeDayKey)) {
        counters[key] = index + 1;
        assignedByEmployeeDay.add(employeeDayKey);
        assignments.push({
          employeeId: employee.id,
          shiftDate,
          shiftTypeId: shift.id,
          customStartTime: null,
          customEndTime: null,
          unpaidBreakMinutes: shift.unpaidBreakMinutes ?? 0,
          roleNote: roleNote || null,
          managerNote: "AI draft",
          isOpenShift: false,
        });
        return;
      }
    }
    warnings.push(`No available ${department} associate for ${shiftLabel} on ${shiftDate}.`);
  };

  const forecastByDay = new Map<string, any>(payload.forecast.map((day: any) => [day.forecastDate, day]));
  const allowed = Array.isArray(scopeDepartment)
    ? new Set(scopeDepartment.map((department) => normalizeDepartment(department)))
    : scopeDepartment
      ? new Set([normalizeDepartment(scopeDepartment)])
      : null;
  const frontDeskAiAssignments = (!allowed || allowed.has("Front Desk"))
    ? buildFrontDeskAiAssignments(payload, shiftByLabel, approvedByEmployeeDay, assignedByEmployeeDay, warnings)
    : [];
  assignments.push(...frontDeskAiAssignments);
  if (allowed && allowed.has("Front Desk") && allowed.size === 1) return { assignments, warnings };
  for (const day of payload.days) {
    const forecast: any = forecastByDay.get(day) || {};
    const rooms = Number(forecast.roomsSold || 0);
    const occ = Number(forecast.occupancyPercent || 0);
    const arrivals = Number(forecast.arrivals || 0);
    const departures = Number(forecast.departures || 0);
    const stayovers = Number(forecast.stayovers || Math.max(0, rooms - arrivals));
    const roomCredits = Math.max(0, departures + stayovers * 0.5);
    const hkAttendants = Math.max(1, Math.ceil(((roomCredits * 28) / 60) / 8));

    if (!allowed && !frontDeskAiAssignments.length) {
      add("Front Desk", "FD AM", day, "Desk");
      add("Front Desk", "FD PM", day, "Desk");
      if (occ >= 65 || arrivals + departures >= 55) add("Front Desk", "MID", day, "Volume support");
    }
    if (!allowed) add("Night Audit", "Night Audit", day, "Audit");
    if (!allowed) add("Managers", "MOD", day, "MOD");
    if (!allowed) {
      add("Bistro", "BREAKFAST", day, "Breakfast");
      if (occ >= 65 || arrivals >= 20) add("Bistro", "BISTRO PM", day, "Evening demand");
    }
    if (!allowed || allowed.has("Housekeeping")) {
      for (let index = 0; index < hkAttendants; index += 1) add("Housekeeping", "HOUSEKEEPING", day, "Room Attendant");
      if (departures >= 45) add("Housekeeping", "LAUNDRY", day, "Laundry");
    }
    if (!allowed) {
      if (![0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay()) || occ >= 75) add("Maintenance", "MAINTENANCE", day, "Property coverage");
    }
  }

  const bistroTarget = !allowed ? payload.totals.bistroLabor : null;
  if (bistroTarget) {
    let pass = 0;
    while (proposedBistroHours() < bistroTarget.targetMinHours && pass < payload.days.length * 2) {
      const day = payload.days[pass % payload.days.length];
      const label = pass % 2 === 0 ? "BISTRO AM" : "BISTRO PM";
      add("Bistro", label, day, "Bistro labor scale support");
      pass += 1;
    }
    if (proposedBistroHours() < bistroTarget.targetMinHours) {
      warnings.push(`Bistro draft remains below sliding-scale target ${bistroTarget.targetMinHours}-${bistroTarget.targetMaxHours} hours.`);
    }
  }

  return { assignments, warnings };
}

async function summarizeAiSchedule(payload: any, draft: any) {
  const baseline = {
    week: `${payload.schedule.weekStartDate} to ${payload.schedule.weekEndDate}`,
    forecast: payload.forecast.map((day: any) => ({
      date: day.forecastDate,
      roomsSold: day.roomsSold,
      occupancyPercent: day.occupancyPercent,
      arrivals: day.arrivals,
      departures: day.departures,
      stayovers: day.stayovers,
    })),
    laborTargets: payload.totals.laborMetrics?.targets,
    currentLabor: payload.totals.laborMetrics?.weekly,
    proposedShiftCount: draft.assignments.length,
    warnings: draft.warnings,
  };

  if (!openai) {
    return {
      aiAvailable: false,
      summary: "AI is not configured. A rules-based draft was generated from forecast demand, approved requests, HPOR, and housekeeping MPOR targets.",
      recommendations: [
        "Review Front Desk AM/PM/Audit coverage each day.",
        "Review Housekeeping room-attendant coverage against 25-30 MPOR.",
        "Check HPOR after applying the draft and adjust departments as needed.",
      ],
      risks: draft.warnings,
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.SCHEDULE_AI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a hotel operations scheduling assistant. Return concise JSON with summary, recommendations array, and risks array. Do not invent employee names or change the provided draft.",
        },
        {
          role: "user",
          content: JSON.stringify({
            goal: `Review this weekly hotel schedule draft for HPOR target ${TARGET_HPOR} and Housekeeping MPOR target 25-30.`,
            baseline,
          }),
        },
      ],
      temperature: 0.2,
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return {
      aiAvailable: true,
      summary: String(parsed.summary || "AI reviewed the rules-based draft."),
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String).slice(0, 8) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String).slice(0, 8) : draft.warnings,
    };
  } catch (error: any) {
    console.error("Schedule AI generation failed:", { error: error?.message || error });
    return {
      aiAvailable: false,
      summary: "AI review failed, but a rules-based draft was generated.",
      recommendations: ["Review and apply the draft manually if coverage looks appropriate."],
      risks: draft.warnings,
    };
  }
}

function pdfColor(hex: string, fallback = rgb(1, 1, 1)) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!match) return fallback;
  return rgb(parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255);
}

function wrapPdfText(text: string, maxChars: number, maxLines = 2): string[] {
  if (String(text || "").includes("\n")) {
    return String(text || "")
      .split("\n")
      .flatMap((line: string) => wrapPdfText(line, maxChars, 1))
      .slice(0, maxLines);
  }
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.length ? lines : [""];
}

async function renderSchedulePdf(payload: any) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [792, 612];
  const margin = 26;
  const tableWidth = pageSize[0] - margin * 2;
  const employeeW = 140;
  const hoursW = 38;
  const dayW = (tableWidth - employeeW - hoursW) / 7;
  const ink = rgb(0.12, 0.09, 0.07);
  const muted = rgb(0.38, 0.32, 0.27);
  const border = rgb(0.84, 0.78, 0.69);
  const tan = rgb(0.96, 0.92, 0.86);
  const dark = rgb(0.16, 0.12, 0.10);
  const white = rgb(1, 1, 1);
  let page = pdf.addPage(pageSize);
  let y = 570;

  const drawText = (text: string, x: number, yPos: number, size = 8, isBold = false, color = ink) => {
    page.drawText(String(text || "").slice(0, 160), { x, y: yPos, size, font: isBold ? bold : font, color });
  };
  const drawBox = (x: number, yTop: number, w: number, h: number, fill = white, stroke = border) => {
    page.drawRectangle({ x, y: yTop - h, width: w, height: h, color: fill, borderColor: stroke, borderWidth: 0.7 });
  };
  const newPage = () => {
    page = pdf.addPage(pageSize);
    y = 570;
    drawHeader(false);
  };
  const ensureSpace = (height: number) => {
    if (y - height < 34) newPage();
  };
  const drawHeader = (full = true) => {
    page.drawRectangle({ x: 0, y: 548, width: pageSize[0], height: 64, color: dark });
    drawText(`${payload.schedule.propertyName || PROPERTY_NAME} Schedule`, margin, 584, 18, true, white);
    drawText(`${payload.schedule.weekStartDate} to ${payload.schedule.weekEndDate}  |  ${String(payload.schedule.status || "").toUpperCase()}`, margin, 564, 9, false, rgb(0.90, 0.84, 0.75));
    if (payload.schedule.publishedAt) drawText(`Published ${new Date(payload.schedule.publishedAt).toLocaleString()}`, 570, 564, 8, false, rgb(0.90, 0.84, 0.75));
    if (full && payload.totals.totalWeeklyLaborDollarsIncludingSalary) {
      drawText(`Hourly hrs ${payload.totals.totalWeeklyLaborHours || "0.00"} | Salaried hrs ${payload.totals.totalWeeklySalariedLaborHours || "0.00"}`, 520, 586, 8, false, white);
      drawText(`Labor with salary $${payload.totals.totalWeeklyLaborDollarsIncludingSalary || "0.00"}`, 520, 574, 8, false, white);
      drawText(`Labor % room rev ${payload.totals.totalWeeklyLaborPercentOfRoomRevenueIncludingSalary || "0.0"}%`, 520, 562, 8, false, white);
    }
    y = 530;
  };
  drawHeader();

  ensureSpace(86);
  drawText("Forecast", margin, y, 12, true);
  y -= 12;
  const metricW = 82;
  const forecastDayW = (tableWidth - metricW) / 7;
  drawBox(margin, y, metricW, 20, tan);
  drawText("Metric", margin + 6, y - 13, 7, true);
  payload.days.forEach((day: string, index: number) => {
    drawBox(margin + metricW + index * forecastDayW, y, forecastDayW, 20, tan);
    drawText(`${SCHEDULE_DAY_LABELS[index] || ""} ${day.slice(5)}`, margin + metricW + index * forecastDayW + 6, y - 13, 7, true);
  });
  y -= 20;
  for (const [key, label] of [["roomsSold", "Rooms"], ["occupancyPercent", "Occ %"], ["arrivals", "Arr"], ["departures", "Dep"], ["stayovers", "Stay"]]) {
    drawBox(margin, y, metricW, 18, white);
    drawText(label, margin + 6, y - 12, 7, true);
    payload.days.forEach((day: string, index: number) => {
      const value = payload.forecast.find((item: any) => item.forecastDate === day)?.[key] ?? "-";
      drawBox(margin + metricW + index * forecastDayW, y, forecastDayW, 18, white);
      drawText(String(value), margin + metricW + index * forecastDayW + 6, y - 12, 7);
    });
    y -= 18;
  }
  y -= 14;

  const assignmentsByEmployeeDay = new Map(payload.assignments.map((assignment: any) => [`${assignment.employeeId}:${assignment.shiftDate}`, assignment]));
  const shiftTypeById = new Map<any, any>(payload.shiftTypes.map((shift: any) => [shift.id, shift]));
  const shiftTypeByLabel = new Map<string, any>(payload.shiftTypes.map((shift: any) => [String(shift.label || "").toUpperCase(), shift]));
  for (const department of payload.departments) {
    const employees = payload.employees.filter((employee: any) => employee.active && employeeScheduleDepartments(employee).includes(department));
    if (!employees.length) continue;
    const rowH = 34;
    ensureSpace(48 + employees.length * rowH);
    drawBox(margin, y, tableWidth, 22, dark, dark);
    drawText(`${department} - ${payload.totals.departmentWeeklyHours[department] || 0} hrs`, margin + 8, y - 14, 9, true, white);
    y -= 22;
    drawBox(margin, y, employeeW, 20, tan);
    drawText("Associate", margin + 6, y - 13, 7, true);
    payload.days.forEach((day: string, index: number) => {
      drawBox(margin + employeeW + index * dayW, y, dayW, 20, tan);
      drawText(`${SCHEDULE_DAY_LABELS[index] || ""} ${day.slice(5)}`, margin + employeeW + index * dayW + 6, y - 13, 7, true);
    });
    drawBox(margin + employeeW + 7 * dayW, y, hoursW, 20, tan);
    drawText("Hrs", margin + employeeW + 7 * dayW + 8, y - 13, 7, true);
    y -= 20;

    for (const employee of employees) {
      ensureSpace(rowH + 8);
      drawBox(margin, y, employeeW, rowH, white);
      const nameLines = wrapPdfText(employee.displayName, 25, 1);
      drawText(nameLines[0], margin + 6, y - 13, 7, true);
      drawText(String(employee.position || normalizeDepartment(employee.department) || "").slice(0, 28), margin + 6, y - 25, 6, false, muted);
      payload.days.forEach((day: string, index: number) => {
        const assignment: any = assignmentsByEmployeeDay.get(`${employee.id}:${day}`);
        const shiftType: any = resolveShiftTypeForAssignment(assignment, shiftTypeById, shiftTypeByLabel);
        const sectionAssignment = assignmentBelongsToDepartment(assignment, employee, shiftType, department) ? assignment : null;
        const sectionShiftType = sectionAssignment ? shiftType : null;
        const text = scheduleCellText(sectionAssignment, sectionShiftType) || "";
        const fill = sectionShiftType?.color ? pdfColor(sectionShiftType.color, white) : white;
        const textColor = sectionShiftType?.textColor ? pdfColor(sectionShiftType.textColor, ink) : ink;
        const x = margin + employeeW + index * dayW;
        drawBox(x, y, dayW, rowH, fill);
        wrapPdfText(text || "-", 16, 2).forEach((line: string, lineIndex: number) => drawText(line, x + 4, y - 11 - lineIndex * 9, 6, Boolean(text), textColor));
      });
      drawBox(margin + employeeW + 7 * dayW, y, hoursW, rowH, white);
      drawText(String(payload.totals.employeeDepartmentWeeklyHours?.[employee.id]?.[department] || 0), margin + employeeW + 7 * dayW + 10, y - 19, 8, true);
      y -= rowH;
    }
    y -= 12;
  }

  ensureSpace(44);
  drawBox(margin, y, tableWidth, 30, tan);
  drawText(`Hourly scheduled hours: ${payload.totals.totalWeeklyLaborHours || "0.00"}`, margin + 8, y - 12, 8, true);
  drawText(`Salaried manager hours shown: ${payload.totals.totalWeeklySalariedLaborHours || "0.00"} | All displayed hours: ${payload.totals.totalWeeklyLaborHoursIncludingSalary || "0.00"}`, margin + 8, y - 24, 7, false, muted);
  return Buffer.from(await pdf.save());
}

function renderScheduleExcelHtml(payload: any) {
  const shiftTypeById = new Map<any, any>(payload.shiftTypes.map((shift: any) => [shift.id, shift]));
  const shiftTypeByLabel = new Map<string, any>(payload.shiftTypes.map((shift: any) => [String(shift.label || "").toUpperCase(), shift]));
  const assignmentsByEmployeeDay = new Map(payload.assignments.map((assignment: any) => [`${assignment.employeeId}:${assignment.shiftDate}`, assignment]));
  const rows: string[] = [];
  rows.push(`<h1>${payload.schedule.propertyName} Schedule</h1><p>${payload.schedule.weekStartDate} to ${payload.schedule.weekEndDate}</p>`);
  rows.push("<table border='1'><tr><th>Forecast</th>" + payload.days.map((day: string) => `<th>${day}</th>`).join("") + "</tr>");
  for (const metric of ["roomsSold", "occupancyPercent", "arrivals", "departures", "stayovers"]) {
    rows.push(`<tr><td>${metric}</td>${payload.days.map((day: string) => `<td>${payload.forecast.find((f: any) => f.forecastDate === day)?.[metric] || 0}</td>`).join("")}</tr>`);
  }
  rows.push("</table><br/><table border='1'><tr><th>Department</th><th>Employee</th>" + payload.days.map((day: string) => `<th>${day}</th>`).join("") + "<th>Total</th></tr>");
  for (const department of payload.departments) {
    for (const employee of payload.employees.filter((item: any) => item.active && employeeScheduleDepartments(item).includes(department))) {
      rows.push(`<tr><td>${department}</td><td>${employee.displayName}</td>${payload.days.map((day: string) => {
        const assignment: any = assignmentsByEmployeeDay.get(`${employee.id}:${day}`);
        const shiftType: any = resolveShiftTypeForAssignment(assignment, shiftTypeById, shiftTypeByLabel);
        const sectionAssignment = assignmentBelongsToDepartment(assignment, employee, shiftType, department) ? assignment : null;
        const sectionShiftType = sectionAssignment ? shiftType : null;
        const style = sectionShiftType ? ` style="background:${sectionShiftType.color};color:${sectionShiftType.textColor}"` : "";
        return `<td${style}>${scheduleCellText(sectionAssignment, sectionShiftType)}</td>`;
      }).join("")}<td>${payload.totals.employeeDepartmentWeeklyHours?.[employee.id]?.[department] || 0}</td></tr>`);
    }
  }
  rows.push("</table>");
  rows.push("<br/><table border='1'>");
  rows.push(`<tr><th>Hourly scheduled hours</th><td>${payload.totals.totalWeeklyLaborHours}</td></tr>`);
  rows.push(`<tr><th>Salaried manager hours shown</th><td>${payload.totals.totalWeeklySalariedLaborHours || "0.00"}</td></tr>`);
  rows.push(`<tr><th>All displayed hours</th><td>${payload.totals.totalWeeklyLaborHoursIncludingSalary || "0.00"}</td></tr>`);
  if (payload.totals.totalWeeklyLaborDollarsIncludingSalary != null) {
    rows.push(`<tr><th>Hourly labor dollars</th><td>${payload.totals.totalWeeklyLaborDollars || "0.00"}</td></tr>`);
    rows.push(`<tr><th>Salaried manager labor dollars</th><td>${payload.totals.totalWeeklySalariedLaborDollars || "0.00"}</td></tr>`);
    rows.push(`<tr><th>Total labor dollars with salaried</th><td>${payload.totals.totalWeeklyLaborDollarsIncludingSalary || "0.00"}</td></tr>`);
    rows.push(`<tr><th>Labor % of room revenue</th><td>${payload.totals.totalWeeklyLaborPercentOfRoomRevenueIncludingSalary || "0.0"}%</td></tr>`);
  }
  rows.push("</table>");
  return rows.join("\n");
}

function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function numeric(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function renderLaborPerformanceReportHtml(payload: any) {
  const shiftTypeById = new Map<any, any>(payload.shiftTypes.map((shift: any) => [shift.id, shift]));
  const shiftTypeByLabel = new Map<string, any>(payload.shiftTypes.map((shift: any) => [String(shift.label || "").toUpperCase(), shift]));
  const employeeById = new Map<string, any>(payload.employees.map((employee: any) => [employee.id, employee]));
  const scheduledByEmployee = new Map<string, { employee: any; department: string; hours: number }>();
  const scheduledByEmployeeDay = new Map<string, number>();
  for (const assignment of payload.assignments || []) {
    const employee: any = employeeById.get(assignment.employeeId);
    if (!employee) continue;
    const shiftType = resolveShiftTypeForAssignment(assignment, shiftTypeById, shiftTypeByLabel);
    const department = assignmentRenderDepartment(assignment, employee, shiftType);
    const hours = hoursForShift(assignment, shiftType);
    if (isSalariedScheduleManager(employee)) continue;
    const existing = scheduledByEmployee.get(employee.id) || { employee, department, hours: 0 };
    existing.department = existing.department || department;
    existing.hours += hours;
    scheduledByEmployee.set(employee.id, existing);
    scheduledByEmployeeDay.set(`${employee.id}:${assignment.shiftDate}`, (scheduledByEmployeeDay.get(`${employee.id}:${assignment.shiftDate}`) || 0) + hours);
  }

  const actualByEmployee = new Map<string, { employee: any; hours: number; byDay: Record<string, number> }>();
  for (const row of payload.actualHours || []) {
    const employee: any = employeeById.get(row.employeeId);
    if (!employee) continue;
    const existing = actualByEmployee.get(employee.id) || { employee, hours: 0, byDay: {} };
    const hours = numeric(row.actualHours);
    existing.hours += hours;
    existing.byDay[row.workDate] = (existing.byDay[row.workDate] || 0) + hours;
    actualByEmployee.set(employee.id, existing);
  }

  const hkMporByEmployee = new Map<string, { employee: any; actualHours: number; roomCredits: number; standardMinutes: number }>();
  for (const board of payload.housekeepingBoards || []) {
    const employee: any = employeeById.get(board.employeeId);
    if (!employee) continue;
    const serviceStayovers = Math.max(0, numeric(board.stayoverRooms) - numeric(board.dndRooms));
    const roomCredits = Math.max(0, numeric(board.checkoutRooms) + serviceStayovers * 0.5 + numeric(board.deepCleanRooms));
    const standardMinutes = Math.max(0, numeric(board.checkoutRooms) * 30 + serviceStayovers * 15 + numeric(board.deepCleanRooms) * 30);
    const existing = hkMporByEmployee.get(employee.id) || { employee, actualHours: 0, roomCredits: 0, standardMinutes: 0 };
    existing.actualHours += numeric(board.actualHours);
    existing.roomCredits += roomCredits;
    existing.standardMinutes += standardMinutes;
    hkMporByEmployee.set(employee.id, existing);
  }

  const allEmployeeIds = Array.from(new Set([...Array.from(scheduledByEmployee.keys()), ...Array.from(actualByEmployee.keys())]));
  const actualRooms = payload.forecast.reduce((sum: number, day: any) => sum + numeric(day.actualRoomsSold ?? day.roomsSold), 0);
  const forecastRooms = payload.forecast.reduce((sum: number, day: any) => sum + numeric(day.roomsSold), 0);
  const actualRoomRevenue = payload.forecast.reduce((sum: number, day: any) => sum + numeric(day.actualRoomRevenue ?? day.roomRevenue), 0);
  const forecastRoomRevenue = payload.forecast.reduce((sum: number, day: any) => sum + numeric(day.roomRevenue), 0);
  const scheduledHours = numeric(payload.totals.totalWeeklyLaborHours);
  const actualHours = Array.from(actualByEmployee.values()).reduce((sum, row) => sum + row.hours, 0);
  const rows: string[] = [];
  rows.push(`<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#201814}
    h1,h2{margin:8px 0}
    table{border-collapse:collapse;width:100%;margin:12px 0}
    th{background:#2a211c;color:#fff;text-align:left}
    th,td{border:1px solid #d8c8b2;padding:6px;font-size:12px}
    .good{color:#166534;font-weight:bold}.warn{color:#92400e;font-weight:bold}.bad{color:#991b1b;font-weight:bold}
  </style></head><body>`);
  rows.push(`<h1>${htmlEscape(payload.schedule.propertyName || PROPERTY_NAME)} Labor Performance Report</h1>`);
  rows.push(`<p>${htmlEscape(payload.schedule.weekStartDate)} to ${htmlEscape(payload.schedule.weekEndDate)}</p>`);
  rows.push("<h2>Production and HPOR</h2><table>");
  rows.push("<tr><th>Metric</th><th>Scheduled / Forecast</th><th>Actual / Final</th><th>Variance</th></tr>");
  rows.push(`<tr><td>Rooms sold</td><td>${forecastRooms}</td><td>${actualRooms}</td><td>${actualRooms - forecastRooms}</td></tr>`);
  rows.push(`<tr><td>Room revenue</td><td>$${forecastRoomRevenue.toFixed(2)}</td><td>$${actualRoomRevenue.toFixed(2)}</td><td>$${(actualRoomRevenue - forecastRoomRevenue).toFixed(2)}</td></tr>`);
  rows.push(`<tr><td>Labor hours</td><td>${scheduledHours.toFixed(2)}</td><td>${actualHours.toFixed(2)}</td><td>${(actualHours - scheduledHours).toFixed(2)}</td></tr>`);
  rows.push(`<tr><td>HPOR</td><td>${(forecastRooms > 0 ? scheduledHours / forecastRooms : 0).toFixed(2)}</td><td>${(actualRooms > 0 ? actualHours / actualRooms : 0).toFixed(2)}</td><td>Target ${TARGET_HPOR.toFixed(2)}</td></tr>`);
  rows.push("</table>");

  rows.push("<h2>Scheduled vs Actual Hours by Associate</h2><table><tr><th>Associate</th><th>Department</th><th>Scheduled</th><th>Actual</th><th>Variance</th>");
  for (const day of payload.days) rows.push(`<th>${htmlEscape(day)}</th>`);
  rows.push("</tr>");
  for (const employeeId of allEmployeeIds.sort((a, b) => String(employeeById.get(a)?.displayName || "").localeCompare(String(employeeById.get(b)?.displayName || "")))) {
    const scheduled = scheduledByEmployee.get(employeeId);
    const actual = actualByEmployee.get(employeeId);
    const employee: any = scheduled?.employee || actual?.employee;
    const variance = numeric(actual?.hours) - numeric(scheduled?.hours);
    rows.push(`<tr><td>${htmlEscape(employee?.displayName)}</td><td>${htmlEscape(scheduled?.department || normalizeDepartment(employee?.department))}</td><td>${numeric(scheduled?.hours).toFixed(2)}</td><td>${numeric(actual?.hours).toFixed(2)}</td><td>${variance.toFixed(2)}</td>`);
    for (const day of payload.days) {
      const scheduledDay = scheduledByEmployeeDay.get(`${employeeId}:${day}`) || 0;
      const actualDay = actual?.byDay?.[day] || 0;
      rows.push(`<td>S ${scheduledDay.toFixed(2)} / A ${actualDay.toFixed(2)}</td>`);
    }
    rows.push("</tr>");
  }
  rows.push("</table>");

  rows.push("<h2>Housekeeping MPOR by Room Attendant</h2><table><tr><th>Associate</th><th>Actual Hours</th><th>Room Credits</th><th>Standard Minutes</th><th>MPOR</th><th>Target</th></tr>");
  for (const row of Array.from(hkMporByEmployee.values()).sort((a, b) => String(a.employee.displayName || "").localeCompare(String(b.employee.displayName || "")))) {
    const mpor = row.roomCredits > 0 ? (row.actualHours * 60) / row.roomCredits : 0;
    const tone = mpor >= TARGET_HK_MPOR_MIN && mpor <= TARGET_HK_MPOR_MAX ? "good" : "warn";
    rows.push(`<tr><td>${htmlEscape(row.employee.displayName)}</td><td>${row.actualHours.toFixed(2)}</td><td>${row.roomCredits.toFixed(1)}</td><td>${row.standardMinutes.toFixed(0)}</td><td class="${tone}">${mpor.toFixed(1)}</td><td>${TARGET_HK_MPOR_MIN}-${TARGET_HK_MPOR_MAX}</td></tr>`);
  }
  rows.push("</table></body></html>");
  return rows.join("");
}

async function renderLaborPerformanceReportPdf(payload: any) {
  const shiftTypeById = new Map<any, any>(payload.shiftTypes.map((shift: any) => [shift.id, shift]));
  const shiftTypeByLabel = new Map<string, any>(payload.shiftTypes.map((shift: any) => [String(shift.label || "").toUpperCase(), shift]));
  const employeeById = new Map<string, any>(payload.employees.map((employee: any) => [employee.id, employee]));
  const scheduledByEmployee = new Map<string, { employee: any; department: string; hours: number }>();
  const scheduledByEmployeeDay = new Map<string, number>();
  for (const assignment of payload.assignments || []) {
    const employee: any = employeeById.get(assignment.employeeId);
    if (!employee || isSalariedScheduleManager(employee)) continue;
    const shiftType = resolveShiftTypeForAssignment(assignment, shiftTypeById, shiftTypeByLabel);
    const department = assignmentRenderDepartment(assignment, employee, shiftType);
    const hours = hoursForShift(assignment, shiftType);
    const existing = scheduledByEmployee.get(employee.id) || { employee, department, hours: 0 };
    existing.department = existing.department || department;
    existing.hours += hours;
    scheduledByEmployee.set(employee.id, existing);
    scheduledByEmployeeDay.set(`${employee.id}:${assignment.shiftDate}`, (scheduledByEmployeeDay.get(`${employee.id}:${assignment.shiftDate}`) || 0) + hours);
  }

  const actualByEmployee = new Map<string, { employee: any; hours: number; byDay: Record<string, number> }>();
  for (const row of payload.actualHours || []) {
    const employee: any = employeeById.get(row.employeeId);
    if (!employee) continue;
    const existing = actualByEmployee.get(employee.id) || { employee, hours: 0, byDay: {} };
    const hours = numeric(row.actualHours);
    existing.hours += hours;
    existing.byDay[row.workDate] = (existing.byDay[row.workDate] || 0) + hours;
    actualByEmployee.set(employee.id, existing);
  }

  const hkRows: any[] = Array.from((payload.housekeepingBoards || []).reduce((map: Map<string, any>, board: any) => {
    const employee = employeeById.get(board.employeeId);
    if (!employee) return map;
    const serviceStayovers = Math.max(0, numeric(board.stayoverRooms) - numeric(board.dndRooms));
    const roomCredits = Math.max(0, numeric(board.checkoutRooms) + serviceStayovers * 0.5 + numeric(board.deepCleanRooms));
    const standardMinutes = Math.max(0, numeric(board.checkoutRooms) * 30 + serviceStayovers * 15 + numeric(board.deepCleanRooms) * 30);
    const row = map.get(employee.id) || { employee, actualHours: 0, roomCredits: 0, standardMinutes: 0 };
    row.actualHours += numeric(board.actualHours);
    row.roomCredits += roomCredits;
    row.standardMinutes += standardMinutes;
    map.set(employee.id, row);
    return map;
  }, new Map<string, any>()).values() as Iterable<any>).sort((a: any, b: any) => String(a.employee.displayName || "").localeCompare(String(b.employee.displayName || "")));

  const actualRooms = payload.forecast.reduce((sum: number, day: any) => sum + numeric(day.actualRoomsSold ?? day.roomsSold), 0);
  const forecastRooms = payload.forecast.reduce((sum: number, day: any) => sum + numeric(day.roomsSold), 0);
  const actualRoomRevenue = payload.forecast.reduce((sum: number, day: any) => sum + numeric(day.actualRoomRevenue ?? day.roomRevenue), 0);
  const forecastRoomRevenue = payload.forecast.reduce((sum: number, day: any) => sum + numeric(day.roomRevenue), 0);
  const scheduledHours = numeric(payload.totals.totalWeeklyLaborHours);
  const actualHours = Array.from(actualByEmployee.values()).reduce((sum, row) => sum + row.hours, 0);
  const scheduledHpor = forecastRooms > 0 ? scheduledHours / forecastRooms : 0;
  const actualHpor = actualRooms > 0 ? actualHours / actualRooms : 0;
  const scheduledByDepartment = new Map<string, number>();
  for (const row of Array.from(scheduledByEmployee.values())) {
    scheduledByDepartment.set(row.department, (scheduledByDepartment.get(row.department) || 0) + row.hours);
  }
  const actualByDepartment = new Map<string, number>();
  for (const [employeeId, row] of Array.from(actualByEmployee.entries())) {
    const department = scheduledByEmployee.get(employeeId)?.department || normalizeDepartment(row.employee?.department);
    actualByDepartment.set(department, (actualByDepartment.get(department) || 0) + row.hours);
  }
  const departmentRows = DEPARTMENTS
    .filter((department) => numeric(scheduledByDepartment.get(department)) > 0 || numeric(actualByDepartment.get(department)) > 0)
    .map((department) => {
      const scheduled = numeric(scheduledByDepartment.get(department));
      const actual = numeric(actualByDepartment.get(department));
      return { department, scheduled, actual, variance: actual - scheduled };
    });

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [792, 612];
  const margin = 34;
  const dark = rgb(0.16, 0.12, 0.10);
  const tan = rgb(0.96, 0.92, 0.86);
  const white = rgb(1, 1, 1);
  const ink = rgb(0.12, 0.09, 0.07);
  const muted = rgb(0.38, 0.32, 0.27);
  const border = rgb(0.84, 0.78, 0.69);
  const green = rgb(0.12, 0.42, 0.30);
  const amber = rgb(0.57, 0.25, 0.05);
  let page = pdf.addPage(pageSize);
  let y = 568;

  const drawText = (text: string, x: number, yPos: number, size = 8, isBold = false, color = ink) => {
    page.drawText(String(text || "").slice(0, 180), { x, y: yPos, size, font: isBold ? bold : font, color });
  };
  const drawBox = (x: number, yTop: number, w: number, h: number, fill = white, stroke = border) => {
    page.drawRectangle({ x, y: yTop - h, width: w, height: h, color: fill, borderColor: stroke, borderWidth: 0.7 });
  };
  const header = () => {
    page.drawRectangle({ x: 0, y: 546, width: pageSize[0], height: 66, color: dark });
    drawText("Labor Performance Report", margin, 584, 20, true, white);
    drawText(`${payload.schedule.propertyName || PROPERTY_NAME} | ${payload.schedule.weekStartDate} to ${payload.schedule.weekEndDate}`, margin, 563, 9, false, rgb(0.90, 0.84, 0.75));
    y = 526;
  };
  const newPage = () => {
    page = pdf.addPage(pageSize);
    header();
  };
  const ensure = (height: number) => {
    if (y - height < 34) newPage();
  };
  header();

  const cardW = (pageSize[0] - margin * 2 - 36) / 4;
  const cards = [
    ["Rooms", actualRooms.toFixed(0), `Forecast ${forecastRooms.toFixed(0)} | ${actualRooms - forecastRooms >= 0 ? "+" : ""}${(actualRooms - forecastRooms).toFixed(0)}`],
    ["Room revenue", `$${actualRoomRevenue.toFixed(0)}`, `Forecast $${forecastRoomRevenue.toFixed(0)}`],
    ["Labor hours", actualHours.toFixed(2), `Scheduled ${scheduledHours.toFixed(2)} | ${actualHours - scheduledHours >= 0 ? "+" : ""}${(actualHours - scheduledHours).toFixed(2)}`],
    ["Actual HPOR", actualHpor.toFixed(2), `Target ${TARGET_HPOR.toFixed(2)} | Planned ${scheduledHpor.toFixed(2)}`],
  ];
  cards.forEach((card, index) => {
    const x = margin + index * (cardW + 12);
    drawBox(x, y, cardW, 62, tan);
    drawText(card[0], x + 10, y - 16, 8, true, muted);
    drawText(card[1], x + 10, y - 38, 18, true, ink);
    drawText(card[2], x + 10, y - 52, 8, false, muted);
  });
  y -= 84;

  drawText("Housekeeping Room Attendant MPOR", margin, y, 13, true);
  y -= 18;
  const hkCols = [230, 95, 100, 105, 80, 80];
  const hkHeaders = ["Room Attendant", "Actual hrs", "Room credits", "Std minutes", "MPOR", "Target"];
  let x = margin;
  hkHeaders.forEach((heading, index) => {
    drawBox(x, y, hkCols[index], 20, dark, dark);
    drawText(heading, x + 5, y - 13, 7, true, white);
    x += hkCols[index];
  });
  y -= 20;
  if (!hkRows.length) {
    ensure(22);
    drawBox(margin, y, pageSize[0] - margin * 2, 24, rgb(0.99, 0.96, 0.91));
    drawText("No room-attendant board data has been entered yet. Enter HK boards after the schedule closes to calculate individual MPOR.", margin + 8, y - 15, 8, false, muted);
    y -= 30;
  }
  for (const row of hkRows) {
    ensure(22);
    const mpor = row.roomCredits > 0 ? (row.actualHours * 60) / row.roomCredits : 0;
    const values = [row.employee.displayName, row.actualHours.toFixed(2), row.roomCredits.toFixed(1), row.standardMinutes.toFixed(0), mpor.toFixed(1), `${TARGET_HK_MPOR_MIN}-${TARGET_HK_MPOR_MAX}`];
    x = margin;
    values.forEach((value, index) => {
      drawBox(x, y, hkCols[index], 20, white);
      drawText(String(value), x + 5, y - 13, 7, index === 0 || index === 4, index === 4 ? (mpor >= TARGET_HK_MPOR_MIN && mpor <= TARGET_HK_MPOR_MAX ? green : amber) : ink);
      x += hkCols[index];
    });
    y -= 20;
  }

  ensure(70);
  y -= 10;
  drawText("Department Labor Performance", margin, y, 13, true);
  y -= 18;
  const deptCols = [220, 140, 140, 140];
  const deptHeaders = ["Department", "Scheduled hours", "Actual hours", "Variance"];
  x = margin;
  deptHeaders.forEach((heading, index) => {
    drawBox(x, y, deptCols[index], 22, dark, dark);
    drawText(heading, x + 5, y - 13, 7, true, white);
    x += deptCols[index];
  });
  y -= 22;
  for (const row of departmentRows) {
    ensure(24);
    const values = [row.department, row.scheduled.toFixed(2), row.actual.toFixed(2), `${row.variance >= 0 ? "+" : ""}${row.variance.toFixed(2)}`];
    x = margin;
    values.forEach((value, index) => {
      drawBox(x, y, deptCols[index], 22, white);
      drawText(String(value), x + 5, y - 14, 8, index === 0 || index === 3, index === 3 && Math.abs(row.variance) >= 1 ? amber : ink);
      x += deptCols[index];
    });
    y -= 22;
  }
  y -= 8;
  drawText("Note: Department actual hours are assigned from scheduled department where available; otherwise the associate's primary department is used.", margin, y, 7, false, muted);
  return Buffer.from(await pdf.save());
}

export function registerScheduleRoutes(app: Express) {
  const router = express.Router();

  router.get("/auth/me", async (req: any, res, next) => {
    try {
      const user = await getUserBySession(req);
      if (!user || user.disabledAt) return res.json({ user: null });
      res.json({ user: await publicScheduleUserWithProfile(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/auth/register", scheduleRateLimiter, async (req: any, res, next) => {
    try {
      const parsed = scheduleRegisterSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid schedule signup", validation: parsed.error.format() });
      const email = normalizeEmail(parsed.data.email);
      const existing = await db.select().from(tipsUsers).where(eq(tipsUsers.email, email)).limit(1);
      let user = existing[0];
      if (user) {
        if (user.disabledAt) return res.status(403).json({ error: "This account is disabled. Contact your manager." });
        if (!(await bcrypt.compare(parsed.data.password.trim(), user.hashedPassword))) {
          return res.status(409).json({ error: "An account already exists for this email. Sign in or request a temporary password." });
        }
      } else {
        const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
        [user] = await db.insert(tipsUsers).values({
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          employeeDisplayName: parsed.data.employeeDisplayName || `${parsed.data.firstName} ${parsed.data.lastName}`,
          email,
          position: parsed.data.position || parsed.data.rolesJson.join(", "),
          role: SCHEDULE_ADMIN_EMAILS.has(email) ? "super_admin" : "employee",
          hashedPassword,
        } as any).returning();
      }
      await upsertScheduleEmployeeForUser(user, { ...parsed.data, email });
      req.session.tipsUserId = user.id;
      req.session.save(async () => res.status(existing[0] ? 200 : 201).json({ user: await publicScheduleUserWithProfile(user) }));
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
      res.json({ employees: stripPrivateEmployeeRates(employees, _req.scheduleUser) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/employees/payroll-import", requireScheduleManager, payrollUpload.single("payrollRegister"), async (req: any, res, next) => {
    try {
      if (!publicScheduleUser(req.scheduleUser).isSuperAdmin) return res.status(403).json({ error: "Super admin access required for payroll rates." });
      if (!req.file) return res.status(400).json({ error: "Payroll register PDF or text file is required." });
      const text = req.file.mimetype === "application/pdf" || req.file.originalname.toLowerCase().endsWith(".pdf")
        ? (await pdfParse(req.file.buffer)).text
        : req.file.buffer.toString("utf8");
      const payrollRows = parsePayrollRegisterText(text);
      const employees = await db.select().from(scheduleEmployees);
      const matched: any[] = [];
      const unmatched: any[] = [];
      for (const row of payrollRows) {
        const employee = employees.find((item) => payrollNameMatches(item, row.payrollName));
        if (!employee) {
          unmatched.push({ payrollName: row.payrollName, employeeNumber: row.employeeNumber });
          continue;
        }
        await db.update(scheduleEmployees).set({ hourlyRate: String(row.hourlyRate), updatedAt: new Date() } as any).where(eq(scheduleEmployees.id, employee.id));
        matched.push({ employeeId: employee.id, displayName: employee.displayName, hourlyRate: row.hourlyRate, grossWage: row.grossWage });
      }
      await audit(null, req.scheduleUser.id, "schedule_payroll_rates_imported", { matched: matched.length, unmatched: unmatched.length });
      res.json({ matched, unmatched });
    } catch (error) {
      next(error);
    }
  });

  router.post("/employees", requireScheduleManager, scheduleRateLimiter, async (req: any, res, next) => {
    try {
      const parsed = employeeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid employee", validation: parsed.error.format() });
      const isSuperAdmin = publicScheduleUser(req.scheduleUser).isSuperAdmin;
      const [employee] = await db.insert(scheduleEmployees).values({
        ...parsed.data,
        hourlyRate: isSuperAdmin && parsed.data.hourlyRate != null ? parsed.data.hourlyRate.toFixed(2) : null,
        department: normalizeDepartment(parsed.data.department),
        rolesJson: parsed.data.rolesJson || rolesArray(parsed.data.position || parsed.data.department),
        isSalaried: Boolean(parsed.data.isSalaried),
        isDepartmentManager: Boolean(parsed.data.isDepartmentManager),
        sortOrder: parsed.data.sortOrder || 0,
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
      const isSuperAdmin = publicScheduleUser(req.scheduleUser).isSuperAdmin;
      const [employee] = await db.update(scheduleEmployees).set({
        ...parsed.data,
        hourlyRate: isSuperAdmin && Object.prototype.hasOwnProperty.call(parsed.data, "hourlyRate")
          ? parsed.data.hourlyRate == null ? null : parsed.data.hourlyRate.toFixed(2)
          : undefined,
        department: parsed.data.department ? normalizeDepartment(parsed.data.department) : undefined,
        rolesJson: parsed.data.rolesJson === null ? null : parsed.data.rolesJson,
        isSalaried: parsed.data.isSalaried,
        isDepartmentManager: parsed.data.isDepartmentManager,
        sortOrder: parsed.data.sortOrder,
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

  router.get("/requests", requireScheduleAuth, async (req: any, res, next) => {
    try {
      const user = await publicScheduleUserWithProfile(req.scheduleUser);
      const query = db
        .select({ request: scheduleRequests, user: tipsUsers })
        .from(scheduleRequests)
        .innerJoin(tipsUsers, eq(scheduleRequests.requesterUserId, tipsUsers.id));
      let rows: Array<{ request: any; user: any }>;
      if (user.isSuperAdmin) {
        rows = await query.orderBy(desc(scheduleRequests.requestDate), desc(scheduleRequests.createdAt));
      } else if (user.isAdmin) {
        const departments = await getScheduleRequestDepartmentsForManager(req.scheduleUser);
        if (!departments.length) rows = [];
        else rows = await query.where(inArray(scheduleRequests.department, departments)).orderBy(desc(scheduleRequests.requestDate), desc(scheduleRequests.createdAt));
      } else {
        rows = await query.where(eq(scheduleRequests.requesterUserId, req.scheduleUser.id)).orderBy(desc(scheduleRequests.requestDate), desc(scheduleRequests.createdAt));
      }
      res.json({ requests: await addRequestConflictInfo(rows) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/requests", requireScheduleAuth, scheduleRateLimiter, async (req: any, res, next) => {
    try {
      const parsed = scheduleRequestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid schedule request", validation: parsed.error.format() });
      const requestEnd = parsed.data.requestEndDate || parsed.data.requestDate;
      const requestSpan = daysBetween(parsed.data.requestDate, requestEnd);
      if (requestSpan < 0) {
        return res.status(400).json({ error: "Request end date must be the same as or after the start date." });
      }
      if (requestSpan > 30) {
        return res.status(400).json({ error: "Schedule requests may cover up to 31 consecutive days." });
      }
      const leadDays = daysBetween(todayDateKey(), parsed.data.requestDate);
      const policyWarning = leadDays < 14;
      const department = await getScheduleRequestDepartment(req.scheduleUser);
      const activeExisting = await db.select().from(scheduleRequests).where(and(eq(scheduleRequests.requesterUserId, req.scheduleUser.id), inArray(scheduleRequests.status, ["submitted", "approved"] as any)));
      if (activeExisting.some((request) => requestRangesOverlap(request, { requestDate: parsed.data.requestDate, requestEndDate: requestEnd }))) {
        return res.status(409).json({ error: "You already have a submitted or approved request overlapping those dates." });
      }
      const [request] = await db
        .insert(scheduleRequests)
        .values({
          requesterUserId: req.scheduleUser.id,
          department,
          requestDate: parsed.data.requestDate,
          requestEndDate: requestEnd,
          requestGroupId: crypto.randomUUID(),
          requestType: parsed.data.requestType,
          startTime: parsed.data.startTime || null,
          endTime: parsed.data.endTime || null,
          notes: parsed.data.notes,
          status: "submitted",
        })
        .returning();
      await audit(null, req.scheduleUser.id, "schedule_request_submitted", { requestId: request.id, requestDate: request.requestDate, requestEndDate: request.requestEndDate });
      let emailSent = false;
      try {
        const managerEmails = await getDepartmentManagerEmails(department);
        emailSent = await sendScheduleRequestEmail(request, req.scheduleUser, managerEmails);
        await audit(null, req.scheduleUser.id, "schedule_request_email_sent", { requestId: request.id, department, recipientCount: managerEmails.length, emailSent });
      } catch (emailError: any) {
        console.error("Failed to send schedule request email:", {
          requestId: request.id,
          department,
          error: emailError?.message || emailError,
        });
      }
      res.status(201).json({ request, emailSent, policyWarning });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/requests/:id/status", requireScheduleManager, async (req: any, res, next) => {
    try {
      const parsed = scheduleRequestStatusSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid request status", validation: parsed.error.format() });
      const user = publicScheduleUser(req.scheduleUser);
      const [existing] = await db.select().from(scheduleRequests).where(eq(scheduleRequests.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Schedule request not found" });
      if (!user.isSuperAdmin) {
        const departments = await getScheduleRequestDepartmentsForManager(req.scheduleUser);
        if (!departments.includes(existing.department)) return res.status(403).json({ error: "This request belongs to another department." });
      }
      const [request] = await db
        .update(scheduleRequests)
        .set({ status: parsed.data.status, reviewedByUserId: req.scheduleUser.id, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(scheduleRequests.id, req.params.id))
        .returning();
      await audit(null, req.scheduleUser.id, "schedule_request_status_updated", { requestId: request.id, status: request.status });
      const [requester] = await db.select().from(tipsUsers).where(eq(tipsUsers.id, request.requesterUserId)).limit(1);
      const [requestWithConflicts] = await addRequestConflictInfo([{ request, user: requester }]);
      res.json({ request: requestWithConflicts });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/requests/:id/cancel", requireScheduleAuth, async (req: any, res, next) => {
    try {
      const [existing] = await db.select().from(scheduleRequests).where(eq(scheduleRequests.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Schedule request not found" });
      const user = publicScheduleUser(req.scheduleUser);
      let canCancel = existing.requesterUserId === req.scheduleUser.id || user.isSuperAdmin;
      if (!canCancel && user.isAdmin) {
        const departments = await getScheduleRequestDepartmentsForManager(req.scheduleUser);
        canCancel = departments.includes(existing.department);
      }
      if (!canCancel) return res.status(403).json({ error: "You can only cancel your own request." });
      if (existing.status === "cancelled") return res.json({ request: existing });
      if (existing.status === "denied") return res.status(409).json({ error: "Denied requests are already closed." });
      const [request] = await db
        .update(scheduleRequests)
        .set({ status: "cancelled", reviewedByUserId: req.scheduleUser.id, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(scheduleRequests.id, req.params.id))
        .returning();
      await audit(null, req.scheduleUser.id, "schedule_request_cancelled", { requestId: request.id, previousStatus: existing.status });
      const [requester] = await db.select().from(tipsUsers).where(eq(tipsUsers.id, request.requesterUserId)).limit(1);
      const [requestWithConflicts] = await addRequestConflictInfo([{ request, user: requester }]);
      res.json({ request: requestWithConflicts });
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
      const canManage = await isScheduleManager(req.scheduleUser);
      res.json({ weeks: canManage ? rows : rows.filter((week) => week.status === "published") });
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
          const employees = await db.select().from(scheduleEmployees);
          const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
          const shiftTypes = await db.select().from(scheduleShiftTypes);
          const shiftTypeById = new Map(shiftTypes.map((shiftType) => [shiftType.id, shiftType]));
          const allowedDepartments = publicScheduleUser(req.scheduleUser).isSuperAdmin
            ? null
            : new Set(managerDepartmentsForUser(req.scheduleUser, employees));
          const previousStart = parseDateKey(previous.weekStartDate)!;
          const nextStart = parseDateKey(weekStartDate)!;
          for (const assignment of previousAssignments) {
            const employee = employeesById.get(assignment.employeeId || "");
            const shiftType = shiftTypeById.get(assignment.shiftTypeId || "");
            const assignmentDepartment = assignmentRenderDepartment(assignment, employee, shiftType);
            if (allowedDepartments && !allowedDepartments.has(assignmentDepartment)) continue;
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
              roleWorked: assignment.roleWorked,
              managerNote: assignment.managerNote,
              isOpenShift: assignment.isOpenShift,
            } as any).onConflictDoNothing();
          }
        }
      }
      await audit(schedule.id, req.scheduleUser.id, "schedule_created", { mode: parsed.data.mode });
      res.status(201).json(stripPrivateScheduleRates(await buildSchedulePayload(schedule.id), req.scheduleUser));
    } catch (error) {
      next(error);
    }
  });

  router.get("/weeks/:id", requireScheduleAuth, async (req: any, res, next) => {
    try {
      const payload = await buildSchedulePayload(req.params.id);
      if (!payload) return res.status(404).json({ error: "Schedule not found" });
      if (!(await isScheduleManager(req.scheduleUser)) && payload.schedule.status !== "published") return res.status(403).json({ error: "Schedule is not published" });
      res.json(stripPrivateScheduleRates(payload, req.scheduleUser));
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
      res.json(stripPrivateScheduleRates({ ...payload, readOnly: true }, { email: "", role: "employee" }));
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
      res.json(stripPrivateScheduleRates(await buildSchedulePayload(schedule.id), req.scheduleUser));
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/forecast/import", requireScheduleManager, forecastUpload.single("forecastReport"), async (req: any, res, next) => {
    try {
      const schedule = await getScheduleOr404(req.params.id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      if (!req.file) return res.status(400).json({ error: "CSV forecast report is required." });
      const days = weekDays(schedule.weekStartDate);
      const importedDays = forecastFromOnTheBooksCsv(req.file.buffer.toString("utf8"), days);
      if (importedDays.length === 0) {
        return res.status(400).json({ error: "No matching forecast dates were found in the uploaded report for this schedule week." });
      }
      for (const day of importedDays) {
        await db.insert(scheduleForecastDays).values({ scheduleId: schedule.id, ...day } as any).onConflictDoUpdate({
          target: [scheduleForecastDays.scheduleId, scheduleForecastDays.forecastDate],
          set: { ...day, updatedAt: new Date() } as any,
        });
      }
      await audit(schedule.id, req.scheduleUser.id, "forecast_imported", {
        fileName: req.file.originalname,
        importedDays: importedDays.length,
        targetOccupancyPercent: TARGET_OCCUPANCY_PERCENT,
      });
      res.json(stripPrivateScheduleRates(await buildSchedulePayload(schedule.id), req.scheduleUser));
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/forecast/actualized", requireScheduleManager, forecastUpload.single("actualizedReport"), async (req: any, res, next) => {
    try {
      const schedule = await getScheduleOr404(req.params.id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      if (!req.file) return res.status(400).json({ error: "Actualized CSV report is required." });
      const days = weekDays(schedule.weekStartDate);
      const actualizedDays = actualizedFromOnTheBooksCsv(req.file.buffer.toString("utf8"), days);
      if (actualizedDays.length === 0) {
        return res.status(400).json({ error: "No matching actualized dates were found in the uploaded report for this schedule week." });
      }
      for (const day of actualizedDays) {
        await db.insert(scheduleForecastDays).values({ scheduleId: schedule.id, ...day } as any).onConflictDoUpdate({
          target: [scheduleForecastDays.scheduleId, scheduleForecastDays.forecastDate],
          set: { ...day, updatedAt: new Date() } as any,
        });
      }
      await audit(schedule.id, req.scheduleUser.id, "forecast_actualized_imported", {
        fileName: req.file.originalname,
        actualizedDays: actualizedDays.length,
      });
      res.json(stripPrivateScheduleRates(await buildSchedulePayload(schedule.id), req.scheduleUser));
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/hours-detail", requireScheduleManager, hoursDetailUpload.single("hoursDetail"), async (req: any, res, next) => {
    try {
      const schedule = await getScheduleOr404(req.params.id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      if (!req.file) return res.status(400).json({ error: "Hours detail XLSX report is required." });
      const actualRows = parseHoursDetailWorkbook(req.file.buffer);
      if (actualRows.length === 0) return res.status(400).json({ error: "No associate hour rows were found in the uploaded report." });
      const [employees, shiftTypes, assignments] = await Promise.all([
        db.select().from(scheduleEmployees).where(eq(scheduleEmployees.active, true)),
        db.select().from(scheduleShiftTypes),
        db.select().from(scheduleShiftAssignments).where(eq(scheduleShiftAssignments.scheduleId, schedule.id)),
      ]);
      const actualByEmployeeDay = new Map<string, { employee: any; date: string; hours: number; notes: string[] }>();
      for (const actual of actualRows) {
        const employee = employees.find((item) => payrollNameMatches(item, actual.payrollName));
        if (!employee) continue;
        if (!weekDays(schedule.weekStartDate).includes(actual.date)) continue;
        const key = `${employee.id}:${actual.date}`;
        const row = actualByEmployeeDay.get(key) || { employee, date: actual.date, hours: 0, notes: [] };
        row.hours = Number((row.hours + actual.hours).toFixed(2));
        const note = actual.notes || [actual.department, actual.position].filter(Boolean).join(" / ");
        if (note) row.notes.push(note);
        actualByEmployeeDay.set(key, row);
      }
      for (const actual of Array.from(actualByEmployeeDay.values())) {
        await upsertScheduleActualHours(
          schedule.id,
          actual.employee.id,
          actual.date,
          actual.hours,
          Array.from(new Set(actual.notes)).join("; ") || null,
          "hours_detail_import",
          req.scheduleUser.id,
        );
        if (employeeScheduleDepartments(actual.employee).includes("Housekeeping")) {
          await upsertHousekeepingBoardActualHours(
            schedule.id,
            actual.employee.id,
            actual.date,
            actual.hours,
            Array.from(new Set(actual.notes)).join("; ") || null,
            req.scheduleUser.id,
          );
        }
      }
      const rows = compareScheduledToActualHours(schedule, employees, shiftTypes, assignments, actualRows);
      await audit(schedule.id, req.scheduleUser.id, "schedule_hours_detail_imported", {
        fileName: req.file.originalname,
        actualRows: actualRows.length,
        comparedEmployees: rows.length,
        unmatched: rows.filter((row) => !row.matched).length,
      });
      res.json({
        fileName: req.file.originalname,
        weekStartDate: schedule.weekStartDate,
        weekEndDate: schedule.weekEndDate,
        rows,
        totals: {
          scheduledHours: Number(rows.reduce((sum, row) => sum + row.scheduledHours, 0).toFixed(2)),
          actualHours: Number(rows.reduce((sum, row) => sum + row.actualHours, 0).toFixed(2)),
          variance: Number(rows.reduce((sum, row) => sum + row.variance, 0).toFixed(2)),
          unmatched: rows.filter((row) => !row.matched).length,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/weeks/:id/forecast/groups", requireScheduleManager, async (req: any, res, next) => {
    try {
      const schedule = await getScheduleOr404(req.params.id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      const parsed = popupGroupSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid pop-up group adjustment", validation: parsed.error.format() });
      const days = weekDays(schedule.weekStartDate);
      if (!days.includes(parsed.data.forecastDate)) return res.status(400).json({ error: "Group date is outside this schedule week." });
      await db.insert(scheduleForecastDays).values({ scheduleId: schedule.id, ...parsed.data } as any).onConflictDoUpdate({
        target: [scheduleForecastDays.scheduleId, scheduleForecastDays.forecastDate],
        set: { ...parsed.data, updatedAt: new Date() } as any,
      });
      await audit(schedule.id, req.scheduleUser.id, "forecast_popup_group_updated", parsed.data);
      res.json(stripPrivateScheduleRates(await buildSchedulePayload(schedule.id), req.scheduleUser));
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
      const [targetEmployee] = employeeId ? await db.select().from(scheduleEmployees).where(eq(scheduleEmployees.id, employeeId)).limit(1) : [];
      const targetDepartment = normalizeDepartment(parsed.data.roleWorked || targetEmployee?.department);
      const requesterEmployee = await getScheduleEmployeeForUser(req.scheduleUser);
      const isOwnScheduleCell = Boolean(targetEmployee && requesterEmployee && targetEmployee.id === requesterEmployee.id);
      if (!(await canManageDepartment(req.scheduleUser, targetDepartment)) && !isOwnScheduleCell) return res.status(403).json({ error: "You can only edit your assigned department schedule." });
      if (targetEmployee && !isOwnScheduleCell && !employeeApprovedForDepartment(targetEmployee, targetDepartment, parsed.data.roleWorked)) {
        return res.status(403).json({ error: "This associate is not approved to work that department. Add the cross-department role on their employee profile first." });
      }
      if (!publicScheduleUser(req.scheduleUser).isSuperAdmin && !isOwnScheduleCell && sectionCompleted(schedule, targetDepartment)) return res.status(423).json({ error: `${targetDepartment} has already been marked completed.` });
      if (parsed.data.clear) {
        await db.delete(scheduleShiftAssignments).where(and(eq(scheduleShiftAssignments.scheduleId, schedule.id), eq(scheduleShiftAssignments.shiftDate, parsed.data.shiftDate), employeeId ? eq(scheduleShiftAssignments.employeeId, employeeId) : eq(scheduleShiftAssignments.isOpenShift, true)));
      } else {
        const [selectedShiftType] = parsed.data.shiftTypeId ? await db.select().from(scheduleShiftTypes).where(eq(scheduleShiftTypes.id, parsed.data.shiftTypeId)).limit(1) : [];
        const proposedAssignment = {
          roleWorked: parsed.data.roleWorked || selectedShiftType?.label || null,
          roleNote: parsed.data.roleNote || null,
        };
        const proposedIsInspector = isRoomInspectorWork(proposedAssignment, selectedShiftType);
        const proposedIsLaundry = isLaundryWork(proposedAssignment, selectedShiftType);
        const proposedIsHouseperson = isHousepersonWork(proposedAssignment, selectedShiftType);
        const proposedIsExecHk = isExecutiveHousekeeperEmployee(targetEmployee);
        if (proposedIsInspector || proposedIsExecHk || (targetDepartment === "Housekeeping" && (proposedIsLaundry || proposedIsHouseperson))) {
          const [sameDayAssignments, allEmployees, allShiftTypes] = await Promise.all([
            db.select().from(scheduleShiftAssignments).where(and(eq(scheduleShiftAssignments.scheduleId, schedule.id), eq(scheduleShiftAssignments.shiftDate, parsed.data.shiftDate))),
            db.select().from(scheduleEmployees),
            db.select().from(scheduleShiftTypes),
          ]);
          const employeeById = new Map(allEmployees.map((employee) => [employee.id, employee]));
          const shiftTypeById = new Map(allShiftTypes.map((shift) => [shift.id, shift]));
          let laundryCount = proposedIsLaundry ? 1 : 0;
          let housepersonCount = proposedIsHouseperson ? 1 : 0;
          let inspectorAlreadyScheduled = false;
          let execHkAlreadyScheduled = false;
          for (const existing of sameDayAssignments) {
            if (existing.employeeId === employeeId) continue;
            const existingEmployee = employeeById.get(existing.employeeId || "");
            const existingShift = shiftTypeById.get(existing.shiftTypeId || "");
            if (isExecutiveHousekeeperEmployee(existingEmployee)) execHkAlreadyScheduled = true;
            if (assignmentRenderDepartment(existing, existingEmployee, existingShift) !== "Housekeeping") continue;
            if (isLaundryWork(existing, existingShift)) laundryCount += 1;
            if (isHousepersonWork(existing, existingShift)) housepersonCount += 1;
            if (isRoomInspectorWork(existing, existingShift)) inspectorAlreadyScheduled = true;
          }
          if (proposedIsInspector && execHkAlreadyScheduled) {
            return res.status(409).json({ error: "Room Inspector is already covered because the Executive Housekeeper is scheduled that day." });
          }
          if (proposedIsExecHk && inspectorAlreadyScheduled) {
            return res.status(409).json({ error: "A Room Inspector is already scheduled that day. Remove that inspector shift before scheduling the Executive Housekeeper." });
          }
          if (laundryCount > 1) {
            return res.status(409).json({ error: "Laundry coverage already exists for this day. Review before scheduling a second Laundry attendant." });
          }
          if (housepersonCount > 1) {
            return res.status(409).json({ error: "Houseperson coverage already exists for this day. Review before scheduling a second Houseperson." });
          }
        }
        const nonWorkingShift = isNonWorkingShiftLabel(selectedShiftType?.label) || isNonWorkingShiftLabel(parsed.data.roleWorked);
        const shiftValues = {
          shiftTypeId: parsed.data.shiftTypeId || null,
          customStartTime: nonWorkingShift ? null : parsed.data.customStartTime || null,
          customEndTime: nonWorkingShift ? null : parsed.data.customEndTime || null,
          unpaidBreakMinutes: nonWorkingShift ? null : parsed.data.unpaidBreakMinutes ?? null,
          roleNote: parsed.data.roleNote || null,
          roleWorked: parsed.data.roleWorked || selectedShiftType?.label || null,
          managerNote: parsed.data.managerNote || null,
          isOpenShift: parsed.data.isOpenShift,
        };
        if (employeeId) {
          const approvedRequest = await getApprovedRequestForEmployeeDate(employeeId, parsed.data.shiftDate);
          if (approvedRequest) {
            return res.status(409).json({
              error: "This associate has an approved schedule request for this date.",
              requestId: approvedRequest.id,
            });
          }
        }
        await db.insert(scheduleShiftAssignments).values({
          scheduleId: schedule.id,
          employeeId,
          shiftDate: parsed.data.shiftDate,
          ...shiftValues,
        } as any).onConflictDoUpdate({
          target: [scheduleShiftAssignments.scheduleId, scheduleShiftAssignments.employeeId, scheduleShiftAssignments.shiftDate],
          set: {
            ...shiftValues,
            updatedAt: new Date(),
          } as any,
        });
      }
      await audit(schedule.id, req.scheduleUser.id, "shift_updated", {
        employeeId,
        shiftDate: parsed.data.shiftDate,
        clear: parsed.data.clear,
        shiftTypeId: parsed.data.shiftTypeId || null,
        roleWorked: parsed.data.roleWorked || null,
      });
      res.json(stripPrivateScheduleRates(await buildSchedulePayload(schedule.id), req.scheduleUser));
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/copy-previous", requireScheduleManager, async (req: any, res, next) => {
    try {
      const schedule = await getScheduleOr404(req.params.id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      if (schedule.status === "published") return res.status(423).json({ error: "Published schedules are locked. Reopen before copying previous shifts." });
      const parsed = copyPreviousScheduleSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: "Invalid copy request", validation: parsed.error.format() });
      if (parsed.data.scope === "employee" && !parsed.data.employeeId) return res.status(400).json({ error: "Choose an associate to copy." });

      const [previous] = await db.select().from(weeklySchedules).where(lt(weeklySchedules.weekStartDate, schedule.weekStartDate)).orderBy(desc(weeklySchedules.weekStartDate)).limit(1);
      if (!previous) return res.status(404).json({ error: "No previous schedule found to copy from." });

      const [employees, shiftTypes, previousAssignments] = await Promise.all([
        db.select().from(scheduleEmployees).where(eq(scheduleEmployees.active, true)),
        db.select().from(scheduleShiftTypes),
        db.select().from(scheduleShiftAssignments).where(eq(scheduleShiftAssignments.scheduleId, previous.id)),
      ]);
      const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
      const shiftTypeById = new Map(shiftTypes.map((shift) => [shift.id, shift]));
      const shiftTypeByLabel = new Map(shiftTypes.map((shift) => [String(shift.label || "").toUpperCase(), shift]));
      const editableDepartments = publicScheduleUser(req.scheduleUser).isSuperAdmin ? DEPARTMENTS : managerDepartmentsForUser(req.scheduleUser, employees);
      const requestedDepartment = parsed.data.department ? normalizeDepartment(parsed.data.department) : null;
      if (requestedDepartment && !editableDepartments.includes(requestedDepartment)) return res.status(403).json({ error: "You can only copy shifts for your assigned department." });

      const previousStart = parseDateKey(previous.weekStartDate)!;
      const nextStart = parseDateKey(schedule.weekStartDate)!;
      let copied = 0;
      for (const assignment of previousAssignments) {
        if (parsed.data.scope === "employee" && assignment.employeeId !== parsed.data.employeeId) continue;
        const employee = assignment.employeeId ? employeeById.get(assignment.employeeId) : null;
        const shiftType = resolveShiftTypeForAssignment(assignment, shiftTypeById, shiftTypeByLabel);
        const department = assignmentRenderDepartment(assignment, employee, shiftType);
        if (requestedDepartment && department !== requestedDepartment) continue;
        if (!editableDepartments.includes(department)) continue;
        if (!publicScheduleUser(req.scheduleUser).isSuperAdmin && sectionCompleted(schedule, department)) {
          return res.status(423).json({ error: `${department} has already been marked completed. Reopen that section before copying previous shifts.` });
        }
        const offset = Math.round((parseDateKey(assignment.shiftDate)!.getTime() - previousStart.getTime()) / DAY_MS);
        const shiftDate = toDateKey(new Date(nextStart.getTime() + offset * DAY_MS));
        await db.insert(scheduleShiftAssignments).values({
          scheduleId: schedule.id,
          employeeId: assignment.employeeId,
          shiftDate,
          shiftTypeId: assignment.shiftTypeId,
          customStartTime: assignment.customStartTime,
          customEndTime: assignment.customEndTime,
          unpaidBreakMinutes: assignment.unpaidBreakMinutes,
          roleNote: assignment.roleNote,
          roleWorked: assignment.roleWorked,
          managerNote: assignment.managerNote,
          isOpenShift: assignment.isOpenShift,
        } as any).onConflictDoUpdate({
          target: [scheduleShiftAssignments.scheduleId, scheduleShiftAssignments.employeeId, scheduleShiftAssignments.shiftDate],
          set: {
            shiftTypeId: assignment.shiftTypeId,
            customStartTime: assignment.customStartTime,
            customEndTime: assignment.customEndTime,
            unpaidBreakMinutes: assignment.unpaidBreakMinutes,
            roleNote: assignment.roleNote,
            roleWorked: assignment.roleWorked,
            managerNote: assignment.managerNote,
            isOpenShift: assignment.isOpenShift,
            updatedAt: new Date(),
          } as any,
        });
        copied += 1;
      }
      await audit(schedule.id, req.scheduleUser.id, "schedule_previous_shifts_copied", { previousScheduleId: previous.id, copied, ...parsed.data });
      res.json({ ...(stripPrivateScheduleRates(await buildSchedulePayload(schedule.id), req.scheduleUser) as any), copied });
    } catch (error) {
      next(error);
    }
  });

  router.put("/weeks/:id/housekeeping-board", requireScheduleManager, async (req: any, res, next) => {
    try {
      const schedule = await getScheduleOr404(req.params.id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      const parsed = housekeepingBoardSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid housekeeping board", validation: parsed.error.format() });
      const days = weekDays(schedule.weekStartDate);
      if (!days.includes(parsed.data.boardDate)) return res.status(400).json({ error: "Board date is outside this schedule week." });
      const [employee] = await db.select().from(scheduleEmployees).where(eq(scheduleEmployees.id, parsed.data.employeeId)).limit(1);
      if (!employee) return res.status(404).json({ error: "Schedule employee not found" });
      if (!(await canManageDepartment(req.scheduleUser, "Housekeeping"))) {
        return res.status(403).json({ error: "Only Housekeeping managers or admins can enter Housekeeping boards." });
      }
      if (normalizeDepartment(employee.department) !== "Housekeeping") {
        return res.status(400).json({ error: "Housekeeping boards can only be entered for Housekeeping associates." });
      }
      const [assignment] = await db
        .select()
        .from(scheduleShiftAssignments)
        .where(and(eq(scheduleShiftAssignments.scheduleId, schedule.id), eq(scheduleShiftAssignments.employeeId, parsed.data.employeeId), eq(scheduleShiftAssignments.shiftDate, parsed.data.boardDate)))
        .limit(1);
      const [shiftType] = assignment?.shiftTypeId
        ? await db.select().from(scheduleShiftTypes).where(eq(scheduleShiftTypes.id, assignment.shiftTypeId)).limit(1)
        : [];
      const trackMpor = isRoomAttendantWork(assignment, shiftType, employee);
      const boardValues = {
        actualHours: parsed.data.actualHours.toFixed(2),
        checkoutRooms: trackMpor ? parsed.data.checkoutRooms : 0,
        stayoverRooms: trackMpor ? parsed.data.stayoverRooms : 0,
        dndRooms: trackMpor ? parsed.data.dndRooms : 0,
        oooRooms: trackMpor ? parsed.data.oooRooms : 0,
        deepCleanRooms: trackMpor ? parsed.data.deepCleanRooms : 0,
        notes: parsed.data.notes || null,
        enteredByUserId: req.scheduleUser.id,
      };
      await db.insert(scheduleHousekeepingBoards).values({
        scheduleId: schedule.id,
        employeeId: parsed.data.employeeId,
        boardDate: parsed.data.boardDate,
        ...boardValues,
      } as any).onConflictDoUpdate({
        target: [scheduleHousekeepingBoards.scheduleId, scheduleHousekeepingBoards.employeeId, scheduleHousekeepingBoards.boardDate],
        set: {
          ...boardValues,
          updatedAt: new Date(),
        } as any,
      });
      await upsertScheduleActualHours(
        schedule.id,
        parsed.data.employeeId,
        parsed.data.boardDate,
        parsed.data.actualHours,
        parsed.data.notes || null,
        trackMpor ? "housekeeping_board" : "housekeeping_hours",
        req.scheduleUser.id,
      );
      await audit(schedule.id, req.scheduleUser.id, "housekeeping_board_updated", { employeeId: parsed.data.employeeId, boardDate: parsed.data.boardDate });
      res.json(stripPrivateScheduleRates(await buildSchedulePayload(schedule.id), req.scheduleUser));
    } catch (error) {
      next(error);
    }
  });

  router.put("/weeks/:id/actual-hours", requireScheduleManager, async (req: any, res, next) => {
    try {
      const schedule = await getScheduleOr404(req.params.id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      const parsed = actualHoursSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid actual hours", validation: parsed.error.format() });
      const days = weekDays(schedule.weekStartDate);
      if (!days.includes(parsed.data.workDate)) return res.status(400).json({ error: "Actual hours date is outside this schedule week." });
      const [employee] = await db.select().from(scheduleEmployees).where(eq(scheduleEmployees.id, parsed.data.employeeId)).limit(1);
      if (!employee) return res.status(404).json({ error: "Schedule employee not found" });
      const [assignment] = await db
        .select()
        .from(scheduleShiftAssignments)
        .where(and(eq(scheduleShiftAssignments.scheduleId, schedule.id), eq(scheduleShiftAssignments.employeeId, parsed.data.employeeId), eq(scheduleShiftAssignments.shiftDate, parsed.data.workDate)))
        .limit(1);
      const [shiftType] = assignment?.shiftTypeId
        ? await db.select().from(scheduleShiftTypes).where(eq(scheduleShiftTypes.id, assignment.shiftTypeId)).limit(1)
        : [];
      const department = assignmentRenderDepartment(assignment, employee, shiftType) || normalizeDepartment(employee.department);
      if (!(await canManageDepartment(req.scheduleUser, department))) {
        return res.status(403).json({ error: "You can only enter actual hours for your assigned department." });
      }
      await upsertScheduleActualHours(
        schedule.id,
        parsed.data.employeeId,
        parsed.data.workDate,
        parsed.data.actualHours,
        parsed.data.notes || null,
        "manual",
        req.scheduleUser.id,
      );
      await audit(schedule.id, req.scheduleUser.id, "schedule_actual_hours_updated", { employeeId: parsed.data.employeeId, workDate: parsed.data.workDate });
      res.json(stripPrivateScheduleRates(await buildSchedulePayload(schedule.id), req.scheduleUser));
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/ai/generate", requireScheduleManager, scheduleRateLimiter, async (req: any, res, next) => {
    try {
      if (req.body?.userInitiated !== true) {
        return res.status(400).json({ error: "AI schedule generation must be explicitly started by a schedule manager." });
      }
      const payload = await buildSchedulePayload(req.params.id);
      if (!payload) return res.status(404).json({ error: "Schedule not found" });
      if (payload.schedule.status === "published") return res.status(423).json({ error: "Published schedules are locked. Reopen before generating a draft." });
      const mode = String(req.body?.mode || "").trim();
      const requestedDepartment = normalizeDepartment(String(req.body?.department || ""));
      let scope: string | string[] = requestedDepartment;
      if (mode === "frontDesk") {
        scope = "Front Desk";
      } else if (mode === "housekeeping") {
        scope = "Housekeeping";
      } else {
        return res.status(400).json({ error: "Choose Front Desk AI or Housekeeping AI. Other departments do not use AI schedule generation." });
      }
      const departmentsToCheck = Array.isArray(scope) ? scope : [scope];
      for (const department of departmentsToCheck) {
        if (!(await canManageDepartment(req.scheduleUser, department))) return res.status(403).json({ error: "You can only generate AI schedules for your assigned department." });
      }
      const draft = buildAiScheduleDraft(payload, scope);
      const ai = await summarizeAiSchedule(payload, draft);
      await audit(payload.schedule.id, req.scheduleUser.id, "schedule_ai_draft_generated", {
        proposedAssignments: draft.assignments.length,
        department: Array.isArray(scope) ? scope.join(", ") : scope,
        mode: mode || "department",
        aiAvailable: ai.aiAvailable,
      });
      res.json({ ...draft, ai, laborMetrics: payload.totals.laborMetrics, department: Array.isArray(scope) ? scope.join(", ") : scope, mode: mode || "department" });
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/ai/apply", requireScheduleManager, async (req: any, res, next) => {
    try {
      if (req.body?.userInitiated !== true) {
        return res.status(400).json({ error: "AI schedule changes must be explicitly applied by a schedule manager." });
      }
      const schedule = await getScheduleOr404(req.params.id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      if (schedule.status === "published") return res.status(423).json({ error: "Published schedules are locked. Reopen before applying a draft." });
      const parsed = aiDraftApplySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid AI draft", validation: parsed.error.format() });

      let applied = 0;
      const [employees, shiftTypes] = await Promise.all([
        db.select().from(scheduleEmployees),
        db.select().from(scheduleShiftTypes),
      ]);
      const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
      const shiftTypeById = new Map(shiftTypes.map((shift) => [shift.id, shift]));
      const allowedDepartment = parsed.data.mode === "frontDesk"
        ? "Front Desk"
        : parsed.data.mode === "housekeeping"
          ? "Housekeeping"
          : null;
      if (allowedDepartment) {
        if (!(await canManageDepartment(req.scheduleUser, allowedDepartment))) {
          return res.status(403).json({ error: `You can only apply AI drafts for your assigned department.` });
        }
      }
      for (const assignment of parsed.data.assignments) {
        const employee = employeeById.get(assignment.employeeId);
        const shiftType = shiftTypeById.get(assignment.shiftTypeId);
        const department = normalizeDepartment(assignment.roleWorked || shiftType?.departmentHint || shiftType?.label || employee?.department);
        if (allowedDepartment && department !== allowedDepartment) continue;
        if (!(await canManageDepartment(req.scheduleUser, department))) continue;
        if (employee && !employeeApprovedForDepartment(employee, department, assignment.roleWorked)) continue;
        const approvedRequest = await getApprovedRequestForEmployeeDate(assignment.employeeId, assignment.shiftDate);
        if (approvedRequest) continue;
        await db.insert(scheduleShiftAssignments).values({
          scheduleId: schedule.id,
          ...assignment,
          customStartTime: assignment.customStartTime || null,
          customEndTime: assignment.customEndTime || null,
          unpaidBreakMinutes: assignment.unpaidBreakMinutes ?? null,
          roleNote: assignment.roleNote || null,
          roleWorked: assignment.roleWorked || null,
          managerNote: assignment.managerNote || "AI draft",
        } as any).onConflictDoUpdate({
          target: [scheduleShiftAssignments.scheduleId, scheduleShiftAssignments.employeeId, scheduleShiftAssignments.shiftDate],
          set: {
            shiftTypeId: assignment.shiftTypeId,
            customStartTime: assignment.customStartTime || null,
            customEndTime: assignment.customEndTime || null,
            unpaidBreakMinutes: assignment.unpaidBreakMinutes ?? null,
            roleNote: assignment.roleNote || null,
            roleWorked: assignment.roleWorked || null,
            managerNote: assignment.managerNote || "AI draft",
            isOpenShift: assignment.isOpenShift,
            updatedAt: new Date(),
          } as any,
        });
        applied += 1;
      }
      await audit(schedule.id, req.scheduleUser.id, "schedule_ai_draft_applied", {
        applied,
        mode: parsed.data.mode,
        behavior: "upsert_only",
        cells: parsed.data.assignments.map((assignment) => ({
          employeeId: assignment.employeeId,
          shiftDate: assignment.shiftDate,
          shiftTypeId: assignment.shiftTypeId,
        })),
      });
      res.json(stripPrivateScheduleRates(await buildSchedulePayload(schedule.id), req.scheduleUser));
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/departments/:department/complete", requireScheduleManager, async (req: any, res, next) => {
    try {
      const schedule = await getScheduleOr404(req.params.id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      const department = normalizeDepartment(req.params.department);
      if (!REQUIRED_DEPARTMENTS.includes(department)) return res.status(400).json({ error: "Unknown required department." });
      if (!(await canManageDepartment(req.scheduleUser, department))) return res.status(403).json({ error: "You can only complete your assigned department." });
      const nextStatus = {
        ...(schedule.departmentStatusJson || {}),
        [department]: { completedAt: new Date().toISOString(), completedBy: req.scheduleUser.id },
      };
      const [updated] = await db.update(weeklySchedules).set({ departmentStatusJson: nextStatus, updatedAt: new Date() } as any).where(eq(weeklySchedules.id, schedule.id)).returning();
      await audit(schedule.id, req.scheduleUser.id, "schedule_department_completed", { department });
      res.json(stripPrivateScheduleRates(await buildSchedulePayload(updated.id), req.scheduleUser));
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/departments/:department/reopen", requireScheduleManager, async (req: any, res, next) => {
    try {
      const schedule = await getScheduleOr404(req.params.id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      const department = normalizeDepartment(req.params.department);
      if (!REQUIRED_DEPARTMENTS.includes(department)) return res.status(400).json({ error: "Unknown required department." });
      const isAdmin = publicScheduleUser(req.scheduleUser).isSuperAdmin;
      if (!isAdmin && !(await canManageDepartment(req.scheduleUser, department))) {
        return res.status(403).json({ error: "You can only reopen your assigned department." });
      }
      const currentStatus = (schedule.departmentStatusJson || {}) as Record<string, any>;
      const previous = currentStatus[department] || {};
      const nextDepartmentStatus = {
        ...previous,
        lastCompletedAt: previous.completedAt || previous.lastCompletedAt,
        lastCompletedBy: previous.completedBy || previous.lastCompletedBy,
        reopenedAt: new Date().toISOString(),
        reopenedBy: req.scheduleUser.id,
      };
      delete nextDepartmentStatus.completedAt;
      delete nextDepartmentStatus.completedBy;
      const nextStatus = {
        ...currentStatus,
        [department]: nextDepartmentStatus,
      };
      const [updated] = await db.update(weeklySchedules).set({ departmentStatusJson: nextStatus, updatedAt: new Date() } as any).where(eq(weeklySchedules.id, schedule.id)).returning();
      await audit(schedule.id, req.scheduleUser.id, "schedule_department_reopened", { department });
      res.json(stripPrivateScheduleRates(await buildSchedulePayload(updated.id), req.scheduleUser));
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/publish", requireScheduleManager, async (req: any, res, next) => {
    try {
      if (!publicScheduleUser(req.scheduleUser).isSuperAdmin) return res.status(403).json({ error: "Only GM/admin can publish the final schedule." });
      const current = await getScheduleOr404(req.params.id);
      if (!current) return res.status(404).json({ error: "Schedule not found" });
      const status = (current.departmentStatusJson || {}) as Record<string, any>;
      const missing = REQUIRED_DEPARTMENTS.filter((department) => !status[department]?.completedAt);
      if (missing.length) return res.status(409).json({ error: "All departments must be completed before final publish.", missingDepartments: missing });
      const [schedule] = await db.update(weeklySchedules).set({ status: "published", publishedAt: new Date(), updatedAt: new Date() }).where(eq(weeklySchedules.id, req.params.id)).returning();
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      const publishedAssignments = await db
        .select({ employeeId: scheduleShiftAssignments.employeeId, shiftDate: scheduleShiftAssignments.shiftDate, shiftTypeId: scheduleShiftAssignments.shiftTypeId })
        .from(scheduleShiftAssignments)
        .where(eq(scheduleShiftAssignments.scheduleId, schedule.id));
      await audit(schedule.id, req.scheduleUser.id, "schedule_published", {
        assignmentCount: publishedAssignments.length,
        cells: publishedAssignments.map((assignment) => ({
          employeeId: assignment.employeeId,
          shiftDate: assignment.shiftDate,
          shiftTypeId: assignment.shiftTypeId,
        })),
      });
      res.json(stripPrivateScheduleRates(await buildSchedulePayload(schedule.id), req.scheduleUser));
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/reopen", requireScheduleManager, async (req: any, res, next) => {
    try {
      if (!publicScheduleUser(req.scheduleUser).isSuperAdmin) return res.status(403).json({ error: "Only GM/admin can reopen the final schedule." });
      const reason = z.string().max(500).optional().parse(req.body?.reason || "");
      const [schedule] = await db.update(weeklySchedules).set({ status: "draft", updatedAt: new Date() }).where(eq(weeklySchedules.id, req.params.id)).returning();
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      await audit(schedule.id, req.scheduleUser.id, "schedule_reopened", { reason });
      res.json(stripPrivateScheduleRates(await buildSchedulePayload(schedule.id), req.scheduleUser));
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/archive", requireScheduleManager, async (req: any, res, next) => {
    try {
      if (!publicScheduleUser(req.scheduleUser).isSuperAdmin) return res.status(403).json({ error: "Only GM/admin can archive schedules." });
      const [schedule] = await db.update(weeklySchedules).set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() }).where(eq(weeklySchedules.id, req.params.id)).returning();
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      await audit(schedule.id, req.scheduleUser.id, "schedule_archived");
      res.json(stripPrivateScheduleRates(await buildSchedulePayload(schedule.id), req.scheduleUser));
    } catch (error) {
      next(error);
    }
  });

  router.get("/weeks/:id/pdf", requireScheduleAuth, async (req: any, res, next) => {
    try {
      const payload = await buildSchedulePayload(req.params.id);
      if (!payload) return res.status(404).json({ error: "Schedule not found" });
      if (!(await isScheduleManager(req.scheduleUser)) && payload.schedule.status !== "published") return res.status(403).json({ error: "Schedule is not published" });
      const visiblePayload = stripPrivateScheduleRates(payload, req.scheduleUser);
      const bytes = await renderSchedulePdf(visiblePayload);
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
      if (!(await isScheduleManager(req.scheduleUser)) && payload.schedule.status !== "published") return res.status(403).json({ error: "Schedule is not published" });
      await audit(payload.schedule.id, req.scheduleUser.id, "schedule_excel_exported");
      res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="courtyard-schedule-${payload.schedule.weekStartDate}.xls"`);
      res.send(renderScheduleExcelHtml(stripPrivateScheduleRates(payload, req.scheduleUser)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/weeks/:id/labor-performance", requireScheduleManager, async (req: any, res, next) => {
    try {
      const payload = await buildSchedulePayload(req.params.id);
      if (!payload) return res.status(404).json({ error: "Schedule not found" });
      const actualized = payload.forecast.some((day: any) => day.actualRoomsSold != null || day.actualRoomRevenue != null);
      if (!actualized) return res.status(409).json({ error: "Upload final actualized OTB production before downloading the labor performance report." });
      await audit(payload.schedule.id, req.scheduleUser.id, "schedule_labor_performance_exported");
      const bytes = await renderLaborPerformanceReportPdf(stripPrivateScheduleRates(payload, req.scheduleUser));
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="courtyard-labor-performance-${payload.schedule.weekStartDate}.pdf"`);
      res.send(bytes);
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/share-link", requireScheduleManager, async (req: any, res, next) => {
    try {
      if (!publicScheduleUser(req.scheduleUser).isSuperAdmin) return res.status(403).json({ error: "Only GM/admin can create schedule share links." });
      const schedule = await getScheduleOr404(req.params.id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      if (schedule.status !== "published") return res.status(400).json({ error: "Publish the schedule before sharing." });
      const { link, url } = await getOrCreateScheduleShareLink(schedule, req.scheduleUser.id);
      await audit(schedule.id, req.scheduleUser.id, "schedule_share_link_created");
      res.json({ link, url });
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/email", requireScheduleManager, async (req: any, res, next) => {
    try {
      if (!publicScheduleUser(req.scheduleUser).isSuperAdmin) return res.status(403).json({ error: "Only GM/admin can email the final schedule." });
      const schedule = await getScheduleOr404(req.params.id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });
      if (schedule.status !== "published") return res.status(400).json({ error: "Publish the schedule before emailing it." });

      const { url } = await getOrCreateScheduleShareLink(schedule, req.scheduleUser.id);
      const recipients = await getActiveScheduleRecipientEmails();
      const result = await sendPublishedScheduleEmails(schedule, url, recipients);
      await audit(schedule.id, req.scheduleUser.id, "schedule_published_email_sent", {
        recipientCount: recipients.length,
        sentCount: result.sent,
        failedCount: result.failed,
      });
      res.json({ url, recipientCount: recipients.length, sentCount: result.sent, failedCount: result.failed });
    } catch (error) {
      next(error);
    }
  });

  router.post("/weeks/:id/message-team", requireScheduleManager, async (req: any, res, next) => {
    try {
      if (!publicScheduleUser(req.scheduleUser).isSuperAdmin) return res.status(403).json({ error: "Only GM/admin can message the full team." });
      const parsed = scheduleTeamMessageSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid team message", validation: parsed.error.format() });
      const schedule = await getScheduleOr404(req.params.id);
      if (!schedule) return res.status(404).json({ error: "Schedule not found" });

      const { url } = await getOrCreateScheduleShareLink(schedule, req.scheduleUser.id);
      const recipients = await getActiveScheduleRecipientEmails();
      const result = await sendScheduleTeamMessage(schedule, url, recipients, parsed.data.subject, parsed.data.message, req.scheduleUser);
      await audit(schedule.id, req.scheduleUser.id, "schedule_team_message_sent", {
        recipientCount: recipients.length,
        sentCount: result.sent,
        failedCount: result.failed,
        subject: parsed.data.subject,
      });
      res.json({ url, recipientCount: recipients.length, sentCount: result.sent, failedCount: result.failed });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/schedule", router);
}
