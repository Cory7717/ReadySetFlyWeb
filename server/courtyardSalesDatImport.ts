import crypto from "node:crypto";
import { z } from "zod";
import * as XLSX from "@e965/xlsx";
import { getOpenAIClient } from "./openaiClient";
import { normalizeSalesMarketSegment } from "./courtyardSalesImport";

const datScreenshotSchema = z.object({
  timeFrameStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeFrameEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  property: z.string().default(""),
  currency: z.string().default("USD"),
  showsTableStart: z.boolean(),
  showsTableEnd: z.boolean(),
  rows: z.array(z.object({
    marketCategory: z.string().min(1),
    marketSegment: z.string().min(1),
    currentRoomNights: z.coerce.number().min(0),
    currentRoomRevenue: z.coerce.number(),
    currentRoomAdr: z.coerce.number().min(0),
  })).min(1).max(100),
});

type DatScreenshotData = z.infer<typeof datScreenshotSchema>;

function monthKey(value: string) {
  return value.slice(0, 7);
}

export function normalizeDatScreenshotData(data: DatScreenshotData, filename = "DAT screenshot") {
  const parsed = datScreenshotSchema.parse(data);
  if (monthKey(parsed.timeFrameStart) !== monthKey(parsed.timeFrameEnd)) {
    throw new Error(`The DAT TimeFrame ${parsed.timeFrameStart} to ${parsed.timeFrameEnd} crosses calendar months. Upload one reporting month at a time.`);
  }
  const warnings: string[] = [];
  if (!parsed.showsTableStart) warnings.push(`${filename} does not show the beginning of the DAT table.`);
  if (!parsed.showsTableEnd) warnings.push(`${filename} does not show the end of the DAT table. Add a continuation screenshot so totals include every segment.`);
  const accepted = parsed.rows.map((source, index) => {
    const segment = normalizeSalesMarketSegment(source.marketSegment);
    const key = `${source.marketCategory.trim().toLowerCase()}|${segment.toLowerCase()}`;
    const calculatedAdr = source.currentRoomNights > 0 ? source.currentRoomRevenue / source.currentRoomNights : 0;
    if (source.currentRoomNights > 0 && Math.abs(calculatedAdr - source.currentRoomAdr) > 0.15) {
      warnings.push(`${segment}: extracted room nights, revenue, and ADR do not reconcile; review the preview.`);
    }
    const raw = {
      "Market Category": source.marketCategory,
      "Market Segment": source.marketSegment,
      "Current Room Nights": String(source.currentRoomNights),
      "Current Room Revenue": String(source.currentRoomRevenue),
      "Current Room ADR": String(source.currentRoomAdr),
      "TimeFrame Start": parsed.timeFrameStart,
      "TimeFrame End": parsed.timeFrameEnd,
    };
    return {
      globalUltimateAccountName: segment,
      accountName: segment,
      accountType: "DAT Market Segment",
      marketCategory: source.marketCategory.trim(),
      marketSegment: segment,
      roomNights: source.currentRoomNights,
      roomRevenue: source.currentRoomRevenue,
      roomAdr: source.currentRoomAdr || calculatedAdr,
      totalRevenue: source.currentRoomRevenue,
      totalAdr: source.currentRoomAdr || calculatedAdr,
      averageLos: 0,
      fees: 0,
      taxes: 0,
      addOns: 0,
      raw,
      sourceRowNumber: index + 1,
      normalizedRowHash: crypto.createHash("sha256").update(JSON.stringify(raw)).digest("hex"),
      normalizedAccountKey: `dat-segment:${key}`,
    };
  });
  return {
    delimiter: "image-ocr",
    rawHeaders: ["Market Category", "Market Segment", "Current Room Nights", "Current Room Revenue", "Current Room ADR"],
    rowsFound: parsed.rows.length,
    accepted,
    rejected: [] as Array<Record<string, unknown>>,
    duplicateRowCount: 0,
    warnings,
    reportDateRange: { start: parsed.timeFrameStart, end: parsed.timeFrameEnd },
    property: parsed.property,
    currency: parsed.currency,
    showsTableStart: parsed.showsTableStart,
    showsTableEnd: parsed.showsTableEnd,
  };
}

export function mergeDatScreenshotImports(parts: ReturnType<typeof normalizeDatScreenshotData>[]) {
  if (!parts.length) throw new Error("Choose at least one DAT screenshot.");
  const range = parts[0].reportDateRange;
  if (parts.some((part) => part.reportDateRange.start !== range.start || part.reportDateRange.end !== range.end)) {
    throw new Error("All DAT screenshots in one upload must show the same TimeFrame.");
  }
  const rows = new Map<string, (typeof parts)[number]["accepted"][number]>();
  let duplicateRowCount = 0;
  for (const part of parts) {
    for (const row of part.accepted) {
      if (rows.has(row.normalizedAccountKey)) {
        duplicateRowCount++;
        continue;
      }
      rows.set(row.normalizedAccountKey, row);
    }
  }
  const accepted = Array.from(rows.values()).map((row, index) => ({ ...row, sourceRowNumber: index + 1 }));
  const warnings = Array.from(new Set(parts.flatMap((part) => part.warnings).filter((warning) => !/does not show (?:the beginning|the end)/i.test(warning))));
  const showsTableStart = parts.some((part) => part.showsTableStart);
  const showsTableEnd = parts.some((part) => part.showsTableEnd);
  if (!showsTableStart) warnings.push("The uploaded images do not show the beginning of the DAT table.");
  if (!showsTableEnd) warnings.push("The uploaded images do not show the end of the DAT table; calculated totals may be incomplete.");
  return {
    ...parts[0],
    rowsFound: accepted.length + duplicateRowCount,
    accepted,
    duplicateRowCount,
    warnings,
    showsTableStart,
    showsTableEnd,
  };
}

