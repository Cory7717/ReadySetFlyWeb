import dotenv from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

dotenv.config({ path: "server/.env" });
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run the membership audit.");
}

const pool = new Pool({ connectionString });
type CountRow = Record<string, string | number | boolean | null>;

const maskIdentifier = (value: unknown) => {
  const identifier = String(value || "");
  if (!identifier) return "(none)";
  if (identifier.length <= 8) return "[redacted]";
  return `${identifier.slice(0, 3)}…${identifier.slice(-4)}`;
};

const printSection = (title: string, rows: CountRow[]) => {
  console.log(`\n${title}`);
  console.table(rows);
};

const tableExists = async (tableName: string) => {
  const result = await client.query<{ table_name: string | null }>(
    "SELECT to_regclass($1) AS table_name",
    [`public.${tableName}`],
  );
  return Boolean(result.rows[0]?.table_name);
};

const client = await pool.connect();
try {
  await client.query("BEGIN READ ONLY");
  await client.query("SET LOCAL statement_timeout = '15s'");

  const userTiers = await client.query<CountRow>(`
    SELECT COALESCE(membership_tier, '(null)') AS tier,
           COALESCE(membership_status, '(null)') AS status,
           COUNT(*)::int AS users
      FROM users
     GROUP BY 1, 2
     ORDER BY 1, 2
  `);
  printSection("User membership tiers and statuses", userTiers.rows);

  const grants = await client.query<CountRow>(`
    SELECT COALESCE(membership_grant_tier, '(null)') AS tier,
           CASE WHEN membership_grant_ends_at IS NULL THEN 'no_expiration'
                WHEN membership_grant_ends_at > NOW() THEN 'active'
                ELSE 'expired' END AS state,
           COUNT(*)::int AS users
      FROM users
     WHERE membership_grant_tier IS NOT NULL
     GROUP BY 1, 2
     ORDER BY 1, 2
  `);
  printSection("Membership grants", grants.rows);

  const legacyLogbook = await client.query<CountRow>(`
    SELECT COALESCE(logbook_pro_status, '(null)') AS status,
           COUNT(*)::int AS users
      FROM users
     GROUP BY 1
     ORDER BY 1
  `);
  printSection("Legacy Logbook Pro statuses", legacyLogbook.rows);

  const risk = await client.query<CountRow>(`
    SELECT COUNT(*) FILTER (
             WHERE membership_tier IN ('pro', 'pro_plus', 'pro_core', 'core')
           )::int AS legacy_tier_rows,
           COUNT(*) FILTER (
             WHERE membership_grant_tier IN ('pro', 'pro_plus', 'pro_core', 'core')
           )::int AS legacy_grant_rows,
           COUNT(*) FILTER (
             WHERE COALESCE(membership_tier, 'free') = 'free'
               AND COALESCE(logbook_pro_status, 'inactive')
                   NOT IN ('free', 'inactive', 'cancelled', 'expired')
           )::int AS free_with_active_legacy_status
      FROM users
  `);
  printSection("Normalization risk summary", risk.rows);

  const offers = await client.query<CountRow>(`
    SELECT slug, tier, is_active AS active, COUNT(*)::int AS offers
      FROM membership_partner_offers
     GROUP BY 1, 2, 3
     ORDER BY 1
  `);
  printSection("Partner offers", offers.rows);

  if (await tableExists("membership_promotions")) {
    const promotions = await client.query<CountRow>(`
      SELECT membership_tier AS tier, is_active AS active,
             COUNT(*)::int AS promotions
        FROM membership_promotions
       GROUP BY 1, 2
       ORDER BY 1, 2
    `);
    printSection("Membership promotions", promotions.rows);
  } else {
    console.log("\nMembership promotions\nSkipped: table is not present in this database.");
  }

  const paypalPlans = await client.query<CountRow>(`
    SELECT paypal_plan_id, COALESCE(membership_status, '(null)') AS status,
           COUNT(*)::int AS users
      FROM users
     WHERE paypal_plan_id IS NOT NULL
     GROUP BY 1, 2
     ORDER BY 2, 3 DESC
  `);
  printSection(
    "PayPal plan usage (identifiers masked)",
    paypalPlans.rows.map(({ paypal_plan_id, ...row }) => ({
      plan: maskIdentifier(paypal_plan_id),
      ...row,
    })),
  );

  await client.query("ROLLBACK");
  console.log("\nAudit complete. The transaction was read-only and no rows were changed.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
