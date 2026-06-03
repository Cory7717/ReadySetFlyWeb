import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, LockKeyhole, LogOut, Upload } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const C = {
  page: "min-h-screen bg-[#f3efe7] text-[#201814]",
  shell: "!border-[#d7c8b5] !bg-[#fffaf2] !bg-none !text-[#201814] shadow-[0_18px_45px_rgba(72,52,31,0.10)]",
  darkShell: "!border-[#4a5360] !bg-[#202833] !bg-none !text-white shadow-[0_18px_45px_rgba(31,24,18,0.18)]",
  section: "!border-[#d7c8b5] !bg-white !text-[#201814]",
  header: "bg-[#243746] text-white",
  subheader: "bg-[#d9e6d7] text-[#173c25]",
  field: "!border-[#cdbda8] !bg-white !text-[#201814] placeholder:!text-[#7c6e61]",
  darkField: "!border-[#d7c8b5] !bg-white !text-[#201814] placeholder:!text-[#7c6e61]",
  outline: "!border-[#cdbda8] !bg-white !bg-none !text-[#201814] hover:!bg-[#f8efe2]",
  green: "!bg-[#2f5f46] !bg-none !text-white hover:!bg-[#274d39]",
  darkButton: "!border-[#4a5360] !bg-[#202833] !bg-none !text-white hover:!bg-[#141b24]",
  muted: "!text-[#5f5247]",
  darkMuted: "!text-[#e7dccd]",
  label: "!text-[#5b4b3b]",
  darkLabel: "!text-[#f0d9b0]",
};

type OpsAccess = { unlocked: boolean; user: { employeeDisplayName: string; email: string; isAdmin: boolean } | null; hasPin?: boolean; passwordChangeRequired?: boolean };
type Row = Record<string, string>;
type LaborHoursResponse = { weekStart: string; scheduleId?: string | null; departments: Record<string, number> };
type OpsImportResponse = {
  originalFileName: string;
  reportType: "otb_weekly" | "otb_month" | "gss_summary" | "gss_responses";
  weekly?: { weekStart: string; weekEnd: string; roomsSold: number; occupancy: number; arrivals: number; departures: number; adr: number; roomRevenue: number };
  monthly?: { monthStart: string; monthEnd: string; rooms: number; occupancy: number; adr: number; revenue: number; arrivals: number; departures: number };
  gssRows?: Row[];
  gssWaveRows?: Row[];
  positiveReviews?: Row[];
  negativeReviews?: Row[];
};
type OpsImportBatchResponse = { reports: OpsImportResponse[] };
type OpsDraftResponse = {
  draft: null | {
    id: string;
    weekStart: string;
    weekEnd: string;
    weekLabel: string;
    payload: Record<string, any>;
    uploadedReports: Array<Record<string, any>>;
    updatedAt: string;
  };
};

const emptyRows = (count: number, keys: string[]) =>
  Array.from({ length: count }, (_, index) => keys.reduce<Row>((row, key) => ({ ...row, [key]: key === "no" ? String(index + 1) : "" }), {}));

function money(value: string | number) {
  const n = num(value);
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
}

function pct(value: string | number) {
  const n = Number(value || 0);
  return `${((Number.isFinite(n) ? n : 0) * 100).toFixed(1)}%`;
}

function percentDisplay(value: string | number | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const n = num(raw);
  if (!Number.isFinite(n)) return raw;
  const percent = Math.abs(n) <= 1 ? n * 100 : n;
  return `${percent.toFixed(2).replace(/\.?0+$/, "")}%`;
}

