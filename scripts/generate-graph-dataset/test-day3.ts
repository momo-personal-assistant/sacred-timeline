#!/usr/bin/env tsx
/**
 * Test script for Day 3: Slack Thread Generator
 */

import { generateZendeskSamples } from '../generate-samples/zendesk';

import { SCENARIO_NORMAL } from './config';
import { generateCompanies } from './generators/companies';
import { generateSlackThreads } from './generators/slack';
import { generateUsers } from './generators/users';

async function main() {
  console.log('🧪 Testing Day 3: Slack Thread Generator\n');

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

  // Generate small batch of Zendesk tickets
  const tickets = await generateZendeskSamples({
    count: 10,
  });

  console.log(`✅ Generated ${companies.length} companies`);
  console.log(`✅ Generated ${users.length} users`);
  console.log(`✅ Generated ${tickets.length} Zendesk tickets\n`);

  // =============================================================================
  // Test Slack Thread Generation
  // =============================================================================

  console.log('💬 Generating Slack threads...\n');

  const threads = generateSlackThreads({
    tickets,
    users,
    threadRate: SCENARIO_NORMAL.slack.thread_rate,
    messagesPerThread: SCENARIO_NORMAL.slack.messages_per_thread,
    decisionRate: SCENARIO_NORMAL.slack.decision_rate,
  });

  console.log(`✅ Generated ${threads.length} Slack threads from ${tickets.length} tickets`);
  console.log(
    `   Thread rate: ${((threads.length / tickets.length) * 100).toFixed(1)}% (expected ~${SCENARIO_NORMAL.slack.thread_rate * 100}%)`
  );

  // =============================================================================
  // Analyze Threads
  // =============================================================================

  console.log('\n📊 Thread Analysis:\n');

  const threadsWithDecisions = threads.filter((t) => t.decision_made).length;
  const decisionRate = threadsWithDecisions / threads.length;

  console.log(
    `   Threads with decisions: ${threadsWithDecisions}/${threads.length} (${(decisionRate * 100).toFixed(1)}%)`
  );
  console.log(`   Expected decision rate: ~${SCENARIO_NORMAL.slack.decision_rate * 100}%`);

  const totalMessages = threads.reduce((sum, t) => sum + t.messages.length, 0);
  const avgMessages = totalMessages / threads.length;

  console.log(`\n   Total messages: ${totalMessages}`);
  console.log(`   Average messages per thread: ${avgMessages.toFixed(1)}`);
  console.log(
    `   Expected range: ${SCENARIO_NORMAL.slack.messages_per_thread.min}-${SCENARIO_NORMAL.slack.messages_per_thread.max}`
  );

  // Sentiment distribution
  const sentiments = threads.reduce(
    (acc, t) => {
      const s = t.sentiment || 'unknown';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('\n   Sentiment distribution:');
  Object.entries(sentiments).forEach(([sentiment, count]) => {
    console.log(`      ${sentiment}: ${count}`);
  });

  // =============================================================================
  // Sample Thread
  // =============================================================================

  console.log('\n📋 Sample Thread:\n');

  const sampleThread = threads[0];
  if (sampleThread) {
    const ticket = tickets.find((t) => String(t.id) === sampleThread.triggered_by_ticket);

    console.log(`   Thread TS: ${sampleThread.ts}`);
    console.log(`   Triggered by: Zendesk #${sampleThread.triggered_by_ticket}`);
    if (ticket) {
      console.log(`   Ticket subject: ${ticket.subject}`);
    }
    console.log(`   Participants: ${sampleThread.participants.length}`);
    console.log(`   Messages: ${sampleThread.messages.length}`);
    console.log(`   Keywords: ${sampleThread.keywords.join(', ')}`);
    console.log(`   Sentiment: ${sampleThread.sentiment}`);
    console.log(`   Decision made: ${sampleThread.decision_made ? 'YES' : 'NO'}`);
    if (sampleThread.decided_by) {
      const decider = users.find((u) => u.id === sampleThread.decided_by);
      console.log(`   Decided by: ${decider?.name} (${decider?.role})`);
    }

    console.log('\n   Message timeline:');
    sampleThread.messages.slice(0, 5).forEach((msg, _idx) => {
      const user =
        msg.user_id === 'BOT_ZENDESK'
          ? { name: 'Zendesk Bot' }
          : users.find((u) => u.id === msg.user_id);

      const time = new Date(msg.created_at).toLocaleTimeString();
      const preview = msg.text.substring(0, 60).replace(/<@\w+>/g, '@user');

      console.log(`      [${time}] ${user?.name}: ${preview}${msg.text.length > 60 ? '...' : ''}`);
    });

    if (sampleThread.messages.length > 5) {
      console.log(`      ... ${sampleThread.messages.length - 5} more messages`);
    }
  }

  // =============================================================================
  // Validation
  // =============================================================================

  console.log('\n✅ Validation Summary:\n');

  // Check all threads have tickets
  const threadsWithTickets = threads.filter((t) => t.triggered_by_ticket).length;
  console.log(
    `   [${threadsWithTickets === threads.length ? '✅' : '❌'}] All threads linked to tickets: ${threadsWithTickets}/${threads.length}`
  );

  // Check all threads have keywords
  const threadsWithKeywords = threads.filter((t) => t.keywords.length > 0).length;
  console.log(
    `   [${threadsWithKeywords === threads.length ? '✅' : '❌'}] All threads have keywords: ${threadsWithKeywords}/${threads.length}`
  );

  // Check all threads have participants
  const threadsWithParticipants = threads.filter((t) => t.participants.length >= 2).length;
  console.log(
    `   [${threadsWithParticipants === threads.length ? '✅' : '❌'}] All threads have 2+ participants: ${threadsWithParticipants}/${threads.length}`
  );

  // Check decision threads have decided_by
  const decisionsWithDecider = threads.filter((t) => t.decision_made && t.decided_by).length;
  const totalDecisions = threads.filter((t) => t.decision_made).length;
  console.log(
    `   [${decisionsWithDecider === totalDecisions ? '✅' : '❌'}] Decision threads have decider: ${decisionsWithDecider}/${totalDecisions}`
  );

  // Check Zendesk bot message
  const threadsWithBotMessage = threads.filter(
    (t) => t.messages[0]?.bot_id === 'B09UMQGC2PP'
  ).length;
  console.log(
    `   [${threadsWithBotMessage === threads.length ? '✅' : '❌'}] All threads start with Zendesk bot: ${threadsWithBotMessage}/${threads.length}`
  );

  console.log('\n✅ Day 3 Tests Complete!\n');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
