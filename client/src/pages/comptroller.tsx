import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calculator, Download, FileSpreadsheet, LockKeyhole, Printer, Save, Search, Trash2, Upload, X } from "lucide-react";
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

type ReportKey = "taxPostings" | "taxExemptions" | "accountingInterface";
type ReportEditorState = {
  key: ReportKey;
  title: string;
  rows: Array<Record<string, string>>;
  search: string;
  page: number;
} | null;

const REPORT_LABELS: Record<ReportKey, string> = {
  taxPostings: "Tax Postings Dynamic",
  taxExemptions: "Tax Exemptions Dynamic",
  accountingInterface: "Accounting Interface / Error Report",
};

function money(value: unknown) {
  const n = Number(value || 0);
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
}

function pct(value: unknown) {
  const n = Number(value || 0);
  return `${(Number.isFinite(n) ? n * 100 : 0).toFixed(2)}%`;
}

function displayCellValue(value: unknown) {
  const text = String(value ?? "");
  return text === "[object Object]" ? "" : text;
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

function reportColumns(rows: Array<Record<string, string>>) {
  const columns: string[] = [];
  rows.slice(0, 200).forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      if (!columns.includes(key)) columns.push(key);
    });
  });
  return columns;
}

function ReportEditorModal({
  editor,
  saving,
  onClose,
  onSearch,
  onPageChange,
  onCellChange,
  onSave,
}: {
  editor: ReportEditorState;
  saving: boolean;
  onClose: () => void;
  onSearch: (value: string) => void;
  onPageChange: (page: number) => void;
  onCellChange: (rowIndex: number, column: string, value: string) => void;
  onSave: () => void;
}) {
  if (!editor) return null;
  const columns = reportColumns(editor.rows);
  const query = editor.search.trim().toLowerCase();
  const pageSize = 100;
  const visibleRows = editor.rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !query || Object.values(row).join(" ").toLowerCase().includes(query));
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const safePage = Math.min(Math.max(editor.page, 1), totalPages);
  const pageRows = visibleRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="fixed inset-0 z-[1000] bg-[#f3efe7] text-[#201814]">
      <div className="flex h-full flex-col">
        <header className="border-b border-[#d7c8b5] bg-[#fffaf2] px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Editable STAY Report</div>
              <h2 className="text-2xl font-semibold">{editor.title}</h2>
              <p className="text-sm text-[#5f5247]">Edit source rows, then save to recalculate the tax payment totals from this report.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className={C.green} disabled={saving} onClick={onSave}>
                <Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save & recalculate"}
              </Button>
              <Button variant="outline" className={C.outline} onClick={onClose}>
                <X className="mr-2 h-4 w-4" /> Close
              </Button>
            </div>
          </div>
          <div className="relative mt-3 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#76695d]" />
            <Input className={`${C.field} pl-9`} value={editor.search} onChange={(event) => onSearch(event.target.value)} placeholder="Search report rows" />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[#5f5247]">
            <div>
              Showing {pageRows.length ? (safePage - 1) * pageSize + 1 : 0}-{Math.min(safePage * pageSize, visibleRows.length)} of {visibleRows.length} matching rows.
              <span className="ml-2">Full report rows retained: {editor.rows.length}.</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className={C.outline} disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
                Previous
              </Button>
              <span>Page {safePage} of {totalPages}</span>
              <Button variant="outline" size="sm" className={C.outline} disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>
                Next
              </Button>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4">
          <table className="min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-[#243746] text-white">
              <tr>
                <th className="border border-[#4a5360] px-2 py-2 text-left">#</th>
                {columns.map((column) => (
                  <th key={column} className="min-w-[160px] border border-[#4a5360] px-2 py-2 text-left">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map(({ row, index }) => (
                <tr key={index} className={index % 2 ? "bg-white" : "bg-[#fffaf2]"}>
                  <td className="border border-[#eadfce] px-2 py-1 text-[#5f5247]">{index + 1}</td>
                  {columns.map((column) => (
                    <td key={column} className="border border-[#eadfce] p-0">
                      <input
                        className="h-9 w-full bg-transparent px-2 text-[#201814] outline-none focus:bg-[#fff3d4] focus:ring-1 focus:ring-[#b98435]"
                        value={displayCellValue(row[column])}
                        onChange={(event) => onCellChange(index, column, event.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {visibleRows.length === 0 && <div className="rounded-lg border border-[#d7c8b5] bg-white p-6 text-center text-sm text-[#5f5247]">No rows match that search.</div>}
        </div>
      </div>
    </div>
  );
}

export default function ComptrollerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reportMonth, setReportMonth] = useState(currentMonth());
  const [files, setFiles] = useState<Record<string, File | null>>({ taxPostings: null, taxExemptions: null, accountingInterface: null });
  const [includeMeetingRoomTaxInStateHOT, setIncludeMeetingRoomTaxInStateHOT] = useState(true);
  const [editor, setEditor] = useState<ReportEditorState>(null);

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

  const saveReportEdits = useMutation({
    mutationFn: async ({ reportKey, rows }: { reportKey: ReportKey; rows: Array<Record<string, string>> }) => {
      const report = reportQuery.data?.report;
      if (!report) throw new Error("No report is loaded.");
      const response = await apiRequest("PATCH", `/api/comptroller/report/${report.propertyId}/${report.reportMonth}/edits`, {
        reportKey,
        rows,
        includeMeetingRoomTaxInStateHOT,
      });
      return response.json();
    },
    onSuccess: (data: { report?: ComptrollerReport }) => {
      if (data.report) {
        queryClient.setQueryData(["/api/comptroller/report", data.report.reportMonth], { report: data.report });
        queryClient.invalidateQueries({ queryKey: ["/api/comptroller/report"] });
      }
      setEditor(null);
      toast({ title: "Report edits saved", description: "Tax payment amounts were recalculated from the edited report rows." });
    },
    onError: (error: Error) => toast({ title: "Unable to save report edits", description: error.message, variant: "destructive" }),
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
  const explanations: any[] = Array.isArray(payload.explanations) ? payload.explanations : [];
  const canProcess = Boolean(files.taxPostings && files.taxExemptions && files.accountingInterface && reportMonth);
  const openReportEditor = (key: ReportKey) => {
    const rows = Array.isArray(payload?.drilldown?.[key]) ? payload.drilldown[key] : [];
    setEditor({ key, title: REPORT_LABELS[key], rows: rows.map((row: Record<string, string>) => ({ ...row })), search: "", page: 1 });
  };

  const metricCards = useMemo(() => [
    { label: "Gross Taxable Room Revenue", value: money(summary.grossTaxableRoomRevenue), note: "Validation base from STAY item postings" },
    { label: "Total Exempt Room Revenue", value: money(summary.totalExemptRoomRevenue), note: "Removed according to exemption mapping" },
    { label: "Austin TPID Fee Due", value: money(summary.tourismPidFeeDue), note: `${pct(payload.settings?.tourismPIDRate)} taxable room-night sales` },
    { label: "Austin City HOT Due", value: money(summary.cityHotDue), note: "Posted city + venue project tax" },
    { label: "State HOT Due", value: money(summary.stateHotDue), note: "State HOT plus meeting-room tax display" },
    { label: "Meeting Room Tax", value: money(summary.meetingRoomTax), note: "Displayed separately for review" },
    { label: "Sales Tax Due", value: money(summary.salesTaxDue), note: "Kept separate from occupancy tax" },
    { label: "Hotel / TPID Payable", value: money(summary.hotelOccupancyAndTpidDue ?? (Number(summary.totalTaxPaymentDue || 0) - Number(summary.salesTaxDue || 0))), note: "Occupancy tax, TPID, and meeting-room tax subtotal" },
    { label: "Grand Posted Tax / Fee Total", value: money(summary.grandPostedTaxAndFeeTotal ?? summary.totalTaxPaymentDue), note: "Includes separated sales tax for reconciliation" },
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

            <Card className={C.section}>
              <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="font-semibold">Open and edit source reports</div>
                  <div className="text-sm text-[#5f5247]">Edits are saved into this Comptroller month and recalculate the payment totals without re-uploading the files.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(REPORT_LABELS) as ReportKey[]).map((key) => (
                    <Button key={key} variant="outline" className={C.outline} onClick={() => openReportEditor(key)}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" /> {REPORT_LABELS[key]}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {warnings.length > 0 && (
              <div className="rounded-xl border border-amber-400 bg-[#fff7df] p-6 text-[#3f2a05] shadow-[0_12px_28px_rgba(72,52,31,0.10)]">
                <div className="flex items-center gap-2 text-lg font-semibold text-[#3f2a05]">
                  <AlertTriangle className="h-5 w-5 text-amber-700" />
                  Manual Review Flags
                </div>
                <p className="mt-2 text-sm font-medium text-[#5c420e]">
                  These do not override STAY posted payable totals. They mark items that should be reviewed before payment.
                </p>
                <ul className="mt-5 list-disc space-y-2 pl-5 text-sm font-semibold leading-6 text-[#4c3308]">
                  {warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </div>
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
                      <tr key={row.taxCategory} className="border-b border-[#eadfce] last:border-0">
                        <td className="py-3 pr-3 font-semibold">{row.taxCategory}</td>
                        <td className="px-3 py-3 text-xs text-[#5f5247]">{row.sourceColumns}</td>
                        <td className="px-3 py-3">{row.taxRateLabel}</td>
                        <td className="px-3 py-3 text-right">{row.taxableBaseAmount == null ? "-" : money(row.taxableBaseAmount)}</td>
                        <td className="px-3 py-3 text-right">{row.exemptAmount == null ? "-" : money(row.exemptAmount)}</td>
                        <td className="px-3 py-3 text-right font-semibold">{money(row.calculatedPostedTaxDue ?? row.postedDue)}</td>
                        <td className="px-3 py-3 text-right">{money(row.expectedDue)}</td>
                        <td className={`px-3 py-3 text-right ${Math.abs(Number((row.adjustmentAmount ?? row.variance) || 0)) > 1 ? "font-semibold text-amber-800" : ""}`}>{money(row.adjustmentAmount ?? row.variance)}</td>
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
                    <MetricCard label="Tax Postings Total" value={money(payload.postedAllTaxColumnsTotal)} />
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

            {explanations.length > 0 && (
              <Card className={C.section}>
                <CardHeader>
                  <CardTitle>Posting Explanations</CardTitle>
                  <CardDescription className={C.muted}>Common reasons STAY rows come across as negative amounts, credits, adjustments, or transfers.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {explanations.slice(0, 12).map((item, index) => (
                    <div key={`${item.accountName}-${item.item}-${index}`} className="rounded-lg border border-[#d7c8b5] bg-[#fffaf2] p-3 text-sm">
                      <div className="font-semibold">{item.accountName || "Account"} - {item.item || "Posting"} {item.amount != null ? `(${money(item.amount)})` : ""}</div>
                      <div className="mt-1 text-[#5f5247]">{item.explanation}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
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
      <ReportEditorModal
        editor={editor}
        saving={saveReportEdits.isPending}
        onClose={() => setEditor(null)}
        onSearch={(search) => setEditor((current) => current ? { ...current, search, page: 1 } : current)}
        onPageChange={(page) => setEditor((current) => current ? { ...current, page } : current)}
        onCellChange={(rowIndex, column, value) => setEditor((current) => {
          if (!current) return current;
          const rows = current.rows.map((row, index) => index === rowIndex ? { ...row, [column]: value } : row);
          return { ...current, rows };
        })}
        onSave={() => {
          if (!editor) return;
          saveReportEdits.mutate({ reportKey: editor.key, rows: editor.rows });
        }}
      />
    </div>
  );
}
