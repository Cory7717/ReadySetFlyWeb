import crypto from "crypto";

export const MAX_SALES_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_SALES_IMPORT_ROWS = 25_000;
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
  if (!buffer.length) throw new Error("The selected file is empty.");
  if (
    (buffer[0] === 0xd0 && buffer[1] === 0xcf) ||
    (buffer[0] === 0x50 && buffer[1] === 0x4b)
  )
    throw new Error(
      "This is a binary Excel workbook. Export Analytical Account Tracking as tab-delimited text, CSV, TSV, or TXT.",
    );
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
  profile: "sourceProfile",
  dates: "stayDates",
  contracted: "contractedRoomNights",
  "total blocked": "blockedRoomNights",
  "picked up": "roomNights",
  remaining: "remainingRoomNights",
  cancelled: "cancelledRoomNights",
  "no show": "noShowRoomNights",
  "room revenue ($)": "roomRevenue",
  "room revenue": "roomRevenue",
  "adr ($)": "roomAdr",
  adr: "roomAdr",
  "cut off date": "cutoffDate",
  released: "released",
};
export function detectStaySalesReportType(buffer: Buffer) {
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
    headers.has("group") &&
    headers.has("dates") &&
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
    "stayDates",
    "roomNights",
    "roomRevenue",
    "roomAdr",
  ])
    if (!found.has(required))
      throw new Error(
        "This does not appear to be the STAY Groups Summary export. Required columns include Group, Dates, Picked Up, Room Revenue ($), and ADR ($).",
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
      stayArrivalDate = safeSourceDate(dateParts[0]),
      stayDepartureDate = safeSourceDate(dateParts[1]);
    if (!stayArrivalDate || !stayDepartureDate) {
      rejected.push({ row: index + 2, reason: "Invalid stay date range" });
      return;
    }
    const originalName = clean(row.sourceGroupName),
      withoutTags = originalName.replace(/\s*\[[^\]]*\]\s*$/, "").trim();
    const identityMatch = withoutTags.match(/^(.*?)\s+-\s+([A-Z0-9]+)$/i),
      displayName = clean(identityMatch?.[1] || withoutTags),
      groupBookingCode = clean(identityMatch?.[2]);
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
  return {
    delimiter: delimiter === "\t" ? "tab" : "comma",
    rawHeaders,
    rowsFound: lines.length - 1,
    accepted,
    rejected,
    duplicateRowCount,
    ignoredRowCount,
    warnings: [],
    reportDateRange: accepted.length
      ? {
          start: accepted.map((row) => row.stayArrivalDate).sort()[0],
          end: accepted
            .map((row) => row.stayDepartureDate)
            .sort()
            .at(-1),
        }
      : null,
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
