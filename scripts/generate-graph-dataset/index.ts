#!/usr/bin/env tsx
/**
 * Main orchestrator for Graph Dataset Generator V2
 * Generates complete graph datasets for all scenarios
 */

import fs from 'fs/promises';
import path from 'path';

import { generateLinearSamples } from '../generate-samples/linear';
import { generateZendeskSamples } from '../generate-samples/zendesk';

import { SCENARIOS, DEFAULT_SCENARIO } from './config';
import { generateCompanies } from './generators/companies';
import { buildRelations, analyzeRelations } from './generators/relations';
import { generateSlackThreads, linkThreadsToIssues } from './generators/slack';
import { generateUsers } from './generators/users';
import type { GraphDataset } from './types';

// =============================================================================
// File Operations
// =============================================================================

async function ensureDirectories(outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  console.log(`\n📁 Output directory: ${outputDir}`);
}

async function writeJsonFile(filePath: string, data: any, label: string): Promise<void> {
  const jsonString = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, jsonString, 'utf-8');

  const sizeKB = (Buffer.byteLength(jsonString, 'utf-8') / 1024).toFixed(1);
  console.log(`\n✅ Wrote ${label}: ${filePath}`);
  console.log(`   Size: ${sizeKB} KB`);
}

// =============================================================================
// Main Generation Function
// =============================================================================

