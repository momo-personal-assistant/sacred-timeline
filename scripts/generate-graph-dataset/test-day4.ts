#!/usr/bin/env tsx
/**
 * Test script for Day 4: Relations Builder
 */

import { generateLinearSamples } from '../generate-samples/linear';
import { generateZendeskSamples } from '../generate-samples/zendesk';

import { SCENARIO_NORMAL } from './config';
import { generateCompanies } from './generators/companies';
import { buildRelations, analyzeRelations } from './generators/relations';
import { generateSlackThreads, linkThreadsToIssues } from './generators/slack';
import { generateUsers } from './generators/users';

async function main() {
  console.log('🧪 Testing Day 4: Relations Builder\n');

  // =============================================================================
  // Setup
  // =============================================================================

  console.log('⚙️  Setting up test data...\n');

  const companies = generateCompanies(SCENARIO_NORMAL.companies);
  const users = generateUsers({
    customer: SCENARIO_NORMAL.users.customer,
    support: SCENARIO_NORMAL.users.support,
    engineering: SCENARIO_NORMAL.users.engineering,
    sales: SCENARIO_NORMAL.users.sales,
    product: SCENARIO_NORMAL.users.product,
    companies,
  });

  // Generate tickets and threads
  const tickets = await generateZendeskSamples({ count: 10 });
  const threads = generateSlackThreads({
    tickets,
    users,
    threadRate: SCENARIO_NORMAL.slack.thread_rate,
    messagesPerThread: SCENARIO_NORMAL.slack.messages_per_thread,
    decisionRate: SCENARIO_NORMAL.slack.decision_rate,
  });

  // Generate Linear issues only for threads with decisions
  const threadsWithDecisions = threads.filter((t) => t.decision_made);
  const issues = await generateLinearSamples({
    count: threadsWithDecisions.length,
    includeSubIssues: false,
  });

  // Link threads to issues
  const threadToIssueMapping = new Map<string, string>();
  threadsWithDecisions.forEach((thread, idx) => {
    if (issues[idx]) {
      threadToIssueMapping.set(thread.ts, issues[idx].id);
    }
  });
  linkThreadsToIssues(threads, threadToIssueMapping);

  console.log(`✅ Generated ${companies.length} companies`);
  console.log(`✅ Generated ${users.length} users`);
  console.log(`✅ Generated ${tickets.length} Zendesk tickets`);
  console.log(`✅ Generated ${threads.length} Slack threads`);
  console.log(`✅ Generated ${issues.length} Linear issues\n`);

  // =============================================================================
  // Build Relations
  // =============================================================================

  const relations = buildRelations({
    tickets,
    threads,
    issues,
    companies,
    users,
  });

  // =============================================================================
  // Analyze Relations
  // =============================================================================

  analyzeRelations(relations);

  // =============================================================================
  // Detailed Validation
  // =============================================================================

  console.log('\n✅ Detailed Validation:\n');

  // Check Zendesk → Slack relations
  const zendeskSlackRelations = relations.filter((r) => r.type === 'triggered_by');
  const threadsWithTickets = threads.filter((t) => t.triggered_by_ticket).length;
  console.log(
    `   [${zendeskSlackRelations.length === threadsWithTickets ? '✅' : '❌'}] Zendesk → Slack: ${zendeskSlackRelations.length}/${threadsWithTickets}`
  );

  // Check Slack → Linear relations
  const slackLinearRelations = relations.filter((r) => r.type === 'resulted_in');
  const threadsWithIssues = threads.filter((t) => t.resulted_in_issue).length;
  console.log(
    `   [${slackLinearRelations.length === threadsWithIssues ? '✅' : '❌'}] Slack → Linear: ${slackLinearRelations.length}/${threadsWithIssues}`
  );

  // Check participant relations
  const participantRelations = relations.filter((r) => r.type === 'participated_in');
  const totalParticipants = threads.reduce((sum, t) => sum + t.participants.length, 0);
  console.log(
    `   [${participantRelations.length === totalParticipants ? '✅' : '❌'}] Participants: ${participantRelations.length}/${totalParticipants}`
  );

  // Check decision relations
  const decisionRelations = relations.filter((r) => r.type === 'decided_by');
  const threadsWithDecider = threads.filter((t) => t.decided_by).length;
  console.log(
    `   [${decisionRelations.length === threadsWithDecider ? '✅' : '❌'}] Decisions: ${decisionRelations.length}/${threadsWithDecider}`
  );

  // Check company relations (users)
  const userCompanyRelations = relations.filter(
    (r) => r.type === 'belongs_to' && r.from_id.startsWith('user|')
  );
  const usersWithCompanies = users.filter((u) => u.company_id).length;
  console.log(
    `   [${userCompanyRelations.length === usersWithCompanies ? '✅' : '❌'}] User → Company: ${userCompanyRelations.length}/${usersWithCompanies}`
  );

  // Check all relations have proper IDs
  const invalidRelations = relations.filter(
    (r) => !r.from_id.includes('|') || !r.to_id.includes('|')
  );
  console.log(
    `   [${invalidRelations.length === 0 ? '✅' : '❌'}] All relations have canonical IDs: ${relations.length - invalidRelations.length}/${relations.length}`
  );

  // Check confidence values
  const relationsWithConfidence = relations.filter((r) => r.confidence !== undefined);
  const invalidConfidence = relationsWithConfidence.filter(
    (r) => r.confidence! < 0 || r.confidence! > 1
  );
  console.log(
    `   [${invalidConfidence.length === 0 ? '✅' : '❌'}] Valid confidence values: ${relationsWithConfidence.length - invalidConfidence.length}/${relationsWithConfidence.length}`
  );

  // =============================================================================
  // Sample Relations
  // =============================================================================

  console.log('\n📋 Sample Relations:\n');

  // Show one of each type
  const sampleTypes: Array<string> = [
    'triggered_by',
    'resulted_in',
    'participated_in',
    'decided_by',
    'belongs_to',
    'similar_to',
  ];

  sampleTypes.forEach((type) => {
    const sample = relations.find((r) => r.type === type);
    if (sample) {
      console.log(`   ${type}:`);
      console.log(`      From: ${sample.from_id}`);
      console.log(`      To: ${sample.to_id}`);
      console.log(`      Source: ${sample.source}`);
      if (sample.confidence !== undefined) {
        console.log(`      Confidence: ${sample.confidence.toFixed(3)}`);
      }
      if (sample.metadata && Object.keys(sample.metadata).length > 0) {
        console.log(
          `      Metadata: ${JSON.stringify(sample.metadata, null, 2).split('\n').join('\n            ')}`
        );
      }
      console.log('');
    }
  });

  console.log('✅ Day 4 Tests Complete!\n');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
