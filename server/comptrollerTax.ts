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
type ComptrollerReviewIssue = {
  id: string;
  severity: "review" | "warning" | "info";
  category: string;
  title: string;
  summary: string;
  amountImpact?: number;
  reportKey: "taxPostings" | "taxExemptions" | "accountingInterface";
  rowIndexes: number[];
  rowCount: number;
  suggestedAction: string;
};

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

function excelCellText(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") {
    const candidate = value as any;
    if (candidate.text != null) return String(candidate.text).trim();
    if (candidate.result != null) return String(candidate.result).trim();
    if (candidate.value != null && typeof candidate.value !== "object") return String(candidate.value).trim();
    return "";
  }
  if (String(value).trim() === "[object Object]") return "";
  return String(value).trim();
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
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, excelCellText(row[index])])));
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
    balance: money(debitTotal - creditTotal),
    balanced: Math.abs(debitTotal - creditTotal) < 1,
  };
}

const TAX_COLUMNS = [
  "AUSTIN TOURISM PID FEE 2% EX",
  "CITY TAX 11.22% EX",
  "FEE CITY TAX 11.22% EX",
  "FEE STATE TAX 6.12% EX",
  "MEETING ROOM TAX 6% EX",
  "SALES TAX 8.25% EX",
  "STATE OCCUPANCY TAX 6.12% EX",
];

function rowHasNegativeValue(row: RowRecord) {
  return numberValue(get(row, "AMOUNT")) < 0 || TAX_COLUMNS.some((column) => numberValue(get(row, column)) < 0);
}

function explainTaxPostingRows(rows: RowRecord[]) {
  const explanations: Array<Record<string, unknown>> = [];
  const negativeRows = rows.filter(rowHasNegativeValue).slice(0, 80);
  const transferGroups = new Map<string, { positive: number; negative: number; count: number }>();

  rows.forEach((row) => {
    if (!String(get(row, "TRANSACTION TYPE")).toUpperCase().includes("TRANSFER")) return;
    const name = get(row, "ACCOUNT NAME") || "Unknown account";
    const group = transferGroups.get(name) || { positive: 0, negative: 0, count: 0 };
    const amount = numberValue(get(row, "AMOUNT"));
    if (amount >= 0) group.positive += amount;
    else group.negative += amount;
    group.count += 1;
    transferGroups.set(name, group);
  });

  for (const row of negativeRows) {
    const amount = numberValue(get(row, "AMOUNT"));
    const cityTax = numberValue(get(row, "CITY TAX 11.22% EX"));
    const name = get(row, "ACCOUNT NAME") || "Unknown account";
    const transactionType = get(row, "TRANSACTION TYPE") || "transaction";
    explanations.push({
      report: "Tax Postings",
      accountName: name,
      item: get(row, "ITEM"),
      transactionType,
      amount,
      cityTax,
      propertyDate: excelDateToIso(get(row, "PROPERTY DATE")),
      explanation: `${transactionType} rows with negative room revenue or negative tax reduce the payable tax totals because STAY posted them as reversals, corrections, transfers, credits, or tax adjustments. They should stay negative unless the PMS posting itself is wrong.`,
    });
  }

  Array.from(transferGroups.entries()).forEach(([name, group]) => {
    if (!group.positive || !group.negative) return;
    explanations.unshift({
      report: "Tax Postings",
      accountName: name,
      item: "Transfer activity",
      transactionType: "TRANSFER",
      amount: money(group.positive + group.negative),
      explanation: `${name} has both positive and negative transfer postings. This usually means STAY moved charges between folios or group/reservation accounts. The negative entries, such as -$14 city tax style amounts, offset prior posted tax rather than creating a new payable charge.`,
      rowCount: group.count,
    });
  });

  return explanations.slice(0, 100);
}

