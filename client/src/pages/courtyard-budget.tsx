import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Download, FileSpreadsheet, ReceiptText, Upload } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const C = {
  page: "min-h-screen bg-[#f5efe7] text-[#201814]",
  shell: "!border-[#ddccb5] !bg-[#fffaf2] !bg-none !text-[#201814] shadow-[0_18px_45px_rgba(74,54,34,0.10)]",
  muted: "!text-[#5f5247]",
  green: "!bg-[#2f5f46] !bg-none !text-white hover:!bg-[#274d39]",
  accent: "!bg-[#b98435] !bg-none !text-white hover:!bg-[#9f6f2b]",
  field: "!border-[#cdbda8] !bg-white !text-[#201814] placeholder:!text-[#76695d]",
  outline: "!border-[#cdbda8] !bg-white !bg-none !text-[#201814] hover:!bg-[#f8efe2]",
};

type BudgetUser = {
  id: string;
  canAccessBudget: boolean;
  canUpload: boolean;
  canEditForecast: boolean;
  departments: string[];
};

type BudgetExpense = {
  id: string;
  category: string;
  budgetAmount: string;
  forecastAmount: string;
  spentAmount: string;
  remainingAmount: string;
};

type CheckbookEntry = {
  id: string;
  entryDate: string;
  vendor: string;
  category: string;
  description?: string | null;
  amount: string;
};

type BudgetSummary = {
  propertyName: string;
  month: number;
  year: number;
  department: string;
  departments: string[];
  user: BudgetUser;
  revenue: { label: string; budgetAmount: string; actualAmount: string; forecastAmount: string };
  totals: { expenseBudget: string; expenseForecast: string; checkbookSpend: string; remainingBudget: string };
  expenses: BudgetExpense[];
  checkbook: CheckbookEntry[];
};

function money(value: unknown) {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Number.isFinite(numeric) ? numeric : 0);
}

function monthLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function dateKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function detectBudgetPeriodFromFilename(fileName: string) {
  const match = Array.from(fileName.matchAll(/(\d{2})(\d{2})(\d{4})/g)).find((item) => {
    const month = Number(item[1]);
    const day = Number(item[2]);
    const year = Number(item[3]);
    return month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= 2100;
  });
  if (match) return { month: Number(match[1]), year: Number(match[3]) };
  const monthName = fileName.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i)?.[1];
  const year = Number(fileName.match(/\b(20\d{2})\b/)?.[1]);
  return monthName && year ? { month: new Date(`${monthName} 1, ${year}`).getMonth() + 1, year } : null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(apiUrl(url), { credentials: "include" });
  if (response.status === 401) return { user: null } as T;
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "green" | "amber" }) {
  return (
    <div className={`rounded-lg border p-4 ${tone === "green" ? "border-[#bdd5c3] bg-[#e8f1ea]" : tone === "amber" ? "border-[#e0c28e] bg-[#fff3dd]" : "border-[#e0d3c1] bg-white"}`}>
      <div className="text-sm text-[#5f5247]">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[#201814]">{value}</div>
    </div>
  );
}

export default function CourtyardBudgetPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [department, setDepartment] = useState("");
  const [expensesOpen, setExpensesOpen] = useState(true);
  const [checkbookOpen, setCheckbookOpen] = useState(true);
  const [budgetFile, setBudgetFile] = useState<File | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [forecastRevenue, setForecastRevenue] = useState("");
  const [checkbookForm, setCheckbookForm] = useState({
    entryDate: dateKey(year, month),
    vendor: "",
    category: "",
    description: "",
    amount: "",
  });

  const me = useQuery<{ user: BudgetUser | null }>({
    queryKey: ["/api/courtyard/budget/me"],
    queryFn: () => fetchJson("/api/courtyard/budget/me"),
  });
  const summary = useQuery<BudgetSummary>({
    queryKey: ["/api/courtyard/budget/summary", month, year, department],
    queryFn: () => fetchJson(`/api/courtyard/budget/summary?month=${month}&year=${year}${department ? `&department=${encodeURIComponent(department)}` : ""}`),
    enabled: Boolean(me.data?.user?.canAccessBudget),
  });

  const data = summary.data;
  const activeDepartment = data?.department || department || me.data?.user?.departments?.[0] || "";
  const departments = useMemo(() => data?.departments?.length ? data.departments : me.data?.user?.departments || [], [data, me.data]);

  useEffect(() => {
    setCheckbookForm((current) => ({ ...current, entryDate: dateKey(year, month) }));
  }, [month, year]);

  useEffect(() => {
    if (data) setForecastRevenue(data.revenue.forecastAmount);
  }, [data?.revenue.forecastAmount]);

  const uploadBudget = useMutation({
    mutationFn: async () => {
      if (!budgetFile) throw new Error("Choose a budget file first.");
      const form = new FormData();
      form.append("budgetFile", budgetFile);
      form.append("month", String(month));
      form.append("year", String(year));
      form.append("confirmOverwrite", String(confirmOverwrite));
      const response = await fetch(apiUrl("/api/courtyard/budget/upload"), { method: "POST", credentials: "include", body: form });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (result) => {
      setMonth(Number(result.detectedPeriod?.month || month));
      setYear(Number(result.detectedPeriod?.year || year));
      setBudgetFile(null);
      setConfirmOverwrite(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Budget uploaded", description: `${result.rows || 0} budget lines imported.` });
      queryClient.invalidateQueries({ queryKey: ["/api/courtyard/budget/summary"] });
    },
    onError: (error: Error) => toast({ title: "Upload failed", description: error.message, variant: "destructive" }),
  });

  const saveForecast = useMutation({
    mutationFn: () => apiRequest("POST", "/api/courtyard/budget/forecast-adjustment", {
      department: activeDepartment,
      month,
      year,
      forecastRevenue: forecastRevenue || "0",
    }),
    onSuccess: () => {
      toast({ title: "Monthly forecast saved", description: "Expense limits were scaled to the revised revenue forecast." });
      queryClient.invalidateQueries({ queryKey: ["/api/courtyard/budget/summary"] });
    },
    onError: (error: Error) => toast({ title: "Unable to save forecast", description: error.message, variant: "destructive" }),
  });

  const addCheckbook = useMutation({
    mutationFn: () => apiRequest("POST", "/api/courtyard/budget/checkbook", {
      ...checkbookForm,
      department: activeDepartment,
      month,
      year,
    }),
    onSuccess: () => {
      toast({ title: "Order added to checkbook" });
      setCheckbookForm((current) => ({ ...current, vendor: "", description: "", amount: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/courtyard/budget/summary"] });
    },
    onError: (error: Error) => toast({ title: "Unable to add order", description: error.message, variant: "destructive" }),
  });

  if (me.isLoading) return <div className={`${C.page} p-8`}>Loading budget...</div>;
  if (!me.data?.user || !me.data.user.canAccessBudget) {
    return (
      <div className={`${C.page} flex items-center justify-center p-4`}>
        <Card className={`max-w-lg ${C.shell}`}>
          <CardHeader>
            <CardTitle>Budget Access Required</CardTitle>
            <CardDescription className={C.muted}>Sign in through the Courtyard portal with an authorized department-head account.</CardDescription>
          </CardHeader>
          <CardContent><Button asChild className={C.green}><a href="/courtyard">Back to Courtyard</a></Button></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={C.page}>
      <header className="border-b border-[#deceba] bg-[#fffaf2]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Austin Lakeline</div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Department Purchasing Budget</h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className={C.outline}><a href="/courtyard"><ArrowLeft className="mr-2 h-4 w-4" />Portal</a></Button>
            {data && <Button asChild variant="outline" className={C.outline}><a href={apiUrl(`/api/courtyard/budget/export.csv?month=${month}&year=${year}&department=${encodeURIComponent(activeDepartment)}`)}><Download className="mr-2 h-4 w-4" />CSV</a></Button>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <Card className={C.shell}>
          <CardContent className="grid gap-3 p-4 md:grid-cols-[170px_120px_1fr_auto] md:items-end">
            <div>
              <Label>Month</Label>
              <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
                <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: 12 }, (_, index) => <SelectItem key={index + 1} value={String(index + 1)}>{new Date(2026, index, 1).toLocaleDateString(undefined, { month: "long" })}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Year</Label><Input className={C.field} type="number" value={year} onChange={(event) => setYear(Number(event.target.value || now.getFullYear()))} /></div>
            <div>
              <Label>Department</Label>
              <Select value={activeDepartment} onValueChange={setDepartment}>
                <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
                <SelectContent>{departments.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="w-fit border-[#cdbda8] bg-white px-3 py-2 text-[#201814]">{monthLabel(month, year)}</Badge>
          </CardContent>
        </Card>

        {me.data.user.canUpload && (
          <Card className={C.shell}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-[#8a6b3f]" />Budget Source</CardTitle>
              <CardDescription className={C.muted}>Upload the monthly operator budget workbook. Only Rooms revenue, Bistro revenue, and the selected department expense categories are displayed.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
              <Input ref={fileInputRef} className={C.field} type="file" accept=".xlsx,.csv" onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setBudgetFile(file);
                const detected = file ? detectBudgetPeriodFromFilename(file.name) : null;
                if (detected) { setMonth(detected.month); setYear(detected.year); }
              }} />
              <label className="flex items-center gap-2 text-sm text-[#5f5247]"><input type="checkbox" checked={confirmOverwrite} onChange={(event) => setConfirmOverwrite(event.target.checked)} />Replace month</label>
              <Button className={C.green} disabled={!budgetFile || uploadBudget.isPending} onClick={() => uploadBudget.mutate()}><FileSpreadsheet className="mr-2 h-4 w-4" />Upload</Button>
            </CardContent>
          </Card>
        )}

        {summary.isLoading ? <Card className={C.shell}><CardContent className="p-6">Loading department budget...</CardContent></Card> : data ? (
          <>
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label={`Budgeted ${data.revenue.label}`} value={money(data.revenue.budgetAmount)} />
              <StatCard label={`Forecasted ${data.revenue.label}`} value={money(data.revenue.forecastAmount)} tone="green" />
              <StatCard label="Scaled expense allowance" value={money(data.totals.expenseForecast)} />
              <StatCard label="Remaining to spend" value={money(data.totals.remainingBudget)} tone={Number(data.totals.remainingBudget) >= 0 ? "green" : "amber"} />
            </section>

            {me.data.user.canEditForecast && (
              <Card className={C.shell}>
                <CardHeader>
                  <CardTitle>Monthly Revenue Forecast</CardTitle>
                  <CardDescription className={C.muted}>Enter the current full-month revenue forecast. Expense allowances scale by the same percentage versus budget.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div><Label>Forecasted {data.revenue.label}</Label><Input className={C.field} inputMode="decimal" value={forecastRevenue} onChange={(event) => setForecastRevenue(event.target.value.replace(/[^0-9.]/g, ""))} /></div>
                  <Button className={C.accent} disabled={!forecastRevenue || saveForecast.isPending} onClick={() => saveForecast.mutate()}>Save forecast</Button>
                </CardContent>
              </Card>
            )}

            <Card className={C.shell}>
              <button type="button" className="flex w-full items-center justify-between p-6 text-left" onClick={() => setExpensesOpen((open) => !open)} aria-expanded={expensesOpen}>
                <div>
                  <CardTitle>Expense Allowances</CardTitle>
                  <CardDescription className={C.muted}>Budget, forecast-scaled allowance, ordered amount, and remaining balance.</CardDescription>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform ${expensesOpen ? "rotate-180" : ""}`} />
              </button>
              {expensesOpen && (
                <CardContent className="overflow-x-auto p-0">
                  <table className="w-full min-w-[720px] border-collapse text-sm">
                    <thead><tr className="border-y border-[#e0d3c1] bg-[#fbf6ee] text-left text-[#5f5247]"><th className="p-3">Expense</th><th className="p-3 text-right">Budget</th><th className="p-3 text-right">Forecast allowance</th><th className="p-3 text-right">Ordered</th><th className="p-3 text-right">Remaining</th></tr></thead>
                    <tbody>
                      {data.expenses.map((line) => (
                        <tr key={line.id} className="border-b border-[#e0d3c1] odd:bg-white even:bg-[#fffaf2]">
                          <td className="p-3 font-medium">{line.category}</td>
                          <td className="p-3 text-right">{money(line.budgetAmount)}</td>
                          <td className="p-3 text-right">{money(line.forecastAmount)}</td>
                          <td className="p-3 text-right">{money(line.spentAmount)}</td>
                          <td className={`p-3 text-right font-semibold ${Number(line.remainingAmount) < 0 ? "text-red-700" : "text-[#21583f]"}`}>{money(line.remainingAmount)}</td>
                        </tr>
                      ))}
                      {!data.expenses.length && <tr><td colSpan={5} className="p-4 text-center text-[#5f5247]">No matching operating expense lines were found in this month’s uploaded budget.</td></tr>}
                    </tbody>
                  </table>
                </CardContent>
              )}
            </Card>

            <Card className={C.shell}>
              <button type="button" className="flex w-full items-center justify-between p-6 text-left" onClick={() => setCheckbookOpen((open) => !open)} aria-expanded={checkbookOpen}>
                <div>
                  <CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-[#8a6b3f]" />Monthly Checkbook</CardTitle>
                  <CardDescription className={C.muted}>{money(data.totals.checkbookSpend)} ordered this month.</CardDescription>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform ${checkbookOpen ? "rotate-180" : ""}`} />
              </button>
              {checkbookOpen && (
                <CardContent className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-[145px_1fr_210px_1fr_120px_auto] lg:items-end">
                    <div><Label>Order date</Label><Input className={C.field} type="date" value={checkbookForm.entryDate} onChange={(event) => setCheckbookForm({ ...checkbookForm, entryDate: event.target.value })} /></div>
                    <div><Label>Vendor</Label><Input className={C.field} value={checkbookForm.vendor} onChange={(event) => setCheckbookForm({ ...checkbookForm, vendor: event.target.value })} /></div>
                    <div>
                      <Label>Expense category</Label>
                      <Select value={checkbookForm.category} onValueChange={(category) => setCheckbookForm({ ...checkbookForm, category })}>
                        <SelectTrigger className={C.field}><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>{data.expenses.map((line) => <SelectItem key={line.id} value={line.category}>{line.category}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Order description</Label><Input className={C.field} value={checkbookForm.description} onChange={(event) => setCheckbookForm({ ...checkbookForm, description: event.target.value })} /></div>
                    <div><Label>Amount</Label><Input className={C.field} inputMode="decimal" value={checkbookForm.amount} onChange={(event) => setCheckbookForm({ ...checkbookForm, amount: event.target.value.replace(/[^0-9.]/g, "") })} /></div>
                    <Button className={C.green} disabled={!checkbookForm.vendor || !checkbookForm.category || !checkbookForm.amount || addCheckbook.isPending} onClick={() => addCheckbook.mutate()}>Add order</Button>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-[#e0d3c1] bg-white">
                    {data.checkbook.length ? data.checkbook.map((entry) => (
                      <div key={entry.id} className="grid gap-2 border-b border-[#e0d3c1] p-3 text-sm last:border-0 md:grid-cols-[110px_1fr_180px_1fr_120px]">
                        <div>{entry.entryDate}</div><div className="font-semibold">{entry.vendor}</div><div>{entry.category}</div><div>{entry.description || ""}</div><div className="text-right font-semibold">{money(entry.amount)}</div>
                      </div>
                    )) : <div className="p-3 text-sm text-[#5f5247]">No orders entered for this month.</div>}
                  </div>
                </CardContent>
              )}
            </Card>
          </>
        ) : <Card className={C.shell}><CardContent className="p-6">No budget source has been uploaded for this month.</CardContent></Card>}
      </main>
    </div>
  );
}
