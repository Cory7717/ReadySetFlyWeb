import type { Express } from "express";
import { parseXlsxSheets, excelDateToIso } from "./opsReportParsers";

export const COMPTROLLER_PROPERTY_ID = "courtyard-austin-lakeline";
export const COMPTROLLER_PROPERTY_NAME = "Courtyard Austin Northwest Lakeline";

export const DEFAULT_COMPTROLLER_TAX_SETTINGS = {
  stateHOTRate: 0.06,
  cityHOTRate: 0.11,
  tourismPIDRate: 0.02,
  stateEffectiveRoomTaxLabel: 0.0612,
  cityEffectiveRoomTaxLabel: 0.1122,
  salesTaxRate: 0.0825,
  meetingRoomTaxRate: 0.06,
  includeMeetingRoomTaxInStateHOT: true,
  roundingTolerance: 1,
};

type SheetRows = { name: string; rows: string[][] };
type RowRecord = Record<string, string>;
type ParsedSheet = { sheetName: string; rows: RowRecord[]; headers: string[]; warnings: string[] };
type UploadMap = Record<string, Express.Multer.File | undefined>;

const POSTING_REQUIRED = [
  "ITEM",
  "ITEM CODE",
  "PROPERTY DATE",
  "AMOUNT",
  "AUSTIN TOURISM PID FEE 2% EX",
  "CITY TAX 11.22% EX",
  "FEE CITY TAX 11.22% EX",
  "FEE STATE TAX 6.12% EX",
  "MEETING ROOM TAX 6% EX",
  "SALES TAX 8.25% EX",
  "STATE OCCUPANCY TAX 6.12% EX",
];

const EXEMPTION_REQUIRED = [
  "CATEGORY",
  "SUBCATEGORY",
  "NAME",
  "ITEM",
  "ITEM CODE",
  "TAX EXEMPT ID",
  "TAX EXEMPT REASON",
  "TRANSACTION TYPE",
  "AMOUNT",
  "POSTED DATE/TIME",
  "AUSTIN TOURISM PID FEE 2% EX",
  "CITY TAX 11.22% EX",
  "STATE OCCUPANCY TAX 6.12% EX",
];

const ROOM_REVENUE_ITEMS = [
  "Room Charge-Pleas Trans",
  "Room Charge-Groups",
  "Pet Charge",
  "Cleaning Fee",
  "Guest Room Cancellation",
  "Adj - Guest Room Cancel",
  "Room Damage Reimburse",
];

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/&#xa;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function headerKey(value: unknown) {
  return normalizeHeader(value).replace(/[^A-Z0-9.%]+/g, " ").replace(/\s+/g, " ").trim();
}

function numberValue(value: unknown) {
  const raw = String(value ?? "").trim();
  const negative = /^\(.*\)$/.test(raw);
  const cleaned = raw.replace(/[$,%(),]/g, "").replace(/,/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? (negative ? -Math.abs(parsed) : parsed) : 0;
}

function round(value: number, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
}

function money(value: number) {
  return round(value, 2);
}

function get(row: RowRecord, key: string) {
  return row[headerKey(key)] ?? "";
}

function sum(rows: RowRecord[], key: string) {
  return money(rows.reduce((total, row) => total + numberValue(get(row, key)), 0));
}

function detectReportMonth(rows: RowRecord[]) {
  const candidates = rows.flatMap((row) => [
    get(row, "PROPERTY DATE"),
    get(row, "POSTED DATE/TIME"),
  ]).filter(Boolean);
  for (const candidate of candidates) {
    const iso = excelDateToIso(candidate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.slice(0, 7);
  }
  return "";
}

function parseWorkbook(file: Express.Multer.File) {
  const lower = file.originalname.toLowerCase();
  if (!lower.endsWith(".xlsx")) throw new Error(`${file.originalname} must be an XLSX file.`);
  return parseXlsxSheets(file.buffer);
}

function sheetHasHeaders(row: string[], requiredHeaders: string[]) {
  const keys = new Set(row.map(headerKey).filter(Boolean));
  return requiredHeaders.filter((required) => keys.has(headerKey(required))).length;
}

function findHeaderRow(sheet: SheetRows, requiredHeaders: string[]) {
  let best = { index: -1, score: 0 };
  sheet.rows.forEach((row, index) => {
    const score = sheetHasHeaders(row, requiredHeaders);
    if (score > best.score) best = { index, score };
  });
  return best.score >= Math.min(4, requiredHeaders.length) ? best.index : -1;
}

function parseSheetByHeaders(sheets: SheetRows[], requiredHeaders: string[], label: string): ParsedSheet {
  let selected: { sheet: SheetRows; headerIndex: number; score: number } | null = null;
  for (const sheet of sheets) {
    const headerIndex = findHeaderRow(sheet, requiredHeaders);
    if (headerIndex < 0) continue;
    const score = sheetHasHeaders(sheet.rows[headerIndex], requiredHeaders);
    if (!selected || score > selected.score) selected = { sheet, headerIndex, score };
  }
  if (!selected) return { sheetName: "", rows: [], headers: [], warnings: [`${label}: no sheet with the required headers was found.`] };
  const headers = selected.sheet.rows[selected.headerIndex].map(headerKey);
  const warnings = requiredHeaders
    .filter((header) => !headers.includes(headerKey(header)))
    .map((header) => `${label}: missing expected column "${header}".`);
  const rows = selected.sheet.rows.slice(selected.headerIndex + 1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "").trim()])));
  return { sheetName: selected.sheet.name, rows, headers, warnings };
}

