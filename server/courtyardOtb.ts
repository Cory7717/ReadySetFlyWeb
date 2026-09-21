import crypto from "crypto";

export type OtbStayDate = { stayDate: string; roomsSold: number; groupPu: number; groupUnpu: number; occupancy: number | null; adr: number | null; roomRevenue: number };
export type OtbPreview = { targetMonth: string; roomRevenue: number; roomsOtb: number; adr: number; occupancy: number | null; groupPu: number; groupUnpu: number; rows: OtbStayDate[]; fingerprint: string; ignoredRows: number; totalRows: number; warnings: string[] };

function csvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (char === "," || char === "\t")) { row.push(field); field = ""; }
    else if (!quoted && (char === "\r" || char === "\n")) { row.push(field); if (row.some((cell) => cell.trim())) records.push(row); row = []; field = ""; if (char === "\r" && text[i + 1] === "\n") i++; }
    else field += char;
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  row.push(field); if (row.some((cell) => cell.trim())) records.push(row);
  return records;
}
const normalized = (value: string) => value.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const aliases: Record<string, string[]> = {
  date: ["date", "stay date", "arrival date", "business date"],
  rooms: ["rms sold", "rooms sold", "room sold", "rms", "rooms otb"],
  groupPu: ["group pu", "grp pu", "group pickup", "group picked up"],
  groupUnpu: ["group unpu", "grp unpu", "group unpicked", "group unpicked up"],
  occupancy: ["occ", "occ percent", "occupancy", "occupancy percent"],
  adr: ["adr sold", "adr", "sold adr"],
  revenue: ["rm rev", "room revenue", "rooms revenue", "rm revenue"],
};
function dateKey(value: string): string | null {
  const raw = value.trim();
  let y: number, m: number, d: number;
  const iso = raw.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})(?:\b|$)/);
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|20\d{2})(?:\b|$)/);
  if (iso) [, y, m, d] = iso.map(Number); else if (us) { [, m, d, y] = us.map(Number); if (y < 100) y += 2000; } else {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime()) || !/[a-z]/i.test(raw)) return null;
    y = parsed.getUTCFullYear(); m = parsed.getUTCMonth() + 1; d = parsed.getUTCDate();
  }
  const check = new Date(Date.UTC(y!, m! - 1, d!));
  return check.getUTCFullYear() === y! && check.getUTCMonth() + 1 === m! && check.getUTCDate() === d!
    ? `${y!}-${String(m!).padStart(2, "0")}-${String(d!).padStart(2, "0")}` : null;
}
function numeric(value: string): number | null {
  const clean = value.trim().replace(/[$,%\s]/g, "").replace(/^\((.+)\)$/, "-$1");
  if (!clean) return null;
  const number = Number(clean);
  return Number.isFinite(number) ? number : null;
}
const cents = (value: number) => Math.round(value * 100) / 100;
export function parseCourtyardOtbCsv(text: string): OtbPreview {
  if (Buffer.byteLength(text, "utf8") > 2_000_000) throw new Error("The OTB CSV exceeds the 2 MB limit.");
  if (text.includes("\u0000")) throw new Error("This file does not appear to be a UTF-8 CSV export.");
  const records = csvRecords(text.replace(/^\uFEFF/, ""));
  const headerIndex = records.findIndex((record) => {
    const headings = record.map(normalized);
    return aliases.date.some((alias) => headings.includes(alias)) && aliases.revenue.some((alias) => headings.includes(alias));
  });
  if (headerIndex < 0) throw new Error("Could not find Marriott OTB headers. Expected Date, Rms Sold, Occ %, ADR Sold ($), and Rm Rev ($).");
  const headings = records[headerIndex].map(normalized);
  const column = (key: string) => headings.findIndex((heading) => aliases[key].includes(heading));
  const columns = Object.fromEntries(Object.keys(aliases).map((key) => [key, column(key)]));
  if (columns.date < 0 || columns.rooms < 0 || columns.revenue < 0) throw new Error("The CSV needs Date, Rms Sold, and Rm Rev columns.");
  const rows: OtbStayDate[] = [];
  let ignoredRows = 0, totalRows = 0;
  for (const record of records.slice(headerIndex + 1)) {
    totalRows++;
    const dateCell = record[columns.date] || "";
    if (/\b(total|subtotal|grand total|average)\b/i.test(dateCell)) { ignoredRows++; continue; }
    const stayDate = dateKey(dateCell);
    if (!stayDate) { ignoredRows++; continue; }
    const read = (key: string) => columns[key] < 0 ? null : numeric(record[columns[key]] || "");
    const roomsSold = read("rooms"), roomRevenue = read("revenue");
    if (roomsSold == null || roomRevenue == null || roomsSold < 0 || roomRevenue < 0 || !Number.isInteger(roomsSold)) throw new Error(`Invalid rooms or revenue for ${stayDate}.`);
    const occRaw = read("occupancy");
    const occupancy = occRaw == null ? null : /%/.test(record[columns.occupancy] || "") || occRaw > 1 ? occRaw / 100 : occRaw;
    if (occupancy != null && (occupancy < 0 || occupancy > 1.5)) throw new Error(`Invalid occupancy for ${stayDate}.`);
    const adr = read("adr");
    rows.push({ stayDate, roomsSold, groupPu: read("groupPu") || 0, groupUnpu: read("groupUnpu") || 0, occupancy, adr: adr == null ? null : cents(adr), roomRevenue: cents(roomRevenue) });
  }
  if (!rows.length) throw new Error("No valid stay-date rows were found. TOTAL rows are excluded.");
  const months = new Set(rows.map((row) => row.stayDate.slice(0, 7)));
  if (months.size !== 1) throw new Error("This report contains multiple stay months. Upload one target month at a time.");
  const uniqueDates = new Set(rows.map((row) => row.stayDate));
  if (uniqueDates.size !== rows.length) throw new Error("The report has duplicate stay dates. Review the export before saving.");
  rows.sort((a, b) => a.stayDate.localeCompare(b.stayDate));
  const roomsOtb = rows.reduce((sum, row) => sum + row.roomsSold, 0);
  const roomRevenue = cents(rows.reduce((sum, row) => sum + row.roomRevenue, 0));
  const occupancyRows = rows.filter((row) => row.occupancy != null);
  const occupancy = occupancyRows.length ? occupancyRows.reduce((sum, row) => sum + row.occupancy!, 0) / occupancyRows.length : null;
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ targetMonth: `${rows[0].stayDate.slice(0, 7)}-01`, rows })).digest("hex");
  const warnings: string[] = [];
  if (columns.occupancy < 0) warnings.push("Occupancy column not found; occupancy is unavailable.");
  else if (occupancyRows.length !== rows.length) warnings.push(`Occupancy is missing on ${rows.length - occupancyRows.length} stay date(s); the average uses available values only.`);
  if (columns.adr < 0) warnings.push("ADR column not found; OTB ADR was calculated from revenue / rooms.");
  if (ignoredRows) warnings.push(`${ignoredRows} non-stay-date row(s), including any TOTAL row, were excluded.`);
  return { targetMonth: `${rows[0].stayDate.slice(0, 7)}-01`, rows, roomRevenue, roomsOtb, adr: roomsOtb ? cents(roomRevenue / roomsOtb) : 0, occupancy, groupPu: rows.reduce((sum, row) => sum + row.groupPu, 0), groupUnpu: rows.reduce((sum, row) => sum + row.groupUnpu, 0), fingerprint, ignoredRows, totalRows, warnings };
}
