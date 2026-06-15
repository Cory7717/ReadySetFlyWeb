import type { Express } from "express";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { createRequire } from "module";
import { randomUUID } from "crypto";
import OpenAI from "openai";
import { z } from "zod";

const require = createRequire(import.meta.url);

export type OpsReportType =
  | "previous_week_otb"
  | "current_month_otb"
  | "remaining_month_otb"
  | "next_month_otb"
  | "current_month_sdly_otb"
  | "next_month_sdly_otb"
  | "analytical_account_tracking"
  | "detailed_flash"
  | "ooo_rooms"
  | "gss_scores"
  | "marriott_responses"
  | "ar_aging"
  | "credit_limit";

export type OpsParserContext = {
  weekStart?: string;
  weekEnd?: string;
  reportMonth?: string;
  totalRooms?: number;
};

type ParsedReport = {
  uploadId: string;
  originalFileName: string;
  sourceFileName: string;
  reportType: OpsReportType;
  status: "parsed" | "warning";
  warnings: string[];
  selectedWeek: string;
  weekStartDate: string;
  weekEndDate: string;
  reportMonth: string;
  createdAt: string;
  preview: Array<Record<string, unknown>>;
  mapping: Record<string, unknown>;
};

const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const openaiBaseUrl = (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || "").trim();
const openai = openaiApiKey
  ? new OpenAI({
      apiKey: openaiApiKey,
      ...(openaiBaseUrl ? { baseURL: openaiBaseUrl } : {}),
    })
  : null;

const mintPacingScreenshotSchema = z.object({
  stayDateStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stayDateEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reportRunDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  roomNightsTy: z.coerce.number().min(0),
  roomNightsStly: z.coerce.number().min(0),
  roomRevenueTy: z.coerce.number().min(0),
  roomRevenueStly: z.coerce.number().min(0),
  adrTy: z.coerce.number().min(0),
  adrStly: z.coerce.number().min(0),
});

function normalizedHeader(value: unknown) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/&#xa;/gi, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

function numeric(value: unknown) {
  const raw = String(value ?? "").trim();
  const negative = /^\(.*\)$/.test(raw);
  const cleaned = raw.replace(/Avg:/i, "").replace(/[$,%(),]/g, "").replace(/,/g, "").trim();
  const number = Number(cleaned);
  return Number.isFinite(number) ? (negative ? -Math.abs(number) : number) : 0;
}

function round(value: number, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
}

