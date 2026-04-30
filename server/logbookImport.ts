import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import type { InsertLogbookEntry, LogbookEntry } from "@shared/schema";

type RawRow = Record<string, string>;

export type ImportedLogbookRow = {
  entry: InsertLogbookEntry;
  rowNumber: number;
  signature: string;
};

export type ImportSkip = {
  rowNumber: number;
  reason: string;
};

export type ImportDuplicate = {
  rowNumber: number;
  signature: string;
  duplicateInExistingLogbook: boolean;
  duplicateInFile: boolean;
  matchingImportRowNumbers: number[];
  existingEntryId?: string;
  existingEntryDate?: string;
  existingEntryRoute?: string;
  existingEntryTailNumber?: string;
};

const LOGBOOK_TEMPLATE_HEADERS = [
  "flight_date",
  "tail_number",
  "aircraft_type",
  "aircraft_category",
  "aircraft_class",
  "is_simulator",
  "device_type",
  "route",
  "time_day",
  "time_night",
  "pic",
  "sic",
  "dual",
  "solo",
  "cross_country",
  "instrument_actual",
  "approaches",
  "landings_day",
  "landings_night",
  "holds",
  "remarks",
  "hobbs_start",
  "hobbs_end",
];

const LOGBOOK_TEMPLATE_INSTRUCTIONS = [
  ["Ready Set Fly Logbook Import Template"],
  ["Fill only the Entries sheet or CSV header columns before upload."],
  ["Required field: flight_date"],
  ["Accepted date formats: YYYY-MM-DD, MM/DD/YYYY, or Excel date cells"],
  ["Accepted boolean values for is_simulator: true, false, yes, no, 1, 0"],
  ["Decimal fields: time_day, time_night, pic, sic, dual, solo, cross_country, instrument_actual, hobbs_start, hobbs_end"],
  ["Integer fields: approaches, landings_day, landings_night, holds"],
  ["Do not rename the header row. Leave unknown values blank."],
];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeCell(value: string) {
  return value.trim();
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnIndexToRef(index: number) {
  let current = index + 1;
  let reference = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    reference = String.fromCharCode(65 + remainder) + reference;
    current = Math.floor((current - 1) / 26);
  }
  return reference;
}

function createWorksheetXml(rows: string[][]) {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const cellValue = String(value ?? "");
          if (!cellValue) return "";
          const ref = `${columnIndexToRef(columnIndex)}${rowIndex + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cellValue)}</t></is></c>`;
        })
        .filter(Boolean)
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

