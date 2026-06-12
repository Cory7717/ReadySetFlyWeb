import express, { type Express, type RequestHandler } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db";
import {
  courtyardBudgetAuditLog,
  courtyardBudgetCheckbookEntries,
  courtyardBudgetDepartmentForecasts,
  courtyardBudgetLineItems,
  courtyardBudgetUploads,
  scheduleEmployees,
  tipsUsers,
} from "@shared/schema";

const PROPERTY_ID = "courtyard-austin-lakeline";
const PROPERTY_NAME = "Courtyard Austin Lakeline";
const BUDGET_DEPARTMENTS = ["Bistro", "Market", "Front Desk", "Housekeeping", "Maintenance"] as const;
const BUDGET_ADMIN_EMAILS = new Set(
  (
    process.env.COURTYARD_BUDGET_ADMIN_EMAILS ||
    process.env.SCHEDULE_ADMIN_EMAILS ||
    process.env.TIPS_SUPER_ADMIN_EMAILS ||
    "coryarmer@gmail.com,cory.armer@marriott.com"
  )
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);
for (const email of ["coryarmer@gmail.com", "cory.armer@marriott.com"]) BUDGET_ADMIN_EMAILS.add(email);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".csv") || file.mimetype.includes("spreadsheet") || file.mimetype === "text/csv") return cb(null, true);
    cb(new Error("Only XLSX or CSV budget files are supported."));
  },
});

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function moneyNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "").replace(/[$,%(),]/g, "").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  const negative = /[()]/.test(String(value ?? ""));
  return Number.isFinite(n) ? (negative ? -Math.abs(n) : n) : 0;
}

function moneyString(value: unknown) {
  return moneyNumber(value).toFixed(2);
}

function pctString(value: unknown) {
  const n = moneyNumber(value);
  return Math.abs(n) > 1 ? (n / 100).toFixed(4) : n.toFixed(4);
}

function normalizeDepartment(value: unknown) {
  const raw = String(value || "").trim();
  const upper = raw.toUpperCase();
  if (upper === "RESTAURANT") return "Bistro / Restaurant";
  if (upper === "REPAIRS & MAINTENANCE") return "Repairs & Maintenance";
  if (upper === "ADMINISTRATIVE & GENERAL") return "Administrative & General";
  if (upper === "SALES & MARKETING") return "Sales & Marketing";
  if (upper === "INFORMATION AND TELECOMM") return "Information and Telecom";
  if (upper === "FRANCHISE & RELATED") return "Franchise & Related";
  if (upper === "NON-OPERATING INCOME & EXPENSE") return "Non-Operating Income & Expense";
  return raw
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bAnd\b/g, "&");
}

function departmentScopeForEmployee(employee: any) {
  const text = `${employee?.department || ""} ${employee?.position || ""} ${Array.isArray(employee?.rolesJson) ? employee.rolesJson.join(" ") : ""}`.toLowerCase();
  const departments = new Set<string>();
  if (text.includes("bistro") || text.includes("breakfast")) departments.add("Bistro");
  if (text.includes("market") || text.includes("pantry") || text.includes("shop")) departments.add("Market");
  if (text.includes("front desk") || text.includes("night audit") || text.includes("guest services")) {
    departments.add("Front Desk");
    departments.add("Market");
  }
  if (text.includes("housekeeping") || text.includes("room attendant") || text.includes("laundry") || text.includes("houseperson")) departments.add("Housekeeping");
  if (text.includes("maintenance") || text.includes("engineering")) departments.add("Maintenance");
  return Array.from(departments);
}