export function excelDateToIso(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const serial = Number(raw);
  if (Number.isFinite(serial) && serial > 20000) {
    const wholeDays = Math.floor(serial);
    const date = new Date(Date.UTC(1899, 11, 30) + wholeDays * 86400000);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

export function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"' && quoted && source[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  row.push(value.trim());
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function colIndex(ref: string) {
  const letters = (ref || "").match(/[A-Z]+/)?.[0] || "";
  let result = 0;
  for (const character of letters) result = result * 26 + character.charCodeAt(0) - 64;
  return result - 1;
}

function inlineText(value: any): string {
  if (!value) return "";
  const runs = value.r ? (Array.isArray(value.r) ? value.r : [value.r]) : [];
  if (runs.length) return runs.map((run: any) => typeof run.t === "string" ? run.t : run.t?.["#text"] || "").join("");
  return typeof value.t === "string" ? value.t : value.t?.["#text"] || "";
}

export function parseXlsxSheets(buffer: Buffer) {
  const zip = new AdmZip(buffer);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false });
  const entry = (name: string) => zip.getEntry(name)?.getData().toString("utf8") || "";
  const workbook = parser.parse(entry("xl/workbook.xml"));
  const relationships = parser.parse(entry("xl/_rels/workbook.xml.rels"));
  const sharedXml = entry("xl/sharedStrings.xml");
  const shared = sharedXml
    ? ([] as any[]).concat(parser.parse(sharedXml).sst?.si || []).map((item) => inlineText(item) || String(item.t || ""))
    : [];
  const relationshipMap = new Map(
    ([] as any[]).concat(relationships.Relationships?.Relationship || [])
      .map((relationship) => [relationship["@_Id"], String(relationship["@_Target"]).replace(/^\//, "")]),
  );
  return ([] as any[]).concat(workbook.workbook?.sheets?.sheet || []).map((sheet) => {
    const target = relationshipMap.get(sheet["@_r:id"]);
    const normalizedTarget = String(target || "").replace(/^\//, "");
    const xml = entry(normalizedTarget) || entry(`xl/${normalizedTarget}`);
    const parsed = xml ? parser.parse(xml) : null;
    const rows = ([] as any[]).concat(parsed?.worksheet?.sheetData?.row || []).map((sourceRow) => {
      const cells: string[] = [];
      for (const cell of ([] as any[]).concat(sourceRow.c || [])) {
        cells[colIndex(cell["@_r"])] = cell["@_t"] === "s"
          ? shared[Number(cell.v)] || ""
          : cell["@_t"] === "inlineStr"
            ? inlineText(cell.is)
            : String(cell.v ?? "");
      }
      return cells;
    });
    return { name: String(sheet["@_name"] || ""), rows };
  });
}

function monthKey(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 7);
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

function monthFromFileName(fileName: string, year: number) {
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const lower = fileName.toLowerCase();
  const index = months.findIndex((month) => new RegExp(`\\b${month}\\b`, "i").test(lower));
  return index < 0 ? "" : `${year}-${String(index + 1).padStart(2, "0")}`;
}

function findHeader(rows: string[][], required: string[]) {
  return rows.findIndex((row) => {
    const normalized = row.map(normalizedHeader);
    return required.every((label) => normalized.includes(normalizedHeader(label)));
  });
}

function headerIndexes(header: string[]) {
  const normalized = header.map(normalizedHeader);
  return {
    find: (...labels: string[]) => normalized.findIndex((cell) => labels.some((label) => cell === normalizedHeader(label))),
    includes: (...labels: string[]) => normalized.findIndex((cell) => labels.some((label) => cell.includes(normalizedHeader(label)))),
  };
}

function selectedWeekLabel(context: OpsParserContext) {
  return context.weekStart && context.weekEnd ? `${context.weekStart}/${context.weekEnd}` : "";
}

function baseReport(file: Express.Multer.File, reportType: OpsReportType, context: OpsParserContext, warnings: string[]): Omit<ParsedReport, "preview" | "mapping"> {
  return {
    uploadId: randomUUID(),
    originalFileName: file.originalname,
    sourceFileName: file.originalname,
    reportType,
    status: warnings.length ? "warning" : "parsed",
    warnings,
    selectedWeek: selectedWeekLabel(context),
    weekStartDate: context.weekStart || "",
    weekEndDate: context.weekEnd || "",
    reportMonth: context.reportMonth || (context.weekStart ? monthKey(context.weekStart) : ""),
    createdAt: new Date().toISOString(),
  };
}

export function detectOpsReportType(fileName: string, rows: string[][], context: OpsParserContext): OpsReportType | null {
  const name = fileName.toLowerCase();
  const flattenedHeaders = rows.slice(0, 12).flat().map(normalizedHeader);
  if (/analytical\s*account\s*tracking/.test(name) || (
    flattenedHeaders.includes("global ultimate account name")
    && flattenedHeaders.includes("current room revenue")
    && flattenedHeaders.includes("current room nights")
  )) return "analytical_account_tracking";
  if (/detailed\s*flash|detailed_flash/.test(name) || (flattenedHeaders.includes("group") && flattenedHeaders.includes("category") && flattenedHeaders.some((value) => value.includes("month to date")))) return "detailed_flash";
  if (/ooo\s*rooms|out\s*of\s*order/.test(name)) return "ooo_rooms";
  if (/marriott[_\s-]*responses|responses[_\s-]*export/.test(name) || (flattenedHeaders.includes("response date") && flattenedHeaders.includes("overall comment"))) return "marriott_responses";
  if (/gss\s*scores?/.test(name) || (flattenedHeaders.includes("intent to recommend property") && flattenedHeaders.includes("benchmark"))) return "gss_scores";
  if (/ar\s*aging|aged\s*receivables?|accounts?\s*receivable/.test(name) || flattenedHeaders.some((value) => value.includes("120+")) && flattenedHeaders.some((value) => value.includes("current"))) return "ar_aging";
  const otbHeader = findHeader(rows, ["Date", "Rms Sold", "Occ %", "Rm Rev ($)"]);
  if (/previous\s*week\s*otb/.test(name)) return "previous_week_otb";
  if (/remaining\s*month\s*otb/.test(name)) return "remaining_month_otb";
  if (otbHeader >= 0 || /month\s*otb/.test(name)) {
    const reportMonth = context.reportMonth || (context.weekStart ? monthKey(context.weekStart) : "");
    const reportYear = Number(reportMonth.slice(0, 4)) || new Date().getUTCFullYear();
    const namedMonth = monthFromFileName(fileName, reportYear);
    const firstDate = rows.slice(otbHeader + 1).map((row) => excelDateToIso(row[0])).find(Boolean) || "";
    if (firstDate && monthKey(firstDate) === reportMonth) return "current_month_otb";
    if (firstDate && monthKey(firstDate) === nextMonthKey(reportMonth)) return "next_month_otb";
    if (firstDate && monthKey(firstDate) === priorYearMonthKey(nextMonthKey(reportMonth))) return "next_month_sdly_otb";
    if (namedMonth && namedMonth === reportMonth) return "current_month_otb";
    if (namedMonth && namedMonth === nextMonthKey(reportMonth)) return "next_month_otb";
    return "previous_week_otb";
  }
  return null;
}

function parseOtb(file: Express.Multer.File, rows: string[][], reportType: OpsReportType, context: OpsParserContext): ParsedReport {
  const warnings: string[] = [];
  const headerIndex = findHeader(rows, ["Date", "Rms Sold", "Occ %"]);
  if (headerIndex < 0) throw new Error("OTB headers were not found.");
  const header = rows[headerIndex];
  const indexes = headerIndexes(header);
  const index = {
    date: indexes.find("Date"),
    roomsActive: indexes.find("Rms Active"),
    roomsAvailable: indexes.find("Rms Available"),
    roomsSold: indexes.find("Rms Sold"),
    groupPickup: indexes.find("Group PU"),
    groupUnpicked: indexes.find("Group UnPU"),
    occupancy: indexes.find("Occ %"),
    guests: indexes.find("Guests (A/C)"),
    arrivals: indexes.find("Arr"),
    departures: indexes.find("Dept"),
    ooo: indexes.find("OOO"),
    otm: indexes.find("OTM"),
    adr: indexes.find("ADR Sold ($)"),
    revpar: indexes.find("RevPAR ($)"),
    revenue: indexes.find("Rm Rev ($)"),
  };
  for (const [key, value] of Object.entries(index)) if (value < 0) warnings.push(`Missing OTB column: ${key}.`);
  const sourceRows = rows.slice(headerIndex + 1);
  const daily = sourceRows.flatMap((row) => {
    const date = excelDateToIso(row[index.date]);
    if (!date || /^total$/i.test(String(row[index.date] || "").trim())) return [];
    return [{
      date,
      roomsActive: numeric(row[index.roomsActive]),
      roomsAvailable: numeric(row[index.roomsAvailable]),
      roomsSold: numeric(row[index.roomsSold]),
      groupPickup: numeric(row[index.groupPickup]),
      groupUnpicked: numeric(row[index.groupUnpicked]),
      occupancy: numeric(row[index.occupancy]),
      guests: String(row[index.guests] || "").trim(),
      arrivals: numeric(row[index.arrivals]),
      departures: numeric(row[index.departures]),
      ooo: numeric(row[index.ooo]),
      otm: numeric(row[index.otm]),
      adr: numeric(row[index.adr]),
      revpar: numeric(row[index.revpar]),
      roomRevenue: numeric(row[index.revenue]),
    }];
  });
  const totalSource = sourceRows.find((row) => /^total$/i.test(String(row[index.date] || "").trim()));
  const sum = (key: keyof typeof daily[number]) => daily.reduce((total, row) => total + (typeof row[key] === "number" ? Number(row[key]) : 0), 0);
  const roomsSold = totalSource ? numeric(totalSource[index.roomsSold]) : sum("roomsSold");
  const roomRevenue = totalSource ? numeric(totalSource[index.revenue]) : sum("roomRevenue");
  const roomsActive = totalSource ? numeric(totalSource[index.roomsActive]) : sum("roomsActive");
  const total = {
    roomsActive,
    roomsAvailable: totalSource ? numeric(totalSource[index.roomsAvailable]) : sum("roomsAvailable"),
    roomsSold,
    groupPickup: totalSource ? numeric(totalSource[index.groupPickup]) : sum("groupPickup"),
    groupUnpicked: totalSource ? numeric(totalSource[index.groupUnpicked]) : sum("groupUnpicked"),
    occupancy: totalSource ? numeric(totalSource[index.occupancy]) : roomsActive ? roomsSold / roomsActive * 100 : 0,
    guests: totalSource ? String(totalSource[index.guests] || "").trim() : "",
    arrivals: totalSource ? numeric(totalSource[index.arrivals]) : sum("arrivals"),
    departures: totalSource ? numeric(totalSource[index.departures]) : sum("departures"),
    ooo: totalSource ? numeric(totalSource[index.ooo]) : sum("ooo"),
    otm: totalSource ? numeric(totalSource[index.otm]) : sum("otm"),
    adr: totalSource ? numeric(totalSource[index.adr]) : roomsSold ? roomRevenue / roomsSold : 0,
    revpar: totalSource ? numeric(totalSource[index.revpar]) : roomsActive ? roomRevenue / roomsActive : 0,
    roomRevenue,
  };
  if (reportType === "previous_week_otb" && context.weekStart && context.weekEnd) {
    const outside = daily.filter((row) => row.date < context.weekStart! || row.date > context.weekEnd!);
    if (outside.length) warnings.push(`${outside.length} OTB row(s) fall outside the selected report week.`);
  }
  if (!totalSource) warnings.push("TOTAL row was not found; totals were calculated from daily rows.");
  return {
    ...baseReport(file, reportType, context, warnings),
    preview: daily.slice(0, 10),
    mapping: {
      daily,
      total: Object.fromEntries(Object.entries(total).map(([key, value]) => [key, typeof value === "number" ? round(value, 2) : value])),
      dateStart: daily[0]?.date || "",
      dateEnd: daily[daily.length - 1]?.date || "",
    },
  };
}

function parseDetailedFlash(file: Express.Multer.File, rows: string[][], context: OpsParserContext): ParsedReport {
  const warnings: string[] = [];
  const headerIndex = findHeader(rows, ["GROUP", "CATEGORY"]);
  if (headerIndex < 0) throw new Error("Detailed Flash headers were not found.");
  const header = rows[headerIndex].map(normalizedHeader);
  const groupIndex = header.indexOf("group");
  const categoryIndex = header.indexOf("category");
  const mtdRooms = header.findIndex((value) => value.includes("month to date") && value.includes("rooms"));
  const mtdRatio = header.findIndex((value) => value.includes("month to date") && value.includes("ratio"));
  const ytdRooms = header.findIndex((value) => value.includes("year to date") && value.includes("rooms"));
  const ytdRatio = header.findIndex((value) => value.includes("year to date") && value.includes("ratio"));
  if ([mtdRooms, mtdRatio, ytdRooms, ytdRatio].some((index) => index < 0)) warnings.push("One or more Detailed Flash MTD/YTD columns were not found.");
  const find = (group: string, category: string) => rows.slice(headerIndex + 1).find((row) =>
    normalizedHeader(row[groupIndex]) === normalizedHeader(group) && normalizedHeader(row[categoryIndex]) === normalizedHeader(category));
  const roomsOccupied = find("Availability", "Rooms Occupied");
  const roomsAvailable = find("Availability", "Rooms available");
  const roomsSold = find("Availability", "Total rooms sold");
  const transientRevenue = find("Revenue", "Room Revenue Transient");
  const groupRevenue = find("Revenue", "Room Revenue Group");
  const adr = find("Revenue", "ADR Sold");
  for (const [label, row] of [["Rooms Occupied", roomsOccupied], ["Rooms available", roomsAvailable], ["Total rooms sold", roomsSold], ["Room Revenue Transient", transientRevenue], ["Room Revenue Group", groupRevenue], ["ADR Sold", adr]] as const) {
    if (!row) warnings.push(`Detailed Flash row not found: ${label}.`);
  }
  const mapping = {
    mtd: {
      adr: numeric(adr?.[mtdRooms]),
      roomsSold: numeric(roomsSold?.[mtdRooms]),
      availableRooms: numeric(roomsAvailable?.[mtdRooms]),
      occupancy: numeric(roomsOccupied?.[mtdRatio]),
      roomRevenue: numeric(transientRevenue?.[mtdRooms]) + numeric(groupRevenue?.[mtdRooms]),
    },
    ytd: {
      adr: numeric(adr?.[ytdRooms]),
      roomsSold: numeric(roomsSold?.[ytdRooms]),
      availableRooms: numeric(roomsAvailable?.[ytdRooms]),
      occupancy: numeric(roomsOccupied?.[ytdRatio]),
      roomRevenue: numeric(transientRevenue?.[ytdRooms]) + numeric(groupRevenue?.[ytdRooms]),
    },
  };
  return { ...baseReport(file, "detailed_flash", context, warnings), preview: [mapping.mtd, mapping.ytd], mapping };
}

function parseAnalyticalAccountTracking(
  file: Express.Multer.File,
  sheets: Array<{ name: string; rows: string[][] }>,
  context: OpsParserContext,
): ParsedReport {
  const warnings: string[] = [];
  const dataSheet = sheets.find((sheet) => normalizedHeader(sheet.name).startsWith("analytical account tracking"))
    || sheets.find((sheet) => findHeader(sheet.rows, ["Global Ultimate Account Name", "Current Room Revenue"]) >= 0);
  const filtersSheet = sheets.find((sheet) => normalizedHeader(sheet.name) === "filters");
  if (!dataSheet) throw new Error("Analytical Account Tracking data sheet was not found.");
  if (!filtersSheet) throw new Error("Analytical Account Tracking Filters sheet was not found.");

  const headerIndex = findHeader(dataSheet.rows, ["Global Ultimate Account Name", "Current Room Nights", "Current Room Revenue"]);
  if (headerIndex < 0) throw new Error("Analytical Account Tracking revenue headers were not found.");
  const indexes = headerIndexes(dataSheet.rows[headerIndex]);
  const roomNightsIndex = indexes.find("Current Room Nights");
  const roomRevenueIndex = indexes.find("Current Room Revenue");
  if (roomNightsIndex < 0 || roomRevenueIndex < 0) throw new Error("Current Room Nights or Current Room Revenue column was not found.");

  const timeframeText = filtersSheet.rows
    .flat()
    .map((value) => String(value || "").trim())
    .find((value) => /^timeframe:/i.test(value)) || "";
  const timeframeMatch = timeframeText.match(
    /timeframe:\s*([A-Za-z]{3,9})\s+(\d{1,2})\s+(\d{4})\s*-\s*([A-Za-z]{3,9})\s+(\d{1,2})\s+(\d{4})/i,
  );
  if (!timeframeMatch) throw new Error("The Filters sheet timeframe could not be read.");
  const parseFilterDate = (monthName: string, day: string, year: string) => {
    const date = new Date(`${monthName} ${day}, ${year} 00:00:00 UTC`);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  };
  const dateStart = parseFilterDate(timeframeMatch[1], timeframeMatch[2], timeframeMatch[3]);
  const dateEnd = parseFilterDate(timeframeMatch[4], timeframeMatch[5], timeframeMatch[6]);
  if (!dateStart || !dateEnd) throw new Error("The Filters sheet timeframe contains an invalid date.");

  const dataRows = dataSheet.rows.slice(headerIndex + 1).filter((row) =>
    String(row[roomNightsIndex] || "").trim() || String(row[roomRevenueIndex] || "").trim());
  const roomNights = round(dataRows.reduce((total, row) => total + numeric(row[roomNightsIndex]), 0), 2);
  const roomRevenue = round(dataRows.reduce((total, row) => total + numeric(row[roomRevenueIndex]), 0), 2);
  const adr = roomNights ? round(roomRevenue / roomNights, 2) : 0;
  const start = new Date(`${dateStart}T00:00:00Z`);
  const end = new Date(`${dateEnd}T00:00:00Z`);
  const period = start.getUTCMonth() === end.getUTCMonth() && start.getUTCDate() === 1 ? "mtd"
    : start.getUTCMonth() === 0 && start.getUTCDate() === 1 ? "ytd"
      : "custom";
  const reportYear = Number(String(context.reportMonth || context.weekEnd || context.weekStart || "").slice(0, 4));
  const dataYear = end.getUTCFullYear();
  const comparison = reportYear && dataYear === reportYear - 1 ? "last_year"
    : reportYear && dataYear === reportYear ? "current_year"
      : "other";
  if (period === "custom") warnings.push("The report timeframe is neither month-to-date nor year-to-date.");
  if (comparison === "current_year") warnings.push("Current-year Analytical Account Tracking data was retained for reference; Detailed Flash remains the source for current-year MTD/YTD.");
  if (comparison === "other") warnings.push("The report year does not match the selected report year or its prior year.");

  const mapping = {
    period,
    comparison,
    dateStart,
    dateEnd,
    roomNights,
    roomRevenue,
    adr,
    rowCount: dataRows.length,
  };
  return {
    ...baseReport(file, "analytical_account_tracking", context, warnings),
    preview: [mapping],
    mapping,
  };
}

function parseGss(file: Express.Multer.File, sheets: Array<{ name: string; rows: string[][] }>, context: OpsParserContext): ParsedReport {
  const warnings: string[] = [];
  const satisfaction = sheets.find((sheet) => normalizedHeader(sheet.name) === "satisfaction") || sheets[0];
  const rows = satisfaction?.rows || [];
  const headerIndex = rows.findIndex((row) => row.map(normalizedHeader).includes("total") && row.map(normalizedHeader).includes("benchmark"));
  if (headerIndex < 0) throw new Error("GSS month/Total/Benchmark header was not found.");
  const header = rows[headerIndex].map(normalizedHeader);
  const reportMonth = context.reportMonth || (context.weekStart ? monthKey(context.weekStart) : "");
  const monthName = reportMonth ? new Date(`${reportMonth}-01T00:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toLowerCase() : "";
  const monthIndex = header.findIndex((value) => value === monthName);
  const totalIndex = header.indexOf("total");
  const benchmarkIndex = header.indexOf("benchmark");
  const differenceIndex = header.indexOf("difference");
  if (monthIndex < 0) warnings.push(`Selected report month ${reportMonth || "(unknown)"} was not found in GSS columns.`);
  const wanted: Record<string, string> = {
    "# of responses": "# of Responses",
    "intent to recommend property": "ITR",
    "elite appreciation": "Elite Appreciation",
    cleanliness: "Cleanliness",
    "staff service": "Staff Service",
    "maintenance and upkeep": "Maintenance",
    "food and beverage": "Food & Beverage",
    "select tier f+b service": "F&B Tier Service",
    "select tier f+b quality of food": "F&B Tier Food Quality",
    "select paid morning f+b service": "F&B Morning Service",
    "select paid morning f+b quality of food": "F&B Morning Food Quality",
    "select paid afternoon+evening f+b service": "F&B Evening Service",
    "select paid afternoon+evening f+b quality of food": "F&B Evening Food Quality",
  };
  const parsed = rows.slice(headerIndex + 1).flatMap((row) => {
    const label = wanted[normalizedHeader(row[0])];
    if (!label) return [];
    const mtd = numeric(row[monthIndex]);
    const total = numeric(row[totalIndex]);
    const benchmark = numeric(row[benchmarkIndex]);
    const difference = numeric(row[differenceIndex]);
    return [{
      label,
      hotel: String(round(mtd, 1)),
      brand: String(round(benchmark, 1)),
      variance: String(round(mtd - benchmark, 1)),
      sply: String(round(difference, 1)),
      comments: `${monthName || "Selected month"}; ${label === "# of Responses" ? "total responses" : "YTD"} ${round(total, 1)}`,
      waveHotel: String(round(total, 1)),
      waveBrand: String(round(benchmark, 1)),
      waveVariance: String(round(total - benchmark, 1)),
      waveSply: String(round(difference, 1)),
    }];
  });
  const gssRows = parsed.map(({ waveHotel, waveBrand, waveVariance, waveSply, ...row }) => row);
  const gssWaveRows = parsed.map((row) => ({
    label: row.label,
    hotel: row.waveHotel,
    brand: row.waveBrand,
    variance: row.waveVariance,
    sply: row.waveSply,
    comments: "Wave to date / YTD",
  }));
  return { ...baseReport(file, "gss_scores", context, warnings), preview: gssRows.slice(0, 10), mapping: { gssRows, gssWaveRows } };
}

function privateGuestName(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "Guest";
  const parts = raw.includes(",") ? raw.split(",").map((part) => part.trim()) : raw.split(/\s+/);
  const first = raw.includes(",") ? parts[1] || "" : parts[0] || "";
  const last = raw.includes(",") ? parts[0] || "" : parts[parts.length - 1] || "";
  return `${first} ${last ? `${last[0]}.` : ""}`.trim() || "Guest";
}

function parseResponses(file: Express.Multer.File, rows: string[][], context: OpsParserContext): ParsedReport {
  const warnings: string[] = [];
  const headerIndex = findHeader(rows, ["Response Date", "Intent to Recommend (Property)", "Overall Comment"]);
  if (headerIndex < 0) throw new Error("Marriott response headers were not found.");
  const header = rows[headerIndex];
  const indexes = headerIndexes(header);
  const index = {
    name: indexes.find("Name"),
    responseDate: indexes.find("Response Date"),
    room: indexes.find("Room Number"),
    roomType: indexes.find("Room Types", "Room Type"),
    score: indexes.find("Intent to Recommend (Property)"),
    comment: indexes.find("Overall Comment"),
    cleanliness: indexes.find("Cleanliness"),
    staffService: indexes.find("Staff Service"),
    maintenance: indexes.find("Maintenance and Upkeep"),
    elite: indexes.find("Elite Appreciation"),
  };
  const parsed = rows.slice(headerIndex + 1).flatMap((row) => {
    const responseDate = excelDateToIso(row[index.responseDate]);
    if (!responseDate || context.weekStart && responseDate < context.weekStart || context.weekEnd && responseDate > context.weekEnd) return [];
    const comment = String(row[index.comment] || "").replace(/&#xa;/gi, "\n").trim();
    if (!comment) return [];
    const score = numeric(row[index.score]);
    return [{
      source: privateGuestName(row[index.name]),
      responseDate,
      room: String(row[index.room] || "").trim(),
      roomType: String(row[index.roomType] || "").trim(),
      score: score ? String(score) : "",
      comment,
      cleanliness: numeric(row[index.cleanliness]) || "",
      staffService: numeric(row[index.staffService]) || "",
      maintenance: numeric(row[index.maintenance]) || "",
      eliteAppreciation: numeric(row[index.elite]) || "",
    }];
  });
  const operationalIssue = /\b(dirty|broken|noise|odor|smell|bug|bed bug|hot water|cold shower|maintenance|parking|linens?|elevator|air condition|billing|problem|issue|unavailable|not available)\b/i;
  const positiveReviews = parsed.filter((row) => numeric(row.score) >= 9 && !operationalIssue.test(row.comment)).slice(0, 5);
  const negativeReviews = parsed.filter((row) => numeric(row.score) <= 8 || operationalIssue.test(row.comment)).slice(0, 5);
  if (!parsed.length) warnings.push("No commented responses fell inside the selected report week.");
  return { ...baseReport(file, "marriott_responses", context, warnings), preview: parsed.slice(0, 10), mapping: { positiveReviews, negativeReviews } };
}

function parseAr(file: Express.Multer.File, rows: string[][], context: OpsParserContext): ParsedReport {
  const warnings: string[] = [];
  const headerIndex = rows.findIndex((row) => {
    const values = row.map(normalizedHeader);
    return values.some((value) => value === "current") && values.some((value) => value.includes("30")) && values.some((value) => value.includes("60"));
  });
  if (headerIndex < 0) throw new Error("AR Aging bucket headers were not found.");
  const header = rows[headerIndex].map(normalizedHeader);
  const findBucket = (...patterns: RegExp[]) => header.findIndex((value) => patterns.some((pattern) => pattern.test(value)));
  const index = {
    account: findBucket(/account/, /company/, /customer/, /name/),
    current: findBucket(/^current$/, /not due/),
    d30: findBucket(/(^| )1 ?- ?30/, /^30$/, /30 day/),
    d60: findBucket(/31 ?- ?60/, /^60$/, /60 day/),
    d90: findBucket(/61 ?- ?90/, /^90$/, /90 day/),
    d120: findBucket(/91 ?- ?120/, /^120$/, /120\+/, /over 120/, /120 day/),
    total: findBucket(/^total$/, /balance/),
  };
  for (const bucket of ["current", "d30", "d60", "d90"] as const) if (index[bucket] < 0) warnings.push(`AR Aging column missing: ${bucket}.`);
  const accounts = rows.slice(headerIndex + 1).flatMap((row) => {
    if (!row.some((cell) => String(cell || "").trim())) return [];
    const current = numeric(row[index.current]);
    const d30 = numeric(row[index.d30]);
    const d60 = numeric(row[index.d60]);
    const d90 = numeric(row[index.d90]);
    const d120 = numeric(row[index.d120]);
    const total = index.total >= 0 ? numeric(row[index.total]) : current + d30 + d60 + d90 + d120;
    if (![current, d30, d60, d90, d120, total].some(Boolean)) return [];
    return [{ account: String(row[index.account] || "").trim(), current, d30, d60, d90, d120, total }];
  });
  const sum = (key: keyof typeof accounts[number]) => accounts.reduce((total, row) => total + (typeof row[key] === "number" ? Number(row[key]) : 0), 0);
  const summary = { current: sum("current"), d30: sum("d30"), d60: sum("d60"), d90: sum("d90"), d120: sum("d120"), total: sum("total") };
  return { ...baseReport(file, "ar_aging", context, warnings), preview: accounts.slice(0, 10), mapping: { accounts, summary } };
}

async function parseOoo(file: Express.Multer.File, context: OpsParserContext): Promise<ParsedReport> {
  const warnings: string[] = [];
  const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buffer: Buffer) => Promise<{ text?: string }>;
  const text = String((await pdfParse(file.buffer)).text || "").replace(/\r/g, "");
  const range = text.match(/start date\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})\s+\|\|\s+end date\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i);
  const rowPattern = /HOTEL(\d+)([A-Z0-9]+)(OOO|OTM)(.*?)(VAC|OCC|DIRTY|CLEAN)([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/g;
  const rooms: Array<Record<string, unknown>> = [];
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(text))) {
    rooms.push({
      no: String(rooms.length + 1),
      room: match[1],
      roomType: match[2],
      oooType: match[3],
      reason: match[4].trim(),
      status: match[5],
      startDate: excelDateToIso(match[6]),
      returnDate: excelDateToIso(match[7]),
      comment: `${match[3]} / ${match[5]} - ${match[4].trim()} (${match[2]})`,
    });
  }
  if (!rooms.length) warnings.push("No room-level OOO rows were extracted from the PDF.");
  if (!range) warnings.push("The OOO report date range was not found.");
  const reportRange = { startDate: excelDateToIso(range?.[1]), endDate: excelDateToIso(range?.[2]) };
  if (context.weekStart && reportRange.startDate && context.weekStart !== reportRange.startDate) warnings.push("OOO report start date does not match the selected week.");
  if (context.weekEnd && reportRange.endDate && context.weekEnd !== reportRange.endDate) warnings.push("OOO report end date does not match the selected week.");
  return { ...baseReport(file, "ooo_rooms", context, warnings), preview: rooms.slice(0, 10), mapping: { rooms, reportRange } };
}

function moneyValuesFromCreditTail(value: string) {
  const compact = value.replace(/\s+/g, "");
  const decimalIndexes = Array.from(compact.matchAll(/\./g)).map((match) => match.index || 0);
  if (decimalIndexes.length < 3) return null;
  const [firstDecimal, secondDecimal, thirdDecimal] = decimalIndexes.slice(-3);
  const projectedIntegerWithCard = compact.slice(0, firstDecimal).replace(/\D/g, "");
  const projectedCents = compact.slice(firstDecimal + 1, firstDecimal + 3);
  const authInteger = compact.slice(firstDecimal + 3, secondDecimal);
  const authCents = compact.slice(secondDecimal + 1, secondDecimal + 3);
  const differenceInteger = compact.slice(secondDecimal + 3, thirdDecimal);
  const differenceCents = compact.slice(thirdDecimal + 1, thirdDecimal + 3);
  const authAmount = numeric(`${authInteger}.${authCents}`);
  const difference = numeric(`${differenceInteger}.${differenceCents}`);
  for (let cardDigits = 0; cardDigits <= Math.min(4, projectedIntegerWithCard.length - 1); cardDigits += 1) {
    const projected = numeric(`${projectedIntegerWithCard.slice(cardDigits)}.${projectedCents}`);
    if (Math.abs(projected - authAmount - difference) < 0.02) return { projected, authAmount, difference };
  }
  return null;
}

async function parseCreditLimit(file: Express.Multer.File, context: OpsParserContext): Promise<ParsedReport> {
  const warnings: string[] = [];
  const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buffer: Buffer) => Promise<{ text?: string }>;
  const source = String((await pdfParse(file.buffer)).text || "")
    .replace(/\r/g, "")
    .replace(/(\d{4}-\d{2})-\s*\n(\d{2})/g, "$1-$2");
  const body = source.split(/Notes On Report:|Printed On:/i)[0];
  const roomMatches = Array.from(body.matchAll(/\n(\d{3})(?:\n|(?=[A-Za-z]))/g));
  const entries: Array<Record<string, unknown>> = [];
  for (let index = 0; index < roomMatches.length; index += 1) {
    const match = roomMatches[index];
    const start = (match.index || 0) + match[0].length;
    const end = roomMatches[index + 1]?.index || body.length;
    const block = body.slice(start, end).trim();
    const dates = Array.from(block.matchAll(/\d{4}-\d{2}-\d{2}/g));
    if (dates.length < 2) continue;
    const thresholdExceeded = /Threshold Exceeded/i.test(block);
    const beforeArrival = block.slice(0, dates[0].index).replace(/Threshold Exceeded/ig, "").trim();
    const guest = beforeArrival
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line && !/Marriott|Bonvoy|VIP/i.test(line))
      .join(" ")
      .replace(/\s+/g, " ");
    const afterDeparture = block.slice((dates[1].index || 0) + dates[1][0].length).replace(/\s+/g, " ").trim();
    const paymentMatch = afterDeparture.match(/(Cash Payment|Do Not Use|American Express|MasterCard|Visa)/i);
    const paymentMethod = paymentMatch?.[1] || "Unknown";
    const creditTail = (paymentMatch ? afterDeparture.slice((paymentMatch.index || 0) + paymentMatch[0].length) : afterDeparture)
      .split(/Agilysys Stay|https?:|ROOM NUMBER/i)[0];
    const amounts = moneyValuesFromCreditTail(creditTail);
    if (!amounts) {
      warnings.push(`Room ${match[1]} monetary fields could not be parsed.`);
      continue;
    }
    const uncovered = Math.max(0, amounts.difference);
    const noCardAuthorization = amounts.authAmount <= 0 || /Cash Payment|Do Not Use/i.test(paymentMethod);
    const over1000 = amounts.projected > 1000;
    entries.push({
      room: match[1],
      guest,
      paymentMethod,
      arrivalDate: dates[0][0],
      departureDate: dates[1][0],
      projected: round(amounts.projected, 2),
      authAmount: round(amounts.authAmount, 2),
      uncovered: round(uncovered, 2),
      noCardAuthorization,
      over1000,
      thresholdExceeded,
      action: over1000
        ? "Finalize charges over $1,000 and reauthorize the remaining balance"
        : "Obtain or increase authorization to cover the outstanding balance",
    });
  }
  if (!entries.length) warnings.push("No credit-limit exceptions were extracted from the PDF.");
  const exceptions = entries.filter((entry) => entry.over1000 || entry.noCardAuthorization);
  const totalProjected = exceptions.reduce((sum, entry) => sum + Number(entry.projected || 0), 0);
  const totalUncovered = exceptions.reduce((sum, entry) => sum + Number(entry.uncovered || 0), 0);
  const over1000Entries = exceptions.filter((entry) => entry.over1000);
  const noAuthEntries = exceptions.filter((entry) => entry.noCardAuthorization);
  const summary = {
    totalProjected: round(totalProjected, 2),
    totalUncovered: round(totalUncovered, 2),
    over1000Balance: round(over1000Entries.reduce((sum, entry) => sum + Number(entry.projected || 0), 0), 2),
    exceptionCount: exceptions.length,
    over1000Count: over1000Entries.length,
    noAuthCount: noAuthEntries.length,
  };
  return { ...baseReport(file, "credit_limit", context, warnings), preview: exceptions.slice(0, 10), mapping: { entries: exceptions, summary } };
}

async function parseMintPacingScreenshot(file: Express.Multer.File, context: OpsParserContext): Promise<ParsedReport> {
  if (!openai) throw new Error("MINT screenshot parsing is unavailable because the AI service is not configured.");
  const reportMonth = context.reportMonth || (context.weekEnd ? monthKey(context.weekEnd) : "");
  const nextReportMonth = nextMonthKey(reportMonth);
  if (!reportMonth || !nextReportMonth) throw new Error("Select a valid Ops Report week before uploading the MINT pacing screenshot.");
  const prompt = `Read this Marriott MINT pacing screenshot.
Return JSON only in this exact shape:
{"stayDateStart":"YYYY-MM-DD","stayDateEnd":"YYYY-MM-DD","reportRunDate":"YYYY-MM-DD","roomNightsTy":0,"roomNightsStly":0,"roomRevenueTy":0,"roomRevenueStly":0,"adrTy":0,"adrStly":0}

Read Stay Date Range from the two date fields near the top.
Read reportRunDate from the "Report run date/timestamp" at the bottom.
Read values only from the Grand Total row.
Use these columns exactly: OTB Room Nights TY, OTB Room Nights STLY, OTB Room Revenue TY, OTB Room Revenue STLY, OTB Room ADR TY, OTB Room ADR STLY.
Do not use percentages, detail rows, or infer unreadable values.`;
  const completion = await openai.chat.completions.create({
    model: process.env.OPS_REPORT_AI_VISION_MODEL || process.env.SCHEDULE_AI_VISION_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}` } },
      ] as any,
    }],
    max_tokens: 700,
    temperature: 0,
  });
  const parsedJson = JSON.parse(completion.choices[0]?.message?.content || "{}");
  const parsed = mintPacingScreenshotSchema.safeParse(parsedJson);
  if (!parsed.success) throw new Error("The MINT screenshot dates or Grand Total values could not be read.");
  const data = parsed.data;
  const screenshotMonth = monthKey(data.stayDateStart);
  const expectedMonth = screenshotMonth === reportMonth
    ? reportMonth
    : screenshotMonth === nextReportMonth
      ? nextReportMonth
      : "";
  if (!expectedMonth) {
    throw new Error(
      `This screenshot covers ${data.stayDateStart} through ${data.stayDateEnd}. It must cover either ${reportMonth} or ${nextReportMonth}.`,
    );
  }
  const expectedStart = `${expectedMonth}-01`;
  const expectedEndDate = new Date(Date.UTC(Number(expectedMonth.slice(0, 4)), Number(expectedMonth.slice(5, 7)), 0));
  const expectedEnd = expectedEndDate.toISOString().slice(0, 10);
  if (data.stayDateStart !== expectedStart || data.stayDateEnd !== expectedEnd) {
    throw new Error(
      `This screenshot covers ${data.stayDateStart} through ${data.stayDateEnd}. Pacing requires the full calendar month: ${expectedStart} through ${expectedEnd}.`,
    );
  }
  const totalRooms = Number(context.totalRooms || 0);
  if (!Number.isFinite(totalRooms) || totalRooms <= 0) {
    throw new Error("Enter Total Rooms at the top of the Ops Report before importing a MINT pacing screenshot.");
  }
  const days = Math.round((expectedEndDate.getTime() - new Date(`${expectedStart}T00:00:00Z`).getTime()) / 86_400_000) + 1;
  const availableRoomNights = totalRooms * days;
  const occupancy = availableRoomNights ? data.roomNightsStly / availableRoomNights : 0;
  const warnings: string[] = [];
  if (Math.abs(data.roomNightsStly * data.adrStly - data.roomRevenueStly) > Math.max(5, data.roomRevenueStly * 0.01)) {
    warnings.push("Grand Total STLY rooms multiplied by ADR does not closely match STLY room revenue; review the screenshot values.");
  }
  const mapping = {
    dateStart: data.stayDateStart,
    dateEnd: data.stayDateEnd,
    reportRunDate: data.reportRunDate,
    total: {
      roomsSold: round(data.roomNightsStly, 0),
      occupancy: round(occupancy, 6),
      adr: round(data.adrStly, 2),
      roomRevenue: round(data.roomRevenueStly, 2),
      roomsActive: availableRoomNights,
    },
    currentYearTotal: {
      roomsSold: round(data.roomNightsTy, 0),
      adr: round(data.adrTy, 2),
      roomRevenue: round(data.roomRevenueTy, 2),
    },
  };
  return {
    ...baseReport(file, expectedMonth === reportMonth ? "current_month_sdly_otb" : "next_month_sdly_otb", context, warnings),
    preview: [{
      stayDateRange: `${data.stayDateStart} to ${data.stayDateEnd}`,
      reportRunDate: data.reportRunDate,
      stlyRooms: data.roomNightsStly,
      stlyOccupancy: round(occupancy * 100, 2),
      stlyAdr: data.adrStly,
      stlyRoomRevenue: data.roomRevenueStly,
    }],
    mapping,
  };
}

