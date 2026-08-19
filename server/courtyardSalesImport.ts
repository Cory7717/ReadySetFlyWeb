import crypto from "crypto";
import * as XLSX from "@e965/xlsx";

export const MAX_SALES_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_SALES_IMPORT_ROWS = 25_000;
export function isAuthoritativeHotelProductionReport(sourceReportType: string) {
  return [
    "marriott_mint_all_market_segments",
    "stay_revenue_by_market_segment_with_groups",
    "marriott_dat_analytical_demand_screenshot",
    "marriott_dat_analytical_demand_excel",
  ].includes(sourceReportType);
}
export function salesImportReplacementScope(
  hotelId: string,
  reportYear: number,
  reportMonth: number,
  sourceReportType: string,
) {
  return `${hotelId}:${reportYear}-${String(reportMonth).padStart(2, "0")}:${sourceReportType}`;
}
export function consecutiveComparableMonths(
  lastPeriod: number,
  latestPeriod: number,
  importedPeriods: Set<number>,
) {
  let count = 0;
  for (let period = lastPeriod + 1; period <= latestPeriod; period++) {
    if (!importedPeriods.has(period)) return null;
    count++;
  }
  return count;
}
const aliases: Record<string, string> = {
  "global ultimate account name": "globalUltimateAccountName",
  "highest level account id (uaid)": "highestLevelAccountId",
  "account name": "accountName",
  "account id (uaid)": "accountId",
  "account type": "accountType",
  "market category": "marketCategory",
  "market segment": "marketSegment",
  "rate program code": "rateProgramCode",
  "rate program": "rateProgram",
  "booking office": "bookingOffice",
  "current room nights": "roomNights",
  "current room revenue": "roomRevenue",
  "current room adr": "roomAdr",
  "total current revenue": "totalRevenue",
  "total current adr": "totalAdr",
  "average los (ty)": "averageLos",
  fees: "fees",
  taxes: "taxes",
  "add ons": "addOns",
};
export function workbookToDelimitedBuffer(buffer: Buffer) {
  const isOle = buffer[0] === 0xd0 && buffer[1] === 0xcf;
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isOle && !isZip) return buffer;
  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error("Workbook has no worksheets.");
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheetName], {
      blankrows: false,
    });
    if (!csv.trim()) throw new Error("The first worksheet is empty.");
    return Buffer.from(csv, "utf8");
  } catch (error: any) {
    throw new Error(
      `The Excel workbook could not be read: ${error?.message || "invalid workbook"}`,
    );
  }
}
export function normalizeHeader(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}
function identifier(value: unknown) {
  const v = clean(value);
  return /^(?:0|-|n\/?a|null|undefined)?$/i.test(v) ? "" : v;
}
function numberValue(value: unknown) {
  const v = clean(value).replace(/[$,%]/g, "").replace(/,/g, "");
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function accountKey(row: any) {
  const highest = identifier(row.highestLevelAccountId);
  if (highest) return `highest:${highest.toLowerCase()}`;
  const account = identifier(row.accountId);
  if (account) return `account:${account.toLowerCase()}`;
  const global = clean(row.globalUltimateAccountName);
  if (global) return `global:${global.toLowerCase()}`;
  const name = clean(row.accountName);
  if (name) return `name:${name.toLowerCase()}`;
  return `fallback:${crypto.createHash("sha256").update([row.accountType, row.marketCategory, row.marketSegment, row.rateProgramCode].map(clean).join("|")).digest("hex")}`;
}
function parseDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let cell = "",
    quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      cells.push(cell);
      cell = "";
    } else cell += c;
  }
  cells.push(cell);
  return cells;
}
export function parseSalesImport(buffer: Buffer) {
  buffer = workbookToDelimitedBuffer(buffer);
  if (!buffer.length) throw new Error("The selected file is empty.");
  if (buffer.includes(0))
    throw new Error("This file appears to be binary and cannot be imported.");
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length);
  if (lines.length < 2)
    throw new Error("The report has headers but no data rows.");
  const delimiter =
    (lines[0].match(/\t/g) || []).length >= (lines[0].match(/,/g) || []).length
      ? "\t"
      : ",";
  const rawHeaders = parseDelimitedLine(lines[0], delimiter).map((h) =>
    h.trim(),
  );
  const mapped = rawHeaders.map((h) => aliases[normalizeHeader(h)] || null);
  const found = new Set(mapped.filter(Boolean));
  if (
    (!found.has("globalUltimateAccountName") && !found.has("accountName")) ||
    !found.has("roomNights") ||
    !found.has("roomRevenue")
  )
    throw new Error(
      "Required columns are missing. Include an account name, Current Room Nights, and Current Room Revenue.",
    );
  if (lines.length - 1 > MAX_SALES_IMPORT_ROWS)
    throw new Error(
      `The report exceeds the ${MAX_SALES_IMPORT_ROWS.toLocaleString()} row limit.`,
    );
  const accepted: any[] = [],
    rejected: any[] = [],
    seen = new Set<string>();
  let duplicateRowCount = 0;
  lines.slice(1).forEach((line, index) => {
    const cells = parseDelimitedLine(line, delimiter);
    const raw: Record<string, string> = {};
    const row: any = {};
    rawHeaders.forEach((h, i) => {
      raw[h] = cells[i] ?? "";
      if (mapped[i]) row[mapped[i]!] = clean(cells[i]);
    });
    const roomNights = numberValue(row.roomNights),
      roomRevenue = numberValue(row.roomRevenue);
    if (roomNights === null || roomRevenue === null) {
      rejected.push({
        row: index + 2,
        reason: "Invalid room nights or room revenue",
      });
      return;
    }
    if (!clean(row.globalUltimateAccountName) && !clean(row.accountName)) {
      rejected.push({ row: index + 2, reason: "Account name is blank" });
      return;
    }
    const normalizedRowHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(rawHeaders.map((h) => raw[h])))
      .digest("hex");
    if (seen.has(normalizedRowHash)) {
      duplicateRowCount++;
      return;
    }
    seen.add(normalizedRowHash);
    const key = accountKey(row);
    accepted.push({
      ...row,
      roomNights,
      roomRevenue,
      roomAdr:
        numberValue(row.roomAdr) ??
        (roomNights > 0 ? roomRevenue / roomNights : 0),
      totalRevenue: numberValue(row.totalRevenue),
      totalAdr: numberValue(row.totalAdr),
      averageLos: numberValue(row.averageLos),
      fees: numberValue(row.fees),
      taxes: numberValue(row.taxes),
      addOns: numberValue(row.addOns),
      raw,
      sourceRowNumber: index + 2,
      normalizedRowHash,
      normalizedAccountKey: key,
    });
  });
  return {
    delimiter: delimiter === "\t" ? "tab" : "comma",
    rawHeaders,
    rowsFound: lines.length - 1,
    accepted,
    rejected,
    duplicateRowCount,
    warnings: Object.keys(aliases).filter(
      (h) => !rawHeaders.some((r) => normalizeHeader(r) === h),
    ),
  };
}

