#!/usr/bin/env tsx
/**
 * Fetch Slack messages to analyze Zendesk integration structure
 */

import fs from 'fs/promises';
import path from 'path';

import { WebClient } from '@slack/web-api';

const SLACK_TOKEN = process.env.SLACK_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!SLACK_TOKEN || !CHANNEL_ID) {
  console.error('❌ Missing required environment variables:');
  console.error('   SLACK_TOKEN');
  console.error('   CHANNEL_ID');
  process.exit(1);
}

async function fetchMessages() {
  console.log('🔍 Fetching Slack messages...\n');
  console.log(`Channel ID: ${CHANNEL_ID}`);

  const client = new WebClient(SLACK_TOKEN);

  try {
    // Fetch recent messages
    const result = await client.conversations.history({
      channel: CHANNEL_ID,
      limit: 20, // Get more messages to ensure we catch Zendesk ones
    });

    if (!result.ok) {
      console.error('❌ Slack API error:', result.error);
      process.exit(1);
    }

    const messages = result.messages || [];
    console.log(`✅ Fetched ${messages.length} messages\n`);

    // Filter for bot messages (likely Zendesk)
    const botMessages = messages.filter(
      (msg) => msg.bot_id || msg.app_id || msg.subtype === 'bot_message'
    );

    console.log(`🤖 Found ${botMessages.length} bot messages\n`);

    // Save all messages
    const outputDir = path.join(process.cwd(), 'scripts/debug/output');
    await fs.mkdir(outputDir, { recursive: true });

    const allMessagesPath = path.join(outputDir, 'slack-messages-all.json');
    await fs.writeFile(allMessagesPath, JSON.stringify(messages, null, 2));
    console.log(`📄 Saved all messages: ${allMessagesPath}`);

    // Save bot messages separately
    const botMessagesPath = path.join(outputDir, 'slack-messages-bot.json');
    await fs.writeFile(botMessagesPath, JSON.stringify(botMessages, null, 2));
    console.log(`📄 Saved bot messages: ${botMessagesPath}`);

    // Analyze bot messages
    console.log('\n📊 Bot Message Analysis:\n');

    botMessages.forEach((msg, idx) => {
      console.log(`Bot Message #${idx + 1}:`);
      console.log(`  bot_id: ${msg.bot_id || 'N/A'}`);
      console.log(`  app_id: ${msg.app_id || 'N/A'}`);
      console.log(`  text preview: ${msg.text?.substring(0, 100) || 'N/A'}...`);
      console.log(`  has attachments: ${msg.attachments ? 'YES' : 'NO'}`);
      console.log(`  has blocks: ${msg.blocks ? 'YES' : 'NO'}`);

      if (msg.attachments && msg.attachments.length > 0) {
        console.log(`  attachment[0].title: ${msg.attachments[0].title || 'N/A'}`);
        console.log(`  attachment[0].title_link: ${msg.attachments[0].title_link || 'N/A'}`);
      }

      console.log('');
    });

    // Create analysis report
    const report = {
      total_messages: messages.length,
      bot_messages_count: botMessages.length,
      bot_messages: botMessages.map((msg) => ({
        bot_id: msg.bot_id,
        app_id: msg.app_id,
        timestamp: msg.ts,
        has_attachments: !!msg.attachments,
        has_blocks: !!msg.blocks,
        attachment_structure: msg.attachments?.[0]
          ? {
              has_title: !!msg.attachments[0].title,
              has_title_link: !!msg.attachments[0].title_link,
              has_fields: !!msg.attachments[0].fields,
              title: msg.attachments[0].title,
              title_link: msg.attachments[0].title_link,
            }
          : null,
        text_preview: msg.text?.substring(0, 200),
      })),
    };

    const reportPath = path.join(outputDir, 'analysis-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Saved analysis report: ${reportPath}\n`);

    // Print checklist
    console.log('✅ Validation Checklist:\n');

    const hasTicketId = botMessages.some(
      (msg) =>
        msg.text?.includes('Ticket #') ||
        msg.attachments?.[0]?.title?.includes('#') ||
        msg.attachments?.[0]?.title_link?.includes('tickets/')
    );

    const hasUrl = botMessages.some((msg) =>
      msg.attachments?.[0]?.title_link?.includes('zendesk.com')
    );

    console.log(`[${hasTicketId ? '✅' : '❌'}] Ticket ID extractable`);
    console.log(`[${hasUrl ? '✅' : '❌'}] Zendesk URL present`);
    console.log(`[${botMessages.length > 0 ? '✅' : '❌'}] Bot messages detected`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fetchMessages();
