/**
 * Slack thread generator for graph datasets
 * This is the CORE INNOVATION - captures decision context missing from Zendesk/Linear
 */

import { randomInt, randomChoice, randomBoolean } from '../../generate-samples/utils';
import type { SlackThread, SlackMessage, ZendeskTicket, User } from '../types';

import { getUsersByRole, _randomUserByRole, _randomInternalUser } from './users';

// =============================================================================
// Message Templates by Phase
// =============================================================================

/**
 * Phase 1: Investigation - Understanding the issue
 */
const INVESTIGATION_TEMPLATES = [
  (user: User, kw: string, account: string) =>
    `<@${user.id}> Seeing reports about ${kw} from ${account}`,

  (user: User) => `<@${user.id}> Can someone from eng take a look at this?`,

  (user: User, kw: string) =>
    `<@${user.id}> This looks similar to the ${kw} issue we had last month`,

  (user: User) => `<@${user.id}> Checking logs now...`,

  (user: User) => `<@${user.id}> I can reproduce this on staging`,

  (user: User, account: string) =>
    `<@${user.id}> ${account} is one of our enterprise customers - priority high`,

  (user: User) => `<@${user.id}> Looking into the database now`,
];

/**
 * Phase 2: Discussion - Figuring out root cause and impact
 */
const DISCUSSION_TEMPLATES = [
  (user: User) => `<@${user.id}> This is affecting multiple users, not just one`,

  (user: User) => `<@${user.id}> Found the issue - looks like a race condition in the API`,

  (user: User) => `<@${user.id}> Quick fix or long-term solution?`,

  (user: User) => `<@${user.id}> I think we need to refactor this whole module`,

  (user: User) => `<@${user.id}> What's the timeline expectation here?`,

  (user: User) => `<@${user.id}> Sales is asking for an ETA`,

  (user: User) => `<@${user.id}> Can we patch this today or does it need a proper fix?`,

  (user: User) => `<@${user.id}> Let me check with the team about bandwidth`,

  (user: User) => `<@${user.id}> This could impact our SLA if we don't fix it soon`,

  (user: User) => `<@${user.id}> I'm seeing the same pattern in our monitoring dashboard`,
];

/**
 * Phase 3: Decision - Choosing to create Linear issue or not
 */
const DECISION_TEMPLATES = [
  (user: User) => `<@${user.id}> Let's create a Linear issue to track this properly`,

  (user: User) => `<@${user.id}> I'll create an issue and assign to eng`,

  (user: User) => `<@${user.id}> This needs to be prioritized for next sprint`,

  (user: User) => `<@${user.id}> Created Linear issue - will update here when fixed`,

  (user: User) => `<@${user.id}> Marking as P1, we need this resolved ASAP`,

  (user: User) => `<@${user.id}> I'll handle this one`,

  (user: User) => `<@${user.id}> Adding to our bug backlog`,
];

/**
 * Phase 4: No Decision - Thread dies without action
 */
const NO_DECISION_TEMPLATES = [
  (user: User) => `<@${user.id}> Looks like this was a one-off issue`,

  (user: User) => `<@${user.id}> Can't reproduce anymore, might have self-resolved`,

  (user: User) => `<@${user.id}> Customer says it's working now`,

  (user: User) => `<@${user.id}> This was user error, not a bug`,

  (user: User) => `<@${user.id}> Already fixed in the latest deploy`,

  (user: User) => `<@${user.id}> Duplicate of existing issue`,
];

// =============================================================================
// Keyword Extraction
// =============================================================================

const ISSUE_KEYWORDS = [
  'login',
  'authentication',
  'timeout',
  'slow',
  'performance',
  'crash',
  'error',
  'bug',
  'API',
  'database',
  'sync',
  'export',
  'import',
  'billing',
  'payment',
  'data',
];

/**
 * Extract keywords from ticket for Slack thread context
 */
function extractKeywords(ticket: ZendeskTicket): string[] {
  const text = `${ticket.subject} ${ticket.description}`.toLowerCase();
  const keywords: string[] = [];

  ISSUE_KEYWORDS.forEach((keyword) => {
    if (text.includes(keyword.toLowerCase())) {
      keywords.push(keyword);
    }
  });

  // Add at least one keyword if none found
  if (keywords.length === 0) {
    keywords.push(randomChoice(ISSUE_KEYWORDS));
  }

  return keywords.slice(0, 3); // Max 3 keywords
}

