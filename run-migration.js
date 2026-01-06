import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    const sql = fs.readFileSync('./migrations/0001_add_logbook_entries.sql', 'utf8');
    console.log('Running migration...');
    
    await client.query(sql);
    console.log('✓ Migration completed successfully!');
    console.log('✓ logbook_entries table created');
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
