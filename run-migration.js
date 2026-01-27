import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function ensureMigrationsTable() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      name text PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT now()
    )
  `);
}

async function seedMigrationIfTableExists({ fileName, schema, table }) {
  const exists = await tableExists(schema, table);
  if (!exists) return;
  await client.query(
    `INSERT INTO app_migrations(name) VALUES($1) ON CONFLICT(name) DO NOTHING`,
    [fileName]
  );
}

async function tableExists(schema, table) {
  const { rows } = await client.query(
    `SELECT to_regclass($1) AS oid`,
    [`${schema}.${table}`]
  );
  return !!rows[0]?.oid;
}

async function runMigrationsFolder() {
  try {
    await client.connect();
    console.log('Connected to database');
    await ensureMigrationsTable();

    // Seed migration records when core tables already exist to avoid reapplying base migrations
    await seedMigrationIfTableExists({
      fileName: '0000_lame_naoko.sql',
      schema: 'public',
      table: 'admin_notifications',
    });

    await seedMigrationIfTableExists({
      fileName: '0001_add_logbook_entries.sql',
      schema: 'public',
      table: 'logbook_entries',
    });

    const dir = path.resolve('./migrations');
    const files = fs
      .readdirSync(dir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const { rows: appliedRows } = await client.query('SELECT name FROM app_migrations');
    const applied = new Set(appliedRows.map(r => r.name));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`- Skipping already applied migration: ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      console.log(`Running migration: ${file}`);
      await client.query(sql);
      await client.query(`INSERT INTO app_migrations(name) VALUES($1)`, [file]);
      console.log(`✓ Applied ${file}`);
    }
    console.log('✓ All migrations up to date.');
    
  } catch (error) {
    const details = error?.stack || error?.message || error;
    console.error('Migration failed:', details);
    process.exit(1);
  } finally {
    await client.end();
  }
}
runMigrationsFolder();