function validateExemptions(groups: ReturnType<typeof exemptionGroups>) {
  const warnings: string[] = [];
  const blankReasonWithTax = groups.filter((group) => {
    const reason = String(group.taxExemptReason || "").trim();
    return !reason && (group.tourismPidExempt || group.cityTaxExempt || group.stateTaxExempt);
  });
  const stateOnlyBlankReason = blankReasonWithTax.filter((group) => group.stateTaxExempt && !group.cityTaxExempt && !group.tourismPidExempt);

  if (blankReasonWithTax.length) {
    const examples = blankReasonWithTax.slice(0, 5).map((group) => `${group.name || group.category || group.taxExemptId} (${group.taxExemptId || "no ID"})`).join(", ");
    warnings.push(`${blankReasonWithTax.length} exemption rows remove tax but have no exemption reason. Verify the exemption type/certificate before relying on the exempt treatment. Examples: ${examples}.`);
  }
  if (stateOnlyBlankReason.length) {
    const examples = stateOnlyBlankReason.slice(0, 5).map((group) => `${group.name || group.category || group.taxExemptId} (${group.taxExemptId || "no ID"})`).join(", ");
    warnings.push(`${stateOnlyBlankReason.length} exemption rows appear to remove state tax only, with no local/city exemption and no exemption reason. Verify these are valid state-only exemptions. Examples: ${examples}.`);
  }

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

function buildReviewIssues({
  postingRows,
  exemptionRows,
  posted,
  expected,
  tolerance,
}: {
  postingRows: RowRecord[];
  exemptionRows: RowRecord[];
  posted: { cityTax: number; stateTax: number; tourismPidFee: number };
  expected: { cityTax: number; stateTax: number; tourismPidFee: number };
  tolerance: number;
}) {
  const issues: ComptrollerReviewIssue[] = [];
  const cityVariance = money(posted.cityTax - expected.cityTax);
  const stateVariance = money(posted.stateTax - expected.stateTax);
  const tpidVariance = money(posted.tourismPidFee - expected.tourismPidFee);
  const cityRows = postingRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const item = String(get(row, "ITEM")).toUpperCase();
      return item.includes("CITY TAX") ||
        numberValue(get(row, "FEE CITY TAX 11.22% EX")) !== 0 ||
        numberValue(get(row, "CITY TAX 11.22% EX")) < 0;
    })
    .map(({ index }) => index);
  const stateRows = postingRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const item = String(get(row, "ITEM")).toUpperCase();
      return item.includes("STATE OCCUPANCY TAX") ||
        numberValue(get(row, "FEE STATE TAX 6.12% EX")) !== 0 ||
        numberValue(get(row, "STATE OCCUPANCY TAX 6.12% EX")) < 0;
    })
    .map(({ index }) => index);
  const tpidRows = postingRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const item = String(get(row, "ITEM")).toUpperCase();
      return item.includes("TOURISM PID") || numberValue(get(row, "AUSTIN TOURISM PID FEE 2% EX")) < 0;
    })
    .map(({ index }) => index);
  const missingReasonRows = exemptionRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !String(get(row, "TAX EXEMPT REASON")).trim() && TAX_COLUMNS.some((column) => numberValue(get(row, column)) !== 0))
    .map(({ index }) => index);
  const stateOnlyRows = exemptionRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const hasReason = String(get(row, "TAX EXEMPT REASON")).trim();
      return !hasReason &&
        numberValue(get(row, "STATE OCCUPANCY TAX 6.12% EX")) !== 0 &&
        numberValue(get(row, "CITY TAX 11.22% EX")) === 0 &&
        numberValue(get(row, "AUSTIN TOURISM PID FEE 2% EX")) === 0;
    })
    .map(({ index }) => index);
  const negativeTaxRows = postingRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => TAX_COLUMNS.some((column) => numberValue(get(row, column)) < 0))
    .map(({ index }) => index);

  if (Math.abs(tpidVariance) > tolerance) {
    issues.push({
      id: "tpid-variance",
      severity: "warning",
      category: "Tax variance",
      title: "Austin TPID fee variance",
      summary: `Posted ${money(posted.tourismPidFee)} differs from expected ${money(expected.tourismPidFee)} by ${money(tpidVariance)}.`,
      amountImpact: tpidVariance,
      reportKey: "taxPostings",
      rowIndexes: tpidRows,
      rowCount: tpidRows.length,
      suggestedAction: "Review TPID fee adjustment and negative TPID rows.",
    });
  }
  if (Math.abs(cityVariance) > tolerance) {
    issues.push({
      id: "city-hot-variance",
      severity: "review",
      category: "Tax variance",
      title: "Austin City HOT variance",
      summary: `Posted ${money(posted.cityTax)} differs from expected ${money(expected.cityTax)} by ${money(cityVariance)}.`,
      amountImpact: cityVariance,
      reportKey: "taxPostings",
      rowIndexes: cityRows,
      rowCount: cityRows.length,
      suggestedAction: "Review city tax adjustment, fee-city-tax, and negative city tax rows.",
    });
  }
  if (Math.abs(stateVariance) > tolerance) {
    issues.push({
      id: "state-hot-variance",
      severity: "review",
      category: "Tax variance",
      title: "State HOT variance",
      summary: `Posted ${money(posted.stateTax)} differs from expected ${money(expected.stateTax)} by ${money(stateVariance)}.`,
      amountImpact: stateVariance,
      reportKey: "taxPostings",
      rowIndexes: stateRows,
      rowCount: stateRows.length,
      suggestedAction: "Review state tax adjustment, fee-state-tax, and negative state tax rows.",
    });
  }
  if (missingReasonRows.length) {
    issues.push({
      id: "exemptions-missing-reason",
      severity: "review",
      category: "Exemption setup",
      title: "Exemptions missing reason",
      summary: `${missingReasonRows.length} exemption rows remove tax but have no exemption reason.`,
      reportKey: "taxExemptions",
      rowIndexes: missingReasonRows,
      rowCount: missingReasonRows.length,
      suggestedAction: "Verify the exemption type/certificate in STAY or accounting support.",
    });
  }
  if (stateOnlyRows.length) {
    issues.push({
      id: "state-only-exemptions-missing-reason",
      severity: "warning",
      category: "Exemption setup",
      title: "Possible state-only exemptions",
      summary: `${stateOnlyRows.length} rows remove state tax only but have no exemption reason.`,
      reportKey: "taxExemptions",
      rowIndexes: stateOnlyRows,
      rowCount: stateOnlyRows.length,
      suggestedAction: "Confirm these are valid state-only exemptions and not missing local exemption setup.",
    });
  }
  if (negativeTaxRows.length) {
    issues.push({
      id: "negative-tax-postings",
      severity: "info",
      category: "Posting adjustments",
      title: "Negative tax posting rows",
      summary: `${negativeTaxRows.length} tax posting rows reduce one or more tax columns.`,
      reportKey: "taxPostings",
      rowIndexes: negativeTaxRows,
      rowCount: negativeTaxRows.length,
      suggestedAction: "Review if the variance is unexpected. Negative rows often represent transfers, reversals, credits, or corrections.",
    });
  }

  return issues;
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
  const rows = selected.rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, excelCellText(row[index])])));
  return { sheetName: selected.name, rows, warnings: [] as string[] };
}