function roomRevenueBase(rows: RowRecord[]) {
  const accepted = new Set(ROOM_REVENUE_ITEMS.map((item) => item.toLowerCase()));
  return money(rows
    .filter((row) => accepted.has(String(get(row, "ITEM")).trim().toLowerCase()))
    .reduce((total, row) => total + numberValue(get(row, "AMOUNT")), 0));
}

function exemptionGroups(rows: RowRecord[]) {
  const groups = new Map<string, any>();
  for (const row of rows) {
    const key = [
      get(row, "TAX EXEMPT ID") || "No ID",
      get(row, "TAX EXEMPT REASON") || "No reason",
      get(row, "NAME") || "No name",
      get(row, "CATEGORY") || "No category",
      get(row, "SUBCATEGORY") || "",
    ].join(" | ");
    const existing = groups.get(key) || {
      taxExemptId: get(row, "TAX EXEMPT ID") || "",
      taxExemptReason: get(row, "TAX EXEMPT REASON") || "",
      name: get(row, "NAME") || "",
      category: get(row, "CATEGORY") || "",
      subcategory: get(row, "SUBCATEGORY") || "",
      amount: 0,
      tourismPidExempt: 0,
      cityTaxExempt: 0,
      stateTaxExempt: 0,
      rowCount: 0,
    };
    existing.amount += numberValue(get(row, "AMOUNT"));
    existing.tourismPidExempt += numberValue(get(row, "AUSTIN TOURISM PID FEE 2% EX"));
    existing.cityTaxExempt += numberValue(get(row, "CITY TAX 11.22% EX"));
    existing.stateTaxExempt += numberValue(get(row, "STATE OCCUPANCY TAX 6.12% EX"));
    existing.rowCount += 1;
    groups.set(key, existing);
  }
  return Array.from(groups.values()).map((group) => ({
    ...group,
    amount: money(group.amount),
    tourismPidExempt: money(group.tourismPidExempt),
    cityTaxExempt: money(group.cityTaxExempt),
    stateTaxExempt: money(group.stateTaxExempt),
  }));
}

function accountingSummary(rows: RowRecord[]) {
  const interesting = ["ROOM CHARGE", "HOUSE CHARGE", "RESTAURANT TAX", "LIQUOR TAX", "MARKET", "BREAKFAST", "LUNCH", "DINNER"];
  const mapped = new Map<string, number>();
  let debitTotal = 0;
  let creditTotal = 0;
  for (const row of rows) {
    const text = Object.values(row).join(" ").toUpperCase();
    const amount = Object.values(row).reduce((found, value) => found || numberValue(value), 0);
    for (const label of interesting) {
      if (text.includes(label)) mapped.set(label, money((mapped.get(label) || 0) + amount));
    }
    if (text.includes("DEBIT")) debitTotal += Math.abs(amount);
    if (text.includes("CREDIT")) creditTotal += Math.abs(amount);
  }
  return {
    rows: Array.from(mapped.entries()).map(([label, amount]) => ({ label, amount })),
    debitTotal: money(debitTotal),
    creditTotal: money(creditTotal),
    balanced: Math.abs(debitTotal - creditTotal) < 1,
  };
}

