#!/usr/bin/env tsx
/**
 * List all channels the bot has access to
 */

import { WebClient } from '@slack/web-api';

const SLACK_TOKEN = process.env.SLACK_TOKEN;

if (!SLACK_TOKEN) {
  console.error('❌ Missing SLACK_TOKEN');
  process.exit(1);
}

async function listChannels() {
  const client = new WebClient(SLACK_TOKEN);

  try {
    console.log('🔍 Fetching channels...\n');

    const result = await client.conversations.list({
      types: 'public_channel,private_channel',
      limit: 100,
    });

    if (!result.ok) {
      console.error('❌ Error:', result.error);
      process.exit(1);
    }

    const channels = result.channels || [];
    console.log(`✅ Found ${channels.length} channels\n`);

    console.log('📋 Available channels:\n');
    channels.forEach((channel) => {
      const isMember = channel.is_member ? '✅' : '❌';
      console.log(`${isMember} ${channel.name} (${channel.id})`);
    });

    console.log('\n💡 To add bot to a channel:');
    console.log('   1. Go to the channel in Slack');
    console.log('   2. Type: /invite @Momo Debug');
    console.log('   3. Run the fetch script again\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listChannels();