/**
 * Determine sentiment based on ticket priority and keywords
 */
function determineSentiment(ticket: ZendeskTicket, keywords: string[]): SlackThread['sentiment'] {
  if (ticket.priority === 'urgent') return 'urgent';
  if (ticket.priority === 'high') return 'concerned';

  const negativeKeywords = ['crash', 'error', 'bug', 'slow'];
  const hasNegative = keywords.some((k) => negativeKeywords.includes(k));

  if (hasNegative) return 'concerned';
  return 'neutral';
}

// =============================================================================
// Timestamp Generation
// =============================================================================

/**
 * Generate Slack timestamp (seconds.microseconds)
 * Example: "1732406400.123456"
 */
function generateSlackTimestamp(baseDate: Date, offsetMinutes: number = 0): string {
  const date = new Date(baseDate.getTime() + offsetMinutes * 60 * 1000);
  const seconds = Math.floor(date.getTime() / 1000);
  const microseconds = String(randomInt(100000, 999999));
  return `${seconds}.${microseconds}`;
}

// =============================================================================
// Message Generation
// =============================================================================

/**
 * Generate Zendesk bot message (triggers the thread)
 */
function generateZendeskBotMessage(ticket: ZendeskTicket, ts: string): SlackMessage {
  return {
    ts,
    user_id: 'BOT_ZENDESK',
    text: `New Zendesk ticket: ${ticket.subject}`,
    bot_id: 'B09UMQGC2PP', // Real Zendesk bot ID from research
    attachments: [
      {
        title: `Ticket #${ticket.id}`,
        text: ticket.description.substring(0, 200),
        fields: [
          { title: 'Priority', value: ticket.priority || 'normal', short: true },
          { title: 'Status', value: ticket.status, short: true },
        ],
        footer: `<https://momo-5932.zendesk.com/agent/tickets/${ticket.id}|티켓 #${ticket.id}> | 상태: ${ticket.status}`,
        color: ticket.priority === 'urgent' ? '#FF0000' : '#36A64F',
      },
    ],
    created_at: new Date(ticket.created_at).toISOString(),
  };
}

/**
 * Generate conversation messages
 */
function generateMessages(params: {
  threadTs: string;
  count: number;
  participants: User[];
  ticket: ZendeskTicket;
  keywords: string[];
  baseDate: Date;
  decisionMade: boolean;
  decidedBy?: User;
}): SlackMessage[] {
  const messages: SlackMessage[] = [];
  let currentMinutes = 2; // Start 2 minutes after Zendesk bot message

  const {
    threadTs,
    count,
    participants,
    ticket: _ticket,
    keywords,
    baseDate,
    decisionMade,
    decidedBy,
  } = params;

  // Phase distribution
  const investigationCount = Math.ceil(count * 0.4);
  const discussionCount = Math.ceil(count * 0.4);
  const decisionCount = count - investigationCount - discussionCount;

  // Investigation phase
  for (let i = 0; i < investigationCount; i++) {
    const user = randomChoice(participants);
    const template = randomChoice(INVESTIGATION_TEMPLATES);
    const keyword = randomChoice(keywords);
    const account = `Customer-${randomInt(1, 100)}`;

    messages.push({
      ts: generateSlackTimestamp(baseDate, currentMinutes),
      user_id: user.id,
      text: template(user, keyword, account),
      thread_ts: threadTs,
      created_at: new Date(baseDate.getTime() + currentMinutes * 60 * 1000).toISOString(),
    });

    currentMinutes += randomInt(2, 10); // 2-10 min gaps
  }

  // Discussion phase
  for (let i = 0; i < discussionCount; i++) {
    const user = randomChoice(participants);
    const template = randomChoice(DISCUSSION_TEMPLATES);

    messages.push({
      ts: generateSlackTimestamp(baseDate, currentMinutes),
      user_id: user.id,
      text: template(user),
      thread_ts: threadTs,
      created_at: new Date(baseDate.getTime() + currentMinutes * 60 * 1000).toISOString(),
    });

    currentMinutes += randomInt(3, 15); // 3-15 min gaps (slower discussion)
  }

  // Decision phase
  const templates = decisionMade ? DECISION_TEMPLATES : NO_DECISION_TEMPLATES;

  for (let i = 0; i < decisionCount; i++) {
    const user =
      decisionMade && i === decisionCount - 1 && decidedBy
        ? decidedBy // Last message is from decision maker
        : randomChoice(participants);

    const template = randomChoice(templates);

    messages.push({
      ts: generateSlackTimestamp(baseDate, currentMinutes),
      user_id: user.id,
      text: template(user),
      thread_ts: threadTs,
      created_at: new Date(baseDate.getTime() + currentMinutes * 60 * 1000).toISOString(),
    });

    currentMinutes += randomInt(5, 20); // 5-20 min gaps (decision takes time)
  }

  return messages;
}

