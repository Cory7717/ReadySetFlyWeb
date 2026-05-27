import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, FileSpreadsheet, Printer, ReceiptText, Upload } from "lucide-react";
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
  email: string;
  employeeDisplayName: string;
  canAccessBudget: boolean;
  canUpload: boolean;
  canEditForecast: boolean;
  departments: string[];
  allDepartments: boolean;
};

type BudgetLine = {
  id: string;
  lineItem: string;
  coa?: string | null;
  categoryType: string;
  actualAmount: string;
  originalBudgetAmount: string;
  updatedForecastAmount: string;
  isTotal: boolean;
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
  totals: Record<string, string>;
  operationalSections?: Array<{ section: string; totals: Record<string, string>; lines: BudgetLine[] }>;
  lines: BudgetLine[];
  checkbook: CheckbookEntry[];
};

function money(value: unknown) {
  const n = Number(value || 0);
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Number.isFinite(n) ? n : 0);
}

function monthLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function detectBudgetPeriodFromFilename(fileName: string) {
  const matches = Array.from(fileName.matchAll(/(\d{2})(\d{2})(\d{4})/g));
  for (const match of matches) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= 2100) return { month, year };
  }
  const monthName = fileName.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i)?.[1];
  const year = Number(fileName.match(/\b(20\d{2})\b/)?.[1]);
  if (monthName && year >= 2020 && year <= 2100) return { month: new Date(`${monthName} 1, ${year}`).getMonth() + 1, year };
  return null;
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
  const [budgetFile, setBudgetFile] = useState<File | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [checkbookForm, setCheckbookForm] = useState({ entryDate: `${year}-${String(month).padStart(2, "0")}-01`, vendor: "", category: "", description: "", amount: "" });
  const [forecastForm, setForecastForm] = useState({ mode: "percent", scope: "revenue", amount: "" });

  const me = useQuery<{ user: BudgetUser | null }>({ queryKey: ["/api/courtyard/budget/me"], queryFn: () => fetchJson("/api/courtyard/budget/me") });
  const summary = useQuery<BudgetSummary>({
    queryKey: ["/api/courtyard/budget/summary", month, year, department, showDetails],
    queryFn: () => fetchJson(`/api/courtyard/budget/summary?month=${month}&year=${year}${department ? `&department=${encodeURIComponent(department)}` : ""}${showDetails ? "&detail=1" : ""}`),
    enabled: Boolean(me.data?.user?.canAccessBudget),
  });

  const activeDepartment = summary.data?.department || department || me.data?.user?.departments?.[0] || "";
  const departments = useMemo(() => summary.data?.departments?.length ? summary.data.departments : me.data?.user?.departments || [], [summary.data, me.data]);

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
    onSuccess: (data) => {
      if (data.detectedPeriod?.month && data.detectedPeriod?.year) {
        setMonth(Number(data.detectedPeriod.month));
        setYear(Number(data.detectedPeriod.year));
      }
      toast({ title: "Budget uploaded", description: `${monthLabel(data.detectedPeriod?.month || month, data.detectedPeriod?.year || year)}: ${data.rows || 0} line item(s) imported.` });
      setBudgetFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setConfirmOverwrite(false);
      queryClient.invalidateQueries({ queryKey: ["/api/courtyard/budget/summary"] });
    },
    onError: (error: Error) => toast({ title: "Upload failed", description: error.message, variant: "destructive" }),
  });

  const addCheckbook = useMutation({
    mutationFn: () => apiRequest("POST", "/api/courtyard/budget/checkbook", { ...checkbookForm, department: activeDepartment, month, year }),
    onSuccess: () => {
      toast({ title: "Checkbook entry added" });
      setCheckbookForm({ ...checkbookForm, vendor: "", category: "", description: "", amount: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/courtyard/budget/summary"] });
    },
    onError: (error: Error) => toast({ title: "Unable to add spend", description: error.message, variant: "destructive" }),
  });

  const adjustForecast = useMutation({
    mutationFn: () => apiRequest("POST", "/api/courtyard/budget/forecast-adjustment", { ...forecastForm, department: activeDepartment, month, year, amount: forecastForm.amount || "0" }),
    onSuccess: () => {
      toast({ title: "Forecast updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/courtyard/budget/summary"] });
    },
    onError: (error: Error) => toast({ title: "Unable to adjust forecast", description: error.message, variant: "destructive" }),
  });

  if (me.isLoading) return <div className={`${C.page} p-8`}>Loading budget dashboard...</div>;
  if (me.isError) {
    return (
      <div className={`${C.page} flex items-center justify-center p-4`}>
        <Card className={`max-w-lg ${C.shell}`}>
          <CardHeader>
            <CardTitle>Budget Could Not Load</CardTitle>
            <CardDescription className={C.muted}>{me.error instanceof Error ? me.error.message : "The budget access check failed."}</CardDescription>
          </CardHeader>
          <CardContent><Button asChild className={C.green}><a href="/courtyard">Back to Courtyard</a></Button></CardContent>
        </Card>
      </div>
    );
  }
  if (!me.data?.user) {
    return (
      <div className={`${C.page} flex items-center justify-center p-4`}>
        <Card className={`max-w-lg ${C.shell}`}>
          <CardHeader>
            <CardTitle>Courtyard Login Required</CardTitle>
            <CardDescription className={C.muted}>Sign in through the Courtyard portal, then open Budget from the portal card.</CardDescription>
          </CardHeader>
          <CardContent><Button asChild className={C.green}><a href="/courtyard">Go to Courtyard Login</a></Button></CardContent>
        </Card>
      </div>
    );
  }
  if (!me.data.user.canAccessBudget) {
    return (
      <div className={`${C.page} flex items-center justify-center p-4`}>
        <Card className={`max-w-lg ${C.shell}`}>
          <CardHeader>
            <CardTitle>Budget Access Required</CardTitle>
            <CardDescription className={C.muted}>Budget dashboards are limited to designated department heads and GM/admin users.</CardDescription>
          </CardHeader>
          <CardContent><Button asChild className={C.green}><a href="/courtyard">Back to Courtyard</a></Button></CardContent>
        </Card>
      </div>
    );
  }

  const data = summary.data;
  const totals = data?.totals || {};

  return (
    <div className={C.page}>
      <header className="border-b border-[#deceba] bg-[#fffaf2]/95 px-4 py-4 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Austin Lakeline</div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Courtyard Budget Dashboard</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className={C.outline}><a href="/courtyard"><ArrowLeft className="mr-2 h-4 w-4" />Portal</a></Button>
            <Button variant="outline" className={C.outline} onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
            {data && <Button asChild variant="outline" className={C.outline}><a href={apiUrl(`/api/courtyard/budget/export.csv?month=${month}&year=${year}&department=${encodeURIComponent(activeDepartment)}`)}><Download className="mr-2 h-4 w-4" />CSV</a></Button>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <Card className={C.shell}>
          <CardContent className="grid gap-3 p-4 md:grid-cols-[160px_120px_1fr_auto] md:items-end">
            <div>
              <Label>Month</Label>
              <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
                <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: 12 }, (_, index) => <SelectItem key={index + 1} value={String(index + 1)}>{new Date(2026, index, 1).toLocaleDateString(undefined, { month: "long" })}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Year</Label>
              <Input className={C.field} type="number" value={year} onChange={(event) => setYear(Number(event.target.value || now.getFullYear()))} />
            </div>
            <div>
              <Label>Department</Label>
              <Select value={activeDepartment || "none"} onValueChange={(value) => setDepartment(value === "none" ? "" : value)}>
                <SelectTrigger className={C.field}><SelectValue /></SelectTrigger>
                <SelectContent>{departments.length ? departments.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>) : <SelectItem value="none">No departments uploaded</SelectItem>}</SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="w-fit border-[#cdbda8] bg-white px-3 py-2 text-[#201814]">{monthLabel(month, year)}</Badge>
          </CardContent>
        </Card>

        {me.data.user.canUpload && (
          <Card className={C.shell}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-[#8a6b3f]" /> Upload Budget Workbook</CardTitle>
              <CardDescription className={C.muted}>Accepts the monthly operator statement workbook or a normalized CSV export.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
              <Input
                ref={fileInputRef}
                className={C.field}
                type="file"
                accept=".xlsx,.csv"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setBudgetFile(file);
                  const detected = file ? detectBudgetPeriodFromFilename(file.name) : null;
                  if (detected) {
                    setMonth(detected.month);
                    setYear(detected.year);
                    toast({ title: "Budget period detected", description: `${monthLabel(detected.month, detected.year)} from ${file?.name}` });
                  }
                }}
              />
              <label className="flex items-center gap-2 text-sm text-[#5f5247]"><input type="checkbox" checked={confirmOverwrite} onChange={(event) => setConfirmOverwrite(event.target.checked)} /> Replace existing month</label>
              <Button className={C.green} disabled={!budgetFile || uploadBudget.isPending} onClick={() => uploadBudget.mutate()}><FileSpreadsheet className="mr-2 h-4 w-4" />{uploadBudget.isPending ? "Uploading..." : "Upload"}</Button>
            </CardContent>
          </Card>
        )}

        {summary.isLoading ? <Card className={C.shell}><CardContent className="p-6">Loading budget...</CardContent></Card> : !data ? (
          <Card className={C.shell}><CardContent className="p-6">No budget uploaded for this month yet.</CardContent></Card>
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
              <StatCard label="Original Revenue" value={money(totals.originalRevenue)} />
              <StatCard label="Forecast Revenue" value={money(totals.updatedRevenue)} tone="green" />
              <StatCard label="Actual Revenue" value={money(totals.actualRevenue)} />
              <StatCard label="Expense Budget" value={money(totals.expenseBudget)} />
              <StatCard label="Checkbook Spend" value={money(totals.checkbookSpend)} tone="amber" />
              <StatCard label="Remaining Budget" value={money(totals.remainingBudget)} tone={Number(totals.remainingBudget || 0) >= 0 ? "green" : "amber"} />
              <StatCard label="Variance" value={money(totals.variance)} />
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              {(data.operationalSections || []).map((section) => (
                <Card key={section.section} className={C.shell}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle>{section.section}</CardTitle>
                        <CardDescription className={C.muted}>
                          Operational lines only: revenue, core labor, direct cost, and supplies.
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="w-fit border-[#bdd5c3] bg-[#e8f1ea] text-[#173c25]">
                        Forecast {money(section.totals.forecast)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-y border-[#e0d3c1] bg-[#fbf6ee] text-left text-[#5f5247]">
                          <th className="p-3">Line</th>
                          <th className="p-3 text-right">Budget</th>
                          <th className="p-3 text-right">Actual</th>
                          <th className="p-3 text-right">Forecast</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.lines.map((line) => (
                          <tr key={line.id} className={`${line.isTotal ? "bg-[#efe3d1] font-semibold" : "odd:bg-white even:bg-[#fffaf2]"} border-b border-[#e0d3c1]`}>
                            <td className="p-3">{line.lineItem}</td>
                            <td className="p-3 text-right">{money(line.originalBudgetAmount)}</td>
                            <td className="p-3 text-right">{money(line.actualAmount)}</td>
                            <td className="p-3 text-right">{money(line.updatedForecastAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              ))}
            </section>

            {me.data.user.canEditForecast && (
              <Card className={C.shell}>
                <CardHeader>
                  <CardTitle>Forecast Adjustment</CardTitle>
                  <CardDescription className={C.muted}>Revenue changes flex variable expenses. Semi-variable expenses flex at 50%; fixed expenses stay unchanged unless manually adjusted later.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-[160px_180px_1fr_auto] md:items-end">
                  <Select value={forecastForm.mode} onValueChange={(mode) => setForecastForm({ ...forecastForm, mode })}><SelectTrigger className={C.field}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percent">Percent</SelectItem><SelectItem value="dollar">Dollar</SelectItem><SelectItem value="reset">Reset</SelectItem></SelectContent></Select>
                  <Select value={forecastForm.scope} onValueChange={(scope) => setForecastForm({ ...forecastForm, scope })}><SelectTrigger className={C.field}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="revenue">Revenue only</SelectItem><SelectItem value="expenses">Expenses only</SelectItem><SelectItem value="department">Entire department</SelectItem></SelectContent></Select>
                  <Input className={C.field} placeholder={forecastForm.mode === "percent" ? "-15" : "Amount"} value={forecastForm.amount} onChange={(event) => setForecastForm({ ...forecastForm, amount: event.target.value.replace(/[^0-9.-]/g, "") })} />
                  <Button className={C.accent} disabled={adjustForecast.isPending} onClick={() => adjustForecast.mutate()}>{adjustForecast.isPending ? "Applying..." : "Apply"}</Button>
                </CardContent>
              </Card>
            )}

            <Card className={C.shell}>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>{activeDepartment} Budget</CardTitle>
                    <CardDescription className={C.muted}>
                      Default view shows only operational budget lines. Sensitive salary, GM/DOS, owner, franchise, and non-operating lines are hidden for department heads.
                    </CardDescription>
                  </div>
                  {me.data.user.allDepartments && (
                    <Button variant="outline" className={C.outline} onClick={() => setShowDetails((value) => !value)}>
                      {showDetails ? "Show operational only" : "Show full statement detail"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[980px] border-collapse text-sm">
                  <thead><tr className="bg-[#2a211c] text-left text-white"><th className="p-3">Line Item</th><th className="p-3">COA</th><th className="p-3">Type</th><th className="p-3 text-right">Original</th><th className="p-3 text-right">Actual</th><th className="p-3 text-right">Forecast</th><th className="p-3 text-right">Remaining</th><th className="p-3 text-right">Variance</th></tr></thead>
                  <tbody>
                    {data.lines.map((line) => {
                      const remaining = Number(line.updatedForecastAmount) - Number(line.actualAmount);
                      const variance = Number(line.updatedForecastAmount) - Number(line.originalBudgetAmount);
                      return (
                        <tr key={line.id} className={`${line.isTotal ? "bg-[#efe3d1] font-semibold" : "odd:bg-white even:bg-[#fbf6ee]"} border-b border-[#e0d3c1]`}>
                          <td className="p-3">{line.lineItem}</td><td className="p-3">{line.coa || ""}</td><td className="p-3 capitalize">{line.categoryType}</td><td className="p-3 text-right">{money(line.originalBudgetAmount)}</td><td className="p-3 text-right">{money(line.actualAmount)}</td><td className="p-3 text-right">{money(line.updatedForecastAmount)}</td><td className={`p-3 text-right ${remaining < 0 ? "text-red-700" : "text-[#21583f]"}`}>{money(remaining)}</td><td className={`p-3 text-right ${variance < 0 ? "text-red-700" : "text-[#21583f]"}`}>{money(variance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className={C.shell}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-[#8a6b3f]" /> Department Checkbook</CardTitle>
                <CardDescription className={C.muted}>Track purchases that reduce the monthly available expense budget.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-[150px_1fr_150px_1fr_120px_auto] lg:items-end">
                  <div><Label>Date</Label><Input className={C.field} type="date" value={checkbookForm.entryDate} onChange={(event) => setCheckbookForm({ ...checkbookForm, entryDate: event.target.value })} /></div>
                  <div><Label>Vendor</Label><Input className={C.field} value={checkbookForm.vendor} onChange={(event) => setCheckbookForm({ ...checkbookForm, vendor: event.target.value })} /></div>
                  <div><Label>Category</Label><Input className={C.field} value={checkbookForm.category} onChange={(event) => setCheckbookForm({ ...checkbookForm, category: event.target.value })} /></div>
                  <div><Label>Description</Label><Input className={C.field} value={checkbookForm.description} onChange={(event) => setCheckbookForm({ ...checkbookForm, description: event.target.value })} /></div>
                  <div><Label>Amount</Label><Input className={C.field} inputMode="decimal" value={checkbookForm.amount} onChange={(event) => setCheckbookForm({ ...checkbookForm, amount: event.target.value.replace(/[^0-9.]/g, "") })} /></div>
                  <Button className={C.green} disabled={!checkbookForm.vendor || !checkbookForm.category || !checkbookForm.amount || addCheckbook.isPending} onClick={() => addCheckbook.mutate()}>Add</Button>
                </div>
                <div className="rounded-lg border border-[#e0d3c1] bg-white">
                  {data.checkbook.length ? data.checkbook.map((entry) => <div key={entry.id} className="grid gap-2 border-b border-[#e0d3c1] p-3 text-sm last:border-0 md:grid-cols-[120px_1fr_140px_1fr_120px]"><div>{entry.entryDate}</div><div className="font-semibold">{entry.vendor}</div><div>{entry.category}</div><div>{entry.description}</div><div className="text-right font-semibold">{money(entry.amount)}</div></div>) : <div className="p-3 text-sm text-[#5f5247]">No checkbook spending entered yet.</div>}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