function validateExemptions(groups: ReturnType<typeof exemptionGroups>) {
  const warnings: string[] = [];
  for (const group of groups) {
    const reason = String(group.taxExemptReason || "").toLowerCase();
    if (!group.taxExemptId && !reason.includes("permanent")) {
      warnings.push(`Exemption for ${group.name || group.category || "unknown account"} is missing an exemption ID/certificate reference.`);
    }
    if ((reason.includes("religious") || reason.includes("education") || reason.includes("educational")) && group.cityTaxExempt) {
      warnings.push(`Review local exemption for ${group.name || group.taxExemptId}: some Texas exemptions are state-only and may not remove Austin HOT.`);
    }
    if ((reason.includes("federal") || reason.includes("diplomat") || reason.includes("permanent")) && !group.cityTaxExempt && !group.stateTaxExempt) {
      warnings.push(`Review exemption ${group.name || group.taxExemptId}: reason suggests state/local exemption but no exempt tax was reported.`);
    }
  }
  return warnings;
}

function parseAccountingFile(file?: Express.Multer.File) {
  if (!file) return { sheetName: "", rows: [] as RowRecord[], warnings: ["Accounting Interface report was not uploaded."] };
  const sheets = parseWorkbook(file);
  const candidates = sheets.map((sheet) => ({
    sheet,
    score: sheet.rows.reduce((count, row) => count + (row.join(" ").match(/ROOM CHARGE|RESTAURANT TAX|DEBIT|CREDIT/i) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  const selected = candidates[0]?.sheet;
  if (!selected) return { sheetName: "", rows: [] as RowRecord[], warnings: ["Accounting Interface report had no readable sheets."] };
  const width = Math.max(...selected.rows.map((row) => row.length), 0);
  const headers = Array.from({ length: width }, (_, index) => `COL ${index + 1}`);
  const rows = selected.rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "").trim()])));
  return { sheetName: selected.name, rows, warnings: [] as string[] };
}

