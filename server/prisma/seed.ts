import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const DUMP_PATH = path.resolve(import.meta.dirname, '../../backups/Superconnector_Prod-2026_03_16_23_05_22-dump.sql');

async function seed() {
  console.log('Reading SQL dump...');
  const sql = fs.readFileSync(DUMP_PATH, 'utf-8');

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await client.query('BEGIN');

    console.log('Clearing existing data...');
    await client.query('DELETE FROM analytics_events');
    await client.query('DELETE FROM channel_messages');
    await client.query('DELETE FROM matches');
    await client.query('DELETE FROM users');

    console.log('Executing SQL dump...');
    await client.query(sql);

    await client.query('COMMIT');
    console.log('Seed completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed, rolled back:', err);
    throw err;
  } finally {
    await client.end();
  }
}

seed();
