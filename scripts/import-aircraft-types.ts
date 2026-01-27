import fs from "fs";
import path from "path";
import { and, eq, ilike, sql } from "drizzle-orm";
import { db } from "../server/db";
import { aircraftTypes, insertAircraftTypeSchema } from "../shared/schema";

type RawRow = Record<string, string | undefined>;

const REQUIRED_FIELDS = [
  "make",
  "model",
  "category",
  "engine_type",
  "cruise_ktas",
  "fuel_burn_gph",
  "usable_fuel_gal",
  "max_gross_weight_lb",
];

function parseCsvLine(line: string) {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  out.push(current);
  return out;
}

function parseCsv(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: RawRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim();
    });
    return row;
  });
  return { headers, rows };
}

function toSnakeCaseMap(row: RawRow) {
  const mapped: RawRow = {};
  for (const [key, value] of Object.entries(row)) {
    const snake = key
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/\s+/g, "_")
      .toLowerCase();
    mapped[snake] = value;
  }
  return mapped;
}

function normalizeRow(row: RawRow) {
  const data = toSnakeCaseMap(row);
  return {
    make: data.make || "",
    model: data.model || "",
    icaoType: data.icao_type || null,
    category: data.category || "",
    engineType: data.engine_type || "",
    cruiseKtas: data.cruise_ktas || "",
    fuelBurnGph: data.fuel_burn_gph || "",
    usableFuelGal: data.usable_fuel_gal || "",
    maxGrossWeightLb: data.max_gross_weight_lb || "",
    defaultAltitudeFt: data.default_altitude_ft || null,
    isVerified: data.is_verified ? ["true", "1", "yes"].includes(String(data.is_verified).toLowerCase()) : false,
    sourceNote: data.source_note || null,
  };
}

async function upsertAircraftType(row: ReturnType<typeof normalizeRow>) {
  const parsed = insertAircraftTypeSchema.safeParse(row);
  if (!parsed.success) {
    throw new Error(`Validation failed for ${row.make} ${row.model}: ${parsed.error.message}`);
  }
  const payload = parsed.data;
  const icao = payload.icaoType?.trim();
  let existingId: string | null = null;

  if (icao) {
    const existing = await db
      .select({ id: aircraftTypes.id })
      .from(aircraftTypes)
      .where(eq(aircraftTypes.icaoType, icao))
      .limit(1);
    existingId = existing[0]?.id || null;
  }

  if (!existingId) {
    const existing = await db
      .select({ id: aircraftTypes.id })
      .from(aircraftTypes)
      .where(and(
        ilike(aircraftTypes.make, payload.make),
        ilike(aircraftTypes.model, payload.model),
      ))
      .limit(1);
    existingId = existing[0]?.id || null;
  }

  if (existingId) {
    await db
      .update(aircraftTypes)
      .set({ ...payload, updatedAt: sql`now()` })
      .where(eq(aircraftTypes.id, existingId));
    return "updated";
  }

  await db.insert(aircraftTypes).values(payload);
  return "inserted";
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: tsx scripts/import-aircraft-types.ts <path-to-csv>");
    process.exit(1);
  }
  const fullPath = path.resolve(csvPath);
  const content = fs.readFileSync(fullPath, "utf8");
  const { headers, rows } = parseCsv(content);
  if (headers.length === 0) {
    console.error("No CSV headers found.");
    process.exit(1);
  }

  for (const field of REQUIRED_FIELDS) {
    if (!headers.map((h) => h.toLowerCase()).includes(field)) {
      console.error(`Missing required header: ${field}`);
      process.exit(1);
    }
  }

  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    const normalized = normalizeRow(row);
    const result = await upsertAircraftType(normalized);
    if (result === "inserted") inserted += 1;
    if (result === "updated") updated += 1;
  }

  console.log(`Import complete. Inserted: ${inserted}. Updated: ${updated}.`);
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