export async function parseDatScreenshot(file: Express.Multer.File) {
  const client = getOpenAIClient();
  if (!client) throw new Error("DAT screenshot parsing is unavailable because the AI service is not configured.");
  const completion = await client.chat.completions.create({
    model: process.env.SALES_INTELLIGENCE_VISION_MODEL || process.env.OPS_REPORT_AI_VISION_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 3000,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: `Read this Marriott Analytical Demand Analysis Data Export screenshot. Return JSON only with: timeFrameStart and timeFrameEnd as YYYY-MM-DD from the two TimeFrame fields; property; currency; showsTableStart; showsTableEnd; and rows. Each row must contain marketCategory, marketSegment, currentRoomNights, currentRoomRevenue, and currentRoomAdr. Read only visible table rows. Do not use Total Demand, Occupancy %, or Average Current Room Revenue. Preserve negative revenue when shown. showsTableStart is true only when the first data row is visible. showsTableEnd is true only when the final data row or an explicit table ending is visible.` },
        { type: "image_url", image_url: { url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}` } },
      ] as any,
    }],
  });
  const raw = JSON.parse(completion.choices[0]?.message?.content || "{}");
  const parsed = datScreenshotSchema.safeParse(raw);
  if (!parsed.success) throw new Error("The DAT screenshot TimeFrame or market-segment rows could not be read. Upload a clear screenshot that includes the date fields and table headers.");
  return normalizeDatScreenshotData(parsed.data, file.originalname);
}

function isoDate(value: string) {
  const date = new Date(`${value.trim()} 00:00:00 UTC`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function parseDatWorkbook(buffer: Buffer) {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  } catch {
    throw new Error("The DAT Excel workbook could not be opened.");
  }
  const sheets = workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[name], { header: 1, raw: false, defval: "" }),
  }));
  const detail = sheets.find((sheet) => sheet.name.trim().toLowerCase() === "detail selection")
    || sheets.find((sheet) => sheet.rows.some((row) => row.map((cell) => String(cell).trim().toLowerCase()).includes("current room revenue")));
  if (!detail) throw new Error("The DAT workbook is missing the Detail Selection table.");
  const filters = sheets.find((sheet) => sheet.name.trim().toLowerCase() === "filters");
  const filterText = (filters?.rows || []).flat().map(String);
  const timeframeText = filterText.find((value) => /^timeframe\s*:/i.test(value.trim())) || "";
  const timeframeMatch = timeframeText.match(/timeframe\s*:\s*([A-Za-z]{3}\s+\d{1,2}\s+\d{4})\s*-\s*([A-Za-z]{3}\s+\d{1,2}\s+\d{4})/i);
  if (!timeframeMatch) throw new Error("The DAT workbook Filters sheet is missing a readable Timeframe.");
  const timeFrameStart = isoDate(timeframeMatch[1]);
  const timeFrameEnd = isoDate(timeframeMatch[2]);
  if (!timeFrameStart || !timeFrameEnd) throw new Error("The DAT workbook Timeframe could not be read.");
  const headerIndex = detail.rows.findIndex((row) => {
    const cells = row.map((cell) => String(cell).trim().toLowerCase());
    return ["market category", "market segment", "current room nights", "current room revenue", "current room adr"].every((header) => cells.includes(header));
  });
  if (headerIndex < 0) throw new Error("The DAT workbook is missing the market-segment production columns.");
  const header = detail.rows[headerIndex].map((cell) => String(cell).trim().toLowerCase());
  const index = (name: string) => header.indexOf(name);
  const number = (value: unknown) => {
    const parsed = Number(String(value ?? "").replace(/[$,%\s,]/g, ""));
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  const rows = detail.rows.slice(headerIndex + 1).flatMap((row) => {
    const marketCategory = String(row[index("market category")] || "").trim();
    const marketSegment = String(row[index("market segment")] || "").trim();
    if (!marketCategory && !marketSegment) return [];
    const currentRoomNights = number(row[index("current room nights")]);
    const currentRoomRevenue = number(row[index("current room revenue")]);
    const currentRoomAdr = number(row[index("current room adr")]);
    if (!marketCategory || !marketSegment || ![currentRoomNights, currentRoomRevenue, currentRoomAdr].every(Number.isFinite)) {
      throw new Error(`The DAT workbook contains an unreadable production row for ${marketSegment || marketCategory || "an unnamed segment"}.`);
    }
    return [{ marketCategory, marketSegment, currentRoomNights, currentRoomRevenue, currentRoomAdr }];
  });
  if (!rows.length) throw new Error("The DAT workbook contains no market-segment production rows.");
  const currencyIndex = filterText.findIndex((value) => value.trim().toLowerCase() === "currency");
  const currency = currencyIndex >= 0 ? String(filterText.slice(currencyIndex + 1).find((value) => value.trim()) || "USD").trim() : "USD";
  return {
    ...normalizeDatScreenshotData({ timeFrameStart, timeFrameEnd, property: "", currency, showsTableStart: true, showsTableEnd: true, rows }),
    delimiter: "xlsx",
    warnings: [],
  };
}