function publicUser(user: any) {
  const email = normalizeEmail(user.email);
  const isSuperAdmin = BUDGET_ADMIN_EMAILS.has(email) || user.role === "super_admin";
  return {
    id: user.id,
    email,
    employeeDisplayName: user.employeeDisplayName,
    isSuperAdmin,
  };
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

async function getBudgetAccess(user: any) {
  const base = publicUser(user);
  if (base.isSuperAdmin) {
    return { ...base, canAccessBudget: true, canUpload: true, canEditForecast: true, departments: [...BUDGET_DEPARTMENTS], allDepartments: true };
  }
  const [employee] = await db
    .select()
    .from(scheduleEmployees)
    .where(eq(scheduleEmployees.email, base.email))
    .limit(1);
  const managerText = `${employee?.position || ""} ${Array.isArray(employee?.rolesJson) ? employee.rolesJson.join(" ") : ""}`.toLowerCase();
  const isDepartmentHead = Boolean(employee?.isDepartmentManager || managerText.includes("manager") || managerText.includes("supervisor") || managerText.includes("executive housekeeper") || managerText.includes("exec hk"));
  const departments = isDepartmentHead ? departmentScopeForEmployee(employee) : [];
  return { ...base, canAccessBudget: departments.length > 0, canUpload: false, canEditForecast: false, departments, allDepartments: false };
}

const requireBudgetAccess: RequestHandler = async (req: any, res, next) => {
  try {
    const user = await getUserBySession(req);
    if (!user || user.disabledAt) return res.status(401).json({ error: "Courtyard login required." });
    if (user.mustChangePassword) return res.status(403).json({ error: "Password change required.", code: "PASSWORD_CHANGE_REQUIRED" });
    const access = await getBudgetAccess(user);
    if (!access.canAccessBudget) return res.status(403).json({ error: "Budget access is limited to designated department heads." });
    req.budgetUser = user;
    req.budgetAccess = access;
    next();
  } catch (error) {
    next(error);
  }
};

function requestedDepartment(req: any) {
  const requested = String(req.query.department || req.body?.department || "").trim();
  const access = req.budgetAccess;
  if (access.allDepartments) return BUDGET_DEPARTMENTS.includes(requested as any) ? requested : access.departments[0] || "Bistro";
  if (!requested) return access.departments[0];
  return access.departments.includes(requested) ? requested : null;
}

function sourceDepartmentForBudgetView(department: string) {
  if (department === "Bistro") return "Bistro / Restaurant";
  if (department === "Market") return "Shop";
  if (department === "Housekeeping" || department === "Front Desk") return "Rooms";
  if (department === "Maintenance") return "Repairs & Maintenance";
  return department;
}

function revenueDepartmentForBudgetView(department: string) {
  if (department === "Maintenance") return "Rooms";
  return sourceDepartmentForBudgetView(department);
}

function revenuePatternForBudgetView(department: string) {
  if (department === "Bistro") return /total restaurant revenue/i;
  if (department === "Market") return /total shop revenue/i;
  return /total rooms revenue/i;
}

function revenueLabelForBudgetView(department: string) {
  if (department === "Bistro") return "Bistro revenue";
  if (department === "Market") return "Market revenue";
  return "Rooms revenue";
}

function isDepartmentExpenseLine(department: string, line: any) {
  if (line.isTotal || line.categoryType === "revenue" || line.categoryType === "labor") return false;
  const item = String(line.lineItem || "").toLowerCase();
  if (/(administrative|information|telecom|minor operated|miscellaneous|\bmisc\b)/.test(item)) return false;
  if (department === "Housekeeping") {
    return /(cleaning supplies|guest supplies|laundry supplies|linen|uniform|housekeeping supplies|operating supplies|amenities|room supplies|paper supplies)/.test(item);
  }
  if (department === "Bistro") {
    return /(^food$|^beverage$|cost of food|food cost|cost of sales|beverage cost|non.?consumable|inventory|restaurant supplies|supplies.*restaurant|paper supplies|cleaning supplies|smallwares|china|glass|silver|linen)/.test(item);
  }
  if (department === "Market") {
    return /(food & sundries|cost of sales|food cost|beverage cost|shop supplies|market supplies|pantry supplies|non.?consumable|inventory|paper supplies|smallwares)/.test(item);
  }
  if (department === "Front Desk") {
    return /(key card|front desk supplies|front office supplies|guest recovery|guest transportation|guest relocation|printing|paper supplies|office supplies)/.test(item);
  }
  if (department === "Maintenance") {
    return /(building|hvac|electrical|painting|grounds|plumbing|pool|engineering supplies|kitchen equipment|waste removal|fire life|exterminating|repair|maintenance supplies|parts)/.test(item);
  }
  return false;
}

function revenueTotal(lines: any[], preferredPattern: RegExp) {
  const preferred = lines.find((line) => preferredPattern.test(String(line.lineItem || "")) && line.isTotal)
    || lines.find((line) => preferredPattern.test(String(line.lineItem || "")));
  if (preferred) {
    return {
      budget: Math.abs(moneyNumber(preferred.originalBudgetAmount)),
      actual: Math.abs(moneyNumber(preferred.actualAmount)),
    };
  }
  const revenue = lines.filter((line) => line.categoryType === "revenue" && !line.isTotal);
  return {
    budget: Math.abs(revenue.reduce((sum, line) => sum + moneyNumber(line.originalBudgetAmount), 0)),
    actual: Math.abs(revenue.reduce((sum, line) => sum + moneyNumber(line.actualAmount), 0)),
  };
}

function categoryKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isSensitiveLine(lineItem: string, department: string) {
  const text = `${lineItem} ${department}`.toLowerCase();
  return /(general manager|\bgm\b|director of sales|\bdos\b|supervisor|management wages|manager salary|salary|owner|franchise|non-operating|payroll related)/i.test(text);
}

function classifyLine(lineItem: string, actual: number, budget: number) {
  const text = lineItem.toLowerCase();
  if (/room revenue|restaurant|food|beverage|meeting|shop|income|revenue|sales/.test(text) && (actual < 0 || budget < 0 || /revenue|sales|income/.test(text))) return "revenue";
  if (/wage|payroll|labor|salary|bonus|tax/.test(text)) return "labor";
  if (/cost of sales|food cost|beverage|supplies|linen|guest supplies|cleaning/.test(text)) return "variable";
  if (/utilities|maintenance|repair|contract|telephone/.test(text)) return "semi-variable";
  if (/rent|insurance|license|fee|franchise/.test(text)) return "fixed";
  return "controllable";
}

function isTotalLine(lineItem: string) {
  return /^total\b|total$|\btotal\b/i.test(lineItem);
}

function isOperationalBudgetLine(line: any) {
  const item = String(line.lineItem || "").toLowerCase();
  const department = String(line.department || "").toLowerCase();
  if (/credit card|commission|bonus|benefit|paid time off|payroll service|workers comp|epli|dues|subscription|license|permit|uniform|postage|printing|office|training|relocation|transportation|television|cable|vendor discount|employee benefits|supplemental pay|management wages|payroll taxes|franchise|owner|non-operating/.test(item)) return false;
  if (department.includes("bistro") || department.includes("restaurant")) {
    return /total restaurant revenue|food revenue|restaurant$|banquet$|beer$|wine$|liquor$|total beverage revenue|food$|beverage$|cost of sales|bartenders|supplies - restaurant|paper supplies|cleaning supplies|total restaurant expenses|restaurant department profit/.test(item);
  }
  if (department === "rooms") {
    return /total rooms revenue|room rev|pet fees|front desk$|night audit|housekeeping$|laundry wages|houseman|guest supplies|cleaning supplies|laundry supplies|linen|key card|total rooms expenses|rooms department profit/.test(item);
  }
  if (department.includes("shop")) {
    return /food & sundries|beer rev|wine rev|total shop revenue|food$|beverage$|total cost of sales|shop supplies|total shop expenses|shop department profit/.test(item);
  }
  if (department.includes("meeting")) {
    return /meeting room rental|audio visual|total meeting room revenue|meeting room supplies|total meeting room expenses|meeting room department profit/.test(item);
  }
  if (department.includes("repairs") || department.includes("maintenance")) {
    return /total repairs|building|hvac|electrical|painting|grounds|plumbing|pool|engineering supplies|kitchen equipment|waste removal|fire life|exterminating/.test(item);
  }
  if (department.includes("utilities")) {
    return /electricity|gas|water|sewer|total utilities/.test(item);
  }
  return isTotalLine(item);
}

function operationalSectionForLine(line: any) {
  const item = String(line.lineItem || "").toLowerCase();
  const department = String(line.department || "");
  if (department === "Rooms") {
    if (/front desk|night audit|key card/.test(item)) return "Front Desk";
    if (/housekeeping|laundry|houseman|guest supplies|cleaning supplies|laundry supplies|linen/.test(item)) return "Housekeeping";
    return "Rooms";
  }
  if (department === "Bistro / Restaurant") return "Bistro";
  if (department === "Shop") return "Market / Pantry";
  return department;
}

type ParsedBudgetLine = {
  department: string;
  sourceSheet: string;
  lineItem: string;
  coa: string | null;
  actualAmount: string;
  actualPercent: string;
  originalBudgetAmount: string;
  originalBudgetPercent: string;
  updatedForecastAmount: string;
  priorYearAmount: string;
  priorYearPercent: string;
  ytdActualAmount: string;
  ytdActualPercent: string;
  ytdBudgetAmount: string;
  ytdBudgetPercent: string;
  categoryType: string;
  visibilityLevel: string;
  isSensitive: boolean;
  isHiddenFromDepartmentHead: boolean;
  isTotal: boolean;
};

function buildLine(sourceSheet: string, cells: string[]): ParsedBudgetLine | null {
  const lineItem = String(cells[0] || "").trim();
  if (!lineItem || /^document map$/i.test(lineItem)) return null;
  const actual = moneyNumber(cells[4]);
  const budget = moneyNumber(cells[6]);
  const prior = moneyNumber(cells[8]);
  const ytdActual = moneyNumber(cells[10]);
  const ytdBudget = moneyNumber(cells[12]);
  if (![actual, budget, prior, ytdActual, ytdBudget].some((n) => Math.abs(n) > 0) && !isTotalLine(lineItem)) return null;
  const department = normalizeDepartment(sourceSheet);
  const sensitive = isSensitiveLine(lineItem, department);
  const categoryType = classifyLine(lineItem, actual, budget);
  return {
    department,
    sourceSheet,
    lineItem,
    coa: String(cells[1] || "").trim() || null,
    actualAmount: moneyString(actual),
    actualPercent: pctString(cells[5]),
    originalBudgetAmount: moneyString(budget),
    originalBudgetPercent: pctString(cells[7]),
    updatedForecastAmount: moneyString(budget),
    priorYearAmount: moneyString(prior),
    priorYearPercent: pctString(cells[9]),
    ytdActualAmount: moneyString(ytdActual),
    ytdActualPercent: pctString(cells[11]),
    ytdBudgetAmount: moneyString(ytdBudget),
    ytdBudgetPercent: pctString(cells[13]),
    categoryType,
    visibilityLevel: sensitive ? "admin" : "department",
    isSensitive: sensitive,
    isHiddenFromDepartmentHead: sensitive,
    isTotal: isTotalLine(lineItem),
  };
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

function parseXlsx(buffer: Buffer): ParsedBudgetLine[] {
  const zip = new AdmZip(buffer);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false });
  const entry = (name: string) => zip.getEntry(name)?.getData().toString("utf8") || "";
  const workbook = parser.parse(entry("xl/workbook.xml"));
  const rels = parser.parse(entry("xl/_rels/workbook.xml.rels"));
  const sharedXml = entry("xl/sharedStrings.xml");
  const shared = sharedXml ? ([] as any[]).concat(parser.parse(sharedXml).sst?.si || []).map((si) => readInlineText(si) || String(si.t || "")) : [];
  const relMap = new Map(([] as any[]).concat(rels.Relationships?.Relationship || []).map((rel) => [rel["@_Id"], String(rel["@_Target"]).replace(/^\//, "")]));
  const sheets = ([] as any[]).concat(workbook.workbook?.sheets?.sheet || []);
  const ignored = new Set(["DOCUMENT MAP", "SUMMARY"]);
  const lines: ParsedBudgetLine[] = [];
  for (const sheet of sheets) {
    const sheetName = String(sheet["@_name"] || "");
    if (!sheetName || ignored.has(sheetName.toUpperCase())) continue;
    const target = relMap.get(sheet["@_r:id"]);
    if (!target) continue;
    const xml = entry(String(target));
    if (!xml) continue;
    const parsed = parser.parse(xml);
    const rows = ([] as any[]).concat(parsed.worksheet?.sheetData?.row || []);
    for (const row of rows) {
      const cells: string[] = [];
      for (const cell of ([] as any[]).concat(row.c || [])) {
        const value = cell["@_t"] === "s" ? shared[Number(cell.v)] || "" : cell["@_t"] === "inlineStr" ? readInlineText(cell.is) : String(cell.v ?? "");
        cells[colIndex(cell["@_r"])] = value;
      }
      const line = buildLine(sheetName, cells);
      if (line) lines.push(line);
    }
  }
  return lines;
}

function parseCsv(text: string): ParsedBudgetLine[] {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim()).map((line) => {
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
  const header = rows[0]?.map((h) => h.toLowerCase()) || [];
  const find = (...patterns: string[]) => header.findIndex((h) => patterns.every((p) => h.includes(p)));
  const idx = {
    department: find("department"),
    line: find("line"),
    coa: find("coa"),
    actual: find("actual", "$"),
    actualPct: find("actual", "%"),
    budget: find("budget", "$"),
    budgetPct: find("budget", "%"),
    prior: find("prior", "$"),
    priorPct: find("prior", "%"),
    ytdActual: find("ytd", "actual", "$"),
    ytdActualPct: find("ytd", "actual", "%"),
    ytdBudget: find("ytd", "budget", "$"),
    ytdBudgetPct: find("ytd", "budget", "%"),
  };
  return rows.slice(1).map((row) => buildLine(row[idx.department] || "Imported", [
    row[idx.line] || row[0],
    row[idx.coa] || "",
    "", "",
    row[idx.actual] || "0",
    row[idx.actualPct] || "0",
    row[idx.budget] || "0",
    row[idx.budgetPct] || "0",
    row[idx.prior] || "0",
    row[idx.priorPct] || "0",
    row[idx.ytdActual] || "0",
    row[idx.ytdActualPct] || "0",
    row[idx.ytdBudget] || "0",
    row[idx.ytdBudgetPct] || "0",
  ])).filter(Boolean) as ParsedBudgetLine[];
}

function parseBudgetFile(file: Express.Multer.File) {
  if (file.originalname.toLowerCase().endsWith(".csv")) return parseCsv(file.buffer.toString("utf8"));
  return parseXlsx(file.buffer);
}

function departmentTotals(lines: any[], checkbook: any[]) {
  const nonTotal = lines.filter((line) => !line.isTotal);
  const revenue = nonTotal.filter((line) => line.categoryType === "revenue");
  const expenses = nonTotal.filter((line) => line.categoryType !== "revenue");
  const sum = (rows: any[], field: string) => rows.reduce((total, row) => total + moneyNumber(row[field]), 0);
  const checkbookSpend = checkbook.reduce((total, entry) => total + moneyNumber(entry.amount), 0);
  const originalRevenue = Math.abs(sum(revenue, "originalBudgetAmount"));
  const updatedRevenue = Math.abs(sum(revenue, "updatedForecastAmount"));
  const actualRevenue = Math.abs(sum(revenue, "actualAmount"));
  const expenseBudget = Math.abs(sum(expenses, "originalBudgetAmount"));
  const expenseForecast = Math.abs(sum(expenses, "updatedForecastAmount"));
  const actualExpense = Math.abs(sum(expenses, "actualAmount"));
  return {
    originalRevenue: moneyString(originalRevenue),
    updatedRevenue: moneyString(updatedRevenue),
    actualRevenue: moneyString(actualRevenue),
    expenseBudget: moneyString(expenseBudget),
    expenseForecast: moneyString(expenseForecast),
    actualExpense: moneyString(actualExpense),
    checkbookSpend: moneyString(checkbookSpend),
    remainingBudget: moneyString(expenseForecast - actualExpense - checkbookSpend),
    variance: moneyString(updatedRevenue - originalRevenue - (expenseForecast - expenseBudget)),
  };
}

function sectionTotals(lines: any[]) {
  const revenue = lines.filter((line) => line.categoryType === "revenue");
  const expenses = lines.filter((line) => line.categoryType !== "revenue");
  const sum = (rows: any[], field: string) => rows.reduce((total, row) => total + moneyNumber(row[field]), 0);
  return {
    originalBudget: moneyString(Math.abs(sum(lines, "originalBudgetAmount"))),
    actual: moneyString(Math.abs(sum(lines, "actualAmount"))),
    forecast: moneyString(Math.abs(sum(lines, "updatedForecastAmount"))),
    revenue: moneyString(Math.abs(sum(revenue, "updatedForecastAmount"))),
    expenses: moneyString(Math.abs(sum(expenses, "updatedForecastAmount"))),
  };
}

function buildOperationalSections(lines: any[]) {
  const grouped = new Map<string, any[]>();
  for (const line of lines.filter(isOperationalBudgetLine)) {
    const section = operationalSectionForLine(line);
    if (!grouped.has(section)) grouped.set(section, []);
    grouped.get(section)!.push(line);
  }
  const order = ["Rooms", "Front Desk", "Housekeeping", "Bistro", "Market / Pantry", "Meeting Room", "Repairs & Maintenance", "Utilities"];
  return Array.from(grouped.entries())
    .sort(([a], [b]) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)) || a.localeCompare(b))
    .map(([section, rows]) => ({
      section,
      totals: sectionTotals(rows),
      lines: rows.map((line) => ({
        id: line.id,
        lineItem: line.lineItem,
        coa: line.coa,
        categoryType: line.categoryType,
        actualAmount: moneyString(line.actualAmount),
        originalBudgetAmount: moneyString(line.originalBudgetAmount),
        updatedForecastAmount: moneyString(line.updatedForecastAmount),
        isTotal: line.isTotal,
      })),
    }));
}

const uploadSchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  confirmOverwrite: z.coerce.boolean().default(false),
});

function detectBudgetPeriodFromFilename(fileName: string) {
  const matches = Array.from(fileName.matchAll(/(\d{2})(\d{2})(\d{4})/g));
  for (const match of matches) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= 2100) {
      return { month, year };
    }
  }
  const monthName = fileName.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i)?.[1];
  const year = Number(fileName.match(/\b(20\d{2})\b/)?.[1]);
  if (monthName && year >= 2020 && year <= 2100) {
    const month = new Date(`${monthName} 1, ${year}`).getMonth() + 1;
    return { month, year };
  }
  return null;
}