function num(value: string | number) {
  const n = Number(String(value || "").replace(/[$,%(),]/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function accounting(value: string | number) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const n = num(raw);
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
}

function isMoneyColumn(key: string, label: string) {
  const text = `${key} ${label}`.toLowerCase();
  return text.includes("amount") || text.includes("revenue") || text.includes("adr") || text.includes("balance");
}

function isPercentColumn(key: string, label: string) {
  const text = `${key} ${label}`.toLowerCase();
  return text.includes("occupancy") || text.includes("%");
}

function isLongTextColumn(key: string, label: string) {
  const text = `${key} ${label}`.toLowerCase();
  return [
    "comment",
    "comments",
    "notes",
    "strategy",
    "action",
    "support",
    "direction",
    "resolution",
    "incident",
    "reason",
    "discussion",
  ].some((word) => text.includes(word));
}

function fmtHours(value: string | number) {
  const n = num(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

function mergeLaborHours(rows: Row[], departments: Record<string, number>, field: "scheduledHours" | "actualHours") {
  const known = new Set(rows.map((row) => String(row.department || "").trim()));
  const updated = rows.map((row) => {
    const department = String(row.department || "").trim();
    if (!(department in departments)) return row;
    return { ...row, [field]: fmtHours(departments[department]) };
  });
  for (const [department, hours] of Object.entries(departments)) {
    if (!known.has(department)) updated.push({ department, scheduledHours: "", actualHours: "", budget: "", comments: "", [field]: fmtHours(hours) });
  }
  return updated;
}

function rowValue(value: string | number | undefined, digits = 2) {
  if (value == null || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(digits).replace(/\.?0+$/, "");
}

function addDaysIso(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthKeyFromDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabelFromKey(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function LabeledInput({ label, value, onChange, type = "text", moneyFormat = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; moneyFormat?: boolean }) {
  return (
    <div>
      <Label className={`text-xs font-semibold uppercase tracking-[0.12em] ${C.label}`}>{label}</Label>
      <Input className={`mt-1 ${C.field}`} type={type} value={value} onChange={(event) => onChange(event.target.value)} onBlur={() => moneyFormat && onChange(accounting(value))} />
    </div>
  );
}

function DarkLabeledInput({ label, value, onChange, type = "text", moneyFormat = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; moneyFormat?: boolean }) {
  return (
    <div>
      <Label className={`text-xs font-semibold uppercase tracking-[0.12em] ${C.darkLabel}`}>{label}</Label>
      <Input className={`mt-1 ${C.darkField}`} type={type} value={value} onChange={(event) => onChange(event.target.value)} onBlur={() => moneyFormat && onChange(accounting(value))} />
    </div>
  );
}

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <Card className={C.section}>
      <CardHeader className="border-b border-[#d7c8b5] bg-[#fffaf2] py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold text-[#201814]">{title}</CardTitle>
          {right}
        </div>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

function BulletRowsEditor({ rows, onChange }: { rows: Row[]; onChange: (rows: Row[]) => void }) {
  const normalizedRows = rows.length ? rows : [{ no: "1", bullet: "" }];
  const updateBullet = (index: number, bullet: string) => {
    onChange(normalizedRows.map((row, rowIndex) => rowIndex === index ? { ...row, no: String(rowIndex + 1), bullet } : { ...row, no: String(rowIndex + 1) }));
  };
  const addRow = () => onChange([...normalizedRows, { no: String(normalizedRows.length + 1), bullet: "" }]);
  const removeRow = (index: number) => {
    const next = normalizedRows.filter((_row, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, no: String(rowIndex + 1) }));
    onChange(next.length ? next : [{ no: "1", bullet: "" }]);
  };
  return (
    <div className="space-y-3 p-4">
      {normalizedRows.map((row, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[3rem_1fr_auto] sm:items-start">
          <div className="rounded-md border border-[#d7c8b5] bg-[#fffaf2] px-3 py-2 text-center text-sm font-semibold text-[#5b4b3b]">{index + 1}</div>
          <Textarea
            className={`${C.field} min-h-[70px] resize-y`}
            value={row.bullet || ""}
            onChange={(event) => updateBullet(index, event.target.value)}
            placeholder="Add a concise weekly overview bullet..."
          />
          <Button variant="outline" className={C.outline} onClick={() => removeRow(index)} disabled={normalizedRows.length === 1 && !(row.bullet || "").trim()}>
            Remove
          </Button>
        </div>
      ))}
      <Button className={C.green} onClick={addRow}>+ Add overview bullet</Button>
    </div>
  );
}

function EditableTable({ columns, rows, onChange }: { columns: Array<{ key: string; label: string; wide?: boolean }>; rows: Row[]; onChange: (rows: Row[]) => void }) {
  const [preview, setPreview] = useState<{ label: string; text: string; x: number; y: number } | null>(null);
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className={C.header}>
            {columns.map((column) => (
              <th key={column.key} className={`border border-[#c9d2d8] px-2 py-2 text-left ${column.wide ? "min-w-[260px]" : "min-w-[110px]"}`}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="odd:bg-white even:bg-[#fbf6ee]">
              {columns.map((column) => (
                <td key={column.key} className="border border-[#e0d3c1] p-1 align-top">
                  <Input
                    className="h-9 border-transparent bg-transparent px-2 text-sm font-medium text-[#201814] placeholder:text-[#7c6e61] focus:border-[#b98435] focus:bg-white"
                    value={row[column.key] || ""}
                    onMouseEnter={(event) => {
                      const text = String(row[column.key] || "").trim();
                      if (!isLongTextColumn(column.key, column.label) || !text) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      setPreview({ label: column.label, text, x: Math.min(rect.left, window.innerWidth - 460), y: rect.bottom + 8 });
                    }}
                    onMouseLeave={() => setPreview(null)}
                    onFocus={(event) => {
                      const text = String(row[column.key] || "").trim();
                      if (!isLongTextColumn(column.key, column.label) || !text) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      setPreview({ label: column.label, text, x: Math.min(rect.left, window.innerWidth - 460), y: rect.bottom + 8 });
                    }}
                    onBlur={() => {
                      setPreview(null);
                      if (!isMoneyColumn(column.key, column.label) && !isPercentColumn(column.key, column.label)) return;
                      const next = rows.map((item, index) => {
                        if (index !== rowIndex) return item;
                        return { ...item, [column.key]: isMoneyColumn(column.key, column.label) ? accounting(item[column.key] || "") : percentDisplay(item[column.key] || "") };
                      });
                      onChange(next);
                    }}
                    onChange={(event) => {
                      const next = rows.map((item, index) => index === rowIndex ? { ...item, [column.key]: event.target.value } : item);
                      onChange(next);
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {preview && (
        <div
          className="pointer-events-none fixed z-[100] max-w-[440px] rounded-lg border border-[#cdbda8] bg-[#201814] px-3 py-2 text-xs font-medium leading-relaxed text-white shadow-2xl"
          style={{ left: preview.x, top: preview.y }}
        >
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f0d9b0]">{preview.label}</div>
          <div className="max-h-56 overflow-y-auto whitespace-pre-wrap">{preview.text}</div>
        </div>
      )}
    </div>
  );
}

export default function OpsReportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const [week, setWeek] = useState("Week 1");
  const [setup, setSetup] = useState({ propertyName: "Please enter Hotel name", generalManager: "Please enter General Manager name", totalRooms: "50", monthlyRoomNights: "1550" });
  const [topMetrics, setTopMetrics] = useState({ weekStart: "2026-01-03", occupancy: "0", roomsSold: "200", roomRevenue: "20000", mtdThisYear: "80000", mtdLastYear: "100000", ytdThisYear: "150000", ytdLastYear: "200000" });
  const [monthRows, setMonthRows] = useState<Row[]>([
    { label: "MONTH TO DATE", occupancy: "0.60", rooms: "400", adr: "169", revenue: "80000", comments: "" },
    { label: "FUTURE BOOKED", occupancy: "0.05", rooms: "100", adr: "15", revenue: "12000", comments: "" },
    { label: "MONTHLY TOTAL", occupancy: "0.32", rooms: "500", adr: "184", revenue: "92000", comments: "" },
    { label: "CURRENT MONTH BUDGET", occupancy: "0.45", rooms: "700", adr: "200", revenue: "120000", comments: "" },
    { label: "VARIANCE", occupancy: "-0.13", rooms: "-200", adr: "-16", revenue: "-28000", comments: "" },
    { label: "LY SAME MONTH", occupancy: "0.50", rooms: "750", adr: "220", revenue: "135000", comments: "" },
  ]);
  const [nextMonthRows, setNextMonthRows] = useState<Row[]>([
    { label: "FUTURE BOOKED FOR NEXT MONTH", occupancy: "0.30", rooms: "500", adr: "150", revenue: "75000", comments: "" },
    { label: "NEXT MONTH BUDGET", occupancy: "0.20", rooms: "400", adr: "125", revenue: "50000", comments: "" },
    { label: "VARIANCE", occupancy: "0.10", rooms: "100", adr: "25", revenue: "25000", comments: "" },
  ]);
  const [chargebacks, setChargebacks] = useState<Row[]>(emptyRows(5, ["no", "reason", "respondDate", "amount", "comment"]));
  const [maintenance, setMaintenance] = useState<Row[]>(emptyRows(5, ["no", "rooms", "area", "hours", "comment"]));
  const [oooRooms, setOooRooms] = useState<Row[]>(emptyRows(5, ["no", "room", "startDate", "returnDate", "comment"]));
  const [adjustments, setAdjustments] = useState<Row[]>(emptyRows(5, ["no", "room", "guest", "amount", "comment"]));
  const [ar, setAr] = useState({ current: "90", d30: "150", d60: "220", d90: "1240", comments: "" });
  const [ledger, setLedger] = useState({ balance: "", over1000: "", comment: "" });
  const [labor, setLabor] = useState<Row[]>([
    { department: "FRONT DESK / NIGHT AUDIT HOURS", scheduledHours: "", actualHours: "", budget: "168", comments: "112 FD + 56 Night Audit" },
    { department: "HOUSEKEEPING HOURS", scheduledHours: "", actualHours: "", budget: "45", comments: "" },
    { department: "BREAKFAST / BISTRO HOURS", scheduledHours: "", actualHours: "", budget: "41", comments: "" },
    { department: "MAINTENANCE HOURS", scheduledHours: "", actualHours: "", budget: "56", comments: "" },
    { department: "OTHER", scheduledHours: "", actualHours: "", budget: "5", comments: "" },
  ]);
  const [laborFile, setLaborFile] = useState<File | null>(null);
  const [opsReportFiles, setOpsReportFiles] = useState<File[]>([]);
  const [uploadedReports, setUploadedReports] = useState<Array<Record<string, any>>>([]);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [monthlyBudgets, setMonthlyBudgets] = useState<Row[]>([]);
  const [budgetForm, setBudgetForm] = useState({
    month: monthKeyFromDate(new Date().toISOString().slice(0, 10)),
    rooms: "",
    occupancy: "",
    adr: "",
    revenue: "",
    actualRooms: "",
    actualOccupancy: "",
    actualAdr: "",
    actualRevenue: "",
    lyRooms: "",
    lyOccupancy: "",
    lyAdr: "",
    lyRevenue: "",
  });
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const [staffing, setStaffing] = useState({ openPositions: "", status: "", overtimeLastWeek: "", overtimeExpected: "", comment: "" });
  const [cases, setCases] = useState<Row[]>(emptyRows(5, ["no", "guest", "incidentType", "resolution", "comment"]));
  const [gmOverviewRows, setGmOverviewRows] = useState<Row[]>(emptyRows(6, ["no", "bullet"]));
  const [gssRows, setGssRows] = useState<Row[]>(["ITR", "Elite Appreciation", "Cleanliness", "Staff Service", "Maintenance", "Food & Beverage", "Internet"].map((label) => ({ label, hotel: "", brand: "", variance: "", priorWeek: "", weekVariance: "", sply: "", comments: "" })));
  const [gssWaveRows, setGssWaveRows] = useState<Row[]>(["ITR", "Elite Appreciation", "Cleanliness", "Staff Service", "Maintenance", "Food & Beverage", "Internet"].map((label) => ({ label, hotel: "", brand: "", variance: "", sply: "", comments: "" })));
  const [reputationRows, setReputationRows] = useState<Row[]>(["GOOGLE", "BOOKING.COM", "EXPEDIA", "TRIPADVISOR", "YELP"].map((label) => ({ label, reviews: "", score: "", outOf: "", goal: "", variance: "", strategy: "" })));
  const [positiveReviews, setPositiveReviews] = useState<Row[]>(emptyRows(5, ["source", "score", "comment"]));
  const [negativeReviews, setNegativeReviews] = useState<Row[]>(emptyRows(5, ["source", "score", "comment"]));
  const [followUp, setFollowUp] = useState<Row[]>(emptyRows(5, ["point", "direction", "owner", "dueDate", "status", "notes"]));
  const [priorities, setPriorities] = useState<Row[]>([
    { priority: "High", action: "", owner: "", dueDate: "", status: "Not Started", support: "" },
    { priority: "Medium", action: "", owner: "", dueDate: "", status: "Not Started", support: "" },
    { priority: "Low", action: "", owner: "", dueDate: "", status: "Not Started", support: "" },
  ]);

  const access = useQuery<OpsAccess>({
    queryKey: ["/api/opsreport/access"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/opsreport/access"), { credentials: "include" });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });
  const draft = useQuery<OpsDraftResponse>({
    queryKey: ["/api/opsreport/draft"],
    enabled: Boolean(access.data?.unlocked),
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/opsreport/draft"), { credentials: "include" });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });
  const previousWeekStart = useMemo(() => addDaysIso(topMetrics.weekStart, -7), [topMetrics.weekStart]);
  const previousDraft = useQuery<OpsDraftResponse>({
    queryKey: ["/api/opsreport/draft", previousWeekStart],
    enabled: Boolean(access.data?.unlocked && draftHydrated && previousWeekStart),
    queryFn: async () => {
      const response = await fetch(apiUrl(`/api/opsreport/draft?weekStart=${encodeURIComponent(previousWeekStart)}`), { credentials: "include" });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });
  const unlock = useMutation({
    mutationFn: () => apiRequest("POST", "/api/opsreport/pin-login", { pin }),
    onSuccess: () => {
      setPin("");
      queryClient.invalidateQueries({ queryKey: ["/api/opsreport/access"] });
    },
    onError: (error: Error) => toast({ title: "Unable to unlock Ops Report", description: error.message, variant: "destructive" }),
  });
  const lock = useMutation({
    mutationFn: () => apiRequest("POST", "/api/opsreport/logout"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/opsreport/access"] }),
  });
  const scheduledLabor = useQuery<LaborHoursResponse>({
    queryKey: ["/api/opsreport/labor/scheduled", topMetrics.weekStart],
    enabled: Boolean(access.data?.unlocked && /^\d{4}-\d{2}-\d{2}$/.test(topMetrics.weekStart)),
    queryFn: async () => {
      const response = await fetch(apiUrl(`/api/opsreport/labor/scheduled?weekStart=${encodeURIComponent(topMetrics.weekStart)}`), { credentials: "include" });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });
  const actualLaborUpload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("laborSummary", file);
      const response = await fetch(apiUrl("/api/opsreport/labor/actual-upload"), { method: "POST", credentials: "include", body: form });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<{
        originalFileName: string;
        departments: Record<string, number>;
        unmatchedEmployees?: Array<{ name: string; employeeNumber: string; hours: number }>;
      }>;
    },
    onSuccess: (data) => {
      setLabor((rows) => mergeLaborHours(rows, data.departments, "actualHours"));
      setLaborFile(null);
      const unmatched = data.unmatchedEmployees?.length || 0;
      toast({
        title: "Actual labor hours imported",
        description: unmatched
          ? `${data.originalFileName} was parsed. ${unmatched} unmatched associate${unmatched === 1 ? "" : "s"} mapped to Other.`
          : `${data.originalFileName} was parsed into the Staff Hours table.`,
      });
    },
    onError: (error: Error) => toast({ title: "Unable to parse labor summary", description: error.message, variant: "destructive" }),
  });
  const opsReportUpload = useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      files.forEach((file) => form.append("opsReport", file));
      form.append("weekStart", topMetrics.weekStart);
      form.append("weekEnd", weekEnd);
      const response = await fetch(apiUrl("/api/opsreport/import"), { method: "POST", credentials: "include", body: form });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<OpsImportBatchResponse>;
    },
    onSuccess: (data) => {
      for (const report of data.reports) {
      if (report.weekly) {
        setTopMetrics((current) => ({
          ...current,
          weekStart: report.weekly!.weekStart || current.weekStart,
          occupancy: percentDisplay(report.weekly!.occupancy),
          roomsSold: rowValue(report.weekly!.roomsSold, 0),
          roomRevenue: accounting(report.weekly!.roomRevenue),
        }));
      }
      if (report.monthly) {
        const monthly = report.monthly;
        setMonthRows((rows) => rows.map((row) => {
          if (row.label === "MONTH TO DATE" || row.label === "MONTHLY TOTAL") {
            return {
              ...row,
              occupancy: percentDisplay(monthly.occupancy),
              rooms: rowValue(monthly.rooms, 0),
              adr: accounting(monthly.adr),
              revenue: accounting(monthly.revenue),
              comments: `Imported ${monthly.monthStart} to ${monthly.monthEnd}`,
            };
          }
          return row;
        }));
        setTopMetrics((current) => ({ ...current, mtdThisYear: accounting(monthly.revenue) }));
      }
      if (report.gssRows?.length) {
        setGssRows((rows) => rows.map((row) => report.gssRows!.find((incoming) => incoming.label === row.label) || row));
      }
      if (report.gssWaveRows?.length) {
        setGssWaveRows((rows) => rows.map((row) => report.gssWaveRows!.find((incoming) => incoming.label === row.label) || row));
      }
      if (report.positiveReviews?.length) {
        setPositiveReviews([...report.positiveReviews, ...emptyRows(Math.max(0, 5 - report.positiveReviews.length), ["source", "score", "comment"])].slice(0, 5));
      }
      if (report.negativeReviews?.length) {
        setNegativeReviews([...report.negativeReviews, ...emptyRows(Math.max(0, 5 - report.negativeReviews.length), ["source", "score", "comment"])].slice(0, 5));
      }
      }
      setUploadedReports((current) => [
        ...current,
        ...data.reports.map((report) => ({ originalFileName: report.originalFileName, reportType: report.reportType, importedAt: new Date().toISOString() })),
      ]);
      setOpsReportFiles([]);
      toast({ title: "Ops reports imported", description: `${data.reports.length} report${data.reports.length === 1 ? "" : "s"} mapped into the worksheet.` });
    },
    onError: (error: Error) => toast({ title: "Unable to import report", description: error.message, variant: "destructive" }),
  });
  const saveDraft = useMutation({
    mutationFn: async (payload: Record<string, any>) => apiRequest("POST", "/api/opsreport/draft", payload),
    onSuccess: () => setLastSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })),
    onError: (error: Error) => toast({ title: "Unable to save ops report draft", description: error.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (!scheduledLabor.data?.departments) return;
    setLabor((rows) => mergeLaborHours(rows, scheduledLabor.data.departments, "scheduledHours"));
  }, [scheduledLabor.data]);

  const adr = useMemo(() => num(topMetrics.roomsSold) ? num(topMetrics.roomRevenue) / num(topMetrics.roomsSold) : 0, [topMetrics]);
  const scheduledLaborTotal = useMemo(() => labor.reduce((sum, row) => sum + num(row.scheduledHours), 0), [labor]);
  const actualLaborTotal = useMemo(() => labor.reduce((sum, row) => sum + num(row.actualHours), 0), [labor]);
  const laborTotal = actualLaborTotal || scheduledLaborTotal;
  const laborBudget = useMemo(() => labor.reduce((sum, row) => sum + num(row.budget), 0), [labor]);
  const laborVariance = actualLaborTotal ? actualLaborTotal - scheduledLaborTotal : laborTotal - laborBudget;
  const laborRows = useMemo(() => labor.map((row) => ({
    ...row,
    variance: num(row.actualHours) || num(row.scheduledHours) ? fmtHours(num(row.actualHours) - num(row.scheduledHours)) : "",
  })), [labor]);
  const adjustmentTotal = useMemo(() => adjustments.reduce((sum, row) => sum + num(row.amount), 0), [adjustments]);
  const arTotal = num(ar.current) + num(ar.d30) + num(ar.d60) + num(ar.d90);
  const previousGssRows = (previousDraft.data?.draft?.payload?.gssRows || []) as Row[];
  const gssRowsWithPrevious = useMemo(() => gssRows.map((row) => {
    const prior = previousGssRows.find((item) => item.label === row.label);
    const priorScore = prior?.hotel || "";
    const currentScore = row.hotel || "";
    const weekVariance = priorScore && currentScore ? rowValue(num(currentScore) - num(priorScore), 1) : "";
    return { ...row, priorWeek: priorScore, weekVariance };
  }), [gssRows, previousGssRows]);
  const previousGssWaveRows = (previousDraft.data?.draft?.payload?.gssWaveRows || []) as Row[];
  const gssWaveRowsWithPrevious = useMemo(() => gssWaveRows.map((row) => {
    const prior = previousGssWaveRows.find((item) => item.label === row.label);
    const priorScore = prior?.hotel || "";
    const currentScore = row.hotel || "";
    const weekVariance = priorScore && currentScore ? rowValue(num(currentScore) - num(priorScore), 1) : "";
    return { ...row, priorWeek: priorScore, weekVariance };
  }), [gssWaveRows, previousGssWaveRows]);
  const currentMonthKey = useMemo(() => monthKeyFromDate(topMetrics.weekStart), [topMetrics.weekStart]);
  const weekEnd = useMemo(() => {
    const start = new Date(`${topMetrics.weekStart}T00:00:00`);
    if (Number.isNaN(start.getTime())) return "";
    start.setDate(start.getDate() + 6);
    return start.toISOString().slice(0, 10);
  }, [topMetrics.weekStart]);
  const saveMonthlyBudget = () => {
    const normalized = {
      month: budgetForm.month,
      rooms: rowValue(budgetForm.rooms, 0),
      occupancy: percentDisplay(budgetForm.occupancy),
      adr: accounting(budgetForm.adr),
      revenue: accounting(budgetForm.revenue),
      actualRooms: rowValue(budgetForm.actualRooms, 0),
      actualOccupancy: percentDisplay(budgetForm.actualOccupancy),
      actualAdr: accounting(budgetForm.actualAdr),
      actualRevenue: accounting(budgetForm.actualRevenue),
      lyRooms: rowValue(budgetForm.lyRooms, 0),
      lyOccupancy: percentDisplay(budgetForm.lyOccupancy),
      lyAdr: accounting(budgetForm.lyAdr),
      lyRevenue: accounting(budgetForm.lyRevenue),
    };
    setMonthlyBudgets((rows) => [...rows.filter((row) => row.month !== normalized.month), normalized]);
    setBudgetModalOpen(false);
    toast({ title: "Monthly budget saved", description: `${monthLabelFromKey(normalized.month)} budget will populate matching weekly reports.` });
  };
  const budgetFormFromRow = (month: string, existing?: Row) => ({
    month,
    rooms: existing?.rooms || "",
    occupancy: existing?.occupancy || "",
    adr: existing?.adr || "",
    revenue: existing?.revenue || "",
    actualRooms: existing?.actualRooms || "",
    actualOccupancy: existing?.actualOccupancy || "",
    actualAdr: existing?.actualAdr || "",
    actualRevenue: existing?.actualRevenue || "",
    lyRooms: existing?.lyRooms || "",
    lyOccupancy: existing?.lyOccupancy || "",
    lyAdr: existing?.lyAdr || "",
    lyRevenue: existing?.lyRevenue || "",
  });
  const resetWeeklyWorksheet = (weekStart: string, weekLabel: string) => {
    setWeek(weekLabel);
    setTopMetrics({ weekStart, occupancy: "", roomsSold: "", roomRevenue: "", mtdThisYear: "", mtdLastYear: "", ytdThisYear: "", ytdLastYear: "" });
    setMonthRows([
      { label: "MONTH TO DATE", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
      { label: "FUTURE BOOKED", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
      { label: "MONTHLY TOTAL", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
      { label: "CURRENT MONTH BUDGET", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
      { label: "VARIANCE", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
      { label: "LY SAME MONTH", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    ]);
    setNextMonthRows([
      { label: "FUTURE BOOKED FOR NEXT MONTH", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
      { label: "NEXT MONTH BUDGET", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
      { label: "VARIANCE", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    ]);
    setChargebacks(emptyRows(5, ["no", "reason", "respondDate", "amount", "comment"]));
    setMaintenance(emptyRows(5, ["no", "rooms", "area", "hours", "comment"]));
    setOooRooms(emptyRows(5, ["no", "room", "startDate", "returnDate", "comment"]));
    setAdjustments(emptyRows(5, ["no", "room", "guest", "amount", "comment"]));
    setAr({ current: "", d30: "", d60: "", d90: "", comments: "" });
    setLedger({ balance: "", over1000: "", comment: "" });
    setLabor([
      { department: "FRONT DESK / NIGHT AUDIT HOURS", scheduledHours: "", actualHours: "", budget: "168", comments: "112 FD + 56 Night Audit" },
      { department: "HOUSEKEEPING HOURS", scheduledHours: "", actualHours: "", budget: "45", comments: "" },
      { department: "BREAKFAST / BISTRO HOURS", scheduledHours: "", actualHours: "", budget: "41", comments: "" },
      { department: "MAINTENANCE HOURS", scheduledHours: "", actualHours: "", budget: "56", comments: "" },
      { department: "OTHER", scheduledHours: "", actualHours: "", budget: "5", comments: "" },
    ]);
    setStaffing({ openPositions: "", status: "", overtimeLastWeek: "", overtimeExpected: "", comment: "" });
    setCases(emptyRows(5, ["no", "guest", "incidentType", "resolution", "comment"]));
    setGmOverviewRows(emptyRows(6, ["no", "bullet"]));
    setGssRows(["ITR", "Elite Appreciation", "Cleanliness", "Staff Service", "Maintenance", "Food & Beverage", "Internet"].map((label) => ({ label, hotel: "", brand: "", variance: "", priorWeek: "", weekVariance: "", sply: "", comments: "" })));
    setGssWaveRows(["ITR", "Elite Appreciation", "Cleanliness", "Staff Service", "Maintenance", "Food & Beverage", "Internet"].map((label) => ({ label, hotel: "", brand: "", variance: "", priorWeek: "", weekVariance: "", sply: "", comments: "" })));
    setReputationRows(["GOOGLE", "BOOKING.COM", "EXPEDIA", "TRIPADVISOR", "YELP"].map((label) => ({ label, reviews: "", score: "", outOf: "", goal: "", variance: "", strategy: "" })));
    setPositiveReviews(emptyRows(5, ["source", "score", "comment"]));
    setNegativeReviews(emptyRows(5, ["source", "score", "comment"]));
    setFollowUp(emptyRows(5, ["point", "direction", "owner", "dueDate", "status", "notes"]));
    setPriorities([
      { priority: "High", action: "", owner: "", dueDate: "", status: "Not Started", support: "" },
      { priority: "Medium", action: "", owner: "", dueDate: "", status: "Not Started", support: "" },
      { priority: "Low", action: "", owner: "", dueDate: "", status: "Not Started", support: "" },
    ]);
    setUploadedReports([]);
  };
  const hydrateOpsDraft = (loaded: OpsDraftResponse["draft"]) => {
    if (!loaded?.payload) return false;
    const payload = loaded.payload;
    setWeek(loaded.weekLabel || "Week 1");
    if (payload.setup) setSetup(payload.setup);
    if (payload.topMetrics) setTopMetrics(payload.topMetrics);
    if (payload.monthRows) setMonthRows(payload.monthRows);
    if (payload.nextMonthRows) setNextMonthRows(payload.nextMonthRows);
    if (payload.chargebacks) setChargebacks(payload.chargebacks);
    if (payload.maintenance) setMaintenance(payload.maintenance);
    if (payload.oooRooms) setOooRooms(payload.oooRooms);
    if (payload.adjustments) setAdjustments(payload.adjustments);
    if (payload.ar) setAr(payload.ar);
    if (payload.ledger) setLedger(payload.ledger);
    if (payload.labor) setLabor(payload.labor);
    if (payload.monthlyBudgets) setMonthlyBudgets(payload.monthlyBudgets);
    if (payload.staffing) setStaffing(payload.staffing);
    if (payload.cases) setCases(payload.cases);
    if (Array.isArray(payload.gmOverviewRows)) setGmOverviewRows(payload.gmOverviewRows);
    else if (typeof payload.gmOverview === "string") setGmOverviewRows(payload.gmOverview.split(/\n+/).filter(Boolean).slice(0, 6).map((bullet: string, index: number) => ({ no: String(index + 1), bullet: bullet.replace(/^[-*•\s]+/, "") })));
    if (payload.gssRows) setGssRows(payload.gssRows);
    if (payload.gssWaveRows) setGssWaveRows(payload.gssWaveRows);
    if (payload.reputationRows) setReputationRows(payload.reputationRows);
    if (payload.positiveReviews) setPositiveReviews(payload.positiveReviews);
    if (payload.negativeReviews) setNegativeReviews(payload.negativeReviews);
    if (payload.followUp) setFollowUp(payload.followUp);
    if (payload.priorities) setPriorities(payload.priorities);
    setUploadedReports(loaded.uploadedReports || []);
    return true;
  };
  const loadOpsWeek = async (weekStart: string, weekLabel: string) => {
    const response = await fetch(apiUrl(`/api/opsreport/draft?weekStart=${encodeURIComponent(weekStart)}`), { credentials: "include" });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json() as OpsDraftResponse;
    if (!hydrateOpsDraft(data.draft)) resetWeeklyWorksheet(weekStart, weekLabel);
  };
  const handleWeekLabelChange = (nextWeek: string) => {
    const currentNumber = Number((week.match(/\d+/) || [])[0] || 0);
    const nextNumber = Number((nextWeek.match(/\d+/) || [])[0] || 0);
    const nextStart = currentNumber && nextNumber ? addDaysIso(topMetrics.weekStart, (nextNumber - currentNumber) * 7) : topMetrics.weekStart;
    loadOpsWeek(nextStart || topMetrics.weekStart, nextWeek).catch((error) => toast({ title: "Unable to load week", description: error.message, variant: "destructive" }));
  };
  const currentDraftPayload = useMemo(() => ({
    setup,
    topMetrics,
    monthRows,
    nextMonthRows,
    chargebacks,
    maintenance,
    oooRooms,
    adjustments,
    ar,
    ledger,
    labor,
    monthlyBudgets,
    staffing,
    cases,
    gmOverviewRows,
    gssRows,
    gssWaveRows,
    reputationRows,
    positiveReviews,
    negativeReviews,
    followUp,
    priorities,
  }), [setup, topMetrics, monthRows, nextMonthRows, chargebacks, maintenance, oooRooms, adjustments, ar, ledger, labor, monthlyBudgets, staffing, cases, gmOverviewRows, gssRows, gssWaveRows, reputationRows, positiveReviews, negativeReviews, followUp, priorities]);

  useEffect(() => {
    if (!access.data?.unlocked || draft.isLoading || draftHydrated) return;
    const loaded = draft.data?.draft;
    hydrateOpsDraft(loaded || null);
    setDraftHydrated(true);
  }, [access.data?.unlocked, draft.data, draft.isLoading, draftHydrated]);

  useEffect(() => {
    if (!access.data?.unlocked || !draftHydrated || !weekEnd) return;
    const timeout = window.setTimeout(() => {
      saveDraft.mutate({
        weekStart: topMetrics.weekStart,
        weekEnd,
        weekLabel: week,
        payload: currentDraftPayload,
        uploadedReports,
      });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [access.data?.unlocked, draftHydrated, weekEnd, week, topMetrics.weekStart, currentDraftPayload, uploadedReports]);

  useEffect(() => {
    const budget = monthlyBudgets.find((row) => row.month === currentMonthKey);
    if (!budget) return;
    setMonthRows((rows) => rows.map((row) => {
      if (row.label !== "CURRENT MONTH BUDGET" && row.label !== "MONTHLY TOTAL" && row.label !== "LY SAME MONTH") return row;
      const next = row.label === "CURRENT MONTH BUDGET"
        ? { ...row, occupancy: budget.occupancy || "", rooms: budget.rooms || "", adr: budget.adr || "", revenue: budget.revenue || "", comments: `Budget for ${monthLabelFromKey(currentMonthKey)}` }
        : row.label === "MONTHLY TOTAL" && (budget.actualRooms || budget.actualOccupancy || budget.actualAdr || budget.actualRevenue)
          ? { ...row, occupancy: budget.actualOccupancy || "", rooms: budget.actualRooms || "", adr: budget.actualAdr || "", revenue: budget.actualRevenue || "", comments: `Actuals for ${monthLabelFromKey(currentMonthKey)}` }
          : row.label === "LY SAME MONTH"
            ? { ...row, occupancy: budget.lyOccupancy || "", rooms: budget.lyRooms || "", adr: budget.lyAdr || "", revenue: budget.lyRevenue || "", comments: `Last year actual for ${monthLabelFromKey(currentMonthKey)}` }
            : row;
      return JSON.stringify(row) === JSON.stringify(next) ? row : next;
    }));
  }, [monthlyBudgets, currentMonthKey]);

  if (access.isLoading) return <div className={`${C.page} p-8`}>Loading operations report...</div>;
  if (!access.data?.unlocked) {
    return (
      <div className={`${C.page} flex items-center justify-center p-4`}>
        <Card className={`w-full max-w-md ${C.shell}`}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-[#2f5f46]" />
              <CardTitle>Ops Report PIN Required</CardTitle>
            </div>
            <CardDescription>Enter the 5 digit operations PIN to open the weekly report worksheet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Operations PIN</Label>
              <Input
                className={`${C.field} text-center text-2xl tracking-[0.4em]`}
                type="password"
                inputMode="numeric"
                maxLength={5}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 5))}
                onKeyDown={(event) => event.key === "Enter" && pin.length === 5 && unlock.mutate()}
              />
            </div>
            <Button className={`w-full ${C.green}`} onClick={() => unlock.mutate()} disabled={unlock.isPending || pin.length !== 5}>
              {unlock.isPending ? "Checking PIN..." : "Open Ops Report"}
            </Button>
            {!access.data?.hasPin && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">No Ops Report PIN is configured yet. Set `OPS_REPORT_PIN` or use the existing Tips team PIN.</div>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={C.page}>
      <header className="border-b border-[#d7c8b5] bg-[#fffaf2] px-4 py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6b3f]">Globiwest Weekly Operations</div>
            <h1 className="text-3xl font-semibold tracking-tight">Operations Report</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={week} onValueChange={handleWeekLabelChange}>
              <SelectTrigger className={`w-32 ${C.field}`}><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 52 }, (_, index) => <SelectItem key={index + 1} value={`Week ${index + 1}`}>Week {index + 1}</SelectItem>)}</SelectContent>
            </Select>
            <Button
              variant="outline"
              className={C.outline}
              onClick={() => {
                const existing = monthlyBudgets.find((row) => row.month === currentMonthKey);
                setBudgetForm(budgetFormFromRow(currentMonthKey || budgetForm.month, existing));
                setBudgetModalOpen(true);
              }}
            >
              Monthly Budget
            </Button>
            <Button variant="outline" className={C.outline} onClick={() => window.print()}><Download className="mr-2 h-4 w-4" />Print</Button>
            <Badge className={`${saveDraft.isPending ? "bg-[#b98435]" : "bg-[#2f5f46]"} px-3 py-2 text-white`}>
              {saveDraft.isPending ? "Autosaving..." : lastSavedAt ? `Saved ${lastSavedAt}` : "Autosave on"}
            </Badge>
            <Button variant="ghost" className="text-[#3b2f26] hover:bg-[#f8efe2]" onClick={() => lock.mutate()}><LogOut className="mr-2 h-4 w-4" />Lock</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <Card className={C.darkShell}>
          <CardContent className="grid gap-4 p-4 md:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              <DarkLabeledInput label="Property name" value={setup.propertyName} onChange={(propertyName) => setSetup({ ...setup, propertyName })} />
              <DarkLabeledInput label="General manager" value={setup.generalManager} onChange={(generalManager) => setSetup({ ...setup, generalManager })} />
              <DarkLabeledInput label="Total rooms" value={setup.totalRooms} onChange={(totalRooms) => setSetup({ ...setup, totalRooms })} type="number" />
              <DarkLabeledInput label="Monthly room nights" value={setup.monthlyRoomNights} onChange={(monthlyRoomNights) => setSetup({ ...setup, monthlyRoomNights })} type="number" />
            </div>
            <div className="rounded-xl border border-dashed border-[#cdbda8] bg-white p-4">
              <div className="flex items-center gap-2 font-semibold text-[#201814]"><Upload className="h-4 w-4" /> Import ops source report</div>
              <p className="mt-2 text-sm text-[#5f5247]">
                Upload weekly/monthly OTB CSV, GSS score summary, or Marriott response export. Recognized fields populate the matching worksheet sections.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input className={C.field} type="file" accept=".xlsx,.xls,.csv" multiple onChange={(event) => setOpsReportFiles(Array.from(event.target.files || []))} />
                <Button className={C.green} onClick={() => opsReportFiles.length && opsReportUpload.mutate(opsReportFiles)} disabled={!opsReportFiles.length || opsReportUpload.isPending}>
                  {opsReportUpload.isPending ? "Importing..." : "Import"}
                </Button>
              </div>
              {uploadedReports.length > 0 && (
                <div className="mt-3 rounded-lg border border-[#eadcc9] bg-[#fffaf2] p-2 text-xs text-[#5f5247]">
                  <div className="mb-1 font-semibold text-[#201814]">Imported reports</div>
                  <div className="space-y-1">
                    {uploadedReports.slice(-5).map((report, index) => (
                      <div key={`${report.originalFileName}-${index}`} className="flex justify-between gap-2">
                        <span className="truncate">{String(report.originalFileName || "Report")}</span>
                        <span className="shrink-0 uppercase tracking-wide">{String(report.reportType || "").replace(/_/g, " ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="weekly" className="space-y-5">
          <TabsList className="bg-[#fffaf2]">
            <TabsTrigger value="weekly">Weekly worksheet</TabsTrigger>
            <TabsTrigger value="summary">Summary dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-5">
            <Section title="Weekly Performance Dashboard" right={<Badge className="bg-[#23313d]">{week}</Badge>}>
              <EditableTable
                columns={[
                  { key: "week", label: "Week" }, { key: "rooms", label: "Rooms Sold" }, { key: "revenue", label: "Room Revenue" }, { key: "adr", label: "ADR" }, { key: "occupancy", label: "Occupancy %" }, { key: "labor", label: "Labor Hours" }, { key: "variance", label: "Labor Variance" },
                ]}
                rows={Array.from({ length: 10 }, (_, index) => ({ week: `Week ${index + 1}`, rooms: index === 0 ? topMetrics.roomsSold : "", revenue: index === 0 ? topMetrics.roomRevenue : "", adr: index === 0 ? adr.toFixed(0) : "", occupancy: index === 0 ? topMetrics.occupancy : "", labor: index === 0 ? String(laborTotal) : "", variance: index === 0 ? String(laborVariance) : "" }))}
                onChange={() => undefined}
              />
            </Section>
            <Section title="Key Performance Indicators YTD">
              <EditableTable
                columns={[{ key: "kpi", label: "KPI", wide: true }, { key: "current", label: "Current" }, { key: "target", label: "Target" }, { key: "variance", label: "Variance" }]}
                rows={[
                  { kpi: "Avg Weekly Revenue", current: topMetrics.roomRevenue, target: "25000", variance: String(num(topMetrics.roomRevenue) - 25000) },
                  { kpi: "Avg Occupancy %", current: topMetrics.occupancy, target: "65", variance: String(num(topMetrics.occupancy) - 65) },
                  { kpi: "Avg ADR", current: adr.toFixed(0), target: "120", variance: String(Math.round(adr - 120)) },
                  { kpi: "Labor Efficiency (Hrs/Room)", current: num(topMetrics.roomsSold) ? (laborTotal / num(topMetrics.roomsSold)).toFixed(2) : "0", target: "1.50", variance: num(topMetrics.roomsSold) ? ((laborTotal / num(topMetrics.roomsSold)) - 1.5).toFixed(2) : "0" },
                ]}
                onChange={() => undefined}
              />
            </Section>
          </TabsContent>

          <TabsContent value="weekly" className="space-y-5">
            <Card className={C.darkShell}>
              <CardHeader>
                <div className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-[#2f5f46]" /><CardTitle>{week} Report</CardTitle></div>
                <CardDescription className={C.darkMuted}>{setup.propertyName} | {topMetrics.weekStart} to {weekEnd || "week end date"}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <DarkLabeledInput
                  label="Week start date"
                  value={topMetrics.weekStart}
                  onChange={(weekStart) => {
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
                      setTopMetrics({ ...topMetrics, weekStart });
                      return;
                    }
                    loadOpsWeek(weekStart, week).catch((error) => toast({ title: "Unable to load week", description: error.message, variant: "destructive" }));
                  }}
                  type="date"
                />
                <DarkLabeledInput label="Week end date" value={weekEnd} onChange={() => undefined} type="date" />
                <DarkLabeledInput label="Rooms sold" value={topMetrics.roomsSold} onChange={(roomsSold) => setTopMetrics({ ...topMetrics, roomsSold })} type="number" />
                <DarkLabeledInput label="Occupancy %" value={topMetrics.occupancy} onChange={(occupancy) => setTopMetrics({ ...topMetrics, occupancy })} type="number" />
                <DarkLabeledInput label="Room revenue" value={topMetrics.roomRevenue} onChange={(roomRevenue) => setTopMetrics({ ...topMetrics, roomRevenue })} moneyFormat />
                <div className="rounded-lg border border-[#d7c8b5] bg-white p-3">
                  <div className={`text-xs font-semibold uppercase tracking-[0.12em] ${C.label}`}>Weekly ADR</div>
                  <div className="mt-2 text-2xl font-semibold text-[#201814]">{money(adr)}</div>
                </div>
                <DarkLabeledInput label="MTD this year" value={topMetrics.mtdThisYear} onChange={(mtdThisYear) => setTopMetrics({ ...topMetrics, mtdThisYear })} moneyFormat />
                <DarkLabeledInput label="MTD last year" value={topMetrics.mtdLastYear} onChange={(mtdLastYear) => setTopMetrics({ ...topMetrics, mtdLastYear })} moneyFormat />
                <DarkLabeledInput label="YTD this year" value={topMetrics.ytdThisYear} onChange={(ytdThisYear) => setTopMetrics({ ...topMetrics, ytdThisYear })} moneyFormat />
                <DarkLabeledInput label="YTD last year" value={topMetrics.ytdLastYear} onChange={(ytdLastYear) => setTopMetrics({ ...topMetrics, ytdLastYear })} moneyFormat />
              </CardContent>
            </Card>

            <Section title="Current Month">
              <EditableTable columns={[{ key: "label", label: "Current Month", wide: true }, { key: "occupancy", label: "Occupancy" }, { key: "rooms", label: "Rooms" }, { key: "adr", label: "ADR" }, { key: "revenue", label: "Room Revenue" }, { key: "comments", label: "Comments", wide: true }]} rows={monthRows} onChange={setMonthRows} />
            </Section>
            <Section title="Next Month Data">
              <EditableTable columns={[{ key: "label", label: "Next Month", wide: true }, { key: "occupancy", label: "Occupancy" }, { key: "rooms", label: "Rooms" }, { key: "adr", label: "ADR" }, { key: "revenue", label: "Room Revenue" }, { key: "comments", label: "Comments", wide: true }]} rows={nextMonthRows} onChange={setNextMonthRows} />
            </Section>
            <Section title="Weekly Chargebacks">
              <EditableTable columns={[{ key: "no", label: "S No" }, { key: "reason", label: "Reason", wide: true }, { key: "respondDate", label: "Respond Date" }, { key: "amount", label: "Total Amount" }, { key: "comment", label: "Comment", wide: true }]} rows={chargebacks} onChange={setChargebacks} />
            </Section>
            <Section title="Major Weekly Maintenance Tasks">
              <EditableTable columns={[{ key: "no", label: "S No" }, { key: "rooms", label: "P.M. Rooms" }, { key: "area", label: "Area" }, { key: "hours", label: "Time Consumed Hrs" }, { key: "comment", label: "Comment", wide: true }]} rows={maintenance} onChange={setMaintenance} />
            </Section>
            <Section title="Weekly Out of Order Rooms">
              <EditableTable columns={[{ key: "no", label: "S No" }, { key: "room", label: "Room No" }, { key: "startDate", label: "OOO Start Date" }, { key: "returnDate", label: "Expected Return" }, { key: "comment", label: "Comment", wide: true }]} rows={oooRooms} onChange={setOooRooms} />
            </Section>
            <Section title="Week's Total Revenue Adjustments" right={<Badge variant="outline">{money(adjustmentTotal)}</Badge>}>
              <EditableTable columns={[{ key: "no", label: "S No" }, { key: "room", label: "Room No" }, { key: "guest", label: "Guest Name" }, { key: "amount", label: "Adjustment Amount" }, { key: "comment", label: "Reason/Comment", wide: true }]} rows={adjustments} onChange={setAdjustments} />
            </Section>
            <Section title="Accounts Receivable / Aging" right={<Badge variant="outline">Total {money(arTotal)}</Badge>}>
              <div className="grid gap-3 p-4 sm:grid-cols-5">
                <LabeledInput label="Current" value={ar.current} onChange={(current) => setAr({ ...ar, current })} moneyFormat />
                <LabeledInput label="30" value={ar.d30} onChange={(d30) => setAr({ ...ar, d30 })} moneyFormat />
                <LabeledInput label="60" value={ar.d60} onChange={(d60) => setAr({ ...ar, d60 })} moneyFormat />
                <LabeledInput label="90+" value={ar.d90} onChange={(d90) => setAr({ ...ar, d90 })} moneyFormat />
                <LabeledInput label="Comments" value={ar.comments} onChange={(comments) => setAr({ ...ar, comments })} />
              </div>
            </Section>
            <Section title="Guest Ledger Balance">
              <div className="grid gap-3 p-4 sm:grid-cols-3">
                <LabeledInput label="Total balance" value={ledger.balance} onChange={(balance) => setLedger({ ...ledger, balance })} moneyFormat />
                <LabeledInput label="Any guest over $1000" value={ledger.over1000} onChange={(over1000) => setLedger({ ...ledger, over1000 })} moneyFormat />
                <LabeledInput label="Comment" value={ledger.comment} onChange={(comment) => setLedger({ ...ledger, comment })} />
              </div>
            </Section>
            <Section title="Department Labor Review (Controllable)" right={<Badge variant="outline">Variance {laborVariance}</Badge>}>
              <div className="flex flex-col gap-3 border-b border-[#e0d3c1] p-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-[#201814]">Scheduled Hours vs Actual Hours</div>
                  <p className="mt-1 max-w-2xl text-sm text-[#5f5247]">
                    Scheduled hours pull from the matching week in Schedule. Actual hours come from the payroll labor summary PDF.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    <Badge variant="outline">Scheduled {fmtHours(scheduledLaborTotal)}</Badge>
                    <Badge variant="outline">Actual {fmtHours(actualLaborTotal)}</Badge>
                    {scheduledLabor.data?.scheduleId ? <Badge className="bg-[#2f5f46]">Schedule linked</Badge> : <Badge variant="outline">No schedule found for this week</Badge>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button variant="outline" className={C.outline} onClick={() => scheduledLabor.refetch()} disabled={scheduledLabor.isFetching}>
                    {scheduledLabor.isFetching ? "Refreshing..." : "Refresh scheduled"}
                  </Button>
                  <Input
                    className={`${C.field} sm:w-72`}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => setLaborFile(event.target.files?.[0] || null)}
                  />
                  <Button className={C.green} onClick={() => laborFile && actualLaborUpload.mutate(laborFile)} disabled={!laborFile || actualLaborUpload.isPending}>
                    {actualLaborUpload.isPending ? "Parsing..." : "Import actual hours"}
                  </Button>
                </div>
              </div>
              <EditableTable
                columns={[
                  { key: "department", label: "Department", wide: true },
                  { key: "scheduledHours", label: "Scheduled Hours" },
                  { key: "actualHours", label: "Actual Hours" },
                  { key: "variance", label: "Actual - Scheduled" },
                  { key: "budget", label: "Budgeted Hours" },
                  { key: "comments", label: "Comments", wide: true },
                ]}
                rows={laborRows}
                onChange={(rows) => setLabor(rows.map(({ variance, ...row }) => row))}
              />
            </Section>
            <Section title="Staffing">
              <div className="grid gap-3 p-4 md:grid-cols-5">
                <LabeledInput label="Any open positions" value={staffing.openPositions} onChange={(openPositions) => setStaffing({ ...staffing, openPositions })} />
                <LabeledInput label="Status" value={staffing.status} onChange={(status) => setStaffing({ ...staffing, status })} />
                <LabeledInput label="Overtime last week" value={staffing.overtimeLastWeek} onChange={(overtimeLastWeek) => setStaffing({ ...staffing, overtimeLastWeek })} />
                <LabeledInput label="Overtime expected" value={staffing.overtimeExpected} onChange={(overtimeExpected) => setStaffing({ ...staffing, overtimeExpected })} />
                <LabeledInput label="Comment" value={staffing.comment} onChange={(comment) => setStaffing({ ...staffing, comment })} />
              </div>
            </Section>
            <Section title="Brand / Guest Relation Cases">
              <EditableTable columns={[{ key: "no", label: "S No" }, { key: "guest", label: "Guest Name" }, { key: "incidentType", label: "Incident Type" }, { key: "resolution", label: "Resolution / Compensation" }, { key: "comment", label: "Incident / Comment", wide: true }]} rows={cases} onChange={setCases} />
            </Section>
            <Section title="GM Weekly Overview">
              <BulletRowsEditor rows={gmOverviewRows} onChange={setGmOverviewRows} />
            </Section>
            <Section title="Guest Satisfaction Scores">
              <EditableTable columns={[{ key: "label", label: "GSS MTD", wide: true }, { key: "hotel", label: "Hotel" }, { key: "priorWeek", label: "Prior Week" }, { key: "weekVariance", label: "+/- Prior" }, { key: "brand", label: "Brand / Continent" }, { key: "variance", label: "Variance" }, { key: "sply", label: "SPLY Variance" }, { key: "comments", label: "Comments", wide: true }]} rows={gssRowsWithPrevious} onChange={setGssRows} />
            </Section>
            <Section title="GSS Wave To Date">
              <EditableTable columns={[{ key: "label", label: "GSS Wave To Date", wide: true }, { key: "hotel", label: "Hotel" }, { key: "priorWeek", label: "Prior Week" }, { key: "weekVariance", label: "+/- Prior" }, { key: "brand", label: "Brand / Continent" }, { key: "variance", label: "Variance" }, { key: "sply", label: "SPLY Variance" }, { key: "comments", label: "Comments", wide: true }]} rows={gssWaveRowsWithPrevious} onChange={setGssWaveRows} />
            </Section>
            <Section title="Online Reputation">
              <EditableTable columns={[{ key: "label", label: "Name", wide: true }, { key: "reviews", label: "Total Reviews" }, { key: "score", label: "Rank / Score" }, { key: "outOf", label: "Out Of" }, { key: "goal", label: "Goal Rank" }, { key: "variance", label: "Variance" }, { key: "strategy", label: "Strategy / Action Plan", wide: true }]} rows={reputationRows} onChange={setReputationRows} />
            </Section>
            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="Weekly Reviews: Positive">
                <EditableTable columns={[{ key: "source", label: "Source" }, { key: "score", label: "Overall Score" }, { key: "comment", label: "Guest Comments", wide: true }]} rows={positiveReviews} onChange={setPositiveReviews} />
              </Section>
              <Section title="Weekly Reviews: Negative">
                <EditableTable columns={[{ key: "source", label: "Source" }, { key: "score", label: "Overall Score" }, { key: "comment", label: "Guest Comments", wide: true }]} rows={negativeReviews} onChange={setNegativeReviews} />
              </Section>
            </div>
            <Section title="Corporate Director Review & Weekly Follow-Up">
              <EditableTable columns={[{ key: "point", label: "Discussion Point", wide: true }, { key: "direction", label: "Direction Given", wide: true }, { key: "owner", label: "Owner" }, { key: "dueDate", label: "Due Date" }, { key: "status", label: "Status" }, { key: "notes", label: "Notes", wide: true }]} rows={followUp} onChange={setFollowUp} />
            </Section>
            <Section title="Top 3 Priorities For Next Week">
              <EditableTable columns={[{ key: "priority", label: "Priority" }, { key: "action", label: "Action / Result", wide: true }, { key: "owner", label: "Owner" }, { key: "dueDate", label: "Due Date" }, { key: "status", label: "Status" }, { key: "support", label: "Support Needed", wide: true }]} rows={priorities} onChange={setPriorities} />
            </Section>
          </TabsContent>
        </Tabs>
      </main>
      <Dialog open={budgetModalOpen} onOpenChange={setBudgetModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden border-[#d7c8b5] bg-[#fffaf2] p-0 text-[#201814]">
          <div className="flex max-h-[90vh] flex-col">
          <div className="border-b border-[#d7c8b5] px-6 py-4">
          <DialogHeader>
            <DialogTitle>Monthly Budget Inputs</DialogTitle>
            <DialogDescription>
              Enter monthly budget, closed-month actuals, and last year actuals. The matching report month will populate the related rows automatically.
            </DialogDescription>
          </DialogHeader>
          </div>
          <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-4 sm:grid-cols-2">
            <div>
              <Label className={`text-xs font-semibold uppercase tracking-[0.12em] ${C.label}`}>Month</Label>
              <Select value={budgetForm.month} onValueChange={(month) => {
                const existing = monthlyBudgets.find((row) => row.month === month);
                setBudgetForm(budgetFormFromRow(month, existing));
              }}>
                <SelectTrigger className={`mt-1 ${C.field}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, index) => {
                    const year = new Date().getFullYear();
                    const value = `${year}-${String(index + 1).padStart(2, "0")}`;
                    return <SelectItem key={value} value={value}>{monthLabelFromKey(value)}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 border-t border-[#d7c8b5] pt-3">
              <div className="text-sm font-semibold text-[#201814]">Current Month Budget</div>
            </div>
            <LabeledInput label="Budgeted rooms sold" value={budgetForm.rooms} onChange={(rooms) => setBudgetForm({ ...budgetForm, rooms })} type="number" />
            <LabeledInput label="Budgeted occupancy %" value={budgetForm.occupancy} onChange={(occupancy) => setBudgetForm({ ...budgetForm, occupancy })} />
            <LabeledInput label="Budgeted ADR" value={budgetForm.adr} onChange={(adr) => setBudgetForm({ ...budgetForm, adr })} moneyFormat />
            <LabeledInput label="Budgeted room revenue" value={budgetForm.revenue} onChange={(revenue) => setBudgetForm({ ...budgetForm, revenue })} moneyFormat />
            <div className="sm:col-span-2 border-t border-[#d7c8b5] pt-3">
              <div className="text-sm font-semibold text-[#201814]">Closed Month Actuals</div>
              <p className="mt-1 text-xs text-[#5f5247]">Use this after the month closes. These values populate the Monthly Total row.</p>
            </div>
            <LabeledInput label="Actual rooms sold" value={budgetForm.actualRooms} onChange={(actualRooms) => setBudgetForm({ ...budgetForm, actualRooms })} type="number" />
            <LabeledInput label="Actual occupancy %" value={budgetForm.actualOccupancy} onChange={(actualOccupancy) => setBudgetForm({ ...budgetForm, actualOccupancy })} />
            <LabeledInput label="Actual ADR" value={budgetForm.actualAdr} onChange={(actualAdr) => setBudgetForm({ ...budgetForm, actualAdr })} moneyFormat />
            <LabeledInput label="Actual room revenue" value={budgetForm.actualRevenue} onChange={(actualRevenue) => setBudgetForm({ ...budgetForm, actualRevenue })} moneyFormat />
            <div className="sm:col-span-2 border-t border-[#d7c8b5] pt-3">
              <div className="text-sm font-semibold text-[#201814]">Last Year Same Month Actuals</div>
            </div>
            <LabeledInput label="LY rooms sold" value={budgetForm.lyRooms} onChange={(lyRooms) => setBudgetForm({ ...budgetForm, lyRooms })} type="number" />
            <LabeledInput label="LY occupancy %" value={budgetForm.lyOccupancy} onChange={(lyOccupancy) => setBudgetForm({ ...budgetForm, lyOccupancy })} />
            <LabeledInput label="LY ADR" value={budgetForm.lyAdr} onChange={(lyAdr) => setBudgetForm({ ...budgetForm, lyAdr })} moneyFormat />
            <LabeledInput label="LY room revenue" value={budgetForm.lyRevenue} onChange={(lyRevenue) => setBudgetForm({ ...budgetForm, lyRevenue })} moneyFormat />
          </div>
          <div className="flex justify-end gap-2 border-t border-[#d7c8b5] px-6 py-4">
            <Button variant="outline" className={C.outline} onClick={() => setBudgetModalOpen(false)}>Cancel</Button>
            <Button className={C.green} onClick={saveMonthlyBudget} disabled={!budgetForm.month}>Save monthly inputs</Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