function buildComptrollerPayload(parsed: {
  postingSheet: ParsedSheet;
  exemptionSheet: ParsedSheet;
  accounting: { sheetName: string; rows: RowRecord[]; warnings: string[] };
  uploadedReports?: Array<Record<string, unknown>>;
  sourceSheets?: Record<string, string>;
}, options: {
  propertyId?: string;
  reportMonth?: string;
  includeMeetingRoomTaxInStateHOT?: boolean;
  overwrite?: boolean;
} = {}) {
  const settings = {
    ...DEFAULT_COMPTROLLER_TAX_SETTINGS,
    includeMeetingRoomTaxInStateHOT: options.includeMeetingRoomTaxInStateHOT ?? DEFAULT_COMPTROLLER_TAX_SETTINGS.includeMeetingRoomTaxInStateHOT,
  };
  const warnings: string[] = [
    ...parsed.postingSheet.warnings,
    ...parsed.exemptionSheet.warnings,
    ...parsed.accounting.warnings,
  ];
  const postingSheet = parsed.postingSheet;
  const exemptionSheet = parsed.exemptionSheet;
  const accounting = parsed.accounting;

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
  const postedAllTaxColumnsTotal = money(
    posted.tourismPidFee +
    posted.cityRoomTax +
    posted.cityFeeTax +
    posted.stateRoomTax +
    posted.stateFeeTax +
    posted.meetingRoomTax +
    posted.salesTax,
  );
  const finalStateHOT = money(posted.stateTax + (settings.includeMeetingRoomTaxInStateHOT ? posted.meetingRoomTax : 0));
  const hotelOccupancyAndTpidDue = money(posted.tourismPidFee + posted.cityTax + finalStateHOT);
  const finalTotalPayable = money(hotelOccupancyAndTpidDue + posted.salesTax);

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
  const reviewIssues = buildReviewIssues({
    postingRows: postingSheet.rows,
    exemptionRows: exemptionSheet.rows,
    posted,
    expected,
    tolerance,
  });

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
      postedDue: posted.tourismPidFee,
      expectedDue: expected.tourismPidFee,
      variance: money(posted.tourismPidFee - expected.tourismPidFee),
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
      postedDue: posted.cityTax,
      expectedDue: expected.cityTax,
      variance: money(posted.cityTax - expected.cityTax),
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
      postedDue: posted.stateTax,
      expectedDue: expected.stateTax,
      variance: money(posted.stateTax - expected.stateTax),
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
      postedDue: posted.meetingRoomTax,
      expectedDue: expected.meetingRoomTax,
      variance: 0,
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
      postedDue: posted.salesTax,
      expectedDue: expected.salesTax,
      variance: 0,
      notes: "Sales tax is separated from hotel occupancy tax.",
    },
  ];

  return {
    propertyId: options.propertyId || COMPTROLLER_PROPERTY_ID,
    propertyName: COMPTROLLER_PROPERTY_NAME,
    reportingMonth,
    settings,
    sourceSheets: {
      taxPostings: parsed.sourceSheets?.taxPostings || postingSheet.sheetName,
      taxExemptions: parsed.sourceSheets?.taxExemptions || exemptionSheet.sheetName,
      accountingInterface: parsed.sourceSheets?.accountingInterface || accounting.sheetName,
    },
    uploadedReports: parsed.uploadedReports || [],
    summary: {
      grossTaxableRoomRevenue: taxableRoomRevenue,
      inferredTaxableRoomNightSales,
      totalExemptRoomRevenue: exemptionTotals.amount,
      tourismPidFeeDue: posted.tourismPidFee,
      cityHotDue: posted.cityTax,
      stateHotBeforeMeetingRoom: posted.stateTax,
      meetingRoomTax: posted.meetingRoomTax,
      stateHotDue: finalStateHOT,
      hotelOccupancyAndTpidDue,
      salesTaxDue: posted.salesTax,
      totalTaxPaymentDue: finalTotalPayable,
      grandPostedTaxAndFeeTotal: finalTotalPayable,
    },
    posted,
    postedAllTaxColumnsTotal,
    expected,
    exemptionTotals,
    exemptionGroups: groups,
    accounting: accountingResult,
    detailTable,
    warnings,
    reviewIssues,
    explanations: explainTaxPostingRows(postingSheet.rows),
    drilldown: {
      taxPostings: postingSheet.rows,
      taxExemptions: exemptionSheet.rows,
      accountingInterface: accounting.rows,
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

export function calculateComptrollerReports(files: UploadMap, options: {
  propertyId?: string;
  reportMonth?: string;
  includeMeetingRoomTaxInStateHOT?: boolean;
  overwrite?: boolean;
} = {}) {
  const warnings: string[] = [];
  const taxPostings = files.taxPostings;
  if (!taxPostings) throw new Error("Tax Postings Dynamic XLSX is required.");
  const postingSheet = parseSheetByHeaders(parseWorkbook(taxPostings), POSTING_REQUIRED, "Tax Postings Dynamic");

  const exemptionSheet = files.taxExemptions
    ? parseSheetByHeaders(parseWorkbook(files.taxExemptions), EXEMPTION_REQUIRED, "Tax Exemptions Dynamic")
    : { sheetName: "", rows: [] as RowRecord[], headers: [], warnings: ["Tax Exemptions Dynamic report was not uploaded."] };

  const accounting = parseAccountingFile(files.accountingInterface);
  warnings.push(...postingSheet.warnings, ...exemptionSheet.warnings, ...accounting.warnings);

  return buildComptrollerPayload({
    postingSheet,
    exemptionSheet,
    accounting,
    uploadedReports: Object.values(files).filter(Boolean).map((file) => ({ originalFileName: file!.originalname, size: file!.size })),
  }, options);
}

export function recalculateComptrollerPayload(existingPayload: any, edits: {
  taxPostings?: RowRecord[];
  taxExemptions?: RowRecord[];
  accountingInterface?: RowRecord[];
}, options: {
  propertyId?: string;
  reportMonth?: string;
  includeMeetingRoomTaxInStateHOT?: boolean;
} = {}) {
  const sourceSheets = existingPayload?.sourceSheets || {};
  return buildComptrollerPayload({
    postingSheet: {
      sheetName: sourceSheets.taxPostings || "Edited Tax Postings",
      rows: edits.taxPostings || existingPayload?.drilldown?.taxPostings || [],
      headers: [],
      warnings: [],
    },
    exemptionSheet: {
      sheetName: sourceSheets.taxExemptions || "Edited Tax Exemptions",
      rows: edits.taxExemptions || existingPayload?.drilldown?.taxExemptions || [],
      headers: [],
      warnings: [],
    },
    accounting: {
      sheetName: sourceSheets.accountingInterface || "Edited Accounting Interface",
      rows: edits.accountingInterface || existingPayload?.drilldown?.accountingInterface || [],
      warnings: [],
    },
    uploadedReports: existingPayload?.uploadedReports || [],
    sourceSheets,
  }, {
    propertyId: options.propertyId || existingPayload?.propertyId,
    reportMonth: options.reportMonth || existingPayload?.reportingMonth,
    includeMeetingRoomTaxInStateHOT: options.includeMeetingRoomTaxInStateHOT ?? existingPayload?.settings?.includeMeetingRoomTaxInStateHOT,
  });
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