const checkbookSchema = z.object({
  department: z.string().trim().min(1),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendor: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  amount: z.coerce.number().min(0).max(1000000),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
});

const forecastSchema = z.object({
  department: z.string().trim().min(1),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  forecastRevenue: z.coerce.number().min(0).max(100000000),
});

export function registerCourtyardBudgetRoutes(app: Express) {
  const router = express.Router();

  router.get("/me", async (req: any, res, next) => {
    try {
      const user = await getUserBySession(req);
      if (!user || user.disabledAt) return res.status(401).json({ user: null, error: "Courtyard login required." });
      res.json({ user: await getBudgetAccess(user) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/months", requireBudgetAccess, async (_req: any, res, next) => {
    try {
      const rows = await db.selectDistinct({ month: courtyardBudgetUploads.month, year: courtyardBudgetUploads.year }).from(courtyardBudgetUploads).orderBy(asc(courtyardBudgetUploads.year), asc(courtyardBudgetUploads.month));
      res.json({ months: rows });
    } catch (error) {
      next(error);
    }
  });

  router.post("/upload", requireBudgetAccess, (req: any, res, next) => {
    upload.single("budgetFile")(req, res, (error: any) => {
      if (!error) return next();
      return res.status(400).json({ error: error?.message || "Budget upload failed." });
    });
  }, async (req: any, res, next) => {
    try {
      if (!req.budgetAccess.canUpload) return res.status(403).json({ error: "Only GM/admin can upload budgets." });
      const parsed = uploadSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid month/year." });
      if (!req.file) return res.status(400).json({ error: "Budget file is required." });
      const detectedPeriod = detectBudgetPeriodFromFilename(req.file.originalname);
      const month = detectedPeriod?.month ?? parsed.data.month;
      const year = detectedPeriod?.year ?? parsed.data.year;
      if (!month || !year) return res.status(400).json({ error: "Could not determine the budget month/year from the file name. Select a month/year before uploading." });
      const existing = await db.select().from(courtyardBudgetUploads).where(and(eq(courtyardBudgetUploads.propertyId, PROPERTY_ID), eq(courtyardBudgetUploads.month, month), eq(courtyardBudgetUploads.year, year))).limit(1);
      if (existing.length && !parsed.data.confirmOverwrite) return res.status(409).json({ error: "Budget already exists for this month. Confirm overwrite to replace it." });
      if (existing.length) {
        await db.delete(courtyardBudgetUploads).where(and(eq(courtyardBudgetUploads.propertyId, PROPERTY_ID), eq(courtyardBudgetUploads.month, month), eq(courtyardBudgetUploads.year, year)));
      }
      const lines = parseBudgetFile(req.file);
      const [uploadRow] = await db.insert(courtyardBudgetUploads).values({
        propertyId: PROPERTY_ID,
        month,
        year,
        originalFileName: req.file.originalname,
        uploadedBy: req.budgetUser.id,
      }).returning();
      if (lines.length) {
        await db.insert(courtyardBudgetLineItems).values(lines.map((line) => ({
          ...line,
          budgetUploadId: uploadRow.id,
          propertyId: PROPERTY_ID,
          month,
          year,
        } as any)));
      }
      await db.insert(courtyardBudgetAuditLog).values({ actorUserId: req.budgetUser.id, action: "budget_uploaded", month, year, metadataJson: { file: req.file.originalname, rows: lines.length, detectedPeriod } });
      res.status(201).json({ upload: uploadRow, rows: lines.length, detectedPeriod: { month, year } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/summary", requireBudgetAccess, async (req: any, res, next) => {
    try {
      const month = Number(req.query.month || new Date().getMonth() + 1);
      const year = Number(req.query.year || new Date().getFullYear());
      const department = requestedDepartment(req);
      if (!department) return res.status(403).json({ error: "You do not have access to that budget department." });
      const sourceDepartment = sourceDepartmentForBudgetView(department);
      const revenueDepartment = revenueDepartmentForBudgetView(department);
      const [sourceLines, revenueLines, checkbook, forecastRows] = await Promise.all([
        db.select().from(courtyardBudgetLineItems).where(and(
          eq(courtyardBudgetLineItems.propertyId, PROPERTY_ID),
          eq(courtyardBudgetLineItems.month, month),
          eq(courtyardBudgetLineItems.year, year),
          eq(courtyardBudgetLineItems.department, sourceDepartment),
        )).orderBy(asc(courtyardBudgetLineItems.lineItem)),
        revenueDepartment !== sourceDepartment
          ? db.select().from(courtyardBudgetLineItems).where(and(
              eq(courtyardBudgetLineItems.propertyId, PROPERTY_ID),
              eq(courtyardBudgetLineItems.month, month),
              eq(courtyardBudgetLineItems.year, year),
              eq(courtyardBudgetLineItems.department, revenueDepartment),
            ))
          : Promise.resolve(null),
        db.select().from(courtyardBudgetCheckbookEntries).where(and(
          eq(courtyardBudgetCheckbookEntries.propertyId, PROPERTY_ID),
          eq(courtyardBudgetCheckbookEntries.month, month),
          eq(courtyardBudgetCheckbookEntries.year, year),
          eq(courtyardBudgetCheckbookEntries.department, department),
        )).orderBy(asc(courtyardBudgetCheckbookEntries.entryDate)),
        db.select().from(courtyardBudgetDepartmentForecasts).where(and(
          eq(courtyardBudgetDepartmentForecasts.propertyId, PROPERTY_ID),
          eq(courtyardBudgetDepartmentForecasts.month, month),
          eq(courtyardBudgetDepartmentForecasts.year, year),
          eq(courtyardBudgetDepartmentForecasts.department, department),
        )).limit(1),
      ]);
      const revenue = revenueTotal(revenueLines || sourceLines, revenuePatternForBudgetView(department));
      const forecastRevenue = forecastRows.length ? moneyNumber(forecastRows[0].forecastRevenue) : revenue.budget;
      const scale = revenue.budget > 0 ? forecastRevenue / revenue.budget : 1;
      const expenseLines = sourceLines.filter((line) => isDepartmentExpenseLine(department, line));
      const spentByCategory = new Map<string, number>();
      checkbook.forEach((entry) => {
        const key = categoryKey(entry.category);
        spentByCategory.set(key, (spentByCategory.get(key) || 0) + moneyNumber(entry.amount));
      });
      const expenses = expenseLines.map((line) => {
        const budgetAmount = Math.abs(moneyNumber(line.originalBudgetAmount));
        const forecastAmount = budgetAmount * scale;
        const key = categoryKey(line.lineItem);
        let spent = spentByCategory.get(key) || 0;
        if (!spent) {
          const matched = Array.from(spentByCategory.entries()).find(([entryKey]) => entryKey.includes(key) || key.includes(entryKey));
          spent = matched?.[1] || 0;
        }
        return {
          id: line.id,
          category: line.lineItem,
          budgetAmount: moneyString(budgetAmount),
          forecastAmount: moneyString(forecastAmount),
          spentAmount: moneyString(spent),
          remainingAmount: moneyString(forecastAmount - spent),
        };
      });
      const totalExpenseBudget = expenses.reduce((sum, line) => sum + moneyNumber(line.budgetAmount), 0);
      const totalExpenseForecast = expenses.reduce((sum, line) => sum + moneyNumber(line.forecastAmount), 0);
      const totalSpent = checkbook.reduce((sum, entry) => sum + moneyNumber(entry.amount), 0);
      res.json({
        propertyName: PROPERTY_NAME,
        month,
        year,
        department,
        departments: req.budgetAccess.departments,
        user: req.budgetAccess,
        revenue: {
          label: revenueLabelForBudgetView(department),
          budgetAmount: moneyString(revenue.budget),
          actualAmount: moneyString(revenue.actual),
          forecastAmount: moneyString(forecastRevenue),
        },
        totals: {
          expenseBudget: moneyString(totalExpenseBudget),
          expenseForecast: moneyString(totalExpenseForecast),
          checkbookSpend: moneyString(totalSpent),
          remainingBudget: moneyString(totalExpenseForecast - totalSpent),
        },
        expenses,
        checkbook: checkbook.map((entry) => ({ ...entry, amount: moneyString(entry.amount) })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/checkbook", requireBudgetAccess, async (req: any, res, next) => {
    try {
      const parsed = checkbookSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid checkbook entry", validation: parsed.error.format() });
      const department = parsed.data.department.trim();
      if (!req.budgetAccess.allDepartments && !req.budgetAccess.departments.includes(department)) return res.status(403).json({ error: "You cannot add checkbook entries for that department." });
      const [entry] = await db.insert(courtyardBudgetCheckbookEntries).values({
        propertyId: PROPERTY_ID,
        department,
        month: parsed.data.month,
        year: parsed.data.year,
        entryDate: parsed.data.entryDate,
        vendor: parsed.data.vendor,
        category: parsed.data.category,
        description: parsed.data.description || null,
        amount: parsed.data.amount.toFixed(2),
        enteredBy: req.budgetUser.id,
      }).returning();
      await db.insert(courtyardBudgetAuditLog).values({ actorUserId: req.budgetUser.id, action: "checkbook_entry_created", department, month: parsed.data.month, year: parsed.data.year, metadataJson: { amount: parsed.data.amount, vendor: parsed.data.vendor } });
      res.status(201).json({ entry: { ...entry, amount: moneyString(entry.amount) } });
    } catch (error) {
      next(error);
    }
  });

  router.post("/forecast-adjustment", requireBudgetAccess, async (req: any, res, next) => {
    try {
      if (!req.budgetAccess.canEditForecast) return res.status(403).json({ error: "Only GM/admin can edit forecasts." });
      const parsed = forecastSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid forecast adjustment", validation: parsed.error.format() });
      const department = parsed.data.department.trim();
      if (!BUDGET_DEPARTMENTS.includes(department as any)) return res.status(400).json({ error: "Unsupported department." });
      await db.insert(courtyardBudgetDepartmentForecasts).values({
        propertyId: PROPERTY_ID,
        department,
        month: parsed.data.month,
        year: parsed.data.year,
        forecastRevenue: parsed.data.forecastRevenue.toFixed(2),
        updatedBy: req.budgetUser.id,
      }).onConflictDoUpdate({
        target: [
          courtyardBudgetDepartmentForecasts.propertyId,
          courtyardBudgetDepartmentForecasts.year,
          courtyardBudgetDepartmentForecasts.month,
          courtyardBudgetDepartmentForecasts.department,
        ],
        set: {
          forecastRevenue: parsed.data.forecastRevenue.toFixed(2),
          updatedBy: req.budgetUser.id,
          updatedAt: new Date(),
        },
      });
      await db.insert(courtyardBudgetAuditLog).values({ actorUserId: req.budgetUser.id, action: "forecast_adjusted", department, month: parsed.data.month, year: parsed.data.year, metadataJson: parsed.data });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/export.csv", requireBudgetAccess, async (req: any, res, next) => {
    try {
      const department = requestedDepartment(req);
      if (!department) return res.status(403).json({ error: "You do not have access to that budget department." });
      const month = Number(req.query.month || new Date().getMonth() + 1);
      const year = Number(req.query.year || new Date().getFullYear());
      const lines = await db.select().from(courtyardBudgetLineItems).where(and(
        eq(courtyardBudgetLineItems.propertyId, PROPERTY_ID),
        eq(courtyardBudgetLineItems.month, month),
        eq(courtyardBudgetLineItems.year, year),
        eq(courtyardBudgetLineItems.department, sourceDepartmentForBudgetView(department)),
      )).orderBy(asc(courtyardBudgetLineItems.lineItem));
      const visible = lines.filter((line) => isDepartmentExpenseLine(department, line));
      const csv = [
        ["Department", "Expense Category", "Budget"].join(","),
        ...visible.map((line) => [department, line.lineItem, moneyString(Math.abs(moneyNumber(line.originalBudgetAmount)))].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="courtyard-budget-${year}-${String(month).padStart(2, "0")}-${department.replace(/[^a-z0-9]+/gi, "-")}.csv"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/courtyard/budget", router);
}
