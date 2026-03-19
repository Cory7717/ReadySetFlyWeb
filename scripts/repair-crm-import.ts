import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";

import { db } from "../server/db";
import { mapImportedCrmLeadRows, parseCrmLeadImportFile } from "../server/crmLeadImport";

type DbLeadRow = {
  id: string;
  email: string;
  company: string | null;
  status: string | null;
  source: string | null;
  category?: string | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
};

const filePath = process.argv[2];
const apply = process.argv.includes("--apply");

if (!filePath) {
  throw new Error("Usage: node --import tsx scripts/repair-crm-import.ts <csv-path> [--apply]");
}

const absolutePath = path.resolve(filePath);
const fileBuffer = fs.readFileSync(absolutePath);
const fileStats = fs.statSync(absolutePath);
const rows = parseCrmLeadImportFile(path.basename(absolutePath), fileBuffer);
const { imported } = mapImportedCrmLeadRows(rows);
const csvByEmail = new Map(imported.map((row) => [row.lead.email.toLowerCase(), row]));

const columnsResult = await db.execute(sql`
  select column_name
  from information_schema.columns
  where table_name = 'crm_leads'
  order by ordinal_position
`);

const columnNames = new Set(
  (columnsResult.rows || [])
    .map((row: any) => String(row.column_name || "").trim().toLowerCase())
    .filter(Boolean),
);

const emailList = sql.join(
  Array.from(csvByEmail.keys()).map((email) => sql`${email}`),
  sql`, `
);

const matchedResult = await db.execute(sql`
  select *
  from crm_leads
  where lower(email) in (${emailList})
  order by created_at asc
`);

const matchedRows = (matchedResult.rows || []) as DbLeadRow[];
const fileMtime = fileStats.mtime;
const newLeadWindowStart = new Date(fileMtime.getTime() - 1000 * 60 * 60 * 12);

const repairedNewRows: Array<{ email: string; id: string; updates: Record<string, string> }> = [];
const flaggedPreexisting: Array<{
  email: string;
  id: string;
  status: string | null;
  source: string | null;
  category: string | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
  reason: string;
}> = [];

for (const lead of matchedRows) {
  const csvRow = csvByEmail.get((lead.email || "").toLowerCase());
  if (!csvRow) continue;

  const createdAt = lead.created_at ? new Date(lead.created_at) : null;
  const updatedAt = lead.updated_at ? new Date(lead.updated_at) : null;
  const looksNewlyCreated =
    createdAt &&
    Number.isFinite(createdAt.getTime()) &&
    createdAt >= newLeadWindowStart;

  const updates: Record<string, string> = {};
  if (lead.source !== csvRow.lead.source) {
    updates.source = String(csvRow.lead.source || "");
  }

  if (columnNames.has("category")) {
    const currentCategory = String((lead as any).category || "");
    if (currentCategory !== String(csvRow.lead.category || "")) {
      updates.category = String(csvRow.lead.category || "");
    }
  }

  if (looksNewlyCreated) {
    if (lead.status !== csvRow.lead.status) {
      updates.status = String(csvRow.lead.status || "");
    }

    if (Object.keys(updates).length > 0) {
      repairedNewRows.push({ email: lead.email, id: lead.id, updates });
    }
    continue;
  }

  if (
    lead.status === "new" &&
    updatedAt &&
    Number.isFinite(updatedAt.getTime()) &&
    updatedAt >= newLeadWindowStart
  ) {
    flaggedPreexisting.push({
      email: lead.email,
      id: lead.id,
      status: lead.status,
      source: lead.source,
      category: String((lead as any).category || ""),
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
      reason: "Preexisting lead likely had status reset to new during duplicate import",
    });
  }
}

if (apply) {
  for (const item of repairedNewRows) {
    const assignments = Object.entries(item.updates).map(([key, value]) => {
      const column = sql.raw(key);
      return sql`${column} = ${value}`;
    });
    assignments.push(sql`updated_at = now()`);

    await db.execute(sql`
      update crm_leads
      set ${sql.join(assignments, sql`, `)}
      where id = ${item.id}
    `);
  }
}

console.log(
  JSON.stringify(
    {
      filePath: absolutePath,
      fileModifiedAt: fileMtime.toISOString(),
      connectedLeadColumnNames: Array.from(columnNames),
      matchedCount: matchedRows.length,
      repairableNewRowsCount: repairedNewRows.length,
      flaggedPreexistingCount: flaggedPreexisting.length,
      applied: apply,
      repairedNewRows,
      flaggedPreexisting,
    },
    null,
    2,
  ),
);
