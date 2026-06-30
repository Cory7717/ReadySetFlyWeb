import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calculator, Download, FileSpreadsheet, LockKeyhole, Printer, Trash2, Upload } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const C = {
  page: "min-h-screen bg-[#f3efe7] text-[#201814]",
  shell: "!border-[#d7c8b5] !bg-[#fffaf2] !bg-none !text-[#201814] shadow-[0_18px_45px_rgba(72,52,31,0.10)]",
  section: "!border-[#d7c8b5] !bg-white !bg-none !text-[#201814]",
  field: "!border-[#cdbda8] !bg-white !text-[#201814] placeholder:!text-[#7c6e61]",
  outline: "!border-[#cdbda8] !bg-white !bg-none !text-[#201814] hover:!bg-[#f8efe2]",
  green: "!bg-[#2f5f46] !bg-none !text-white hover:!bg-[#274d39]",
  accent: "!bg-[#b98435] !bg-none !text-white hover:!bg-[#9f6f2b]",
  muted: "!text-[#5f5247]",
};

type AccessResponse = {
  unlocked: boolean;
  user: null | { employeeDisplayName: string; email: string; isAdmin: boolean; isSuperAdmin: boolean };
};

type ComptrollerReport = {
  id: string;
  propertyId: string;
  reportMonth: string;
  payload: any;
  uploadedReports: Array<Record<string, any>>;
  settings: Record<string, any>;
  updatedAt: string;
};

function money(value: unknown) {
  const n = Number(value || 0);
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
}

function pct(value: unknown) {
  const n = Number(value || 0);
  return `${(Number.isFinite(n) ? n * 100 : 0).toFixed(2)}%`;
}

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(apiUrl(url), { credentials: "include" });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function MonthAccessGate({ onUnlocked }: { onUnlocked: () => void }) {
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const login = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/comptroller/pin-login", { pin });
      return response.json();
    },
    onSuccess: () => onUnlocked(),
    onError: (error: Error) => toast({ title: "Unable to unlock Comptroller", description: error.message, variant: "destructive" }),
  });
  return (
    <div className={C.page}>
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-8">
        <Card className={`w-full ${C.shell}`}>
          <CardHeader>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Austin Lakeline</div>
            <CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5" /> Comptroller Access</CardTitle>
            <CardDescription className={C.muted}>Enter the internal reports PIN or sign in through the Courtyard portal with Comptroller access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Reports PIN</Label>
              <Input className={C.field} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 5))} inputMode="numeric" />
            </div>
            <Button className={`w-full ${C.green}`} disabled={pin.length !== 5 || login.isPending} onClick={() => login.mutate()}>
              {login.isPending ? "Unlocking..." : "Unlock"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card className={C.section}>
      <CardContent className="p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a6b3f]">{label}</div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
        {note && <div className="mt-1 text-xs text-[#5f5247]">{note}</div>}
      </CardContent>
    </Card>
  );
}

