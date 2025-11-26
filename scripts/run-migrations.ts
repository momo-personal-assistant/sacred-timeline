/**
 * Database Migration Script
 *
 * Runs all SQL migration files against the configured PostgreSQL database.
 *
 * Usage:
 *   pnpm tsx scripts/run-migrations.ts
 *
 * Environment variables required:
 *   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
 */

import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../apps/demo/.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'postgres',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_HOST?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
});

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../db/migrations');

  // Get all SQL files sorted by name
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files\n`);

  const client = await pool.connect();

  try {
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`Running: ${file}...`);

      try {
        await client.query(sql);
        console.log(`  ✓ Success\n`);
      } catch (err: any) {
        // Some errors are expected (e.g., "already exists")
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          console.log(`  ⚠ Skipped (already exists)\n`);
        } else {
          console.error(`  ✗ Error: ${err.message}\n`);
          // Continue with other migrations instead of failing
        }
      }
    }

    console.log('Migration complete!');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
