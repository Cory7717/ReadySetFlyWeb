#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const dbUrl = process.argv[2] || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Usage: node apply_migration.js <DATABASE_URL>');
    process.exit(1);
  }

  const migrationPath = path.resolve(__dirname, '..', 'migrations', '001_create_sessions_table.sql');
  if (!fs.existsSync(migrationPath)) {
    console.error('Migration file not found at', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Neon/Postgres often requires SSL. Use a secure config but allow self-signed certs where necessary.
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('Connected to DB, applying migration...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration applied successfully.');
    await client.end();
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Migration failed:', err.message || err);
    process.exit(1);
  }
}

main();
