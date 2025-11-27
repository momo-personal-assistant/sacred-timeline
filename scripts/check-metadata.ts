#!/usr/bin/env tsx
/**
 * Quick script to check if objects have project metadata
 */

import { createDb } from './lib';

async function main() {
  const db = await createDb();
  const pool = (db as any).pool;

  // First check the schema
  const schemaResult = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'canonical_objects'
    ORDER BY ordinal_position
  `);

  console.log('\nSchema of canonical_objects table:');
  console.log('='.repeat(80));
  for (const col of schemaResult.rows) {
    console.log(`  ${col.column_name}: ${col.data_type}`);
  }

  const result = await pool.query(`
    SELECT
      id,
      title,
      platform,
      properties
    FROM canonical_objects
    LIMIT 5
  `);

  console.log('\nSample of canonical objects:');
  console.log('='.repeat(80));

  for (const row of result.rows) {
    console.log(`\nID: ${row.id}`);
    console.log(`Title: ${row.title}`);
    console.log(`Platform: ${row.platform}`);
    if (row.properties) {
      const props =
        typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties;
      console.log(`Properties keys: ${Object.keys(props).join(', ')}`);
      if (props.project_name || props.metadata?.project_name) {
        console.log(`  project_name: ${props.project_name || props.metadata?.project_name}`);
      }
    }
  }

  // Count totals
  const countResult = await pool.query(`
    SELECT COUNT(*) as total FROM canonical_objects
  `);

  console.log('\n' + '='.repeat(80));
  console.log(`\nTotal objects: ${countResult.rows[0].total}`);

  await pool.end();
}

main().catch(console.error);
