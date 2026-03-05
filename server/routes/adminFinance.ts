import type { Express, RequestHandler } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { isAdmin, isAuthenticated } from "../auth";
import { storage } from "../storage";
import {
  insertPersonalFinanceBudgetSchema,
  insertPersonalFinanceEntrySchema,
  personalFinanceBudgets,
  personalFinanceEntries,
  personalFinanceExpenseCategories,
  type PersonalFinanceOwner,
} from "@shared/schema";

const FINANCE_EMAILS = ["coryarmer@gmail.com", "bentley.amy24@gmail.com"] as const;
const ALLOWED_FINANCE_EMAILS = new Set(FINANCE_EMAILS.map((email) => email.toLowerCase()));
const OWNER_FILTERS = ["all", "cory", "amy", "joint"] as const;
const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const monthQuerySchema = z.object({
  month: z.string().regex(MONTH_REGEX, "month must be YYYY-MM"),
});

const entryPatchSchema = z.object({
  owner: z.enum(["cory", "amy", "joint"]).optional(),
  month: z.string().regex(MONTH_REGEX).optional(),
  type: z.enum(["expense", "income"]).optional(),
  category: z.string().optional(),
  rsfCategory: z.string().nullable().optional(),
  subcategory: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  dueDate: z.string().nullable().optional(),
  isPaid: z.boolean().optional(),
  paidDate: z.string().nullable().optional(),
  isRecurring: z.boolean().optional(),
  recurringDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  notifyDaysBefore: z.number().int().min(0).max(31).optional(),
  notificationSent: z.boolean().optional(),
}).partial();

const budgetPatchSchema = z.object({
  month: z.string().regex(MONTH_REGEX).optional(),
  category: z.string().optional(),
  owner: z.enum(["cory", "amy", "joint"]).optional(),
  budgetAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
}).partial();

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

function parseOwnerFilter(value: unknown): (typeof OWNER_FILTERS)[number] {
  if (typeof value !== "string") return "all";
  return (OWNER_FILTERS as readonly string[]).includes(value) ? (value as (typeof OWNER_FILTERS)[number]) : "all";
}

function toNullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toNullableDate(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function normalizeEntryInsertPayload(payload: z.infer<typeof insertPersonalFinanceEntrySchema>) {
  return {
    owner: payload.owner,
    month: payload.month,
    type: payload.type,
    category: payload.category,
    rsfCategory: toNullableText(payload.rsfCategory ?? null),
    subcategory: toNullableText(payload.subcategory ?? null),
    description: toNullableText(payload.description ?? null),
    amount: payload.amount,
    dueDate: toNullableDate(payload.dueDate ?? null),
    isPaid: payload.isPaid ?? false,
    paidDate: toNullableDate(payload.paidDate ?? null),
    isRecurring: payload.isRecurring ?? false,
    recurringDayOfMonth: payload.recurringDayOfMonth ?? null,
    notifyDaysBefore: payload.notifyDaysBefore ?? 3,
    notificationSent: payload.notificationSent ?? false,
    updatedAt: new Date(),
  };
}

function normalizeEntryPatchPayload(payload: z.infer<typeof entryPatchSchema>) {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (payload.owner !== undefined) updates.owner = payload.owner;
  if (payload.month !== undefined) updates.month = payload.month;
  if (payload.type !== undefined) updates.type = payload.type;
  if (payload.category !== undefined) updates.category = payload.category;
  if (payload.rsfCategory !== undefined) updates.rsfCategory = toNullableText(payload.rsfCategory);
  if (payload.subcategory !== undefined) updates.subcategory = toNullableText(payload.subcategory);
  if (payload.description !== undefined) updates.description = toNullableText(payload.description);
  if (payload.amount !== undefined) updates.amount = payload.amount;
  if (payload.dueDate !== undefined) updates.dueDate = toNullableDate(payload.dueDate);
  if (payload.isPaid !== undefined) updates.isPaid = payload.isPaid;
  if (payload.paidDate !== undefined) updates.paidDate = toNullableDate(payload.paidDate);
  if (payload.isRecurring !== undefined) updates.isRecurring = payload.isRecurring;
  if (payload.recurringDayOfMonth !== undefined) updates.recurringDayOfMonth = payload.recurringDayOfMonth;
  if (payload.notifyDaysBefore !== undefined) updates.notifyDaysBefore = payload.notifyDaysBefore;
  if (payload.notificationSent !== undefined) updates.notificationSent = payload.notificationSent;
  if (payload.isPaid === true && payload.paidDate === undefined) {
    updates.paidDate = new Date().toISOString().slice(0, 10);
  }
  return updates;
}

function toMonthDate(month: string): Date {
  return new Date(`${month}-01T00:00:00`);
}

function formatMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function resolveRecurringDueDate(targetMonth: string, recurringDayOfMonth?: number | null, existingDueDate?: string | null): string | null {
  const baseDate = toMonthDate(targetMonth);
  const dayFromSource =
    recurringDayOfMonth && recurringDayOfMonth >= 1 && recurringDayOfMonth <= 31
      ? recurringDayOfMonth
      : existingDueDate
        ? Number(existingDueDate.slice(8, 10))
        : null;

  if (!dayFromSource || Number.isNaN(dayFromSource)) {
    return null;
  }

  const year = baseDate.getFullYear();
  const monthIndex = baseDate.getMonth();
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const clampedDay = Math.max(1, Math.min(dayFromSource, lastDay));
  return `${targetMonth}-${String(clampedDay).padStart(2, "0")}`;
}

const requireFinanceAccess: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as typeof req & {
      user?: { claims?: { sub?: string | null } };
      session?: { userId?: string | null };
      financeUser?: unknown;
    };
    const userId = authReq.user?.claims?.sub || authReq.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await storage.getUser(String(userId));
    const email = String(user?.email || "").toLowerCase();
    if (!user || !ALLOWED_FINANCE_EMAILS.has(email)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    authReq.financeUser = user;
    return next();
  } catch (error) {
    return res.status(500).json({ error: "Failed to validate finance access" });
  }
};