const stayAliases: Record<string, string> = {
  category: "marketCategory",
  subcategory: "subcategory",
  date: "stayDate",
  "market segment": "marketSegment",
  "guest type": "accountType",
  "rooms sold": "roomNights",
  "room revenue": "roomRevenue",
  adr: "roomAdr",
  "rooms committed": "roomsCommitted",
  "group picked up room revenue": "groupPickedUpRevenue",
  "group not picked up": "groupNotPickedUp",
  "total guests": "totalGuests",
};

export function normalizeSalesMarketSegment(value: unknown) {
  const segment = clean(value).replace(/\s+/g, " ");
  const normalized = segment.toLowerCase();
  if (normalized === "group" || normalized.startsWith("group ")) return "Group";
  if (normalized.includes("special corp")) return "Special Corp";
  if (normalized === "government" || normalized === "govt/military")
    return "Government";
  return segment || "Unspecified";
}

export function parseStayMarketSegmentImport(buffer: Buffer) {
  buffer = workbookToDelimitedBuffer(buffer);
  if (!buffer.length) throw new Error("The selected file is empty.");
  if (buffer.includes(0))
    throw new Error("This file appears to be binary and cannot be imported.");
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length);
  if (lines.length < 2)
    throw new Error("The STAY report has headers but no data rows.");
  const delimiter =
    (lines[0].match(/\t/g) || []).length > (lines[0].match(/,/g) || []).length
      ? "\t"
      : ",";
  const rawHeaders = parseDelimitedLine(lines[0], delimiter).map((header) =>
    header.trim().replace(/^\uFEFF/, ""),
  );
  const mapped = rawHeaders.map(
    (header) => stayAliases[normalizeHeader(header)] || null,
  );
  const found = new Set(mapped.filter(Boolean));
  for (const required of [
    "stayDate",
    "marketSegment",
    "roomNights",
    "roomRevenue",
  ]) {
    if (!found.has(required))
      throw new Error(
        "This does not appear to be the STAY Revenue by Market Segment with Groups report. Required columns are DATE, MARKET SEGMENT, ROOMS SOLD, and ROOM REVENUE.",
      );
  }
  if (lines.length - 1 > MAX_SALES_IMPORT_ROWS)
    throw new Error(
      `The report exceeds the ${MAX_SALES_IMPORT_ROWS.toLocaleString()} row limit.`,
    );
  const accepted: any[] = [],
    rejected: any[] = [],
    seen = new Set<string>();
  let duplicateRowCount = 0;
  lines.slice(1).forEach((line, index) => {
    const cells = parseDelimitedLine(line, delimiter),
      raw: Record<string, string> = {},
      row: any = {};
    rawHeaders.forEach((header, cellIndex) => {
      raw[header] = cells[cellIndex] ?? "";
      if (mapped[cellIndex]) row[mapped[cellIndex]!] = clean(cells[cellIndex]);
    });
    const roomNights = numberValue(row.roomNights),
      roomRevenue = numberValue(row.roomRevenue),
      roomAdr = numberValue(row.roomAdr);
    const stayDate = new Date(row.stayDate);
    if (!clean(row.marketSegment)) {
      rejected.push({ row: index + 2, reason: "Market segment is blank" });
      return;
    }
    if (
      roomNights === null ||
      roomRevenue === null ||
      Number.isNaN(stayDate.getTime())
    ) {
      rejected.push({
        row: index + 2,
        reason: "Invalid date, rooms sold, or room revenue",
      });
      return;
    }
    const normalizedRowHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(rawHeaders.map((header) => raw[header])))
      .digest("hex");
    if (seen.has(normalizedRowHash)) {
      duplicateRowCount++;
      return;
    }
    seen.add(normalizedRowHash);
    const segment = normalizeSalesMarketSegment(row.marketSegment);
    accepted.push({
      ...row,
      stayDate: stayDate.toISOString().slice(0, 10),
      globalUltimateAccountName: segment,
      accountName: segment,
      marketSegment: segment,
      roomNights,
      roomRevenue,
      roomAdr: roomAdr ?? (roomNights > 0 ? roomRevenue / roomNights : 0),
      totalRevenue: roomRevenue,
      totalAdr: roomAdr ?? 0,
      averageLos: 0,
      fees: 0,
      taxes: 0,
      addOns: 0,
      raw,
      sourceRowNumber: index + 2,
      normalizedRowHash,
      normalizedAccountKey: `stay-segment:${segment.toLowerCase().replace(/\s+/g, " ")}`,
    });
  });
  return {
    delimiter: delimiter === "\t" ? "tab" : "comma",
    rawHeaders,
    rowsFound: lines.length - 1,
    accepted,
    rejected,
    duplicateRowCount,
    warnings: [],
    reportDateRange: accepted.length
      ? {
          start: accepted.map((row) => row.stayDate).sort()[0],
          end: accepted
            .map((row) => row.stayDate)
            .sort()
            .at(-1),
        }
      : null,
  };
}
const groupSummaryAliases: Record<string, string> = {
  group: "sourceGroupName",
  "group name": "sourceGroupName",
  "group code": "groupBookingCode",
  profile: "sourceProfile",
  dates: "stayDates",
  "arrival date": "arrivalDate",
  "departure date": "departureDate",
  contracted: "contractedRoomNights",
  "total blocked": "blockedRoomNights",
  blocked: "blockedRoomNights",
  "picked up": "roomNights",
  remaining: "remainingRoomNights",
  cancelled: "cancelledRoomNights",
  "no show": "noShowRoomNights",
  "no shows": "noShowRoomNights",
  "room revenue ($)": "roomRevenue",
  "room revenue": "roomRevenue",
  "adr ($)": "roomAdr",
  adr: "roomAdr",
  "cut off date": "cutoffDate",
  released: "released",
};
export function detectStaySalesReportType(buffer: Buffer) {
  buffer = workbookToDelimitedBuffer(buffer);
  const firstLine =
    buffer
      .toString("utf8")
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/, 1)[0] || "";
  const delimiter =
    (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length
      ? "\t"
      : ",";
  const headers = new Set(
    parseDelimitedLine(firstLine, delimiter).map(normalizeHeader),
  );
  if (
    (headers.has("group") || headers.has("group name")) &&
    (headers.has("dates") ||
      (headers.has("arrival date") && headers.has("departure date"))) &&
    headers.has("picked up") &&
    (headers.has("room revenue ($)") || headers.has("room revenue"))
  )
    return "stay_group_summary" as const;
  if (
    headers.has("market segment") &&
    headers.has("date") &&
    headers.has("rooms sold") &&
    headers.has("room revenue")
  )
    return "stay_revenue_by_market_segment_with_groups" as const;
  if (
    headers.has("company") &&
    headers.has("guest name") &&
    headers.has("arrive") &&
    headers.has("depart") &&
    headers.has("rate($)")
  )
    return "stay_reservations_company_names" as const;
  return null;
}
function safeSourceDate(value: unknown) {
  const source = clean(value);
  if (!source) return null;
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 10);
}

