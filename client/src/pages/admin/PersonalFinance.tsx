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
  recurringFrequency: "monthly" | "weekly" | "every_x_days";
  recurringDayOfMonth: string;
  recurringDayOfWeek: string;
  recurringIntervalDays: string;
  notifyDaysBefore: string;
  isRsfRelated: boolean;
  rsfCategory: string;
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
  recurringDayOfWeek: "",
  recurringIntervalDays: "",
  notifyDaysBefore: "3",
  isRsfRelated: false,
  rsfCategory: "",
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

  useEffect(() => {
    setEntryForm(DEFAULT_FORM(selectedMonth));
    setEditingEntry(null);
    setHideGeneratePrompt(false);
  }, [selectedMonth]);

  useEffect(() => {
    if (ownerFilter === "all") return;
    setBudgetOwner(ownerFilter);
  }, [ownerFilter]);

  useEffect(() => {
    const budgets = budgetsQuery.data ?? [];
    const next: Record<string, string> = {};
    for (const category of EXPENSE_CATEGORIES) {
      const found = budgets.find((budget) => budget.category === category && budget.owner === budgetOwner);
      next[category] = found ? String(found.budgetAmount) : "";
    }
    setBudgetDrafts(next);
  }, [budgetsQuery.data, budgetOwner]);

  const entries = entriesQuery.data ?? [];
  const summary = summaryQuery.data;
  const budgetChartData = (summary?.byCategory ?? []).filter((row) => row.budgeted > 0 || row.actual > 0);
  const today = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const statusForEntry = (entry: FinanceEntry): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
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

  const incomeEntries = entries.filter((entry) => entry.type === "income");
  const coryIncome = incomeEntries.filter((entry) => entry.owner === "cory");
  const amyIncome = incomeEntries.filter((entry) => entry.owner === "amy");
  const combinedIncome = incomeEntries.reduce((sum, entry) => sum + asNumber(entry.amount), 0);

  const actualByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of summary?.byCategory ?? []) {
      map.set(row.category, row.actual);
    }
    return map;
  }, [summary?.byCategory]);

  const selectedCategorySubcategories = entryForm.type === "expense"
    ? EXPENSE_SUBCATEGORIES[entryForm.category] ?? []
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
      category: entry.category,
      subcategory: isKnownSubcategory ? entry.subcategory || "" : entry.subcategory ? "__other__" : "",
      customSubcategory: isKnownSubcategory ? "" : entry.subcategory || "",
      description: entry.description || "",
      amount: String(entry.amount || ""),
      dueDate: entry.dueDate || "",
      isRecurring: Boolean(entry.isRecurring),
      recurringFrequency: (entry.recurringFrequency || "monthly") as "monthly" | "weekly" | "every_x_days",
      recurringDayOfMonth: entry.recurringDayOfMonth ? String(entry.recurringDayOfMonth) : "",
      recurringDayOfWeek: entry.recurringDayOfWeek !== null && entry.recurringDayOfWeek !== undefined ? String(entry.recurringDayOfWeek) : "",
      recurringIntervalDays: entry.recurringIntervalDays ? String(entry.recurringIntervalDays) : "",
      notifyDaysBefore: entry.notifyDaysBefore ? String(entry.notifyDaysBefore) : "3",
      isRsfRelated: Boolean(entry.rsfCategory),
      rsfCategory: entry.rsfCategory || "",
    });
    setDialogOpen(true);
  };

  const submitEntry = () => {
    const normalizedSubcategory = entryForm.subcategory === "__other__"
      ? entryForm.customSubcategory.trim()
      : entryForm.subcategory.trim();
    const payload = {
      month: entryForm.month,
      owner: entryForm.owner,
      type: entryForm.type,
      category: entryForm.category,
      subcategory: normalizedSubcategory || null,
      description: entryForm.description.trim() || null,
      amount: Number(entryForm.amount || 0).toFixed(2),
      dueDate: entryForm.type === "expense" && entryForm.dueDate ? entryForm.dueDate : null,
      isRecurring: entryForm.isRecurring,
      recurringFrequency: entryForm.isRecurring ? entryForm.recurringFrequency : null,
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
      rsfCategory: entryForm.isRsfRelated ? entryForm.rsfCategory || null : null,
      isPaid: false,
      paidDate: null,
      notificationSent: false,
    };

    if (!entryForm.amount || Number(entryForm.amount) <= 0) {
      toast({ title: "Amount is required", variant: "destructive" });
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
    createEntryMutation.mutate(payload);
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
              <Button onClick={() => openNewEntryDialog()} data-testid="button-add-entry">
                <Plus className="mr-2 h-4 w-4" />
                Add Entry
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
          <CardHeader className="pb-2"><CardTitle className="text-sm">Net Cash Flow</CardTitle></CardHeader>
          <CardContent className={`text-2xl font-semibold ${(summary?.netCashFlow ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {asCurrency(summary?.netCashFlow ?? 0)}
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
                      <div className="font-medium">{entry.subcategory || entry.category} — {asCurrency(asNumber(entry.amount))}</div>
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
                      <div className="font-medium">{entry.subcategory || entry.category} — {asCurrency(asNumber(entry.amount))}</div>
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
        <CardHeader><CardTitle>Budget vs Actual</CardTitle></CardHeader>
        <CardContent>
          {budgetChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No budget or expense activity for this month yet.</p>
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
        <CardHeader><CardTitle>Income This Month</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded border p-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold">Cory</h4>
                <Button size="sm" variant="outline" onClick={() => openNewEntryDialog({ owner: "cory", type: "income", category: INCOME_CATEGORIES[0] })}>
                  + Add Income
                </Button>
              </div>
              <div className="space-y-1 text-sm">
                {coryIncome.length ? coryIncome.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between">
                    <span>{entry.subcategory || entry.category}</span>
                    <span>{asCurrency(asNumber(entry.amount))}</span>
                  </div>
                )) : <span className="text-muted-foreground">No income entries</span>}
              </div>
              <div className="mt-3 border-t pt-2 font-semibold">
                Total: {asCurrency(coryIncome.reduce((sum, entry) => sum + asNumber(entry.amount), 0))}
              </div>
            </div>
            <div className="rounded border p-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold">Amy</h4>
                <Button size="sm" variant="outline" onClick={() => openNewEntryDialog({ owner: "amy", type: "income", category: INCOME_CATEGORIES[0] })}>
                  + Add Income
                </Button>
              </div>
              <div className="space-y-1 text-sm">
                {amyIncome.length ? amyIncome.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between">
                    <span>{entry.subcategory || entry.category}</span>
                    <span>{asCurrency(asNumber(entry.amount))}</span>
                  </div>
                )) : <span className="text-muted-foreground">No income entries</span>}
              </div>
              <div className="mt-3 border-t pt-2 font-semibold">
                Total: {asCurrency(amyIncome.reduce((sum, entry) => sum + asNumber(entry.amount), 0))}
              </div>
            </div>
          </div>
          <div className="rounded border bg-muted/30 p-3 font-semibold">
            Combined Household Income: {asCurrency(combinedIncome)}
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
        <CardHeader><CardTitle>Entries</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[1024px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Owner</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Category</th><th className="py-2 pr-3">Subcategory</th><th className="py-2 pr-3">Description</th><th className="py-2 pr-3">Amount</th><th className="py-2 pr-3">Due Date</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">RSF</th><th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const status = statusForEntry(entry);
                return (
                  <tr key={entry.id} className="border-b align-top">
                    <td className="py-3 pr-3">{entry.month}</td>
                    <td className="py-3 pr-3 capitalize">{entry.owner}</td>
                    <td className="py-3 pr-3 capitalize">{entry.type}</td>
                    <td className="py-3 pr-3">{entry.category}</td>
                    <td className="py-3 pr-3">{entry.subcategory || "—"}</td>
                    <td className="py-3 pr-3">{entry.description || "—"}</td>
                    <td className="py-3 pr-3 font-medium">{asCurrency(asNumber(entry.amount))}</td>
                    <td className="py-3 pr-3">{entry.dueDate || "—"}</td>
                    <td className="py-3 pr-3"><Badge variant={status.variant}>{status.label}</Badge></td>
                    <td className="py-3 pr-3">{entry.rsfCategory ? <Badge variant="outline" className="border-blue-300 text-blue-700" title={entry.rsfCategory}>RSF</Badge> : "—"}</td>
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
              {!entries.length && (
                <tr><td className="py-6 text-center text-muted-foreground" colSpan={11}>No entries found for {monthLabel(selectedMonth)}.</td></tr>
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
            </div>
            <div className="space-y-2">
              {EXPENSE_CATEGORIES.map((category) => {
                const actual = actualByCategory.get(category) || 0;
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
              <Select value={entryForm.type} onValueChange={(value) => setEntryForm((current) => ({ ...current, type: value as FinanceType, category: value === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0], subcategory: "", customSubcategory: "" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="expense">Expense</SelectItem><SelectItem value="income">Income</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={entryForm.category} onValueChange={(value) => setEntryForm((current) => ({ ...current, category: value, subcategory: "", customSubcategory: "" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(entryForm.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
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
            <div className="space-y-2"><Label>Amount</Label><Input type="number" step="0.01" value={entryForm.amount} onChange={(event) => setEntryForm((current) => ({ ...current, amount: event.target.value }))} /></div>
            {entryForm.type === "expense" && <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={entryForm.dueDate} onChange={(event) => setEntryForm((current) => ({ ...current, dueDate: event.target.value }))} /></div>}
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
                          recurringFrequency: value as "monthly" | "weekly" | "every_x_days",
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
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
                </div>
              )}
            </div>
            <div className="md:col-span-2 space-y-3 rounded border p-3">
              <div className="flex items-center gap-2"><Checkbox id="is-rsf-related" checked={entryForm.isRsfRelated} onCheckedChange={(checked) => setEntryForm((current) => ({ ...current, isRsfRelated: Boolean(checked) }))} /><Label htmlFor="is-rsf-related">RSF related?</Label></div>
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
