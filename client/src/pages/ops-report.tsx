import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, LockKeyhole, LogOut, Trash2, Upload } from "lucide-react";
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
  uploadId: string;
  originalFileName: string;
  sourceFileName: string;
  reportType: "previous_week_otb" | "current_month_otb" | "next_month_otb" | "detailed_flash" | "ooo_rooms" | "gss_scores" | "marriott_responses" | "ar_aging" | "unknown";
  status: "parsed" | "warning" | "failed";
  warnings: string[];
  selectedWeek: string;
  weekStartDate: string;
  weekEndDate: string;
  reportMonth: string;
  createdAt: string;
  preview: Array<Record<string, unknown>>;
  mapping: Record<string, any>;
  beforePatch?: Record<string, any>;
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

const REPORT_TYPE_LABELS: Record<OpsImportResponse["reportType"], string> = {
  previous_week_otb: "Previous Week OTB",
  current_month_otb: "Current Month OTB",
  next_month_otb: "Next Month OTB",
  detailed_flash: "Detailed Flash",
  ooo_rooms: "OOO Rooms",
  gss_scores: "GSS Scores",
  marriott_responses: "Marriott Responses",
  ar_aging: "AR Aging",
  unknown: "Unrecognized / Failed",
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
  const n = num(value);
  if (!Number.isFinite(n)) return String(value);
  if (digits <= 0) return n.toFixed(0);
  return n.toFixed(digits).replace(/\.?0+$/, "");
}

function monthlyRoomsValue(rooms: string | number | undefined, adr: string | number | undefined, revenue: string | number | undefined) {
  const enteredRooms = num(rooms || "");
  const adrValue = num(adr || "");
  const revenueValue = num(revenue || "");
  const impliedRooms = adrValue > 0 && revenueValue > 0 ? Math.round(revenueValue / adrValue) : 0;
  if (enteredRooms > 0 && impliedRooms >= 1000 && enteredRooms < 1000 && Math.abs(impliedRooms - enteredRooms * 10) <= 20) {
    return rowValue(impliedRooms, 0);
  }
  return rowValue(rooms, 0);
}

function monthlyRoomsNumber(rooms: string | number | undefined, adr: string | number | undefined, revenue: string | number | undefined) {
  return num(monthlyRoomsValue(rooms, adr, revenue));
}

function normalizeMonthlyBudgetRow(row: Row): Row {
  return {
    ...row,
    rooms: monthlyRoomsValue(row.rooms || "", row.adr || "", row.revenue || ""),
    actualRooms: monthlyRoomsValue(row.actualRooms || "", row.actualAdr || "", row.actualRevenue || ""),
    lyRooms: monthlyRoomsValue(row.lyRooms || "", row.lyAdr || "", row.lyRevenue || ""),
  };
}

function mergeMonthlyActualFromOtb(rows: Row[], monthly: Record<string, any>) {
  const month = monthKeyFromDate(monthly.dateStart);
  if (!month) return rows.map(normalizeMonthlyBudgetRow);
  const total = monthly.total || {};
  const actualPatch: Row = {
    month,
    actualRooms: rowValue(total.roomsSold, 0),
    actualOccupancy: percentDisplay(total.occupancy),
    actualAdr: accounting(total.adr),
    actualRevenue: accounting(total.roomRevenue),
    actualSource: `OTB import ${monthly.dateStart} to ${monthly.dateEnd}`,
  };
  const existing = rows.find((row) => row.month === month);
  const merged = normalizeMonthlyBudgetRow({ ...(existing || { month }), ...actualPatch });
  return [...rows.filter((row) => row.month !== month), merged]
    .map(normalizeMonthlyBudgetRow)
    .sort((a, b) => String(a.month || "").localeCompare(String(b.month || "")));
}

const REPORT_PAYLOAD_KEYS: Record<OpsImportResponse["reportType"], string[]> = {
  previous_week_otb: ["topMetrics"],
  current_month_otb: ["monthRows", "monthlyBudgets"],
  next_month_otb: ["nextMonthRows"],
  detailed_flash: ["topMetrics", "monthRows", "monthlyBudgets"],
  ooo_rooms: ["oooRooms"],
  gss_scores: ["gssRows", "gssWaveRows"],
  marriott_responses: ["positiveReviews", "negativeReviews"],
  ar_aging: ["ar"],
  unknown: [],
};

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function captureReportPatch(payload: Record<string, any>, reportType: OpsImportResponse["reportType"]) {
  return Object.fromEntries(REPORT_PAYLOAD_KEYS[reportType].map((key) => [key, cloneValue(payload[key])]));
}

function fillRows(rows: Row[], count = 5) {
  return [...rows, ...emptyRows(Math.max(0, count - rows.length), ["source", "score", "comment"])].slice(0, count);
}

function applyOpsReportToPayload(payload: Record<string, any>, report: OpsImportResponse) {
  const next = cloneValue(payload);
  const mapping = report.mapping || {};
  if (report.reportType === "previous_week_otb") {
    const total = mapping.total || {};
    next.topMetrics = {
      ...next.topMetrics,
      occupancy: percentDisplay(total.occupancy),
      roomsSold: rowValue(total.roomsSold, 0),
      roomRevenue: accounting(total.roomRevenue),
    };
  }
  if (report.reportType === "current_month_otb") {
    const total = mapping.total || {};
    next.monthRows = (next.monthRows || []).map((row: Row) => {
      const label = String(row.label || "").toUpperCase();
      if (label !== "FUTURE BOOKED" && label !== "MONTHLY TOTAL") return row;
      return {
        ...row,
        occupancy: percentDisplay(total.occupancy),
        rooms: rowValue(total.roomsSold, 0),
        adr: accounting(total.adr),
        revenue: accounting(total.roomRevenue),
        comments: `Imported ${mapping.dateStart} to ${mapping.dateEnd}`,
      };
    });
    next.monthlyBudgets = mergeMonthlyActualFromOtb(next.monthlyBudgets || [], mapping);
  }
  if (report.reportType === "next_month_otb") {
    const total = mapping.total || {};
    next.nextMonthRows = (next.nextMonthRows || []).map((row: Row) => {
      if (String(row.label || "").toUpperCase() !== "FUTURE BOOKED FOR NEXT MONTH") return row;
      return {
        ...row,
        occupancy: percentDisplay(total.occupancy),
        rooms: rowValue(total.roomsSold, 0),
        adr: accounting(total.adr),
        revenue: accounting(total.roomRevenue),
        comments: `Imported ${mapping.dateStart} to ${mapping.dateEnd}`,
      };
    });
  }
  if (report.reportType === "detailed_flash") {
    const mtd = mapping.mtd || {};
    const ytd = mapping.ytd || {};
    next.topMetrics = {
      ...next.topMetrics,
      mtdThisYear: accounting(mtd.roomRevenue),
      ytdThisYear: accounting(ytd.roomRevenue),
    };
    next.monthRows = (next.monthRows || []).map((row: Row) => String(row.label || "").toUpperCase() === "MONTH TO DATE"
      ? { ...row, occupancy: percentDisplay(mtd.occupancy), rooms: rowValue(mtd.roomsSold, 0), adr: accounting(mtd.adr), revenue: accounting(mtd.roomRevenue), comments: "Detailed Flash MTD" }
      : row);
    const reportMonth = report.reportMonth;
    if (reportMonth) {
      const existing = (next.monthlyBudgets || []).find((row: Row) => row.month === reportMonth);
      next.monthlyBudgets = [
        ...(next.monthlyBudgets || []).filter((row: Row) => row.month !== reportMonth),
        normalizeMonthlyBudgetRow({
          ...(existing || { month: reportMonth }),
          actualRooms: rowValue(mtd.roomsSold, 0),
          actualOccupancy: percentDisplay(mtd.occupancy),
          actualAdr: accounting(mtd.adr),
          actualRevenue: accounting(mtd.roomRevenue),
          actualSource: "Detailed Flash MTD",
        }),
      ];
    }
  }
  if (report.reportType === "ooo_rooms") {
    const rooms = (mapping.rooms || []) as Row[];
    next.oooRooms = rooms.length ? rooms : emptyRows(5, ["no", "room", "startDate", "returnDate", "comment"]);
  }
  if (report.reportType === "gss_scores") {
    const merge = (existing: Row[], incoming: Row[]) => {
      const labels = new Set(incoming.map((row) => row.label));
      return [...existing.filter((row) => !labels.has(row.label)), ...incoming];
    };
    next.gssRows = merge(next.gssRows || [], mapping.gssRows || []);
    next.gssWaveRows = merge(next.gssWaveRows || [], mapping.gssWaveRows || []);
  }
  if (report.reportType === "marriott_responses") {
    next.positiveReviews = fillRows(mapping.positiveReviews || []);
    next.negativeReviews = fillRows(mapping.negativeReviews || []);
  }
  if (report.reportType === "ar_aging") {
    const summary = mapping.summary || {};
    next.ar = {
      current: accounting(summary.current),
      d30: accounting(summary.d30),
      d60: accounting(summary.d60),
      d90: accounting(num(summary.d90) + num(summary.d120)),
      comments: `Imported AR total ${accounting(summary.total)}; 120+ ${accounting(summary.d120)}`,
    };
  }
  return next;
}