export function parseStayGroupSummaryImport(buffer: Buffer) {
  buffer = workbookToDelimitedBuffer(buffer);
  if (!buffer.length) throw new Error("The selected file is empty.");
  if (buffer.includes(0))
    throw new Error("This file appears to be binary and cannot be imported.");
  const text = buffer.toString("utf8").replace(/^\uFEFF/, ""),
    lines = text.split(/\r?\n/).filter((line) => line.trim().length);
  if (lines.length < 2)
    throw new Error("The Group Summary has headers but no data rows.");
  const delimiter =
    (lines[0].match(/\t/g) || []).length > (lines[0].match(/,/g) || []).length
      ? "\t"
      : ",";
  const rawHeaders = parseDelimitedLine(lines[0], delimiter).map((header) =>
    header.trim().replace(/^\uFEFF/, ""),
  );
  const mapped = rawHeaders.map(
      (header) => groupSummaryAliases[normalizeHeader(header)] || null,
    ),
    found = new Set(mapped.filter(Boolean));
  for (const required of [
    "sourceGroupName",
    "roomNights",
    "roomRevenue",
    "roomAdr",
  ])
    if (!found.has(required))
      throw new Error(
        "This does not appear to be a STAY Group Summary export. Required columns include Group/Group Name, Picked Up, Room Revenue, and ADR.",
      );
  const hasDateRange = found.has("stayDates");
  const hasDateColumns = found.has("arrivalDate") && found.has("departureDate");
  if (!hasDateRange && !hasDateColumns)
    throw new Error(
      "This Group Summary needs either DATES or ARRIVAL DATE and DEPARTURE DATE columns.",
    );
  const accepted: any[] = [],
    rejected: any[] = [],
    seen = new Set<string>();
  let duplicateRowCount = 0,
    ignoredRowCount = 0;
  lines.slice(1).forEach((line, index) => {
    const cells = parseDelimitedLine(line, delimiter),
      raw: Record<string, string> = {},
      row: any = {};
    rawHeaders.forEach((header, cellIndex) => {
      raw[header] = cells[cellIndex] ?? "";
      if (mapped[cellIndex]) row[mapped[cellIndex]!] = clean(cells[cellIndex]);
    });
    if (!clean(row.sourceGroupName)) {
      ignoredRowCount++;
      return;
    }
    const roomNights = numberValue(row.roomNights),
      roomRevenue = numberValue(row.roomRevenue),
      suppliedAdr = numberValue(row.roomAdr);
    if (roomNights === null || roomRevenue === null || suppliedAdr === null) {
      rejected.push({
        row: index + 2,
        reason: "Invalid picked-up rooms, revenue, or ADR",
      });
      return;
    }
    const dateParts = clean(row.stayDates).split(/\s+-\s+/),
      stayArrivalDate = safeSourceDate(row.arrivalDate || dateParts[0]),
      stayDepartureDate = safeSourceDate(row.departureDate || dateParts[1]);
    if (!stayArrivalDate || !stayDepartureDate) {
      rejected.push({ row: index + 2, reason: "Invalid stay date range" });
      return;
    }
    const originalName = clean(row.sourceGroupName),
      withoutTags = originalName.replace(/\s*\[[^\]]*\]\s*$/, "").trim();
    const identityMatch = withoutTags.match(/^(.*?)\s+-\s+([A-Z0-9]+)$/i),
      displayName = clean(identityMatch?.[1] || withoutTags),
      groupBookingCode = clean(row.groupBookingCode || identityMatch?.[2]);
    const normalizedRowHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(rawHeaders.map((header) => raw[header])))
      .digest("hex");
    if (seen.has(normalizedRowHash)) {
      duplicateRowCount++;
      return;
    }
    seen.add(normalizedRowHash);
    accepted.push({
      globalUltimateAccountName: displayName,
      accountName: displayName,
      accountId: groupBookingCode || null,
      accountType: "Group",
      marketCategory: "Group",
      marketSegment: "Group",
      roomNights,
      roomRevenue,
      roomAdr: roomNights > 0 ? roomRevenue / roomNights : suppliedAdr,
      totalRevenue: roomRevenue,
      totalAdr: suppliedAdr,
      averageLos: 0,
      fees: 0,
      taxes: 0,
      addOns: 0,
      stayArrivalDate,
      stayDepartureDate,
      groupBookingCode: groupBookingCode || null,
      sourceProfile: clean(row.sourceProfile) || null,
      contractedRoomNights: numberValue(row.contractedRoomNights),
      blockedRoomNights: numberValue(row.blockedRoomNights),
      cancelledRoomNights: numberValue(row.cancelledRoomNights),
      noShowRoomNights: numberValue(row.noShowRoomNights),
      cutoffDate: safeSourceDate(row.cutoffDate),
      released: /^y(es)?$/i.test(clean(row.released)),
      raw,
      sourceRowNumber: index + 2,
      normalizedRowHash,
      normalizedAccountKey: `stay-group:${displayName.toLowerCase().replace(/\s+/g, " ")}`,
    });
  });
  const grouped = new Map<string, any>();
  for (const row of accepted) {
    const key = row.groupBookingCode
      ? `code:${String(row.groupBookingCode).toLowerCase()}`
      : row.normalizedAccountKey;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, { ...row });
      continue;
    }
    current.roomNights += row.roomNights;
    current.roomRevenue += row.roomRevenue;
    current.totalRevenue += row.totalRevenue;
    for (const field of [
      "contractedRoomNights",
      "blockedRoomNights",
      "cancelledRoomNights",
      "noShowRoomNights",
    ])
      current[field] = (current[field] || 0) + (row[field] || 0);
    current.stayArrivalDate = [
      current.stayArrivalDate,
      row.stayArrivalDate,
    ].sort()[0];
    current.stayDepartureDate = [
      current.stayDepartureDate,
      row.stayDepartureDate,
    ]
      .sort()
      .at(-1);
    current.released = current.released || row.released;
  }
  const aggregated = Array.from(grouped.values()).map((row) => ({
    ...row,
    roomAdr:
      row.roomNights > 0 ? row.roomRevenue / row.roomNights : row.roomAdr,
    totalAdr:
      row.roomNights > 0 ? row.roomRevenue / row.roomNights : row.totalAdr,
  }));
  return {
    delimiter: delimiter === "\t" ? "tab" : "comma",
    rawHeaders,
    rowsFound: lines.length - 1,
    accepted: aggregated,
    rejected,
    duplicateRowCount,
    ignoredRowCount,
    warnings: [],
    reportDateRange: aggregated.length
      ? {
          start: aggregated.map((row) => row.stayArrivalDate).sort()[0],
          end: aggregated
            .map((row) => row.stayDepartureDate)
            .sort()
            .at(-1),
        }
      : null,
  };
}

