import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { leadCategories, leadSources, leadStatuses } from "@shared/schema";
import type { CrmLead, InsertCrmLead, LeadCategory } from "@shared/schema";

type RawRow = Record<string, string>;

export type ImportedCrmLeadRow = {
  lead: InsertCrmLead;
  rowNumber: number;
  providedFields: {
    firstName?: boolean;
    lastName?: boolean;
    phone?: boolean;
    company?: boolean;
    title?: boolean;
    status?: boolean;
    source?: boolean;
    category?: boolean;
    notes?: boolean;
  };
};

export type ImportSkip = {
  rowNumber: number;
  reason: string;
};

export type ImportDuplicate = {
  rowNumber: number;
  email: string;
  company?: string;
  duplicateByEmail: boolean;
  duplicateByCompany: boolean;
  duplicateInFileByEmail: boolean;
  duplicateInFileByCompany: boolean;
  existingLeadId?: string;
  existingLeadName?: string;
  existingLeadEmail?: string;
  existingLeadCompany?: string;
  matchingImportRowNumbers: number[];
};

const CATEGORY_ALIASES: Record<string, LeadCategory> = {
  "aircraft sales": "aircraft_sales",
  "aircraft sale": "aircraft_sales",
  "aircraft for sale": "aircraft_sales",
  "aircraft listing": "aircraft_sales",
  "aircraft listings": "aircraft_sales",
  "aviation jobs": "aviation_jobs",
  "aviation job": "aviation_jobs",
  "jobs": "aviation_jobs",
  "job": "aviation_jobs",
  "flight schools": "flight_schools",
  "flight school": "flight_schools",
  "rentals": "rentals",
  "rental": "rentals",
  "rental service": "rentals",
  "rental services": "rentals",
  "aircraft rental": "rentals",
  "aircraft rentals": "rentals",
  "cfi": "cfi_services",
  "cfi service": "cfi_services",
  "cfi services": "cfi_services",
  "charter": "charter_services",
  "charter service": "charter_services",
  "charter services": "charter_services",
  "charter company": "charter_services",
  "mechanic": "mechanic_services",
  "mechanic service": "mechanic_services",
  "mechanic services": "mechanic_services",
  "banner ads": "banner_ads",
  "banner ad": "banner_ads",
  "display ads": "banner_ads",
  "marketplace services": "marketplace_services",
  "marketplace service": "marketplace_services",
  "marketplace": "marketplace_services",
  "marketplace listing": "marketplace_services",
  "marketplace listings": "marketplace_services",
  "sponsorship": "sponsorships",
  "sponsorships": "sponsorships",
  sponsor: "sponsorships",
  "other": "other",
};

const SOURCE_ALIASES: Record<string, InsertCrmLead["source"]> = {
  website: "website",
  referral: "referral",
  "social media": "social_media",
  social: "social_media",
  advertising: "advertising",
  ads: "advertising",
  "cold outreach": "cold_outreach",
  cold: "cold_outreach",
  event: "event",
  other: "other",
};

const STATUS_ALIASES: Record<string, InsertCrmLead["status"]> = {
  new: "new",
  contacted: "contacted",
  qualified: "qualified",
  proposal: "proposal",
  negotiation: "negotiation",
  won: "won",
  lost: "lost",
};

const CRM_LEAD_TEMPLATE_HEADERS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "company",
  "title",
  "source",
  "category",
  "status",
  "notes",
];

const CRM_LEAD_TEMPLATE_INSTRUCTIONS = [
  ["Ready Set Fly CRM Lead Import Template"],
  ["Fill only the Leads sheet or CSV header columns before upload."],
  ["Accepted source values: website, referral, social_media, advertising, cold_outreach, event, other"],
  ["Accepted category values: aircraft_sales, aviation_jobs, flight_schools, rentals, cfi_services, charter_services, mechanic_services, banner_ads, marketplace_services, sponsorships, other"],
  ["Accepted status values: new, contacted, qualified, proposal, negotiation, won, lost"],
  ["Do not rename the header row. Leave blank fields empty if data is unknown."],
];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
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
    .map(
      (sheetName, index) =>
        `<sheet name="${escapeXml(sheetName)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
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
  <dc:title>CRM Lead Import Template</dc:title>
</cp:coreProperties>`;
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

const DIRECT_CATEGORY_VALUES = new Set<string>(leadCategories.map((value) => String(value)));
const DIRECT_SOURCE_VALUES = new Set<string>(leadSources.map((value) => String(value)));
const DIRECT_STATUS_VALUES = new Set<string>(leadStatuses.map((value) => String(value)));

function normalizeDuplicateKey(value: string | undefined) {
  return (value || "").trim().toLowerCase();
}

function splitName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "Lead" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function getStringValue(row: RawRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function inferNameFromEmail(email: string) {
  const local = email.split("@")[0] || "";
  const tokens = local
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1));
  if (!tokens.length) return { firstName: "Unknown", lastName: "Lead" };
  if (tokens.length === 1) return { firstName: tokens[0], lastName: "Lead" };
  return { firstName: tokens[0], lastName: tokens.slice(1).join(" ") };
}