function ytdActualRevenueFromMonthlyBudgets(rows: Row[], throughMonth: string) {
  return rows
    .filter((row) => row.month && (!throughMonth || row.month <= throughMonth))
    .reduce((total, row) => total + num(row.actualRevenue || ""), 0);
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
      <Input className={`mt-1 ${C.field}`} type={type} inputMode={type === "number" ? "numeric" : undefined} value={value} onChange={(event) => onChange(event.target.value)} onBlur={() => moneyFormat && onChange(accounting(value))} />
    </div>
  );
}

function DarkLabeledInput({ label, value, onChange, type = "text", moneyFormat = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; moneyFormat?: boolean }) {
  return (
    <div>
      <Label className={`text-xs font-semibold uppercase tracking-[0.12em] ${C.darkLabel}`}>{label}</Label>
      <Input className={`mt-1 ${C.darkField}`} type={type} inputMode={type === "number" ? "numeric" : undefined} value={value} onChange={(event) => onChange(event.target.value)} onBlur={() => moneyFormat && onChange(accounting(value))} />
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

function varianceTone(value: number) {
  if (!Number.isFinite(value) || value === 0) return "border-[#d7c8b5] bg-[#fffaf2] text-[#5f5247]";
  return value > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800";
}

function signedValue(value: number, formatter: (value: number) => string) {
  if (!Number.isFinite(value) || value === 0) return formatter(0);
  return `${value > 0 ? "+" : ""}${formatter(value)}`;
}

function stripDerivedComparisonColumns(rows: Row[]) {
  return rows.map(({ priorWeek, weekVariance, ...row }) => row);
}

function YtdMetricCard({
  label,
  actual,
  budget,
  lastYear,
  varianceToBudget,
  varianceToLastYear,
  budgetVarianceValue,
  lastYearVarianceValue,
}: {
  label: string;
  actual: string;
  budget: string;
  lastYear: string;
  varianceToBudget: string;
  varianceToLastYear: string;
  budgetVarianceValue?: number;
  lastYearVarianceValue?: number;
}) {
  const budgetVarianceNumber = budgetVarianceValue ?? num(varianceToBudget);
  const lyVarianceNumber = lastYearVarianceValue ?? num(varianceToLastYear);
  return (
    <div className="rounded-xl border border-[#d7c8b5] bg-[#fffaf2] p-4 shadow-sm">
      <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${C.label}`}>{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[#201814]">{actual}</div>
      <div className="mt-3 grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[#5f5247]">Budget</span>
          <span className="font-semibold text-[#201814]">{budget}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[#5f5247]">Last year</span>
          <span className="font-semibold text-[#201814]">{lastYear}</span>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className={`rounded-lg border px-3 py-2 text-sm font-semibold ${varianceTone(budgetVarianceNumber)}`}>
          vs Budget<br /><span className="text-base">{varianceToBudget}</span>
        </div>
        <div className={`rounded-lg border px-3 py-2 text-sm font-semibold ${varianceTone(lyVarianceNumber)}`}>
          vs LY<br /><span className="text-base">{varianceToLastYear}</span>
        </div>
      </div>
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
                    readOnly={column.key === "priorWeek" || column.key === "weekVariance"}
                    className={`h-9 border-transparent bg-transparent px-2 text-sm font-medium text-[#201814] placeholder:text-[#7c6e61] focus:border-[#b98435] focus:bg-white ${column.key === "priorWeek" || column.key === "weekVariance" ? "!bg-[#f3efe7] !text-[#5f5247]" : ""}`}
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
                      if (column.key === "priorWeek" || column.key === "weekVariance") return;
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
  const [setup, setSetup] = useState({ propertyName: "Courtyard Austin Lakeline", generalManager: "", totalRooms: "", monthlyRoomNights: "" });
  const [topMetrics, setTopMetrics] = useState({ weekStart: "2026-01-03", occupancy: "", roomsSold: "", roomRevenue: "", mtdThisYear: "", mtdLastYear: "", ytdThisYear: "", ytdLastYear: "" });
  const [monthRows, setMonthRows] = useState<Row[]>([
    { label: "MONTH TO DATE", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "FUTURE BOOKED", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "MONTHLY TOTAL", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "CURRENT MONTH BUDGET", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "VARIANCE", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "LY SAME MONTH", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
  ]);
  const [nextMonthRows, setNextMonthRows] = useState<Row[]>([
    { label: "FUTURE BOOKED FOR NEXT MONTH", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "NEXT MONTH BUDGET", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "VARIANCE", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
  ]);
  const [chargebacks, setChargebacks] = useState<Row[]>(emptyRows(5, ["no", "reason", "respondDate", "amount", "comment"]));
  const [maintenance, setMaintenance] = useState<Row[]>(emptyRows(5, ["no", "rooms", "area", "hours", "comment"]));
  const [oooRooms, setOooRooms] = useState<Row[]>(emptyRows(5, ["no", "room", "startDate", "returnDate", "comment"]));
  const [adjustments, setAdjustments] = useState<Row[]>(emptyRows(5, ["no", "room", "guest", "amount", "comment"]));
  const [ar, setAr] = useState({ current: "", d30: "", d60: "", d90: "", comments: "" });
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
  const [bistroModalOpen, setBistroModalOpen] = useState(false);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [summaryMonthKey, setSummaryMonthKey] = useState(monthKeyFromDate(new Date().toISOString().slice(0, 10)));
  const [monthlyBudgets, setMonthlyBudgets] = useState<Row[]>([]);
  const [bistroProductions, setBistroProductions] = useState<Row[]>([]);
  const [meetingProductions, setMeetingProductions] = useState<Row[]>([]);
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
  const [bistroForm, setBistroForm] = useState({
    month: monthKeyFromDate(new Date().toISOString().slice(0, 10)),
    budgetRevenue: "",
    actualRevenue: "",
    lyRevenue: "",
    notes: "",
  });
  const [meetingForm, setMeetingForm] = useState({
    month: monthKeyFromDate(new Date().toISOString().slice(0, 10)),
    budgetRevenue: "",
    actualRevenue: "",
    lyRevenue: "",
    roomRental: "",
    avRevenue: "",
    setupFees: "",
    serviceFees: "",
    groupBreakfastRevenue: "",
    otherRevenue: "",
    notes: "",
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
      form.append("reportMonth", monthKeyFromDate(topMetrics.weekStart));
      const response = await fetch(apiUrl("/api/opsreport/import"), { method: "POST", credentials: "include", body: form });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<OpsImportBatchResponse>;
    },
    onSuccess: (data) => {
      let nextPayload: Record<string, any> = cloneValue(currentDraftPayload);
      const reports = data.reports.map((report) => {
        const beforePatch = captureReportPatch(nextPayload, report.reportType);
        if (report.status !== "failed") nextPayload = applyOpsReportToPayload(nextPayload, report);
        return { ...report, beforePatch };
      });
      applyPayloadState(nextPayload);
      setUploadedReports((current) => [...current, ...reports]);
      setOpsReportFiles([]);
      const warnings = reports.reduce((total, report) => total + report.warnings.length, 0);
      const failed = reports.filter((report) => report.status === "failed").length;
      toast({
        title: "Ops reports imported",
        description: `${reports.length - failed} mapped, ${failed} failed.${warnings ? ` ${warnings} parser message${warnings === 1 ? "" : "s"} need review.` : ""}`,
      });
    },
    onError: (error: Error) => toast({ title: "Unable to import report", description: error.message, variant: "destructive" }),
  });
  const saveDraft = useMutation({
    mutationFn: async (payload: Record<string, any>) => apiRequest("POST", "/api/opsreport/draft", payload),
    onSuccess: () => setLastSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })),
    onError: (error: Error) => toast({ title: "Unable to save ops report draft", description: error.message, variant: "destructive" }),
  });
  const removeOpsReportUpload = useMutation({
    mutationFn: async (uploadId: string) => {
      const selectedIndex = uploadedReports.findIndex((report) => report.uploadId === uploadId);
      if (selectedIndex < 0) throw new Error("Upload was not found.");
      const selected = uploadedReports[selectedIndex] as OpsImportResponse;
      const hasLaterSameType = uploadedReports.slice(selectedIndex + 1).some((report) => report.reportType === selected.reportType);
      let transferredRollback = false;
      const remaining = uploadedReports
        .filter((report) => report.uploadId !== uploadId)
        .map((report) => {
          if (!hasLaterSameType || transferredRollback || report.reportType !== selected.reportType) return report;
          if (uploadedReports.findIndex((item) => item.uploadId === report.uploadId) <= selectedIndex) return report;
          transferredRollback = true;
          return { ...report, beforePatch: selected.beforePatch };
        });
      let payload: Record<string, any> = cloneValue(currentDraftPayload);
      if (!hasLaterSameType) {
        const previous = [...uploadedReports.slice(0, selectedIndex)].reverse().find((report) => report.reportType === selected.reportType) as OpsImportResponse | undefined;
        payload = previous ? applyOpsReportToPayload(payload, previous) : { ...payload, ...(selected.beforePatch || {}) };
      }
      const response = await fetch(apiUrl(`/api/opsreport/uploads/${encodeURIComponent(uploadId)}`), {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: topMetrics.weekStart, weekEnd, weekLabel: week, payload, uploadedReports: remaining }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<OpsDraftResponse>;
    },
    onSuccess: (data) => {
      hydrateOpsDraft(data.draft);
      toast({ title: "Report removed", description: "Its mapped values were recalculated from the remaining uploads." });
    },
    onError: (error: Error) => toast({ title: "Unable to remove report", description: error.message, variant: "destructive" }),
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
  const previousWeekReports = useMemo(
    () => (previousDraft.data?.draft?.uploadedReports || []).filter((report) => report.status !== "removed"),
    [previousDraft.data?.draft?.uploadedReports],
  );
  const uploadedReportsByType = useMemo(() => Object.entries(
    uploadedReports.reduce<Record<string, Array<Record<string, any>>>>((groups, report) => {
      const key = String(report.reportType || "unknown");
      (groups[key] ||= []).push(report);
      return groups;
    }, {}),
  ), [uploadedReports]);
  const ytdMonthlySummary = useMemo(() => {
    const availableRows = monthlyBudgets
      .filter((row) => row.month && (!currentMonthKey || row.month <= currentMonthKey))
      .sort((a, b) => String(a.month).localeCompare(String(b.month)));
    const actualRows = availableRows.filter((row) => row.actualRooms || row.actualOccupancy || row.actualAdr || row.actualRevenue);
    const rows = actualRows.length ? actualRows : availableRows;
    const sum = (key: string) => rows.reduce((total, row) => total + num(row[key]), 0);
    const avg = (key: string) => {
      const values = rows.map((row) => num(row[key])).filter((value) => Number.isFinite(value) && value !== 0);
      return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
    };
    const budgetRooms = rows.reduce((total, row) => total + monthlyRoomsNumber(row.rooms, row.adr, row.revenue), 0);
    const actualRooms = rows.reduce((total, row) => total + monthlyRoomsNumber(row.actualRooms, row.actualAdr, row.actualRevenue), 0);
    const lyRooms = rows.reduce((total, row) => total + monthlyRoomsNumber(row.lyRooms, row.lyAdr, row.lyRevenue), 0);
    const budgetRevenue = sum("revenue");
    const actualRevenue = sum("actualRevenue");
    const lyRevenue = sum("lyRevenue");
    const budgetAdr = budgetRooms ? budgetRevenue / budgetRooms : avg("adr");
    const actualAdr = actualRooms ? actualRevenue / actualRooms : avg("actualAdr");
    const lyAdr = lyRooms ? lyRevenue / lyRooms : avg("lyAdr");
    const budgetOccupancy = avg("occupancy");
    const actualOccupancy = avg("actualOccupancy");
    const lyOccupancy = avg("lyOccupancy");
    const actualMonths = actualRows.length;
    return {
      months: availableRows.length,
      actualMonths,
      budgetRooms,
      actualRooms,
      lyRooms,
      budgetRevenue,
      actualRevenue,
      lyRevenue,
      budgetAdr,
      actualAdr,
      lyAdr,
      budgetOccupancy,
      actualOccupancy,
      lyOccupancy,
    };
  }, [monthlyBudgets, currentMonthKey]);
  const productionSummary = useMemo(() => {
    const bistroRows = bistroProductions.filter((row) => row.month && (!currentMonthKey || row.month <= currentMonthKey));
    const meetingRows = meetingProductions.filter((row) => row.month && (!currentMonthKey || row.month <= currentMonthKey));
    const rowTotal = (row: Row, keys: string[]) => keys.reduce((total, key) => total + num(row[key]), 0);
    const bistroKeys = ["foodRevenue", "beerRevenue", "wineRevenue", "liquorRevenue", "breakfastRevenue", "otherRevenue"];
    const bistroActualTotal = (row: Row | undefined) => row ? num(row.actualRevenue || "") || rowTotal(row, bistroKeys) : 0;
    const meetingKeys = ["roomRental", "avRevenue", "setupFees", "serviceFees", "groupBreakfastRevenue", "otherRevenue"];
    const meetingActualTotal = (row: Row | undefined) => row ? num(row.actualRevenue || "") || rowTotal(row, meetingKeys) : 0;
    const currentBistro = bistroProductions.find((row) => row.month === currentMonthKey);
    const currentMeeting = meetingProductions.find((row) => row.month === currentMonthKey);
    return {
      bistroCurrent: bistroActualTotal(currentBistro),
      bistroYtd: bistroRows.reduce((total, row) => total + bistroActualTotal(row), 0),
      bistroMonths: bistroRows.length,
      bistroBudget: currentBistro ? num(currentBistro.budgetRevenue) : 0,
      bistroLy: currentBistro ? num(currentBistro.lyRevenue) : 0,
      meetingCurrent: meetingActualTotal(currentMeeting),
      meetingYtd: meetingRows.reduce((total, row) => total + meetingActualTotal(row), 0),
      meetingMonths: meetingRows.length,
      meetingBudget: currentMeeting ? num(currentMeeting.budgetRevenue) : 0,
      meetingLy: currentMeeting ? num(currentMeeting.lyRevenue) : 0,
    };
  }, [bistroProductions, meetingProductions, currentMonthKey]);
  const selectedMonthSummary = useMemo(() => {
    const month = summaryMonthKey || currentMonthKey;
    const budget = monthlyBudgets.find((row) => row.month === month);
    const bistro = bistroProductions.find((row) => row.month === month);
    const meeting = meetingProductions.find((row) => row.month === month);
    const total = (row: Row | undefined, keys: string[]) => row ? keys.reduce((sum, key) => sum + num(row[key]), 0) : 0;
    const bistroActual = bistro ? num(bistro.actualRevenue || "") || total(bistro, ["foodRevenue", "beerRevenue", "wineRevenue", "liquorRevenue", "breakfastRevenue", "otherRevenue"]) : 0;
    const meetingActual = meeting ? num(meeting.actualRevenue || "") || total(meeting, ["roomRental", "avRevenue", "setupFees", "serviceFees", "groupBreakfastRevenue", "otherRevenue"]) : 0;
    return {
      month,
      roomsActual: monthlyRoomsNumber(budget?.actualRooms || "", budget?.actualAdr || "", budget?.actualRevenue || ""),
      roomsBudget: monthlyRoomsNumber(budget?.rooms || "", budget?.adr || "", budget?.revenue || ""),
      roomsLy: monthlyRoomsNumber(budget?.lyRooms || "", budget?.lyAdr || "", budget?.lyRevenue || ""),
      revenueActual: num(budget?.actualRevenue || ""),
      revenueBudget: num(budget?.revenue || ""),
      revenueLy: num(budget?.lyRevenue || ""),
      occupancyActual: num(budget?.actualOccupancy || ""),
      occupancyBudget: num(budget?.occupancy || ""),
      occupancyLy: num(budget?.lyOccupancy || ""),
      adrActual: num(budget?.actualAdr || ""),
      adrBudget: num(budget?.adr || ""),
      adrLy: num(budget?.lyAdr || ""),
      bistroActual,
      bistroBudget: num(bistro?.budgetRevenue || ""),
      bistroLy: num(bistro?.lyRevenue || ""),
      meetingActual,
      meetingBudget: num(meeting?.budgetRevenue || ""),
      meetingLy: num(meeting?.lyRevenue || ""),
    };
  }, [summaryMonthKey, currentMonthKey, monthlyBudgets, bistroProductions, meetingProductions]);
  const weekEnd = useMemo(() => {
    const start = new Date(`${topMetrics.weekStart}T00:00:00`);
    if (Number.isNaN(start.getTime())) return "";
    start.setDate(start.getDate() + 6);
    return start.toISOString().slice(0, 10);
  }, [topMetrics.weekStart]);
  const saveMonthlyBudget = () => {
    const normalized = {
      month: budgetForm.month,
      rooms: monthlyRoomsValue(budgetForm.rooms, budgetForm.adr, budgetForm.revenue),
      occupancy: percentDisplay(budgetForm.occupancy),
      adr: accounting(budgetForm.adr),
      revenue: accounting(budgetForm.revenue),
      actualRooms: monthlyRoomsValue(budgetForm.actualRooms, budgetForm.actualAdr, budgetForm.actualRevenue),
      actualOccupancy: percentDisplay(budgetForm.actualOccupancy),
      actualAdr: accounting(budgetForm.actualAdr),
      actualRevenue: accounting(budgetForm.actualRevenue),
      lyRooms: monthlyRoomsValue(budgetForm.lyRooms, budgetForm.lyAdr, budgetForm.lyRevenue),
      lyOccupancy: percentDisplay(budgetForm.lyOccupancy),
      lyAdr: accounting(budgetForm.lyAdr),
      lyRevenue: accounting(budgetForm.lyRevenue),
    };
    const nextMonthlyBudgets = [...monthlyBudgets.filter((row) => row.month !== normalized.month), normalizeMonthlyBudgetRow(normalized)].map(normalizeMonthlyBudgetRow);
    setMonthlyBudgets(nextMonthlyBudgets);
    if (access.data?.unlocked && weekEnd) {
      saveDraft.mutate({
        weekStart: topMetrics.weekStart,
        weekEnd,
        weekLabel: week,
        payload: { ...currentDraftPayload, monthlyBudgets: nextMonthlyBudgets },
        uploadedReports,
      });
    }
    setBudgetModalOpen(false);
    toast({ title: "Monthly budget saved", description: `${monthLabelFromKey(normalized.month)} budget will populate matching weekly reports.` });
  };
  const saveBistroProduction = () => {
    const normalized = {
      month: bistroForm.month,
      budgetRevenue: accounting(bistroForm.budgetRevenue),
      actualRevenue: accounting(bistroForm.actualRevenue),
      lyRevenue: accounting(bistroForm.lyRevenue),
      notes: bistroForm.notes,
    };
    setBistroProductions((rows) => [...rows.filter((row) => row.month !== normalized.month), normalized]);
    setBistroModalOpen(false);
    toast({ title: "Bistro / Bar production saved", description: `${monthLabelFromKey(normalized.month)} production is available on the summary dashboard.` });
  };
  const saveMeetingProduction = () => {
    const normalized = {
      month: meetingForm.month,
      budgetRevenue: accounting(meetingForm.budgetRevenue),
      actualRevenue: accounting(meetingForm.actualRevenue),
      lyRevenue: accounting(meetingForm.lyRevenue),
      roomRental: accounting(meetingForm.roomRental),
      avRevenue: accounting(meetingForm.avRevenue),
      setupFees: accounting(meetingForm.setupFees),
      serviceFees: accounting(meetingForm.serviceFees),
      groupBreakfastRevenue: accounting(meetingForm.groupBreakfastRevenue),
      otherRevenue: accounting(meetingForm.otherRevenue),
      notes: meetingForm.notes,
    };
    setMeetingProductions((rows) => [...rows.filter((row) => row.month !== normalized.month), normalized]);
    setMeetingModalOpen(false);
    toast({ title: "Meeting Space production saved", description: `${monthLabelFromKey(normalized.month)} production is available on the summary dashboard.` });
  };
  const budgetFormFromRow = (month: string, existing?: Row) => ({
    month,
    rooms: monthlyRoomsValue(existing?.rooms || "", existing?.adr || "", existing?.revenue || ""),
    occupancy: existing?.occupancy || "",
    adr: existing?.adr || "",
    revenue: existing?.revenue || "",
    actualRooms: monthlyRoomsValue(existing?.actualRooms || "", existing?.actualAdr || "", existing?.actualRevenue || ""),
    actualOccupancy: existing?.actualOccupancy || "",
    actualAdr: existing?.actualAdr || "",
    actualRevenue: existing?.actualRevenue || "",
    lyRooms: monthlyRoomsValue(existing?.lyRooms || "", existing?.lyAdr || "", existing?.lyRevenue || ""),
    lyOccupancy: existing?.lyOccupancy || "",
    lyAdr: existing?.lyAdr || "",
    lyRevenue: existing?.lyRevenue || "",
  });
  const bistroFormFromRow = (month: string, existing?: Row) => ({
    month,
    budgetRevenue: existing?.budgetRevenue || "",
    actualRevenue: existing?.actualRevenue || accounting(num(existing?.foodRevenue || "") + num(existing?.beerRevenue || "") + num(existing?.wineRevenue || "") + num(existing?.liquorRevenue || "") + num(existing?.breakfastRevenue || "") + num(existing?.otherRevenue || "")),
    lyRevenue: existing?.lyRevenue || "",
    notes: existing?.notes || "",
  });
  const meetingFormFromRow = (month: string, existing?: Row) => ({
    month,
    budgetRevenue: existing?.budgetRevenue || "",
    actualRevenue: existing?.actualRevenue || accounting(num(existing?.roomRental || "") + num(existing?.avRevenue || "") + num(existing?.setupFees || "") + num(existing?.serviceFees || "") + num(existing?.groupBreakfastRevenue || "") + num(existing?.otherRevenue || "")),
    lyRevenue: existing?.lyRevenue || "",
    roomRental: existing?.roomRental || "",
    avRevenue: existing?.avRevenue || "",
    setupFees: existing?.setupFees || "",
    serviceFees: existing?.serviceFees || "",
    groupBreakfastRevenue: existing?.groupBreakfastRevenue || "",
    otherRevenue: existing?.otherRevenue || "",
    notes: existing?.notes || "",
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
  function applyPayloadState(payload: Record<string, any>) {
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
    if (payload.monthlyBudgets) setMonthlyBudgets(payload.monthlyBudgets.map(normalizeMonthlyBudgetRow));
    if (payload.bistroProductions) setBistroProductions(payload.bistroProductions);
    if (payload.meetingProductions) setMeetingProductions(payload.meetingProductions);
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
  }
  const hydrateOpsDraft = (loaded: OpsDraftResponse["draft"]) => {
    if (!loaded?.payload) return false;
    setWeek(loaded.weekLabel || "Week 1");
    applyPayloadState(loaded.payload);
    setUploadedReports((loaded.uploadedReports || []).filter((report) => {
      const sourceWeekStart = String(report.weekStartDate || "").trim();
      return !sourceWeekStart || sourceWeekStart === loaded.weekStart;
    }));
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
    monthlyBudgets: monthlyBudgets.map(normalizeMonthlyBudgetRow),
    bistroProductions,
    meetingProductions,
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
  }), [setup, topMetrics, monthRows, nextMonthRows, chargebacks, maintenance, oooRooms, adjustments, ar, ledger, labor, monthlyBudgets, bistroProductions, meetingProductions, staffing, cases, gmOverviewRows, gssRows, gssWaveRows, reputationRows, positiveReviews, negativeReviews, followUp, priorities]);

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
    setMonthRows((rows) => {
      const existingMonthlyTotal = rows.find((item) => String(item.label || "").trim().toUpperCase() === "MONTHLY TOTAL") || {};
      const hasActuals = Boolean(budget.actualRooms || budget.actualOccupancy || budget.actualAdr || budget.actualRevenue);
      const monthlyTotal = hasActuals
        ? {
            occupancy: budget.actualOccupancy || "",
            rooms: monthlyRoomsValue(budget.actualRooms || "", budget.actualAdr || "", budget.actualRevenue || ""),
            adr: budget.actualAdr || "",
            revenue: budget.actualRevenue || "",
          }
        : existingMonthlyTotal;
      let changed = false;
      const nextRows = rows.map((row) => {
      const label = String(row.label || "").trim().toUpperCase();
      const next = label === "CURRENT MONTH BUDGET" || label === "CURRENT MONTHLY BUDGET"
        ? { ...row, occupancy: budget.occupancy || "", rooms: monthlyRoomsValue(budget.rooms || "", budget.adr || "", budget.revenue || ""), adr: budget.adr || "", revenue: budget.revenue || "", comments: `Budget for ${monthLabelFromKey(currentMonthKey)}` }
        : label === "MONTHLY TOTAL" && hasActuals
          ? { ...row, occupancy: budget.actualOccupancy || "", rooms: monthlyRoomsValue(budget.actualRooms || "", budget.actualAdr || "", budget.actualRevenue || ""), adr: budget.actualAdr || "", revenue: budget.actualRevenue || "", comments: `Actuals for ${monthLabelFromKey(currentMonthKey)}` }
          : label === "LY SAME MONTH"
            ? { ...row, occupancy: budget.lyOccupancy || "", rooms: monthlyRoomsValue(budget.lyRooms || "", budget.lyAdr || "", budget.lyRevenue || ""), adr: budget.lyAdr || "", revenue: budget.lyRevenue || "", comments: `Last year actual for ${monthLabelFromKey(currentMonthKey)}` }
            : label === "VARIANCE"
              ? {
                  ...row,
                  occupancy: rowValue(num(monthlyTotal?.occupancy || "") - num(budget.occupancy || ""), 2),
                  rooms: rowValue(num(monthlyTotal?.rooms || "") - num(budget.rooms || ""), 0),
                  adr: accounting(num(monthlyTotal?.adr || "") - num(budget.adr || "")),
                  revenue: accounting(num(monthlyTotal?.revenue || "") - num(budget.revenue || "")),
                  comments: `Monthly total minus budget for ${monthLabelFromKey(currentMonthKey)}`,
                }
            : row;
      if (JSON.stringify(row) !== JSON.stringify(next)) changed = true;
      return next;
      });
      return changed ? nextRows : rows;
    });
  }, [monthlyBudgets, currentMonthKey, monthRows]);

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
            <Button
              variant="outline"
              className={C.outline}
              onClick={() => {
                const existing = bistroProductions.find((row) => row.month === currentMonthKey);
                setBistroForm(bistroFormFromRow(currentMonthKey || bistroForm.month, existing));
                setBistroModalOpen(true);
              }}
            >
              Bistro / Bar
            </Button>
            <Button
              variant="outline"
              className={C.outline}
              onClick={() => {
                const existing = meetingProductions.find((row) => row.month === currentMonthKey);
                setMeetingForm(meetingFormFromRow(currentMonthKey || meetingForm.month, existing));
                setMeetingModalOpen(true);
              }}
            >
              Meeting Space
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
                Upload OTB, Detailed Flash, OOO Rooms, GSS, Marriott responses, or AR Aging reports. Files are matched by name and report headers.
              </p>
              <div className="mt-3 rounded-lg border border-[#eadcc9] bg-[#fffaf2] p-3 text-xs text-[#5f5247]">
                <div className="font-semibold text-[#201814]">Files needed and suggested names</div>
                <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                  <div><span className="font-medium text-[#201814]">Previous Week OTB:</span> <code>MMDDYYYY_Previous Week OTB.csv</code></div>
                  <div><span className="font-medium text-[#201814]">Current Month OTB:</span> <code>MMDDYYYY_June Month OTB.csv</code></div>
                  <div><span className="font-medium text-[#201814]">Next Month OTB:</span> <code>MMDDYYYY_July Month OTB.csv</code></div>
                  <div><span className="font-medium text-[#201814]">Detailed Flash:</span> <code>Detailed Flash_AUSNL_YYYY-MM-DD.csv</code></div>
                  <div><span className="font-medium text-[#201814]">OOO Rooms:</span> <code>MMDDYYYY_OOO Rooms.pdf</code></div>
                  <div><span className="font-medium text-[#201814]">GSS Scores:</span> <code>MMDDYYYY_GSS Scores.xlsx</code></div>
                  <div><span className="font-medium text-[#201814]">Marriott Responses:</span> <code>Marriott_Responses_Export_MM_DD_YYYY.xlsx</code></div>
                  <div><span className="font-medium text-[#201814]">AR Aging:</span> <code>MMDDYYYY_AR Aging.xlsx</code></div>
                </div>
                <div className="mt-2 text-[#7c6e61]">
                  Replace the dates and month names with the reporting period. The current-month and next-month OTB files must use their actual month names.
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input className={C.field} type="file" accept=".xlsx,.xls,.csv,.pdf" multiple onChange={(event) => setOpsReportFiles(Array.from(event.target.files || []))} />
                <Button className={C.green} onClick={() => opsReportFiles.length && opsReportUpload.mutate(opsReportFiles)} disabled={!opsReportFiles.length || opsReportUpload.isPending}>
                  {opsReportUpload.isPending ? "Importing..." : "Import"}
                </Button>
              </div>
              {uploadedReports.length > 0 && (
                <div className="mt-3 space-y-2 rounded-lg border border-[#eadcc9] bg-[#fffaf2] p-2 text-xs text-[#5f5247]">
                  <div className="font-semibold text-[#201814]">Files imported for {week}</div>
                  {uploadedReportsByType.map(([reportType, reports]) => (
                    <div key={reportType} className="rounded-md border border-[#eadcc9] bg-white p-2">
                      <div className="mb-1 font-semibold text-[#201814]">{REPORT_TYPE_LABELS[reportType as OpsImportResponse["reportType"]] || reportType}</div>
                      <div className="space-y-2">
                        {reports.map((report) => (
                          <div key={String(report.uploadId)} className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-medium text-[#201814]">{String(report.originalFileName || "Report")}</div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                <Badge
                                  variant={report.status === "parsed" ? "default" : "outline"}
                                  className={report.status === "failed" ? "border-rose-400 text-rose-800" : report.status === "warning" ? "border-amber-400 text-amber-800" : "bg-[#2f5f46]"}
                                >
                                  {report.status === "failed" ? "Failed" : report.status === "warning" ? "Warning" : "Parsed"}
                                </Badge>
                                <Badge variant="outline">{Array.isArray(report.preview) ? report.preview.length : 0} preview rows</Badge>
                              </div>
                              {Array.isArray(report.warnings) && report.warnings.length > 0 && (
                                <div className="mt-1 text-amber-800">{report.warnings.join(" ")}</div>
                              )}
                              {Array.isArray(report.preview) && report.preview.length > 0 && (
                                <details className="mt-1">
                                  <summary className="cursor-pointer font-medium text-[#5b4b3b]">Parsed preview</summary>
                                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-[#f3efe7] p-2 text-[10px]">
                                    {JSON.stringify(report.preview.slice(0, 3), null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className={`${C.outline} shrink-0`}
                              disabled={removeOpsReportUpload.isPending}
                              onClick={() => {
                                if (window.confirm(`Remove ${String(report.originalFileName || "this report")} and recalculate its mapped data?`)) {
                                  removeOpsReportUpload.mutate(String(report.uploadId));
                                }
                              }}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {previousWeekReports.length > 0 && (
                <div className="mt-3 rounded-lg border border-[#d6dee4] bg-[#f4f7f9] p-3 text-xs text-[#52616c]">
                  <div className="font-semibold text-[#243746]">Previous week files used for variances</div>
                  <div className="mt-1 text-[#667681]">
                    Reference only from {previousDraft.data?.draft?.weekLabel || "the previous week"} ({previousDraft.data?.draft?.weekStart} to {previousDraft.data?.draft?.weekEnd}). These are not current-week imports.
                  </div>
                  <div className="mt-2 space-y-1">
                    {previousWeekReports.map((report, index) => (
                      <div key={String(report.uploadId || `${report.originalFileName}-${index}`)} className="flex items-center justify-between gap-2 rounded border border-[#d6dee4] bg-white px-2 py-1.5">
                        <span className="truncate">{String(report.originalFileName || "Report")}</span>
                        <span className="shrink-0 font-medium text-[#243746]">
                          {REPORT_TYPE_LABELS[report.reportType as OpsImportResponse["reportType"]] || String(report.reportType || "Report").replace(/_/g, " ")}
                        </span>
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
            <Section
              title="Selected Month Performance"
              right={
                <Select value={summaryMonthKey || currentMonthKey} onValueChange={setSummaryMonthKey}>
                  <SelectTrigger className={`w-44 ${C.field}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, index) => {
                      const year = new Date(`${topMetrics.weekStart || new Date().toISOString().slice(0, 10)}T00:00:00`).getUTCFullYear() || new Date().getFullYear();
                      const value = `${year}-${String(index + 1).padStart(2, "0")}`;
                      return <SelectItem key={value} value={value}>{monthLabelFromKey(value)}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              }
            >
              <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                <YtdMetricCard
                  label="Room Revenue"
                  actual={money(selectedMonthSummary.revenueActual)}
                  budget={money(selectedMonthSummary.revenueBudget)}
                  lastYear={money(selectedMonthSummary.revenueLy)}
                  varianceToBudget={signedValue(selectedMonthSummary.revenueActual - selectedMonthSummary.revenueBudget, money)}
                  varianceToLastYear={signedValue(selectedMonthSummary.revenueActual - selectedMonthSummary.revenueLy, money)}
                  budgetVarianceValue={selectedMonthSummary.revenueActual - selectedMonthSummary.revenueBudget}
                  lastYearVarianceValue={selectedMonthSummary.revenueActual - selectedMonthSummary.revenueLy}
                />
                <YtdMetricCard
                  label="Rooms Sold"
                  actual={rowValue(selectedMonthSummary.roomsActual, 0) || "0"}
                  budget={rowValue(selectedMonthSummary.roomsBudget, 0) || "0"}
                  lastYear={rowValue(selectedMonthSummary.roomsLy, 0) || "0"}
                  varianceToBudget={signedValue(selectedMonthSummary.roomsActual - selectedMonthSummary.roomsBudget, (value) => rowValue(value, 0) || "0")}
                  varianceToLastYear={signedValue(selectedMonthSummary.roomsActual - selectedMonthSummary.roomsLy, (value) => rowValue(value, 0) || "0")}
                  budgetVarianceValue={selectedMonthSummary.roomsActual - selectedMonthSummary.roomsBudget}
                  lastYearVarianceValue={selectedMonthSummary.roomsActual - selectedMonthSummary.roomsLy}
                />
                <YtdMetricCard
                  label="Occupancy"
                  actual={percentDisplay(selectedMonthSummary.occupancyActual) || "0%"}
                  budget={percentDisplay(selectedMonthSummary.occupancyBudget) || "0%"}
                  lastYear={percentDisplay(selectedMonthSummary.occupancyLy) || "0%"}
                  varianceToBudget={signedValue(selectedMonthSummary.occupancyActual - selectedMonthSummary.occupancyBudget, (value) => `${rowValue(value, 1) || "0"} pts`)}
                  varianceToLastYear={signedValue(selectedMonthSummary.occupancyActual - selectedMonthSummary.occupancyLy, (value) => `${rowValue(value, 1) || "0"} pts`)}
                  budgetVarianceValue={selectedMonthSummary.occupancyActual - selectedMonthSummary.occupancyBudget}
                  lastYearVarianceValue={selectedMonthSummary.occupancyActual - selectedMonthSummary.occupancyLy}
                />
                <YtdMetricCard
                  label="ADR"
                  actual={money(selectedMonthSummary.adrActual)}
                  budget={money(selectedMonthSummary.adrBudget)}
                  lastYear={money(selectedMonthSummary.adrLy)}
                  varianceToBudget={signedValue(selectedMonthSummary.adrActual - selectedMonthSummary.adrBudget, money)}
                  varianceToLastYear={signedValue(selectedMonthSummary.adrActual - selectedMonthSummary.adrLy, money)}
                  budgetVarianceValue={selectedMonthSummary.adrActual - selectedMonthSummary.adrBudget}
                  lastYearVarianceValue={selectedMonthSummary.adrActual - selectedMonthSummary.adrLy}
                />
                <YtdMetricCard
                  label="Bistro / Bar Production"
                  actual={money(selectedMonthSummary.bistroActual)}
                  budget={money(selectedMonthSummary.bistroBudget)}
                  lastYear={money(selectedMonthSummary.bistroLy)}
                  varianceToBudget={signedValue(selectedMonthSummary.bistroActual - selectedMonthSummary.bistroBudget, money)}
                  varianceToLastYear={signedValue(selectedMonthSummary.bistroActual - selectedMonthSummary.bistroLy, money)}
                  budgetVarianceValue={selectedMonthSummary.bistroActual - selectedMonthSummary.bistroBudget}
                  lastYearVarianceValue={selectedMonthSummary.bistroActual - selectedMonthSummary.bistroLy}
                />
                <YtdMetricCard
                  label="Meeting Space Production"
                  actual={money(selectedMonthSummary.meetingActual)}
                  budget={money(selectedMonthSummary.meetingBudget)}
                  lastYear={money(selectedMonthSummary.meetingLy)}
                  varianceToBudget={signedValue(selectedMonthSummary.meetingActual - selectedMonthSummary.meetingBudget, money)}
                  varianceToLastYear={signedValue(selectedMonthSummary.meetingActual - selectedMonthSummary.meetingLy, money)}
                  budgetVarianceValue={selectedMonthSummary.meetingActual - selectedMonthSummary.meetingBudget}
                  lastYearVarianceValue={selectedMonthSummary.meetingActual - selectedMonthSummary.meetingLy}
                />
              </div>
            </Section>
            <Section
              title="YTD Budget / Actual / Last Year"
              right={<Badge variant="outline">{ytdMonthlySummary.actualMonths} actual month{ytdMonthlySummary.actualMonths === 1 ? "" : "s"} entered</Badge>}
            >
              <div className="space-y-4 p-4">
                {!ytdMonthlySummary.months && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Add monthly budget inputs to populate this YTD dashboard.
                  </div>
                )}
                {ytdMonthlySummary.months > 0 && !ytdMonthlySummary.actualMonths && (
                  <div className="rounded-lg border border-[#d7c8b5] bg-[#fffaf2] p-3 text-sm text-[#5f5247]">
                    Budget and last-year data are available. Add closed-month actuals in the Monthly Budget modal to show actual variance.
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <YtdMetricCard
                    label="Room Revenue"
                    actual={money(ytdMonthlySummary.actualRevenue)}
                    budget={money(ytdMonthlySummary.budgetRevenue)}
                    lastYear={money(ytdMonthlySummary.lyRevenue)}
                    varianceToBudget={signedValue(ytdMonthlySummary.actualRevenue - ytdMonthlySummary.budgetRevenue, money)}
                    varianceToLastYear={signedValue(ytdMonthlySummary.actualRevenue - ytdMonthlySummary.lyRevenue, money)}
                    budgetVarianceValue={ytdMonthlySummary.actualRevenue - ytdMonthlySummary.budgetRevenue}
                    lastYearVarianceValue={ytdMonthlySummary.actualRevenue - ytdMonthlySummary.lyRevenue}
                  />
                  <YtdMetricCard
                    label="Rooms Sold"
                    actual={rowValue(ytdMonthlySummary.actualRooms, 0) || "0"}
                    budget={rowValue(ytdMonthlySummary.budgetRooms, 0) || "0"}
                    lastYear={rowValue(ytdMonthlySummary.lyRooms, 0) || "0"}
                    varianceToBudget={signedValue(ytdMonthlySummary.actualRooms - ytdMonthlySummary.budgetRooms, (value) => rowValue(value, 0) || "0")}
                    varianceToLastYear={signedValue(ytdMonthlySummary.actualRooms - ytdMonthlySummary.lyRooms, (value) => rowValue(value, 0) || "0")}
                    budgetVarianceValue={ytdMonthlySummary.actualRooms - ytdMonthlySummary.budgetRooms}
                    lastYearVarianceValue={ytdMonthlySummary.actualRooms - ytdMonthlySummary.lyRooms}
                  />
                  <YtdMetricCard
                    label="Occupancy"
                    actual={percentDisplay(ytdMonthlySummary.actualOccupancy) || "0%"}
                    budget={percentDisplay(ytdMonthlySummary.budgetOccupancy) || "0%"}
                    lastYear={percentDisplay(ytdMonthlySummary.lyOccupancy) || "0%"}
                    varianceToBudget={signedValue(ytdMonthlySummary.actualOccupancy - ytdMonthlySummary.budgetOccupancy, (value) => `${rowValue(value, 1) || "0"} pts`)}
                    varianceToLastYear={signedValue(ytdMonthlySummary.actualOccupancy - ytdMonthlySummary.lyOccupancy, (value) => `${rowValue(value, 1) || "0"} pts`)}
                    budgetVarianceValue={ytdMonthlySummary.actualOccupancy - ytdMonthlySummary.budgetOccupancy}
                    lastYearVarianceValue={ytdMonthlySummary.actualOccupancy - ytdMonthlySummary.lyOccupancy}
                  />
                  <YtdMetricCard
                    label="ADR"
                    actual={money(ytdMonthlySummary.actualAdr)}
                    budget={money(ytdMonthlySummary.budgetAdr)}
                    lastYear={money(ytdMonthlySummary.lyAdr)}
                    varianceToBudget={signedValue(ytdMonthlySummary.actualAdr - ytdMonthlySummary.budgetAdr, money)}
                    varianceToLastYear={signedValue(ytdMonthlySummary.actualAdr - ytdMonthlySummary.lyAdr, money)}
                    budgetVarianceValue={ytdMonthlySummary.actualAdr - ytdMonthlySummary.budgetAdr}
                    lastYearVarianceValue={ytdMonthlySummary.actualAdr - ytdMonthlySummary.lyAdr}
                  />
                </div>
              </div>
            </Section>
            <Section title="Department Production" right={<Badge variant="outline">{monthLabelFromKey(currentMonthKey)}</Badge>}>
              <div className="grid gap-4 p-4 md:grid-cols-2">
                <div className="rounded-xl border border-[#d7c8b5] bg-[#fffaf2] p-4 shadow-sm">
                  <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${C.label}`}>Bistro / Bar Production</div>
                  <div className="mt-2 text-2xl font-semibold text-[#201814]">{money(productionSummary.bistroCurrent)}</div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-[#5f5247]">YTD production</span>
                    <span className="font-semibold text-[#201814]">{money(productionSummary.bistroYtd)}</span>
                  </div>
                  <div className="mt-1 text-xs text-[#5f5247]">{productionSummary.bistroMonths} month{productionSummary.bistroMonths === 1 ? "" : "s"} entered</div>
                </div>
                <div className="rounded-xl border border-[#d7c8b5] bg-[#fffaf2] p-4 shadow-sm">
                  <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${C.label}`}>Meeting Space Production</div>
                  <div className="mt-2 text-2xl font-semibold text-[#201814]">{money(productionSummary.meetingCurrent)}</div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-[#5f5247]">YTD production</span>
                    <span className="font-semibold text-[#201814]">{money(productionSummary.meetingYtd)}</span>
                  </div>
                  <div className="mt-1 text-xs text-[#5f5247]">{productionSummary.meetingMonths} month{productionSummary.meetingMonths === 1 ? "" : "s"} entered</div>
                </div>
              </div>
            </Section>
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
                <DarkLabeledInput label="Occupancy %" value={topMetrics.occupancy} onChange={(occupancy) => setTopMetrics({ ...topMetrics, occupancy })} />
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
              <EditableTable columns={[{ key: "label", label: "GSS MTD", wide: true }, { key: "hotel", label: "Hotel" }, { key: "priorWeek", label: "Prior Week" }, { key: "weekVariance", label: "+/- Prior" }, { key: "brand", label: "Brand / Continent" }, { key: "variance", label: "Variance" }, { key: "sply", label: "SPLY Variance" }, { key: "comments", label: "Comments", wide: true }]} rows={gssRowsWithPrevious} onChange={(rows) => setGssRows(stripDerivedComparisonColumns(rows))} />
            </Section>
            <Section title="GSS Wave To Date">
              <EditableTable columns={[{ key: "label", label: "GSS Wave To Date", wide: true }, { key: "hotel", label: "Hotel" }, { key: "priorWeek", label: "Prior Week" }, { key: "weekVariance", label: "+/- Prior" }, { key: "brand", label: "Brand / Continent" }, { key: "variance", label: "Variance" }, { key: "sply", label: "SPLY Variance" }, { key: "comments", label: "Comments", wide: true }]} rows={gssWaveRowsWithPrevious} onChange={(rows) => setGssWaveRows(stripDerivedComparisonColumns(rows))} />
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
            <LabeledInput label="Budgeted rooms sold" value={budgetForm.rooms} onChange={(rooms) => setBudgetForm({ ...budgetForm, rooms })} />
            <LabeledInput label="Budgeted occupancy %" value={budgetForm.occupancy} onChange={(occupancy) => setBudgetForm({ ...budgetForm, occupancy })} />
            <LabeledInput label="Budgeted ADR" value={budgetForm.adr} onChange={(adr) => setBudgetForm({ ...budgetForm, adr })} moneyFormat />
            <LabeledInput label="Budgeted room revenue" value={budgetForm.revenue} onChange={(revenue) => setBudgetForm({ ...budgetForm, revenue })} moneyFormat />
            <div className="sm:col-span-2 border-t border-[#d7c8b5] pt-3">
              <div className="text-sm font-semibold text-[#201814]">Closed Month Actuals</div>
              <p className="mt-1 text-xs text-[#5f5247]">Use this after the month closes. These values populate the Monthly Total row.</p>
            </div>
            <LabeledInput label="Actual rooms sold" value={budgetForm.actualRooms} onChange={(actualRooms) => setBudgetForm({ ...budgetForm, actualRooms })} />
            <LabeledInput label="Actual occupancy %" value={budgetForm.actualOccupancy} onChange={(actualOccupancy) => setBudgetForm({ ...budgetForm, actualOccupancy })} />
            <LabeledInput label="Actual ADR" value={budgetForm.actualAdr} onChange={(actualAdr) => setBudgetForm({ ...budgetForm, actualAdr })} moneyFormat />
            <LabeledInput label="Actual room revenue" value={budgetForm.actualRevenue} onChange={(actualRevenue) => setBudgetForm({ ...budgetForm, actualRevenue })} moneyFormat />
            <div className="sm:col-span-2 border-t border-[#d7c8b5] pt-3">
              <div className="text-sm font-semibold text-[#201814]">Last Year Same Month Actuals</div>
            </div>
            <LabeledInput label="LY rooms sold" value={budgetForm.lyRooms} onChange={(lyRooms) => setBudgetForm({ ...budgetForm, lyRooms })} />
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
      <Dialog open={bistroModalOpen} onOpenChange={setBistroModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden border-[#d7c8b5] bg-[#fffaf2] p-0 text-[#201814]">
          <div className="flex max-h-[90vh] flex-col">
            <div className="border-b border-[#d7c8b5] px-6 py-4">
              <DialogHeader>
                <DialogTitle>Bistro / Bar Production</DialogTitle>
                <DialogDescription>
                  Enter monthly Bistro / Bar totals. These feed the Summary Dashboard separately from Rooms revenue.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-4 sm:grid-cols-2">
              <div>
                <Label className={`text-xs font-semibold uppercase tracking-[0.12em] ${C.label}`}>Month</Label>
                <Select value={bistroForm.month} onValueChange={(month) => {
                  const existing = bistroProductions.find((row) => row.month === month);
                  setBistroForm(bistroFormFromRow(month, existing));
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
                <div className="text-sm font-semibold text-[#201814]">Monthly Totals</div>
              </div>
              <LabeledInput label="Budgeted total production" value={bistroForm.budgetRevenue} onChange={(budgetRevenue) => setBistroForm({ ...bistroForm, budgetRevenue })} moneyFormat />
              <LabeledInput label="Actual total production" value={bistroForm.actualRevenue} onChange={(actualRevenue) => setBistroForm({ ...bistroForm, actualRevenue })} moneyFormat />
              <LabeledInput label="LY same month production" value={bistroForm.lyRevenue} onChange={(lyRevenue) => setBistroForm({ ...bistroForm, lyRevenue })} moneyFormat />
              <div className="sm:col-span-2">
                <Label className={`text-xs font-semibold uppercase tracking-[0.12em] ${C.label}`}>Notes</Label>
                <Textarea className={`mt-1 min-h-[90px] ${C.field}`} value={bistroForm.notes} onChange={(event) => setBistroForm({ ...bistroForm, notes: event.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#d7c8b5] px-6 py-4">
              <Button variant="outline" className={C.outline} onClick={() => setBistroModalOpen(false)}>Cancel</Button>
              <Button className={C.green} onClick={saveBistroProduction} disabled={!bistroForm.month}>Save Bistro / Bar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={meetingModalOpen} onOpenChange={setMeetingModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden border-[#d7c8b5] bg-[#fffaf2] p-0 text-[#201814]">
          <div className="flex max-h-[90vh] flex-col">
            <div className="border-b border-[#d7c8b5] px-6 py-4">
              <DialogHeader>
                <DialogTitle>Meeting Space Production</DialogTitle>
                <DialogDescription>
                  Enter meeting room and group production. These totals stay separate from Bistro daily production and Rooms revenue.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-4 sm:grid-cols-2">
              <div>
                <Label className={`text-xs font-semibold uppercase tracking-[0.12em] ${C.label}`}>Month</Label>
                <Select value={meetingForm.month} onValueChange={(month) => {
                  const existing = meetingProductions.find((row) => row.month === month);
                  setMeetingForm(meetingFormFromRow(month, existing));
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
                <div className="text-sm font-semibold text-[#201814]">Budget / Prior Year</div>
              </div>
              <LabeledInput label="Budgeted total production" value={meetingForm.budgetRevenue} onChange={(budgetRevenue) => setMeetingForm({ ...meetingForm, budgetRevenue })} moneyFormat />
              <LabeledInput label="Actual total production" value={meetingForm.actualRevenue} onChange={(actualRevenue) => setMeetingForm({ ...meetingForm, actualRevenue })} moneyFormat />
              <LabeledInput label="LY same month production" value={meetingForm.lyRevenue} onChange={(lyRevenue) => setMeetingForm({ ...meetingForm, lyRevenue })} moneyFormat />
              <div className="sm:col-span-2 border-t border-[#d7c8b5] pt-3">
                <div className="text-sm font-semibold text-[#201814]">Production Categories</div>
              </div>
              <LabeledInput label="Room rental" value={meetingForm.roomRental} onChange={(roomRental) => setMeetingForm({ ...meetingForm, roomRental })} moneyFormat />
              <LabeledInput label="A/V revenue" value={meetingForm.avRevenue} onChange={(avRevenue) => setMeetingForm({ ...meetingForm, avRevenue })} moneyFormat />
              <LabeledInput label="Setup fees" value={meetingForm.setupFees} onChange={(setupFees) => setMeetingForm({ ...meetingForm, setupFees })} moneyFormat />
              <LabeledInput label="Service fees" value={meetingForm.serviceFees} onChange={(serviceFees) => setMeetingForm({ ...meetingForm, serviceFees })} moneyFormat />
              <LabeledInput label="Group breakfast revenue" value={meetingForm.groupBreakfastRevenue} onChange={(groupBreakfastRevenue) => setMeetingForm({ ...meetingForm, groupBreakfastRevenue })} moneyFormat />
              <LabeledInput label="Other revenue" value={meetingForm.otherRevenue} onChange={(otherRevenue) => setMeetingForm({ ...meetingForm, otherRevenue })} moneyFormat />
              <div className="sm:col-span-2">
                <Label className={`text-xs font-semibold uppercase tracking-[0.12em] ${C.label}`}>Notes</Label>
                <Textarea className={`mt-1 min-h-[90px] ${C.field}`} value={meetingForm.notes} onChange={(event) => setMeetingForm({ ...meetingForm, notes: event.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#d7c8b5] px-6 py-4">
              <Button variant="outline" className={C.outline} onClick={() => setMeetingModalOpen(false)}>Cancel</Button>
              <Button className={C.green} onClick={saveMeetingProduction} disabled={!meetingForm.month}>Save Meeting Space</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
