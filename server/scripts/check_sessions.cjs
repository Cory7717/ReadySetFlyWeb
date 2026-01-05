#!/usr/bin/env node
const { Client } = require('pg');

async function main() {
  const dbUrl = process.argv[2] || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Usage: node check_sessions.cjs <DATABASE_URL>');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const exists = await client.query("SELECT to_regclass('public.sessions') as reg");
    console.log('to_regclass:', exists.rows[0].reg);

    if (exists.rows[0].reg) {
      const count = await client.query('SELECT count(*) AS cnt FROM sessions');
      console.log('sessions row count:', count.rows[0].cnt);
      const sample = await client.query('SELECT sid, expire FROM sessions ORDER BY expire DESC LIMIT 5');
      console.log('sample rows:', sample.rows);
    }

    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Error checking sessions table:', err.message || err);
    try { await client.end(); } catch(_){}
    process.exit(1);
  }
}

main();