export function calculateComptrollerReports(files: UploadMap, options: {
  propertyId?: string;
  reportMonth?: string;
  includeMeetingRoomTaxInStateHOT?: boolean;
  overwrite?: boolean;
} = {}) {
  const settings = {
    ...DEFAULT_COMPTROLLER_TAX_SETTINGS,
    includeMeetingRoomTaxInStateHOT: options.includeMeetingRoomTaxInStateHOT ?? DEFAULT_COMPTROLLER_TAX_SETTINGS.includeMeetingRoomTaxInStateHOT,
  };
  const warnings: string[] = [];
  const taxPostings = files.taxPostings;
  if (!taxPostings) throw new Error("Tax Postings Dynamic XLSX is required.");
  const postingSheet = parseSheetByHeaders(parseWorkbook(taxPostings), POSTING_REQUIRED, "Tax Postings Dynamic");
  warnings.push(...postingSheet.warnings);

  const exemptionSheet = files.taxExemptions
    ? parseSheetByHeaders(parseWorkbook(files.taxExemptions), EXEMPTION_REQUIRED, "Tax Exemptions Dynamic")
    : { sheetName: "", rows: [] as RowRecord[], headers: [], warnings: ["Tax Exemptions Dynamic report was not uploaded."] };
  warnings.push(...exemptionSheet.warnings);

  const accounting = parseAccountingFile(files.accountingInterface);
  warnings.push(...accounting.warnings);

  const postingMonth = detectReportMonth(postingSheet.rows);
  const exemptionMonth = detectReportMonth(exemptionSheet.rows);
  const reportingMonth = options.reportMonth || postingMonth || exemptionMonth;
  if (postingMonth && exemptionMonth && postingMonth !== exemptionMonth) warnings.push(`Uploaded reports appear to be from different months: postings ${postingMonth}, exemptions ${exemptionMonth}.`);
  if (options.reportMonth && postingMonth && options.reportMonth !== postingMonth) warnings.push(`Selected month ${options.reportMonth} differs from Tax Postings month ${postingMonth}.`);

  const posted = {
    tourismPidFee: sum(postingSheet.rows, "AUSTIN TOURISM PID FEE 2% EX"),
    cityTax: money(sum(postingSheet.rows, "CITY TAX 11.22% EX") + sum(postingSheet.rows, "FEE CITY TAX 11.22% EX")),
    cityRoomTax: sum(postingSheet.rows, "CITY TAX 11.22% EX"),
    cityFeeTax: sum(postingSheet.rows, "FEE CITY TAX 11.22% EX"),
    stateTax: money(sum(postingSheet.rows, "STATE OCCUPANCY TAX 6.12% EX") + sum(postingSheet.rows, "FEE STATE TAX 6.12% EX")),
    stateRoomTax: sum(postingSheet.rows, "STATE OCCUPANCY TAX 6.12% EX"),
    stateFeeTax: sum(postingSheet.rows, "FEE STATE TAX 6.12% EX"),
    meetingRoomTax: sum(postingSheet.rows, "MEETING ROOM TAX 6% EX"),
    salesTax: sum(postingSheet.rows, "SALES TAX 8.25% EX"),
  };
  const finalStateHOT = money(posted.stateTax + (settings.includeMeetingRoomTaxInStateHOT ? posted.meetingRoomTax : 0));
  const finalTotalPayable = money(posted.tourismPidFee + posted.cityTax + finalStateHOT + posted.salesTax);

  const taxableRoomRevenue = roomRevenueBase(postingSheet.rows);
  const inferredTaxableRoomNightSales = posted.tourismPidFee ? money(posted.tourismPidFee / settings.tourismPIDRate) : taxableRoomRevenue;
  const groups = exemptionGroups(exemptionSheet.rows);
  const exemptionTotals = {
    amount: money(groups.reduce((total, group) => total + group.amount, 0)),
    tourismPidExempt: money(groups.reduce((total, group) => total + group.tourismPidExempt, 0)),
    cityTaxExempt: money(groups.reduce((total, group) => total + group.cityTaxExempt, 0)),
    stateTaxExempt: money(groups.reduce((total, group) => total + group.stateTaxExempt, 0)),
  };

  const expected = {
    tourismPidFee: money(inferredTaxableRoomNightSales * settings.tourismPIDRate),
    cityTax: money(inferredTaxableRoomNightSales * settings.cityHOTRate + posted.tourismPidFee * settings.cityHOTRate),
    stateTax: money(inferredTaxableRoomNightSales * settings.stateHOTRate + posted.tourismPidFee * settings.stateHOTRate),
    meetingRoomTax: posted.meetingRoomTax,
    salesTax: posted.salesTax,
  };
  const tolerance = settings.roundingTolerance;
  const auditDiffs = [
    ["TPID fee", posted.tourismPidFee, expected.tourismPidFee],
    ["Austin city HOT", posted.cityTax, expected.cityTax],
    ["State HOT", posted.stateTax, expected.stateTax],
  ] as const;
  for (const [label, actual, estimate] of auditDiffs) {
    if (Math.abs(actual - estimate) > tolerance) warnings.push(`${label} posted total ${money(actual)} differs from recalculated expected ${money(estimate)} by more than ${tolerance.toFixed(2)}. Review STAY postings before payment.`);
  }
  warnings.push(...validateExemptions(groups));
  const accountingResult = accountingSummary(accounting.rows);
  if (!accountingResult.balanced && (accountingResult.debitTotal || accountingResult.creditTotal)) warnings.push("Accounting Interface debits and credits do not balance.");

  const detailTable = [
    {
      taxCategory: "Austin Tourism PID Fee",
      sourceColumns: "AUSTIN TOURISM PID FEE 2% EX",
      taxRateLabel: "2%",
      taxableBaseAmount: inferredTaxableRoomNightSales,
      exemptAmount: exemptionTotals.tourismPidExempt,
      calculatedPostedTaxDue: posted.tourismPidFee,
      adjustmentAmount: money(posted.tourismPidFee - expected.tourismPidFee),
      finalPayableAmount: posted.tourismPidFee,
      notes: "Posted STAY column is payable source of truth; expected equals 2% of taxable room-night sales.",
    },
    {
      taxCategory: "Austin City HOT",
      sourceColumns: "CITY TAX 11.22% EX + FEE CITY TAX 11.22% EX",
      taxRateLabel: "11% HOT, 11.22% effective when TPID fee is taxed",
      taxableBaseAmount: inferredTaxableRoomNightSales,
      exemptAmount: exemptionTotals.cityTaxExempt,
      calculatedPostedTaxDue: posted.cityTax,
      adjustmentAmount: money(posted.cityTax - expected.cityTax),
      finalPayableAmount: posted.cityTax,
      notes: "Austin local HOT is 9% occupancy plus 2% venue project tax.",
    },
    {
      taxCategory: "State HOT",
      sourceColumns: "STATE OCCUPANCY TAX 6.12% EX + FEE STATE TAX 6.12% EX",
      taxRateLabel: "6% HOT, 6.12% effective when TPID fee is taxed",
      taxableBaseAmount: inferredTaxableRoomNightSales,
      exemptAmount: exemptionTotals.stateTaxExempt,
      calculatedPostedTaxDue: posted.stateTax,
      adjustmentAmount: money(posted.stateTax - expected.stateTax),
      finalPayableAmount: finalStateHOT,
      notes: settings.includeMeetingRoomTaxInStateHOT ? "Includes meeting room tax in state payment total." : "Meeting room tax shown separately.",
    },
    {
      taxCategory: "Meeting Room Tax",
      sourceColumns: "MEETING ROOM TAX 6% EX",
      taxRateLabel: "6%",
      taxableBaseAmount: null,
      exemptAmount: null,
      calculatedPostedTaxDue: posted.meetingRoomTax,
      adjustmentAmount: 0,
      finalPayableAmount: settings.includeMeetingRoomTaxInStateHOT ? 0 : posted.meetingRoomTax,
      notes: "Displayed separately and mapped according to Texas meeting/banquet room guidance.",
    },
    {
      taxCategory: "Sales Tax",
      sourceColumns: "SALES TAX 8.25% EX",
      taxRateLabel: "8.25%",
      taxableBaseAmount: null,
      exemptAmount: null,
      calculatedPostedTaxDue: posted.salesTax,
      adjustmentAmount: 0,
      finalPayableAmount: posted.salesTax,
      notes: "Sales tax is separated from hotel occupancy tax.",
    },
  ];

  return {
    propertyId: options.propertyId || COMPTROLLER_PROPERTY_ID,
    propertyName: COMPTROLLER_PROPERTY_NAME,
    reportingMonth,
    settings,
    sourceSheets: {
      taxPostings: postingSheet.sheetName,
      taxExemptions: exemptionSheet.sheetName,
      accountingInterface: accounting.sheetName,
    },
    uploadedReports: Object.values(files).filter(Boolean).map((file) => ({ originalFileName: file!.originalname, size: file!.size })),
    summary: {
      grossTaxableRoomRevenue: taxableRoomRevenue,
      inferredTaxableRoomNightSales,
      totalExemptRoomRevenue: exemptionTotals.amount,
      tourismPidFeeDue: posted.tourismPidFee,
      cityHotDue: posted.cityTax,
      stateHotBeforeMeetingRoom: posted.stateTax,
      meetingRoomTax: posted.meetingRoomTax,
      stateHotDue: finalStateHOT,
      salesTaxDue: posted.salesTax,
      totalTaxPaymentDue: finalTotalPayable,
    },
    posted,
    expected,
    exemptionTotals,
    exemptionGroups: groups,
    accounting: accountingResult,
    detailTable,
    warnings,
    drilldown: {
      taxPostings: postingSheet.rows.slice(0, 2000),
      taxExemptions: exemptionSheet.rows.slice(0, 2000),
      accountingInterface: accounting.rows.slice(0, 500),
    },
    officialGuidance: [
      { label: "Texas Comptroller Hotel Occupancy Tax", url: "https://comptroller.texas.gov/taxes/hotel/" },
      { label: "Texas Comptroller Hotel Occupancy Tax Exemptions", url: "https://comptroller.texas.gov/taxes/publications/96-224.php" },
      { label: "City of Austin Hotel Occupancy Tax FAQ", url: "https://www.austintexas.gov/financial-services/hotel-occupancy-taxes-faq" },
      { label: "Austin Tourism PID FAQ", url: "https://www.austintexas.org/austin-tpid/faq/" },
      { label: "Texas Comptroller STAR 202003026L", url: "https://star.comptroller.texas.gov/view/202003026L" },
    ],
  };
}

export function comptrollerSummaryCsv(payload: any) {
  const rows = [
    ["Tax Category", "Source Column(s)", "Tax Rate Label", "Taxable/Base Amount", "Exempt Amount", "Calculated / Posted Tax Due", "Adjustment Amount", "Final Payable Amount", "Notes"],
    ...((payload?.detailTable || []) as any[]).map((row) => [
      row.taxCategory,
      row.sourceColumns,
      row.taxRateLabel,
      row.taxableBaseAmount ?? "",
      row.exemptAmount ?? "",
      row.calculatedPostedTaxDue ?? "",
      row.adjustmentAmount ?? "",
      row.finalPayableAmount ?? "",
      row.notes ?? "",
    ]),
  ];
  return rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}
