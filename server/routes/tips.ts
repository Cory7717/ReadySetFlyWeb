import express, { type Express, type RequestHandler } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import bcrypt from "bcrypt";
import { z } from "zod";
import { createRequire } from "module";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "../db";
import { createSoftAuthRateLimiter } from "../middleware/rateLimit";
import { getUncachableResendClient } from "../resendClient";
import {
  tipAdminActions,
  bistroFoodWasteEntries,
  bistroFoodCostItems,
  tipDailyReportAttachments,
  tipEntries,
  tipEntryAttachments,
  tipBanquetReports,
  tipGridDaySummaries,
  tipGridSubmissions,
  tipPeriodSubmissions,
  tipsKioskSettings,
  tipsUsers,
  scheduleEmployees,
} from "@shared/schema";

const require = createRequire(import.meta.url);
const invoiceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 }, fileFilter: (_req, file, cb) => file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname) ? cb(null, true) : cb(new Error("Upload a PDF vendor invoice.")) });

const TIPS_SUPER_ADMIN_EMAILS = new Set(
  (process.env.TIPS_SUPER_ADMIN_EMAILS || "coryarmer@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

const foodWasteEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  foodItem: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().positive().max(100000),
  unit: z.string().trim().max(40).optional().default(""),
  reason: z.enum(["expired", "spoiled", "shift_meal"]),
  totalCost: z.coerce.number().min(0).max(1000000),
  unitCost: z.coerce.number().min(0).max(1000000).nullable().optional(),
  catalogItemId: z.string().uuid().nullable().optional(),
  employeeMealRecipeId: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(1000).optional().default(""),
});

type EmployeeMealIngredient = { name: string; quantity: number; unit: string; aliases: string[] };
type EmployeeMealRecipe = { id: string; name: string; sourceRecipe: string; ingredients: EmployeeMealIngredient[] };

export const EMPLOYEE_MEAL_RECIPES: EmployeeMealRecipe[] = [
  { id: "breakfast-burrito", name: "Breakfast Burrito", sourceRecipe: "Breakfast Quesadilla", ingredients: [
    { name: "Liquid whole egg", quantity: 4, unit: "fl oz", aliases: ["liquid whole egg", "whole egg", "egg liquid"] },
    { name: "12-inch flour tortilla", quantity: 1, unit: "each", aliases: ["12 tortilla", "flour tortilla", "tortilla"] },
    { name: "Bacon", quantity: 2, unit: "slice", aliases: ["bacon"] },
    { name: "Jack cheese", quantity: 3, unit: "tbsp", aliases: ["jack cheese", "monterey jack"] },
    { name: "White cheddar", quantity: 1, unit: "slice", aliases: ["white cheddar", "cheddar slice"] },
    { name: "Garlic aioli", quantity: 1, unit: "tbsp", aliases: ["garlic aioli", "aioli"] },
    { name: "Diced green chiles", quantity: 1, unit: "tbsp", aliases: ["green chile", "green chili"] },
    { name: "Salsa", quantity: 3, unit: "tbsp", aliases: ["salsa"] },
    { name: "Avocado mash", quantity: 3, unit: "tbsp", aliases: ["avocado mash", "avocado"] },
  ] },
  { id: "hamburger", name: "Hamburger", sourceRecipe: "The Bistro Burger (Beyond Meat)", ingredients: [
    { name: "Burger patty", quantity: 1, unit: "each", aliases: ["burger patty", "beyond burger", "beef patty"] },
    { name: "White cheddar", quantity: 1, unit: "slice", aliases: ["white cheddar", "cheddar slice"] },
    { name: "Brioche bun", quantity: 1, unit: "each", aliases: ["brioche bun", "brioche roll", "hamburger bun"] },
    { name: "Garlic aioli", quantity: 2, unit: "tbsp", aliases: ["garlic aioli", "aioli"] },
    { name: "Tomato", quantity: 2, unit: "slice", aliases: ["tomato"] },
    { name: "Romaine lettuce", quantity: 2.5, unit: "each", aliases: ["romaine", "lettuce"] },
    { name: "French fries", quantity: 6, unit: "oz", aliases: ["french fries", "seashore fries", "potato fries"] },
    { name: "Ketchup", quantity: 3, unit: "tbsp", aliases: ["ketchup"] },
  ] },
  { id: "pepperoni-flatbread", name: "Pepperoni Flatbread", sourceRecipe: "Meatball Flatbread", ingredients: [
    { name: "Oval flatbread", quantity: 1, unit: "each", aliases: ["oval flatbread", "flatbread"] },
    { name: "Marinara sauce", quantity: 3, unit: "tbsp", aliases: ["marinara"] },
    { name: "Roasted tomatoes", quantity: 1.5, unit: "oz", aliases: ["roasted tomato", "tomato"] },
    { name: "Parmesan", quantity: 4, unit: "tbsp", aliases: ["parmesan"] },
    { name: "Jack cheese", quantity: 0.25, unit: "cup", aliases: ["jack cheese", "monterey jack"] },
    { name: "Meatballs", quantity: 4, unit: "each", aliases: ["meatball"] },
    { name: "Basil pesto", quantity: 1, unit: "tbsp", aliases: ["basil pesto", "pesto"] },
    { name: "Basil", quantity: 2.5, unit: "each", aliases: ["basil"] },
  ] },
  { id: "bistro-breakfast-sandwich", name: "Bistro Breakfast Sandwich", sourceRecipe: "Balanced Breakfast Sandwich", ingredients: [
    { name: "Liquid egg whites", quantity: 4, unit: "fl oz", aliases: ["liquid egg white", "egg white"] },
    { name: "English muffin", quantity: 1, unit: "each", aliases: ["english muffin"] },
    { name: "Turkey breast", quantity: 2, unit: "oz", aliases: ["turkey breast", "sliced turkey"] },
    { name: "Diced green chiles", quantity: 1, unit: "tbsp", aliases: ["green chile", "green chili"] },
    { name: "White cheddar", quantity: 1, unit: "slice", aliases: ["white cheddar", "cheddar slice"] },
    { name: "Arugula", quantity: 0.25, unit: "cup", aliases: ["arugula"] },
  ] },
  { id: "breakfast-croissant", name: "Bacon or Sausage Egg & Cheese Croissant", sourceRecipe: "Ham, Egg and Cheese Croissant", ingredients: [
    { name: "3-ounce croissant", quantity: 1, unit: "each", aliases: ["croissant"] },
    { name: "Cage-free egg", quantity: 1, unit: "each", aliases: ["cage free egg", "shell egg", "egg shell"] },
    { name: "White cheddar", quantity: 1, unit: "slice", aliases: ["white cheddar", "cheddar slice"] },
    { name: "Breakfast meat", quantity: 2, unit: "oz", aliases: ["sausage patty", "breakfast sausage", "bacon", "ham sliced"] },
  ] },
];

const normalizeFoodName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function recipeQuantityInCatalogUnits(quantity: number, recipeUnit: string, catalogUnit: string) {
  const from = recipeUnit.toLowerCase(), to = catalogUnit.toLowerCase();
  if (["each", "ea", "slice", "piece"].includes(from) && ["each", "ea", "count", "ct"].includes(to)) return quantity;
  const fluidOunces = from === "fl oz" ? quantity : from === "tbsp" ? quantity / 2 : from === "tsp" ? quantity / 6 : from === "cup" ? quantity * 8 : null;
  if (fluidOunces != null) {
    if (["oz", "fl oz"].includes(to)) return fluidOunces;
    if (["gallon", "gal", "ga"].includes(to)) return fluidOunces / 128;
    if (["quart", "qt"].includes(to)) return fluidOunces / 32;
    if (["pint", "pt"].includes(to)) return fluidOunces / 16;
  }
  if (from === "oz" && to === "oz") return quantity;
  if (from === "oz" && ["lb", "pound"].includes(to)) return quantity / 16;
  return null;
}