export function registerAdminFinanceRoutes(app: Express) {
  app.get("/api/admin/finance/entries", isAuthenticated, isAdmin, requireFinanceAccess, async (req, res) => {
    try {
      const { month } = monthQuerySchema.parse(req.query);
      const ownerFilter = parseOwnerFilter(req.query.owner);
      const conditions = [eq(personalFinanceEntries.month, month)];
      if (ownerFilter !== "all") {
        conditions.push(eq(personalFinanceEntries.owner, ownerFilter));
      }

      const entries = await db
        .select()
        .from(personalFinanceEntries)
        .where(and(...conditions))
        .orderBy(asc(personalFinanceEntries.dueDate), desc(personalFinanceEntries.createdAt));

      res.json(entries);
    } catch (error: unknown) {
      res.status(400).json({ error: getErrorMessage(error) || "Invalid request" });
    }
  });

  app.post("/api/admin/finance/entries", isAuthenticated, isAdmin, requireFinanceAccess, async (req, res) => {
    try {
      const payload = insertPersonalFinanceEntrySchema.parse(req.body);
      const values = normalizeEntryInsertPayload(payload);
      const [created] = await db.insert(personalFinanceEntries).values(values).returning();
      res.status(201).json(created);
    } catch (error: unknown) {
      res.status(400).json({ error: getErrorMessage(error) || "Failed to create entry" });
    }
  });

  app.patch("/api/admin/finance/entries/:id", isAuthenticated, isAdmin, requireFinanceAccess, async (req, res) => {
    try {
      const id = String(req.params.id || "");
      if (!id) return res.status(400).json({ error: "Entry id is required" });
      const payload = entryPatchSchema.parse(req.body);
      const updates = normalizeEntryPatchPayload(payload);
      if (Object.keys(updates).length <= 1) {
        return res.status(400).json({ error: "No updates provided" });
      }
      const [updated] = await db
        .update(personalFinanceEntries)
        .set(updates)
        .where(eq(personalFinanceEntries.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: "Entry not found" });
      res.json(updated);
    } catch (error: unknown) {
      res.status(400).json({ error: getErrorMessage(error) || "Failed to update entry" });
    }
  });

  app.delete("/api/admin/finance/entries/:id", isAuthenticated, isAdmin, requireFinanceAccess, async (req, res) => {
    try {
      const id = String(req.params.id || "");
      if (!id) return res.status(400).json({ error: "Entry id is required" });
      await db.delete(personalFinanceEntries).where(eq(personalFinanceEntries.id, id));
      res.json({ ok: true });
    } catch (error: unknown) {
      res.status(400).json({ error: getErrorMessage(error) || "Failed to delete entry" });
    }
  });

  app.get("/api/admin/finance/budgets", isAuthenticated, isAdmin, requireFinanceAccess, async (req, res) => {
    try {
      const { month } = monthQuerySchema.parse(req.query);
      const budgets = await db
        .select()
        .from(personalFinanceBudgets)
        .where(eq(personalFinanceBudgets.month, month))
        .orderBy(asc(personalFinanceBudgets.owner), asc(personalFinanceBudgets.category));
      res.json(budgets);
    } catch (error: unknown) {
      res.status(400).json({ error: getErrorMessage(error) || "Invalid request" });
    }
  });

  app.post("/api/admin/finance/budgets", isAuthenticated, isAdmin, requireFinanceAccess, async (req, res) => {
    try {
      const payload = insertPersonalFinanceBudgetSchema.parse(req.body);
      const [saved] = await db
        .insert(personalFinanceBudgets)
        .values({
          month: payload.month,
          owner: payload.owner,
          category: payload.category,
          budgetAmount: payload.budgetAmount,
        })
        .onConflictDoUpdate({
          target: [personalFinanceBudgets.month, personalFinanceBudgets.category, personalFinanceBudgets.owner],
          set: {
            budgetAmount: payload.budgetAmount,
          },
        })
        .returning();
      res.status(201).json(saved);
    } catch (error: unknown) {
      res.status(400).json({ error: getErrorMessage(error) || "Failed to save budget" });
    }
  });

  app.patch("/api/admin/finance/budgets/:id", isAuthenticated, isAdmin, requireFinanceAccess, async (req, res) => {
    try {
      const id = String(req.params.id || "");
      if (!id) return res.status(400).json({ error: "Budget id is required" });
      const payload = budgetPatchSchema.parse(req.body);
      const updates: Record<string, unknown> = {};
      if (payload.month !== undefined) updates.month = payload.month;
      if (payload.owner !== undefined) updates.owner = payload.owner;
      if (payload.category !== undefined) updates.category = payload.category;
      if (payload.budgetAmount !== undefined) updates.budgetAmount = payload.budgetAmount;
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No updates provided" });
      }
      const [updated] = await db
        .update(personalFinanceBudgets)
        .set(updates)
        .where(eq(personalFinanceBudgets.id, id))
        .returning();
      if (!updated) return res.status(404).json({ error: "Budget not found" });
      res.json(updated);
    } catch (error: unknown) {
      res.status(400).json({ error: getErrorMessage(error) || "Failed to update budget" });
    }
  });

  app.get("/api/admin/finance/summary", isAuthenticated, isAdmin, requireFinanceAccess, async (req, res) => {
    try {
      const { month } = monthQuerySchema.parse(req.query);
      const [entries, budgets] = await Promise.all([
        db.select().from(personalFinanceEntries).where(eq(personalFinanceEntries.month, month)),
        db.select().from(personalFinanceBudgets).where(eq(personalFinanceBudgets.month, month)),
      ]);

      const zeroTotals = { cory: 0, amy: 0, joint: 0, combined: 0 };
      const totalIncome = { ...zeroTotals };
      const totalExpenses = { ...zeroTotals };
      const expenseByCategory = new Map<string, number>();
      const budgetByCategory = new Map<string, number>();

      for (const entry of entries) {
        const amount = Number(entry.amount || 0);
        const owner = (entry.owner as PersonalFinanceOwner) || "joint";
        if (entry.type === "income") {
          totalIncome[owner] += amount;
          totalIncome.combined += amount;
        } else {
          totalExpenses[owner] += amount;
          totalExpenses.combined += amount;
          expenseByCategory.set(entry.category, (expenseByCategory.get(entry.category) || 0) + amount);
        }
      }

      for (const budget of budgets) {
        const amount = Number(budget.budgetAmount || 0);
        budgetByCategory.set(budget.category, (budgetByCategory.get(budget.category) || 0) + amount);
      }

      const categories = new Set<string>([
        ...personalFinanceExpenseCategories,
        ...Array.from(budgetByCategory.keys()),
        ...Array.from(expenseByCategory.keys()),
      ]);

      const byCategory = Array.from(categories)
        .map((category) => {
          const budgeted = budgetByCategory.get(category) || 0;
          const actual = expenseByCategory.get(category) || 0;
          return {
            category,
            budgeted,
            actual,
            remaining: budgeted - actual,
          };
        })
        .filter((row) => row.budgeted > 0 || row.actual > 0)
        .sort((a, b) => b.actual - a.actual);

      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const in7 = new Date(todayStart);
      in7.setDate(in7.getDate() + 7);

      const dueEntries = entries
        .filter((entry) => !entry.isPaid && entry.dueDate)
        .map((entry) => ({ ...entry, dueDateObj: new Date(`${entry.dueDate}T00:00:00`) }))
        .filter((entry) => !Number.isNaN(entry.dueDateObj.getTime()));

      const overdue = dueEntries
        .filter((entry) => entry.dueDateObj < todayStart)
        .map(({ dueDateObj, ...entry }) => entry)
        .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));

      const upcomingDue = dueEntries
        .filter((entry) => entry.dueDateObj >= todayStart && entry.dueDateObj <= in7)
        .map(({ dueDateObj, ...entry }) => entry)
        .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));

      const rsfTotal = entries
        .filter((entry) => entry.type === "expense" && !!entry.rsfCategory)
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

      res.json({
        totalIncome,
        totalExpenses,
        netCashFlow: totalIncome.combined - totalExpenses.combined,
        rsfTotal,
        byCategory,
        upcomingDue,
        overdue,
      });
    } catch (error: unknown) {
      res.status(400).json({ error: getErrorMessage(error) || "Failed to build summary" });
    }
  });

  app.post("/api/admin/finance/entries/:id/mark-paid", isAuthenticated, isAdmin, requireFinanceAccess, async (req, res) => {
    try {
      const id = String(req.params.id || "");
      if (!id) return res.status(400).json({ error: "Entry id is required" });
      const today = new Date().toISOString().slice(0, 10);
      const [updated] = await db
        .update(personalFinanceEntries)
        .set({
          isPaid: true,
          paidDate: today,
          updatedAt: new Date(),
        })
        .where(eq(personalFinanceEntries.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: "Entry not found" });
      res.json(updated);
    } catch (error: unknown) {
      res.status(400).json({ error: getErrorMessage(error) || "Failed to mark entry as paid" });
    }
  });

  app.post("/api/admin/finance/recurring/generate", isAuthenticated, isAdmin, requireFinanceAccess, async (req, res) => {
    try {
      const { month: targetMonth } = monthQuerySchema.parse(req.query);
      const previousMonthDate = toMonthDate(targetMonth);
      previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
      const previousMonth = formatMonth(previousMonthDate);

      const [sources, existingTargetMonthEntries] = await Promise.all([
        db
          .select()
          .from(personalFinanceEntries)
          .where(and(eq(personalFinanceEntries.month, previousMonth), eq(personalFinanceEntries.isRecurring, true))),
        db.select().from(personalFinanceEntries).where(eq(personalFinanceEntries.month, targetMonth)),
      ]);

      const existingKeys = new Set(
        existingTargetMonthEntries.map((entry) => `${entry.owner}::${String(entry.subcategory || "").toLowerCase()}`)
      );

      const inserts: typeof personalFinanceEntries.$inferInsert[] = [];
      for (const source of sources) {
        const key = `${source.owner}::${String(source.subcategory || "").toLowerCase()}`;
        if (existingKeys.has(key)) continue;

        inserts.push({
          owner: source.owner,
          month: targetMonth,
          type: source.type,
          category: source.category,
          rsfCategory: source.rsfCategory,
          subcategory: source.subcategory,
          description: source.description,
          amount: String(source.amount ?? "0"),
          dueDate: resolveRecurringDueDate(targetMonth, source.recurringDayOfMonth, source.dueDate),
          isPaid: false,
          paidDate: null,
          isRecurring: source.isRecurring ?? false,
          recurringDayOfMonth: source.recurringDayOfMonth,
          notifyDaysBefore: source.notifyDaysBefore ?? 3,
          notificationSent: false,
          updatedAt: new Date(),
        });
      }

      if (inserts.length) {
        await db.insert(personalFinanceEntries).values(inserts);
      }

      res.json({ generated: inserts.length, month: targetMonth });
    } catch (error: unknown) {
      res.status(400).json({ error: getErrorMessage(error) || "Failed to generate recurring entries" });
    }
  });
}

export { FINANCE_EMAILS, ALLOWED_FINANCE_EMAILS };
