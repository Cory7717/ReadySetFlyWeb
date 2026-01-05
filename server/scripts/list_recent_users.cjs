#!/usr/bin/env node
const { Client } = require('pg');

async function main() {
  const dbUrl = process.argv[2] || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Usage: node list_recent_users.cjs <DATABASE_URL>');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query("SELECT id, email, first_name, last_name, created_at FROM users ORDER BY created_at DESC LIMIT 10");
    console.log('Recent users:');
    console.table(res.rows);
    await client.end();
  } catch (err) {
    console.error('Error querying users:', err.message || err);
    try { await client.end(); } catch (_) {}
    process.exit(1);
  }
}

main();