export async function parseOpsReportFile(file: Express.Multer.File, context: OpsParserContext = {}): Promise<ParsedReport> {
  const isImage = /^image\/(png|jpeg|webp)$/i.test(file.mimetype) || /\.(png|jpe?g|webp)$/i.test(file.originalname);
  if (isImage) return parseMintPacingScreenshot(file, context);
  const isPdf = /\.pdf$/i.test(file.originalname) || file.mimetype === "application/pdf";
  if (isPdf) {
    if (/credit\s*limit|creditlimit/i.test(file.originalname)) return parseCreditLimit(file, context);
    if (!/ooo\s*rooms|out\s*of\s*order/i.test(file.originalname)) throw new Error("Only OOO Rooms and Credit Limit PDFs are supported in the ops report uploader.");
    return parseOoo(file, context);
  }
  const isCsv = /\.csv$/i.test(file.originalname) || file.mimetype === "text/csv";
  const sheets = isCsv ? [{ name: "CSV", rows: parseCsvRows(file.buffer.toString("utf8")) }] : parseXlsxSheets(file.buffer);
  const rows = sheets.flatMap((sheet) => sheet.rows);
  const reportType = detectOpsReportType(file.originalname, rows, context);
  if (!reportType) throw new Error("This report format was not recognized.");
  if (["previous_week_otb", "current_month_otb", "remaining_month_otb", "next_month_otb", "next_month_sdly_otb"].includes(reportType)) return parseOtb(file, rows, reportType, context);
  if (reportType === "analytical_account_tracking") return parseAnalyticalAccountTracking(file, sheets, context);
  if (reportType === "detailed_flash") return parseDetailedFlash(file, rows, context);
  if (reportType === "gss_scores") return parseGss(file, sheets, context);
  if (reportType === "marriott_responses") return parseResponses(file, rows, context);
  if (reportType === "ar_aging") return parseAr(file, rows, context);
  throw new Error(`Unsupported ops report type: ${reportType}.`);
}