async function generateGraphDataset(scenarioName: string): Promise<GraphDataset> {
  const scenario = SCENARIOS[scenarioName];
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioName}`);
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log(`║  Generating Graph Dataset: ${scenario.name.toUpperCase().padEnd(37)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n📝 ${scenario.description}\n`);

  // =============================================================================
  // Step 1: Generate Companies
  // =============================================================================

  console.log('🏢 Step 1: Generating companies...\n');
  const companies = generateCompanies(scenario.companies);
  console.log(`   ✅ Generated ${companies.length} companies`);

  // =============================================================================
  // Step 2: Generate Users
  // =============================================================================

  console.log('\n👥 Step 2: Generating users...\n');
  const users = generateUsers({
    customer: scenario.users.customer,
    support: scenario.users.support,
    engineering: scenario.users.engineering,
    sales: scenario.users.sales,
    product: scenario.users.product,
    companies,
  });
  console.log(`   ✅ Generated ${users.length} users`);
  console.log(`      Customer: ${scenario.users.customer}`);
  console.log(`      Support: ${scenario.users.support}`);
  console.log(`      Engineering: ${scenario.users.engineering}`);
  console.log(`      Sales: ${scenario.users.sales}`);
  console.log(`      Product: ${scenario.users.product}`);

  // =============================================================================
  // Step 3: Generate Zendesk Tickets
  // =============================================================================

  console.log('\n🎫 Step 3: Generating Zendesk tickets...\n');
  const tickets = await generateZendeskSamples({
    count: scenario.zendesk.tickets,
  });
  console.log(`   ✅ Generated ${tickets.length} Zendesk tickets`);

  // =============================================================================
  // Step 4: Generate Slack Threads
  // =============================================================================

  console.log('\n💬 Step 4: Generating Slack threads...\n');
  const threads = generateSlackThreads({
    tickets,
    users,
    threadRate: scenario.slack.thread_rate,
    messagesPerThread: scenario.slack.messages_per_thread,
    decisionRate: scenario.slack.decision_rate,
  });
  console.log(`   ✅ Generated ${threads.length} Slack threads`);
  console.log(`      Thread rate: ${((threads.length / tickets.length) * 100).toFixed(1)}%`);

  const threadsWithDecisions = threads.filter((t) => t.decision_made);
  console.log(
    `      Decisions: ${threadsWithDecisions.length} (${((threadsWithDecisions.length / threads.length) * 100).toFixed(1)}%)`
  );

  // =============================================================================
  // Step 5: Generate Linear Issues
  // =============================================================================

  console.log('\n🔷 Step 5: Generating Linear issues...\n');

  // Only generate issues for threads with decisions
  const issueCount = Math.round(threadsWithDecisions.length * scenario.linear.issue_rate);
  const issues = await generateLinearSamples({
    count: issueCount,
    includeSubIssues: scenario.linear.sub_issue_rate > 0,
  });

  // Link threads to issues
  const threadToIssueMapping = new Map<string, string>();
  threadsWithDecisions.slice(0, issueCount).forEach((thread, idx) => {
    if (issues[idx]) {
      threadToIssueMapping.set(thread.ts, issues[idx].id);
    }
  });
  linkThreadsToIssues(threads, threadToIssueMapping);

  console.log(`   ✅ Generated ${issues.length} Linear issues`);
  console.log(
    `      Issue rate: ${((issues.length / threadsWithDecisions.length) * 100).toFixed(1)}% of decisions`
  );

  // =============================================================================
  // Step 6: Build Relations
  // =============================================================================

  const relations = buildRelations({
    tickets,
    threads,
    issues,
    companies,
    users,
  });

  analyzeRelations(relations);

  // =============================================================================
  // Step 7: Create Dataset
  // =============================================================================

  console.log('\n📦 Step 7: Creating graph dataset...\n');

  const dataset: GraphDataset = {
    metadata: {
      scenario: scenario.name,
      generated_at: new Date().toISOString(),
      version: '2.0',
      stats: {
        companies: companies.length,
        users: users.length,
        zendesk_tickets: tickets.length,
        slack_threads: threads.length,
        linear_issues: issues.length,
        relations: relations.length,
      },
    },
    companies,
    users,
    zendesk_tickets: tickets,
    slack_threads: threads,
    linear_issues: issues,
    relations,
  };

  console.log('   ✅ Graph dataset created');
  console.log(
    `      Total entities: ${companies.length + users.length + tickets.length + threads.length + issues.length}`
  );
  console.log(`      Total relations: ${relations.length}`);

  return dataset;
}

// =============================================================================
// CLI
// =============================================================================

interface GenerationConfig {
  scenarios: string[];
  outputDir: string;
}

function parseArgs(): GenerationConfig {
  const args = process.argv.slice(2);
  const config: GenerationConfig = {
    scenarios: [DEFAULT_SCENARIO],
    outputDir: path.join(process.cwd(), 'data/graph-datasets'),
  };

  args.forEach((arg) => {
    if (arg.startsWith('--scenarios=')) {
      config.scenarios = arg.split('=')[1].split(',');
    } else if (arg === '--all') {
      config.scenarios = Object.keys(SCENARIOS);
    } else if (arg.startsWith('--output-dir=')) {
      config.outputDir = arg.split('=')[1];
    }
  });

  return config;
}

// =============================================================================
// Main Execution
// =============================================================================

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Graph Dataset Generator V2 - Memory RnD Week 1       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const config = parseArgs();

  console.log('\n⚙️  Configuration:');
  console.log(`  Scenarios: ${config.scenarios.join(', ')}`);
  console.log(`  Output directory: ${config.outputDir}`);

  // Ensure output directory exists
  await ensureDirectories(config.outputDir);

  // Generate datasets for each scenario
  for (const scenarioName of config.scenarios) {
    try {
      const dataset = await generateGraphDataset(scenarioName);

      // Write dataset to file
      const outputPath = path.join(config.outputDir, `${scenarioName}.json`);
      await writeJsonFile(outputPath, dataset, `${scenarioName} dataset`);
    } catch (error) {
      console.error(`\n❌ Error generating ${scenarioName}:`, error);
      throw error;
    }
  }

  // Print final summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Generation Complete                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n📊 Generated ${config.scenarios.length} graph dataset(s)`);
  console.log(`📁 Location: ${config.outputDir}\n`);

  console.log('✨ Next steps:');
  console.log('   1. Validate datasets: pnpm validate:samples');
  console.log('   2. Test graph construction from datasets');
  console.log('   3. Test reasoning queries on the graph\n');
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Error generating graph datasets:', error);
  process.exit(1);
});