function normalizeCategory(value: string): LeadCategory {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "other";
  if (DIRECT_CATEGORY_VALUES.has(trimmed)) {
    return trimmed as LeadCategory;
  }
  const normalized = normalizeLabel(value);
  return CATEGORY_ALIASES[normalized] ?? "other";
}

function normalizeSource(value: string): InsertCrmLead["source"] {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "other";
  if (DIRECT_SOURCE_VALUES.has(trimmed)) {
    return trimmed as InsertCrmLead["source"];
  }
  const normalized = normalizeLabel(value);
  return SOURCE_ALIASES[normalized] ?? "other";
}

function normalizeStatus(value: string): InsertCrmLead["status"] {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "new";
  if (DIRECT_STATUS_VALUES.has(trimmed)) {
    return trimmed as InsertCrmLead["status"];
  }
  const normalized = normalizeLabel(value);
  return STATUS_ALIASES[normalized] ?? "new";
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

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
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

export function parseCrmLeadImportFile(fileName: string, buffer: Buffer) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    return parseCsv(buffer.toString("utf-8"));
  }
  if (lower.endsWith(".xlsx")) {
    return parseXlsx(buffer);
  }
  throw new Error("Only CSV and XLSX files are supported");
}

export function buildCrmLeadTemplateCsv() {
  return `\uFEFF${CRM_LEAD_TEMPLATE_HEADERS.join(",")}\n`;
}