function createWorkbookXml(sheetNames: string[]) {
  const sheets = sheetNames
    .map((sheetName, index) => `<sheet name="${escapeXml(sheetName)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheets}</sheets>
</workbook>`;
}

function createWorkbookRelationshipsXml(sheetCount: number) {
  const relationships = Array.from({ length: sheetCount }, (_entry, index) => {
    return `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relationships}
</Relationships>`;
}

function createRootRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function createContentTypesXml(sheetCount: number) {
  const overrides = Array.from({ length: sheetCount }, (_entry, index) => {
    return `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${overrides}
</Types>`;
}

function createAppPropertiesXml(sheetNames: string[]) {
  const titles = sheetNames.map((name) => `<vt:lpstr>${escapeXml(name)}</vt:lpstr>`).join("");
  const sheetCount = sheetNames.length;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Ready Set Fly</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>${sheetCount}</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="${sheetCount}" baseType="lpstr">${titles}</vt:vector>
  </TitlesOfParts>
  <Company>Ready Set Fly</Company>
</Properties>`;
}

function createCorePropertiesXml() {
  const timestamp = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>Ready Set Fly</dc:creator>
  <cp:lastModifiedBy>Ready Set Fly</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>
  <dc:title>Logbook Import Template</dc:title>
</cp:coreProperties>`;
}

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractRowsFromMatrix(matrix: string[][]) {
  const nonEmptyRows = matrix.filter((row) => row.some((cell) => String(cell || "").trim() !== ""));
  if (!nonEmptyRows.length) return [];

  const headers = nonEmptyRows[0].map((value, index) => normalizeHeader(value || `column_${index + 1}`));
  return nonEmptyRows.slice(1).map((row) => {
    const record: RawRow = {};
    headers.forEach((header, index) => {
      record[header] = String(row[index] ?? "").trim();
    });
    return record;
  });
}

function parseCsv(content: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;
  const normalized = content.replace(/^\uFEFF/, "");

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && nextChar === "\n") i += 1;
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return extractRowsFromMatrix(rows);
}

function columnRefToIndex(reference: string) {
  const letters = reference.replace(/[0-9]/g, "").toUpperCase();
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return Math.max(0, index - 1);
}

function extractXmlText(value: any, sharedStrings: string[]): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => extractXmlText(entry, sharedStrings)).join("");
  }
  if (typeof value === "object") {
    if (value.t !== undefined) return extractXmlText(value.t, sharedStrings);
    if (value.v !== undefined) return extractXmlText(value.v, sharedStrings);
    if (value.__text !== undefined) return extractXmlText(value.__text, sharedStrings);
    if (value["#text"] !== undefined) return extractXmlText(value["#text"], sharedStrings);
  }
  return "";
}

function parseXlsx(buffer: Buffer) {
  const zip = new AdmZip(buffer);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    textNodeName: "__text",
  });

  const workbookEntry = zip.getEntry("xl/workbook.xml");
  const relsEntry = zip.getEntry("xl/_rels/workbook.xml.rels");
  if (!workbookEntry || !relsEntry) {
    throw new Error("Invalid XLSX file");
  }

  const workbook = parser.parse(workbookEntry.getData().toString("utf-8"));
  const workbookRels = parser.parse(relsEntry.getData().toString("utf-8"));
  const relationships = ensureArray(workbookRels.Relationships?.Relationship);
  const sheets = ensureArray(workbook.workbook?.sheets?.sheet);
  const firstSheet = sheets[0];
  if (!firstSheet) {
    throw new Error("XLSX file does not contain any worksheets");
  }

  const relationshipId = firstSheet["r:id"] || firstSheet.id;
  const relationship = relationships.find((item) => item.Id === relationshipId);
  if (!relationship?.Target) {
    throw new Error("Unable to resolve XLSX worksheet");
  }

  const target = String(relationship.Target).replace(/^\/+/, "");
  const worksheetPath = target.startsWith("xl/") ? target : `xl/${target}`;
  const worksheetEntry = zip.getEntry(worksheetPath);
  if (!worksheetEntry) {
    throw new Error("Unable to load XLSX worksheet data");
  }

  const sharedStringsEntry = zip.getEntry("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsEntry
    ? ensureArray(parser.parse(sharedStringsEntry.getData().toString("utf-8")).sst?.si).map((entry) =>
        extractXmlText(entry, []),
      )
    : [];

  const worksheet = parser.parse(worksheetEntry.getData().toString("utf-8"));
  const rows = ensureArray(worksheet.worksheet?.sheetData?.row);
  const matrix: string[][] = rows.map((row: any) => {
    const values: string[] = [];
    ensureArray(row.c).forEach((cell: any) => {
      const ref = String(cell.r || "");
      const colIndex = columnRefToIndex(ref);
      let cellValue = "";
      if (cell.t === "s") {
        const sharedIndex = Number(cell.v ?? 0);
        cellValue = sharedStrings[sharedIndex] ?? "";
      } else if (cell.t === "inlineStr") {
        cellValue = extractXmlText(cell.is, sharedStrings);
      } else {
        cellValue = extractXmlText(cell.v ?? cell.is ?? "", sharedStrings);
      }
      values[colIndex] = cellValue;
    });
    return values;
  });

  return extractRowsFromMatrix(matrix);
}

function getStringValue(row: RawRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function parseBooleanValue(value: string) {
  const normalized = normalizeCell(value).toLowerCase();
  if (!normalized) return false;
  return ["true", "yes", "y", "1", "sim", "simulator"].includes(normalized);
}

function parseDecimalValue(value: string) {
  const normalized = normalizeCell(value);
  if (!normalized) return undefined;
  const parsed = Number(normalized.replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid decimal value "${value}"`);
  }
  return parsed.toFixed(1).replace(/\.0$/, "");
}

function parseIntegerValue(value: string) {
  const normalized = normalizeCell(value);
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid whole-number value "${value}"`);
  }
  return parsed;
}

