import * as XLSX from "@e965/xlsx";

export const ABACUS_LABOR_DEPARTMENT_MAP = {
  "109": "BREAKFAST / BISTRO HOURS",
  "110": "BREAKFAST / BISTRO HOURS",
  "113": "BREAKFAST / BISTRO HOURS",
  "200": "FRONT DESK / NIGHT AUDIT HOURS",
  "202": "FRONT DESK / NIGHT AUDIT HOURS",
  "500": "FRONT DESK / NIGHT AUDIT HOURS",
  "111": "HOUSEKEEPING HOURS",
  "300": "HOUSEKEEPING HOURS",
  "310": "HOUSEKEEPING HOURS",
  "320": "HOUSEKEEPING HOURS",
  "350": "HOUSEKEEPING HOURS",
  "400": "MAINTENANCE HOURS",
} as const;

export type AbacusLaborDepartment = typeof ABACUS_LABOR_DEPARTMENT_MAP[keyof typeof ABACUS_LABOR_DEPARTMENT_MAP] | "UNMAPPED / REVIEW REQUIRED";

export type AbacusLaborTotals = {
  regularHours: number;
  overtimeHours: number;
  memoHours: number;
  totalHours: number;
  regularPayroll: number;
  overtimePayroll: number;
  otherPayroll: number;
  totalPayroll: number;
};

export type AbacusLaborCodeTotal = AbacusLaborTotals & {
  laborCode: string;
  laborTitle: string;
  department: AbacusLaborDepartment;
  overtimePercent: number;
};

export type AbacusDepartmentTotal = AbacusLaborTotals & {
  department: AbacusLaborDepartment;
  overtimePercent: number;
  shareOfHotelOvertime: number;
  laborCodes: AbacusLaborCodeTotal[];
};

export type AbacusLaborImport = {
  source: "abacus_time_earnings_hours";
  originalFileName: string;
  weekStart: string;
  weekEnd: string;
  importedAt: string;
  departments: AbacusDepartmentTotal[];
  hotelTotal: AbacusLaborTotals;
  reportGrandTotal: { hours: number; payroll: number } | null;
  reconciled: boolean;
  warnings: string[];
};

const DISPLAY_ORDER: AbacusLaborDepartment[] = [
  "HOUSEKEEPING HOURS",
  "FRONT DESK / NIGHT AUDIT HOURS",
  "BREAKFAST / BISTRO HOURS",
  "MAINTENANCE HOURS",
  "UNMAPPED / REVIEW REQUIRED",
];

function emptyTotals(): AbacusLaborTotals {
  return { regularHours: 0, overtimeHours: 0, memoHours: 0, totalHours: 0, regularPayroll: 0, overtimePayroll: 0, otherPayroll: 0, totalPayroll: 0 };
}

function round(value: number) {
  return Number(value.toFixed(2));
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function numeric(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const negative = /^\(.*\)$/.test(raw);
  const parsed = Number(raw.replace(/[$,%(),]/g, ""));
  return Number.isFinite(parsed) ? (negative ? -Math.abs(parsed) : parsed) : 0;
}

function isoDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return "";
}

function addTotals(target: AbacusLaborTotals, source: AbacusLaborTotals) {
  const keys: Array<keyof AbacusLaborTotals> = ["regularHours", "overtimeHours", "memoHours", "totalHours", "regularPayroll", "overtimePayroll", "otherPayroll", "totalPayroll"];
  for (const key of keys) target[key] = round(target[key] + source[key]);
}

function finalizeTotals(total: AbacusLaborTotals) {
  total.totalHours = round(total.regularHours + total.overtimeHours + total.memoHours);
  total.totalPayroll = round(total.regularPayroll + total.overtimePayroll + total.otherPayroll);
  return total;
}

function rowValue(row: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) return row[alias];
  }
  return undefined;
}

