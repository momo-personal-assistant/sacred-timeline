/**
 * Generate realistic Slack sample data
 * Based on Slack API schema
 */

import {
  randomInt,
  randomChoice,
  randomBoolean,
  randomPastDate,
  randomUser,
  logProgress,
  type MockUser,
} from './utils';

// =============================================================================
// Slack Types
// =============================================================================

export interface SlackMessage {
  ts: string; // Slack timestamp (e.g., "1234567890.123456")
  user: string; // User ID
  text: string;
  type: 'message';
  thread_ts?: string; // Parent thread timestamp
  reply_count?: number;
  reply_users_count?: number;
  latest_reply?: string;
  reactions?: SlackReaction[];
}

export interface SlackReaction {
  name: string;
  count: number;
  users: string[];
}

export interface SlackThread {
  id: string;
  channel: string;
  channel_name: string;
  title: string; // First message text (truncated)
  messages: SlackMessage[];
  participants: MockUser[];
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Constants
// =============================================================================

const CHANNELS = [
  { id: 'C001', name: 'general' },
  { id: 'C002', name: 'engineering' },
  { id: 'C003', name: 'support' },
  { id: 'C004', name: 'product' },
  { id: 'C005', name: 'design' },
  { id: 'C006', name: 'devops' },
  { id: 'C007', name: 'incidents' },
  { id: 'C008', name: 'customer-feedback' },
];

const THREAD_STARTERS = [
  'Hey team, we need to discuss {topic}',
  'Quick question about {topic}',
  'Has anyone encountered issues with {topic}?',
  'FYI: {topic} is now available',
  'Update on {topic}',
  'Need help with {topic}',
  'Bug report: {topic}',
  'Feature request from customer: {topic}',
  'Heads up - {topic} might be affected',
  'Can someone review {topic}?',
];

const TOPICS = [
  'the new authentication flow',
  'database migration',
  'API rate limiting',
  'user permissions',
  'the payment integration',
  'mobile app performance',
  'caching strategy',
  'deployment pipeline',
  'error handling',
  'search functionality',
  'notification system',
  'data export feature',
  'webhook handlers',
  'session management',
  'file upload limits',
];

const REPLIES = [
  'Looking into this now',
  "I'll check and get back to you",
  'Can you share more details?',
  'This is related to the issue we had last week',
  '+1, facing the same issue',
  'Let me pull up the logs',
  'Should we create a ticket for this?',
  'I think @{user} might know more about this',
  'Fixed in the latest deploy',
  'Can we schedule a call to discuss?',
  'Thanks for flagging this!',
  "I'll handle this",
  'ETA on the fix?',
  'This is blocking our release',
  'Good catch!',
  'LGTM',
  'Approved :white_check_mark:',
  'Needs more testing',
  "I've seen this before - let me find the solution",
  'cc @{user} @{user2}',
];

const REACTION_EMOJIS = [
  'thumbsup',
  'thumbsdown',
  'eyes',
  'rocket',
  'white_check_mark',
  'warning',
  'fire',
  'thinking_face',
  'tada',
  'pray',
  'heart',
  '+1',
  'clap',
];

// =============================================================================
// Generators
// =============================================================================

function generateSlackTs(): string {
  const seconds = Math.floor(Date.now() / 1000) - randomInt(0, 365 * 24 * 60 * 60);
  const microseconds = randomInt(100000, 999999);
  return `${seconds}.${microseconds}`;
}

function generateThreadTitle(): string {
  const template = randomChoice(THREAD_STARTERS);
  const topic = randomChoice(TOPICS);
  return template.replace('{topic}', topic);
}

function generateReply(participants: MockUser[]): string {
  let reply = randomChoice(REPLIES);

  // Replace user mentions
  if (reply.includes('{user}')) {
    const user = randomChoice(participants);
    reply = reply.replace('{user}', user.displayName.split(' ')[0]);
  }
  if (reply.includes('{user2}')) {
    const user = randomChoice(participants);
    reply = reply.replace('{user2}', user.displayName.split(' ')[0]);
  }

  return reply;
}

function generateReactions(participants: MockUser[]): SlackReaction[] {
  if (!randomBoolean(0.4)) return [];

  const reactionCount = randomInt(1, 3);
  const reactions: SlackReaction[] = [];

  for (let i = 0; i < reactionCount; i++) {
    const emoji = randomChoice(REACTION_EMOJIS);
    const userCount = randomInt(1, Math.min(5, participants.length));
    const users = participants.slice(0, userCount).map((u) => u.id);

    reactions.push({
      name: emoji,
      count: userCount,
      users,
    });
  }

  return reactions;
}

function generateSlackThread(index: number): SlackThread {
  const channel = randomChoice(CHANNELS);
  const participantCount = randomInt(2, 8);
  const participants: MockUser[] = [];

  for (let i = 0; i < participantCount; i++) {
    participants.push(randomUser());
  }

  const threadTs = generateSlackTs();
  const title = generateThreadTitle();
  const createdAt = randomPastDate(180);

  // Generate messages
  const messages: SlackMessage[] = [];
  const messageCount = randomInt(2, 15);

  // First message (thread starter)
  const starter = participants[0];
  messages.push({
    ts: threadTs,
    user: starter.id,
    text: title,
    type: 'message',
    reply_count: messageCount - 1,
    reply_users_count: Math.min(participantCount - 1, messageCount - 1),
    reactions: generateReactions(participants),
  });

  // Replies
  let lastTs = threadTs;
  for (let i = 1; i < messageCount; i++) {
    const replier = randomChoice(participants);
    const replyTs = generateSlackTs();

    messages.push({
      ts: replyTs,
      user: replier.id,
      text: generateReply(participants),
      type: 'message',
      thread_ts: threadTs,
      reactions: generateReactions(participants),
    });

    lastTs = replyTs;
  }

  // Update first message with latest_reply
  messages[0].latest_reply = lastTs;

  return {
    id: `thread-${index.toString().padStart(4, '0')}`,
    channel: channel.id,
    channel_name: channel.name,
    title: title.slice(0, 100),
    messages,
    participants,
    created_at: createdAt,
    updated_at: randomPastDate(30),
  };
}

// =============================================================================
// Public API
// =============================================================================

export interface SlackGenerationOptions {
  count?: number;
}

export async function generateSlackSamples(
  options: SlackGenerationOptions = {}
): Promise<SlackThread[]> {
  const { count = 50 } = options;

  console.log(`\n🔧 Generating ${count} Slack threads...`);

  const threads: SlackThread[] = [];

  for (let i = 0; i < count; i++) {
    threads.push(generateSlackThread(i + 1));
    logProgress(i + 1, count, 'Slack threads');
  }

  return threads;
}

export function analyzeSlackSamples(threads: SlackThread[]): void {
  const totalMessages = threads.reduce((sum, t) => sum + t.messages.length, 0);
  const avgMessages = (totalMessages / threads.length).toFixed(1);

  const channelCounts: Record<string, number> = {};
  threads.forEach((t) => {
    channelCounts[t.channel_name] = (channelCounts[t.channel_name] || 0) + 1;
  });

  console.log('\n📊 Slack Sample Analysis:');
  console.log(`  Total threads: ${threads.length}`);
  console.log(`  Total messages: ${totalMessages}`);
  console.log(`  Avg messages per thread: ${avgMessages}`);
  console.log('  By channel:');
  Object.entries(channelCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([channel, count]) => {
      console.log(`    #${channel}: ${count}`);
    });
}