// =============================================================================
// Main Slack Thread Generator
// =============================================================================

/**
 * Generate Slack threads from Zendesk tickets
 */
export function generateSlackThreads(params: {
  tickets: ZendeskTicket[];
  users: User[];
  threadRate: number; // % of tickets that trigger threads
  messagesPerThread: { min: number; max: number };
  decisionRate: number; // % of threads that result in decisions
}): SlackThread[] {
  const threads: SlackThread[] = [];
  const { tickets, users, threadRate, messagesPerThread, decisionRate } = params;

  // Get internal users who participate in Slack
  const internalUsers = users.filter((u) => u.role !== 'customer');
  const supportUsers = getUsersByRole(users, 'support');
  const engUsers = getUsersByRole(users, 'engineering');
  const salesUsers = getUsersByRole(users, 'sales');
  const productUsers = getUsersByRole(users, 'product');

  for (const ticket of tickets) {
    // Should this ticket trigger a Slack thread?
    if (!randomBoolean(threadRate)) continue;

    const baseDate = new Date(ticket.created_at);
    const threadTs = generateSlackTimestamp(baseDate);

    // Extract context
    const keywords = extractKeywords(ticket);
    const sentiment = determineSentiment(ticket, keywords);

    // Determine participants (2-5 internal users)
    const participantCount = randomInt(2, 5);
    const participants: User[] = [];

    // Always include support
    if (supportUsers.length > 0) {
      participants.push(randomChoice(supportUsers));
    }

    // Usually include eng
    if (randomBoolean(0.8) && engUsers.length > 0) {
      participants.push(randomChoice(engUsers));
    }

    // Sometimes include sales (for escalations)
    if (randomBoolean(0.3) && salesUsers.length > 0) {
      participants.push(randomChoice(salesUsers));
    }

    // Rarely include product
    if (randomBoolean(0.15) && productUsers.length > 0) {
      participants.push(randomChoice(productUsers));
    }

    // Fill up to participantCount with random internal users
    while (participants.length < participantCount && participants.length < internalUsers.length) {
      const candidate = randomChoice(internalUsers);
      if (!participants.find((p) => p.id === candidate.id)) {
        participants.push(candidate);
      }
    }

    // Decision making
    const decisionMade = randomBoolean(decisionRate);
    const decidedBy = decisionMade ? randomChoice(participants) : undefined;

    // Generate messages
    const messageCount = randomInt(messagesPerThread.min, messagesPerThread.max);
    const botMessage = generateZendeskBotMessage(ticket, threadTs);
    const conversationMessages = generateMessages({
      threadTs,
      count: messageCount,
      participants,
      ticket,
      keywords,
      baseDate,
      decisionMade,
      decidedBy,
    });

    const allMessages = [botMessage, ...conversationMessages];

    // Create thread
    threads.push({
      ts: threadTs,
      channel: 'C0123456789', // Mock channel ID
      messages: allMessages,
      triggered_by_ticket: String(ticket.id),
      resulted_in_issue: undefined, // Will be filled later when Linear issues are created
      participants: participants.map((p) => p.id),
      keywords,
      sentiment,
      decision_made: decisionMade,
      decided_by: decidedBy?.id,
      decided_at:
        decisionMade && conversationMessages.length > 0
          ? conversationMessages[conversationMessages.length - 1].created_at
          : undefined,
      created_at: botMessage.created_at,
      updated_at:
        conversationMessages.length > 0
          ? conversationMessages[conversationMessages.length - 1].created_at
          : botMessage.created_at,
    });
  }

  return threads;
}

/**
 * Link Slack threads to Linear issues
 * Call this after Linear issues are generated
 */
export function linkThreadsToIssues(
  threads: SlackThread[],
  issueMapping: Map<string, string> // Map<threadTs, linearIssueId>
): void {
  for (const thread of threads) {
    const issueId = issueMapping.get(thread.ts);
    if (issueId) {
      thread.resulted_in_issue = issueId;
    }
  }
}