export function calculateEmployeeMealRecipe(recipe: EmployeeMealRecipe, catalog: any[]) {
  const breakdown = recipe.ingredients.map((ingredient) => {
    const candidates = catalog.map((item) => ({ item, normalized: normalizeFoodName(item.itemName || "") }));
    const match = candidates
      .map((candidate) => ({ ...candidate, score: Math.max(0, ...ingredient.aliases.map((alias) => candidate.normalized.includes(normalizeFoodName(alias)) ? normalizeFoodName(alias).length : 0)) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.item;
    const catalogQuantity = match ? recipeQuantityInCatalogUnits(ingredient.quantity, ingredient.unit, match.costingUnit) : null;
    const cost = match && catalogQuantity != null ? catalogQuantity * Number(match.costPerUnit) : null;
    return { ingredient: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit, catalogItemId: match?.id || null, catalogItemName: match?.itemName || null, cost: cost == null ? null : Number(cost.toFixed(4)) };
  });
  const missingIngredients = breakdown.filter((item) => item.cost == null).map((item) => item.ingredient);
  const servingCost = Number(breakdown.reduce((sum, item) => sum + (item.cost || 0), 0).toFixed(4));
  return { id: recipe.id, name: recipe.name, sourceRecipe: recipe.sourceRecipe, servingCost, complete: missingIngredients.length === 0, missingIngredients, breakdown };
}

async function extractInvoiceText(buffer: Buffer) {
  const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (input: Buffer) => Promise<{ text?: string }>;
  return String((await pdfParse(buffer)).text || "");
}

function costingFromPack(packSize: string) {
  const normalized = packSize.trim().toUpperCase();
  const match = normalized.match(/^((?:\d+(?:\.\d+)?|\.\d+)(?:[\/X](?:\d+(?:\.\d+)?|\.\d+)){0,2})\s*(EA|CT|DZ|LB|OZ|GA|GAL|QT|PT|#)$/);
  if (!match) return { costingUnit: "each", unitsPerPack: 1 };
  const quantities = match[1].split(/[\/X]/).map(Number);
  const measure = match[2];
  if (measure === "DZ") return { costingUnit: "each", unitsPerPack: quantities[0] * 12 };
  if (measure === "EA" || measure === "CT") return { costingUnit: "each", unitsPerPack: quantities.reduce((total, value) => total * value, 1) };
  // Multi-part food packs describe count, size, and unit (for example 2/12/4 OZ).
  // The saleable/waste unit is the product count, not the combined fluid/weight measure.
  if (quantities.length === 3) return { costingUnit: "each", unitsPerPack: quantities[0] * quantities[1] };
  if (quantities.length === 2 && quantities[0] > 1) return { costingUnit: "each", unitsPerPack: quantities[0] };
  const unitNames: Record<string, string> = { LB: "lb", "#": "lb", OZ: "oz", GA: "gallon", GAL: "gallon", QT: "quart", PT: "pint" };
  return { costingUnit: unitNames[measure] || "each", unitsPerPack: quantities.reduce((total, value) => total * value, 1) };
}

export function parseVendorInvoice(text: string, sourceFileName: string) {
  const vendor = /US Foods/i.test(text) ? "US Foods" : /Hardie/i.test(text) ? "Hardie's Fresh Foods" : "Unknown vendor";
  const invoiceNumber = vendor === "US Foods" ? (text.match(/\n(\d{5,10})\nINVOICE NUMBER/i)?.[1] || "") : (text.match(/INVOICE\/POD\s*(\d+)/i)?.[1] || text.match(/INVOICE #\s*(\d+)/i)?.[1] || "");
  const invoiceDateRaw = vendor === "US Foods"
    ? (text.match(/INVOICE DATE\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] || text.match(/(\d{2}\/\d{2}\/\d{4})\s*\nINVOICE DATE/i)?.[1])
    : (text.match(/DATE\/TRIP\s*(\d{2}\/\d{2}\/\d{2,4})/i)?.[1] || text.match(/DATE\s*(\d{2}\/\d{2}\/\d{2,4})/i)?.[1]);
  const invoiceDate = invoiceDateRaw ? (() => { const [m, d, y] = invoiceDateRaw.split("/"); return `${y.length === 2 ? `20${y}` : y}-${m}-${d}`; })() : null;
  const items: Array<{ vendor: string; vendorItemNumber: string; itemName: string; packSize: string; costingUnit: string; unitsPerPack: number; packCost: number; costPerUnit: number; invoiceNumber: string; invoiceDate: string | null; sourceFileName: string }> = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    const usFoodsMatch = line.match(/^\d+?(?:CS|EA)(\d{5,8})(.+?)(?:CS|EA)\$(\d+\.\d{4})\$(\d+\.\d{2})$/i);
    const hardiesMatch = vendor === "Hardie's Fresh Foods" ? line.match(/^(\d)(\d)(\d{5})(.+?)(\d+(?:\.\d+)?(?:[\/X]\d+(?:\.\d+)?)?\s*(?:OZ|CT|GAL|PT|#))(\d+\.\d{2})(\d+\.\d{2})$/i) : null;
    if (!usFoodsMatch && !hardiesMatch) continue;
    const vendorItemNumber = usFoodsMatch ? usFoodsMatch[1] : hardiesMatch![3];
    const body = usFoodsMatch ? usFoodsMatch[2].trim() : hardiesMatch![4].trim();
    const packMatch = usFoodsMatch ? body.match(/((?:\d+(?:\.\d+)?|\.\d+)(?:[\/X](?:\d+(?:\.\d+)?|\.\d+)){0,2}\s*(?:EA|CT|DZ|LB|OZ|GA|GAL|QT|PT|#))(?:T|B)?$/i) : null;
    const packSize = hardiesMatch ? hardiesMatch[5] : packMatch?.[1] || "1 EA";
    const itemName = (packMatch ? body.slice(0, packMatch.index).trim() : body).replace(/\s+/g, " ");
    const packCost = Number(usFoodsMatch ? usFoodsMatch[4] : hardiesMatch![6]);
    const costing = costingFromPack(packSize);
    items.push({ vendor, vendorItemNumber, itemName, packSize, ...costing, packCost, costPerUnit: packCost / Math.max(1, costing.unitsPerPack), invoiceNumber, invoiceDate, sourceFileName });
  }
  // Some invoices repeat priced rows in recap sections. Keep the last occurrence so
  // import counts and previews match the unique vendor catalog records being updated.
  const uniqueItems = Array.from(new Map(items.map((item) => [`${item.vendor}:${item.vendorItemNumber}`, item])).values());
  return { vendor, invoiceNumber, invoiceDate, items: uniqueItems, warning: uniqueItems.length ? null : /CUSTOMER STATEMENT/i.test(text) ? "This file is a customer statement and does not contain product line items. Upload the detailed Hardie's invoice to update unit costs." : "No supported product line items were found. Review the invoice format." };
}

export async function buildBlankFoodWasteLogPdf() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.13, 0.09, 0.07), green = rgb(0.18, 0.37, 0.27), tan = rgb(0.73, 0.52, 0.21), line = rgb(0.77, 0.71, 0.63);
  page.drawRectangle({ x: 0, y: 730, width: 612, height: 62, color: rgb(0.96, 0.93, 0.88) });
  page.drawText("COURTYARD AUSTIN LAKELINE", { x: 40, y: 766, size: 8, font: bold, color: tan });
  page.drawText("Bistro Food Waste Log", { x: 40, y: 742, size: 20, font: bold, color: ink });
  page.drawText("Property / Outlet: Courtyard Austin Lakeline - Bistro", { x: 40, y: 709, size: 9, font: regular, color: ink });
  page.drawText("Month: ____________________", { x: 400, y: 709, size: 9, font: regular, color: ink });
  page.drawText("Reason codes: EX - Expired   |   SP - Spoiled   |   SM - Shift Meal", { x: 40, y: 688, size: 9, font: bold, color: green });
  page.drawText("Record the total dollar loss for each waste event. Enter the same entry in the digital Bistro waste log.", { x: 40, y: 672, size: 8, font: regular, color: ink });
  const x = 40, top = 650, rowHeight = 27;
  const widths = [55, 145, 65, 70, 60, 55, 82];
  const headers = ["Date", "Food Item", "Qty / Unit", "Reason", "Cost", "Initials", "Notes"];
  const tableWidth = widths.reduce((sum, value) => sum + value, 0);
  page.drawRectangle({ x, y: top - rowHeight, width: tableWidth, height: rowHeight, color: rgb(0.14, 0.22, 0.28) });
  let cursor = x;
  headers.forEach((header, index) => { page.drawText(header, { x: cursor + 4, y: top - 18, size: 7.5, font: bold, color: rgb(1, 1, 1) }); cursor += widths[index]; });
  for (let row = 0; row <= 17; row += 1) { const y = top - rowHeight * (row + 1); page.drawLine({ start: { x, y }, end: { x: x + tableWidth, y }, thickness: 0.6, color: line }); }
  cursor = x;
  page.drawLine({ start: { x, y: top }, end: { x, y: top - rowHeight * 18 }, thickness: 0.6, color: line });
  widths.forEach((width) => { cursor += width; page.drawLine({ start: { x: cursor, y: top }, end: { x: cursor, y: top - rowHeight * 18 }, thickness: 0.6, color: line }); });
  page.drawText("MONTHLY WASTE COST SUMMARY", { x: 40, y: 158, size: 10, font: bold, color: ink });
  page.drawText("Expired: $____________", { x: 40, y: 138, size: 9, font: regular, color: ink });
  page.drawText("Spoiled: $____________", { x: 175, y: 138, size: 9, font: regular, color: ink });
  page.drawText("Shift Meals: $____________", { x: 310, y: 138, size: 9, font: regular, color: ink });
  page.drawText("TOTAL: $____________", { x: 465, y: 138, size: 9, font: bold, color: green });
  page.drawText("Manager review: ______________________________    Date: ______________", { x: 40, y: 92, size: 9, font: regular, color: ink });
  page.drawText("Retain completed forms according to property accounting procedures.", { x: 40, y: 55, size: 7.5, font: regular, color: rgb(0.36, 0.31, 0.27) });
  return Buffer.from(await pdf.save());
}

// TODO: set the actual Courtyard Bistro current pay period start date in env/admin settings.
const TIPS_PAY_PERIOD_SEED =
  process.env.TIPS_PAY_PERIOD_START_DATE || "2026-05-16";
const TIPS_SUBMISSION_RECIPIENT =
  process.env.TIPS_SUBMISSION_RECIPIENT || "cory.armer@marriott.com";
const PRIVATE_TIPS_ROOT = path.resolve(
  process.cwd(),
  "private-uploads",
  "tips",
);
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
  toolAccess: Record<string, boolean>;
  mustChangePassword: boolean;
  disabledAt: Date | string | null;
};

const COURTYARD_TOOL_KEYS = [
  "schedule",
  "tips",
  "opsreport",
  "dosreporting",
  "salesintelligence",
  "incidentreport",
  "bankdeposit",
  "budget",
  "comptroller",
] as const;
type CourtyardToolKey = (typeof COURTYARD_TOOL_KEYS)[number];

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isCourtyardPlaceholderEmail(email: unknown) {
  return /^tips-[^@]+@courtyard-tips\.local$/i.test(
    normalizeEmail(String(email || "")),
  );
}

function isDeliverableEmail(email: unknown) {
  const normalized = normalizeEmail(String(email || ""));
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) &&
    !isCourtyardPlaceholderEmail(normalized)
  );
}

function normalizePersonName(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findScheduleEmployeeForTipsUser(user: any, employees: any[]) {
  const email = normalizeEmail(String(user?.email || ""));
  if (email && !isCourtyardPlaceholderEmail(email)) {
    const byEmail = employees.find(
      (employee) => normalizeEmail(String(employee.email || "")) === email,
    );
    if (byEmail) return byEmail;
  }

  const first = normalizePersonName(user?.firstName);
  const last = normalizePersonName(user?.lastName);
  const display = normalizePersonName(
    user?.employeeDisplayName ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" "),
  );
  const matches = employees.filter((employee) => {
    const employeeFirst = normalizePersonName(employee.firstName);
    const employeeLast = normalizePersonName(employee.lastName);
    const employeeDisplay = normalizePersonName(employee.displayName);
    return Boolean(
      (first && last && employeeFirst === first && employeeLast === last) ||
      (display && employeeDisplay === display),
    );
  });
  return matches.length === 1 ? matches[0] : null;
}

async function reconcileTipsUserScheduleEmail(
  user: any,
  employees?: any[],
  users?: any[],
) {
  if (!user || !isCourtyardPlaceholderEmail(user.email)) return user;
  const scheduleRows =
    employees ||
    (await db
      .select()
      .from(scheduleEmployees)
      .where(eq(scheduleEmployees.active, true)));
  const employee = findScheduleEmployeeForTipsUser(user, scheduleRows);
  const scheduleEmail = normalizeEmail(String(employee?.email || ""));
  if (!isDeliverableEmail(scheduleEmail)) return user;

  const allUsers = users || (await db.select().from(tipsUsers));
  const emailOwner = allUsers.find(
    (item) =>
      item.id !== user.id &&
      normalizeEmail(String(item.email || "")) === scheduleEmail,
  );
  if (emailOwner) return user;

  const [updated] = await db
    .update(tipsUsers)
    .set({ email: scheduleEmail, updatedAt: new Date() })
    .where(eq(tipsUsers.id, user.id))
    .returning();
  return updated || user;
}

async function reconcileTipsUsersWithSchedule(users: any[]) {
  const employees = await db
    .select()
    .from(scheduleEmployees)
    .where(eq(scheduleEmployees.active, true));
  const reconciled: any[] = [];
  for (const user of users) {
    const updated = await reconcileTipsUserScheduleEmail(
      user,
      employees,
      users,
    );
    reconciled.push(updated);
    const index = users.findIndex((item) => item.id === updated.id);
    if (index >= 0) users[index] = updated;
  }
  return reconciled;
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
  const seed =
    parseDateKey(TIPS_PAY_PERIOD_SEED) || parseDateKey("2026-05-16")!;
  const target = parseDateKey(toDateKey(date)) || date;
  const diffDays = Math.floor((target.getTime() - seed.getTime()) / 86_400_000);
  const offset = ((diffDays % 14) + 14) % 14;
  const start = addUtcDays(target, -offset);
  const end = addUtcDays(start, 13);
  return {
    start: toDateKey(start),
    end: toDateKey(end),
    dayNumber: offset + 1,
    days: Array.from({ length: 14 }, (_, index) =>
      toDateKey(addUtcDays(start, index)),
    ),
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

function sumMoney(rows: any[], field: string) {
  return moneyString(
    rows.reduce((sum, row) => sum + moneyNumber(row[field]), 0),
  );
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

function getToolAccess(user: any): Record<string, boolean> {
  const access = user?.toolAccessJson;
  return access && typeof access === "object" && !Array.isArray(access)
    ? (access as Record<string, boolean>)
    : {};
}

function getExplicitToolAccess(user: any, tool: CourtyardToolKey) {
  const value = getToolAccess(user)[tool];
  return typeof value === "boolean" ? value : null;
}

function hasBistroText(value: unknown) {
  const normalized = String(value || "").toLowerCase();
  return normalized.includes("bistro") || normalized.includes("breakfast");
}

async function hasBistroTipsAccess(user: any) {
  if (!user || user.disabledAt || user.mustChangePassword) return false;
  if (isTipsSuperAdmin(user)) return true;
  const explicit = getExplicitToolAccess(user, "tips");
  if (explicit !== null) return explicit;
  if (hasBistroText(user.position)) return true;
  const [employee] = await db
    .select()
    .from(scheduleEmployees)
    .where(
      eq(scheduleEmployees.email, normalizeEmail(String(user.email || ""))),
    )
    .limit(1);
  return Boolean(
    employee &&
    (hasBistroText(employee.department) ||
      hasBistroText(employee.position) ||
      hasBistroText(
        Array.isArray(employee.rolesJson)
          ? employee.rolesJson.join(", ")
          : employee.rolesJson,
      )),
  );
}

function scheduleEmployeeHasBistroRole(employee: any) {
  return Boolean(
    employee &&
    (hasBistroText(employee.department) ||
      hasBistroText(employee.position) ||
      hasBistroText(
        Array.isArray(employee.rolesJson)
          ? employee.rolesJson.join(", ")
          : employee.rolesJson,
      )),
  );
}

async function canManageTipsSales(user: any) {
  if (!user || user.disabledAt || user.mustChangePassword) return false;
  if (isTipsManager(user)) return true;
  const text =
    `${user.position || ""} ${user.employeeDisplayName || ""}`.toLowerCase();
  if (text.includes("gm") || text.includes("general manager")) return true;
  if (
    text.includes("bistro") &&
    (text.includes("manager") || text.includes("supervisor"))
  )
    return true;
  const [employee] = await db
    .select()
    .from(scheduleEmployees)
    .where(
      eq(scheduleEmployees.email, normalizeEmail(String(user.email || ""))),
    )
    .limit(1);
  const employeeText =
    `${employee?.department || ""} ${employee?.position || ""} ${Array.isArray(employee?.rolesJson) ? employee.rolesJson.join(" ") : employee?.rolesJson || ""}`.toLowerCase();
  return Boolean(
    employeeText.includes("bistro") &&
    (employeeText.includes("manager") || employeeText.includes("supervisor")),
  );
}

async function getBistroTipsUsers() {
  const [users, scheduleRows] = await Promise.all([
    db.select().from(tipsUsers).orderBy(asc(tipsUsers.employeeDisplayName)),
    db.select().from(scheduleEmployees),
  ]);
  const scheduleByEmail = new Map(
    scheduleRows.map((employee) => [
      normalizeEmail(String(employee.email || "")),
      employee,
    ]),
  );
  return users.filter((user) => {
    if (user.disabledAt || resolveTipsRole(user) === "super_admin")
      return false;
    if (hasBistroText(user.position)) return true;
    const scheduleEmployee = scheduleByEmail.get(
      normalizeEmail(String(user.email || "")),
    );
    return scheduleEmployeeHasBistroRole(scheduleEmployee);
  });
}

async function getBanquetTipAssociates() {
  const employees = await db
    .select()
    .from(scheduleEmployees)
    .where(eq(scheduleEmployees.active, true))
    .orderBy(
      asc(scheduleEmployees.department),
      asc(scheduleEmployees.displayName),
    );
  return employees.map((employee) => ({
    id: employee.id,
    employeeDisplayName: employee.displayName,
    position: employee.position || null,
    department: employee.department || null,
  }));
}

function publicTipsUser(
  user: any,
): TipsUserSession & { isAdmin: boolean; isSuperAdmin: boolean } {
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
    toolAccess: getToolAccess(user),
    mustChangePassword: Boolean(user.mustChangePassword),
    disabledAt: user.disabledAt ?? null,
    isAdmin: role === "manager" || role === "super_admin",
    isSuperAdmin: role === "super_admin",
  };
}

async function getTipsUserBySession(req: any) {
  const userId = req.session?.tipsUserId;
  if (!userId) return null;
  const [user] = await db
    .select()
    .from(tipsUsers)
    .where(eq(tipsUsers.id, String(userId)))
    .limit(1);
  return user || null;
}

const requireTipsAuth: RequestHandler = async (req: any, res, next) => {
  try {
    const user = await getTipsUserBySession(req);
    if (!user) return res.status(401).json({ error: "Tips login required" });
    if (user.disabledAt)
      return res.status(403).json({ error: "This Tips account is disabled." });
    req.tipsUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

const requireTipsReady: RequestHandler = async (req: any, res, next) => {
  if (req.tipsUser?.mustChangePassword) {
    return res
      .status(403)
      .json({
        error: "Password change required before continuing.",
        code: "PASSWORD_CHANGE_REQUIRED",
      });
  }
  next();
};

const requireTipsAdmin: RequestHandler = async (req: any, res, next) => {
  try {
    const user = await getTipsUserBySession(req);
    if (!user) return res.status(401).json({ error: "Tips login required" });
    if (user.disabledAt)
      return res.status(403).json({ error: "This Tips account is disabled." });
    if (user.mustChangePassword)
      return res
        .status(403)
        .json({
          error: "Password change required before continuing.",
          code: "PASSWORD_CHANGE_REQUIRED",
        });
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
    if (user.disabledAt)
      return res.status(403).json({ error: "This Tips account is disabled." });
    if (user.mustChangePassword)
      return res
        .status(403)
        .json({
          error: "Password change required before continuing.",
          code: "PASSWORD_CHANGE_REQUIRED",
        });
    if (!isTipsSuperAdmin(user))
      return res
        .status(403)
        .json({ error: "Tips super admin access required" });
    req.tipsUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

const requireTipsGridAccess: RequestHandler = async (req: any, res, next) => {
  try {
    const user = await getTipsUserBySession(req);
    if (
      user &&
      !user.disabledAt &&
      !user.mustChangePassword &&
      (isTipsManager(user) || getExplicitToolAccess(user, "tips") === true) &&
      (await hasBistroTipsAccess(user))
    ) {
      req.tipsUser = user;
      return next();
    }
    if (!user)
      return res.status(401).json({ error: "Courtyard login required" });
    if (!(await hasBistroTipsAccess(user)))
      return res
        .status(403)
        .json({ error: "Bistro role required for tips access" });
    if (req.session?.tipsKioskUnlocked) {
      req.tipsUser = user;
      return next();
    }
    return res.status(401).json({ error: "Tips PIN required" });
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

const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

const changePasswordSchema = z
  .object({
    temporaryPassword: z.string().min(1),
    newPassword: z.string().min(8).max(200),
    confirmPassword: z.string().min(8).max(200),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  });

const entrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tipAmount: z.coerce.number().min(0).max(100000),
  cashTips: z.coerce.number().min(0).max(100000).default(0),
  creditTips: z.coerce.number().min(0).max(100000).default(0),
  grossSales: z.coerce.number().min(0).max(1000000).default(0),
  coversServed: z.coerce.number().int().min(0).max(10000).optional().nullable(),
  shiftType: z
    .enum(["breakfast", "lunch", "dinner", "bar", "other"])
    .default("other"),
  notes: z.string().max(2000).optional().nullable(),
});

const periodSchema = z.object({
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
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

const adminPasswordResetSchema = z.object({
  temporaryPassword: z.string().min(8).max(200),
});

const adminDisableUserSchema = z.object({
  disabled: z.boolean(),
});

const updateToolAccessSchema = z.object({
  tool: z.enum(COURTYARD_TOOL_KEYS),
  enabled: z.boolean(),
});

const kioskPinSchema = z.object({
  pin: z.string().regex(/^\d{5}$/, "PIN must be exactly 5 digits"),
});

const gridEntrySchema = z.object({
  userId: z.string().min(1),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tipAmount: z.coerce.number().min(0).max(100000),
  grossSales: z.coerce.number().min(0).max(1000000).default(0),
  notes: z.string().max(1000).optional().nullable(),
});

const gridDaySummarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  grossSales: z.coerce.number().min(0).max(1000000),
  taxAmount: z.coerce.number().min(0).max(1000000).default(0),
  beerSales: z.coerce.number().min(0).max(1000000).default(0),
  liquorSales: z.coerce.number().min(0).max(1000000).default(0),
  foodSales: z.coerce.number().min(0).max(1000000).default(0),
  wineSales: z.coerce.number().min(0).max(1000000).default(0),
});

const gridAssociateSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  employeeDisplayName: z.string().trim().min(1).max(140).optional(),
  position: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email().optional().or(z.literal("")),
});

const banquetReportSchema = z.object({
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reportType: z
    .enum(["banquet_service", "group_breakfast"])
    .default("banquet_service"),
  eventName: z.string().trim().min(1).max(160),
  grossSales: z.coerce.number().min(0).max(1000000),
  banquetTips: z.coerce.number().min(0).max(100000).optional(),
  assignedUserIds: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    },
    z.array(z.string().trim().min(1)).max(20).default([]),
  ),
  notes: z.string().trim().max(1000).optional().nullable(),
});

function serviceRateForReportType(reportType: string) {
  return reportType === "group_breakfast" ? 0.18 : 0.21;
}

function resolveBanquetTipAmount(input: {
  reportType: string;
  grossSales: number;
  banquetTips?: number | null;
}) {
  if (
    typeof input.banquetTips === "number" &&
    Number.isFinite(input.banquetTips) &&
    input.banquetTips > 0
  )
    return input.banquetTips;
  return input.grossSales * serviceRateForReportType(input.reportType);
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, REPORTS_DIR),
    filename: (req: any, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(
        null,
        `${req.tipsUser?.id || "kiosk"}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`,
      );
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image or PDF sales reports are allowed"));
    }
  },
});

const salesReportUpload: RequestHandler = (req, res, next) => {
  upload.single("salesReport")(req, res, (error: any) => {
    if (!error) return next();
    if (
      error instanceof multer.MulterError &&
      error.code === "LIMIT_FILE_SIZE"
    ) {
      return res
        .status(413)
        .json({
          error:
            "Sales report image is too large. Retake the photo farther back, crop it, or choose a smaller image.",
        });
    }
    return res
      .status(400)
      .json({ error: error?.message || "Sales report upload failed." });
  });
};

function computeTotals(
  entries: any[],
  period: ReturnType<typeof getPayPeriodForDate>,
) {
  const byDate = new Map(
    entries.map((entry) => [String(entry.entryDate), entry]),
  );
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
    .where(
      and(
        eq(tipEntries.userId, userId),
        gte(tipEntries.entryDate, start),
        lte(tipEntries.entryDate, end),
      ),
    )
    .orderBy(asc(tipEntries.entryDate));

  const attachments = rows.length
    ? await db
        .select()
        .from(tipEntryAttachments)
        .where(
          inArray(
            tipEntryAttachments.tipEntryId,
            rows.map((row) => row.id),
          ),
        )
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
    .where(
      and(
        eq(tipPeriodSubmissions.userId, userId),
        eq(tipPeriodSubmissions.payPeriodStart, start),
        eq(tipPeriodSubmissions.payPeriodEnd, end),
      ),
    )
    .limit(1);
  return submission || null;
}

async function buildDashboard(userId: string, requestedStart?: string) {
  const period = requestedStart
    ? {
        ...getPayPeriodForDate(parseDateKey(requestedStart) || new Date()),
        start: requestedStart,
      }
    : getPayPeriodForDate();
  const entries = await getEntriesForPeriod(userId, period.start, period.end);
  const submission = await getSubmission(userId, period.start, period.end);
  const totals = computeTotals(entries, period);
  return {
    period: {
      start: period.start,
      end: period.end,
      dayNumber: period.dayNumber,
    },
    entries,
    submission: submission
      ? {
          ...submission,
          week1Total: moneyString(submission.week1Total),
          week2Total: moneyString(submission.week2Total),
          totalTips: moneyString(submission.totalTips),
        }
      : null,
    ...totals,
  };
}

async function generateTipsPdf(
  user: any,
  dashboard: any,
  submission: any | null,
) {
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
    page.drawText(text.slice(0, 105), {
      x,
      y,
      size,
      font: isBold ? bold : font,
      color: rgb(0.08, 0.09, 0.11),
    });
    y -= size + 8;
  };

  draw("Courtyard Tips Tracker", 48, 18, true);
  draw(
    `Employee: ${user.employeeDisplayName} (${user.firstName} ${user.lastName})`,
    48,
    11,
  );
  draw(`Position: ${user.position || "Unassigned"}`, 48, 11);
  draw(`Email: ${user.email}`, 48, 11);
  draw(
    `Pay period: ${dashboard.period.start} to ${dashboard.period.end}`,
    48,
    11,
  );
  draw(`Submission status: ${submission?.status || "draft"}`, 48, 11);
  if (submission?.submittedAt)
    draw(
      `Submitted: ${new Date(submission.submittedAt).toLocaleString()}`,
      48,
      11,
    );
  y -= 8;
  draw("Daily Tips", 48, 13, true);
  draw("Date          CC Tips    Sales      Shift      Photo", 48, 9, true);
  dashboard.days.forEach((day: any) => {
    const entry = day.entry;
    draw(
      `${day.date}   $${moneyString(entry?.creditTips || entry?.tipAmount)}   $${moneyString(entry?.grossSales)}   ${entry?.shiftType || "-"}   ${(entry?.attachments?.length || 0) > 0 ? "Yes" : "No"}`,
      48,
      9,
    );
    if (entry?.notes)
      draw(`Notes: ${String(entry.notes).replace(/\s+/g, " ")}`, 64, 8);
  });
  y -= 8;
  draw(`Week 1 total: $${dashboard.week1Total}`, 48, 12, true);
  draw(`Week 2 total: $${dashboard.week2Total}`, 48, 12, true);
  draw(`Grand total: $${dashboard.totalTips}`, 48, 13, true);
  y -= 8;
  draw("Employee confirmation:", 48, 11, true);
  draw(
    "I confirm these tip amounts are accurate to the best of my knowledge and match the uploaded sales reports.",
    48,
    9,
  );
  y -= 16;
  draw(
    "Manager review: ________________________________  Date: ________________",
    48,
    10,
  );

  const bytes = await pdf.save();
  const fileName = `${user.id}-${dashboard.period.start}-${dashboard.period.end}.pdf`;
  const absolutePath = path.join(PDFS_DIR, fileName);
  await fs.promises.writeFile(absolutePath, bytes);
  return path.relative(process.cwd(), absolutePath);
}

async function sendTipsSubmissionEmail(user: any, dashboard: any) {
  const { client, fromEmail } = await getUncachableResendClient();
  const rows = dashboard.days
    .map((day: any) => {
      const entry = day.entry;
      return `${day.date}: CC tips $${moneyString(entry?.creditTips || entry?.tipAmount)} | sales $${moneyString(entry?.grossSales)} | shift ${entry?.shiftType || "-"} | photo ${(entry?.attachments?.length || 0) > 0 ? "yes" : "no"} | notes: ${entry?.notes || ""}`;
    })
    .join("\n");
  const subject = `Tips Submission - ${user.employeeDisplayName} - ${dashboard.period.start} to ${dashboard.period.end}`;
  const adminUrl = new URL(
    "/tips/admin",
    process.env.FRONTEND_BASE_URL || "https://readysetfly.us",
  ).toString();

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
      "PDF summary: available through the protected Tips admin view.",
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
  const tipsUrl = new URL(
    "/tips",
    process.env.FRONTEND_BASE_URL || "https://readysetfly.us",
  ).toString();

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
      "After signing in the first time, you will be asked to confirm this temporary password and create your new password.",
    ].join("\n"),
  });
}

async function sendTipsPasswordResetEmail(params: {
  email: string;
  firstName: string;
  temporaryPassword: string;
  requestedByName: string;
}) {
  const { client, fromEmail } = await getUncachableResendClient();
  const tipsUrl = new URL(
    "/courtyard",
    process.env.FRONTEND_BASE_URL || "https://readysetfly.us",
  ).toString();

  await client.emails.send({
    from: fromEmail,
    to: params.email,
    subject: "Courtyard Associate Portal password change required",
    text: [
      `Hi ${params.firstName},`,
      "",
      `${params.requestedByName} requested a password change for your Courtyard Associate Portal account.`,
      "",
      `Sign in here: ${tipsUrl}`,
      `Temporary password: ${params.temporaryPassword}`,
      "",
      "After signing in, confirm this temporary password and create your new password.",
    ].join("\n"),
  });
}

function resolvePrivateFile(storagePath: string) {
  const absolute = path.resolve(process.cwd(), storagePath);
  if (!absolute.startsWith(PRIVATE_TIPS_ROOT + path.sep)) return null;
  return absolute;
}

async function getKioskPinHash() {
  const [row] = await db
    .select()
    .from(tipsKioskSettings)
    .where(eq(tipsKioskSettings.key, "pin_hash"))
    .limit(1);
  return row?.value || "";
}

async function verifyKioskPin(pin: string) {
  const hash = await getKioskPinHash();
  if (hash) return bcrypt.compare(pin, hash);
  return Boolean(
    process.env.TIPS_KIOSK_PIN && process.env.TIPS_KIOSK_PIN === pin,
  );
}

async function getDailyReportsForPeriod(start: string, end: string) {
  const reports = await db
    .select()
    .from(tipDailyReportAttachments)
    .where(
      and(
        gte(tipDailyReportAttachments.reportDate, start),
        lte(tipDailyReportAttachments.reportDate, end),
      ),
    )
    .orderBy(asc(tipDailyReportAttachments.reportDate));
  return reports;
}

async function getGridDaySummariesForPeriod(start: string, end: string) {
  return db
    .select()
    .from(tipGridDaySummaries)
    .where(
      and(
        gte(tipGridDaySummaries.summaryDate, start),
        lte(tipGridDaySummaries.summaryDate, end),
      ),
    )
    .orderBy(asc(tipGridDaySummaries.summaryDate));
}

async function getGridSubmission(start: string, end: string) {
  const [submission] = await db
    .select()
    .from(tipGridSubmissions)
    .where(
      and(
        eq(tipGridSubmissions.payPeriodStart, start),
        eq(tipGridSubmissions.payPeriodEnd, end),
      ),
    )
    .limit(1);
  return submission || null;
}

function gridSubmissionLocksPeriod(
  submission: {
    status?: string | null;
    submittedAt?: Date | string | null;
  } | null,
  start: string,
  end: string,
) {
  if (!submission || submission.status === "reopened") return false;
  const currentPeriod = getPayPeriodForDate();
  if (start !== currentPeriod.start) return true;

  const submittedAt = submission.submittedAt
    ? new Date(submission.submittedAt)
    : null;
  if (!submittedAt || Number.isNaN(submittedAt.getTime())) return false;
  return toDateKey(submittedAt) >= end;
}

async function buildTipsGrid(requestedStart?: string, viewerUser?: any) {
  const startDate = requestedStart ? parseDateKey(requestedStart) : null;
  const period = startDate
    ? {
        start: toDateKey(startDate),
        end: toDateKey(addUtcDays(startDate, 13)),
        dayNumber: Math.max(1, Math.min(14, getPayPeriodForDate().dayNumber)),
        days: Array.from({ length: 14 }, (_, index) =>
          toDateKey(addUtcDays(startDate, index)),
        ),
      }
    : getPayPeriodForDate();
  const [users, entries, reports, daySummaries, submission] = await Promise.all(
    [
      getBistroTipsUsers(),
      db
        .select()
        .from(tipEntries)
        .where(
          and(
            gte(tipEntries.entryDate, period.start),
            lte(tipEntries.entryDate, period.end),
          ),
        )
        .orderBy(asc(tipEntries.entryDate)),
      getDailyReportsForPeriod(period.start, period.end),
      getGridDaySummariesForPeriod(period.start, period.end),
      getGridSubmission(period.start, period.end),
    ],
  );
  const banquetAssociates = await getBanquetTipAssociates();
  const associates = users
    .filter(
      (user) => !user.disabledAt && resolveTipsRole(user) !== "super_admin",
    )
    .map(publicTipsUser);
  const entryByUserDate = new Map(
    entries.map((entry) => [`${entry.userId}:${entry.entryDate}`, entry]),
  );
  const reportsByDate = new Map(
    reports.map((report) => [String(report.reportDate), report]),
  );
  const summariesByDate = new Map(
    daySummaries.map((summary) => [String(summary.summaryDate), summary]),
  );
  const locked = gridSubmissionLocksPeriod(
    submission,
    period.start,
    period.end,
  );
  const rows = associates.map((associate) => {
    let total = 0;
    const cells = period.days.map((date) => {
      const entry = entryByUserDate.get(`${associate.id}:${date}`);
      const amount = moneyNumber(entry?.tipAmount);
      total += amount;
      return {
        date,
        entryId: entry?.id || null,
        tipAmount: moneyString(amount),
        grossSales: moneyString(entry?.grossSales),
        personalTipPercent:
          moneyNumber(entry?.grossSales) > 0
            ? (amount / moneyNumber(entry?.grossSales)) * 100
            : 0,
        notes: entry?.notes || "",
        status: entry?.status || "draft",
        confirmed:
          entry?.status === "confirmed" ||
          (entry?.status === "submitted" && locked),
      };
    });
    return { associate, cells, totalTips: moneyString(total) };
  });
  const dayTotals = period.days.map((date) => {
    const totalTips = rows.reduce(
      (sum, row) =>
        sum +
        moneyNumber(row.cells.find((cell) => cell.date === date)?.tipAmount),
      0,
    );
    const shiftGrossSales = rows.reduce(
      (sum, row) =>
        sum +
        moneyNumber(row.cells.find((cell) => cell.date === date)?.grossSales),
      0,
    );
    const grossSales =
      shiftGrossSales > 0
        ? shiftGrossSales
        : moneyNumber(summariesByDate.get(date)?.grossSales);
    const summary = summariesByDate.get(date);
    const taxAmount = moneyNumber(summary?.taxAmount);
    const netSales = Math.max(0, grossSales - taxAmount);
    return {
      date,
      totalTips: moneyString(totalTips),
      grossSales: moneyString(grossSales),
      taxAmount: moneyString(taxAmount),
      netSales: moneyString(netSales),
      beerSales: moneyString(summary?.beerSales),
      liquorSales: moneyString(summary?.liquorSales),
      foodSales: moneyString(summary?.foodSales),
      wineSales: moneyString(summary?.wineSales),
      tipPercent: grossSales > 0 ? (totalTips / grossSales) * 100 : 0,
      report: reportsByDate.get(date) || null,
    };
  });
  const week1Total = dayTotals
    .slice(0, 7)
    .reduce((sum, day) => sum + moneyNumber(day.totalTips), 0);
  const week2Total = dayTotals
    .slice(7)
    .reduce((sum, day) => sum + moneyNumber(day.totalTips), 0);
  const monthStart = `${period.start.slice(0, 7)}-01`;
  const monthProbe = addUtcDays(parseDateKey(monthStart)!, 32);
  const nextMonthStart = `${monthProbe.toISOString().slice(0, 7)}-01`;
  const monthEnd = toDateKey(addUtcDays(parseDateKey(nextMonthStart)!, -1));
  const bistroUserIds = users.map((user) => user.id);
  const [monthEntries, monthSummaries] = await Promise.all([
    bistroUserIds.length
      ? db
          .select({
            entryDate: tipEntries.entryDate,
            grossSales: tipEntries.grossSales,
          })
          .from(tipEntries)
          .where(
            and(
              gte(tipEntries.entryDate, monthStart),
              lte(tipEntries.entryDate, monthEnd),
              inArray(tipEntries.userId, bistroUserIds),
            ),
          )
      : Promise.resolve([]),
    db
      .select()
      .from(tipGridDaySummaries)
      .where(
        and(
          gte(tipGridDaySummaries.summaryDate, monthStart),
          lte(tipGridDaySummaries.summaryDate, monthEnd),
        ),
      ),
  ]);
  const monthEntrySalesByDate = new Map<string, number>();
  monthEntries.forEach((entry) => {
    const date = String(entry.entryDate);
    monthEntrySalesByDate.set(
      date,
      (monthEntrySalesByDate.get(date) || 0) + moneyNumber(entry.grossSales),
    );
  });
  const monthGrossSales =
    monthSummaries.reduce((sum, summary) => {
      const entrySales =
        monthEntrySalesByDate.get(String(summary.summaryDate)) || 0;
      return (
        sum + (entrySales > 0 ? entrySales : moneyNumber(summary.grossSales))
      );
    }, 0) +
    Array.from(monthEntrySalesByDate.entries()).reduce(
      (sum, [date, grossSales]) =>
        monthSummaries.some((summary) => String(summary.summaryDate) === date)
          ? sum
          : sum + grossSales,
      0,
    );
  const salesTotal = (rows: any[]) => {
    const grossSales = rows.reduce(
      (sum, row) => sum + moneyNumber(row.grossSales),
      0,
    );
    const taxAmount = rows.reduce(
      (sum, row) => sum + moneyNumber(row.taxAmount),
      0,
    );
    return {
      grossSales: moneyString(grossSales),
      taxAmount: moneyString(taxAmount),
      netSales: moneyString(Math.max(0, grossSales - taxAmount)),
      beerSales: sumMoney(rows, "beerSales"),
      liquorSales: sumMoney(rows, "liquorSales"),
      foodSales: sumMoney(rows, "foodSales"),
      wineSales: sumMoney(rows, "wineSales"),
    };
  };
  const banquetReports = await db
    .select()
    .from(tipBanquetReports)
    .where(
      and(
        gte(tipBanquetReports.eventDate, period.start),
        lte(tipBanquetReports.eventDate, period.end),
      ),
    )
    .orderBy(
      asc(tipBanquetReports.eventDate),
      asc(tipBanquetReports.eventName),
    );
  const banquetTotal = banquetReports.reduce(
    (sum, report) => sum + moneyNumber(report.banquetTips),
    0,
  );
  return {
    period: {
      start: period.start,
      end: period.end,
      dayNumber: period.dayNumber,
      days: period.days,
    },
    rows,
    dayTotals,
    week1Total: moneyString(week1Total),
    week2Total: moneyString(week2Total),
    totalTips: moneyString(week1Total + week2Total),
    banquetReports: banquetReports.map((report) => ({
      ...report,
      grossSales: moneyString(report.grossSales),
      serviceRate: String(
        report.serviceRate ?? serviceRateForReportType(report.reportType),
      ),
      banquetTips: moneyString(report.banquetTips),
      assignedAssociatesJson: Array.isArray(report.assignedAssociatesJson)
        ? report.assignedAssociatesJson
        : [],
    })),
    banquetAssociates,
    banquetTotal: moneyString(banquetTotal),
    salesTotals: {
      week1: salesTotal(dayTotals.slice(0, 7)),
      week2: salesTotal(dayTotals.slice(7)),
      period: salesTotal(dayTotals),
      month: {
        grossSales: moneyString(monthGrossSales),
        taxAmount: "0.00",
        netSales: moneyString(monthGrossSales),
        beerSales: "0.00",
        liquorSales: "0.00",
        foodSales: "0.00",
        wineSales: "0.00",
      },
    },
    canManageSales: await canManageTipsSales(viewerUser),
    submission: submission
      ? {
          ...submission,
          week1Total: moneyString(submission.week1Total),
          week2Total: moneyString(submission.week2Total),
          totalTips: moneyString(submission.totalTips),
        }
      : null,
    isCurrentPeriod: period.start === getPayPeriodForDate().start,
    lockReason: locked ? "submitted" : null,
    locked,
  };
}

async function generateTipsGridPdf(grid: any, submission: any | null) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([792, 612]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 568;
  const draw = (text: string, x = 36, size = 8, isBold = false) => {
    if (y < 44) {
      page = pdf.addPage([792, 612]);
      y = 568;
    }
    page.drawText(String(text).slice(0, 150), {
      x,
      y,
      size,
      font: isBold ? bold : font,
      color: rgb(0.08, 0.09, 0.11),
    });
  };
  draw("Courtyard Tips Tracker", 36, 16, true);
  draw(`Pay period: ${grid.period.start} to ${grid.period.end}`, 36, 10);
  if (submission?.submittedAt)
    draw(
      `Submitted: ${new Date(submission.submittedAt).toLocaleString()}`,
      520,
      8,
    );
  y -= 28;
  draw(
    [
      "Associate",
      ...grid.period.days.map((day: string) => day.slice(5)),
      "Total",
    ].join(" | "),
    36,
    7,
    true,
  );
  y -= 12;
  for (const row of grid.rows) {
    draw(
      [
        row.associate.employeeDisplayName,
        ...row.cells.map((cell: any) => `$${cell.tipAmount}`),
        `$${row.totalTips}`,
      ].join(" | "),
      36,
      6,
    );
    y -= 10;
  }
  y -= 10;
  draw(
    [
      "Daily totals",
      ...grid.dayTotals.map((day: any) => `$${day.totalTips}`),
      `$${grid.totalTips}`,
    ].join(" | "),
    36,
    7,
    true,
  );
  y -= 16;
  draw(
    `Week 1 total: $${grid.week1Total}   Week 2 total: $${grid.week2Total}   Grand total: $${grid.totalTips}`,
    36,
    10,
    true,
  );
  y -= 16;
  draw("Gross sales and tip percentage:", 36, 10, true);
  y -= 12;
  grid.dayTotals.forEach((day: any) => {
    draw(
      `${day.date}: gross $${day.grossSales} | tips $${day.totalTips} | ${Number(day.tipPercent || 0).toFixed(1)}%`,
      44,
      7,
    );
    y -= 10;
  });
  y -= 6;
  draw("Daily sales report photos:", 36, 10, true);
  y -= 12;
  grid.dayTotals.forEach((day: any) => {
    draw(
      `${day.date}: ${day.report ? day.report.originalFileName : "Missing"}`,
      44,
      7,
    );
    y -= 10;
  });
  if (grid.banquetReports?.length) {
    y -= 8;
    draw("Banquet tips report:", 36, 10, true);
    y -= 12;
    grid.banquetReports.forEach((report: any) => {
      draw(
        `${report.eventDate}: ${report.eventName} | sales $${report.grossSales} | tips $${report.banquetTips}`,
        44,
        7,
      );
      y -= 10;
      const assigned = Array.isArray(report.assignedAssociatesJson)
        ? report.assignedAssociatesJson
        : [];
      if (assigned.length) {
        draw(
          `Split: ${assigned.map((associate: any) => `${associate.displayName} $${associate.splitAmount}`).join(" | ")}`,
          52,
          7,
        );
        y -= 10;
      }
    });
    y -= 6;
    draw(`Banquet total: $${grid.banquetTotal}`, 44, 9, true);
  }
  const bytes = await pdf.save();
  const fileName = `grid-${grid.period.start}-${grid.period.end}.pdf`;
  const absolutePath = path.join(PDFS_DIR, fileName);
  await fs.promises.writeFile(absolutePath, bytes);
  return path.relative(process.cwd(), absolutePath);
}

async function sendTipsGridSubmissionEmail(grid: any) {
  const { client, fromEmail } = await getUncachableResendClient();
  const rows = grid.rows
    .map(
      (row: any) => `${row.associate.employeeDisplayName}: $${row.totalTips}`,
    )
    .join("\n");
  const daily = grid.dayTotals
    .map(
      (day: any) =>
        `${day.date}: tips $${day.totalTips} | gross $${day.grossSales} | tip ${Number(day.tipPercent || 0).toFixed(1)}% | report ${day.report ? "yes" : "no"}`,
    )
    .join("\n");
  const banquet = (grid.banquetReports || [])
    .map((report: any) => {
      const assigned =
        Array.isArray(report.assignedAssociatesJson) &&
        report.assignedAssociatesJson.length
          ? ` | split ${report.assignedAssociatesJson.map((associate: any) => `${associate.displayName} $${associate.splitAmount}`).join("; ")}`
          : "";
      return `${report.eventDate}: ${report.eventName} | tips $${report.banquetTips} | sales $${report.grossSales}${assigned}`;
    })
    .join("\n");
  const adminUrl = new URL(
    "/tips/admin",
    process.env.FRONTEND_BASE_URL || "https://readysetfly.us",
  ).toString();
  await client.emails.send({
    from: fromEmail,
    to: TIPS_SUBMISSION_RECIPIENT,
    subject: `Tips Submission - ${grid.period.start} to ${grid.period.end}`,
    text: [
      `Pay period: ${grid.period.start} to ${grid.period.end}`,
      `Week 1 total: $${grid.week1Total}`,
      `Week 2 total: $${grid.week2Total}`,
      `Grand total: $${grid.totalTips}`,
      `Manager review: ${adminUrl}`,
      "",
      "Associate totals:",
      rows,
      "",
      "Daily totals and report status:",
      daily,
      "",
      "Banquet tips report:",
      banquet || "No banquet tips reported.",
      banquet ? `Banquet total: $${grid.banquetTotal}` : "",
      "",
      "The PDF summary and sales report images are available through the protected Tips admin view.",
    ].join("\n"),
  });
}

export function registerTipsRoutes(app: Express) {
  const router = express.Router();

  router.post(
    "/auth/register",
    tipsAuthRateLimiter,
    async (req: any, res, next) => {
      try {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success)
          return res
            .status(400)
            .json({
              error: "Invalid registration details",
              validation: parsed.error.format(),
            });
        const email = normalizeEmail(parsed.data.email);
        const existing = await db
          .select({ id: tipsUsers.id })
          .from(tipsUsers)
          .where(eq(tipsUsers.email, email))
          .limit(1);
        if (existing.length)
          return res
            .status(409)
            .json({ error: "An account already exists for this email." });
        const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
        const displayName =
          parsed.data.employeeDisplayName?.trim() ||
          `${parsed.data.firstName} ${parsed.data.lastName}`.trim();
        const [user] = await db
          .insert(tipsUsers)
          .values({
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            email,
            employeeDisplayName: displayName,
            role: TIPS_SUPER_ADMIN_EMAILS.has(email)
              ? "super_admin"
              : "employee",
            hashedPassword,
            mustChangePassword: false,
          })
          .returning();
        req.session.tipsUserId = user.id;
        req.session.save(() =>
          res.status(201).json({ user: publicTipsUser(user) }),
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/auth/login",
    tipsAuthRateLimiter,
    async (req: any, res, next) => {
      try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success)
          return res.status(400).json({ error: "Invalid login details" });
        const [user] = await db
          .select()
          .from(tipsUsers)
          .where(eq(tipsUsers.email, normalizeEmail(parsed.data.email)))
          .limit(1);
        const loginPassword = parsed.data.password.trim();
        if (
          !user ||
          !(await bcrypt.compare(loginPassword, user.hashedPassword))
        ) {
          return res.status(401).json({ error: "Invalid email or password" });
        }
        if (user.disabledAt) {
          return res
            .status(403)
            .json({
              error: "This Tips account is disabled. Contact your manager.",
            });
        }
        req.session.tipsUserId = user.id;
        req.session.save(() => res.json({ user: publicTipsUser(user) }));
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/auth/password-reset-request",
    tipsAuthRateLimiter,
    async (req: any, res, next) => {
      try {
        const parsed = passwordResetRequestSchema.safeParse(req.body);
        if (!parsed.success)
          return res
            .status(400)
            .json({ error: "Enter a valid email address." });
        const email = normalizeEmail(parsed.data.email);
        const [user] = await db
          .select()
          .from(tipsUsers)
          .where(eq(tipsUsers.email, email))
          .limit(1);
        if (user && !user.disabledAt) {
          const temporaryPassword = `Temp${crypto.randomInt(100000, 999999)}!`;
          const [updated] = await db
            .update(tipsUsers)
            .set({
              hashedPassword: await bcrypt.hash(temporaryPassword, 12),
              mustChangePassword: true,
              updatedAt: new Date(),
            })
            .where(eq(tipsUsers.id, user.id))
            .returning();
          try {
            await sendTipsPasswordResetEmail({
              email: updated.email,
              firstName: updated.firstName,
              temporaryPassword,
              requestedByName: "Courtyard Associate Portal",
            });
          } catch (error) {
            console.error(
              "Failed to send public Courtyard password reset email:",
              error,
            );
          }
        }
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post("/auth/logout", (req: any, res) => {
    if (req.session) delete req.session.tipsUserId;
    req.session?.save(() => res.json({ ok: true }));
  });

  router.post(
    "/auth/change-password",
    requireTipsAuth,
    tipsAuthRateLimiter,
    async (req: any, res, next) => {
      try {
        const parsed = changePasswordSchema.safeParse(req.body);
        if (!parsed.success)
          return res
            .status(400)
            .json({
              error: "Invalid password details",
              validation: parsed.error.format(),
            });
        if (
          !(await bcrypt.compare(
            parsed.data.temporaryPassword,
            req.tipsUser.hashedPassword,
          ))
        ) {
          return res
            .status(400)
            .json({ error: "Temporary password is incorrect." });
        }
        if (
          await bcrypt.compare(
            parsed.data.newPassword,
            req.tipsUser.hashedPassword,
          )
        ) {
          return res
            .status(400)
            .json({
              error:
                "New password must be different from the temporary password.",
            });
        }
        const [updated] = await db
          .update(tipsUsers)
          .set({
            hashedPassword: await bcrypt.hash(parsed.data.newPassword, 12),
            mustChangePassword: false,
            updatedAt: new Date(),
          })
          .where(eq(tipsUsers.id, req.tipsUser.id))
          .returning();
        res.json({ user: publicTipsUser(updated) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/auth/me", async (req: any, res, next) => {
    try {
      const user = await getTipsUserBySession(req);
      if (user?.disabledAt && req.session) {
        delete req.session.tipsUserId;
        return req.session.save(() => res.json({ user: null }));
      }
      res.json({ user: user ? publicTipsUser(user) : null });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/dashboard",
    requireTipsAuth,
    requireTipsReady,
    async (req: any, res, next) => {
      try {
        const parsed = periodSchema.safeParse(req.query);
        if (!parsed.success)
          return res.status(400).json({ error: "Invalid pay period" });
        res.json(await buildDashboard(req.tipsUser.id, parsed.data.start));
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/entries",
    requireTipsAuth,
    requireTipsReady,
    async (req: any, res, next) => {
      try {
        const parsed = entrySchema.safeParse(req.body);
        if (!parsed.success)
          return res
            .status(400)
            .json({
              error: "Invalid tip entry",
              validation: parsed.error.format(),
            });
        const period = getPayPeriodForEntryDate(parsed.data.entryDate);
        if (!period)
          return res.status(400).json({ error: "Invalid entry date" });
        const currentPeriod = getPayPeriodForDate();
        if (period.start !== currentPeriod.start) {
          const existingSubmission = await getSubmission(
            req.tipsUser.id,
            period.start,
            period.end,
          );
          if (!existingSubmission || existingSubmission.status !== "reopened") {
            return res
              .status(400)
              .json({
                error:
                  "Tip date must be in the active pay period unless a manager reopened it.",
              });
          }
        }
        const submission = await getSubmission(
          req.tipsUser.id,
          period.start,
          period.end,
        );
        if (submission && submission.status !== "reopened")
          return res.status(423).json({ error: "This pay period is locked." });
        const reportedCcTips =
          parsed.data.creditTips > 0
            ? parsed.data.creditTips
            : parsed.data.tipAmount;

        const [entry] = await db
          .insert(tipEntries)
          .values({
            userId: req.tipsUser.id,
            entryDate: parsed.data.entryDate,
            payPeriodStart: period.start,
            payPeriodEnd: period.end,
            tipAmount: reportedCcTips.toFixed(2),
            cashTips: "0.00",
            creditTips: reportedCcTips.toFixed(2),
            grossSales: parsed.data.grossSales.toFixed(2),
            coversServed: null,
            shiftType: parsed.data.shiftType,
            notes: parsed.data.notes || null,
            status: "saved",
          })
          .onConflictDoUpdate({
            target: [tipEntries.userId, tipEntries.entryDate],
            set: {
              tipAmount: reportedCcTips.toFixed(2),
              cashTips: "0.00",
              creditTips: reportedCcTips.toFixed(2),
              grossSales: parsed.data.grossSales.toFixed(2),
              coversServed: null,
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
    },
  );

  router.post(
    "/entries/:entryId/attachment",
    requireTipsAuth,
    requireTipsReady,
    tipsUploadRateLimiter,
    salesReportUpload,
    async (req: any, res, next) => {
      try {
        const [entry] = await db
          .select()
          .from(tipEntries)
          .where(
            and(
              eq(tipEntries.id, req.params.entryId),
              eq(tipEntries.userId, req.tipsUser.id),
            ),
          )
          .limit(1);
        if (!entry)
          return res.status(404).json({ error: "Tip entry not found" });
        const submission = await getSubmission(
          req.tipsUser.id,
          entry.payPeriodStart,
          entry.payPeriodEnd,
        );
        if (submission && submission.status !== "reopened")
          return res.status(423).json({ error: "This pay period is locked." });
        if (!req.file)
          return res
            .status(400)
            .json({ error: "Sales report file is required" });

        await db
          .delete(tipEntryAttachments)
          .where(eq(tipEntryAttachments.tipEntryId, entry.id));
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
    },
  );

  router.get(
    "/attachments/:attachmentId/view",
    requireTipsAuth,
    requireTipsReady,
    async (req: any, res, next) => {
      try {
        const [row] = await db
          .select({ attachment: tipEntryAttachments, entry: tipEntries })
          .from(tipEntryAttachments)
          .innerJoin(
            tipEntries,
            eq(tipEntryAttachments.tipEntryId, tipEntries.id),
          )
          .where(eq(tipEntryAttachments.id, req.params.attachmentId))
          .limit(1);
        if (!row)
          return res.status(404).json({ error: "Attachment not found" });
        const isOwner = row.entry.userId === req.tipsUser.id;
        const isAdmin = isTipsManager(req.tipsUser);
        if (!isOwner && !isAdmin)
          return res.status(403).json({ error: "Forbidden" });
        const absolute = resolvePrivateFile(row.attachment.storagePath);
        if (!absolute || !fs.existsSync(absolute))
          return res.status(404).json({ error: "Attachment file not found" });
        res.type(row.attachment.mimeType);
        res.sendFile(absolute);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/submissions",
    requireTipsAuth,
    requireTipsReady,
    async (req: any, res, next) => {
      try {
        const parsed = periodSchema.safeParse(req.body || {});
        if (!parsed.success)
          return res.status(400).json({ error: "Invalid pay period" });
        const dashboard = await buildDashboard(
          req.tipsUser.id,
          parsed.data.start,
        );
        const missingImages = dashboard.days.filter(
          (day: any) =>
            day.entry &&
            (!day.entry.attachments || day.entry.attachments.length === 0),
        );
        if (missingImages.length > 0)
          return res
            .status(400)
            .json({
              error:
                "Every saved tip entry needs a sales report photo before final submission.",
            });
        const existing = await getSubmission(
          req.tipsUser.id,
          dashboard.period.start,
          dashboard.period.end,
        );
        if (existing && existing.status !== "reopened")
          return res
            .status(409)
            .json({ error: "This pay period has already been submitted." });

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
            target: [
              tipPeriodSubmissions.userId,
              tipPeriodSubmissions.payPeriodStart,
              tipPeriodSubmissions.payPeriodEnd,
            ],
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

        const pdfPath = await generateTipsPdf(
          req.tipsUser,
          dashboard,
          submission,
        );
        [submission] = await db
          .update(tipPeriodSubmissions)
          .set({ pdfPath, updatedAt: new Date() })
          .where(eq(tipPeriodSubmissions.id, submission.id))
          .returning();
        await db
          .update(tipEntries)
          .set({ status: "submitted", updatedAt: new Date() })
          .where(
            and(
              eq(tipEntries.userId, req.tipsUser.id),
              eq(tipEntries.payPeriodStart, dashboard.period.start),
              eq(tipEntries.payPeriodEnd, dashboard.period.end),
            ),
          );

        let emailSent = true;
        let emailWarning: string | undefined;
        try {
          await sendTipsSubmissionEmail(req.tipsUser, dashboard);
        } catch (error) {
          emailSent = false;
          emailWarning =
            "Pay period was submitted, but the email notification could not be sent.";
          console.error("Failed to send tips submission email:", error);
        }

        res.status(emailSent ? 201 : 202).json({
          submission: {
            ...submission,
            week1Total: moneyString(submission.week1Total),
            week2Total: moneyString(submission.week2Total),
            totalTips: moneyString(submission.totalTips),
          },
          emailSent,
          warning: emailWarning,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/submissions/pdf",
    requireTipsAuth,
    requireTipsReady,
    async (req: any, res, next) => {
      try {
        const parsed = periodSchema.safeParse(req.query);
        if (!parsed.success)
          return res.status(400).json({ error: "Invalid pay period" });
        const dashboard = await buildDashboard(
          req.tipsUser.id,
          parsed.data.start,
        );
        const submission = await getSubmission(
          req.tipsUser.id,
          dashboard.period.start,
          dashboard.period.end,
        );
        const pdfPath =
          submission?.pdfPath ||
          (await generateTipsPdf(req.tipsUser, dashboard, submission));
        const absolute = resolvePrivateFile(pdfPath);
        if (!absolute || !fs.existsSync(absolute))
          return res.status(404).json({ error: "PDF not found" });
        res.download(
          absolute,
          `courtyard-tips-${dashboard.period.start}-${dashboard.period.end}.pdf`,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/admin/submissions",
    requireTipsAdmin,
    async (_req: any, res, next) => {
      try {
        const [rows, gridRows] = await Promise.all([
          db
            .select({ submission: tipPeriodSubmissions, user: tipsUsers })
            .from(tipPeriodSubmissions)
            .innerJoin(tipsUsers, eq(tipPeriodSubmissions.userId, tipsUsers.id))
            .orderBy(
              desc(tipPeriodSubmissions.payPeriodStart),
              asc(tipsUsers.employeeDisplayName),
            ),
          db
            .select()
            .from(tipGridSubmissions)
            .orderBy(desc(tipGridSubmissions.payPeriodStart)),
        ]);
        const submissions = [
          ...gridRows.map((submission) => ({
            ...submission,
            type: "grid",
            user: {
              id: "tips-grid",
              email: TIPS_SUBMISSION_RECIPIENT,
              firstName: "Courtyard",
              lastName: "Bistro",
              employeeDisplayName: "Shared Tips Grid",
              position: "All associates",
              role: "manager",
              mustChangePassword: false,
              disabledAt: null,
              isAdmin: true,
              isSuperAdmin: false,
            },
            week1Total: moneyString(submission.week1Total),
            week2Total: moneyString(submission.week2Total),
            totalTips: moneyString(submission.totalTips),
          })),
          ...rows.map((row) => ({
            ...row.submission,
            type: "individual",
            user: publicTipsUser(row.user),
            week1Total: moneyString(row.submission.week1Total),
            week2Total: moneyString(row.submission.week2Total),
            totalTips: moneyString(row.submission.totalTips),
          })),
        ].sort((a, b) =>
          String(b.payPeriodStart).localeCompare(String(a.payPeriodStart)),
        );
        res.json({ submissions });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/admin/users", requireTipsAdmin, async (_req: any, res, next) => {
    try {
      const [allUsers, bistroUsers] = await Promise.all([
        db.select().from(tipsUsers).orderBy(asc(tipsUsers.employeeDisplayName)),
        getBistroTipsUsers(),
      ]);
      const reconciledUsers = await reconcileTipsUsersWithSchedule(allUsers);
      const bistroIds = new Set(bistroUsers.map((user) => user.id));
      const users = reconciledUsers.filter(
        (user) => bistroIds.has(user.id) || isTipsManager(user),
      );
      res.json({ users: users.map(publicTipsUser) });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/admin/tool-access-users",
    requireTipsSuperAdmin,
    async (_req: any, res, next) => {
      try {
        const users = await db
          .select()
          .from(tipsUsers)
          .orderBy(asc(tipsUsers.employeeDisplayName));
        const reconciledUsers = await reconcileTipsUsersWithSchedule(users);
        res.json({
          users: reconciledUsers.map(publicTipsUser),
          tools: COURTYARD_TOOL_KEYS,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post("/admin/users", requireTipsAdmin, async (req: any, res, next) => {
    try {
      const parsed = adminCreateTipsUserSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({
            error: "Invalid associate details",
            validation: parsed.error.format(),
          });
      const email = normalizeEmail(parsed.data.email);
      const existing = await db
        .select({ id: tipsUsers.id })
        .from(tipsUsers)
        .where(eq(tipsUsers.email, email))
        .limit(1);
      if (existing.length)
        return res
          .status(409)
          .json({ error: "An associate already exists for this email." });
      const requestedRole = isTipsSuperAdmin(req.tipsUser)
        ? parsed.data.role
        : "employee";
      const [created] = await db
        .insert(tipsUsers)
        .values({
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          email,
          employeeDisplayName:
            parsed.data.employeeDisplayName?.trim() ||
            `${parsed.data.firstName} ${parsed.data.lastName}`.trim(),
          position: parsed.data.position?.trim() || null,
          role: TIPS_SUPER_ADMIN_EMAILS.has(email)
            ? "super_admin"
            : requestedRole,
          hashedPassword: await bcrypt.hash(parsed.data.password, 12),
          mustChangePassword: true,
        })
        .returning();
      await db.insert(tipAdminActions).values({
        actorUserId: req.tipsUser.id,
        targetUserId: created.id,
        action: "user_created",
        metadataJson: { role: created.role, position: created.position },
      });
      let emailSent = true;
      let emailWarning: string | undefined;
      try {
        await sendTipsAssociateCreatedEmail({
          email,
          firstName: created.firstName,
          employeeDisplayName: created.employeeDisplayName,
          temporaryPassword: parsed.data.password,
          createdByName: req.tipsUser.employeeDisplayName || req.tipsUser.email,
        });
      } catch (error) {
        emailSent = false;
        emailWarning =
          "Associate was created, but the email notification could not be sent.";
        console.error("Failed to send tips associate created email:", error);
      }
      res
        .status(emailSent ? 201 : 202)
        .json({
          user: publicTipsUser(created),
          emailSent,
          warning: emailWarning,
        });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/admin/users/:id/password-reset",
    requireTipsSuperAdmin,
    async (req: any, res, next) => {
      try {
        const parsed = adminPasswordResetSchema.safeParse(req.body);
        if (!parsed.success)
          return res
            .status(400)
            .json({
              error: "Temporary password must be at least 8 characters.",
            });
        const [target] = await db
          .select()
          .from(tipsUsers)
          .where(eq(tipsUsers.id, req.params.id))
          .limit(1);
        if (!target)
          return res.status(404).json({ error: "Tips user not found" });
        if (target.disabledAt)
          return res
            .status(400)
            .json({
              error:
                "Enable this associate before requesting a password change.",
            });

        const [updated] = await db
          .update(tipsUsers)
          .set({
            hashedPassword: await bcrypt.hash(
              parsed.data.temporaryPassword,
              12,
            ),
            mustChangePassword: true,
            updatedAt: new Date(),
          })
          .where(eq(tipsUsers.id, target.id))
          .returning();
        await db.insert(tipAdminActions).values({
          actorUserId: req.tipsUser.id,
          targetUserId: updated.id,
          action: "user_password_reset_requested",
          metadataJson: { email: updated.email },
        });

        let emailSent = true;
        let emailWarning: string | undefined;
        try {
          await sendTipsPasswordResetEmail({
            email: updated.email,
            firstName: updated.firstName,
            temporaryPassword: parsed.data.temporaryPassword,
            requestedByName:
              req.tipsUser.employeeDisplayName || req.tipsUser.email,
          });
        } catch (error) {
          emailSent = false;
          emailWarning =
            "Password change was required, but the email notification could not be sent.";
          console.error("Failed to send tips password reset email:", error);
        }
        res
          .status(emailSent ? 200 : 202)
          .json({
            user: publicTipsUser(updated),
            emailSent,
            warning: emailWarning,
          });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/admin/users/:id/password-reset-email",
    requireTipsSuperAdmin,
    async (req: any, res, next) => {
      try {
        const [storedTarget] = await db
          .select()
          .from(tipsUsers)
          .where(eq(tipsUsers.id, req.params.id))
          .limit(1);
        if (!storedTarget)
          return res.status(404).json({ error: "Associate account not found" });
        const target = await reconcileTipsUserScheduleEmail(storedTarget);
        if (target.disabledAt)
          return res
            .status(400)
            .json({
              error: "Enable this associate before sending a password reset.",
            });
        const email = normalizeEmail(String(target.email || ""));
        if (!isDeliverableEmail(email)) {
          return res
            .status(400)
            .json({
              error:
                "This associate does not have a deliverable email address on file. Update the email in the Schedule employee profile and try again.",
            });
        }

        const temporaryPassword = `Temp${crypto.randomInt(100000, 999999)}!`;
        const [updated] = await db
          .update(tipsUsers)
          .set({
            hashedPassword: await bcrypt.hash(temporaryPassword, 12),
            mustChangePassword: true,
            updatedAt: new Date(),
          })
          .where(eq(tipsUsers.id, target.id))
          .returning();
        await db.insert(tipAdminActions).values({
          actorUserId: req.tipsUser.id,
          targetUserId: updated.id,
          action: "user_password_reset_email_sent",
          metadataJson: { email: updated.email },
        });

        try {
          await sendTipsPasswordResetEmail({
            email: updated.email,
            firstName: updated.firstName,
            temporaryPassword,
            requestedByName:
              req.tipsUser.employeeDisplayName || req.tipsUser.email,
          });
        } catch (error) {
          console.error(
            "Failed to send Courtyard password reset email:",
            error,
          );
          return res
            .status(502)
            .json({
              error:
                "The password was reset, but the email could not be delivered. Send another reset after checking the email address.",
            });
        }
        res.json({ user: publicTipsUser(updated), emailSent: true });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/admin/users/:id/disabled",
    requireTipsAdmin,
    async (req: any, res, next) => {
      try {
        const parsed = adminDisableUserSchema.safeParse(req.body);
        if (!parsed.success)
          return res.status(400).json({ error: "Invalid disabled state" });
        const [target] = await db
          .select()
          .from(tipsUsers)
          .where(eq(tipsUsers.id, req.params.id))
          .limit(1);
        if (!target)
          return res.status(404).json({ error: "Tips user not found" });
        if (isTipsSuperAdmin(target))
          return res
            .status(400)
            .json({ error: "The Tips super admin cannot be disabled." });
        if (!isTipsSuperAdmin(req.tipsUser) && isTipsManager(target)) {
          return res
            .status(403)
            .json({ error: "Only the super admin can disable managers." });
        }
        const [updated] = await db
          .update(tipsUsers)
          .set({
            disabledAt: parsed.data.disabled ? new Date() : null,
            disabledBy: parsed.data.disabled ? req.tipsUser.id : null,
            updatedAt: new Date(),
          })
          .where(eq(tipsUsers.id, target.id))
          .returning();
        await db.insert(tipAdminActions).values({
          actorUserId: req.tipsUser.id,
          targetUserId: updated.id,
          action: parsed.data.disabled ? "user_disabled" : "user_enabled",
          metadataJson: { email: updated.email },
        });
        res.json({ user: publicTipsUser(updated) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/admin/users/:id/tool-access",
    requireTipsSuperAdmin,
    async (req: any, res, next) => {
      try {
        const parsed = updateToolAccessSchema.safeParse(req.body);
        if (!parsed.success)
          return res.status(400).json({ error: "Invalid tool access change" });
        const [target] = await db
          .select()
          .from(tipsUsers)
          .where(eq(tipsUsers.id, req.params.id))
          .limit(1);
        if (!target)
          return res.status(404).json({ error: "Courtyard user not found" });
        if (isTipsSuperAdmin(target) && !parsed.data.enabled) {
          return res
            .status(400)
            .json({ error: "Super admin tool access cannot be withdrawn." });
        }
        const nextAccess = {
          ...getToolAccess(target),
          [parsed.data.tool]: parsed.data.enabled,
        };
        const [updated] = await db
          .update(tipsUsers)
          .set({ toolAccessJson: nextAccess, updatedAt: new Date() } as any)
          .where(eq(tipsUsers.id, target.id))
          .returning();
        await db.insert(tipAdminActions).values({
          actorUserId: req.tipsUser.id,
          targetUserId: updated.id,
          action: "courtyard_tool_access_updated",
          metadataJson: {
            tool: parsed.data.tool,
            enabled: parsed.data.enabled,
          },
        });
        res.json({ user: publicTipsUser(updated) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/admin/users/:id/position",
    requireTipsAdmin,
    async (req: any, res, next) => {
      try {
        const parsed = updateTipsUserPositionSchema.safeParse(req.body);
        if (!parsed.success)
          return res.status(400).json({ error: "Invalid position" });
        const normalizedPosition = parsed.data.position?.trim() || null;
        const [updated] = await db
          .update(tipsUsers)
          .set({ position: normalizedPosition, updatedAt: new Date() })
          .where(eq(tipsUsers.id, req.params.id))
          .returning();
        if (!updated)
          return res.status(404).json({ error: "Tips user not found" });
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
    },
  );

  router.patch(
    "/admin/users/:id/role",
    requireTipsSuperAdmin,
    async (req: any, res, next) => {
      try {
        const parsed = updateTipsUserRoleSchema.safeParse(req.body);
        if (!parsed.success)
          return res.status(400).json({ error: "Invalid role" });
        const [target] = await db
          .select()
          .from(tipsUsers)
          .where(eq(tipsUsers.id, req.params.id))
          .limit(1);
        if (!target)
          return res.status(404).json({ error: "Tips user not found" });
        const targetEmail = String(target.email || "").toLowerCase();
        const nextRole = TIPS_SUPER_ADMIN_EMAILS.has(targetEmail)
          ? "super_admin"
          : parsed.data.role;
        const [updated] = await db
          .update(tipsUsers)
          .set({ role: nextRole, updatedAt: new Date() })
          .where(eq(tipsUsers.id, target.id))
          .returning();
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
    },
  );

  router.delete(
    "/admin/users/:id",
    requireTipsSuperAdmin,
    async (req: any, res, next) => {
      try {
        const [target] = await db
          .select()
          .from(tipsUsers)
          .where(eq(tipsUsers.id, req.params.id))
          .limit(1);
        if (!target)
          return res.status(404).json({ error: "Tips user not found" });
        if (isTipsSuperAdmin(target))
          return res
            .status(400)
            .json({ error: "The Tips super admin cannot be deleted." });
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
    },
  );

  router.post(
    "/admin/submissions/:id/status",
    requireTipsAdmin,
    async (req: any, res, next) => {
      try {
        const status = z
          .enum(["reopened", "approved", "exported"])
          .parse(req.body?.status);
        let [submission] = await db
          .update(tipPeriodSubmissions)
          .set({
            status,
            reviewedAt: new Date(),
            reviewedBy: req.tipsUser.id,
            updatedAt: new Date(),
          })
          .where(eq(tipPeriodSubmissions.id, req.params.id))
          .returning();
        if (!submission) {
          const [gridSubmission] = await db
            .update(tipGridSubmissions)
            .set({
              status,
              reviewedAt: new Date(),
              reviewedBy: req.tipsUser.id,
              updatedAt: new Date(),
            })
            .where(eq(tipGridSubmissions.id, req.params.id))
            .returning();
          if (!gridSubmission)
            return res.status(404).json({ error: "Submission not found" });
          if (status === "reopened") {
            await db
              .update(tipEntries)
              .set({ status: "saved", updatedAt: new Date() })
              .where(
                and(
                  eq(tipEntries.payPeriodStart, gridSubmission.payPeriodStart),
                  eq(tipEntries.payPeriodEnd, gridSubmission.payPeriodEnd),
                ),
              );
          }
          await db.insert(tipAdminActions).values({
            actorUserId: req.tipsUser.id,
            targetUserId: null,
            action: `grid_submission_${status}`,
            metadataJson: {
              submissionId: gridSubmission.id,
              payPeriodStart: gridSubmission.payPeriodStart,
              payPeriodEnd: gridSubmission.payPeriodEnd,
            },
          });
          return res.json({ submission: gridSubmission });
        }
        if (status === "reopened") {
          await db
            .update(tipEntries)
            .set({ status: "saved", updatedAt: new Date() })
            .where(
              and(
                eq(tipEntries.userId, submission.userId),
                eq(tipEntries.payPeriodStart, submission.payPeriodStart),
                eq(tipEntries.payPeriodEnd, submission.payPeriodEnd),
              ),
            );
        }
        await db.insert(tipAdminActions).values({
          actorUserId: req.tipsUser.id,
          targetUserId: submission.userId,
          action: `submission_${status}`,
          metadataJson: {
            submissionId: submission.id,
            payPeriodStart: submission.payPeriodStart,
            payPeriodEnd: submission.payPeriodEnd,
          },
        });
        res.json({ submission });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/admin/submissions/:id/pdf",
    requireTipsAdmin,
    async (req: any, res, next) => {
      try {
        const [row] = await db
          .select({ submission: tipPeriodSubmissions, user: tipsUsers })
          .from(tipPeriodSubmissions)
          .innerJoin(tipsUsers, eq(tipPeriodSubmissions.userId, tipsUsers.id))
          .where(eq(tipPeriodSubmissions.id, req.params.id))
          .limit(1);
        if (!row) {
          const [gridSubmission] = await db
            .select()
            .from(tipGridSubmissions)
            .where(eq(tipGridSubmissions.id, req.params.id))
            .limit(1);
          if (!gridSubmission)
            return res.status(404).json({ error: "Submission not found" });
          const grid = await buildTipsGrid(gridSubmission.payPeriodStart);
          const pdfPath =
            gridSubmission.pdfPath ||
            (await generateTipsGridPdf(grid, gridSubmission));
          const absolute = resolvePrivateFile(pdfPath);
          if (!absolute || !fs.existsSync(absolute))
            return res.status(404).json({ error: "PDF not found" });
          return res.download(
            absolute,
            `courtyard-tips-grid-${gridSubmission.payPeriodStart}.pdf`,
          );
        }
        const dashboard = await buildDashboard(
          row.user.id,
          row.submission.payPeriodStart,
        );
        const pdfPath =
          row.submission.pdfPath ||
          (await generateTipsPdf(row.user, dashboard, row.submission));
        const absolute = resolvePrivateFile(pdfPath);
        if (!absolute || !fs.existsSync(absolute))
          return res.status(404).json({ error: "PDF not found" });
        res.download(
          absolute,
          `courtyard-tips-${row.user.employeeDisplayName}-${row.submission.payPeriodStart}.pdf`,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/admin/export.csv",
    requireTipsAdmin,
    async (_req: any, res, next) => {
      try {
        const [rows, gridRows] = await Promise.all([
          db
            .select({ submission: tipPeriodSubmissions, user: tipsUsers })
            .from(tipPeriodSubmissions)
            .innerJoin(tipsUsers, eq(tipPeriodSubmissions.userId, tipsUsers.id))
            .orderBy(
              desc(tipPeriodSubmissions.payPeriodStart),
              asc(tipsUsers.employeeDisplayName),
            ),
          db
            .select()
            .from(tipGridSubmissions)
            .orderBy(desc(tipGridSubmissions.payPeriodStart)),
        ]);
        const csv = [
          [
            "employee",
            "email",
            "position",
            "period_start",
            "period_end",
            "week1_total",
            "week2_total",
            "total_tips",
            "status",
            "submitted_at",
          ].join(","),
          ...gridRows.map((submission) =>
            [
              JSON.stringify("Shared Tips Grid"),
              JSON.stringify(TIPS_SUBMISSION_RECIPIENT),
              JSON.stringify("All associates"),
              submission.payPeriodStart,
              submission.payPeriodEnd,
              moneyString(submission.week1Total),
              moneyString(submission.week2Total),
              moneyString(submission.totalTips),
              submission.status,
              submission.submittedAt
                ? new Date(submission.submittedAt).toISOString()
                : "",
            ].join(","),
          ),
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
              row.submission.submittedAt
                ? new Date(row.submission.submittedAt).toISOString()
                : "",
            ].join(","),
          ),
        ].join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="courtyard-tips-export.csv"',
        );
        res.send(csv);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/admin/export-daily.csv",
    requireTipsAdmin,
    async (_req: any, res, next) => {
      try {
        const rows = await db
          .select({ entry: tipEntries, user: tipsUsers })
          .from(tipEntries)
          .innerJoin(tipsUsers, eq(tipEntries.userId, tipsUsers.id))
          .orderBy(
            desc(tipEntries.payPeriodStart),
            asc(tipsUsers.employeeDisplayName),
            asc(tipEntries.entryDate),
          );
        const csv = [
          [
            "employee",
            "email",
            "position",
            "entry_date",
            "period_start",
            "period_end",
            "shift_type",
            "gross_sales",
            "cc_tips",
            "notes",
            "status",
          ].join(","),
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
              moneyString(row.entry.creditTips),
              JSON.stringify(row.entry.notes || ""),
              row.entry.status,
            ].join(","),
          ),
        ].join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="courtyard-tips-daily-export.csv"',
        );
        res.send(csv);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/kiosk/status", async (req: any, res, next) => {
    try {
      const user = await getTipsUserBySession(req);
      if (!user || user.disabledAt || user.mustChangePassword) {
        return res.json({
          unlocked: false,
          hasPin: Boolean(
            (await getKioskPinHash()) || process.env.TIPS_KIOSK_PIN,
          ),
          requiresLogin: true,
        });
      }
      if (!(await hasBistroTipsAccess(user))) {
        return res
          .status(403)
          .json({ error: "Bistro role required for tips access" });
      }
      const adminUnlocked = Boolean(isTipsManager(user));
      res.json({
        unlocked: Boolean(req.session?.tipsKioskUnlocked || adminUnlocked),
        hasPin: Boolean(
          (await getKioskPinHash()) || process.env.TIPS_KIOSK_PIN,
        ),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/kiosk/login",
    tipsAuthRateLimiter,
    async (req: any, res, next) => {
      try {
        const user = await getTipsUserBySession(req);
        if (!user || user.disabledAt || user.mustChangePassword)
          return res
            .status(401)
            .json({
              error: "Courtyard login required before entering the Tips PIN.",
            });
        if (!(await hasBistroTipsAccess(user)))
          return res
            .status(403)
            .json({ error: "Bistro role required for tips access." });
        const parsed = kioskPinSchema.safeParse(req.body);
        if (!parsed.success)
          return res.status(400).json({ error: "Enter the 5 digit PIN." });
        if (!(await verifyKioskPin(parsed.data.pin)))
          return res.status(401).json({ error: "Invalid PIN." });
        req.session.tipsKioskUnlocked = true;
        req.session.save(() => res.json({ unlocked: true }));
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/food-cost-items", requireTipsGridAccess, async (_req: any, res, next) => {
    try {
      const items = await db.select().from(bistroFoodCostItems).where(eq(bistroFoodCostItems.active, true)).orderBy(asc(bistroFoodCostItems.itemName));
      res.json({ items });
    } catch (error) { next(error); }
  });

  router.get("/employee-meal-recipes", requireTipsGridAccess, async (_req: any, res, next) => {
    try {
      const catalog = await db.select().from(bistroFoodCostItems).where(eq(bistroFoodCostItems.active, true));
      res.json({ recipes: EMPLOYEE_MEAL_RECIPES.map((recipe) => calculateEmployeeMealRecipe(recipe, catalog)) });
    } catch (error) { next(error); }
  });

  router.post("/food-cost-items/import", requireTipsAdmin, (req: any, res, next) => {
    invoiceUpload.single("invoice")(req, res, async (uploadError: any) => {
      try {
        if (uploadError) return res.status(400).json({ error: uploadError.message || "Unable to upload invoice." });
        if (!req.file) return res.status(400).json({ error: "Choose a PDF vendor invoice." });
        const parsedInvoice = parseVendorInvoice(await extractInvoiceText(req.file.buffer), req.file.originalname);
        let imported = 0;
        for (const item of parsedInvoice.items) {
          const [existing] = await db.select().from(bistroFoodCostItems).where(and(eq(bistroFoodCostItems.vendor, item.vendor), eq(bistroFoodCostItems.vendorItemNumber, item.vendorItemNumber))).limit(1);
          const values = { ...item, unitsPerPack: item.unitsPerPack.toFixed(4), packCost: item.packCost.toFixed(2), costPerUnit: item.costPerUnit.toFixed(4), active: true, createdByUserId: req.tipsUser.id, updatedAt: new Date() };
          if (existing) await db.update(bistroFoodCostItems).set(values).where(eq(bistroFoodCostItems.id, existing.id));
          else await db.insert(bistroFoodCostItems).values(values);
          imported += 1;
        }
        res.json({ ...parsedInvoice, items: undefined, imported });
      } catch (error) { next(error); }
    });
  });

  router.patch("/food-cost-items/:id", requireTipsAdmin, async (req: any, res, next) => {
    try {
      const parsed = z.object({ itemName: z.string().trim().min(1).max(250), costingUnit: z.string().trim().min(1).max(40), unitsPerPack: z.coerce.number().positive(), packCost: z.coerce.number().min(0) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Enter a valid item, costing unit, units per pack, and pack cost." });
      const [item] = await db.update(bistroFoodCostItems).set({ ...parsed.data, unitsPerPack: parsed.data.unitsPerPack.toFixed(4), packCost: parsed.data.packCost.toFixed(2), costPerUnit: (parsed.data.packCost / parsed.data.unitsPerPack).toFixed(4), updatedAt: new Date() }).where(eq(bistroFoodCostItems.id, req.params.id)).returning();
      if (!item) return res.status(404).json({ error: "Cost item not found." });
      res.json({ item });
    } catch (error) { next(error); }
  });

  router.get("/food-waste", requireTipsGridAccess, async (req: any, res, next) => {
    try {
      const month = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month)
        ? req.query.month
        : new Date().toISOString().slice(0, 7);
      const start = `${month}-01`;
      const endDate = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
      const end = endDate.toISOString().slice(0, 10);
      const rows = await db
        .select({ entry: bistroFoodWasteEntries, recordedByName: tipsUsers.employeeDisplayName })
        .from(bistroFoodWasteEntries)
        .leftJoin(tipsUsers, eq(bistroFoodWasteEntries.recordedByUserId, tipsUsers.id))
        .where(and(gte(bistroFoodWasteEntries.entryDate, start), lte(bistroFoodWasteEntries.entryDate, end)))
        .orderBy(desc(bistroFoodWasteEntries.entryDate), desc(bistroFoodWasteEntries.createdAt));
      res.json({
        month,
        entries: rows.map(({ entry, recordedByName }) => ({
          ...entry,
          recordedByName: recordedByName || "Former associate",
          canEdit: isTipsManager(req.tipsUser) || entry.recordedByUserId === req.tipsUser.id,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/food-waste/blank-form.pdf", requireTipsGridAccess, async (_req: any, res, next) => {
    try {
      const pdf = await buildBlankFoodWasteLogPdf();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="bistro-food-waste-log.pdf"');
      res.send(pdf);
    } catch (error) { next(error); }
  });

  router.post("/food-waste", requireTipsGridAccess, async (req: any, res, next) => {
    try {
      const parsed = foodWasteEntrySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Enter a valid date, food item, quantity, reason, and total cost.", validation: parsed.error.format() });
      let recipeCost: ReturnType<typeof calculateEmployeeMealRecipe> | null = null;
      if (parsed.data.reason === "shift_meal") {
        const recipe = EMPLOYEE_MEAL_RECIPES.find((candidate) => candidate.id === parsed.data.employeeMealRecipeId);
        if (!recipe) return res.status(400).json({ error: "Select an employee meal from the menu." });
        const catalog = await db.select().from(bistroFoodCostItems).where(eq(bistroFoodCostItems.active, true));
        recipeCost = calculateEmployeeMealRecipe(recipe, catalog);
        if (recipeCost.servingCost <= 0) return res.status(400).json({ error: "This meal does not have any matched invoice costs yet. Ask a manager to import or review the food-cost catalog." });
      }
      const [entry] = await db.insert(bistroFoodWasteEntries).values({
        ...parsed.data,
        foodItem: recipeCost?.name || parsed.data.foodItem,
        quantity: parsed.data.quantity.toFixed(2),
        totalCost: (recipeCost ? recipeCost.servingCost * parsed.data.quantity : parsed.data.totalCost).toFixed(2),
        unitCost: recipeCost ? recipeCost.servingCost.toFixed(4) : parsed.data.unitCost == null ? null : parsed.data.unitCost.toFixed(4),
        unit: recipeCost ? "meal" : parsed.data.unit || null,
        catalogItemId: recipeCost ? null : parsed.data.catalogItemId,
        employeeMealRecipeId: recipeCost?.id || null,
        recipeCostBreakdown: recipeCost?.breakdown || null,
        notes: parsed.data.notes || null,
        recordedByUserId: req.tipsUser.id,
        updatedByUserId: req.tipsUser.id,
      }).returning();
      res.status(201).json({ entry });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/food-waste/:id", requireTipsGridAccess, async (req: any, res, next) => {
    try {
      const parsed = foodWasteEntrySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Enter a valid date, food item, quantity, reason, and total cost.", validation: parsed.error.format() });
      const [existing] = await db.select().from(bistroFoodWasteEntries).where(eq(bistroFoodWasteEntries.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Waste entry not found." });
      if (!isTipsManager(req.tipsUser) && existing.recordedByUserId !== req.tipsUser.id) return res.status(403).json({ error: "You can only edit entries you recorded." });
      let recipeCost: ReturnType<typeof calculateEmployeeMealRecipe> | null = null;
      if (parsed.data.reason === "shift_meal") {
        const recipe = EMPLOYEE_MEAL_RECIPES.find((candidate) => candidate.id === parsed.data.employeeMealRecipeId);
        if (!recipe) return res.status(400).json({ error: "Select an employee meal from the menu." });
        const catalog = await db.select().from(bistroFoodCostItems).where(eq(bistroFoodCostItems.active, true));
        recipeCost = calculateEmployeeMealRecipe(recipe, catalog);
        if (recipeCost.servingCost <= 0) return res.status(400).json({ error: "This meal does not have any matched invoice costs yet. Ask a manager to import or review the food-cost catalog." });
      }
      const [entry] = await db.update(bistroFoodWasteEntries).set({
        ...parsed.data,
        foodItem: recipeCost?.name || parsed.data.foodItem,
        quantity: parsed.data.quantity.toFixed(2),
        totalCost: (recipeCost ? recipeCost.servingCost * parsed.data.quantity : parsed.data.totalCost).toFixed(2),
        unitCost: recipeCost ? recipeCost.servingCost.toFixed(4) : parsed.data.unitCost == null ? null : parsed.data.unitCost.toFixed(4),
        unit: recipeCost ? "meal" : parsed.data.unit || null,
        catalogItemId: recipeCost ? null : parsed.data.catalogItemId,
        employeeMealRecipeId: recipeCost?.id || null,
        recipeCostBreakdown: recipeCost?.breakdown || null,
        notes: parsed.data.notes || null,
        updatedByUserId: req.tipsUser.id,
        updatedAt: new Date(),
      }).where(eq(bistroFoodWasteEntries.id, existing.id)).returning();
      res.json({ entry });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/food-waste/:id", requireTipsGridAccess, async (req: any, res, next) => {
    try {
      const [existing] = await db.select().from(bistroFoodWasteEntries).where(eq(bistroFoodWasteEntries.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Waste entry not found." });
      if (!isTipsManager(req.tipsUser) && existing.recordedByUserId !== req.tipsUser.id) return res.status(403).json({ error: "You can only delete entries you recorded." });
      await db.delete(bistroFoodWasteEntries).where(eq(bistroFoodWasteEntries.id, existing.id));
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get("/shared-pin/status", async (req: any, res, next) => {
    try {
      const user = await getTipsUserBySession(req);
      if (!user || user.disabledAt || user.mustChangePassword) {
        return res.json({
          unlocked: false,
          hasPin: Boolean(
            (await getKioskPinHash()) || process.env.TIPS_KIOSK_PIN,
          ),
          requiresLogin: true,
        });
      }
      const adminUnlocked = Boolean(isTipsManager(user));
      res.json({
        unlocked: Boolean(
          req.session?.courtyardSharedPinUnlocked || adminUnlocked,
        ),
        hasPin: Boolean(
          (await getKioskPinHash()) || process.env.TIPS_KIOSK_PIN,
        ),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/shared-pin/login",
    tipsAuthRateLimiter,
    async (req: any, res, next) => {
      try {
        const user = await getTipsUserBySession(req);
        if (!user || user.disabledAt || user.mustChangePassword)
          return res
            .status(401)
            .json({
              error: "Courtyard login required before entering the PIN.",
            });
        const parsed = kioskPinSchema.safeParse(req.body);
        if (!parsed.success)
          return res.status(400).json({ error: "Enter the 5 digit PIN." });
        if (!(await verifyKioskPin(parsed.data.pin)))
          return res.status(401).json({ error: "Invalid PIN." });
        req.session.courtyardSharedPinUnlocked = true;
        req.session.save(() => res.json({ unlocked: true }));
      } catch (error) {
        next(error);
      }
    },
  );

  router.post("/kiosk/logout", (req: any, res) => {
    if (req.session) delete req.session.tipsKioskUnlocked;
    if (req.session) delete req.session.courtyardSharedPinUnlocked;
    req.session?.save(() => res.json({ ok: true }));
  });

  router.post(
    "/admin/kiosk-pin",
    requireTipsSuperAdmin,
    tipsAuthRateLimiter,
    async (req: any, res, next) => {
      try {
        const parsed = kioskPinSchema.safeParse(req.body);
        if (!parsed.success)
          return res
            .status(400)
            .json({ error: "PIN must be exactly 5 digits." });
        await db
          .insert(tipsKioskSettings)
          .values({
            key: "pin_hash",
            value: await bcrypt.hash(parsed.data.pin, 12),
            updatedBy: req.tipsUser.id,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: tipsKioskSettings.key,
            set: {
              value: await bcrypt.hash(parsed.data.pin, 12),
              updatedBy: req.tipsUser.id,
              updatedAt: new Date(),
            },
          });
        await db
          .insert(tipAdminActions)
          .values({
            actorUserId: req.tipsUser.id,
            action: "kiosk_pin_updated",
            metadataJson: {},
          });
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/grid", requireTipsGridAccess, async (req: any, res, next) => {
    try {
      const parsed = periodSchema.safeParse(req.query);
      if (!parsed.success)
        return res.status(400).json({ error: "Invalid pay period" });
      res.setHeader("Cache-Control", "no-store");
      res.json(await buildTipsGrid(parsed.data.start, req.tipsUser));
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/grid/periods",
    requireTipsGridAccess,
    async (_req: any, res, next) => {
      try {
        res.setHeader("Cache-Control", "no-store");
        const current = getPayPeriodForDate();
        const submissions = await db
          .select({
            start: tipGridSubmissions.payPeriodStart,
            end: tipGridSubmissions.payPeriodEnd,
            status: tipGridSubmissions.status,
            submittedAt: tipGridSubmissions.submittedAt,
          })
          .from(tipGridSubmissions)
          .orderBy(desc(tipGridSubmissions.payPeriodStart));
        const periods = new Map<
          string,
          {
            start: string;
            end: string;
            status: string;
            submittedAt: Date | null;
            current: boolean;
          }
        >();
        for (let offset = 0; offset < 12; offset += 1) {
          const startDate = addUtcDays(
            parseDateKey(current.start)!,
            offset * -14,
          );
          const start = toDateKey(startDate);
          periods.set(start, {
            start,
            end: toDateKey(addUtcDays(startDate, 13)),
            status: offset === 0 ? "open" : "historical",
            submittedAt: null,
            current: offset === 0,
          });
        }
        submissions.forEach((submission) => {
          const start = toDateKey(
            parseDateKey(String(submission.start)) ||
              new Date(String(submission.start)),
          );
          const end = toDateKey(
            parseDateKey(String(submission.end)) ||
              new Date(String(submission.end)),
          );
          const locked = gridSubmissionLocksPeriod(submission, start, end);
          periods.set(start, {
            start,
            end,
            status: locked ? submission.status : "open",
            submittedAt: submission.submittedAt || null,
            current: start === current.start,
          });
        });
        res.json({
          periods: Array.from(periods.values()).sort((a, b) =>
            b.start.localeCompare(a.start),
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/grid/associates",
    requireTipsGridAccess,
    tipsAuthRateLimiter,
    async (req: any, res, next) => {
      try {
        const parsed = gridAssociateSchema.safeParse(req.body);
        if (!parsed.success)
          return res
            .status(400)
            .json({
              error: "Invalid associate details",
              validation: parsed.error.format(),
            });
        const explicitEmail = parsed.data.email
          ? normalizeEmail(parsed.data.email)
          : "";
        const email =
          explicitEmail || `tips-${crypto.randomUUID()}@courtyard-tips.local`;
        const existing = await db
          .select({ id: tipsUsers.id })
          .from(tipsUsers)
          .where(eq(tipsUsers.email, email))
          .limit(1);
        if (existing.length)
          return res
            .status(409)
            .json({ error: "An associate already exists for this email." });
        const displayName =
          parsed.data.employeeDisplayName?.trim() ||
          `${parsed.data.firstName} ${parsed.data.lastName}`.trim();
        const position = parsed.data.position?.trim() || "Bistro attendant";
        if (!hasBistroText(position))
          return res
            .status(400)
            .json({
              error:
                "Only Bistro or Breakfast associates can be added to the tips grid.",
            });
        const [created] = await db
          .insert(tipsUsers)
          .values({
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            email,
            employeeDisplayName: displayName,
            position,
            role: "employee",
            hashedPassword: await bcrypt.hash(
              crypto.randomBytes(18).toString("hex"),
              12,
            ),
            mustChangePassword: false,
          })
          .returning();
        await db.insert(tipAdminActions).values({
          actorUserId: req.tipsUser?.id || null,
          targetUserId: created.id,
          action: "grid_associate_created",
          metadataJson: {
            selfAdded: true,
            emailProvided: Boolean(explicitEmail),
            position: created.position,
          },
        });
        res.status(201).json({ user: publicTipsUser(created) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/grid/entries",
    requireTipsGridAccess,
    async (req: any, res, next) => {
      try {
        const parsed = gridEntrySchema.safeParse(req.body);
        if (!parsed.success)
          return res
            .status(400)
            .json({
              error: "Invalid grid entry",
              validation: parsed.error.format(),
            });
        const period = getPayPeriodForEntryDate(parsed.data.entryDate);
        if (!period)
          return res.status(400).json({ error: "Invalid entry date" });
        const submission = await getGridSubmission(period.start, period.end);
        if (gridSubmissionLocksPeriod(submission, period.start, period.end))
          return res.status(423).json({ error: "This pay period is locked." });
        const allowedUsers = await getBistroTipsUsers();
        if (!allowedUsers.some((user) => user.id === parsed.data.userId)) {
          return res
            .status(403)
            .json({
              error:
                "Only Bistro or Breakfast associates can be entered on the tips grid.",
            });
        }
        const [existingEntry] = await db
          .select()
          .from(tipEntries)
          .where(
            and(
              eq(tipEntries.userId, parsed.data.userId),
              eq(tipEntries.entryDate, parsed.data.entryDate),
            ),
          )
          .limit(1);
        if (
          existingEntry?.status === "confirmed" ||
          (existingEntry?.status === "submitted" &&
            gridSubmissionLocksPeriod(submission, period.start, period.end))
        ) {
          return res
            .status(423)
            .json({
              error:
                "This associate/day is confirmed. Reopen it before making changes.",
            });
        }
        const amount = parsed.data.tipAmount.toFixed(2);
        const grossSales = parsed.data.grossSales.toFixed(2);
        // Each associate/day entry is the durable source of truth. Do not also
        // rewrite the shared day-summary row here: simultaneous associate saves
        // used to contend on that row and could surface a SQL error after the
        // tip entry was submitted. Grid totals are derived from entry rows.
        const [entry] = await db.transaction(async (tx) =>
          tx
            .insert(tipEntries)
            .values({
              userId: parsed.data.userId,
              entryDate: parsed.data.entryDate,
              payPeriodStart: period.start,
              payPeriodEnd: period.end,
              tipAmount: amount,
              cashTips: "0.00",
              creditTips: amount,
              grossSales,
              coversServed: null,
              shiftType: "other",
              notes: parsed.data.notes || null,
              status: "saved",
            })
            .onConflictDoUpdate({
              target: [tipEntries.userId, tipEntries.entryDate],
              set: {
                payPeriodStart: period.start,
                payPeriodEnd: period.end,
                tipAmount: amount,
                cashTips: "0.00",
                creditTips: amount,
                grossSales,
                notes: parsed.data.notes || null,
                status: "saved",
                updatedAt: new Date(),
              },
            })
            .returning(),
        );
        res.json({
          entry: {
            ...entry,
            tipAmount: moneyString(entry.tipAmount),
            creditTips: moneyString(entry.creditTips),
            grossSales: moneyString(entry.grossSales),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/grid/days",
    requireTipsGridAccess,
    async (req: any, res, next) => {
      try {
        const parsed = gridDaySummarySchema.safeParse(req.body);
        if (!parsed.success)
          return res
            .status(400)
            .json({
              error: "Invalid day summary",
              validation: parsed.error.format(),
            });
        if (!(await canManageTipsSales(req.tipsUser)))
          return res
            .status(403)
            .json({
              error: "Manager access is required to update Bistro sales.",
            });
        const period = getPayPeriodForEntryDate(parsed.data.date);
        if (!period) return res.status(400).json({ error: "Invalid day date" });
        const submission = await getGridSubmission(period.start, period.end);
        if (gridSubmissionLocksPeriod(submission, period.start, period.end))
          return res.status(423).json({ error: "This pay period is locked." });
        const [summary] = await db
          .insert(tipGridDaySummaries)
          .values({
            summaryDate: parsed.data.date,
            payPeriodStart: period.start,
            payPeriodEnd: period.end,
            grossSales: parsed.data.grossSales.toFixed(2),
            taxAmount: parsed.data.taxAmount.toFixed(2),
            beerSales: parsed.data.beerSales.toFixed(2),
            liquorSales: parsed.data.liquorSales.toFixed(2),
            foodSales: parsed.data.foodSales.toFixed(2),
            wineSales: parsed.data.wineSales.toFixed(2),
            updatedBy: req.tipsUser?.id || null,
          })
          .onConflictDoUpdate({
            target: tipGridDaySummaries.summaryDate,
            set: {
              grossSales: parsed.data.grossSales.toFixed(2),
              taxAmount: parsed.data.taxAmount.toFixed(2),
              beerSales: parsed.data.beerSales.toFixed(2),
              liquorSales: parsed.data.liquorSales.toFixed(2),
              foodSales: parsed.data.foodSales.toFixed(2),
              wineSales: parsed.data.wineSales.toFixed(2),
              updatedBy: req.tipsUser?.id || null,
              updatedAt: new Date(),
            },
          })
          .returning();
        res.json({
          summary: {
            ...summary,
            grossSales: moneyString(summary.grossSales),
            taxAmount: moneyString(summary.taxAmount),
            beerSales: moneyString(summary.beerSales),
            liquorSales: moneyString(summary.liquorSales),
            foodSales: moneyString(summary.foodSales),
            wineSales: moneyString(summary.wineSales),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/grid/banquet-reports",
    requireTipsGridAccess,
    tipsUploadRateLimiter,
    (req: any, res, next) => {
      upload.single("banquetReport")(req, res, (error: any) => {
        if (!error) return next();
        if (
          error instanceof multer.MulterError &&
          error.code === "LIMIT_FILE_SIZE"
        ) {
          return res
            .status(413)
            .json({
              error:
                "Banquet report file is too large. Use a smaller image or PDF.",
            });
        }
        return res
          .status(400)
          .json({ error: error?.message || "Banquet report upload failed." });
      });
    },
    async (req: any, res, next) => {
      try {
        const parsed = banquetReportSchema.safeParse(req.body);
        if (!parsed.success)
          return res
            .status(400)
            .json({
              error: "Invalid banquet report",
              validation: parsed.error.format(),
            });
        const period = getPayPeriodForEntryDate(parsed.data.eventDate);
        if (!period)
          return res.status(400).json({ error: "Invalid event date" });
        const submission = await getGridSubmission(period.start, period.end);
        if (gridSubmissionLocksPeriod(submission, period.start, period.end))
          return res.status(423).json({ error: "This pay period is locked." });
        const banquetAssociates = await getBanquetTipAssociates();
        const selectedAssociates = banquetAssociates.filter((user) =>
          parsed.data.assignedUserIds.includes(user.id),
        );
        if (parsed.data.assignedUserIds.length !== selectedAssociates.length) {
          return res
            .status(400)
            .json({
              error:
                "One or more selected banquet associates are not active Schedule associates.",
            });
        }
        const banquetTipAmount = resolveBanquetTipAmount(parsed.data);
        const serviceRate = serviceRateForReportType(parsed.data.reportType);
        const splitAmount = selectedAssociates.length
          ? banquetTipAmount / selectedAssociates.length
          : 0;
        const assignedAssociatesJson = selectedAssociates.map((user) => ({
          userId: user.id,
          displayName: user.employeeDisplayName,
          department: user.department,
          position: user.position,
          splitAmount: splitAmount.toFixed(2),
        }));
        const [report] = await db
          .insert(tipBanquetReports)
          .values({
            eventDate: parsed.data.eventDate,
            payPeriodStart: period.start,
            payPeriodEnd: period.end,
            reportType: parsed.data.reportType,
            eventName: parsed.data.eventName,
            grossSales: parsed.data.grossSales.toFixed(2),
            serviceRate: serviceRate.toFixed(4),
            banquetTips: banquetTipAmount.toFixed(2),
            assignedAssociatesJson,
            notes: parsed.data.notes || null,
            storagePath: req.file
              ? path.relative(process.cwd(), req.file.path)
              : null,
            originalFileName: req.file?.originalname || null,
            mimeType: req.file?.mimetype || null,
            size: req.file?.size || null,
            updatedBy: req.tipsUser?.id || null,
          } as any)
          .returning();
        await db.insert(tipAdminActions).values({
          actorUserId: req.tipsUser?.id || null,
          action: "banquet_tip_report_created",
          metadataJson: {
            reportId: report.id,
            reportType: report.reportType,
            eventDate: report.eventDate,
            eventName: report.eventName,
            assignedAssociates: assignedAssociatesJson,
          },
        });
        res
          .status(201)
          .json({
            report: {
              ...report,
              grossSales: moneyString(report.grossSales),
              serviceRate: String(report.serviceRate),
              banquetTips: moneyString(report.banquetTips),
              assignedAssociatesJson,
            },
          });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/grid/banquet-reports/:id",
    requireTipsGridAccess,
    async (req: any, res, next) => {
      try {
        const parsed = banquetReportSchema.safeParse(req.body);
        if (!parsed.success)
          return res
            .status(400)
            .json({
              error: "Invalid banquet report",
              validation: parsed.error.format(),
            });
        const [existing] = await db
          .select()
          .from(tipBanquetReports)
          .where(eq(tipBanquetReports.id, req.params.id))
          .limit(1);
        if (!existing)
          return res.status(404).json({ error: "Banquet report not found." });
        const period = getPayPeriodForEntryDate(parsed.data.eventDate);
        if (!period)
          return res.status(400).json({ error: "Invalid event date" });
        const submission = await getGridSubmission(
          existing.payPeriodStart,
          existing.payPeriodEnd,
        );
        if (
          gridSubmissionLocksPeriod(
            submission,
            existing.payPeriodStart,
            existing.payPeriodEnd,
          )
        )
          return res.status(423).json({ error: "This pay period is locked." });
        const banquetAssociates = await getBanquetTipAssociates();
        const selectedAssociates = banquetAssociates.filter((user) =>
          parsed.data.assignedUserIds.includes(user.id),
        );
        if (parsed.data.assignedUserIds.length !== selectedAssociates.length) {
          return res
            .status(400)
            .json({
              error:
                "One or more selected banquet associates are not active Schedule associates.",
            });
        }
        const banquetTipAmount = resolveBanquetTipAmount(parsed.data);
        const serviceRate = serviceRateForReportType(parsed.data.reportType);
        const splitAmount = selectedAssociates.length
          ? banquetTipAmount / selectedAssociates.length
          : 0;
        const assignedAssociatesJson = selectedAssociates.map((user) => ({
          userId: user.id,
          displayName: user.employeeDisplayName,
          department: user.department,
          position: user.position,
          splitAmount: splitAmount.toFixed(2),
        }));
        const [updated] = await db
          .update(tipBanquetReports)
          .set({
            eventDate: parsed.data.eventDate,
            payPeriodStart: period.start,
            payPeriodEnd: period.end,
            reportType: parsed.data.reportType,
            eventName: parsed.data.eventName,
            grossSales: parsed.data.grossSales.toFixed(2),
            serviceRate: serviceRate.toFixed(4),
            banquetTips: banquetTipAmount.toFixed(2),
            assignedAssociatesJson,
            notes: parsed.data.notes || null,
            updatedBy: req.tipsUser?.id || null,
            updatedAt: new Date(),
          } as any)
          .where(eq(tipBanquetReports.id, existing.id))
          .returning();
        await db.insert(tipAdminActions).values({
          actorUserId: req.tipsUser?.id || null,
          action: "banquet_tip_report_updated",
          metadataJson: {
            reportId: updated.id,
            reportType: updated.reportType,
            eventDate: updated.eventDate,
            eventName: updated.eventName,
            assignedAssociates: assignedAssociatesJson,
          },
        });
        res.json({
          report: {
            ...updated,
            grossSales: moneyString(updated.grossSales),
            serviceRate: String(updated.serviceRate),
            banquetTips: moneyString(updated.banquetTips),
            assignedAssociatesJson,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/grid/banquet-reports/:id/view",
    requireTipsGridAccess,
    async (req: any, res, next) => {
      try {
        const [report] = await db
          .select()
          .from(tipBanquetReports)
          .where(eq(tipBanquetReports.id, req.params.id))
          .limit(1);
        if (!report?.storagePath || !report.mimeType)
          return res
            .status(404)
            .json({ error: "Banquet report file not found" });
        const absolute = resolvePrivateFile(report.storagePath);
        if (!absolute || !fs.existsSync(absolute))
          return res
            .status(404)
            .json({ error: "Banquet report file not found" });
        res.type(report.mimeType);
        res.sendFile(absolute);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/grid/entries/:id/confirm",
    requireTipsGridAccess,
    async (req: any, res, next) => {
      try {
        const [entry] = await db
          .select()
          .from(tipEntries)
          .where(eq(tipEntries.id, req.params.id))
          .limit(1);
        if (!entry)
          return res.status(404).json({ error: "Tip entry not found" });
        if (moneyNumber(entry.tipAmount) > 0) {
          const bistroUsers = await getBistroTipsUsers();
          const bistroUserIds = bistroUsers.map((user) => user.id);
          const dayEntries = bistroUserIds.length
            ? await db
                .select({ grossSales: tipEntries.grossSales })
                .from(tipEntries)
                .where(
                  and(
                    eq(tipEntries.entryDate, entry.entryDate),
                    inArray(tipEntries.userId, bistroUserIds),
                  ),
                )
            : [];
          const sharedDaySales = dayEntries.reduce(
            (sum, row) => sum + moneyNumber(row.grossSales),
            0,
          );
          if (sharedDaySales <= 0) {
            return res
              .status(409)
              .json({
                error:
                  "Enter gross sales under one associate sharing this card before confirming the day's tip entries.",
              });
          }
        }
        const submission = await getGridSubmission(
          entry.payPeriodStart,
          entry.payPeriodEnd,
        );
        if (
          gridSubmissionLocksPeriod(
            submission,
            entry.payPeriodStart,
            entry.payPeriodEnd,
          )
        )
          return res.status(423).json({ error: "This pay period is locked." });
        const [updated] = await db
          .update(tipEntries)
          .set({ status: "confirmed", updatedAt: new Date() })
          .where(eq(tipEntries.id, entry.id))
          .returning();
        res.json({
          entry: {
            ...updated,
            tipAmount: moneyString(updated.tipAmount),
            creditTips: moneyString(updated.creditTips),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/grid/entries/:id/unlock",
    requireTipsGridAccess,
    async (req: any, res, next) => {
      try {
        const [entry] = await db
          .select()
          .from(tipEntries)
          .where(eq(tipEntries.id, req.params.id))
          .limit(1);
        if (!entry)
          return res.status(404).json({ error: "Tip entry not found" });
        const submission = await getGridSubmission(
          entry.payPeriodStart,
          entry.payPeriodEnd,
        );
        if (
          gridSubmissionLocksPeriod(
            submission,
            entry.payPeriodStart,
            entry.payPeriodEnd,
          )
        )
          return res.status(423).json({ error: "This pay period is locked." });
        const [updated] = await db
          .update(tipEntries)
          .set({ status: "saved", updatedAt: new Date() })
          .where(eq(tipEntries.id, entry.id))
          .returning();
        await db.insert(tipAdminActions).values({
          actorUserId: req.tipsUser?.id || null,
          targetUserId: updated.userId,
          action: "tip_grid_entry_unlocked",
          metadataJson: {
            entryId: updated.id,
            entryDate: updated.entryDate,
            accessType: isTipsManager(req.tipsUser)
              ? "admin"
              : req.tipsUser
                ? "user"
                : "kiosk",
          },
        });
        res.json({
          entry: {
            ...updated,
            tipAmount: moneyString(updated.tipAmount),
            creditTips: moneyString(updated.creditTips),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/grid/reports/:date",
    requireTipsGridAccess,
    tipsUploadRateLimiter,
    salesReportUpload,
    async (req: any, res, next) => {
      try {
        const reportDate = String(req.params.date || "");
        const period = getPayPeriodForEntryDate(reportDate);
        if (!period)
          return res.status(400).json({ error: "Invalid report date" });
        const submission = await getGridSubmission(period.start, period.end);
        if (gridSubmissionLocksPeriod(submission, period.start, period.end))
          return res.status(423).json({ error: "This pay period is locked." });
        if (!req.file)
          return res
            .status(400)
            .json({ error: "Sales report file is required" });
        const [existing] = await db
          .select()
          .from(tipDailyReportAttachments)
          .where(eq(tipDailyReportAttachments.reportDate, reportDate))
          .limit(1);
        if (existing)
          await db
            .delete(tipDailyReportAttachments)
            .where(eq(tipDailyReportAttachments.id, existing.id));
        const [report] = await db
          .insert(tipDailyReportAttachments)
          .values({
            reportDate,
            payPeriodStart: period.start,
            payPeriodEnd: period.end,
            storagePath: path.relative(process.cwd(), req.file.path),
            originalFileName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            uploadedBy: req.tipsUser?.id || null,
          })
          .returning();
        res.status(201).json({ report });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/grid/reports/:id/view",
    requireTipsGridAccess,
    async (req: any, res, next) => {
      try {
        const [report] = await db
          .select()
          .from(tipDailyReportAttachments)
          .where(eq(tipDailyReportAttachments.id, req.params.id))
          .limit(1);
        if (!report) return res.status(404).json({ error: "Report not found" });
        const absolute = resolvePrivateFile(report.storagePath);
        if (!absolute || !fs.existsSync(absolute))
          return res.status(404).json({ error: "Report file not found" });
        res.type(report.mimeType);
        res.sendFile(absolute);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/grid/submit",
    requireTipsGridAccess,
    async (req: any, res, next) => {
      try {
        const parsed = periodSchema.safeParse(req.body || {});
        if (!parsed.success)
          return res.status(400).json({ error: "Invalid pay period" });
        const grid = await buildTipsGrid(parsed.data.start, req.tipsUser);
        const existing = await getGridSubmission(
          grid.period.start,
          grid.period.end,
        );
        if (
          gridSubmissionLocksPeriod(
            existing,
            grid.period.start,
            grid.period.end,
          )
        )
          return res
            .status(409)
            .json({ error: "This pay period has already been submitted." });
        const daysWithTips = grid.dayTotals.filter(
          (day: any) => moneyNumber(day.totalTips) > 0,
        );
        const missingReports = daysWithTips.filter((day: any) => !day.report);
        if (missingReports.length > 0)
          return res
            .status(400)
            .json({
              error:
                "Every day with entered tips needs a sales report image before final submission.",
            });
        const missingSalesDays = grid.dayTotals.filter(
          (day: any) =>
            moneyNumber(day.totalTips) > 0 && moneyNumber(day.grossSales) <= 0,
        );
        if (missingSalesDays.length > 0)
          return res
            .status(400)
            .json({
              error:
                "Every day with tips needs gross sales entered under at least one associate sharing the card.",
            });
        const unconfirmedEntries = grid.rows.flatMap((row: any) =>
          row.cells.filter(
            (cell: any) => moneyNumber(cell.tipAmount) > 0 && !cell.confirmed,
          ),
        );
        if (unconfirmedEntries.length > 0)
          return res
            .status(400)
            .json({
              error:
                "Every associate tip amount must be confirmed before final submission.",
            });
        let [submission] = await db
          .insert(tipGridSubmissions)
          .values({
            payPeriodStart: grid.period.start,
            payPeriodEnd: grid.period.end,
            week1Total: grid.week1Total,
            week2Total: grid.week2Total,
            totalTips: grid.totalTips,
            status: "submitted",
            submittedAt: new Date(),
            reviewedBy: req.tipsUser?.id || null,
          })
          .onConflictDoUpdate({
            target: [
              tipGridSubmissions.payPeriodStart,
              tipGridSubmissions.payPeriodEnd,
            ],
            set: {
              week1Total: grid.week1Total,
              week2Total: grid.week2Total,
              totalTips: grid.totalTips,
              status: "submitted",
              submittedAt: new Date(),
              updatedAt: new Date(),
              reviewedBy: req.tipsUser?.id || null,
            },
          })
          .returning();
        const pdfPath = await generateTipsGridPdf(grid, submission);
        [submission] = await db
          .update(tipGridSubmissions)
          .set({ pdfPath, updatedAt: new Date() })
          .where(eq(tipGridSubmissions.id, submission.id))
          .returning();
        const bistroUserIds = grid.rows
          .map((row: any) => row.associate.id)
          .filter(Boolean);
        if (bistroUserIds.length) {
          await db
            .update(tipEntries)
            .set({ status: "submitted", updatedAt: new Date() })
            .where(
              and(
                eq(tipEntries.payPeriodStart, grid.period.start),
                eq(tipEntries.payPeriodEnd, grid.period.end),
                inArray(tipEntries.userId, bistroUserIds),
              ),
            );
        }
        let emailSent = true;
        let emailWarning: string | undefined;
        try {
          await sendTipsGridSubmissionEmail(grid);
        } catch (error) {
          emailSent = false;
          emailWarning =
            "Pay period was submitted, but the email notification could not be sent.";
          console.error("Failed to send tips grid submission email:", error);
        }
        res
          .status(emailSent ? 201 : 202)
          .json({ submission, emailSent, warning: emailWarning });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/grid/pdf",
    requireTipsGridAccess,
    async (req: any, res, next) => {
      try {
        const parsed = periodSchema.safeParse(req.query);
        if (!parsed.success)
          return res.status(400).json({ error: "Invalid pay period" });
        const grid = await buildTipsGrid(parsed.data.start, req.tipsUser);
        const submission = await getGridSubmission(
          grid.period.start,
          grid.period.end,
        );
        const pdfPath =
          submission?.pdfPath || (await generateTipsGridPdf(grid, submission));
        const absolute = resolvePrivateFile(pdfPath);
        if (!absolute || !fs.existsSync(absolute))
          return res.status(404).json({ error: "PDF not found" });
        res.download(
          absolute,
          `courtyard-tips-grid-${grid.period.start}-${grid.period.end}.pdf`,
        );
      } catch (error) {
        next(error);
      }
    },
  );

  app.use("/api/tips", router);
}
