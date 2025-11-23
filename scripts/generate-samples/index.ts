#!/usr/bin/env node
/**
 * Main CLI script for generating sample data
 *
 * Usage:
 *   npm run generate:samples
 *   npm run generate:samples -- --linear-count=50 --zendesk-count=50
 */

import fs from 'fs/promises';
import path from 'path';

import { generateLinearSamples, analyzeLinearSamples, type LinearIssue } from './linear';
import { generateAllWorstCases, type WorstCase } from './worst-cases';
import { generateZendeskSamples, analyzeZendeskSamples, type ZendeskTicket } from './zendesk';

// =============================================================================
// Configuration
// =============================================================================

interface GenerationConfig {
  linearCount: number;
  zendeskCount: number;
  includeSubIssues: boolean;
  outputDir: string;
}

function parseArgs(): GenerationConfig {
  const args = process.argv.slice(2);
  const config: GenerationConfig = {
    linearCount: 100,
    zendeskCount: 100,
    includeSubIssues: true,
    outputDir: path.join(process.cwd(), 'data'),
  };

  args.forEach((arg) => {
    if (arg.startsWith('--linear-count=')) {
      config.linearCount = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--zendesk-count=')) {
      config.zendeskCount = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--no-sub-issues') {
      config.includeSubIssues = false;
    } else if (arg.startsWith('--output-dir=')) {
      config.outputDir = arg.split('=')[1];
    }
  });

  return config;
}

// =============================================================================
// File Operations
// =============================================================================

async function ensureDirectories(outputDir: string): Promise<void> {
  const samplesDir = path.join(outputDir, 'samples');
  const worstCasesDir = path.join(outputDir, 'worst-cases');

  await fs.mkdir(samplesDir, { recursive: true });
  await fs.mkdir(worstCasesDir, { recursive: true });

  console.log('\n📁 Output directories:');
  console.log(`  Samples: ${samplesDir}`);
  console.log(`  Worst cases: ${worstCasesDir}`);
}

async function writeJsonFile<T>(filePath: string, data: T, label: string): Promise<void> {
  const jsonString = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, jsonString, 'utf-8');

  const sizeKB = (Buffer.byteLength(jsonString, 'utf-8') / 1024).toFixed(1);
  console.log(`\n✅ Wrote ${label}: ${filePath}`);
  console.log(`   Size: ${sizeKB} KB`);
}

// =============================================================================
// Generate Summary Metadata
// =============================================================================

interface GenerationSummary {
  generated_at: string;
  config: GenerationConfig;
  linear: {
    total_issues: number;
    total_comments: number;
    avg_comments_per_issue: number;
    with_sub_issues: number;
  };
  zendesk: {
    total_tickets: number;
    total_comments: number;
    avg_comments_per_ticket: number;
    with_attachments: number;
  };
  worst_cases: {
    total_cases: number;
    by_category: Record<string, number>;
  };
}

function generateSummary(
  config: GenerationConfig,
  linearSamples: LinearIssue[],
  zendeskSamples: ZendeskTicket[],
  worstCases: WorstCase[]
): GenerationSummary {
  // Linear stats
  const totalLinearComments = linearSamples.reduce(
    (sum, issue) => sum + issue.comments.nodes.length,
    0
  );
  const linearWithSubIssues = linearSamples.filter((issue) => issue.parent !== null).length;

  // Zendesk stats
  const totalZendeskComments = zendeskSamples.reduce(
    (sum, ticket) => sum + ticket.comments.length,
    0
  );
  const zendeskWithAttachments = zendeskSamples.filter((ticket) =>
    ticket.comments.some((comment) => comment.attachments && comment.attachments.length > 0)
  ).length;

  // Worst cases stats
  const worstCasesByCategory = worstCases.reduce(
    (acc, wc) => {
      acc[wc.category] = (acc[wc.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    generated_at: new Date().toISOString(),
    config,
    linear: {
      total_issues: linearSamples.length,
      total_comments: totalLinearComments,
      avg_comments_per_issue: parseFloat((totalLinearComments / linearSamples.length).toFixed(1)),
      with_sub_issues: linearWithSubIssues,
    },
    zendesk: {
      total_tickets: zendeskSamples.length,
      total_comments: totalZendeskComments,
      avg_comments_per_ticket: parseFloat(
        (totalZendeskComments / zendeskSamples.length).toFixed(1)
      ),
      with_attachments: zendeskWithAttachments,
    },
    worst_cases: {
      total_cases: worstCases.length,
      by_category: worstCasesByCategory,
    },
  };
}

// =============================================================================
// Main Execution
// =============================================================================

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Sample Data Generator for Momo Memory RnD          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const config = parseArgs();

  console.log('\n⚙️  Configuration:');
  console.log(`  Linear issues: ${config.linearCount}`);
  console.log(`  Zendesk tickets: ${config.zendeskCount}`);
  console.log(`  Include sub-issues: ${config.includeSubIssues}`);
  console.log(`  Output directory: ${config.outputDir}`);

  // Ensure output directories exist
  await ensureDirectories(config.outputDir);

  // Generate Linear samples
  const linearSamples = await generateLinearSamples({
    count: config.linearCount,
    includeSubIssues: config.includeSubIssues,
  });
  analyzeLinearSamples(linearSamples);

  // Generate Zendesk samples
  const zendeskSamples = await generateZendeskSamples({
    count: config.zendeskCount,
  });
  analyzeZendeskSamples(zendeskSamples);

  // Generate worst cases
  const worstCases = generateAllWorstCases();

  // Write files
  console.log('\n📝 Writing output files...');

  const samplesDir = path.join(config.outputDir, 'samples');
  const worstCasesDir = path.join(config.outputDir, 'worst-cases');

  await writeJsonFile(path.join(samplesDir, 'linear.json'), linearSamples, 'Linear samples');

  await writeJsonFile(path.join(samplesDir, 'zendesk.json'), zendeskSamples, 'Zendesk samples');

  await writeJsonFile(path.join(worstCasesDir, 'cases.json'), worstCases, 'Worst cases');

  // Generate and write summary
  const summary = generateSummary(config, linearSamples, zendeskSamples, worstCases);
  await writeJsonFile(
    path.join(config.outputDir, 'generation-summary.json'),
    summary,
    'Generation summary'
  );

  // Print final summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Generation Complete                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n📊 Final Summary:');
  console.log(
    `  Linear: ${summary.linear.total_issues} issues, ${summary.linear.total_comments} comments`
  );
  console.log(
    `  Zendesk: ${summary.zendesk.total_tickets} tickets, ${summary.zendesk.total_comments} comments`
  );
  console.log(`  Worst cases: ${summary.worst_cases.total_cases} cases`);
  console.log('\n✨ All files written successfully!\n');
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Error generating samples:', error);
  process.exit(1);
});
