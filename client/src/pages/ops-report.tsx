import { useEffect, useMemo, useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, LockKeyhole, LogOut, Trash2, Upload } from "lucide-react";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const C = {
  page: "min-h-screen bg-[#f3efe7] text-[#201814]",
  shell: "!border-[#d7c8b5] !bg-[#fffaf2] !bg-none !text-[#201814] shadow-[0_18px_45px_rgba(72,52,31,0.10)]",
  darkShell: "!border-[#4a5360] !bg-[#202833] !bg-none !text-white shadow-[0_18px_45px_rgba(31,24,18,0.18)]",
  section: "!border-[#d7c8b5] !bg-white !bg-none !text-[#201814]",
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
  menu: "!border-[#cdbda8] !bg-white !text-[#201814]",
};

type OpsAccess = { unlocked: boolean; user: { employeeDisplayName: string; email: string; isAdmin: boolean } | null; hasPin?: boolean; passwordChangeRequired?: boolean };
type Row = Record<string, string>;
type LaborHoursBreakdown = Record<string, Array<{ label: string; hours: number }>>;
type LaborWageEstimate = {
  scheduledHours: number;
  scheduledHourlyHours: number;
  scheduledWages: number;
  scheduledWagesIncludingSalary: number;
  blendedHourlyRate: number;
  blendedRateIncludingSalary: number;
};
type LaborHoursResponse = {
  weekStart: string;
  scheduleId?: string | null;
  departments: Record<string, number>;
  breakdown?: LaborHoursBreakdown;
  wageEstimates?: Record<string, LaborWageEstimate>;
};
type OpsImportResponse = {
  uploadId: string;
  originalFileName: string;
  sourceFileName: string;
  reportType: "previous_week_otb" | "current_month_otb" | "remaining_month_otb" | "next_month_otb" | "current_month_sdly_otb" | "next_month_sdly_otb" | "analytical_account_tracking" | "detailed_flash" | "ooo_rooms" | "gss_scores" | "marriott_responses" | "ar_aging" | "credit_limit" | "unknown";
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
type MonthlySummaryAccount = { name: string; roomNights: string };
type MonthlySummaryForm = {
  reportMonth: string;
  presentedTo: string;
  hotelName: string;
  generalManager: string;
  issuedBy: string;
  issueDate: string;
  occupancyRate: string;
  occupancyComparison: string;
  adr: string;
  adrComparison: string;
  revpar: string;
  revparComparison: string;
  totalRevenue: string;
  totalRevenueComparison: string;
  guestSatisfaction: string;
  increasedOccupancy: string;
  enhancedGuestExperience: string;
  staffPerformance: string;
  seasonalVariability: string;
  operationalCosts: string;
  marketingStrategies: string;
  costManagement: string;
  guestEngagement: string;
  forecastComment: string;
  forecastKeyDrivers: string;
  risksAndChallenges: string;
  opportunitiesForGrowth: string;
  currentRoomNights: string;
  currentAccountRevenue: string;
  previousRoomNights: string;
  roomNightVariance: string;
  previousAccountRevenue: string;
  accountRevenueVariance: string;
  corporateAccounts: MonthlySummaryAccount[];
  groups: MonthlySummaryAccount[];
  salesNotes: string[];
};
type MonthlySummaryResponse = {
  summary: null | { id: string; reportMonth: string; payload: MonthlySummaryForm; updatedAt: string };
};
type ReportGuideItem = {
  name: string;
  scope: string;
  parameters: string;
  fileName: string;
};

const REPORT_TYPE_LABELS: Record<OpsImportResponse["reportType"], string> = {
  previous_week_otb: "Previous Week OTB",
  current_month_otb: "Current Month OTB",
  remaining_month_otb: "Remaining Month OTB",
  next_month_otb: "Next Month OTB",
  current_month_sdly_otb: "Current Month SDLY OTB",
  next_month_sdly_otb: "Next Month SDLY OTB",
  analytical_account_tracking: "MTD / YTD Account Tracking",
  detailed_flash: "Detailed Flash",
  ooo_rooms: "OOO Rooms",
  gss_scores: "GSS Scores",
  marriott_responses: "Marriott Responses",
  ar_aging: "AR Aging",
  credit_limit: "Credit Limit / Guest Ledger",
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

const DEFAULT_OPS_TOTAL_ROOMS = 118;

function interpolateHours(value: number, minValue: number, maxValue: number, minHours: number, maxHours: number) {
  if (value <= minValue) return minHours;
  if (value >= maxValue) return maxHours;
  return minHours + ((value - minValue) / (maxValue - minValue)) * (maxHours - minHours);
}

function bistroBudgetHoursForOccupancy(occupancyPercent: number) {
  if (occupancyPercent <= 50) return interpolateHours(occupancyPercent, 40, 50, 100, 110);
  if (occupancyPercent <= 65) return interpolateHours(occupancyPercent, 51, 65, 111, 119);
  return interpolateHours(occupancyPercent, 66, 100, 120, 130);
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
  remaining_month_otb: ["monthRows"],
  next_month_otb: ["nextMonthRows"],
  current_month_sdly_otb: ["monthRows"],
  next_month_sdly_otb: ["nextMonthRows"],
  analytical_account_tracking: ["topMetrics"],
  detailed_flash: ["topMetrics", "monthRows", "monthlyBudgets"],
  ooo_rooms: ["oooRooms"],
  gss_scores: ["gssRows", "gssWaveRows"],
  marriott_responses: ["positiveReviews", "negativeReviews"],
  ar_aging: ["ar"],
  credit_limit: ["ledger", "ledgerExceptions"],
  unknown: [],
};

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function captureReportPatch(payload: Record<string, any>, reportType: OpsImportResponse["reportType"]) {
  return Object.fromEntries(REPORT_PAYLOAD_KEYS[reportType].map((key) => [key, cloneValue(payload[key])]));
}

function compactReportMapping(reportType: OpsImportResponse["reportType"], mapping: Record<string, any>) {
  if (["previous_week_otb", "current_month_otb", "remaining_month_otb", "next_month_otb", "current_month_sdly_otb", "next_month_sdly_otb"].includes(reportType)) {
    return {
      dateStart: mapping.dateStart,
      dateEnd: mapping.dateEnd,
      businessDate: mapping.businessDate,
      reportRunDate: mapping.reportRunDate,
      total: mapping.total,
      mtd: mapping.mtd ? { dateStart: mapping.mtd.dateStart, dateEnd: mapping.mtd.dateEnd, total: mapping.mtd.total } : undefined,
      remainingMonth: mapping.remainingMonth ? { dateStart: mapping.remainingMonth.dateStart, dateEnd: mapping.remainingMonth.dateEnd, total: mapping.remainingMonth.total } : undefined,
    };
  }
  if (reportType === "detailed_flash") return { mtd: mapping.mtd, ytd: mapping.ytd };
  if (reportType === "analytical_account_tracking") return {
    period: mapping.period,
    comparison: mapping.comparison,
    dateStart: mapping.dateStart,
    dateEnd: mapping.dateEnd,
    roomRevenue: mapping.roomRevenue,
    roomNights: mapping.roomNights,
    adr: mapping.adr,
  };
  if (reportType === "ooo_rooms") return { rooms: mapping.rooms, reportRange: mapping.reportRange };
  if (reportType === "gss_scores") return { gssRows: mapping.gssRows, gssWaveRows: mapping.gssWaveRows };
  if (reportType === "marriott_responses") return { positiveReviews: mapping.positiveReviews, negativeReviews: mapping.negativeReviews };
  if (reportType === "ar_aging") return { summary: mapping.summary };
  if (reportType === "credit_limit") return { entries: mapping.entries, summary: mapping.summary };
  return {};
}

function compactUploadedReport(report: OpsImportResponse & { beforePatch?: Record<string, any> }) {
  return {
    ...report,
    preview: [],
    mapping: compactReportMapping(report.reportType, report.mapping || {}),
  };
}

function fillRows(rows: Row[], count = 5) {
  return [...rows, ...emptyRows(Math.max(0, count - rows.length), ["source", "score", "comment"])].slice(0, count);
}

function applyOpsReportToPayload(payload: Record<string, any>, report: OpsImportResponse) {
  const next = cloneValue(payload);
  const mapping = report.mapping || {};
  const reportMonth = String(report.reportMonth || monthKeyFromDate(report.weekStartDate || ""));
  const mappingMonth = monthKeyFromDate(String(mapping.dateStart || ""));
  const isRemainingMonthFile = /remaining[\s_-]*month[\s_-]*otb/i.test(String(report.originalFileName || report.sourceFileName || ""));
  const resolvedReportType = report.reportType === "current_month_sdly_otb"
    ? "current_month_sdly_otb"
    : report.reportType === "next_month_sdly_otb"
    ? "next_month_sdly_otb"
    : report.reportType === "remaining_month_otb" || isRemainingMonthFile
    ? "remaining_month_otb"
    : mapping.total && mappingMonth === nextMonthKey(reportMonth)
    ? "next_month_otb"
    : mapping.total && mappingMonth === reportMonth && (mapping.daily?.length || 0) > 10
      ? "current_month_otb"
      : report.reportType;
  if (resolvedReportType === "previous_week_otb") {
    const total = mapping.total || {};
    next.topMetrics = {
      ...next.topMetrics,
      occupancy: percentDisplay(total.occupancy),
      roomsSold: rowValue(total.roomsSold, 0),
      roomRevenue: accounting(total.roomRevenue),
    };
  }
  if (resolvedReportType === "current_month_otb") {
    const mtd = mapping.mtd?.dateStart ? mapping.mtd : null;
    const remainingMonth = mapping.remainingMonth?.dateStart ? mapping.remainingMonth : null;
    const total = mapping.total || {};
    next.monthRows = (next.monthRows || []).map((row: Row) => {
      const label = String(row.label || "").toUpperCase();
      const source = label === "MONTH TO DATE" && mtd
        ? { total: mtd.total || {}, comments: `MTD OTB ${mtd.dateStart} to ${mtd.dateEnd}` }
        : label === "FUTURE BOOKED" && remainingMonth
          ? { total: remainingMonth.total || {}, comments: `Remaining month OTB ${remainingMonth.dateStart} to ${remainingMonth.dateEnd}` }
          : label === "MONTHLY TOTAL"
            ? { total, comments: `Imported ${mapping.dateStart} to ${mapping.dateEnd}` }
            : null;
      if (!source) return row;
      return {
        ...row,
        occupancy: percentDisplay(source.total.occupancy),
        rooms: rowValue(source.total.roomsSold, 0),
        adr: accounting(source.total.adr),
        revenue: accounting(source.total.roomRevenue),
        availableRoomNights: rowValue(source.total.roomsActive || source.total.roomsAvailable, 0),
        comments: source.comments,
      };
    });
    next.monthlyBudgets = mergeMonthlyActualFromOtb(next.monthlyBudgets || [], mapping);
  }
  if (resolvedReportType === "remaining_month_otb") {
    const total = mapping.total || {};
    next.monthRows = (next.monthRows || []).map((row: Row) => {
      if (String(row.label || "").trim().toUpperCase() !== "FUTURE BOOKED") return row;
      return {
        ...row,
        occupancy: percentDisplay(total.occupancy),
        rooms: rowValue(total.roomsSold, 0),
        adr: accounting(total.adr),
        revenue: accounting(total.roomRevenue),
        availableRoomNights: rowValue(total.roomsActive || total.roomsAvailable, 0),
        comments: `Remaining month OTB ${mapping.dateStart} to ${mapping.dateEnd}`,
      };
    });
  }
  if (resolvedReportType === "next_month_otb") {
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
  if (resolvedReportType === "next_month_sdly_otb") {
    const total = mapping.total || {};
    next.nextMonthRows = normalizeNextMonthRows(next.nextMonthRows || []).map((row: Row) => {
      if (String(row.label || "").toUpperCase() !== "SDLY OTB FOR NEXT MONTH") return row;
      return {
        ...row,
        occupancy: percentDisplay(total.occupancy),
        rooms: rowValue(total.roomsSold, 0),
        adr: accounting(total.adr),
        revenue: accounting(total.roomRevenue),
        comments: `SDLY pacing as of ${mapping.reportRunDate || "uploaded snapshot"} for ${mapping.dateStart} to ${mapping.dateEnd}`,
      };
    });
  }
  if (resolvedReportType === "current_month_sdly_otb") {
    const total = mapping.total || {};
    next.monthRows = normalizeCurrentMonthRows(next.monthRows || []).map((row: Row) => {
      if (String(row.label || "").toUpperCase() !== "SDLY OTB FOR CURRENT MONTH") return row;
      return {
        ...row,
        occupancy: percentDisplay(total.occupancy),
        rooms: rowValue(total.roomsSold, 0),
        adr: accounting(total.adr),
        revenue: accounting(total.roomRevenue),
        comments: `SDLY pacing as of ${mapping.reportRunDate || "uploaded snapshot"} for ${mapping.dateStart} to ${mapping.dateEnd}`,
      };
    });
  }
  if (report.reportType === "analytical_account_tracking" && mapping.comparison === "last_year") {
    next.topMetrics = {
      ...next.topMetrics,
      ...(mapping.period === "mtd" ? { mtdLastYear: accounting(mapping.roomRevenue) } : {}),
      ...(mapping.period === "ytd" ? { ytdLastYear: accounting(mapping.roomRevenue) } : {}),
    };
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
      ? { ...row, occupancy: percentDisplay(mtd.occupancy), rooms: rowValue(mtd.roomsSold, 0), adr: accounting(mtd.adr), revenue: accounting(mtd.roomRevenue), availableRoomNights: rowValue(mtd.availableRooms, 0), comments: "Detailed Flash MTD" }
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
  if (report.reportType === "credit_limit") {
    const summary = mapping.summary || {};
    next.ledger = {
      balance: accounting(summary.totalProjected),
      over1000: accounting(summary.over1000Balance),
      uncovered: accounting(summary.totalUncovered),
      comment: `${summary.over1000Count || 0} over $1,000; ${summary.noAuthCount || 0} with zero/no card authorization; ${summary.exceptionCount || 0} listed`,
    };
    next.ledgerExceptions = (mapping.entries || []).map((entry: Record<string, any>, index: number) => ({
      no: String(index + 1),
      room: String(entry.room || ""),
      guest: String(entry.guest || ""),
      paymentMethod: String(entry.paymentMethod || ""),
      projected: accounting(entry.projected),
      authAmount: accounting(entry.authAmount),
      uncovered: accounting(entry.uncovered),
      action: String(entry.action || ""),
    }));
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

function localDateIso(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKeyFromDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function nextMonthKey(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return "";
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
}

function priorYearMonthKey(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return "";
  return `${year - 1}-${String(month).padStart(2, "0")}`;
}

const NEXT_MONTH_ROW_LABELS = [
  "FUTURE BOOKED FOR NEXT MONTH",
  "NEXT MONTH BUDGET",
  "VARIANCE TO BUDGET",
  "SDLY OTB FOR NEXT MONTH",
  "PACING VARIANCE TO LY",
] as const;

const CURRENT_MONTH_ROW_LABELS = [
  "MONTH TO DATE",
  "FUTURE BOOKED",
  "MONTHLY TOTAL",
  "CURRENT MONTH BUDGET",
  "VARIANCE TO BUDGET",
  "SDLY OTB FOR CURRENT MONTH",
  "PACING VARIANCE TO LY",
  "LY SAME MONTH",
  "VARIANCE TO LY",
] as const;

function normalizeCurrentMonthRows(rows: Row[]) {
  const byLabel = new Map(rows.map((row) => [String(row.label || "").trim().toUpperCase(), row]));
  const legacyVariance = byLabel.get("VARIANCE");
  return CURRENT_MONTH_ROW_LABELS.map((label) => {
    const existing = byLabel.get(label) || (label === "VARIANCE TO BUDGET" ? legacyVariance : undefined);
    return { occupancy: "", rooms: "", adr: "", revenue: "", comments: "", ...existing, label };
  });
}

function normalizeNextMonthRows(rows: Row[]) {
  const byLabel = new Map(rows.map((row) => [String(row.label || "").trim().toUpperCase(), row]));
  const legacyVariance = byLabel.get("VARIANCE");
  return NEXT_MONTH_ROW_LABELS.map((label) => {
    const existing = byLabel.get(label) || (label === "VARIANCE TO BUDGET" ? legacyVariance : undefined);
    return { occupancy: "", rooms: "", adr: "", revenue: "", comments: "", ...existing, label };
  });
}

function normalizeOpsImportReport(report: OpsImportResponse) {
  const mappingMonth = monthKeyFromDate(String(report.mapping?.dateStart || ""));
  const comparisonMonth = priorYearMonthKey(nextMonthKey(String(report.reportMonth || "")));
  return mappingMonth && comparisonMonth && mappingMonth === comparisonMonth
    ? { ...report, reportType: "next_month_sdly_otb" as const }
    : report;
}

function monthLabelFromKey(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function displayOpsDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || "selected date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function priorMonthKey() {
  const now = new Date();
  return `${new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7)}`;
}

function blankMonthlySummary(reportMonth: string, propertyName: string, generalManager: string): MonthlySummaryForm {
  return {
    reportMonth,
    presentedTo: "Globiwest Hospitality - Corporate Office",
    hotelName: propertyName || "Courtyard Austin Lakeline",
    generalManager,
    issuedBy: `${propertyName || "Courtyard Austin Lakeline"}${generalManager ? ` & ${generalManager}` : ""}`,
    issueDate: new Date().toISOString().slice(0, 10),
    occupancyRate: "",
    occupancyComparison: "",
    adr: "",
    adrComparison: "",
    revpar: "",
    revparComparison: "",
    totalRevenue: "",
    totalRevenueComparison: "",
    guestSatisfaction: "",
    increasedOccupancy: "",
    enhancedGuestExperience: "",
    staffPerformance: "",
    seasonalVariability: "",
    operationalCosts: "",
    marketingStrategies: "",
    costManagement: "",
    guestEngagement: "",
    forecastComment: "",
    forecastKeyDrivers: "",
    risksAndChallenges: "",
    opportunitiesForGrowth: "",
    currentRoomNights: "",
    currentAccountRevenue: "",
    previousRoomNights: "",
    roomNightVariance: "",
    previousAccountRevenue: "",
    accountRevenueVariance: "",
    corporateAccounts: Array.from({ length: 10 }, () => ({ name: "", roomNights: "" })),
    groups: Array.from({ length: 10 }, () => ({ name: "", roomNights: "" })),
    salesNotes: Array.from({ length: 4 }, () => ""),
  };
}

function LabeledInput({ label, value, onChange, type = "text", moneyFormat = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; moneyFormat?: boolean }) {
  return (
    <div>
      <Label className={`text-xs font-semibold uppercase tracking-[0.12em] ${C.label}`}>{label}</Label>
      <Input className={`mt-1 ${C.field}`} type={type} inputMode={type === "number" ? "numeric" : undefined} value={value} onChange={(event) => onChange(event.target.value)} onBlur={() => moneyFormat && onChange(accounting(value))} />
    </div>
  );
}

function DarkLabeledInput({ label, value, onChange, type = "text", moneyFormat = false, readOnly = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; moneyFormat?: boolean; readOnly?: boolean }) {
  return (
    <div>
      <Label className={`text-xs font-semibold uppercase tracking-[0.12em] ${C.darkLabel}`}>{label}</Label>
      <Input className={`mt-1 ${C.darkField}`} type={type} inputMode={type === "number" ? "numeric" : undefined} value={value} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} onBlur={() => moneyFormat && onChange(accounting(value))} />
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

function SectionReportUpload({
  reports,
  onUpload,
  uploading,
  multiple = false,
  compact = false,
}: {
  reports: ReportGuideItem[];
  onUpload: (files: File[]) => void;
  uploading: boolean;
  multiple?: boolean;
  compact?: boolean;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadContent = (
    <>
      <div className="grid gap-2 lg:grid-cols-2">
        {reports.map((report) => (
          <div key={report.name} className="rounded-lg border border-[#d7c8b5] bg-white p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="font-semibold text-[#201814]">{report.name}</div>
              <Badge variant="outline" className="border-[#cdbda8] bg-[#fffaf2] text-[#4f3d2e]">{report.scope}</Badge>
            </div>
            <p className="mt-2 leading-5 text-[#5f5247]">{report.parameters}</p>
            <div className="mt-2 break-all rounded bg-[#fbf6ee] px-2 py-1 font-mono text-xs text-[#4f3d2e]">{report.fileName}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          ref={inputRef}
          className={C.field}
          type="file"
          accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          multiple={multiple}
          onChange={(event) => setFiles(Array.from(event.target.files || []))}
        />
        <Button
          className={`${C.green} shrink-0`}
          disabled={!files.length || uploading}
          onClick={() => {
            onUpload(files);
            setFiles([]);
            setDialogOpen(false);
            if (inputRef.current) inputRef.current.value = "";
          }}
        >
          {uploading ? "Importing..." : `Import ${files.length > 1 ? `${files.length} files` : "report"}`}
        </Button>
      </div>
    </>
  );
  if (compact) {
    return (
      <>
        <Button variant="outline" className="border-[#728090] bg-[#2b3542] text-white hover:bg-[#354252] hover:text-white" onClick={() => setDialogOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />Upload reports
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-[#d7c8b5] bg-[#fbf6ee] text-[#201814]">
            <DialogHeader>
              <DialogTitle>Upload Weekly Source Reports</DialogTitle>
              <DialogDescription className={C.muted}>Select the reports used for weekly performance, MTD, and YTD figures.</DialogDescription>
            </DialogHeader>
            {uploadContent}
          </DialogContent>
        </Dialog>
      </>
    );
  }
  return (
    <div className="border-b border-[#e0d3c1] bg-[#fbf6ee] p-3">
      <Accordion type="single" collapsible>
        <AccordionItem value="requirements" className="border-0">
          <AccordionTrigger className="py-1.5 text-sm font-semibold text-[#201814] hover:no-underline [&>svg]:text-[#5b4b3b]">
            <span className="flex items-center gap-2"><Upload className="h-4 w-4 text-[#2f5f46]" />Upload source report</span>
          </AccordionTrigger>
          <AccordionContent className="pb-2 pt-2">
            {uploadContent}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
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

function EditableTable({
  columns,
  rows,
  onChange,
  getCellPreview,
}: {
  columns: Array<{ key: string; label: string; wide?: boolean; readOnly?: boolean }>;
  rows: Row[];
  onChange: (rows: Row[]) => void;
  getCellPreview?: (row: Row, column: { key: string; label: string; wide?: boolean; readOnly?: boolean }) => { label: string; text: string } | null;
}) {
  const [preview, setPreview] = useState<{ label: string; text: string; x: number; y: number } | null>(null);
  const showPreview = (event: MouseEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>, row: Row, column: { key: string; label: string; wide?: boolean; readOnly?: boolean }) => {
    const customPreview = getCellPreview?.(row, column);
    const text = customPreview?.text || String(row[column.key] || "").trim();
    const label = customPreview?.label || column.label;
    if (!customPreview && (!isLongTextColumn(column.key, column.label) || !text)) return;
    if (!text) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPreview({ label, text, x: Math.min(rect.left, window.innerWidth - 460), y: rect.bottom + 8 });
  };
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
            <tr key={rowIndex} className={`${row.__readOnly === "true" ? "bg-[#e8f0e9] font-semibold" : "odd:bg-white even:bg-[#fbf6ee]"}`}>
              {columns.map((column) => (
                <td key={column.key} className="border border-[#e0d3c1] p-1 align-top">
                  <Input
                    readOnly={row.__readOnly === "true" || column.readOnly || column.key === "priorWeek" || column.key === "weekVariance"}
                    className={`h-9 border-transparent bg-transparent px-2 text-sm font-medium text-[#201814] placeholder:text-[#7c6e61] focus:border-[#b98435] focus:bg-white ${row.__readOnly === "true" || column.readOnly || column.key === "priorWeek" || column.key === "weekVariance" ? "!bg-[#f3efe7] !text-[#5f5247]" : ""}`}
                    value={row[column.key] || ""}
                    onMouseEnter={(event) => showPreview(event, row, column)}
                    onMouseLeave={() => setPreview(null)}
                    onFocus={(event) => showPreview(event, row, column)}
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
                      if (row.__readOnly === "true" || column.readOnly || column.key === "priorWeek" || column.key === "weekVariance") return;
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
  const [setup, setSetup] = useState({ propertyName: "Courtyard Austin Lakeline", generalManager: "", totalRooms: "" });
  const [topMetrics, setTopMetrics] = useState({ weekStart: "2026-01-03", occupancy: "", roomsSold: "", roomRevenue: "", mtdThisYear: "", mtdLastYear: "", ytdThisYear: "", ytdLastYear: "" });
  const [monthRows, setMonthRows] = useState<Row[]>([
    { label: "MONTH TO DATE", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "FUTURE BOOKED", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "MONTHLY TOTAL", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "CURRENT MONTH BUDGET", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "VARIANCE TO BUDGET", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "SDLY OTB FOR CURRENT MONTH", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "PACING VARIANCE TO LY", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "LY SAME MONTH", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "VARIANCE TO LY", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
  ]);
  const [nextMonthRows, setNextMonthRows] = useState<Row[]>([
    { label: "FUTURE BOOKED FOR NEXT MONTH", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "NEXT MONTH BUDGET", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "VARIANCE TO BUDGET", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "SDLY OTB FOR NEXT MONTH", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    { label: "PACING VARIANCE TO LY", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
  ]);
  const [chargebacks, setChargebacks] = useState<Row[]>(emptyRows(5, ["no", "reason", "respondDate", "amount", "comment"]));
  const [maintenance, setMaintenance] = useState<Row[]>(emptyRows(5, ["no", "rooms", "area", "hours", "comment"]));
  const [oooRooms, setOooRooms] = useState<Row[]>(emptyRows(5, ["no", "room", "startDate", "returnDate", "comment"]));
  const [adjustments, setAdjustments] = useState<Row[]>(emptyRows(5, ["no", "room", "guest", "amount", "comment"]));
  const [ar, setAr] = useState({ current: "", d30: "", d60: "", d90: "", comments: "" });
  const [ledger, setLedger] = useState({ balance: "", over1000: "", uncovered: "", comment: "" });
  const [ledgerExceptions, setLedgerExceptions] = useState<Row[]>([]);
  const [labor, setLabor] = useState<Row[]>([
    { department: "FRONT DESK / NIGHT AUDIT HOURS", scheduledHours: "", actualHours: "", budget: "168", comments: "112 FD + 56 Night Audit" },
    { department: "HOUSEKEEPING HOURS", scheduledHours: "", actualHours: "", budget: "45", comments: "" },
    { department: "BREAKFAST / BISTRO HOURS", scheduledHours: "", actualHours: "", budget: "41", comments: "" },
    { department: "MAINTENANCE HOURS", scheduledHours: "", actualHours: "", budget: "56", comments: "" },
    { department: "OTHER", scheduledHours: "", actualHours: "", budget: "5", comments: "" },
  ]);
  const [laborFile, setLaborFile] = useState<File | null>(null);
  const [uploadedReports, setUploadedReports] = useState<Array<Record<string, any>>>([]);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [bistroModalOpen, setBistroModalOpen] = useState(false);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [summaryMonthKey, setSummaryMonthKey] = useState(monthKeyFromDate(new Date().toISOString().slice(0, 10)));
  const [monthlyReviewOpen, setMonthlyReviewOpen] = useState(false);
  const [monthlyReviewMonth, setMonthlyReviewMonth] = useState(priorMonthKey());
  const [monthlyReviewHydrated, setMonthlyReviewHydrated] = useState(false);
  const [monthlyReviewSavedAt, setMonthlyReviewSavedAt] = useState("");
  const [monthlyReviewForm, setMonthlyReviewForm] = useState<MonthlySummaryForm>(() => blankMonthlySummary(
    priorMonthKey(),
    "Courtyard Austin Lakeline",
    "",
  ));
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
  const monthlyReview = useQuery<MonthlySummaryResponse>({
    queryKey: ["/api/opsreport/monthly-summary", monthlyReviewMonth],
    enabled: Boolean(access.data?.unlocked && monthlyReviewMonth),
    queryFn: async () => {
      const response = await fetch(apiUrl(`/api/opsreport/monthly-summary/${monthlyReviewMonth}`), { credentials: "include" });
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
    mutationFn: async ({ files }: { files: File[]; sourceLabel: string }) => {
      const form = new FormData();
      files.forEach((file) => form.append("opsReport", file));
      form.append("weekStart", topMetrics.weekStart);
      form.append("weekEnd", weekEnd);
      form.append("reportMonth", monthKeyFromDate(weekEnd || topMetrics.weekStart));
      form.append("businessDate", localDateIso());
      form.append("totalRooms", setup.totalRooms);
      const response = await fetch(apiUrl("/api/opsreport/import"), { method: "POST", credentials: "include", body: form });
      if (!response.ok) throw new Error(await response.text());
      return response.json() as Promise<OpsImportBatchResponse>;
    },
    onSuccess: (data, variables) => {
      let nextPayload: Record<string, any> = cloneValue(currentDraftPayload);
      const reports = data.reports.map((rawReport) => {
        const report = normalizeOpsImportReport(rawReport);
        const beforePatch = captureReportPatch(nextPayload, report.reportType);
        if (report.status !== "failed") nextPayload = applyOpsReportToPayload(nextPayload, report);
        return compactUploadedReport({ ...report, beforePatch });
      });
      applyPayloadState(nextPayload);
      setUploadedReports((current) => [...current, ...reports]);
      const warnings = reports.reduce((total, report) => total + report.warnings.length, 0);
      const failed = reports.filter((report) => report.status === "failed").length;
      toast({
        title: `${variables.sourceLabel} source imported`,
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
  const saveMonthlyReview = useMutation({
    mutationFn: async (payload: MonthlySummaryForm) => {
      const response = await apiRequest("POST", "/api/opsreport/monthly-summary", {
        reportMonth: payload.reportMonth,
        payload,
      });
      return response.json() as Promise<MonthlySummaryResponse>;
    },
    onSuccess: (data) => {
      setMonthlyReviewSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      queryClient.setQueryData(["/api/opsreport/monthly-summary", monthlyReviewMonth], data);
    },
    onError: (error: Error) => toast({ title: "Unable to save monthly performance review", description: error.message, variant: "destructive" }),
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
  const mtdVariance = num(topMetrics.mtdThisYear) - num(topMetrics.mtdLastYear);
  const ytdVariance = num(topMetrics.ytdThisYear) - num(topMetrics.ytdLastYear);
  const mtdVariancePercent = num(topMetrics.mtdLastYear)
    ? mtdVariance / Math.abs(num(topMetrics.mtdLastYear)) * 100
    : null;
  const ytdVariancePercent = num(topMetrics.ytdLastYear)
    ? ytdVariance / Math.abs(num(topMetrics.ytdLastYear)) * 100
    : null;
  const effectiveLabor = useMemo<Row[]>(() => labor.map((row): Row => {
    const department = String(row.department || "").trim().toUpperCase();
    if (department === "BREAKFAST / BISTRO HOURS") {
      const occupancy = num(topMetrics.occupancy);
      const totalRooms = num(setup.totalRooms) || DEFAULT_OPS_TOTAL_ROOMS;
      const roomsSold = num(topMetrics.roomsSold);
      const occupancyPercent = occupancy > 0 ? occupancy : totalRooms > 0 && roomsSold > 0 ? roomsSold / totalRooms * 100 : 0;
      return {
        ...row,
        budget: occupancyPercent > 0 ? fmtHours(bistroBudgetHoursForOccupancy(occupancyPercent)) : row.budget,
        calculatedMpor: "",
        targetMpor: "",
        mporVariance: "",
      };
    }
    if (department !== "HOUSEKEEPING HOURS") {
      return { ...row, calculatedMpor: "", targetMpor: "", mporVariance: "" };
    }
    const roomsSold = num(topMetrics.roomsSold);
    const budgetHours = roomsSold * 30 / 60;
    const hasActualHours = String(row.actualHours || "").trim() !== "";
    const actualMpor = roomsSold > 0 && hasActualHours ? num(row.actualHours) * 60 / roomsSold : null;
    const mporVariance = actualMpor == null ? null : actualMpor - 30;
    return {
      ...row,
      budget: fmtHours(budgetHours),
      calculatedMpor: actualMpor == null ? "" : actualMpor.toFixed(1),
      targetMpor: "30.0",
      mporVariance: mporVariance == null ? "" : `${mporVariance > 0 ? "+" : ""}${mporVariance.toFixed(1)}`,
    };
  }), [labor, setup.totalRooms, topMetrics.occupancy, topMetrics.roomsSold]);
  const scheduledLaborTotal = useMemo(() => effectiveLabor.reduce((sum, row) => sum + num(row.scheduledHours), 0), [effectiveLabor]);
  const actualLaborTotal = useMemo(() => effectiveLabor.reduce((sum, row) => sum + num(row.actualHours), 0), [effectiveLabor]);
  const laborTotal = actualLaborTotal || scheduledLaborTotal;
  const laborBudget = useMemo(() => effectiveLabor.reduce((sum, row) => sum + num(row.budget), 0), [effectiveLabor]);
  const laborVariance = actualLaborTotal ? actualLaborTotal - laborBudget : 0;
  const laborRows = useMemo(() => {
    const rows: Row[] = effectiveLabor.map((row): Row => ({
      ...(() => {
        const department = String(row.department || "").trim();
        const estimate = scheduledLabor.data?.wageEstimates?.[department];
        const actualHours = num(row.actualHours);
        const hasActualHours = String(row.actualHours || "").trim() !== "";
        return {
          ...row,
          estimatedActualWages: hasActualHours && estimate ? money(actualHours * estimate.blendedHourlyRate) : "",
          estimatedActualWagesWithSalary: hasActualHours && estimate ? money(actualHours * estimate.blendedRateIncludingSalary) : "",
        };
      })(),
      variance: String(row.actualHours || "").trim() !== "" && String(row.budget || "").trim() !== ""
        ? fmtHours(num(row.actualHours) - num(row.budget))
        : "",
    }));
    const scheduledTotal = rows.reduce((sum, row) => sum + num(row.scheduledHours), 0);
    const actualTotal = rows.reduce((sum, row) => sum + num(row.actualHours), 0);
    const budgetTotal = rows.reduce((sum, row) => sum + num(row.budget), 0);
    const estimatedActualWagesTotal = rows.reduce((sum, row) => sum + num(row.estimatedActualWages), 0);
    const estimatedActualWagesWithSalaryTotal = rows.reduce((sum, row) => sum + num(row.estimatedActualWagesWithSalary), 0);
    const hasActual = rows.some((row) => String(row.actualHours || "").trim() !== "");
    return [
      ...rows,
      {
        __readOnly: "true",
        department: "TOTAL",
        scheduledHours: fmtHours(scheduledTotal),
        actualHours: hasActual ? fmtHours(actualTotal) : "",
        budget: fmtHours(budgetTotal),
        variance: hasActual ? fmtHours(actualTotal - budgetTotal) : "",
        estimatedActualWages: hasActual ? money(estimatedActualWagesTotal) : "",
        estimatedActualWagesWithSalary: hasActual ? money(estimatedActualWagesWithSalaryTotal) : "",
        calculatedMpor: "",
        targetMpor: "",
        mporVariance: "",
        comments: "Calculated total",
      },
    ];
  }, [effectiveLabor, scheduledLabor.data?.wageEstimates]);
  const laborDepartmentPreview = useMemo(() => {
    const breakdown = scheduledLabor.data?.breakdown || {};
    return (row: Row, column: { key: string; label: string }) => {
      if (column.key !== "department") return null;
      const department = String(row.department || "").trim();
      const items = breakdown[department] || [];
      if (!items.length) return null;
      const total = items.reduce((sum, item) => sum + num(item.hours), 0);
      const lines = items.map((item) => `${item.label}: ${fmtHours(item.hours)} hrs`);
      const estimate = scheduledLabor.data?.wageEstimates?.[department];
      const wageLines = estimate
        ? [
          "",
          `Blended hourly rate: ${money(estimate.blendedHourlyRate)}/hr`,
          `Blended rate with salary: ${money(estimate.blendedRateIncludingSalary)}/hr`,
        ]
        : [];
      return {
        label: `${department} schedule detail`,
        text: [`Scheduled total: ${fmtHours(total)} hrs`, "", ...lines, ...wageLines].join("\n"),
      };
    };
  }, [scheduledLabor.data?.breakdown, scheduledLabor.data?.wageEstimates]);
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
  const reputationRowsWithVariance = useMemo(() => reputationRows.map((row) => {
    const hasScore = String(row.score || "").trim() !== "";
    const hasGoal = String(row.goal || "").trim() !== "";
    const variance = hasScore && hasGoal ? num(row.score) - num(row.goal) : null;
    return {
      ...row,
      variance: variance == null ? "" : `${variance > 0 ? "+" : ""}${rowValue(variance, 2)}`,
    };
  }), [reputationRows]);
  const currentMonthKey = useMemo(() => monthKeyFromDate(topMetrics.weekStart), [topMetrics.weekStart]);
  useEffect(() => {
    setMonthlyReviewHydrated(false);
  }, [monthlyReviewMonth]);

  useEffect(() => {
    if (!access.data?.unlocked || monthlyReview.isLoading || monthlyReviewHydrated) return;
    const saved = monthlyReview.data?.summary?.payload;
    if (saved) {
      setMonthlyReviewForm({
        ...blankMonthlySummary(monthlyReviewMonth, setup.propertyName, setup.generalManager),
        ...saved,
        reportMonth: monthlyReviewMonth,
        corporateAccounts: Array.from({ length: 10 }, (_, index) => saved.corporateAccounts?.[index] || { name: "", roomNights: "" }),
        groups: Array.from({ length: 10 }, (_, index) => saved.groups?.[index] || { name: "", roomNights: "" }),
        salesNotes: Array.from({ length: 4 }, (_, index) => saved.salesNotes?.[index] || ""),
      });
      setMonthlyReviewSavedAt(new Date(monthlyReview.data!.summary!.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    } else {
      const next = blankMonthlySummary(monthlyReviewMonth, setup.propertyName, setup.generalManager);
      const budget = monthlyBudgets.find((row) => row.month === monthlyReviewMonth);
      const occupancy = budget?.actualOccupancy || "";
      const adrValue = budget?.actualAdr || "";
      const revenue = budget?.actualRevenue || "";
      next.occupancyRate = occupancy ? percentDisplay(num(occupancy)) : "";
      next.adr = adrValue ? money(num(adrValue)) : "";
      next.revpar = occupancy && adrValue ? money(num(adrValue) * (num(occupancy) > 1 ? num(occupancy) / 100 : num(occupancy))) : "";
      next.totalRevenue = revenue ? money(num(revenue)) : "";
      next.guestSatisfaction = gssRows.find((row) => row.label === "ITR")?.hotel || "";
      setMonthlyReviewForm(next);
      setMonthlyReviewSavedAt("");
    }
    setMonthlyReviewHydrated(true);
  }, [
    access.data?.unlocked,
    monthlyReview.data,
    monthlyReview.isLoading,
    monthlyReviewHydrated,
    monthlyReviewMonth,
    monthlyBudgets,
    setup.propertyName,
    setup.generalManager,
    gssRows,
  ]);

  useEffect(() => {
    if (!monthlyReviewOpen || !monthlyReviewHydrated || monthlyReviewForm.reportMonth !== monthlyReviewMonth) return;
    const timeout = window.setTimeout(() => saveMonthlyReview.mutate(monthlyReviewForm), 700);
    return () => window.clearTimeout(timeout);
  }, [monthlyReviewOpen, monthlyReviewHydrated, monthlyReviewMonth, monthlyReviewForm]);

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
  const reportMonthKey = monthKeyFromDate(weekEnd || topMetrics.weekStart);
  const followingMonthKey = nextMonthKey(reportMonthKey);
  const reportMonthStart = reportMonthKey ? `${reportMonthKey}-01` : "";
  const followingMonthStart = followingMonthKey ? `${followingMonthKey}-01` : "";
  const reportMonthEnd = reportMonthStart ? addDaysIso(followingMonthStart, -1) : "";
  const followingMonthEnd = followingMonthStart ? addDaysIso(`${nextMonthKey(followingMonthKey)}-01`, -1) : "";
  const reportMonthDays = reportMonthEnd ? Number(reportMonthEnd.slice(-2)) : 0;
  const totalAvailableRooms = num(setup.totalRooms) * reportMonthDays;
  const reportGuide = [
    {
      name: "Previous Week OTB",
      scope: `${displayOpsDate(topMetrics.weekStart)} through ${displayOpsDate(weekEnd)}`,
      parameters: "Run after the selected week closes. Include daily rows plus the TOTAL row for the exact selected report week.",
      fileName: "MMDDYYYY_Previous Week OTB.csv",
    },
    {
      name: "Current Month OTB",
      scope: `${displayOpsDate(reportMonthStart)} through ${displayOpsDate(reportMonthEnd)}`,
      parameters: `Run the full ${monthLabelFromKey(reportMonthKey)} calendar month. Include all daily rows and the TOTAL row. The importer splits this into MTD through yesterday and Remaining Month from today through month end.`,
      fileName: `MMDDYYYY_${monthLabelFromKey(reportMonthKey).split(" ")[0]} Month OTB.csv`,
    },
    {
      name: "Remaining Month OTB",
      scope: `Today through ${displayOpsDate(reportMonthEnd)}`,
      parameters: "Use only future on-the-books dates remaining in the selected report month. This populates Current Month Future Booked.",
      fileName: "MMDDYYYY_Remaining Month OTB.csv",
    },
    {
      name: "Current Month SDLY OTB",
      scope: `${monthLabelFromKey(reportMonthKey)} OTB as of the same reporting date last year`,
      parameters: `Upload a MINT pacing screenshot showing the full ${monthLabelFromKey(reportMonthKey)} Stay Date Range, Grand Total row, and report run timestamp. The importer maps Grand Total STLY rooms, ADR, and room revenue; occupancy is calculated from STLY rooms and the property's available room nights.`,
      fileName: `MMDDYYYY_MINT_${monthLabelFromKey(reportMonthKey).split(" ")[0]}_Pacing.png`,
    },
    {
      name: "Next Month OTB",
      scope: `${displayOpsDate(followingMonthStart)} through ${displayOpsDate(followingMonthEnd)}`,
      parameters: `Run the full ${monthLabelFromKey(followingMonthKey)} calendar month, including the TOTAL row.`,
      fileName: `MMDDYYYY_${monthLabelFromKey(followingMonthKey).split(" ")[0]} Month OTB.csv`,
    },
    {
      name: "Next Month SDLY OTB",
      scope: `${monthLabelFromKey(priorYearMonthKey(followingMonthKey))} OTB as of the same reporting date last year`,
      parameters: `Upload a MINT pacing screenshot showing the full ${monthLabelFromKey(followingMonthKey)} Stay Date Range, Grand Total row, and report run timestamp. The importer maps Grand Total STLY rooms, ADR, and room revenue; occupancy is calculated from STLY rooms and the property's available room nights.`,
      fileName: `MMDDYYYY_MINT_${monthLabelFromKey(followingMonthKey).split(" ")[0]}_Pacing.png`,
    },
    {
      name: "Detailed Flash",
      scope: `Business date within ${monthLabelFromKey(reportMonthKey)}`,
      parameters: "Include Month-to-Date and Year-to-Date columns. Used for rooms sold, occupancy, ADR, room revenue, MTD, and YTD results.",
      fileName: "Detailed Flash_AUSNL_YYYY-MM-DD_HH-MM-SS.csv",
    },
    {
      name: "MTD / YTD Account Tracking",
      scope: `Prior-year MTD and YTD ending on the same calendar date as the current reporting snapshot`,
      parameters: "Export Analytical Account Tracking twice for last year: month start through the matching date, and January 1 through the matching date. Current-year comparison exports may also be uploaded, but they will not replace Detailed Flash current-year totals.",
      fileName: "Analytical Account Tracking - Export.xlsx",
    },
    {
      name: "OOO Rooms",
      scope: `${displayOpsDate(topMetrics.weekStart)} through ${displayOpsDate(weekEnd)}`,
      parameters: "Set the report start and end dates to the exact selected week. Include room number, reason/status, OOO start, and expected return date.",
      fileName: "MMDDYYYY_OOO Rooms.pdf",
    },
    {
      name: "GSS Scores",
      scope: monthLabelFromKey(reportMonthKey),
      parameters: "Use the Satisfaction sheet. The selected month column supplies MTD; the Total column supplies Wave-to-Date.",
      fileName: "MMDDYYYY_GSS Scores.xlsx",
    },
    {
      name: "Marriott Responses",
      scope: `${displayOpsDate(topMetrics.weekStart)} through ${displayOpsDate(weekEnd)}`,
      parameters: "Export responses covering the selected week. The importer filters strictly by Response Date inside this range.",
      fileName: "Marriott_Responses_Export_MM_DD_YYYY.xlsx",
    },
    {
      name: "AR Aging",
      scope: "As of the current business date",
      parameters: "Include Current, 30, 60, 90, and 120+ aging buckets plus total balance and account/customer names where available.",
      fileName: "MMDDYYYY_AR Aging.xlsx",
    },
    {
      name: "Credit Limit / Guest Ledger",
      scope: "As of the current business date",
      parameters: "Include all in-house guest balances and credit-card authorization amounts. Only balances over $1,000 or balances without sufficient authorization are listed.",
      fileName: "MMDDYYYY_CreditLimit.pdf",
    },
    {
      name: "Actual Labor Hours",
      scope: `${displayOpsDate(topMetrics.weekStart)} through ${displayOpsDate(weekEnd)}`,
      parameters: "Run the closed-week payroll labor summary/Hours Detail for the exact selected week. Upload it inside Department Labor Review.",
      fileName: "Closed week labor summary.pdf",
    },
  ];
  const reportGuideFor = (...names: string[]) => reportGuide.filter((report) => names.includes(report.name));
  const uploadSectionReports = (sourceLabel: string, files: File[]) => opsReportUpload.mutate({ files, sourceLabel });
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
      { label: "VARIANCE TO BUDGET", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
      { label: "SDLY OTB FOR CURRENT MONTH", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
      { label: "PACING VARIANCE TO LY", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
      { label: "LY SAME MONTH", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
      { label: "VARIANCE TO LY", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    ]);
    setNextMonthRows([
      { label: "FUTURE BOOKED FOR NEXT MONTH", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
      { label: "NEXT MONTH BUDGET", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
      { label: "VARIANCE TO BUDGET", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
      { label: "SDLY OTB FOR NEXT MONTH", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
      { label: "PACING VARIANCE TO LY", occupancy: "", rooms: "", adr: "", revenue: "", comments: "" },
    ]);
    setChargebacks(emptyRows(5, ["no", "reason", "respondDate", "amount", "comment"]));
    setMaintenance(emptyRows(5, ["no", "rooms", "area", "hours", "comment"]));
    setOooRooms(emptyRows(5, ["no", "room", "startDate", "returnDate", "comment"]));
    setAdjustments(emptyRows(5, ["no", "room", "guest", "amount", "comment"]));
    setAr({ current: "", d30: "", d60: "", d90: "", comments: "" });
    setLedger({ balance: "", over1000: "", uncovered: "", comment: "" });
    setLedgerExceptions([]);
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
    if (payload.monthRows) setMonthRows(normalizeCurrentMonthRows(payload.monthRows));
    if (payload.nextMonthRows) setNextMonthRows(normalizeNextMonthRows(payload.nextMonthRows));
    if (payload.chargebacks) setChargebacks(payload.chargebacks);
    if (payload.maintenance) setMaintenance(payload.maintenance);
    if (payload.oooRooms) setOooRooms(payload.oooRooms);
    if (payload.adjustments) setAdjustments(payload.adjustments);
    if (payload.ar) setAr(payload.ar);
    if (payload.ledger) setLedger(payload.ledger);
    if (payload.ledgerExceptions) setLedgerExceptions(payload.ledgerExceptions);
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
    const currentReports = (loaded.uploadedReports || []).filter((report) => {
      const sourceWeekStart = String(report.weekStartDate || "").trim();
      return !sourceWeekStart || sourceWeekStart === loaded.weekStart;
    });
    setWeek(loaded.weekLabel || "Week 1");
    // The saved payload is authoritative. Replaying imports here overwrites manual corrections.
    applyPayloadState(loaded.payload);
    setUploadedReports(currentReports.map((report) => compactUploadedReport(report as OpsImportResponse)));
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
    ledgerExceptions,
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
  }), [setup, topMetrics, monthRows, nextMonthRows, chargebacks, maintenance, oooRooms, adjustments, ar, ledger, ledgerExceptions, labor, monthlyBudgets, bistroProductions, meetingProductions, staffing, cases, gmOverviewRows, gssRows, gssWaveRows, reputationRows, positiveReviews, negativeReviews, followUp, priorities]);

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
    const previous = previousDraft.data?.draft;
    if (!previous?.payload || monthKeyFromDate(previous.weekEnd || previous.weekStart) !== reportMonthKey) return;
    const priorBudgets = Array.isArray(previous.payload.monthlyBudgets) ? previous.payload.monthlyBudgets.map(normalizeMonthlyBudgetRow) : [];
    const priorNextMonthBudget = priorBudgets.find((row: Row) => row.month === followingMonthKey);
    if (!priorNextMonthBudget) return;
    setMonthlyBudgets((rows) => {
      const current = rows.find((row) => row.month === followingMonthKey);
      const hasCurrentBudget = Boolean(current && [current.rooms, current.occupancy, current.adr, current.revenue].some((value) => String(value || "").trim()));
      if (hasCurrentBudget) return rows;
      const merged = current
        ? {
            ...current,
            rooms: priorNextMonthBudget.rooms || "",
            occupancy: priorNextMonthBudget.occupancy || "",
            adr: priorNextMonthBudget.adr || "",
            revenue: priorNextMonthBudget.revenue || "",
          }
        : priorNextMonthBudget;
      return [...rows.filter((row) => row.month !== followingMonthKey), normalizeMonthlyBudgetRow(merged)];
    });
  }, [previousDraft.data?.draft, reportMonthKey, followingMonthKey]);

  useEffect(() => {
    const budget = monthlyBudgets.find((row) => row.month === followingMonthKey);
    setNextMonthRows((currentRows) => {
      const rows = normalizeNextMonthRows(currentRows);
      const otb: Row = rows.find((row) => row.label === "FUTURE BOOKED FOR NEXT MONTH") || {};
      const sdly: Row = rows.find((row) => row.label === "SDLY OTB FOR NEXT MONTH") || {};
      const difference = (left: unknown, right: unknown, formatter: (value: number) => string) => {
        if (!String(left || "").trim() || !String(right || "").trim()) return "";
        return formatter(num(String(left)) - num(String(right)));
      };
      const nextRows = rows.map((row) => {
        if (row.label === "NEXT MONTH BUDGET" && budget) {
          return {
            ...row,
            occupancy: budget.occupancy || "",
            rooms: monthlyRoomsValue(budget.rooms || "", budget.adr || "", budget.revenue || ""),
            adr: budget.adr || "",
            revenue: budget.revenue || "",
            comments: `Budget for ${monthLabelFromKey(followingMonthKey)}`,
          };
        }
        if (row.label === "VARIANCE TO BUDGET") {
          return {
            ...row,
            occupancy: difference(otb.occupancy, budget?.occupancy, (value) => rowValue(value, 2)),
            rooms: difference(otb.rooms, budget ? monthlyRoomsValue(budget.rooms || "", budget.adr || "", budget.revenue || "") : "", (value) => rowValue(value, 0)),
            adr: difference(otb.adr, budget?.adr, accounting),
            revenue: difference(otb.revenue, budget?.revenue, accounting),
            comments: `Current OTB minus budget for ${monthLabelFromKey(followingMonthKey)}`,
          };
        }
        if (row.label === "PACING VARIANCE TO LY") {
          return {
            ...row,
            occupancy: difference(otb.occupancy, sdly.occupancy, (value) => rowValue(value, 2)),
            rooms: difference(otb.rooms, sdly.rooms, (value) => rowValue(value, 0)),
            adr: difference(otb.adr, sdly.adr, accounting),
            revenue: difference(otb.revenue, sdly.revenue, accounting),
            comments: `Current OTB minus same-day-last-year OTB for ${monthLabelFromKey(followingMonthKey)}`,
          };
        }
        return row;
      });
      return JSON.stringify(nextRows) === JSON.stringify(currentRows) ? currentRows : nextRows;
    });
  }, [monthlyBudgets, followingMonthKey, nextMonthRows]);

  useEffect(() => {
    const budget = monthlyBudgets.find((row) => row.month === currentMonthKey);
    setMonthRows((currentRows) => {
      const rows = normalizeCurrentMonthRows(currentRows);
      const mtd: Row = rows.find((item) => String(item.label || "").trim().toUpperCase() === "MONTH TO DATE") || {};
      const future: Row = rows.find((item) => String(item.label || "").trim().toUpperCase() === "FUTURE BOOKED") || {};
      const totalRooms = num(mtd.rooms || "") + num(future.rooms || "");
      const totalRevenue = num(mtd.revenue || "") + num(future.revenue || "");
      const inferredAvailable = (row: Row) => {
        const explicit = num(row.availableRoomNights || "");
        if (explicit) return explicit;
        const occupancy = num(row.occupancy || "");
        return occupancy > 0 ? num(row.rooms || "") / (occupancy > 1 ? occupancy / 100 : occupancy) : 0;
      };
      const totalAvailable = inferredAvailable(mtd) + inferredAvailable(future);
      const monthlyTotal = {
        occupancy: totalAvailable ? percentDisplay(totalRooms / totalAvailable) : "",
        rooms: rowValue(totalRooms, 0),
        adr: totalRooms ? accounting(totalRevenue / totalRooms) : "",
        revenue: accounting(totalRevenue),
      };
      const sdly: Row = rows.find((row) => row.label === "SDLY OTB FOR CURRENT MONTH") || {};
      const ly = budget
        ? {
            occupancy: budget.lyOccupancy || "",
            rooms: monthlyRoomsValue(budget.lyRooms || "", budget.lyAdr || "", budget.lyRevenue || ""),
            adr: budget.lyAdr || "",
            revenue: budget.lyRevenue || "",
          }
        : null;
      let changed = false;
      const nextRows = rows.map((row) => {
      const label = String(row.label || "").trim().toUpperCase();
      const next = (label === "CURRENT MONTH BUDGET" || label === "CURRENT MONTHLY BUDGET") && budget
        ? { ...row, occupancy: budget.occupancy || "", rooms: monthlyRoomsValue(budget.rooms || "", budget.adr || "", budget.revenue || ""), adr: budget.adr || "", revenue: budget.revenue || "", comments: `Budget for ${monthLabelFromKey(currentMonthKey)}` }
        : label === "MONTHLY TOTAL"
          ? { ...row, ...monthlyTotal, comments: "Month to date plus future booked" }
          : label === "LY SAME MONTH" && ly
            ? { ...row, ...ly, comments: `Last year actual for ${monthLabelFromKey(currentMonthKey)}` }
            : label === "VARIANCE TO BUDGET" && budget
              ? {
                  ...row,
                  occupancy: rowValue(num(monthlyTotal.occupancy) - num(budget.occupancy || ""), 2),
                  rooms: rowValue(num(monthlyTotal.rooms) - num(budget.rooms || ""), 0),
                  adr: accounting(num(monthlyTotal.adr) - num(budget.adr || "")),
                  revenue: accounting(num(monthlyTotal.revenue) - num(budget.revenue || "")),
                  comments: `Variance to Budget = Monthly Total minus Current Month Budget`,
                }
            : label === "PACING VARIANCE TO LY"
              ? {
                  ...row,
                  occupancy: monthlyTotal.occupancy && sdly.occupancy ? rowValue(num(monthlyTotal.occupancy) - num(sdly.occupancy), 2) : "",
                  rooms: monthlyTotal.rooms && sdly.rooms ? rowValue(num(monthlyTotal.rooms) - num(sdly.rooms), 0) : "",
                  adr: monthlyTotal.adr && sdly.adr ? accounting(num(monthlyTotal.adr) - num(sdly.adr)) : "",
                  revenue: monthlyTotal.revenue && sdly.revenue ? accounting(num(monthlyTotal.revenue) - num(sdly.revenue)) : "",
                  comments: `Pacing Variance to LY = Monthly Total minus SDLY OTB for Current Month`,
                }
            : label === "VARIANCE TO LY" && ly
              ? {
                  ...row,
                  occupancy: rowValue(num(monthlyTotal.occupancy) - num(ly.occupancy), 2),
                  rooms: rowValue(num(monthlyTotal.rooms) - num(ly.rooms), 0),
                  adr: accounting(num(monthlyTotal.adr) - num(ly.adr)),
                  revenue: accounting(num(monthlyTotal.revenue) - num(ly.revenue)),
                  comments: `Variance to LY = Monthly Total minus LY Same Month`,
                }
            : row;
      if (JSON.stringify(row) !== JSON.stringify(next)) changed = true;
      return next;
      });
      return changed || JSON.stringify(rows) !== JSON.stringify(currentRows) ? nextRows : currentRows;
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
              <SelectContent className={C.menu}>{Array.from({ length: 52 }, (_, index) => <SelectItem key={index + 1} value={`Week ${index + 1}`}>Week {index + 1}</SelectItem>)}</SelectContent>
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
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <DarkLabeledInput label="Property name" value={setup.propertyName} onChange={(propertyName) => setSetup({ ...setup, propertyName })} />
            <DarkLabeledInput label="General manager" value={setup.generalManager} onChange={(generalManager) => setSetup({ ...setup, generalManager })} />
            <DarkLabeledInput label="Total rooms" value={setup.totalRooms} onChange={(totalRooms) => setSetup({ ...setup, totalRooms })} type="number" />
            <DarkLabeledInput label="Total available rooms" value={totalAvailableRooms ? String(totalAvailableRooms) : ""} onChange={() => undefined} type="number" readOnly />
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-xl border border-[#cdbda8] bg-[#fffaf2] text-[#201814] shadow-[0_12px_30px_rgba(72,52,31,0.08)]">
          <Accordion type="single" collapsible>
            <AccordionItem value="ops-import" className="border-0 bg-[#fffaf2] text-[#201814]">
              <AccordionTrigger className="px-4 py-3 text-[#201814] hover:no-underline hover:bg-[#f8efe2] [&>svg]:text-[#5b4b3b]">
                <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <div className="rounded-lg bg-[#e8f0e9] p-2 text-[#2f5f46]"><Upload className="h-4 w-4" /></div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[#201814]">Imported source report files</div>
                    <div className="truncate text-xs font-normal text-[#6b5d50]">
                      {uploadedReports.length} current-week file{uploadedReports.length === 1 ? "" : "s"} · {previousWeekReports.length} previous-week variance reference{previousWeekReports.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="border-t border-[#d7c8b5] bg-white px-4 pb-4 pt-3 text-[#201814]">
                <div className="mb-3 rounded-lg border border-[#bdd5c3] bg-[#edf5ef] p-3 text-sm text-[#173c25]">
                  Upload each report inside the worksheet section it populates. Use this panel to review or remove imported source files.
                </div>
                <Accordion type="multiple" className="space-y-2">
                    <AccordionItem value="current-files" className="rounded-lg border border-[#cdbda8] bg-[#fffaf2] px-3 text-[#201814]">
                      <AccordionTrigger className="py-2 text-sm font-semibold text-[#201814] hover:no-underline [&>svg]:text-[#5b4b3b]">Current week files ({uploadedReports.length})</AccordionTrigger>
                      <AccordionContent className="max-h-72 space-y-2 overflow-y-auto pb-3 text-[#201814]">
                        {!uploadedReports.length && <div className="text-xs text-[#7c6e61]">No files imported for {week}.</div>}
                        {uploadedReportsByType.map(([reportType, reports]) => (
                          <div key={reportType} className="rounded-md border border-[#eadcc9] bg-[#fffaf2] p-2 text-xs">
                            <div className="mb-1 font-semibold text-[#201814]">{REPORT_TYPE_LABELS[reportType as OpsImportResponse["reportType"]] || reportType}</div>
                            {reports.map((report) => (
                              <div key={String(report.uploadId)} className="flex items-center justify-between gap-2 border-t border-[#eadcc9] py-1.5 first:border-0">
                                <div className="min-w-0">
                                  <div className="truncate font-medium text-[#201814]">{String(report.originalFileName || "Report")}</div>
                                  <div className={report.status === "failed" ? "text-rose-700" : report.status === "warning" ? "text-amber-700" : "text-[#2f5f46]"}>{String(report.status || "parsed")}</div>
                                </div>
                                <Button size="sm" variant="outline" className={`${C.outline} h-7 shrink-0 px-2`} disabled={removeOpsReportUpload.isPending} onClick={() => {
                                  if (window.confirm(`Remove ${String(report.originalFileName || "this report")} and recalculate its mapped data?`)) removeOpsReportUpload.mutate(String(report.uploadId));
                                }}>
                                  <Trash2 className="mr-1 h-3 w-3" />Remove
                                </Button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="previous-files" className="rounded-lg border border-[#bfcbd3] bg-[#f4f7f9] px-3 text-[#243746]">
                      <AccordionTrigger className="py-2 text-sm font-semibold text-[#243746] hover:no-underline [&>svg]:text-[#52616c]">Previous week variance files ({previousWeekReports.length})</AccordionTrigger>
                      <AccordionContent className="max-h-72 space-y-1 overflow-y-auto pb-3 text-xs">
                        {!previousWeekReports.length && <div className="text-[#667681]">No previous-week source files found.</div>}
                        {previousWeekReports.map((report, index) => (
                          <div key={String(report.uploadId || `${report.originalFileName}-${index}`)} className="flex items-center justify-between gap-2 rounded border border-[#d6dee4] bg-[#f4f7f9] px-2 py-1.5">
                            <span className="truncate">{String(report.originalFileName || "Report")}</span>
                            <span className="shrink-0 font-medium text-[#243746]">{REPORT_TYPE_LABELS[report.reportType as OpsImportResponse["reportType"]] || String(report.reportType || "Report").replace(/_/g, " ")}</span>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <Tabs defaultValue="weekly" className="space-y-5">
          <TabsList className="bg-[#fffaf2]">
            <TabsTrigger value="weekly">Weekly worksheet</TabsTrigger>
            <TabsTrigger value="summary">Summary dashboard</TabsTrigger>
            <TabsTrigger value="monthly-review">Monthly performance review</TabsTrigger>
          </TabsList>

          <TabsContent value="monthly-review" className="space-y-5">
            <Card className={C.shell}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#2f5f46]" />
                  <CardTitle className="text-xl text-[#201814]">Monthly Performance Review</CardTitle>
                </div>
                <CardDescription className={C.muted}>
                  Complete the prior month's production narrative, top accounts, top groups, and three-month outlook. Each month is stored separately and autosaves while the editor is open.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="w-full max-w-xs">
                  <Label className={`text-xs font-semibold uppercase tracking-[0.12em] ${C.label}`}>Report month</Label>
                  <Select value={monthlyReviewMonth} onValueChange={(value) => {
                    setMonthlyReviewMonth(value);
                    setMonthlyReviewOpen(false);
                  }}>
                    <SelectTrigger className={`mt-1 ${C.field}`}><SelectValue /></SelectTrigger>
                    <SelectContent className={C.menu}>
                      {Array.from({ length: 36 }, (_, index) => {
                        const current = new Date();
                        const date = new Date(Date.UTC(current.getUTCFullYear() - 1, index, 1));
                        const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
                        return <SelectItem key={value} value={value}>{monthLabelFromKey(value)}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  <div className="mt-2 text-xs text-[#5f5247]">
                    {monthlyReview.isLoading ? "Loading month..." : monthlyReview.data?.summary ? `Saved ${monthlyReviewSavedAt || "previously"}` : "No saved review for this month yet."}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button className={C.green} onClick={() => setMonthlyReviewOpen(true)} disabled={monthlyReview.isLoading}>
                    <FileText className="mr-2 h-4 w-4" />Open monthly review
                  </Button>
                  <Button variant="outline" className={C.outline} disabled={!monthlyReview.data?.summary} onClick={() => window.location.assign(apiUrl(`/api/opsreport/monthly-summary/${monthlyReviewMonth}/docx`))}>
                    Word
                  </Button>
                  <Button variant="outline" className={C.outline} disabled={!monthlyReview.data?.summary} onClick={() => window.location.assign(apiUrl(`/api/opsreport/monthly-summary/${monthlyReviewMonth}/pdf`))}>
                    PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="summary" className="space-y-5">
            <Section
              title="Selected Month Performance"
              right={
                <Select value={summaryMonthKey || currentMonthKey} onValueChange={setSummaryMonthKey}>
                  <SelectTrigger className={`w-44 ${C.field}`}><SelectValue /></SelectTrigger>
                  <SelectContent className={C.menu}>
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
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-[#b9d8c2]" /><CardTitle>{week} Report</CardTitle></div>
                  <CardDescription className={`mt-1 ${C.darkMuted}`}>{setup.propertyName} | {topMetrics.weekStart} to {weekEnd || "week end date"}</CardDescription>
                </div>
                <SectionReportUpload
                  reports={reportGuideFor("Previous Week OTB", "Detailed Flash", "MTD / YTD Account Tracking")}
                  multiple
                  compact
                  uploading={opsReportUpload.isPending}
                  onUpload={(files) => uploadSectionReports("Weekly performance", files)}
                />
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#f0d9b0]">Weekly Performance</div>
                  <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
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
                  </div>
                </div>

                <div className="grid gap-4 border-t border-[#4a5360] pt-5 lg:grid-cols-2">
                  {[
                    {
                      label: "Month to Date",
                      thisYear: topMetrics.mtdThisYear,
                      lastYear: topMetrics.mtdLastYear,
                      variance: mtdVariance,
                      variancePercent: mtdVariancePercent,
                      setThisYear: (mtdThisYear: string) => setTopMetrics({ ...topMetrics, mtdThisYear }),
                      setLastYear: (mtdLastYear: string) => setTopMetrics({ ...topMetrics, mtdLastYear }),
                    },
                    {
                      label: "Year to Date",
                      thisYear: topMetrics.ytdThisYear,
                      lastYear: topMetrics.ytdLastYear,
                      variance: ytdVariance,
                      variancePercent: ytdVariancePercent,
                      setThisYear: (ytdThisYear: string) => setTopMetrics({ ...topMetrics, ytdThisYear }),
                      setLastYear: (ytdLastYear: string) => setTopMetrics({ ...topMetrics, ytdLastYear }),
                    },
                  ].map((comparison) => (
                    <div key={comparison.label} className="rounded-xl border border-[#4a5360] bg-[#19212b] p-4">
                      <div className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#f0d9b0]">{comparison.label} Comparison</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DarkLabeledInput label="This Year" value={comparison.thisYear} onChange={comparison.setThisYear} moneyFormat />
                        <DarkLabeledInput label="Last Year" value={comparison.lastYear} onChange={comparison.setLastYear} moneyFormat />
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className={`rounded-lg border px-3 py-2 ${varianceTone(comparison.variance)}`}>
                          <div className="text-xs font-semibold uppercase tracking-[0.1em]">Dollar Variance</div>
                          <div className="mt-1 text-xl font-semibold">{signedValue(comparison.variance, accounting)}</div>
                        </div>
                        <div className={`rounded-lg border px-3 py-2 ${comparison.variancePercent == null ? varianceTone(0) : varianceTone(comparison.variancePercent)}`}>
                          <div className="text-xs font-semibold uppercase tracking-[0.1em]">Variance %</div>
                          <div className="mt-1 text-xl font-semibold">
                            {comparison.variancePercent == null ? "—" : `${comparison.variancePercent > 0 ? "+" : ""}${comparison.variancePercent.toFixed(1)}%`}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-[#cfc4b5]">Variance = This Year minus Last Year.</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Section title="Current Month">
              <SectionReportUpload
                reports={reportGuideFor("Current Month OTB", "Remaining Month OTB", "Current Month SDLY OTB")}
                multiple
                uploading={opsReportUpload.isPending}
                onUpload={(files) => uploadSectionReports("Current Month", files)}
              />
              <EditableTable columns={[{ key: "label", label: "Current Month", wide: true }, { key: "occupancy", label: "Occupancy" }, { key: "rooms", label: "Rooms" }, { key: "adr", label: "ADR" }, { key: "revenue", label: "Room Revenue" }, { key: "comments", label: "Comments", wide: true }]} rows={monthRows} onChange={setMonthRows} />
              <div className="rounded-lg border border-[#d7c8b5] bg-[#fffaf2] px-4 py-3 text-sm text-[#5f5247]">
                <span className="font-semibold text-[#201814]">Variance to Budget</span> = Monthly Total minus Current Month Budget.{" "}
                <span className="font-semibold text-[#201814]">Pacing Variance to LY</span> = Monthly Total minus the SDLY OTB snapshot.{" "}
                <span className="font-semibold text-[#201814]">Variance to LY</span> = Monthly Total minus LY Same Month.
                Positive values are ahead of the comparison; negative values are behind.
              </div>
            </Section>
            <Section title="Next Month Data">
              <SectionReportUpload
                reports={reportGuideFor("Next Month OTB", "Next Month SDLY OTB")}
                multiple
                uploading={opsReportUpload.isPending}
                onUpload={(files) => uploadSectionReports("Next Month", files)}
              />
              <EditableTable columns={[{ key: "label", label: "Next Month", wide: true }, { key: "occupancy", label: "Occupancy" }, { key: "rooms", label: "Rooms" }, { key: "adr", label: "ADR" }, { key: "revenue", label: "Room Revenue" }, { key: "comments", label: "Comments", wide: true }]} rows={nextMonthRows} onChange={setNextMonthRows} />
            </Section>
            <Section title="Weekly Chargebacks">
              <EditableTable columns={[{ key: "no", label: "S No" }, { key: "reason", label: "Reason", wide: true }, { key: "respondDate", label: "Respond Date" }, { key: "amount", label: "Total Amount" }, { key: "comment", label: "Comment", wide: true }]} rows={chargebacks} onChange={setChargebacks} />
            </Section>
            <Section title="Major Weekly Maintenance Tasks">
              <EditableTable columns={[{ key: "no", label: "S No" }, { key: "rooms", label: "P.M. Rooms" }, { key: "area", label: "Area" }, { key: "hours", label: "Time Consumed Hrs" }, { key: "comment", label: "Comment", wide: true }]} rows={maintenance} onChange={setMaintenance} />
            </Section>
            <Section title="Weekly Out of Order Rooms">
              <SectionReportUpload
                reports={reportGuideFor("OOO Rooms")}
                uploading={opsReportUpload.isPending}
                onUpload={(files) => uploadSectionReports("Weekly OOO Rooms", files)}
              />
              <EditableTable columns={[{ key: "no", label: "S No" }, { key: "room", label: "Room No" }, { key: "startDate", label: "OOO Start Date" }, { key: "returnDate", label: "Expected Return" }, { key: "comment", label: "Comment", wide: true }]} rows={oooRooms} onChange={setOooRooms} />
            </Section>
            <Section title="Week's Total Revenue Adjustments" right={<Badge variant="outline">{money(adjustmentTotal)}</Badge>}>
              <EditableTable columns={[{ key: "no", label: "S No" }, { key: "room", label: "Room No" }, { key: "guest", label: "Guest Name" }, { key: "amount", label: "Adjustment Amount" }, { key: "comment", label: "Reason/Comment", wide: true }]} rows={adjustments} onChange={setAdjustments} />
            </Section>
            <Section title="Accounts Receivable / Aging" right={<Badge variant="outline">Total {money(arTotal)}</Badge>}>
              <SectionReportUpload
                reports={reportGuideFor("AR Aging")}
                uploading={opsReportUpload.isPending}
                onUpload={(files) => uploadSectionReports("Accounts Receivable", files)}
              />
              <div className="grid gap-3 p-4 sm:grid-cols-5">
                <LabeledInput label="Current" value={ar.current} onChange={(current) => setAr({ ...ar, current })} moneyFormat />
                <LabeledInput label="30" value={ar.d30} onChange={(d30) => setAr({ ...ar, d30 })} moneyFormat />
                <LabeledInput label="60" value={ar.d60} onChange={(d60) => setAr({ ...ar, d60 })} moneyFormat />
                <LabeledInput label="90+" value={ar.d90} onChange={(d90) => setAr({ ...ar, d90 })} moneyFormat />
                <LabeledInput label="Comments" value={ar.comments} onChange={(comments) => setAr({ ...ar, comments })} />
              </div>
            </Section>
            <Section title="Guest Ledger Balance">
              <SectionReportUpload
                reports={reportGuideFor("Credit Limit / Guest Ledger")}
                uploading={opsReportUpload.isPending}
                onUpload={(files) => uploadSectionReports("Guest Ledger", files)}
              />
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <LabeledInput label="Total balance" value={ledger.balance} onChange={(balance) => setLedger({ ...ledger, balance })} moneyFormat />
                <LabeledInput label="Uncovered authorization" value={ledger.uncovered || ""} onChange={(uncovered) => setLedger({ ...ledger, uncovered })} moneyFormat />
                <LabeledInput label="Balance over $1000" value={ledger.over1000} onChange={(over1000) => setLedger({ ...ledger, over1000 })} moneyFormat />
                <LabeledInput label="Comment" value={ledger.comment} onChange={(comment) => setLedger({ ...ledger, comment })} />
              </div>
              <EditableTable
                columns={[
                  { key: "no", label: "S No" },
                  { key: "room", label: "Room" },
                  { key: "guest", label: "Guest" },
                  { key: "paymentMethod", label: "Payment Method" },
                  { key: "projected", label: "Projected Balance" },
                  { key: "authAmount", label: "CC Authorization" },
                  { key: "uncovered", label: "Uncovered" },
                  { key: "action", label: "Required FD Action", wide: true },
                ]}
                rows={ledgerExceptions}
                onChange={setLedgerExceptions}
              />
            </Section>
            <Section title="Department Labor Review (Controllable)" right={<Badge variant="outline">Actual vs Expected {fmtHours(laborVariance)}</Badge>}>
              <div className="flex flex-col gap-3 border-b border-[#e0d3c1] p-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-[#201814]">Scheduled, Actual, and Expected Hours</div>
                  <p className="mt-1 max-w-2xl text-sm text-[#5f5247]">
                    Every department's hours variance is Actual Hours minus Expected Hours. Expected Hours are modeled from final occupancy or rooms sold, not a pre-period labor budget.
                  </p>
                  <div className="mt-2 rounded-lg border border-[#d7c8b5] bg-[#fbf6ee] p-2 text-xs text-[#5f5247]">
                    <span className="font-semibold text-[#201814]">Required actual-hours report:</span>{" "}
                    {reportGuideFor("Actual Labor Hours")[0]?.parameters} Suggested file:{" "}
                    <code>{reportGuideFor("Actual Labor Hours")[0]?.fileName}</code>
                  </div>
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
                  { key: "budget", label: "Expected Hours" },
                  { key: "variance", label: "Hours Variance", readOnly: true },
                  { key: "estimatedActualWages", label: "Est. Wages", readOnly: true },
                  { key: "estimatedActualWagesWithSalary", label: "Est. Wages w/ Salary", readOnly: true },
                  { key: "calculatedMpor", label: "Actual MPOR", readOnly: true },
                  { key: "targetMpor", label: "Target MPOR", readOnly: true },
                  { key: "mporVariance", label: "MPOR Variance", readOnly: true },
                  { key: "comments", label: "Comments", wide: true },
                ]}
                rows={laborRows}
                onChange={(rows) => setLabor(rows
                  .filter((row) => row.__readOnly !== "true")
                  .map(({ __readOnly, variance, estimatedActualWages, estimatedActualWagesWithSalary, calculatedMpor, targetMpor, mporVariance, ...row }) => row))}
                getCellPreview={laborDepartmentPreview}
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
              <SectionReportUpload
                reports={reportGuideFor("GSS Scores")}
                uploading={opsReportUpload.isPending}
                onUpload={(files) => uploadSectionReports("Guest Satisfaction", files)}
              />
              <EditableTable columns={[{ key: "label", label: "GSS MTD", wide: true }, { key: "hotel", label: "Hotel" }, { key: "priorWeek", label: "Prior Week" }, { key: "weekVariance", label: "+/- Prior" }, { key: "brand", label: "Brand / Continent" }, { key: "variance", label: "Variance" }, { key: "sply", label: "SPLY Variance" }, { key: "comments", label: "Comments", wide: true }]} rows={gssRowsWithPrevious} onChange={(rows) => setGssRows(stripDerivedComparisonColumns(rows))} />
            </Section>
            <Section title="GSS Wave To Date">
              <EditableTable columns={[{ key: "label", label: "GSS Wave To Date", wide: true }, { key: "hotel", label: "Hotel" }, { key: "priorWeek", label: "Prior Week" }, { key: "weekVariance", label: "+/- Prior" }, { key: "brand", label: "Brand / Continent" }, { key: "variance", label: "Variance" }, { key: "sply", label: "SPLY Variance" }, { key: "comments", label: "Comments", wide: true }]} rows={gssWaveRowsWithPrevious} onChange={(rows) => setGssWaveRows(stripDerivedComparisonColumns(rows))} />
            </Section>
            <Section title="Online Reputation">
              <EditableTable
                columns={[{ key: "label", label: "Name", wide: true }, { key: "reviews", label: "Total Reviews" }, { key: "score", label: "Current Score" }, { key: "outOf", label: "Out Of" }, { key: "goal", label: "Goal Score" }, { key: "variance", label: "Variance to Goal", readOnly: true }, { key: "strategy", label: "Strategy / Action Plan", wide: true }]}
                rows={reputationRowsWithVariance}
                onChange={(rows) => setReputationRows(rows.map(({ variance, ...row }) => row))}
              />
            </Section>
            <div className="overflow-hidden rounded-xl border border-[#cdbda8] bg-[#fffaf2] shadow-[0_12px_30px_rgba(72,52,31,0.08)]">
              <SectionReportUpload
                reports={reportGuideFor("Marriott Responses")}
                uploading={opsReportUpload.isPending}
                onUpload={(files) => uploadSectionReports("Weekly Reviews", files)}
              />
            </div>
            <div className="grid items-stretch gap-5 lg:grid-cols-2">
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
      <Dialog open={monthlyReviewOpen} onOpenChange={setMonthlyReviewOpen}>
        <DialogContent className="max-h-[94vh] max-w-6xl overflow-hidden border-[#d7c8b5] bg-[#f3efe7] p-0 text-[#201814]">
          <div className="flex max-h-[94vh] flex-col">
            <DialogHeader className="border-b border-[#d7c8b5] bg-[#fffaf2] px-6 py-4">
              <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <DialogTitle>Monthly Performance Review - {monthLabelFromKey(monthlyReviewMonth)}</DialogTitle>
                  <DialogDescription className={C.muted}>This editor follows the uploaded two-page Word template. Changes autosave for the selected month.</DialogDescription>
                </div>
                <Badge className={`${saveMonthlyReview.isPending ? "bg-[#b98435]" : "bg-[#2f5f46]"} w-fit text-white`}>
                  {saveMonthlyReview.isPending ? "Autosaving..." : monthlyReviewSavedAt ? `Saved ${monthlyReviewSavedAt}` : "Autosave on"}
                </Badge>
              </div>
            </DialogHeader>
            <div className="overflow-y-auto p-4 sm:p-6">
              <div className="mx-auto max-w-4xl space-y-6 border border-[#cdbda8] bg-white p-5 shadow-sm sm:p-8">
                <div>
                  <h2 className="text-2xl font-bold">Monthly Performance Review</h2>
                  <div className="mt-4 overflow-hidden border border-[#8c8c8c] text-sm">
                    {([
                      ["Presented to:", "presentedTo"],
                      ["Issued by:", "issuedBy"],
                      ["Date:", "issueDate"],
                    ] as const).map(([label, key]) => (
                      <div key={key} className="grid border-b border-[#8c8c8c] last:border-b-0 sm:grid-cols-[150px_1fr]">
                        <div className="border-b border-[#8c8c8c] bg-[#f7f7f7] px-3 py-2 font-semibold sm:border-b-0 sm:border-r">{label}</div>
                        <Input
                          className="h-10 rounded-none border-0 bg-white text-[#201814] shadow-none focus-visible:ring-1"
                          type={key === "issueDate" ? "date" : "text"}
                          value={monthlyReviewForm[key]}
                          onChange={(event) => setMonthlyReviewForm({ ...monthlyReviewForm, [key]: event.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold">Key Performance Indicators (KPIs)</h3>
                  <div className="mt-2 space-y-3">
                    {([
                      ["Occupancy Rate", "occupancyRate", "occupancyComparison"],
                      ["Average Daily Rate (ADR)", "adr", "adrComparison"],
                      ["Revenue per Available Room (RevPAR)", "revpar", "revparComparison"],
                      ["Total Revenue", "totalRevenue", "totalRevenueComparison"],
                    ] as const).map(([label, valueKey, comparisonKey]) => (
                      <div key={valueKey} className="grid gap-2 sm:grid-cols-[220px_180px_1fr] sm:items-center">
                        <Label className="font-semibold">{label}:</Label>
                        <Input className={C.field} value={monthlyReviewForm[valueKey]} onChange={(event) => setMonthlyReviewForm({ ...monthlyReviewForm, [valueKey]: event.target.value })} placeholder="Value" />
                        <Input className={C.field} value={monthlyReviewForm[comparisonKey]} onChange={(event) => setMonthlyReviewForm({ ...monthlyReviewForm, [comparisonKey]: event.target.value })} placeholder="Compared to previous month / last year" />
                      </div>
                    ))}
                    <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
                      <Label className="font-semibold">Guest Satisfaction Score:</Label>
                      <Input className={C.field} value={monthlyReviewForm.guestSatisfaction} onChange={(event) => setMonthlyReviewForm({ ...monthlyReviewForm, guestSatisfaction: event.target.value })} />
                    </div>
                  </div>
                </div>

                {([
                  ["Highlights", [
                    ["Increased Occupancy", "increasedOccupancy"],
                    ["Enhanced Guest Experience", "enhancedGuestExperience"],
                    ["Staff Performance", "staffPerformance"],
                  ]],
                  ["Challenges", [
                    ["Seasonal Variability", "seasonalVariability"],
                    ["Operational Costs", "operationalCosts"],
                  ]],
                  ["Recommendations", [
                    ["Marketing Strategies", "marketingStrategies"],
                    ["Cost Management", "costManagement"],
                    ["Guest Engagement", "guestEngagement"],
                  ]],
                ] as Array<[string, Array<[string, keyof MonthlySummaryForm]>]>).map(([heading, fields]) => (
                  <div key={heading}>
                    <h3 className="text-lg font-bold">{heading}</h3>
                    <div className="mt-2 space-y-3">
                      {fields.map(([label, key]) => (
                        <div key={String(key)}>
                          <Label className="font-semibold">{label}:</Label>
                          <Textarea className={`mt-1 min-h-[72px] ${C.field}`} value={String(monthlyReviewForm[key])} onChange={(event) => setMonthlyReviewForm({ ...monthlyReviewForm, [key]: event.target.value })} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div>
                  <h3 className="text-lg font-bold">Three-month Forecast</h3>
                  <div className="mt-2 space-y-3">
                    <div><Label className="font-semibold">Forecast comment: Occ%, ADR</Label><Textarea className={`mt-1 ${C.field}`} value={monthlyReviewForm.forecastComment} onChange={(event) => setMonthlyReviewForm({ ...monthlyReviewForm, forecastComment: event.target.value })} /></div>
                    <div><Label className="font-semibold">Forecast: Key Drivers</Label><Textarea className={`mt-1 min-h-[90px] ${C.field}`} value={monthlyReviewForm.forecastKeyDrivers} onChange={(event) => setMonthlyReviewForm({ ...monthlyReviewForm, forecastKeyDrivers: event.target.value })} /></div>
                    <div><Label className="font-semibold">Risks and Challenges</Label><Textarea className={`mt-1 min-h-[90px] ${C.field}`} value={monthlyReviewForm.risksAndChallenges} onChange={(event) => setMonthlyReviewForm({ ...monthlyReviewForm, risksAndChallenges: event.target.value })} /></div>
                    <div><Label className="font-semibold">Opportunities for Growth</Label><Textarea className={`mt-1 min-h-[90px] ${C.field}`} value={monthlyReviewForm.opportunitiesForGrowth} onChange={(event) => setMonthlyReviewForm({ ...monthlyReviewForm, opportunitiesForGrowth: event.target.value })} /></div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold">Top Corporate Accounts and Groups</h3>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {([
                      ["Current room nights", "currentRoomNights"],
                      ["Current total revenue", "currentAccountRevenue"],
                      ["Previous month room nights", "previousRoomNights"],
                      ["Room night variance", "roomNightVariance"],
                      ["Previous month revenue", "previousAccountRevenue"],
                      ["Revenue variance", "accountRevenueVariance"],
                    ] as Array<[string, keyof MonthlySummaryForm]>).map(([label, key]) => (
                      <div key={String(key)}><Label>{label}</Label><Input className={`mt-1 ${C.field}`} value={String(monthlyReviewForm[key])} onChange={(event) => setMonthlyReviewForm({ ...monthlyReviewForm, [key]: event.target.value })} /></div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-center text-lg font-bold">TOP ACCOUNTS FOR {monthLabelFromKey(monthlyReviewMonth).toUpperCase()}</h3>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[700px] border-collapse text-sm">
                      <thead>
                        <tr className={C.header}>
                          <th className="border border-[#c9d2d8] p-2">#</th><th className="border border-[#c9d2d8] p-2 text-left">Top Corporate Accounts</th><th className="border border-[#c9d2d8] p-2">RMNTS</th>
                          <th className="border border-[#c9d2d8] p-2">#</th><th className="border border-[#c9d2d8] p-2 text-left">Top Groups</th><th className="border border-[#c9d2d8] p-2">RMNTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 10 }, (_, index) => (
                          <tr key={index} className="odd:bg-white even:bg-[#fffaf2]">
                            <td className="border border-[#d7c8b5] p-2 text-center">{index + 1}</td>
                            <td className="border border-[#d7c8b5] p-1"><Input className={C.field} value={monthlyReviewForm.corporateAccounts[index]?.name || ""} onChange={(event) => {
                              const corporateAccounts = monthlyReviewForm.corporateAccounts.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item);
                              setMonthlyReviewForm({ ...monthlyReviewForm, corporateAccounts });
                            }} /></td>
                            <td className="border border-[#d7c8b5] p-1"><Input className={`${C.field} text-center`} value={monthlyReviewForm.corporateAccounts[index]?.roomNights || ""} onChange={(event) => {
                              const corporateAccounts = monthlyReviewForm.corporateAccounts.map((item, itemIndex) => itemIndex === index ? { ...item, roomNights: event.target.value } : item);
                              setMonthlyReviewForm({ ...monthlyReviewForm, corporateAccounts });
                            }} /></td>
                            <td className="border border-[#d7c8b5] p-2 text-center">{index + 1}</td>
                            <td className="border border-[#d7c8b5] p-1"><Input className={C.field} value={monthlyReviewForm.groups[index]?.name || ""} onChange={(event) => {
                              const groups = monthlyReviewForm.groups.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item);
                              setMonthlyReviewForm({ ...monthlyReviewForm, groups });
                            }} /></td>
                            <td className="border border-[#d7c8b5] p-1"><Input className={`${C.field} text-center`} value={monthlyReviewForm.groups[index]?.roomNights || ""} onChange={(event) => {
                              const groups = monthlyReviewForm.groups.map((item, itemIndex) => itemIndex === index ? { ...item, roomNights: event.target.value } : item);
                              setMonthlyReviewForm({ ...monthlyReviewForm, groups });
                            }} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold">Sales Pipeline Notes</h3>
                  <div className="mt-2 space-y-2">
                    {monthlyReviewForm.salesNotes.map((note, index) => (
                      <div key={index} className="grid grid-cols-[24px_1fr] items-start gap-2">
                        <div className="pt-2 text-center font-semibold">•</div>
                        <Textarea className={`min-h-[58px] ${C.field}`} value={note} onChange={(event) => {
                          const salesNotes = monthlyReviewForm.salesNotes.map((item, itemIndex) => itemIndex === index ? event.target.value : item);
                          setMonthlyReviewForm({ ...monthlyReviewForm, salesNotes });
                        }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#d7c8b5] bg-[#fffaf2] px-6 py-4">
              <div className="flex gap-2">
                <Button variant="outline" className={C.outline} disabled={!monthlyReview.data?.summary} onClick={() => window.location.assign(apiUrl(`/api/opsreport/monthly-summary/${monthlyReviewMonth}/docx`))}>Download Word</Button>
                <Button variant="outline" className={C.outline} disabled={!monthlyReview.data?.summary} onClick={() => window.location.assign(apiUrl(`/api/opsreport/monthly-summary/${monthlyReviewMonth}/pdf`))}>Download PDF</Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className={C.outline} onClick={() => setMonthlyReviewOpen(false)}>Close</Button>
                <Button className={C.green} onClick={() => saveMonthlyReview.mutate(monthlyReviewForm)} disabled={saveMonthlyReview.isPending}>Save now</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                <SelectContent className={C.menu}>
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
                  <SelectContent className={C.menu}>
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
                  <SelectContent className={C.menu}>
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
