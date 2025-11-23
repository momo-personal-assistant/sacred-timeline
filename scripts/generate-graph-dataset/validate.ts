#!/usr/bin/env tsx
/**
 * Validation script for graph datasets
 * Ensures datasets are correctly structured and ready for graph construction
 */

import fs from 'fs/promises';
import path from 'path';

import type { GraphDataset } from './types';

// =============================================================================
// Validation Functions
// =============================================================================

function validateDataset(dataset: GraphDataset, filename: string): boolean {
  console.log(`\n📋 Validating: ${filename}\n`);

  let isValid = true;
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check metadata
  if (!dataset.metadata) {
    errors.push('Missing metadata');
  } else {
    if (!dataset.metadata.scenario) errors.push('Missing metadata.scenario');
    if (!dataset.metadata.generated_at) errors.push('Missing metadata.generated_at');
    if (!dataset.metadata.version) errors.push('Missing metadata.version');
    if (!dataset.metadata.stats) errors.push('Missing metadata.stats');
  }

  // Check arrays exist
  if (!Array.isArray(dataset.companies)) errors.push('companies is not an array');
  if (!Array.isArray(dataset.users)) errors.push('users is not an array');
  if (!Array.isArray(dataset.zendesk_tickets)) errors.push('zendesk_tickets is not an array');
  if (!Array.isArray(dataset.slack_threads)) errors.push('slack_threads is not an array');
  if (!Array.isArray(dataset.linear_issues)) errors.push('linear_issues is not an array');
  if (!Array.isArray(dataset.relations)) errors.push('relations is not an array');

  // Check stats match actual counts
  if (dataset.metadata?.stats) {
    const stats = dataset.metadata.stats;

    if (stats.companies !== dataset.companies.length) {
      errors.push(`Stats mismatch: companies (${stats.companies} vs ${dataset.companies.length})`);
    }
    if (stats.users !== dataset.users.length) {
      errors.push(`Stats mismatch: users (${stats.users} vs ${dataset.users.length})`);
    }
    if (stats.zendesk_tickets !== dataset.zendesk_tickets.length) {
      errors.push(
        `Stats mismatch: tickets (${stats.zendesk_tickets} vs ${dataset.zendesk_tickets.length})`
      );
    }
    if (stats.slack_threads !== dataset.slack_threads.length) {
      errors.push(
        `Stats mismatch: threads (${stats.slack_threads} vs ${dataset.slack_threads.length})`
      );
    }
    if (stats.linear_issues !== dataset.linear_issues.length) {
      errors.push(
        `Stats mismatch: issues (${stats.linear_issues} vs ${dataset.linear_issues.length})`
      );
    }
    if (stats.relations !== dataset.relations.length) {
      errors.push(`Stats mismatch: relations (${stats.relations} vs ${dataset.relations.length})`);
    }
  }

  // Validate Slack threads have required fields
  const threadsWithoutTs = dataset.slack_threads.filter((t) => !t.ts).length;
  if (threadsWithoutTs > 0) {
    errors.push(`${threadsWithoutTs} threads missing ts`);
  }

  const threadsWithoutMessages = dataset.slack_threads.filter(
    (t) => !t.messages || t.messages.length === 0
  ).length;
  if (threadsWithoutMessages > 0) {
    errors.push(`${threadsWithoutMessages} threads missing messages`);
  }

  // Validate relations have canonical IDs
  const invalidRelations = dataset.relations.filter(
    (r) => !r.from_id.includes('|') || !r.to_id.includes('|')
  ).length;
  if (invalidRelations > 0) {
    errors.push(`${invalidRelations} relations with invalid IDs`);
  }

  // Check for critical relation types
  const relationTypes = new Set(dataset.relations.map((r) => r.type));
  const expectedTypes = ['triggered_by', 'resulted_in', 'participated_in', 'belongs_to'];

  expectedTypes.forEach((type) => {
    if (!relationTypes.has(type as any)) {
      warnings.push(`Missing relation type: ${type}`);
    }
  });

  // Print results
  console.log('   Stats:');
  console.log(`      Companies: ${dataset.companies.length}`);
  console.log(`      Users: ${dataset.users.length}`);
  console.log(`      Zendesk tickets: ${dataset.zendesk_tickets.length}`);
  console.log(`      Slack threads: ${dataset.slack_threads.length}`);
  console.log(`      Linear issues: ${dataset.linear_issues.length}`);
  console.log(`      Relations: ${dataset.relations.length}`);

  console.log('\n   Relation types:');
  const relationCounts = dataset.relations.reduce(
    (acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  Object.entries(relationCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`      ${type}: ${count}`);
    });

  // Print errors and warnings
  if (errors.length > 0) {
    console.log('\n   ❌ Errors:');
    errors.forEach((err) => console.log(`      - ${err}`));
    isValid = false;
  }

  if (warnings.length > 0) {
    console.log('\n   ⚠️  Warnings:');
    warnings.forEach((warn) => console.log(`      - ${warn}`));
  }

  if (isValid && errors.length === 0 && warnings.length === 0) {
    console.log('\n   ✅ Valid dataset!');
  }

  return isValid;
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          Graph Dataset Validator - Memory RnD Week 1       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const datasetsDir = path.join(process.cwd(), 'data/graph-datasets');

  // List all JSON files
  const files = await fs.readdir(datasetsDir);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  console.log(`\n📁 Found ${jsonFiles.length} dataset(s) in ${datasetsDir}`);

  let allValid = true;

  // Validate each dataset
  for (const file of jsonFiles) {
    try {
      const filePath = path.join(datasetsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const dataset = JSON.parse(content) as GraphDataset;

      const isValid = validateDataset(dataset, file);
      if (!isValid) {
        allValid = false;
      }
    } catch (error) {
      console.log(`\n❌ Error validating ${file}:`, error);
      allValid = false;
    }
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Validation Complete                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  if (allValid) {
    console.log('\n✅ All datasets are valid!\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some datasets have errors. Please review.\n');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Validation failed:', error);
  process.exit(1);
});