export default function ComptrollerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reportMonth, setReportMonth] = useState(currentMonth());
  const [files, setFiles] = useState<Record<string, File | null>>({ taxPostings: null, taxExemptions: null, accountingInterface: null });
  const [includeMeetingRoomTaxInStateHOT, setIncludeMeetingRoomTaxInStateHOT] = useState(true);

  const access = useQuery<AccessResponse>({
    queryKey: ["/api/comptroller/access"],
    queryFn: () => fetchJson("/api/comptroller/access"),
  });
  const reportQuery = useQuery<{ report: ComptrollerReport | null }>({
    queryKey: ["/api/comptroller/report", reportMonth],
    queryFn: () => fetchJson(`/api/comptroller/report?propertyId=courtyard-austin-lakeline&reportMonth=${encodeURIComponent(reportMonth)}`),
    enabled: Boolean(access.data?.unlocked),
  });

  const uploadReports = async (overwrite = false): Promise<{ report?: ComptrollerReport } | undefined> => {
    const form = new FormData();
    form.set("propertyId", "courtyard-austin-lakeline");
    form.set("reportMonth", reportMonth);
    form.set("overwrite", String(overwrite));
    form.set("includeMeetingRoomTaxInStateHOT", String(includeMeetingRoomTaxInStateHOT));
    Object.entries(files).forEach(([key, file]) => {
      if (file) form.set(key, file);
    });
    const response = await fetch(apiUrl("/api/comptroller/process"), { method: "POST", credentials: "include", body: form });
    if (response.status === 409 && !overwrite) {
      const data = await response.json();
      if (window.confirm(`${data.error}\n\nReplace the existing ${reportMonth} report?`)) return uploadReports(true);
      return undefined;
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Unable to process Comptroller reports.");
    }
    return response.json();
  };

  const processReports = useMutation({
    mutationFn: () => uploadReports(false),
    onSuccess: (data) => {
      if (!data?.report) return;
      queryClient.invalidateQueries({ queryKey: ["/api/comptroller/report"] });
      setReportMonth(data.report.reportMonth);
      toast({ title: "Comptroller report processed", description: "Posted taxes were saved and compliance checks were refreshed." });
    },
    onError: (error: Error) => toast({ title: "Unable to process reports", description: error.message, variant: "destructive" }),
  });

  const deleteReport = useMutation({
    mutationFn: async () => {
      const report = reportQuery.data?.report;
      if (!report) return;
      await apiRequest("DELETE", `/api/comptroller/report/${report.propertyId}/${report.reportMonth}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comptroller/report"] });
      toast({ title: "Comptroller report removed" });
    },
    onError: (error: Error) => toast({ title: "Unable to remove report", description: error.message, variant: "destructive" }),
  });

  const report = reportQuery.data?.report;
  const payload = report?.payload || {};
  const summary = payload.summary || {};
  const posted = payload.posted || {};
  const expected = payload.expected || {};
  const warnings: string[] = Array.isArray(payload.warnings) ? payload.warnings : [];
  const detailTable: any[] = Array.isArray(payload.detailTable) ? payload.detailTable : [];
  const exemptionGroups: any[] = Array.isArray(payload.exemptionGroups) ? payload.exemptionGroups : [];
  const accounting = payload.accounting || {};
  const uploaded = Array.isArray(report?.uploadedReports) ? report?.uploadedReports : [];
  const canProcess = Boolean(files.taxPostings && files.taxExemptions && files.accountingInterface && reportMonth);

  const metricCards = useMemo(() => [
    { label: "Gross Taxable Room Revenue", value: money(summary.grossTaxableRoomRevenue), note: "Validation base from STAY item postings" },
    { label: "Total Exempt Room Revenue", value: money(summary.totalExemptRoomRevenue), note: "Removed according to exemption mapping" },
    { label: "Austin TPID Fee Due", value: money(summary.tourismPidFeeDue), note: `${pct(payload.settings?.tourismPIDRate)} taxable room-night sales` },
    { label: "Austin City HOT Due", value: money(summary.cityHotDue), note: "Posted city + venue project tax" },
    { label: "State HOT Due", value: money(summary.stateHotDue), note: "State HOT plus meeting-room tax display" },
    { label: "Meeting Room Tax", value: money(summary.meetingRoomTax), note: "Displayed separately for review" },
    { label: "Sales Tax Due", value: money(summary.salesTaxDue), note: "Kept separate from occupancy tax" },
    { label: "Total Tax Payment Due", value: money(summary.totalTaxPaymentDue), note: "Posted STAY payable source of truth" },
  ], [payload.settings?.tourismPIDRate, summary]);

  if (access.isLoading) return <div className={`${C.page} p-8`}>Loading Comptroller...</div>;
  if (!access.data?.unlocked) return <MonthAccessGate onUnlocked={() => access.refetch()} />;

  return (
    <div className={C.page}>
      <header className="border-b border-[#deceba] bg-[#fffaf2]/95 px-4 py-5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Courtyard Austin Northwest Lakeline</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Comptroller Hotel Tax Calculator</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#5f5247]">
              Uses STAY posted tax columns as the payable source of truth, then recalculates expected Texas, Austin, TPID, sales, and meeting-room tax for compliance review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {report && (
              <>
                <Button asChild variant="outline" className={C.outline}>
                  <a href={apiUrl(`/api/comptroller/report/${report.propertyId}/${report.reportMonth}/export.csv`)}>
                    <Download className="mr-2 h-4 w-4" /> Export CSV
                  </a>
                </Button>
                <Button variant="outline" className={C.outline} onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Card className={C.shell}>
          <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.1fr_1fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Report month</Label>
                <Input className={C.field} type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} />
              </div>
              <div>
                <Label>Property</Label>
                <Input className={C.field} value="Courtyard Austin Northwest Lakeline" readOnly />
              </div>
              {[
                ["taxPostings", "Tax Postings Dynamic"],
                ["taxExemptions", "Tax Exemptions Dynamic"],
                ["accountingInterface", "Accounting Interface / Error Report"],
              ].map(([key, label]) => (
                <div key={key} className="sm:col-span-2">
                  <Label>{label}</Label>
                  <Input className={C.field} type="file" accept=".xlsx" onChange={(event) => setFiles((current) => ({ ...current, [key]: event.target.files?.[0] || null }))} />
                </div>
              ))}
              <label className="flex items-start gap-3 rounded-lg border border-[#d7c8b5] bg-white p-3 text-sm">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={includeMeetingRoomTaxInStateHOT}
                  onChange={(event) => setIncludeMeetingRoomTaxInStateHOT(event.target.checked)}
                />
                <span>
                  <span className="font-semibold">Include meeting-room tax in State HOT payable total.</span>
                  <span className="block text-[#5f5247]">Meeting room tax remains displayed separately either way.</span>
                </span>
              </label>
            </div>
            <div className="rounded-xl border border-[#d7c8b5] bg-white p-4">
              <div className="flex items-center gap-2 text-lg font-semibold"><Calculator className="h-5 w-5 text-[#8a6b3f]" /> Compliance Checks</div>
              <ul className="mt-3 space-y-2 text-sm text-[#5f5247]">
                <li>Texas State Hotel Occupancy Tax: {pct(payload.settings?.stateHOTRate ?? 0.06)}</li>
                <li>Austin Hotel Occupancy Tax: {pct(payload.settings?.cityHOTRate ?? 0.11)} total local rate</li>
                <li>Austin Tourism PID Fee: {pct(payload.settings?.tourismPIDRate ?? 0.02)} taxable room-night sales</li>
                <li>TPID fee tax validation uses the effective STAY tax labels when posted.</li>
                <li>Exemptions are reviewed by type, certificate/id, and state/local treatment.</li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button className={C.green} disabled={!canProcess || processReports.isPending} onClick={() => processReports.mutate()}>
                  <Upload className="mr-2 h-4 w-4" /> {processReports.isPending ? "Processing..." : "Process Reports"}
                </Button>
                <Button variant="outline" className={C.outline} onClick={() => setFiles({ taxPostings: null, taxExemptions: null, accountingInterface: null })}>
                  Clear files
                </Button>
                {report && (
                  <Button variant="outline" className={C.outline} disabled={deleteReport.isPending} onClick={() => window.confirm(`Remove the ${report.reportMonth} Comptroller report?`) && deleteReport.mutate()}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete month
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {report ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">Monthly Tax Review: {report.reportMonth}</h2>
                <p className="text-sm text-[#5f5247]">Updated {new Date(report.updatedAt).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {uploaded.map((file, index) => (
                  <Badge key={`${file.originalFileName || index}`} variant="outline" className="border-[#cdbda8] bg-white text-[#201814]">
                    <FileSpreadsheet className="mr-1 h-3 w-3" /> {String(file.originalFileName || "Uploaded report")}
                  </Badge>
                ))}
              </div>
            </div>

            {warnings.length > 0 && (
              <Card className="border-amber-400 bg-[#fff7df] text-[#3f2a05] shadow-[0_12px_28px_rgba(72,52,31,0.10)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-[#3f2a05]"><AlertTriangle className="h-5 w-5 text-amber-700" /> Manual Review Flags</CardTitle>
                  <CardDescription className="text-[#5c420e]">These do not override STAY posted payable totals. They mark items that should be reviewed before payment.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-1 pl-5 text-sm font-medium text-[#4c3308]">
                    {warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metricCards.map((item) => <MetricCard key={item.label} {...item} />)}
            </div>

            <Card className={C.section}>
              <CardHeader>
                <CardTitle>Department Tax Summary</CardTitle>
                <CardDescription className={C.muted}>Final payable amounts come from posted STAY tax columns. Expected tax is a validation layer only.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[1120px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#d7c8b5] text-left text-xs uppercase tracking-[0.12em] text-[#6b5f54]">
                      <th className="py-2 pr-3">Tax Category</th>
                      <th className="px-3 py-2">Source Columns</th>
                      <th className="px-3 py-2">Rate Label</th>
                      <th className="px-3 py-2 text-right">Base</th>
                      <th className="px-3 py-2 text-right">Exempt</th>
                      <th className="px-3 py-2 text-right">Posted Due</th>
                      <th className="px-3 py-2 text-right">Expected</th>
                      <th className="px-3 py-2 text-right">Variance</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailTable.map((row) => (
                      <tr key={row.category} className="border-b border-[#eadfce] last:border-0">
                        <td className="py-3 pr-3 font-semibold">{row.category}</td>
                        <td className="px-3 py-3 text-xs text-[#5f5247]">{Array.isArray(row.sourceColumns) ? row.sourceColumns.join(", ") : ""}</td>
                        <td className="px-3 py-3">{row.rateLabel}</td>
                        <td className="px-3 py-3 text-right">{money(row.taxableBase)}</td>
                        <td className="px-3 py-3 text-right">{money(row.exemptBase)}</td>
                        <td className="px-3 py-3 text-right font-semibold">{money(row.postedDue)}</td>
                        <td className="px-3 py-3 text-right">{money(row.expectedDue)}</td>
                        <td className={`px-3 py-3 text-right ${Math.abs(Number(row.variance || 0)) > 1 ? "font-semibold text-amber-800" : ""}`}>{money(row.variance)}</td>
                        <td className="px-3 py-3 text-xs text-[#5f5247]">{row.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className={C.section}>
                <CardHeader>
                  <CardTitle>Exemption Audit</CardTitle>
                  <CardDescription className={C.muted}>Grouped by exemption ID, reason, category, and guest/group name.</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[440px] overflow-auto">
                  <table className="w-full min-w-[780px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[#d7c8b5] text-left text-xs uppercase tracking-[0.12em] text-[#6b5f54]">
                        <th className="py-2 pr-3">Exemption</th>
                        <th className="px-3 py-2">ID</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-right">City Exempt</th>
                        <th className="px-3 py-2 text-right">State Exempt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exemptionGroups.map((group) => (
                        <tr key={group.key} className="border-b border-[#eadfce] last:border-0">
                          <td className="py-3 pr-3">
                            <div className="font-semibold">{group.reason || group.category || "Exemption"}</div>
                            <div className="text-xs text-[#5f5247]">{group.name || group.subcategory}</div>
                          </td>
                          <td className="px-3 py-3">{group.exemptionId || <span className="text-amber-800">Missing</span>}</td>
                          <td className="px-3 py-3 text-right">{money(group.amount)}</td>
                          <td className="px-3 py-3 text-right">{money(group.cityTaxExempt)}</td>
                          <td className="px-3 py-3 text-right">{money(group.stateTaxExempt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card className={C.section}>
                <CardHeader>
                  <CardTitle>Accounting Tie-Out</CardTitle>
                  <CardDescription className={C.muted}>Reference totals from the accounting interface report for month-end review.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricCard label="Accounting Debits" value={money(accounting.totalDebit)} />
                    <MetricCard label="Accounting Credits" value={money(accounting.totalCredit)} />
                    <MetricCard label="Accounting Balance" value={money(accounting.balance)} />
                    <MetricCard label="Tax Postings Total" value={money(posted.allTaxColumnsTotal)} />
                  </div>
                  <div className="rounded-lg border border-[#d7c8b5] bg-[#fffaf2] p-3 text-sm">
                    <div className="font-semibold">Expected validation totals</div>
                    <div className="mt-2 grid gap-1 text-[#5f5247] sm:grid-cols-2">
                      <div>TPID: {money(expected.tourismPidFee)}</div>
                      <div>Austin HOT: {money(expected.cityTax)}</div>
                      <div>State HOT: {money(expected.stateTax)}</div>
                      <div>Meeting room: {money(expected.meetingRoomTax)}</div>
                      <div>Sales tax: {money(expected.salesTax)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <Card className={C.section}>
            <CardContent className="p-8 text-center">
              <div className="text-xl font-semibold">No Comptroller report saved for {reportMonth}.</div>
              <p className="mt-2 text-sm text-[#5f5247]">Upload the three STAY reports above to calculate posted payable tax and compliance warnings.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