function excelSerialDateToIso(value: number) {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const millis = value * 24 * 60 * 60 * 1000;
  const date = new Date(excelEpoch.getTime() + millis);
  return date.toISOString().split("T")[0];
}

function parseDateValue(value: string) {
  const normalized = normalizeCell(value);
  if (!normalized) {
    throw new Error("Missing flight_date");
  }

  if (/^\d{5,}$/.test(normalized)) {
    const numeric = Number(normalized);
    if (Number.isFinite(numeric) && numeric > 20000) {
      return excelSerialDateToIso(numeric);
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  throw new Error(`Invalid flight_date "${value}"`);
}

function normalizeSignatureText(value?: string | null) {
  return (value || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function buildEntrySignature(entry: {
  flightDate: string | Date;
  tailNumber?: string | null;
  aircraftType?: string | null;
  route?: string | null;
  pic?: string | null;
  sic?: string | null;
  dual?: string | null;
  timeDay?: string | null;
  timeNight?: string | null;
  isSimulator?: boolean | null;
}) {
  const flightDate = entry.flightDate instanceof Date
    ? entry.flightDate.toISOString().split("T")[0]
    : String(entry.flightDate || "").split("T")[0];

  return [
    flightDate,
    normalizeSignatureText(entry.tailNumber),
    normalizeSignatureText(entry.aircraftType),
    normalizeSignatureText(entry.route),
    normalizeSignatureText(entry.pic),
    normalizeSignatureText(entry.sic),
    normalizeSignatureText(entry.dual),
    normalizeSignatureText(entry.timeDay),
    normalizeSignatureText(entry.timeNight),
    entry.isSimulator ? "SIM" : "AIRCRAFT",
  ].join("|");
}

export function parseLogbookImportFile(fileName: string, buffer: Buffer) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    return parseCsv(buffer.toString("utf-8"));
  }
  if (lower.endsWith(".xlsx")) {
    return parseXlsx(buffer);
  }
  throw new Error("Only CSV and XLSX files are supported");
}

export function buildLogbookTemplateCsv() {
  return `\uFEFF${LOGBOOK_TEMPLATE_HEADERS.join(",")}\n`;
}

export function buildLogbookTemplateXlsx() {
  const zip = new AdmZip();
  const sheetNames = ["Entries", "Instructions"];
  const sheets = [
    {
      path: "xl/worksheets/sheet1.xml",
      rows: [LOGBOOK_TEMPLATE_HEADERS],
    },
    {
      path: "xl/worksheets/sheet2.xml",
      rows: LOGBOOK_TEMPLATE_INSTRUCTIONS,
    },
  ];

  zip.addFile("[Content_Types].xml", Buffer.from(createContentTypesXml(sheets.length), "utf-8"));
  zip.addFile("_rels/.rels", Buffer.from(createRootRelationshipsXml(), "utf-8"));
  zip.addFile("docProps/app.xml", Buffer.from(createAppPropertiesXml(sheetNames), "utf-8"));
  zip.addFile("docProps/core.xml", Buffer.from(createCorePropertiesXml(), "utf-8"));
  zip.addFile("xl/workbook.xml", Buffer.from(createWorkbookXml(sheetNames), "utf-8"));
  zip.addFile("xl/_rels/workbook.xml.rels", Buffer.from(createWorkbookRelationshipsXml(sheets.length), "utf-8"));

  sheets.forEach((sheet) => {
    zip.addFile(sheet.path, Buffer.from(createWorksheetXml(sheet.rows), "utf-8"));
  });

  return zip.toBuffer();
}

export function mapImportedLogbookRows(rows: RawRow[]) {
  const imported: ImportedLogbookRow[] = [];
  const skipped: ImportSkip[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;

    try {
      const flightDate = parseDateValue(getStringValue(row, ["flight_date", "date", "flightdate"]));
      const isSimulator = parseBooleanValue(getStringValue(row, ["is_simulator", "simulator", "is_sim", "sim"]));

      const entry: InsertLogbookEntry = {
        flightDate: new Date(flightDate),
        tailNumber: getStringValue(row, ["tail_number", "tail", "n_number"]) || undefined,
        aircraftType: getStringValue(row, ["aircraft_type", "type", "make_model"]) || undefined,
        aircraftCategory: getStringValue(row, ["aircraft_category", "category"]) || undefined,
        aircraftClass: getStringValue(row, ["aircraft_class", "class"]) || undefined,
        isSimulator,
        deviceType: isSimulator ? getStringValue(row, ["device_type", "simulator_type", "device"]) || undefined : undefined,
        route: getStringValue(row, ["route"]) || undefined,
        timeDay: parseDecimalValue(getStringValue(row, ["time_day", "day", "day_time"])),
        timeNight: parseDecimalValue(getStringValue(row, ["time_night", "night", "night_time"])),
        pic: parseDecimalValue(getStringValue(row, ["pic"])),
        sic: parseDecimalValue(getStringValue(row, ["sic"])),
        dual: parseDecimalValue(getStringValue(row, ["dual"])),
        solo: parseDecimalValue(getStringValue(row, ["solo"])),
        crossCountry: parseDecimalValue(getStringValue(row, ["cross_country", "xc", "xc_time"])),
        instrumentActual: parseDecimalValue(getStringValue(row, ["instrument_actual", "instrument", "actual_instrument"])),
        approaches: parseIntegerValue(getStringValue(row, ["approaches"])),
        landingsDay: parseIntegerValue(getStringValue(row, ["landings_day", "day_landings"])),
        landingsNight: parseIntegerValue(getStringValue(row, ["landings_night", "night_landings"])),
        holds: parseIntegerValue(getStringValue(row, ["holds"])),
        remarks: getStringValue(row, ["remarks", "notes", "comments"]) || undefined,
        hobbsStart: parseDecimalValue(getStringValue(row, ["hobbs_start"])),
        hobbsEnd: parseDecimalValue(getStringValue(row, ["hobbs_end"])),
      };

      imported.push({
        entry,
        rowNumber,
        signature: buildEntrySignature({
          flightDate,
          tailNumber: entry.tailNumber,
          aircraftType: entry.aircraftType,
          route: entry.route,
          pic: entry.pic,
          sic: entry.sic,
          dual: entry.dual,
          timeDay: entry.timeDay,
          timeNight: entry.timeNight,
          isSimulator: entry.isSimulator,
        }),
      });
    } catch (error: any) {
      skipped.push({
        rowNumber,
        reason: error?.message || "Unable to parse row",
      });
    }
  });

  return { imported, skipped };
}

export function findLogbookImportDuplicates(imported: ImportedLogbookRow[], existingEntries: LogbookEntry[]): ImportDuplicate[] {
  const existingBySignature = new Map<string, LogbookEntry>();
  const importRowsBySignature = new Map<string, number[]>();

  existingEntries.forEach((entry) => {
    const signature = buildEntrySignature({
      flightDate: entry.flightDate,
      tailNumber: entry.tailNumber,
      aircraftType: entry.aircraftType,
      route: entry.route,
      pic: entry.pic,
      sic: entry.sic,
      dual: entry.dual,
      timeDay: entry.timeDay,
      timeNight: entry.timeNight,
      isSimulator: entry.isSimulator,
    });

    if (!existingBySignature.has(signature)) {
      existingBySignature.set(signature, entry);
    }
  });

  imported.forEach((row) => {
    const rowsForSignature = importRowsBySignature.get(row.signature) || [];
    rowsForSignature.push(row.rowNumber);
    importRowsBySignature.set(row.signature, rowsForSignature);
  });

  return imported.flatMap((row) => {
    const matchingImportRowNumbers = (importRowsBySignature.get(row.signature) || []).filter((value) => value !== row.rowNumber);
    const existingEntry = existingBySignature.get(row.signature);
    const duplicateInExistingLogbook = !!existingEntry;
    const duplicateInFile = matchingImportRowNumbers.length > 0;

    if (!duplicateInExistingLogbook && !duplicateInFile) {
      return [];
    }

    return [{
      rowNumber: row.rowNumber,
      signature: row.signature,
      duplicateInExistingLogbook,
      duplicateInFile,
      matchingImportRowNumbers,
      existingEntryId: existingEntry?.id,
      existingEntryDate: existingEntry?.flightDate ? String(existingEntry.flightDate) : undefined,
      existingEntryRoute: existingEntry?.route || undefined,
      existingEntryTailNumber: existingEntry?.tailNumber || undefined,
    }];
  });
}