export function parseStayReservationsCompanyImport(
  buffer: Buffer,
  reportYear?: number,
  reportMonth?: number,
) {
  buffer = workbookToDelimitedBuffer(buffer);
  if (!buffer.length) throw new Error("The selected file is empty.");
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2)
    throw new Error("The Reservations Report has headers but no data rows.");
  const delimiter =
    (lines[0].match(/\t/g) || []).length > (lines[0].match(/,/g) || []).length
      ? "\t"
      : ",";
  const rawHeaders = parseDelimitedLine(lines[0], delimiter).map((h) =>
    h.trim(),
  );
  const headerIndexes = new Map(
    rawHeaders.map((h, i) => [normalizeHeader(h), i]),
  );
  for (const required of [
    "company",
    "group",
    "rate($)",
    "status",
    "nights",
    "arrive",
    "depart",
  ])
    if (!headerIndexes.has(required))
      throw new Error(
        "This does not appear to be a STAY Reservations Report. Required columns include COMPANY, GROUP, STATUS, NIGHTS, ARRIVE, DEPART, and RATE($).",
      );
  const companies = new Map<string, any>();
  const seenRows = new Set<string>();
  let duplicateRowCount = 0,
    ignoredRowCount = 0;
  lines.slice(1).forEach((line, index) => {
    const cells = parseDelimitedLine(line, delimiter);
    const company = clean(cells[headerIndexes.get("company")!]);
    const group = clean(cells[headerIndexes.get("group")!]);
    const rate = clean(cells[headerIndexes.get("rate($)")!]);
    if (!company || /^aaa$/i.test(company) || group) {
      ignoredRowCount++;
      return;
    }
    const rowHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(cells))
      .digest("hex");
    if (seenRows.has(rowHash)) {
      duplicateRowCount++;
      return;
    }
    seenRows.add(rowHash);
    const key = company.toLowerCase().replace(/\s+/g, " ");
    const marketSegment = /\bgov(?:ernment|t)|military/i.test(
      `${company} ${rate}`,
    )
      ? "Government"
      : "Special Corp";
    const status = clean(cells[headerIndexes.get("status")!]).toUpperCase();
    const stayed = status === "DPT" || status === "INH";
    const arrivalDate = stayed
      ? safeSourceDate(cells[headerIndexes.get("arrive")!])
      : null;
    const departureDate = stayed
      ? safeSourceDate(cells[headerIndexes.get("depart")!])
      : null;
    let nights = stayed
      ? numberValue(cells[headerIndexes.get("nights")!]) || 0
      : 0;
    if (
      stayed &&
      arrivalDate &&
      departureDate &&
      Number.isInteger(reportYear) &&
      Number.isInteger(reportMonth)
    ) {
      const arrival = new Date(`${arrivalDate}T00:00:00Z`).getTime();
      const departure = new Date(`${departureDate}T00:00:00Z`).getTime();
      const monthStart = Date.UTC(reportYear!, reportMonth! - 1, 1);
      const monthEnd = Date.UTC(reportYear!, reportMonth!, 1);
      const overlapDays = Math.max(
        0,
        (Math.min(departure, monthEnd) - Math.max(arrival, monthStart)) /
          86_400_000,
      );
      nights = Math.min(nights, overlapDays);
    }
    const displayedRate = numberValue(rate.split(/\s+-\s+/).at(-1)) || 0;
    const estimatedRevenue = nights * displayedRate;
    const raw = Object.fromEntries(
      rawHeaders.map((h, i) => [h, cells[i] || ""]),
    );
    const existing = companies.get(key);
    if (!existing) {
      companies.set(key, {
        globalUltimateAccountName: company,
        accountName: company,
        accountType:
          "Observed company activity; revenue estimated from displayed rate",
        marketCategory: marketSegment,
        marketSegment,
        roomNights: nights,
        roomRevenue: estimatedRevenue,
        roomAdr: nights ? displayedRate : 0,
        totalRevenue: estimatedRevenue,
        totalAdr: nights ? displayedRate : 0,
        averageLos: nights,
        observedReservations: nights > 0 ? 1 : 0,
        fees: 0,
        taxes: 0,
        addOns: 0,
        stayArrivalDate: nights > 0 ? arrivalDate : null,
        stayDepartureDate: nights > 0 ? departureDate : null,
        raw,
        sourceRowNumber: index + 2,
        normalizedRowHash: crypto
          .createHash("sha256")
          .update(key)
          .digest("hex"),
        normalizedAccountKey: `stay-company:${key}`,
      });
      return;
    }
    if (marketSegment === "Government") {
      existing.marketCategory = marketSegment;
      existing.marketSegment = marketSegment;
    }
    existing.roomNights += nights;
    existing.roomRevenue += estimatedRevenue;
    existing.totalRevenue += estimatedRevenue;
    existing.observedReservations += nights > 0 ? 1 : 0;
    if (nights > 0 && arrivalDate)
      existing.stayArrivalDate = existing.stayArrivalDate
        ? [existing.stayArrivalDate, arrivalDate].sort()[0]
        : arrivalDate;
    if (nights > 0 && departureDate)
      existing.stayDepartureDate = existing.stayDepartureDate
        ? [existing.stayDepartureDate, departureDate].sort().at(-1)
        : departureDate;
  });
  const accepted = Array.from(companies.values()).map((company) => ({
    ...company,
    roomAdr:
      company.roomNights > 0 ? company.roomRevenue / company.roomNights : 0,
    totalAdr:
      company.roomNights > 0 ? company.roomRevenue / company.roomNights : 0,
    averageLos:
      company.observedReservations > 0
        ? company.roomNights / company.observedReservations
        : 0,
    observedReservations: undefined,
  }));
  return {
    delimiter: delimiter === "\t" ? "tab" : "comma",
    rawHeaders,
    rowsFound: lines.length - 1,
    accepted,
    rejected: [],
    duplicateRowCount,
    ignoredRowCount,
    warnings: [],
    reportDateRange: null,
  };
}

export function recoveryPriority(
  revenue: number,
  nights: number,
  monthsSince: number,
  monthsProduced: number,
) {
  return Math.round(
    Math.log10(1 + Math.max(0, revenue)) * 25 +
      Math.log10(1 + Math.max(0, nights)) * 15 +
      Math.min(monthsSince, 24) * 2 +
      Math.min(monthsProduced, 24) * 3,
  );
}
