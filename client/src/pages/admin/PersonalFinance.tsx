import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type FinanceOwner = "cory" | "amy" | "joint";
type FinanceOwnerFilter = "all" | FinanceOwner;
type FinanceType = "expense" | "income";

type FinanceEntry = {
  id: string;
  owner: FinanceOwner;
  month: string;
  type: FinanceType;
  category: string;
  rsfCategory: string | null;
  subcategory: string | null;
  description: string | null;
  amount: string;
  dueDate: string | null;
  isPaid: boolean | null;
  paidDate: string | null;
  isRecurring: boolean | null;
  recurringFrequency: "monthly" | "weekly" | "every_x_days" | null;
  recurringDayOfMonth: number | null;
  recurringDayOfWeek: number | null;
  recurringIntervalDays: number | null;
  notifyDaysBefore: number | null;
  notificationSent: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type FinanceBudget = {
  id: string;
  month: string;
  owner: FinanceOwner;
  category: string;
  budgetAmount: string;
  createdAt: string | null;
};

type FinanceSummary = {
  totalIncome: { cory: number; amy: number; joint: number; combined: number };
  totalExpenses: { cory: number; amy: number; joint: number; combined: number };
  netCashFlow: number;
  rsfTotal: number;
  byCategory: Array<{ category: string; budgeted: number; actual: number; remaining: number }>;
  upcomingDue: FinanceEntry[];
  overdue: FinanceEntry[];
};

type PersonalFinanceProps = {
  isActive: boolean;
};

const EXPENSE_CATEGORIES = [
  "Housing",
  "Insurance",
  "Utilities",
  "Groceries",
  "Dining",
  "Transportation",
  "Health",
  "Subscriptions",
  "Entertainment",
  "Personal Care",
  "Education",
  "Childcare",
  "Savings",
  "Loans",
  "Debt",
  "Gifts",
  "Miscellaneous",
] as const;

const INCOME_CATEGORIES = [
  "Primary Income",
  "Side Income",
  "Business Income",
  "Passive Income",
  "Government",
  "Other Income",
] as const;

const RSF_CATEGORIES = [
  "RSF - Marketing",
  "RSF - Software & Subscriptions",
  "RSF - Legal & Compliance",
  "RSF - Hosting & Infrastructure",
  "RSF - Contractor / Labor",
  "RSF - Equipment",
  "RSF - Travel",
  "RSF - Banking & Fees",
  "RSF - Revenue",
  "RSF - Investor / Funding",
  "RSF - Miscellaneous",
] as const;

const EXPENSE_SUBCATEGORIES: Record<string, string[]> = {
  Housing: ["Rent/Mortgage", "HOA", "Renters Insurance"],
  Insurance: ["Auto Insurance", "Health Insurance", "Home Insurance", "Life Insurance", "Umbrella Policy", "Other Insurance"],
  Utilities: ["Electric", "Gas", "Water", "Internet", "Phone", "Trash"],
  Groceries: ["Groceries", "Household Supplies"],
  Dining: ["Restaurants", "Coffee", "Fast Food", "Delivery"],
  Transportation: ["Car Payment", "Gas", "Car Insurance", "Parking", "Maintenance"],
  Health: ["Health Insurance", "Dental", "Vision", "Prescriptions", "Gym"],
  Subscriptions: ["Netflix", "Hulu", "HBO Max", "Disney+", "Spotify", "Apple", "Other"],
  Entertainment: ["Movies", "Events", "Hobbies", "Games"],
  "Personal Care": ["Hair", "Clothing", "Toiletries"],
  Education: ["Tuition", "Books", "Online Courses"],
  Childcare: ["Daycare", "Activities", "School Supplies"],
  Savings: ["Emergency Fund", "Retirement", "Investments"],
  Loans: ["Personal Loan", "Auto Loan", "Mortgage Loan", "Business Loan", "Other Loan"],
  Debt: ["Credit Card", "Student Loan", "Personal Loan"],
  Gifts: ["Holidays", "Birthdays", "Charity"],
  Miscellaneous: ["Everything else"],
};

const INCOME_SUBCATEGORIES: Record<string, string[]> = {
  "Primary Income": ["Salary", "Hourly Wages"],
  "Side Income": ["Freelance", "Contract", "Part-time"],
  "Business Income": ["RSF Revenue", "Consulting"],
  "Passive Income": ["Rental Income", "Dividends", "Interest"],
  Government: ["Tax Refund", "Benefits"],
  "Other Income": ["Gifts Received", "Reimbursements"],
};

type EntryFormState = {
  month: string;
  owner: FinanceOwner;
  type: FinanceType;
  category: string;
  subcategory: string;
  customSubcategory: string;
  description: string;
  amount: string;
  dueDate: string;
  isRecurring: boolean;
  recurringFrequency: "monthly" | "weekly" | "every_x_days" | "bi_monthly";
  recurringDayOfMonth: string;
  recurringSecondDayOfMonth: string;
  recurringDayOfWeek: string;
  recurringIntervalDays: string;
  notifyDaysBefore: string;
  isRsfRelated: boolean;
  rsfCategory: string;
  saveAsDraft: boolean;
  markAsPaid: boolean;
  generateThroughYear: boolean;
};

const DEFAULT_FORM = (month: string): EntryFormState => ({
  month,
  owner: "joint",
  type: "expense",
  category: EXPENSE_CATEGORIES[0],
  subcategory: "",
  customSubcategory: "",
  description: "",
  amount: "",
  dueDate: "",
  isRecurring: false,
  recurringFrequency: "monthly",
  recurringDayOfMonth: "",
  recurringSecondDayOfMonth: "",
  recurringDayOfWeek: "",
  recurringIntervalDays: "",
  notifyDaysBefore: "3",
  isRsfRelated: false,
  rsfCategory: "",
  saveAsDraft: false,
  markAsPaid: false,
  generateThroughYear: false,
});

const monthLabel = (month: string) => {
  const [year, monthPart] = month.split("-").map((value) => Number(value));
  const date = new Date(year, (monthPart || 1) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const shiftMonth = (month: string, delta: number) => {
  const [year, monthPart] = month.split("-").map((value) => Number(value));
  const date = new Date(year, (monthPart || 1) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const monthToDate = (month: string, day: number) => {
  const [year, monthPart] = month.split("-").map((value) => Number(value));
  const lastDay = new Date(year, monthPart, 0).getDate();
  const clampedDay = Math.min(Math.max(1, day), lastDay);
  return new Date(year, monthPart - 1, clampedDay);
};

const dateToKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const monthsRemainingInYear = (month: string) => {
  const [year, monthPart] = month.split("-").map((value) => Number(value));
  return Array.from({ length: 12 - monthPart + 1 }, (_, idx) => `${year}-${String(monthPart + idx).padStart(2, "0")}`);
};

const asCurrency = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const asNumber = (value: string | number | null | undefined) => Number(value || 0);

const parseJson = async <T,>(res: Response): Promise<T> => {
  if (!res.ok) {
    const message = await res.text();
    throw new Error(`${res.status}: ${message}`);
  }
  return res.json() as Promise<T>;
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export default function PersonalFinance({ isActive }: PersonalFinanceProps) {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [ownerFilter, setOwnerFilter] = useState<FinanceOwnerFilter>("all");
  const [budgetOwner, setBudgetOwner] = useState<FinanceOwner>("joint");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);
  const [entryForm, setEntryForm] = useState<EntryFormState>(DEFAULT_FORM(selectedMonth));
  const [showBudgetManager, setShowBudgetManager] = useState(false);
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});
  const [budgetCopyMonths, setBudgetCopyMonths] = useState<string[]>([]);
  const [hideGeneratePrompt, setHideGeneratePrompt] = useState(false);

  const entriesQuery = useQuery<FinanceEntry[]>({
    queryKey: ["/api/admin/finance/entries", selectedMonth, ownerFilter],
    enabled: isActive,
    queryFn: async () => {
      const res = await fetch(
        apiUrl(`/api/admin/finance/entries?month=${encodeURIComponent(selectedMonth)}&owner=${encodeURIComponent(ownerFilter)}`),
        { credentials: "include" },
      );
      return parseJson<FinanceEntry[]>(res);
    },
  });

  const budgetsQuery = useQuery<FinanceBudget[]>({
    queryKey: ["/api/admin/finance/budgets", selectedMonth],
    enabled: isActive,
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/admin/finance/budgets?month=${encodeURIComponent(selectedMonth)}`), {
        credentials: "include",
      });
      return parseJson<FinanceBudget[]>(res);
    },
  });

  const summaryQuery = useQuery<FinanceSummary>({
    queryKey: ["/api/admin/finance/summary", selectedMonth],
    enabled: isActive,
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/admin/finance/summary?month=${encodeURIComponent(selectedMonth)}`), {
        credentials: "include",
      });
      return parseJson<FinanceSummary>(res);
    },
  });

  const invalidateFinance = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/admin/finance/entries"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/finance/summary"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/finance/budgets"] }),
    ]);
  };

  const createEntryMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/admin/finance/entries", payload);
      return res.json();
    },
    onSuccess: async () => {
      await invalidateFinance();
      toast({ title: "Entry saved" });
      setDialogOpen(false);
    },
    onError: (error: unknown) => toast({ title: "Failed to save entry", description: getErrorMessage(error), variant: "destructive" }),
  });

  const updateEntryMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/admin/finance/entries/${id}`, payload);
      return res.json();
    },
    onSuccess: async () => {
      await invalidateFinance();
      toast({ title: "Entry updated" });
      setDialogOpen(false);
    },
    onError: (error: unknown) => toast({ title: "Failed to update entry", description: getErrorMessage(error), variant: "destructive" }),
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/finance/entries/${id}`);
    },
    onSuccess: async () => {
      await invalidateFinance();
      toast({ title: "Entry deleted" });
    },
    onError: (error: unknown) => toast({ title: "Failed to delete entry", description: getErrorMessage(error), variant: "destructive" }),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/finance/entries/${id}/mark-paid`, {});
      return res.json();
    },
    onSuccess: async () => {
      await invalidateFinance();
      toast({ title: "Marked as paid" });
    },
    onError: (error: unknown) => toast({ title: "Failed to mark paid", description: getErrorMessage(error), variant: "destructive" }),
  });

  const recurringMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/finance/recurring/generate?month=${encodeURIComponent(selectedMonth)}`);
      return res.json() as Promise<{ generated: number; month: string }>;
    },
    onSuccess: async (data) => {
      await invalidateFinance();
      toast({ title: `${data.generated} recurring entries generated for ${monthLabel(selectedMonth)}` });
      setHideGeneratePrompt(true);
    },
    onError: (error: unknown) => toast({ title: "Failed to generate recurring entries", description: getErrorMessage(error), variant: "destructive" }),
  });

  const saveBudgetsMutation = useMutation({
    mutationFn: async () => {
      const writes = EXPENSE_CATEGORIES.map((category) => {
        const raw = budgetDrafts[category] ?? "0";
        const value = Number(raw || 0);
        const budgetAmount = Number.isFinite(value) ? value.toFixed(2) : "0.00";
        return apiRequest("POST", "/api/admin/finance/budgets", {
          month: selectedMonth,
          owner: budgetOwner,
          category,
          budgetAmount,
        });
      });
      await Promise.all(writes);
    },
    onSuccess: async () => {
      await invalidateFinance();
      toast({ title: "Budgets saved" });
    },
    onError: (error: unknown) => toast({ title: "Failed to save budgets", description: getErrorMessage(error), variant: "destructive" }),
  });

  const copyBudgetsMutation = useMutation({
    mutationFn: async (targetMonths: string[]) => {
      const writes = targetMonths.flatMap((month) =>
        EXPENSE_CATEGORIES.map((category) => {
          const raw = budgetDrafts[category] ?? "0";
          const value = Number(raw || 0);
          const budgetAmount = Number.isFinite(value) ? value.toFixed(2) : "0.00";
          return apiRequest("POST", "/api/admin/finance/budgets", {
            month,
            owner: budgetOwner,
            category,
            budgetAmount,
          });
        }),
      );
      await Promise.all(writes);
      return targetMonths.length;
    },
    onSuccess: async (count) => {
      await invalidateFinance();
      toast({ title: `Copied budget to ${count} month${count === 1 ? "" : "s"}` });
    },
    onError: (error: unknown) => toast({ title: "Failed to copy budgets", description: getErrorMessage(error), variant: "destructive" }),
  });

  useEffect(() => {
    setEntryForm(DEFAULT_FORM(selectedMonth));
    setEditingEntry(null);
    setHideGeneratePrompt(false);
  }, [selectedMonth]);

  useEffect(() => {
    if (ownerFilter === "all") return;
    setBudgetOwner(ownerFilter);
  }, [ownerFilter]);

  const availableBudgetMonths = useMemo(() => {
    const [year] = selectedMonth.split("-").map((value) => Number(value));
    return Array.from({ length: 12 }, (_, idx) => `${year}-${String(idx + 1).padStart(2, "0")}`);
  }, [selectedMonth]);

  useEffect(() => {
    const budgets = budgetsQuery.data ?? [];
    const next: Record<string, string> = {};
    for (const category of EXPENSE_CATEGORIES) {
      const found = budgets.find((budget) => budget.category === category && budget.owner === budgetOwner);
      next[category] = found ? String(found.budgetAmount) : "";
    }
    setBudgetDrafts(next);
  }, [budgetsQuery.data, budgetOwner]);

  useEffect(() => {
    setBudgetCopyMonths([]);
  }, [selectedMonth]);

  const entries = entriesQuery.data ?? [];
  const summary = summaryQuery.data;
  const personalEntries = useMemo(() => entries.filter((entry) => !entry.rsfCategory), [entries]);
  const rsfEntries = useMemo(() => entries.filter((entry) => Boolean(entry.rsfCategory)), [entries]);
  const totalReceivedIncome = useMemo(
    () => entries.filter((entry) => entry.type === "income" && Boolean(entry.isPaid)).reduce((sum, entry) => sum + asNumber(entry.amount), 0),
    [entries],
  );
  const totalEnteredExpenses = useMemo(
    () => entries.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + asNumber(entry.amount), 0),
    [entries],
  );
  const netCashFlowFromReceived = totalReceivedIncome - totalEnteredExpenses;
  const today = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const statusForEntry = (entry: FinanceEntry): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
    if (Number(entry.amount || 0) <= 0 && !entry.dueDate && !entry.isPaid) {
      return { label: "Draft", variant: "secondary" };
    }
    if (entry.isPaid) {
      return { label: "Paid", variant: "default" };
    }
    if (!entry.dueDate) {
      return { label: "Upcoming", variant: "secondary" };
    }
    const due = new Date(`${entry.dueDate}T00:00:00`);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.ceil((due.getTime() - todayStart.getTime()) / dayMs);
    if (diffDays < 0) return { label: "Overdue", variant: "destructive" };
    if (diffDays <= 7) return { label: `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`, variant: "outline" };
    return { label: "Upcoming", variant: "secondary" };
  };

  const incomeEntries = personalEntries.filter((entry) => entry.type === "income");
  const incomeEntryMonth = (entry: FinanceEntry) => (entry.dueDate?.slice(0, 7) || entry.month);
  const incomeEntriesForSelectedMonth = incomeEntries.filter((entry) => incomeEntryMonth(entry) === selectedMonth);
  const expectedIncomeEntries = incomeEntriesForSelectedMonth.filter((entry) => !entry.isPaid);
  const receivedIncomeEntries = incomeEntriesForSelectedMonth.filter((entry) => Boolean(entry.isPaid));
  const coryExpectedIncome = expectedIncomeEntries
    .filter((entry) => entry.owner === "cory")
    .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
  const amyExpectedIncome = expectedIncomeEntries
    .filter((entry) => entry.owner === "amy")
    .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
  const coryReceivedIncome = receivedIncomeEntries
    .filter((entry) => entry.owner === "cory")
    .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
  const amyReceivedIncome = receivedIncomeEntries
    .filter((entry) => entry.owner === "amy")
    .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
  const combinedExpectedIncome = expectedIncomeEntries.reduce((sum, entry) => sum + asNumber(entry.amount), 0);
  const combinedReceivedIncome = receivedIncomeEntries.reduce((sum, entry) => sum + asNumber(entry.amount), 0);

  const personalActualByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of personalEntries) {
      if (entry.type !== "expense") continue;
      map.set(entry.category, (map.get(entry.category) || 0) + asNumber(entry.amount));
    }
    return map;
  }, [personalEntries]);

  const budgetAmountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const budget of budgetsQuery.data ?? []) {
      if (budget.owner !== budgetOwner) continue;
      map.set(budget.category, asNumber(budget.budgetAmount));
    }
    return map;
  }, [budgetsQuery.data, budgetOwner]);

  const budgetChartData = useMemo(
    () =>
      EXPENSE_CATEGORIES.map((category) => {
        const budgeted = budgetAmountByCategory.get(category) || 0;
        const actual = personalActualByCategory.get(category) || 0;
        return { category, budgeted, actual, remaining: budgeted - actual };
      }).filter((row) => row.budgeted > 0 || row.actual > 0),
    [budgetAmountByCategory, personalActualByCategory],
  );

  const selectedCategorySubcategories = entryForm.type === "expense"
    ? entryForm.isRsfRelated
      ? []
      : EXPENSE_SUBCATEGORIES[entryForm.category] ?? []
    : INCOME_SUBCATEGORIES[entryForm.category] ?? [];

  const openNewEntryDialog = (prefill?: Partial<EntryFormState>) => {
    setEditingEntry(null);
    setEntryForm({ ...DEFAULT_FORM(selectedMonth), ...prefill });
    setDialogOpen(true);
  };

  const openEditEntryDialog = (entry: FinanceEntry) => {
    const subcategories = entry.type === "expense"
      ? EXPENSE_SUBCATEGORIES[entry.category] ?? []
      : INCOME_SUBCATEGORIES[entry.category] ?? [];
    const isKnownSubcategory = !!entry.subcategory && subcategories.includes(entry.subcategory);
    setEditingEntry(entry);
    setEntryForm({
      month: entry.month,
      owner: entry.owner,
      type: entry.type,
      category: entry.rsfCategory || entry.category,
      subcategory: isKnownSubcategory ? entry.subcategory || "" : entry.subcategory ? "__other__" : "",
      customSubcategory: isKnownSubcategory ? "" : entry.subcategory || "",
      description: entry.description || "",
      amount: String(entry.amount || ""),
      dueDate: entry.dueDate || "",
      isRecurring: Boolean(entry.isRecurring),
      recurringFrequency: (entry.recurringFrequency || "monthly") as "monthly" | "weekly" | "every_x_days" | "bi_monthly",
      recurringDayOfMonth: entry.recurringDayOfMonth ? String(entry.recurringDayOfMonth) : "",
      recurringSecondDayOfMonth: "",
      recurringDayOfWeek: entry.recurringDayOfWeek !== null && entry.recurringDayOfWeek !== undefined ? String(entry.recurringDayOfWeek) : "",
      recurringIntervalDays: entry.recurringIntervalDays ? String(entry.recurringIntervalDays) : "",
      notifyDaysBefore: entry.notifyDaysBefore ? String(entry.notifyDaysBefore) : "3",
      isRsfRelated: Boolean(entry.rsfCategory),
      rsfCategory: entry.rsfCategory || "",
      saveAsDraft: Number(entry.amount || 0) <= 0 && !entry.dueDate && !entry.isPaid,
      markAsPaid: Boolean(entry.isPaid),
      generateThroughYear: false,
    });
    setDialogOpen(true);
  };

  const submitEntry = async () => {
    const normalizedSubcategory = entryForm.subcategory === "__other__"
      ? entryForm.customSubcategory.trim()
      : entryForm.subcategory.trim();
    const normalizedAmount = entryForm.amount.trim();
    const parsedAmount = normalizedAmount === "" ? 0 : Number(normalizedAmount);
    const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
    const shouldSaveAsDraft = entryForm.saveAsDraft || !hasValidAmount;
    const normalizedRecurringFrequency = entryForm.recurringFrequency === "bi_monthly" ? "monthly" : entryForm.recurringFrequency;
    const payload = {
      month: entryForm.month,
      owner: entryForm.owner,
      type: entryForm.type,
      category: entryForm.isRsfRelated && entryForm.type === "expense"
        ? (entryForm.rsfCategory || entryForm.category)
        : entryForm.category,
      subcategory: normalizedSubcategory || null,
      description: entryForm.description.trim() || null,
      amount: hasValidAmount ? parsedAmount.toFixed(2) : "0.00",
      dueDate: entryForm.dueDate ? entryForm.dueDate : null,
      isRecurring: entryForm.isRecurring,
      recurringFrequency: entryForm.isRecurring ? normalizedRecurringFrequency : null,
      recurringDayOfMonth:
        entryForm.isRecurring && entryForm.recurringFrequency === "monthly" && entryForm.recurringDayOfMonth
          ? Number(entryForm.recurringDayOfMonth)
          : null,
      recurringDayOfWeek:
        entryForm.isRecurring && (entryForm.recurringFrequency === "weekly" || entryForm.recurringFrequency === "every_x_days") && entryForm.recurringDayOfWeek !== ""
          ? Number(entryForm.recurringDayOfWeek)
          : null,
      recurringIntervalDays:
        entryForm.isRecurring && entryForm.recurringFrequency === "every_x_days" && entryForm.recurringIntervalDays
          ? Number(entryForm.recurringIntervalDays)
          : null,
      notifyDaysBefore: entryForm.isRecurring ? Number(entryForm.notifyDaysBefore || 3) : 3,
      rsfCategory: entryForm.isRsfRelated ? (entryForm.rsfCategory || entryForm.category || null) : null,
      isPaid: shouldSaveAsDraft ? false : entryForm.markAsPaid,
      paidDate: shouldSaveAsDraft ? null : entryForm.markAsPaid ? new Date().toISOString().slice(0, 10) : null,
      notificationSent: false,
    };

    if (!hasValidAmount && !shouldSaveAsDraft) {
      toast({ title: "Enter an amount or save as draft", variant: "destructive" });
      return;
    }
    if (!payload.category) {
      toast({ title: "Category is required", variant: "destructive" });
      return;
    }
    if (entryForm.type === "expense" && entryForm.isRsfRelated && !entryForm.rsfCategory) {
      toast({ title: "Choose an RSF category", variant: "destructive" });
      return;
    }
    if (entryForm.isRecurring) {
      if (entryForm.recurringFrequency === "monthly" && !entryForm.recurringDayOfMonth) {
        toast({ title: "Enter recurring day of month", variant: "destructive" });
        return;
      }
      if (entryForm.recurringFrequency === "bi_monthly" && (!entryForm.recurringDayOfMonth || !entryForm.recurringSecondDayOfMonth)) {
        toast({ title: "Enter both bi-monthly pay days", variant: "destructive" });
        return;
      }
      if (
        (entryForm.recurringFrequency === "weekly" || entryForm.recurringFrequency === "every_x_days") &&
        entryForm.recurringDayOfWeek === ""
      ) {
        toast({ title: "Select day of week", variant: "destructive" });
        return;
      }
      if (entryForm.recurringFrequency === "every_x_days" && !entryForm.recurringIntervalDays) {
        toast({ title: "Enter interval days", variant: "destructive" });
        return;
      }
    }

    if (editingEntry) {
      updateEntryMutation.mutate({ id: editingEntry.id, payload });
      return;
    }

    const shouldExpandRecurringIncome =
      entryForm.type === "income" &&
      entryForm.isRecurring &&
      (entryForm.generateThroughYear || entryForm.recurringFrequency === "bi_monthly") &&
      !shouldSaveAsDraft;

    if (!shouldExpandRecurringIncome) {
      createEntryMutation.mutate(payload);
      return;
    }

    if (!hasValidAmount) {
      toast({ title: "Amount is required for recurring expected income", variant: "destructive" });
      return;
    }

    const targetMonths = monthsRemainingInYear(entryForm.month);
    const dueDateSet = new Set<string>();
    const addDueDate = (date: Date) => {
      const key = dateToKey(date);
      if (key >= `${entryForm.month}-01`) {
        dueDateSet.add(key);
      }
    };

    if (entryForm.recurringFrequency === "monthly") {
      const day = Number(entryForm.recurringDayOfMonth || "1");
      for (const month of targetMonths) {
        addDueDate(monthToDate(month, day));
      }
    } else if (entryForm.recurringFrequency === "bi_monthly") {
      const firstDay = Number(entryForm.recurringDayOfMonth || "10");
      const secondDay = Number(entryForm.recurringSecondDayOfMonth || "25");
      for (const month of targetMonths) {
        addDueDate(monthToDate(month, firstDay));
        addDueDate(monthToDate(month, secondDay));
      }
    } else if (entryForm.recurringFrequency === "weekly") {
      const dow = Number(entryForm.recurringDayOfWeek || "1");
      for (const month of targetMonths) {
        const [year, monthPart] = month.split("-").map((value) => Number(value));
        const cursor = new Date(year, monthPart - 1, 1);
        while (cursor.getMonth() === monthPart - 1) {
          if (cursor.getDay() === dow) addDueDate(cursor);
          cursor.setDate(cursor.getDate() + 1);
        }
      }
    } else {
      const interval = Math.max(1, Number(entryForm.recurringIntervalDays || "14"));
      const start = entryForm.dueDate ? new Date(`${entryForm.dueDate}T00:00:00`) : monthToDate(entryForm.month, 1);
      const [year] = entryForm.month.split("-").map((value) => Number(value));
      const end = new Date(year, 11, 31);
      const cursor = new Date(start);
      while (cursor <= end) {
        addDueDate(cursor);
        cursor.setDate(cursor.getDate() + interval);
      }
    }

    const sortedDueDates = Array.from(dueDateSet).sort();
    if (!sortedDueDates.length) {
      toast({ title: "No recurring dates generated", variant: "destructive" });
      return;
    }

    const recurringPayloads = sortedDueDates.map((dueDate) => ({
      ...payload,
      month: dueDate.slice(0, 7),
      dueDate,
      isRecurring: false,
      recurringFrequency: null,
      recurringDayOfMonth: null,
      recurringDayOfWeek: null,
      recurringIntervalDays: null,
      notifyDaysBefore: Number(entryForm.notifyDaysBefore || 3),
      isPaid: false,
      paidDate: null,
      notificationSent: false,
    }));

    try {
      await Promise.all(recurringPayloads.map((row) => apiRequest("POST", "/api/admin/finance/entries", row)));
      await invalidateFinance();
      toast({ title: `Created ${recurringPayloads.length} expected income entries through year-end` });
      setDialogOpen(false);
    } catch (error) {
      toast({ title: "Failed to create recurring entries", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const loading = entriesQuery.isLoading || summaryQuery.isLoading || budgetsQuery.isLoading;
  const hasNoEntries = !loading && entries.length === 0;
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2" data-testid="selector-month">
              <Button variant="outline" size="icon" onClick={() => setSelectedMonth((current) => shiftMonth(current, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="rounded-md border px-3 py-2 text-sm font-medium min-w-[170px] text-center">
                {monthLabel(selectedMonth)}
              </div>
              <Button variant="outline" size="icon" onClick={() => setSelectedMonth((current) => shiftMonth(current, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2" data-testid="filter-owner">
              {(["all", "cory", "amy", "joint"] as const).map((owner) => (
                <Button
                  key={owner}
                  size="sm"
                  variant={ownerFilter === owner ? "default" : "outline"}
                  onClick={() => setOwnerFilter(owner)}
                >
                  {owner === "all" ? "All" : owner[0].toUpperCase() + owner.slice(1)}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => recurringMutation.mutate()} data-testid="button-generate-recurring">
                <Calendar className="mr-2 h-4 w-4" />
                Generate Recurring
              </Button>
              <Button
                variant="outline"
                onClick={() => openNewEntryDialog({ isRsfRelated: true, type: "expense", category: RSF_CATEGORIES[0], rsfCategory: RSF_CATEGORIES[0] })}
                data-testid="button-add-rsf-entry"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add RSF Entry
              </Button>
              <Button onClick={() => openNewEntryDialog()} data-testid="button-add-personal-entry">
                <Plus className="mr-2 h-4 w-4" />
                Add Personal Entry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Combined Income</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-600">{asCurrency(summary?.totalIncome.combined ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Combined Expenses</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-red-600">{asCurrency(summary?.totalExpenses.combined ?? 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Net Cash Flow (Received)</CardTitle></CardHeader>
          <CardContent className={`text-2xl font-semibold ${netCashFlowFromReceived >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {asCurrency(netCashFlowFromReceived)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">RSF Spend</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-blue-600">{asCurrency(summary?.rsfTotal ?? 0)}</CardContent>
        </Card>
      </div>

      {(summary?.upcomingDue.length || summary?.overdue.length) ? (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader><CardTitle className="text-base">Due Date Alerts</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {summary.overdue.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold text-red-700">Overdue</p>
                {summary.overdue.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 rounded border border-red-200 bg-white px-3 py-2">
                    <div>
                      <div className="font-medium">
                        {entry.subcategory || entry.category} - {asCurrency(asNumber(entry.amount))}
                        {entry.rsfCategory ? <Badge variant="outline" className="ml-2 border-blue-300 text-blue-700">RSF</Badge> : null}
                      </div>
                      <div className="text-xs text-muted-foreground">Due {entry.dueDate}</div>
                    </div>
                    <Button size="sm" onClick={() => markPaidMutation.mutate(entry.id)} data-testid={`button-mark-paid-${entry.id}`}>
                      Mark Paid
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {summary.upcomingDue.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold text-amber-700">Due in Next 7 Days</p>
                {summary.upcomingDue.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 rounded border border-amber-200 bg-white px-3 py-2">
                    <div>
                      <div className="font-medium">
                        {entry.subcategory || entry.category} - {asCurrency(asNumber(entry.amount))}
                        {entry.rsfCategory ? <Badge variant="outline" className="ml-2 border-blue-300 text-blue-700">RSF</Badge> : null}
                      </div>
                      <div className="text-xs text-muted-foreground">Due {entry.dueDate}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => markPaidMutation.mutate(entry.id)} data-testid={`button-mark-paid-${entry.id}`}>
                      Mark Paid
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Personal Budget vs Actual</CardTitle></CardHeader>
        <CardContent>
          {budgetChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No personal budget or personal expense activity for this month yet.</p>
          ) : (
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetChartData} layout="vertical" margin={{ left: 18, right: 20, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => `$${value}`} />
                  <YAxis type="category" dataKey="category" width={120} />
                  <Tooltip formatter={(value: unknown) => asCurrency(Number(value || 0))} />
                  <Bar dataKey="budgeted" fill="#9ca3af" name="Budgeted" />
                  <Bar dataKey="actual" fill="#2563eb" name="Actual" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Income This Month</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Viewing month</Label>
            <Input
              type="month"
              className="w-[170px]"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              data-testid="selector-income-month"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4 rounded border p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Expected Income</h4>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h5 className="font-medium">Cory</h5>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        openNewEntryDialog({
                          owner: "cory",
                          type: "income",
                          category: INCOME_CATEGORIES[0],
                          isRecurring: true,
                          recurringFrequency: "weekly",
                          recurringDayOfWeek: "5",
                          generateThroughYear: true,
                        })
                      }
                    >
                      + Add Expected
                    </Button>
                  </div>
                  <div className="space-y-1 text-sm">
                    {coryExpectedIncome.length ? coryExpectedIncome.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-2">
                        <span>{entry.subcategory || entry.category}{entry.dueDate ? ` (${entry.dueDate})` : ""}</span>
                        <span>{asCurrency(asNumber(entry.amount))}</span>
                      </div>
                    )) : <span className="text-muted-foreground">No expected entries</span>}
                  </div>
                  <div className="mt-3 border-t pt-2 font-semibold">
                    Total: {asCurrency(coryExpectedIncome.reduce((sum, entry) => sum + asNumber(entry.amount), 0))}
                  </div>
                </div>
                <div className="rounded border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h5 className="font-medium">Amy</h5>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        openNewEntryDialog({
                          owner: "amy",
                          type: "income",
                          category: INCOME_CATEGORIES[0],
                          isRecurring: true,
                          recurringFrequency: "bi_monthly",
                          recurringDayOfMonth: "10",
                          recurringSecondDayOfMonth: "25",
                          generateThroughYear: true,
                        })
                      }
                    >
                      + Add Expected
                    </Button>
                  </div>
                  <div className="space-y-1 text-sm">
                    {amyExpectedIncome.length ? amyExpectedIncome.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-2">
                        <span>{entry.subcategory || entry.category}{entry.dueDate ? ` (${entry.dueDate})` : ""}</span>
                        <span>{asCurrency(asNumber(entry.amount))}</span>
                      </div>
                    )) : <span className="text-muted-foreground">No expected entries</span>}
                  </div>
                  <div className="mt-3 border-t pt-2 font-semibold">
                    Total: {asCurrency(amyExpectedIncome.reduce((sum, entry) => sum + asNumber(entry.amount), 0))}
                  </div>
                </div>
              </div>
              <div className="rounded border bg-muted/30 p-3 font-semibold">
                Combined Expected Income: {asCurrency(combinedExpectedIncome)}
              </div>
            </div>

            <div className="space-y-4 rounded border p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Received Income</h4>
                <Button size="sm" variant="outline" onClick={() => openNewEntryDialog({ owner: "joint", type: "income", category: INCOME_CATEGORIES[0], markAsPaid: true })}>
                  + Add Received
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded border p-3">
                  <h5 className="mb-2 font-medium">Cory</h5>
                  <div className="space-y-1 text-sm">
                    {coryReceivedIncome.length ? coryReceivedIncome.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between">
                        <span>{entry.subcategory || entry.category}</span>
                        <span>{asCurrency(asNumber(entry.amount))}</span>
                      </div>
                    )) : <span className="text-muted-foreground">No received entries</span>}
                  </div>
                  <div className="mt-3 border-t pt-2 font-semibold">
                    Total: {asCurrency(coryReceivedIncome.reduce((sum, entry) => sum + asNumber(entry.amount), 0))}
                  </div>
                </div>
                <div className="rounded border p-3">
                  <h5 className="mb-2 font-medium">Amy</h5>
                  <div className="space-y-1 text-sm">
                    {amyReceivedIncome.length ? amyReceivedIncome.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between">
                        <span>{entry.subcategory || entry.category}</span>
                        <span>{asCurrency(asNumber(entry.amount))}</span>
                      </div>
                    )) : <span className="text-muted-foreground">No received entries</span>}
                  </div>
                  <div className="mt-3 border-t pt-2 font-semibold">
                    Total: {asCurrency(amyReceivedIncome.reduce((sum, entry) => sum + asNumber(entry.amount), 0))}
                  </div>
                </div>
              </div>
              <div className="rounded border bg-muted/30 p-3 font-semibold">
                Combined Received Income: {asCurrency(combinedReceivedIncome)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasNoEntries && !hideGeneratePrompt && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">No entries for {monthLabel(selectedMonth)} yet. Generate from recurring?</p>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => recurringMutation.mutate()}>Generate</Button>
              <Button variant="outline" onClick={() => setHideGeneratePrompt(true)}>Start Fresh</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Personal Entries ({monthLabel(selectedMonth)})</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              type="month"
              className="w-[170px]"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              data-testid="selector-personal-entries-month"
            />
            <Button size="sm" onClick={() => openNewEntryDialog({ isRsfRelated: false })}>
              <Plus className="mr-2 h-4 w-4" />
              Add Personal
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[1024px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Owner</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Category</th><th className="py-2 pr-3">Subcategory</th><th className="py-2 pr-3">Description</th><th className="py-2 pr-3">Amount</th><th className="py-2 pr-3">Due Date</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {personalEntries.map((entry) => {
                const status = statusForEntry(entry);
                return (
                  <tr key={entry.id} className="border-b align-top">
                    <td className="py-3 pr-3">{entry.month}</td>
                    <td className="py-3 pr-3 capitalize">{entry.owner}</td>
                    <td className="py-3 pr-3 capitalize">{entry.type}</td>
                    <td className="py-3 pr-3">{entry.category}</td>
                    <td className="py-3 pr-3">{entry.subcategory || "-"}</td>
                    <td className="py-3 pr-3">{entry.description || "-"}</td>
                    <td className="py-3 pr-3 font-medium">{asCurrency(asNumber(entry.amount))}</td>
                    <td className="py-3 pr-3">{entry.dueDate || "-"}</td>
                    <td className="py-3 pr-3"><Badge variant={status.variant}>{status.label}</Badge></td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEditEntryDialog(entry)}><Pencil className="h-4 w-4" /></Button>
                        {!entry.isPaid && (
                          <Button size="icon" variant="ghost" onClick={() => markPaidMutation.mutate(entry.id)} data-testid={`button-mark-paid-${entry.id}`}>
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => deleteEntryMutation.mutate(entry.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!personalEntries.length && (
                <tr><td className="py-6 text-center text-muted-foreground" colSpan={10}>No personal entries found for {monthLabel(selectedMonth)}.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>RSF Business Entries</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openNewEntryDialog({ isRsfRelated: true, type: "expense", category: RSF_CATEGORIES[0], rsfCategory: RSF_CATEGORIES[0] })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add RSF
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[1024px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Owner</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Subcategory</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Due Date</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">RSF Category</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rsfEntries.map((entry) => {
                const status = statusForEntry(entry);
                return (
                  <tr key={entry.id} className="border-b align-top">
                    <td className="py-3 pr-3">{entry.month}</td>
                    <td className="py-3 pr-3 capitalize">{entry.owner}</td>
                    <td className="py-3 pr-3 capitalize">{entry.type}</td>
                    <td className="py-3 pr-3">{entry.category}</td>
                    <td className="py-3 pr-3">{entry.subcategory || "-"}</td>
                    <td className="py-3 pr-3">{entry.description || "-"}</td>
                    <td className="py-3 pr-3 font-medium">{asCurrency(asNumber(entry.amount))}</td>
                    <td className="py-3 pr-3">{entry.dueDate || "-"}</td>
                    <td className="py-3 pr-3"><Badge variant={status.variant}>{status.label}</Badge></td>
                    <td className="py-3 pr-3">{entry.rsfCategory || "-"}</td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEditEntryDialog(entry)}><Pencil className="h-4 w-4" /></Button>
                        {!entry.isPaid && (
                          <Button size="icon" variant="ghost" onClick={() => markPaidMutation.mutate(entry.id)} data-testid={`button-mark-paid-${entry.id}`}>
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => deleteEntryMutation.mutate(entry.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rsfEntries.length && (
                <tr><td className="py-6 text-center text-muted-foreground" colSpan={11}>No RSF entries found for {monthLabel(selectedMonth)}.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setShowBudgetManager((current) => !current)}>
            <CardTitle>Budget Manager</CardTitle>
            <ChevronDown className={`h-4 w-4 transition-transform ${showBudgetManager ? "rotate-180" : ""}`} />
          </button>
        </CardHeader>
        {showBudgetManager && (
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Label>Budget Owner</Label>
              <Select value={budgetOwner} onValueChange={(value) => setBudgetOwner(value as FinanceOwner)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cory">Cory</SelectItem>
                  <SelectItem value="amy">Amy</SelectItem>
                  <SelectItem value="joint">Joint</SelectItem>
                </SelectContent>
              </Select>
              <Label className="ml-3">Budget Month</Label>
              <Input
                type="month"
                className="w-[180px]"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              {EXPENSE_CATEGORIES.map((category) => {
                const actual = personalActualByCategory.get(category) || 0;
                const budget = Number(budgetDrafts[category] || 0);
                const difference = budget - actual;
                return (
                  <div key={category} className="grid grid-cols-1 items-center gap-2 rounded border p-3 md:grid-cols-4">
                    <div className="font-medium">{category}</div>
                    <Input type="number" step="0.01" value={budgetDrafts[category] ?? ""} onChange={(event) => setBudgetDrafts((current) => ({ ...current, [category]: event.target.value }))} />
                    <div>Actual: {asCurrency(actual)}</div>
                    <div className={difference < 0 ? "text-red-600 font-medium" : "text-emerald-600 font-medium"}>Difference: {asCurrency(difference)}</div>
                  </div>
                );
              })}
            </div>
            <div className="rounded border p-3 space-y-3">
              <div className="text-sm font-medium">Duplicate this budget to other months</div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
                {availableBudgetMonths
                  .filter((month) => month !== selectedMonth)
                  .map((month) => (
                    <label key={month} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={budgetCopyMonths.includes(month)}
                        onCheckedChange={(checked) =>
                          setBudgetCopyMonths((current) =>
                            checked ? [...current, month] : current.filter((item) => item !== month),
                          )
                        }
                      />
                      {monthLabel(month)}
                    </label>
                  ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => copyBudgetsMutation.mutate(monthsRemainingInYear(selectedMonth).filter((month) => month !== selectedMonth))}>
                  Duplicate to all remaining months
                </Button>
                <Button type="button" variant="outline" disabled={budgetCopyMonths.length === 0} onClick={() => copyBudgetsMutation.mutate(budgetCopyMonths)}>
                  Duplicate to selected months
                </Button>
              </div>
            </div>
            <Button onClick={() => saveBudgetsMutation.mutate()}>Save Budgets</Button>
          </CardContent>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Entry" : "Add Entry"}</DialogTitle>
            <DialogDescription>Track expenses, income, due dates, recurring bills, and RSF-related spending.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Month</Label><Input type="month" value={entryForm.month} onChange={(event) => setEntryForm((current) => ({ ...current, month: event.target.value }))} /></div>
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select value={entryForm.owner} onValueChange={(value) => setEntryForm((current) => ({ ...current, owner: value as FinanceOwner }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cory">Cory</SelectItem><SelectItem value="amy">Amy</SelectItem><SelectItem value="joint">Joint</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={entryForm.type}
                onValueChange={(value) =>
                  setEntryForm((current) => ({
                    ...current,
                    type: value as FinanceType,
                    category:
                      value === "expense"
                        ? (current.isRsfRelated ? RSF_CATEGORIES[0] : EXPENSE_CATEGORIES[0])
                        : INCOME_CATEGORIES[0],
                    subcategory: "",
                    customSubcategory: "",
                    rsfCategory: value === "expense" && current.isRsfRelated ? RSF_CATEGORIES[0] : current.rsfCategory,
                  }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="expense">Expense</SelectItem><SelectItem value="income">Income</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{entryForm.isRsfRelated && entryForm.type === "expense" ? "Business Category" : "Category"}</Label>
              <Select
                value={entryForm.category}
                onValueChange={(value) =>
                  setEntryForm((current) => ({
                    ...current,
                    category: value,
                    rsfCategory: current.isRsfRelated && current.type === "expense" ? value : current.rsfCategory,
                    subcategory: "",
                    customSubcategory: "",
                  }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(entryForm.type === "expense"
                    ? (entryForm.isRsfRelated ? RSF_CATEGORIES : EXPENSE_CATEGORIES)
                    : INCOME_CATEGORIES
                  ).map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Subcategory</Label>
              <Select value={entryForm.subcategory} onValueChange={(value) => setEntryForm((current) => ({ ...current, subcategory: value }))}>
                <SelectTrigger><SelectValue placeholder="Select subcategory" /></SelectTrigger>
                <SelectContent>
                  {selectedCategorySubcategories.map((subcategory) => <SelectItem key={subcategory} value={subcategory}>{subcategory}</SelectItem>)}
                  <SelectItem value="__other__">Other (type your own)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {entryForm.subcategory === "__other__" && (
              <div className="space-y-2 md:col-span-2">
                <Label>Custom Subcategory</Label>
                <Input value={entryForm.customSubcategory} onChange={(event) => setEntryForm((current) => ({ ...current, customSubcategory: event.target.value }))} />
              </div>
            )}
            <div className="space-y-2 md:col-span-2"><Label>Description (optional)</Label><Input value={entryForm.description} onChange={(event) => setEntryForm((current) => ({ ...current, description: event.target.value }))} /></div>
            <div className="space-y-2">
              <Label>Amount {entryForm.saveAsDraft ? "(optional draft)" : ""}</Label>
              <Input type="number" step="0.01" value={entryForm.amount} onChange={(event) => setEntryForm((current) => ({ ...current, amount: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{entryForm.type === "income" ? "Pay Date (optional)" : "Due Date (optional)"}</Label>
              <Input type="date" value={entryForm.dueDate} onChange={(event) => setEntryForm((current) => ({ ...current, dueDate: event.target.value }))} />
            </div>
            <div className="md:col-span-2 rounded border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="save-as-draft"
                  checked={entryForm.saveAsDraft}
                  onCheckedChange={(checked) =>
                    setEntryForm((current) => ({
                      ...current,
                      saveAsDraft: Boolean(checked),
                      markAsPaid: Boolean(checked) ? false : current.markAsPaid,
                    }))
                  }
                />
                <Label htmlFor="save-as-draft">Save as draft (amount/date can be filled later)</Label>
              </div>
            </div>
            <div className="md:col-span-2 rounded border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="mark-as-paid"
                  checked={entryForm.markAsPaid}
                  onCheckedChange={(checked) => setEntryForm((current) => ({ ...current, markAsPaid: Boolean(checked) }))}
                  disabled={entryForm.saveAsDraft}
                />
                <Label htmlFor="mark-as-paid">{entryForm.type === "income" ? "Mark as received now" : "Mark as paid now"}</Label>
              </div>
            </div>
            <div className="md:col-span-2 space-y-3 rounded border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is-recurring"
                  checked={entryForm.isRecurring}
                  onCheckedChange={(checked) => setEntryForm((current) => ({ ...current, isRecurring: Boolean(checked) }))}
                />
                <Label htmlFor="is-recurring">Is recurring?</Label>
              </div>
              {entryForm.isRecurring && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Recurring cadence</Label>
                    <Select
                      value={entryForm.recurringFrequency}
                      onValueChange={(value) =>
                        setEntryForm((current) => ({
                          ...current,
                          recurringFrequency: value as "monthly" | "weekly" | "every_x_days" | "bi_monthly",
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="bi_monthly">Bi-Monthly (2x per month)</SelectItem>
                        <SelectItem value="every_x_days">Every X days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Notify X days before</Label>
                    <Input
                      type="number"
                      min={0}
                      max={31}
                      value={entryForm.notifyDaysBefore}
                      onChange={(event) => setEntryForm((current) => ({ ...current, notifyDaysBefore: event.target.value }))}
                    />
                  </div>

                  {entryForm.recurringFrequency === "monthly" && (
                    <div className="space-y-2">
                      <Label>Recurring Day of Month</Label>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={entryForm.recurringDayOfMonth}
                        onChange={(event) => setEntryForm((current) => ({ ...current, recurringDayOfMonth: event.target.value }))}
                      />
                    </div>
                  )}

                  {entryForm.recurringFrequency === "bi_monthly" && (
                    <>
                      <div className="space-y-2">
                        <Label>First pay day of month</Label>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          placeholder="10"
                          value={entryForm.recurringDayOfMonth}
                          onChange={(event) => setEntryForm((current) => ({ ...current, recurringDayOfMonth: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Second pay day of month</Label>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          placeholder="25"
                          value={entryForm.recurringSecondDayOfMonth}
                          onChange={(event) => setEntryForm((current) => ({ ...current, recurringSecondDayOfMonth: event.target.value }))}
                        />
                      </div>
                    </>
                  )}

                  {(entryForm.recurringFrequency === "weekly" || entryForm.recurringFrequency === "every_x_days") && (
                    <div className="space-y-2">
                      <Label>Day of week</Label>
                      <Select
                        value={entryForm.recurringDayOfWeek}
                        onValueChange={(value) => setEntryForm((current) => ({ ...current, recurringDayOfWeek: value }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Sunday</SelectItem>
                          <SelectItem value="1">Monday</SelectItem>
                          <SelectItem value="2">Tuesday</SelectItem>
                          <SelectItem value="3">Wednesday</SelectItem>
                          <SelectItem value="4">Thursday</SelectItem>
                          <SelectItem value="5">Friday</SelectItem>
                          <SelectItem value="6">Saturday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {entryForm.recurringFrequency === "every_x_days" && (
                    <div className="space-y-2">
                      <Label>Recurring every X days</Label>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={entryForm.recurringIntervalDays}
                        onChange={(event) => setEntryForm((current) => ({ ...current, recurringIntervalDays: event.target.value }))}
                      />
                    </div>
                  )}

                  {entryForm.type === "income" && (
                    <div className="md:col-span-2 rounded border p-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="generate-through-year"
                          checked={entryForm.generateThroughYear}
                          onCheckedChange={(checked) => setEntryForm((current) => ({ ...current, generateThroughYear: Boolean(checked) }))}
                        />
                        <Label htmlFor="generate-through-year">Create expected income entries through end of year</Label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="md:col-span-2 space-y-3 rounded border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is-rsf-related"
                  checked={entryForm.isRsfRelated}
                  onCheckedChange={(checked) =>
                    setEntryForm((current) => ({
                      ...current,
                      isRsfRelated: Boolean(checked),
                      category:
                        current.type === "expense"
                          ? (Boolean(checked) ? RSF_CATEGORIES[0] : EXPENSE_CATEGORIES[0])
                          : current.category,
                      rsfCategory: Boolean(checked) ? RSF_CATEGORIES[0] : "",
                      subcategory: "",
                      customSubcategory: "",
                    }))
                  }
                />
                <Label htmlFor="is-rsf-related">RSF related?</Label>
              </div>
              {entryForm.isRsfRelated && (
                <div className="space-y-2">
                  <Label>RSF Category</Label>
                  <Select value={entryForm.rsfCategory} onValueChange={(value) => setEntryForm((current) => ({ ...current, rsfCategory: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select RSF category" /></SelectTrigger>
                    <SelectContent>{RSF_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitEntry}>Save Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
