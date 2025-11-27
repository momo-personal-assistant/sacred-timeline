/**
 * Script to sync Linear issues from MCP to canonical_objects table
 *
 * Usage: tsx scripts/sync-linear-to-db.ts linear-issues.json
 */

import * as fs from 'fs';
import * as path from 'path';

async function syncLinearIssues(issuesFilePath: string) {
  // Read Linear issues from JSON file
  const issuesData = JSON.parse(fs.readFileSync(issuesFilePath, 'utf-8'));

  console.log(`📥 Loaded ${issuesData.length} Linear issues from ${issuesFilePath}`);

  // Send to sync endpoint
  const response = await fetch('http://localhost:3001/api/momo/sync-linear', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      issues: issuesData,
    }),
  });

  const result = await response.json();

  if (response.ok) {
    console.log('✅ Sync successful:');
    console.log(`   Total: ${result.synced.total}`);
    console.log(`   Inserted: ${result.synced.inserted}`);
    console.log(`   Updated: ${result.synced.updated}`);
    console.log(`   Timestamp: ${result.timestamp}`);
  } else {
    console.error('❌ Sync failed:', result.error);
    console.error('   Details:', result.details);
    process.exit(1);
  }
}

// Get file path from command line args
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: tsx scripts/sync-linear-to-db.ts <linear-issues.json>');
  process.exit(1);
}

const issuesFilePath = path.resolve(args[0]);

if (!fs.existsSync(issuesFilePath)) {
  console.error(`❌ File not found: ${issuesFilePath}`);
  process.exit(1);
}

syncLinearIssues(issuesFilePath).catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