export function parseAbacusLaborCsv(buffer: Buffer, originalFileName = "Abacus labor export.csv"): AbacusLaborImport {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The Abacus CSV does not contain a readable worksheet.");
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  if (!rawRows.length) throw new Error("The Abacus CSV is empty.");
  const rows = rawRows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])));
  const headers = new Set(Object.keys(rows[0] || {}));
  const hasLaborCode = headers.has("laborvalue") || headers.has("laborcode");
  const hasEarnings = headers.has("earningscode") || headers.has("earningtitle") || headers.has("earningstype");
  if (!hasLaborCode || !headers.has("hours") || !headers.has("total") || !hasEarnings) {
    throw new Error("This file does not appear to be an Abacus Time, Earnings and Hours Export. Expected Labor Value, Earnings Code/Title, Hours, and Total columns.");
  }

  const codeTotals = new Map<string, AbacusLaborCodeTotal>();
  const dates: string[] = [];
  let reportGrandTotal: { hours: number; payroll: number } | null = null;
  let malformedNumericRows = 0;

  for (const row of rows) {
    const laborCode = String(rowValue(row, ["laborvalue", "laborcode"]) ?? "").trim();
    const hoursRaw = rowValue(row, ["hours"]);
    const payrollRaw = rowValue(row, ["total", "totalpay", "payroll"]);
    if (!laborCode) {
      const hours = numeric(hoursRaw);
      const payroll = numeric(payrollRaw);
      if (hours || payroll) reportGrandTotal = { hours: round(hours), payroll: round(payroll) };
      continue;
    }
    if (!/^\d+$/.test(laborCode)) continue;
    const rawHoursText = String(hoursRaw ?? "").trim();
    const rawPayrollText = String(payrollRaw ?? "").trim();
    if ((rawHoursText && !Number.isFinite(Number(rawHoursText.replace(/[$,%(),]/g, "")))) || (rawPayrollText && !Number.isFinite(Number(rawPayrollText.replace(/[$,%(),]/g, ""))))) malformedNumericRows += 1;
    const hours = numeric(hoursRaw);
    const payroll = numeric(payrollRaw);
    if (!hours && !payroll) continue;
    const date = isoDate(rowValue(row, ["date", "workdate", "earningdate"]));
    if (date) dates.push(date);
    const laborTitle = String(rowValue(row, ["labortitle", "laborname", "jobtitle"]) ?? "").trim();
    const earningsCode = String(rowValue(row, ["earningscode", "earningcode"]) ?? "").trim().toUpperCase();
    const earningTitle = String(rowValue(row, ["earningtitle", "earningstitle", "earningstype"]) ?? "").trim().toLowerCase();
    const category = earningsCode === "1" || /\bregular\b/.test(earningTitle)
      ? "regular"
      : earningsCode === "2" || /overtime|\bot\b/.test(earningTitle)
        ? "overtime"
        : "memo";
    const department = (ABACUS_LABOR_DEPARTMENT_MAP as Record<string, AbacusLaborDepartment>)[laborCode] || "UNMAPPED / REVIEW REQUIRED";
    const total = codeTotals.get(laborCode) || { ...emptyTotals(), laborCode, laborTitle, department, overtimePercent: 0 };
    if (!total.laborTitle && laborTitle) total.laborTitle = laborTitle;
    if (category === "regular") {
      total.regularHours = round(total.regularHours + hours);
      total.regularPayroll = round(total.regularPayroll + payroll);
    } else if (category === "overtime") {
      total.overtimeHours = round(total.overtimeHours + hours);
      total.overtimePayroll = round(total.overtimePayroll + payroll);
    } else {
      total.memoHours = round(total.memoHours + hours);
      total.otherPayroll = round(total.otherPayroll + payroll);
    }
    codeTotals.set(laborCode, total);
  }

  if (!codeTotals.size) throw new Error("No employee labor rows were found in the Abacus export.");
  const byDepartment = new Map<AbacusLaborDepartment, AbacusDepartmentTotal>();
  for (const codeTotal of Array.from(codeTotals.values())) {
    finalizeTotals(codeTotal);
    codeTotal.overtimePercent = codeTotal.totalHours ? round(codeTotal.overtimeHours / codeTotal.totalHours * 100) : 0;
    const department: AbacusDepartmentTotal = byDepartment.get(codeTotal.department) || { ...emptyTotals(), department: codeTotal.department, overtimePercent: 0, shareOfHotelOvertime: 0, laborCodes: [] };
    addTotals(department, codeTotal);
    department.laborCodes.push(codeTotal);
    byDepartment.set(codeTotal.department, department);
  }
  const hotelTotal = emptyTotals();
  for (const department of Array.from(byDepartment.values())) addTotals(hotelTotal, department);
  finalizeTotals(hotelTotal);
  const departments = DISPLAY_ORDER
    .map((name) => byDepartment.get(name))
    .filter((department): department is AbacusDepartmentTotal => Boolean(department))
    .map((department) => {
      finalizeTotals(department);
      department.overtimePercent = department.totalHours ? round(department.overtimeHours / department.totalHours * 100) : 0;
      department.shareOfHotelOvertime = hotelTotal.overtimeHours ? round(department.overtimeHours / hotelTotal.overtimeHours * 100) : 0;
      department.laborCodes.sort((a, b) => a.laborCode.localeCompare(b.laborCode, undefined, { numeric: true }));
      return department;
    });
  const uniqueDates = Array.from(new Set(dates)).sort();
  if (!uniqueDates.length) throw new Error("No valid work dates were found in the Abacus export.");
  const warnings: string[] = [];
  const unmapped = byDepartment.get("UNMAPPED / REVIEW REQUIRED");
  if (unmapped) warnings.push(`${unmapped.laborCodes.length} unmapped labor code${unmapped.laborCodes.length === 1 ? "" : "s"} require review.`);
  if (malformedNumericRows) warnings.push(`${malformedNumericRows} row${malformedNumericRows === 1 ? "" : "s"} contained malformed numeric data and were safely treated as zero.`);
  const reconciled = !reportGrandTotal || (Math.abs(reportGrandTotal.hours - hotelTotal.totalHours) < 0.011 && Math.abs(reportGrandTotal.payroll - hotelTotal.totalPayroll) < 0.011);
  if (reportGrandTotal && !reconciled) warnings.push(`Calculated totals do not reconcile to the Abacus grand total (${reportGrandTotal.hours.toFixed(2)} hours / $${reportGrandTotal.payroll.toFixed(2)}).`);
  return {
    source: "abacus_time_earnings_hours",
    originalFileName,
    weekStart: uniqueDates[0],
    weekEnd: uniqueDates[uniqueDates.length - 1],
    importedAt: new Date().toISOString(),
    departments,
    hotelTotal,
    reportGrandTotal,
    reconciled,
    warnings,
  };
}