export function buildCrmLeadTemplateXlsx() {
  const zip = new AdmZip();
  const sheetNames = ["Leads", "Instructions"];
  const sheets = [
    {
      path: "xl/worksheets/sheet1.xml",
      rows: [CRM_LEAD_TEMPLATE_HEADERS],
    },
    {
      path: "xl/worksheets/sheet2.xml",
      rows: CRM_LEAD_TEMPLATE_INSTRUCTIONS,
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

export function findCrmLeadImportDuplicates(imported: ImportedCrmLeadRow[], existingLeads: CrmLead[]): ImportDuplicate[] {
  const existingByEmail = new Map<string, CrmLead>();
  const existingByCompany = new Map<string, CrmLead>();
  const importRowsByEmail = new Map<string, number[]>();
  const importRowsByCompany = new Map<string, number[]>();

  existingLeads.forEach((lead) => {
    const emailKey = normalizeDuplicateKey(lead.email);
    const companyKey = normalizeDuplicateKey(lead.company || undefined);
    if (emailKey && !existingByEmail.has(emailKey)) {
      existingByEmail.set(emailKey, lead);
    }
    if (companyKey && !existingByCompany.has(companyKey)) {
      existingByCompany.set(companyKey, lead);
    }
  });

  imported.forEach((row) => {
    const emailKey = normalizeDuplicateKey(row.lead.email);
    const companyKey = normalizeDuplicateKey(row.lead.company || undefined);
    if (emailKey) {
      const rows = importRowsByEmail.get(emailKey) || [];
      rows.push(row.rowNumber);
      importRowsByEmail.set(emailKey, rows);
    }
    if (companyKey) {
      const rows = importRowsByCompany.get(companyKey) || [];
      rows.push(row.rowNumber);
      importRowsByCompany.set(companyKey, rows);
    }
  });

  return imported.flatMap((row) => {
    const emailKey = normalizeDuplicateKey(row.lead.email);
    const companyKey = normalizeDuplicateKey(row.lead.company || undefined);
    const matchingEmailRows = emailKey ? (importRowsByEmail.get(emailKey) || []).filter((value) => value !== row.rowNumber) : [];
    const matchingCompanyRows = companyKey ? (importRowsByCompany.get(companyKey) || []).filter((value) => value !== row.rowNumber) : [];
    const matchingExistingLead = existingByEmail.get(emailKey) || (companyKey ? existingByCompany.get(companyKey) : undefined);
    const duplicateByEmail = Boolean(emailKey && existingByEmail.has(emailKey));
    const duplicateByCompany = Boolean(companyKey && existingByCompany.has(companyKey));
    const duplicateInFileByEmail = matchingEmailRows.length > 0;
    const duplicateInFileByCompany = matchingCompanyRows.length > 0;

    if (!duplicateByEmail && !duplicateByCompany && !duplicateInFileByEmail && !duplicateInFileByCompany) {
      return [];
    }

    return [{
      rowNumber: row.rowNumber,
      email: row.lead.email,
      company: row.lead.company || undefined,
      duplicateByEmail,
      duplicateByCompany,
      duplicateInFileByEmail,
      duplicateInFileByCompany,
      existingLeadId: matchingExistingLead?.id,
      existingLeadName: matchingExistingLead
        ? `${matchingExistingLead.firstName} ${matchingExistingLead.lastName}`.trim()
        : undefined,
      existingLeadEmail: matchingExistingLead?.email,
      existingLeadCompany: matchingExistingLead?.company || undefined,
      matchingImportRowNumbers: Array.from(new Set([...matchingEmailRows, ...matchingCompanyRows])).sort((a, b) => a - b),
    }];
  });
}

export function mapImportedCrmLeadRows(rows: RawRow[]) {
  const imported: ImportedCrmLeadRow[] = [];
  const skipped: ImportSkip[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const email = getStringValue(row, ["email", "email_address", "e_mail"]).toLowerCase();
    if (!email) {
      skipped.push({ rowNumber, reason: "Missing email" });
      return;
    }

    const explicitFirstName = getStringValue(row, ["first_name", "firstname", "first"]);
    const explicitLastName = getStringValue(row, ["last_name", "lastname", "last"]);
    const fullName = getStringValue(row, ["full_name", "name", "contact_name"]);
    const company = getStringValue(row, ["company", "company_name", "business", "organization"]);
    const phone = getStringValue(row, ["phone", "phone_number", "mobile", "cell"]);
    const title = getStringValue(row, ["title", "job_title", "role", "position"]);
    const rawStatus = getStringValue(row, ["status"]);
    const rawSource = getStringValue(row, ["source", "lead_source"]);
    const rawCategory = getStringValue(row, ["category", "categories", "lead_category", "lead_type", "segment", "industry"]);
    const notes = getStringValue(row, ["notes", "note", "comments", "comment"]);

    let firstName = explicitFirstName;
    let lastName = explicitLastName;

    if (!firstName && !lastName && fullName) {
      const split = splitName(fullName);
      firstName = split.firstName;
      lastName = split.lastName;
    }

    if (!firstName) {
      const inferred = inferNameFromEmail(email);
      firstName = inferred.firstName;
      lastName = lastName || inferred.lastName;
    }

    if (!lastName) {
      lastName = "Lead";
    }

    imported.push({
      rowNumber,
      lead: {
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        company: company || undefined,
        title: title || undefined,
        status: normalizeStatus(rawStatus),
        source: normalizeSource(rawSource),
        category: normalizeCategory(rawCategory),
        notes: notes || undefined,
      },
      providedFields: {
        firstName: Boolean(explicitFirstName || fullName),
        lastName: Boolean(explicitLastName || fullName),
        phone: Boolean(phone),
        company: Boolean(company),
        title: Boolean(title),
        status: Boolean(rawStatus),
        source: Boolean(rawSource),
        category: Boolean(rawCategory),
        notes: Boolean(notes),
      },
    });
  });

  return { imported, skipped };
}

export function mergeImportedLeadData(existing: CrmLead, incoming: ImportedCrmLeadRow): Partial<CrmLead> {
  const { lead, providedFields } = incoming;
  const updates: Partial<CrmLead> = {
    email: existing.email,
  };

  if (providedFields.firstName) updates.firstName = lead.firstName;
  if (providedFields.lastName) updates.lastName = lead.lastName;
  if (providedFields.phone) updates.phone = lead.phone;
  if (providedFields.company) updates.company = lead.company;
  if (providedFields.title) updates.title = lead.title;
  if (providedFields.status) updates.status = lead.status;
  if (providedFields.source) updates.source = lead.source;
  if (providedFields.category) updates.category = lead.category;
  if (providedFields.notes) updates.notes = lead.notes;

  return updates;
}
