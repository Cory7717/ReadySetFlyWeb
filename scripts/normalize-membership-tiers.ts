import dotenv from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

dotenv.config({ path: "server/.env" });
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const apply = process.argv.includes("--apply");
const confirmation = process.env.CONFIRM_MEMBERSHIP_NORMALIZATION;
if (apply && confirmation !== "normalize-to-premium") {
  throw new Error(
    "Refusing to write. Set CONFIRM_MEMBERSHIP_NORMALIZATION=normalize-to-premium and pass --apply.",
  );
}

const LEGACY_TIERS = ["pro", "pro_plus", "pro_core", "core"] as const;
const pool = new Pool({ connectionString });
const client = await pool.connect();

const tableExists = async (tableName: string) => {
  const result = await client.query<{ table_name: string | null }>(
    "SELECT to_regclass($1) AS table_name",
    [`public.${tableName}`],
  );
  return Boolean(result.rows[0]?.table_name);
};

try {
  await client.query(apply ? "BEGIN" : "BEGIN READ ONLY");
  await client.query("SET LOCAL statement_timeout = '15s'");

  const userCounts = await client.query<{
    legacy_membership_tiers: number;
    legacy_grant_tiers: number;
  }>(`
    SELECT COUNT(*) FILTER (WHERE membership_tier = ANY($1))::int AS legacy_membership_tiers,
           COUNT(*) FILTER (WHERE membership_grant_tier = ANY($1))::int AS legacy_grant_tiers
      FROM users
  `, [LEGACY_TIERS]);

  const targets: Array<{ table: string; column: string; rows: number }> = [
    { table: "users", column: "membership_tier", rows: userCounts.rows[0]?.legacy_membership_tiers || 0 },
    { table: "users", column: "membership_grant_tier", rows: userCounts.rows[0]?.legacy_grant_tiers || 0 },
  ];

  for (const table of ["membership_partner_offers", "membership_promotions"] as const) {
    if (!(await tableExists(table))) continue;
    const result = await client.query<{ rows: number }>(
      `SELECT COUNT(*)::int AS rows FROM ${table} WHERE ${table === "membership_partner_offers" ? "tier" : "membership_tier"} = ANY($1)`,
      [LEGACY_TIERS],
    );
    targets.push({
      table,
      column: table === "membership_partner_offers" ? "tier" : "membership_tier",
      rows: result.rows[0]?.rows || 0,
    });
  }

  console.table(targets);

  if (!apply) {
    await client.query("ROLLBACK");
    console.log("Dry run complete. No rows were changed. Re-run with the explicit apply confirmation to normalize these rows.");
  } else {
    for (const target of targets.filter((item) => item.rows > 0)) {
      await client.query(
        `UPDATE ${target.table} SET ${target.column} = 'premium' WHERE ${target.column} = ANY($1)`,
        [LEGACY_TIERS],
      );
    }
    await client.query("COMMIT");
    console.log("Membership normalization committed. Billing-provider identifiers and historical slugs were not changed.");
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
